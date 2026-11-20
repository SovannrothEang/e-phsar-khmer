import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import {
  and,
  count,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNull,
  lt,
  ne,
  or,
  sql,
} from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.provider';
import type { DbClient, DbExecutor } from '../db/drizzle.provider';
import { users, userPhones } from '../db/schema/users.schema';
import { userLoginDevices } from '../db/schema/login-devices.schema';
import { ChatPubSubService } from '../chat/chat-pubsub.service';
import type { UserRow } from '../db/schema/users.schema';
import {
  normalizeAdminUsername,
  recordUsernameChange,
} from '../users/username.util';
import { listings } from '../db/schema/listings.schema';
import { userSubscriptions } from '../db/schema/subscriptions.schema';
import type {
  PaginatedResponse,
  RequestUser,
} from '../common/types/api-response.types';
import type { ListUsersDto } from './dto/list-users.dto';
import type { CreateUserDto } from './dto/create-user.dto';
import type { UpdateUserDto } from './dto/update-user.dto';
import type { StatsRange } from './dto/timeseries-query.dto';
import {
  assertCanManageUser,
  revokesSuperAdmin,
  type ManageChange,
} from './admin-user-policy';

const SALT_ROUNDS = 10;
const DAY_MS = 24 * 60 * 60 * 1000;
// Cambodia is ICT (UTC+7) with no daylight saving — a fixed offset is exact.
const ICT_OFFSET_MS = 7 * 60 * 60 * 1000;
const MAX_USERNAME_LENGTH = 50;

/**
 * Admin handles keep the casing the admin typed (uniqueness is enforced by the
 * case-insensitive index); trimming + NFC keeps the stored value addressable by
 * a URL. The DTO only bounds the raw string, so the real shape check is here.
 */
function normalizedAdminUsername(value: string): string {
  const normalized = normalizeAdminUsername(value);
  const length = Array.from(normalized).length;
  if (length === 0 || length > MAX_USERNAME_LENGTH) {
    throw new BadRequestException('USERNAME_INVALID');
  }
  return normalized;
}

export type PublicUser = Omit<UserRow, 'passwordHash' | 'tokensValidAfter'>;
export type PublicUserWithAccount = PublicUser & {
  accountType: 'Premium' | 'Normal';
};

export interface StatMetric {
  value: number;
  changePct: number;
  trend: 'up' | 'down';
}

export interface AdminStats {
  totalUsers: StatMetric;
  newUsers: StatMetric;
  totalListings: StatMetric;
  activeListings: StatMetric;
}

