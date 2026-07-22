import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { and, count, desc, eq, gte, ilike, ne, or } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.provider';
import type { DbClient } from '../db/drizzle.provider';
import { users, userPhones } from '../db/schema/users.schema';
import type { UserRow } from '../db/schema/users.schema';
import { listings } from '../db/schema/listings.schema';
import type { PaginatedResponse } from '../common/types/api-response.types';
import type { ListUsersDto } from './dto/list-users.dto';
import type { CreateUserDto } from './dto/create-user.dto';
import type { UpdateUserDto } from './dto/update-user.dto';

const SALT_ROUNDS = 10;

export type PublicUser = Omit<UserRow, 'passwordHash'>;

export interface AdminStats {
  totalUsers: number;
  newUsers: number;
  totalListings: number;
  activeListings: number;
}

@Injectable()
export class AdminService {
  constructor(@Inject(DRIZZLE) private readonly db: DbClient) {}

  private toPublic(user: UserRow): PublicUser {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _ph, ...rest } = user;
    return rest;
  }

  async getStats(): Promise<AdminStats> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [[totalUsers], [newUsers], [totalListings], [activeListings]] =
      await Promise.all([
        this.db
          .select({ value: count() })
          .from(users)
          .where(ne(users.status, 'deleted')),
        this.db
          .select({ value: count() })
          .from(users)
          .where(gte(users.createdAt, thirtyDaysAgo)),
        this.db
          .select({ value: count() })
          .from(listings)
          .where(ne(listings.status, 'deleted')),
        this.db
          .select({ value: count() })
          .from(listings)
          .where(eq(listings.status, 'active')),
      ]);

    return {
      totalUsers: totalUsers.value,
      newUsers: newUsers.value,
      totalListings: totalListings.value,
      activeListings: activeListings.value,
    };
  }

  async listUsers(dto: ListUsersDto): Promise<PaginatedResponse<PublicUser>> {
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
    return {
      data: rows.map((r) => this.toPublic(r)),
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

  async createUser(dto: CreateUserDto): Promise<PublicUser> {
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const primaryPhone = dto.phones?.[0] ?? null;

    try {
      return await this.db.transaction(async (tx) => {
        const [user] = await tx
          .insert(users)
          .values({
            username: dto.username,
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

  async updateUser(id: string, dto: UpdateUserDto): Promise<PublicUser> {
    const patch: Partial<UserRow> = {};
    if (dto.username !== undefined) patch.username = dto.username;
    if (dto.role !== undefined) patch.role = dto.role;
    if (dto.status !== undefined) patch.status = dto.status;
    if (dto.firstName !== undefined) patch.firstName = dto.firstName;
    if (dto.lastName !== undefined) patch.lastName = dto.lastName;
    if (dto.email !== undefined) patch.email = dto.email;
    if (dto.password)
      patch.passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    if (dto.phones?.[0]) patch.primaryPhone = dto.phones[0];

    try {
      return await this.db.transaction(async (tx) => {
        const existing = await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, id))
          .limit(1);
        if (existing.length === 0)
          throw new NotFoundException('User not found');

        if (Object.keys(patch).length > 0) {
          await tx.update(users).set(patch).where(eq(users.id, id));
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
  }

  async deleteUser(id: string): Promise<{ id: string }> {
    return this.db.transaction(async (tx) => {
      const [user] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      if (!user) throw new NotFoundException('User not found');

      // Free globally-unique phone rows so identifiers can be reused.
      await tx.delete(userPhones).where(eq(userPhones.userId, id));
      await tx
        .update(users)
        .set({ status: 'deleted', deletedAt: new Date(), primaryPhone: null })
        .where(eq(users.id, id));

      return { id };
    });
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