export interface TimeseriesPoint {
  date: string;
  newUsers: number;
  newListings: number;
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DbClient,
    private readonly pubsub: ChatPubSubService,
  ) {}

  private toPublic(user: UserRow): PublicUser {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _ph, tokensValidAfter: _tva, ...rest } = user;
    return rest;
  }

  /** Build a card metric: `value` is the headline, `changePct`/`trend` compare
   *  the current 30-day inflow (`cur`) to the prior 30-day inflow (`prev`). */
  private metric(value: number, cur: number, prev: number): StatMetric {
    let changePct: number;
    if (prev === 0) changePct = cur > 0 ? 100 : 0;
    else changePct = Math.round(((cur - prev) / prev) * 1000) / 10;
    return { value, changePct, trend: cur >= prev ? 'up' : 'down' };
  }

  async getStats(): Promise<AdminStats> {
    const now = Date.now();
    const d30 = new Date(now - 30 * DAY_MS);
    const d60 = new Date(now - 60 * DAY_MS);
    const c = (): { value: ReturnType<typeof count> } => ({ value: count() });

    const [
      [totalUsers],
      [usersCur],
      [usersPrev],
      [totalListings],
      [listingsCur],
      [listingsPrev],
      [activeListings],
      [activeCur],
      [activePrev],
    ] = await Promise.all([
      this.db.select(c()).from(users).where(ne(users.status, 'deleted')),
      this.db
        .select(c())
        .from(users)
        .where(and(ne(users.status, 'deleted'), gte(users.createdAt, d30))),
      this.db
        .select(c())
        .from(users)
        .where(
          and(
            ne(users.status, 'deleted'),
            gte(users.createdAt, d60),
            lt(users.createdAt, d30),
          ),
        ),
      this.db.select(c()).from(listings).where(ne(listings.status, 'deleted')),
      this.db.select(c()).from(listings).where(gte(listings.createdAt, d30)),
      this.db
        .select(c())
        .from(listings)
        .where(and(gte(listings.createdAt, d60), lt(listings.createdAt, d30))),
      this.db.select(c()).from(listings).where(eq(listings.status, 'active')),
      this.db
        .select(c())
        .from(listings)
        .where(
          and(eq(listings.status, 'active'), gte(listings.createdAt, d30)),
        ),
      this.db
        .select(c())
        .from(listings)
        .where(
          and(
            eq(listings.status, 'active'),
            gte(listings.createdAt, d60),
            lt(listings.createdAt, d30),
          ),
        ),
    ]);

    return {
      totalUsers: this.metric(
        totalUsers.value,
        usersCur.value,
        usersPrev.value,
      ),
      newUsers: this.metric(usersCur.value, usersCur.value, usersPrev.value),
      totalListings: this.metric(
        totalListings.value,
        listingsCur.value,
        listingsPrev.value,
      ),
      activeListings: this.metric(
        activeListings.value,
        activeCur.value,
        activePrev.value,
      ),
    };
  }

  async getTimeseries(range: StatsRange): Promise<TimeseriesPoint[]> {
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;

    // Bucket by Cambodia calendar day (ICT = UTC+7, no DST → fixed offset).
    // `since` is the UTC instant at the start of the earliest ICT day in range;
    // `sinceUtc + i*DAY` lands exactly on each subsequent ICT midnight.
    const now = Date.now();
    const ictNow = new Date(now + ICT_OFFSET_MS); // shift so UTC fields read ICT wall clock
    const startOfTodayIct =
      Date.UTC(
        ictNow.getUTCFullYear(),
        ictNow.getUTCMonth(),
        ictNow.getUTCDate(),
      ) - ICT_OFFSET_MS;
    const since = new Date(startOfTodayIct - (days - 1) * DAY_MS);

    const userDay = sql`date_trunc('day', ${users.createdAt} AT TIME ZONE 'Asia/Phnom_Penh')`;
    const listingDay = sql`date_trunc('day', ${listings.createdAt} AT TIME ZONE 'Asia/Phnom_Penh')`;

    const [userRows, listingRows] = await Promise.all([
      this.db
        .select({
          day: sql<string>`to_char(${userDay}, 'YYYY-MM-DD')`,
          c: count(),
        })
        .from(users)
        .where(gte(users.createdAt, since))
        .groupBy(userDay),
      this.db
        .select({
          day: sql<string>`to_char(${listingDay}, 'YYYY-MM-DD')`,
          c: count(),
        })
        .from(listings)
        .where(gte(listings.createdAt, since))
        .groupBy(listingDay),
    ]);

    const userMap = new Map(userRows.map((r) => [r.day, Number(r.c)]));
    const listingMap = new Map(listingRows.map((r) => [r.day, Number(r.c)]));

    const out: TimeseriesPoint[] = [];
    for (let i = 0; i < days; i++) {
      // Re-add the offset so the UTC date fields spell the ICT calendar day.
      const key = new Date(since.getTime() + i * DAY_MS + ICT_OFFSET_MS)
        .toISOString()
        .slice(0, 10);
      out.push({
        date: key,
        newUsers: userMap.get(key) ?? 0,
        newListings: listingMap.get(key) ?? 0,
      });
    }
    return out;
  }

  async listUsers(
    dto: ListUsersDto,
  ): Promise<PaginatedResponse<PublicUserWithAccount>> {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const conditions = [];
    if (dto.status) {
      conditions.push(eq(users.status, dto.status));
    } else {
      conditions.push(ne(users.status, 'deleted'));
    }
    if (dto.role) conditions.push(eq(users.role, dto.role));
    // Premium is derived from an active subscription, so it filters as an
    // EXISTS — the page-level `accountType` annotation below only labels rows.
    if (dto.accountType) {
      const hasActivePlan = sql`exists (
        select 1 from ${userSubscriptions}
        where ${userSubscriptions.userId} = ${users.id}
          and ${userSubscriptions.supersededAt} is null
          and ${userSubscriptions.expiresAt} > now()
      )`;
      conditions.push(
        dto.accountType === 'premium'
          ? hasActivePlan
          : sql`not ${hasActivePlan}`,
      );
    }
    if (dto.verified !== undefined) {
      const isVerified = sql`(${users.phoneVerifiedAt} is not null or ${users.emailVerifiedAt} is not null)`;
      conditions.push(dto.verified ? isVerified : sql`not ${isVerified}`);
    }
    if (dto.q) {
      const term = `%${dto.q}%`;
      conditions.push(
        or(
          ilike(users.username, term),
          ilike(users.email, term),
          ilike(users.firstName, term),
          ilike(users.lastName, term),
          ilike(users.primaryPhone, term),
        )!,
      );
    }
    const where = and(...conditions);

    const [rows, [totalRow]] = await Promise.all([
      this.db
        .select()
        .from(users)
        .where(where)
        .orderBy(desc(users.createdAt))
        .limit(pageSize)
        .offset(offset),
      this.db.select({ value: count() }).from(users).where(where),
    ]);

    const total = totalRow.value;

    // Premium = has an active (non-expired) subscription. Query just the page's users.
    const pageUserIds = rows.map((r) => r.id);
    const premium = new Set<string>();
    if (pageUserIds.length) {
      const active = await this.db
        .selectDistinct({ userId: userSubscriptions.userId })
        .from(userSubscriptions)
        .where(
          and(
            inArray(userSubscriptions.userId, pageUserIds),
            isNull(userSubscriptions.supersededAt),
            gt(userSubscriptions.expiresAt, new Date()),
          ),
        );
      for (const a of active) premium.add(a.userId);
    }

    return {
      data: rows.map((r) => ({
        ...this.toPublic(r),
        accountType: premium.has(r.id)
          ? ('Premium' as const)
          : ('Normal' as const),
      })),
      meta: {
        nextCursor: null,
        hasMore: offset + rows.length < total,
        limit: pageSize,
        total,
        page,
        pageSize,
      },
    };
  }

  async getUser(id: string): Promise<PublicUser> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!user) throw new NotFoundException('User not found');
    return this.toPublic(user);
  }

  async createUser(
    dto: CreateUserDto,
    requester: RequestUser,
  ): Promise<PublicUser> {
    // Only super_admin can assign admin or super_admin roles.
    if (dto.role && dto.role !== 'user' && requester.role !== 'super_admin') {
      throw new ForbiddenException('ONLY_SUPER_ADMIN_CAN_ASSIGN_ADMIN_ROLES');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const primaryPhone = dto.phones?.[0] ?? null;
    const username = normalizedAdminUsername(dto.username);

    try {
      return await this.db.transaction(async (tx) => {
        const [user] = await tx
          .insert(users)
          .values({
            username,
            passwordHash,
            role: dto.role ?? 'user',
            firstName: dto.firstName ?? null,
            lastName: dto.lastName ?? null,
            email: dto.email ?? null,
            primaryPhone,
          })
          .returning();

        if (dto.phones?.length) {
          await tx.insert(userPhones).values(
            dto.phones.map((phone, i) => ({
              userId: user.id,
              phone,
              isPrimary: i === 0,
            })),
          );
        }

        return this.toPublic(user);
      });
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        throw new ConflictException('Username, email, or phone already in use');
      }
      throw err;
    }
  }

  async updateUser(
    id: string,
    dto: UpdateUserDto,
    requester: RequestUser,
  ): Promise<PublicUser> {
    // A suspension with no stated reason is not appealable — the login refusal
    // renders `statusReason`, so an empty one is a 400 at the boundary rather
    // than a blocked account with nothing to read.
    const suspending = dto.status === 'suspended';
    const statusReason = dto.statusReason?.trim() || null;
    if (suspending && !statusReason) {
      throw new BadRequestException('STATUS_REASON_REQUIRED');
    }

    // Who may change what is decided in the transaction below, against the
    // locked target row (authorizeManage).
    const patch: Partial<UserRow> = {};
    if (dto.username !== undefined) {
      patch.username = normalizedAdminUsername(dto.username);
    }
    if (dto.role !== undefined) patch.role = dto.role;
    if (dto.status !== undefined && !suspending) patch.status = dto.status;
    if (suspending) {
      // Applied by `suspendAccount` below, which owns the status, the reason
      // triple and the session revocation as one unit.
      patch.status = undefined;
    }
    if (dto.firstName !== undefined) patch.firstName = dto.firstName;
    if (dto.lastName !== undefined) patch.lastName = dto.lastName;
    if (dto.email !== undefined) {
      patch.email = dto.email;
      // An admin edit is not a verification: any email change drops the proof
      // (conservative even when the value is unchanged).
      patch.emailVerifiedAt = null;
    }
    if (dto.password)
      patch.passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    if (dto.phones?.[0]) patch.primaryPhone = dto.phones[0];

    let updatedPublic: PublicUser;
    try {
      updatedPublic = await this.db.transaction(async (tx) => {
        await this.authorizeManage(tx, requester, id, {
          role: dto.role,
          status: dto.status,
        });

        // Read before the update so the released handle can be aliased.
        const [before] =
          dto.username !== undefined
            ? await tx
                .select({ username: users.username })
                .from(users)
                .where(eq(users.id, id))
                .limit(1)
            : [];

        if (Object.keys(patch).length > 0) {
          await tx.update(users).set(patch).where(eq(users.id, id));
        }

        if (dto.username !== undefined) {
          await recordUsernameChange(
            tx,
            id,
            before?.username ?? null,
            patch.username ?? null,
          );
        }

        // Suspension is a session-ending state: `suspendAccount` moves the
        // bearer cutoff and revokes every device row in this same
        // transaction, so access tokens, refresh chains and sid-less legacy
        // tokens all die on their next request.
        if (suspending) {
          await this.suspendAccount(tx, id, statusReason!, requester.id);
        } else if (dto.status === 'active') {
          // Reinstating clears the triple: a stale "why you were suspended"
          // must not survive on an active account. The who/when/why of a past
          // suspension is deliberately not kept — there is no appeal record.
          await tx
            .update(users)
            .set({
              statusReason: null,
              suspendedAt: null,
              suspendedById: null,
            })
            .where(eq(users.id, id));
        }

        if (dto.phones) {
          await tx.delete(userPhones).where(eq(userPhones.userId, id));
          if (dto.phones.length) {
            await tx.insert(userPhones).values(
              dto.phones.map((phone, i) => ({
                userId: id,
                phone,
                isPrimary: i === 0,
              })),
            );
          }
        }

        const [updated] = await tx
          .select()
          .from(users)
          .where(eq(users.id, id))
          .limit(1);
        return this.toPublic(updated);
      });
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        throw new ConflictException('Username, email, or phone already in use');
      }
      throw err;
    }

    // After the commit, never inside it: a suspension that rolled back must not
    // close the account's sockets. Best-effort — the socket layer is an
    // optimisation over REST refusal, and the next request fails anyway.
    if (suspending) await this.announceSuspension(id);
    return updatedPublic;
  }

  /**
   * Tells every instance to close this account's live sockets. The handshake
   * check only refuses new connections, so a socket opened before the
   * suspension would otherwise keep sending chat messages.
   */
  async announceSuspension(userId: string): Promise<void> {
    try {
      await this.pubsub.publish({
        targetUserId: userId,
        type: 'session_ended',
        payload: { reason: 'Account suspended' },
      });
    } catch (err) {
      this.logger.warn(
        `Could not close sockets for suspended ${userId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Ends an account's access in one place: status, the reason triple, the
   * bearer cutoff and every device row. Callers pass their own transaction so
   * a suspension commits with whatever justified it (an admin edit, an
   * approved report). Reinstatement is not symmetric — it is a status write
   * plus clearing the triple, and deliberately keeps no appeal history.
   */
  async suspendAccount(
    tx: DbExecutor,
    targetUserId: string,
    reason: string,
    actorId: string,
  ): Promise<void> {
    const now = new Date();
    await tx
      .update(users)
      .set({
        status: 'suspended',
        statusReason: reason,
        suspendedAt: now,
        suspendedById: actorId,
        tokensValidAfter: now,
        updatedAt: now,
      })
      .where(eq(users.id, targetUserId));
    await tx
      .update(userLoginDevices)
      .set({ revokedAt: now })
      .where(
        and(
          eq(userLoginDevices.userId, targetUserId),
          isNull(userLoginDevices.revokedAt),
        ),
      );
  }

  async deleteUser(
    id: string,
    requester: RequestUser,
  ): Promise<{ id: string }> {
    return this.db.transaction(async (tx) => {
      await this.authorizeManage(tx, requester, id, { delete: true });

      // Free globally-unique phone rows so identifiers can be reused. Nulling
      // `primaryPhone` here is also what marks this as an ADMIN deletion:
      // AuthService.findRecoverable only revives a soft-deleted account that
      // still has a phone, so an account removed this way can never be
      // brought back by signing in. UsersService.deleteOwnAccount keeps it.
      await tx.delete(userPhones).where(eq(userPhones.userId, id));
      await tx
        .update(users)
        .set({ status: 'deleted', deletedAt: new Date(), primaryPhone: null })
        .where(eq(users.id, id));

      return { id };
    });
  }

  /**
   * Locks the target row and applies `assertCanManageUser`. When the change
   * would strip a super_admin, every active super_admin row is locked and
   * counted in the same transaction, so two of them demoting each other
   * concurrently serialize and the second sees only one left.
   *
   * Public so other admin actions that change an account (approving a user
   * report suspends its target) go through the same rules.
   */
  async authorizeManage(
    tx: DbExecutor,
    requester: RequestUser,
    id: string,
    change: ManageChange,
  ): Promise<void> {
    const [target] = await tx
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, id))
      .limit(1)
      .for('update');
    if (!target) throw new NotFoundException('User not found');

    let activeSuperAdmins: number | undefined;
    if (revokesSuperAdmin(target, change)) {
      const rows = await tx
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.role, 'super_admin'),
            eq(users.status, 'active'),
            isNull(users.deletedAt),
          ),
        )
        .for('update');
      activeSuperAdmins = rows.length;
    }
    assertCanManageUser(requester, target, change, activeSuperAdmins);
  }

  private isUniqueViolation(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code?: string }).code === '23505'
    );
  }
}
