import {
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { and, eq, gt, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { DRIZZLE } from '../db/drizzle.provider';
import type { DbClient } from '../db/drizzle.provider';
import {
  users,
  userAuthProviders,
  userPhones,
} from '../db/schema/users.schema';
import type { UserRow } from '../db/schema/users.schema';
import { SupabaseService } from '../common/supabase/supabase.service';
import type { LoginDto } from './dto/login.dto';
import type { LoginOtpDto } from './dto/login-otp.dto';
import type { RegisterDto } from './dto/register.dto';
import type { VerifyOtpDto } from './dto/verify-otp.dto';
import type { RefreshDto } from './dto/refresh.dto';
import type { SocialLoginDto } from './dto/social-login.dto';
import {
  buildUsernameBase,
  generateUniqueUsername,
} from '../users/username.util';
import { ACCOUNT_RETENTION_DAYS } from '../users/account-purge.service';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

/** Mirrors AdminService.createUser bcrypt cost. */
const PASSWORD_SALT_ROUNDS = 10;

export type PublicUser = Omit<UserRow, 'passwordHash'>;

export interface TelegramAuthPayload {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DbClient,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
  ) {}

  async loginWithPassword(
    dto: LoginDto,
  ): Promise<AuthTokens & { user: PublicUser }> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(
        and(
          or(
            eq(users.username, dto.identifier),
            eq(users.primaryPhone, dto.identifier),
          ),
          isNull(users.deletedAt),
        ),
      )
      .limit(1);

    if (!user) {
      // No active account matches, but the identifier may belong to one its
      // owner deleted inside the recovery window — signing back in is how
      // they undo that (the settings page promises it, and the account is
      // still intact until AccountPurgeService runs).
      const recoverable = await this.findRecoverable(dto.identifier);
      if (!recoverable?.passwordHash) {
        throw new UnauthorizedException('INVALID_CREDENTIALS');
      }

      const matches = await bcrypt.compare(
        dto.password,
        recoverable.passwordHash,
      );
      if (!matches) throw new UnauthorizedException('INVALID_CREDENTIALS');

      const revived = await this.revive(recoverable.id);
      const revivedTokens = this.issueTokens(revived);
      return { ...revivedTokens, user: this.toPublicUser(revived) };
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('INVALID_CREDENTIALS');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('INVALID_CREDENTIALS');
    // Unreachable while the lookup above filters deleted rows out, but kept as
    // the guard it has always been: it is the only thing between a deleted
    // account and a token if that filter is ever lifted. Recovery goes through
    // findRecoverable() above, which is deliberate about which rows qualify.
    if (user.deletedAt) throw new UnauthorizedException('Account deactivated');
    if (user.status !== 'active')
      throw new UnauthorizedException('Account suspended');

    const tokens = this.issueTokens(user);
    return { ...tokens, user: this.toPublicUser(user) };
  }

  async registerWithPhone(dto: RegisterDto): Promise<{ otpSent: true }> {
    await this.supabaseService.signInWithOtp(dto.phone);
    return { otpSent: true };
  }

  async verifyPhoneOtp(
    dto: VerifyOtpDto,
  ): Promise<AuthTokens & { user: PublicUser }> {
    // Password is checked BEFORE the Supabase call so a wrong password
    // never burns an OTP attempt. For an existing user this is a login
    // (password must match); for an absent user this is a registration
    // (the password becomes the account's passwordHash).
    const [existing] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.primaryPhone, dto.phone), isNull(users.deletedAt)))
      .limit(1);

    // A legacy bare account (created before passwords were required) is
    // COMPLETED in place: possessing the OTP proves phone ownership, so the
    // submitted password (and names) become the account's. An account that
    // already has a password must match it — credentials are never replaced
    // through this endpoint.
    const completingBareAccount =
      existing !== undefined && !existing.passwordHash;

    if (existing && existing.passwordHash) {
      const valid = await bcrypt.compare(dto.password, existing.passwordHash);
      if (!valid) throw new UnauthorizedException('INVALID_CREDENTIALS');
    }

    // Same recovery window as the password path: a deleted account still
    // answers to its phone, so this revives it instead of letting
    // mirrorSupabaseUser create a second account for the same number. The
    // password is still checked BEFORE the Supabase call, so a wrong one
    // never burns an OTP attempt.
    const recoverable = existing ? null : await this.findRecoverable(dto.phone);
    if (recoverable?.passwordHash) {
      const matches = await bcrypt.compare(
        dto.password,
        recoverable.passwordHash,
      );
      if (!matches) throw new UnauthorizedException('INVALID_CREDENTIALS');
    }

    const { data, error } = await this.supabaseService.verifyOtp(
      dto.phone,
      dto.token,
    );
    if (error || !data.user)
      throw new UnauthorizedException('Invalid or expired OTP');

    if (recoverable) {
      const revived = await this.revive(recoverable.id);
      const revivedTokens = this.issueTokens(revived);
      return { ...revivedTokens, user: this.toPublicUser(revived) };
    }

    if (completingBareAccount) {
      const updateData: Partial<typeof users.$inferInsert> = {
        passwordHash: await bcrypt.hash(dto.password, PASSWORD_SALT_ROUNDS),
        updatedAt: new Date(),
      };
      if (dto.firstName !== undefined) updateData.firstName = dto.firstName;
      if (dto.lastName !== undefined) updateData.lastName = dto.lastName;
      if (existing.username === null) {
        const base = buildUsernameBase(
          dto.firstName ?? existing.firstName,
          dto.lastName ?? existing.lastName,
        );
        if (base !== null) {
          updateData.username = await generateUniqueUsername(this.db, base);
        }
      }

      const [row] = await this.db
        .update(users)
        .set(updateData)
        .where(and(eq(users.id, existing.id), isNull(users.deletedAt)))
        .returning();

      const tokens = this.issueTokens(row);
      return { ...tokens, user: this.toPublicUser(row) };
    }

    // Extras land ONLY in the INSERT values — the conflict path (existing
    // user logging in) must never overwrite password/names/username.
    const insertExtras: Partial<typeof users.$inferInsert> = {};
    if (!existing) {
      insertExtras.passwordHash = await bcrypt.hash(
        dto.password,
        PASSWORD_SALT_ROUNDS,
      );
      if (dto.firstName !== undefined) insertExtras.firstName = dto.firstName;
      if (dto.lastName !== undefined) insertExtras.lastName = dto.lastName;
      const base = buildUsernameBase(dto.firstName, dto.lastName);
      if (base !== null) {
        insertExtras.username = await generateUniqueUsername(this.db, base);
      }
    }

    const user = await this.mirrorSupabaseUser(
      data.user,
      'phone',
      dto.phone,
      insertExtras,
    );
    const tokens = this.issueTokens(user);
    return { ...tokens, user: this.toPublicUser(user) };
  }

  async requestPhoneOtp(phone: string): Promise<{ otpSent: true }> {
    await this.supabaseService.signInWithOtp(phone);
    return { otpSent: true };
  }

  async requestLoginOtp(dto: LoginOtpDto): Promise<{ otpSent: true }> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.primaryPhone, dto.phone), isNull(users.deletedAt)))
      .limit(1);

    if (!user || !user.passwordHash)
      throw new UnauthorizedException('INVALID_CREDENTIALS');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('INVALID_CREDENTIALS');

    await this.supabaseService.signInWithOtp(dto.phone);
    return { otpSent: true };
  }

  async getSocialAuthUrl(
    provider: 'google' | 'facebook',
  ): Promise<{ url: string }> {
    const { data, error } =
      await this.supabaseService.signInWithOAuth(provider);
    if (error || !data.url)
      throw new UnauthorizedException('Failed to get social auth URL');
    return { url: data.url };
  }

  async handleSocialCallback(
    dto: SocialLoginDto,
  ): Promise<AuthTokens & { user: PublicUser }> {
    if (!dto.accessToken)
      throw new UnauthorizedException(
        'accessToken is required for social callback',
      );
    const { data, error } = await this.supabaseService.getUser(dto.accessToken);
    if (error || !data.user)
      throw new UnauthorizedException('Invalid social access token');

    const user = await this.mirrorSupabaseUser(data.user, dto.provider);
    const tokens = this.issueTokens(user);
    return { ...tokens, user: this.toPublicUser(user) };
  }

  async loginWithTelegram(
    payload: TelegramAuthPayload,
  ): Promise<AuthTokens & { user: PublicUser }> {
    const botToken = this.configService.get<string>('telegram.botToken');
    if (!botToken)
      throw new UnauthorizedException('Telegram login not configured');

    const secretKey = createHash('sha256').update(botToken).digest();
    const checkString = Object.entries(payload)
      .filter(([k]) => k !== 'hash')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${String(v)}`)
      .join('\n');

    const hmac = createHmac('sha256', secretKey)
      .update(checkString)
      .digest('hex');
    const receivedHash = Buffer.from(payload.hash, 'hex');
    const computedHash = Buffer.from(hmac, 'hex');

    if (
      receivedHash.length !== computedHash.length ||
      !timingSafeEqual(receivedHash, computedHash)
    ) {
      throw new UnauthorizedException('Invalid Telegram auth data');
    }

    const authAge = Math.floor(Date.now() / 1000) - payload.auth_date;
    if (authAge > 86400)
      throw new UnauthorizedException('Telegram auth data expired');

    const telegramId = String(payload.id);

    const [existingLink] = await this.db
      .select()
      .from(userAuthProviders)
      .where(
        and(
          eq(userAuthProviders.provider, 'telegram'),
          eq(userAuthProviders.providerAccountId, telegramId),
        ),
      )
      .limit(1);

    let user: UserRow;
    if (existingLink) {
      const [found] = await this.db
        .select()
        .from(users)
        .where(eq(users.id, existingLink.userId))
        .limit(1);
      if (!found) throw new UnauthorizedException('User not found');
      user = found;
    } else {
      const base = buildUsernameBase(payload.first_name, payload.last_name);
      const username =
        base !== null ? await generateUniqueUsername(this.db, base) : null;
      const [inserted] = await this.db
        .insert(users)
        .values({
          firstName: payload.first_name ?? null,
          lastName: payload.last_name ?? null,
          username,
          profilePhotoUrl: payload.photo_url ?? null,
        })
        .returning();
      user = inserted;

      await this.db.insert(userAuthProviders).values({
        userId: user.id,
        provider: 'telegram',
        providerAccountId: telegramId,
      });
    }

    const tokens = this.issueTokens(user);
    return { ...tokens, user: this.toPublicUser(user) };
  }

  async refresh(dto: RefreshDto): Promise<AuthTokens> {
    let payload: { sub: string; role: 'user' | 'admin' | 'super_admin' };
    try {
      payload = await this.jwtService.verifyAsync(dto.refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);

    if (!user || user.status !== 'active' || user.deletedAt)
      throw new UnauthorizedException('User not found');
    return this.issueTokens(user);
  }

  /**
   * The account a sign-in should bring back: soft-deleted, inside the
   * retention window, and still holding a phone number.
   *
   * That last condition is the whole distinction between the two ways an
   * account becomes soft-deleted. `UsersService.deleteOwnAccount` keeps the
   * phone — recovery has to be possible — while `AdminService.deleteUser`
   * clears it. So "still has a phone" means the owner left on their own, and
   * an account an admin removed can never be revived by signing in.
   */
  private async findRecoverable(identifier: string): Promise<UserRow | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(
        and(
          or(
            eq(users.username, identifier),
            eq(users.primaryPhone, identifier),
          ),
          isNotNull(users.deletedAt),
          isNotNull(users.primaryPhone),
          // The database's clock, not this process's — the same window the
          // purge sweeper evaluates.
          gt(
            users.deletedAt,
            sql`now() - make_interval(days => ${ACCOUNT_RETENTION_DAYS})`,
          ),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  /** Clears the deletion. Idempotent — a concurrent sign-in may have won the race. */
  private async revive(userId: string): Promise<UserRow> {
    const [row] = await this.db
      .update(users)
      .set({ status: 'active', deletedAt: null })
      .where(and(eq(users.id, userId), isNotNull(users.deletedAt)))
      .returning();
    if (row) return row;

    const [current] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!current) throw new UnauthorizedException('INVALID_CREDENTIALS');
    return current;
  }

  private issueTokens(user: UserRow): AuthTokens {
    const jwtPayload = { sub: user.id, role: user.role };
    const accessExpiresIn = (this.configService.get<string>(
      'jwt.accessExpiresIn',
    ) ?? '15m') as unknown as number;
    const refreshExpiresIn = (this.configService.get<string>(
      'jwt.refreshExpiresIn',
    ) ?? '30d') as unknown as number;
    const accessToken = this.jwtService.sign(jwtPayload, {
      expiresIn: accessExpiresIn,
    });
    const refreshToken = this.jwtService.sign(jwtPayload, {
      secret: this.configService.get<string>('jwt.refreshSecret'),
      expiresIn: refreshExpiresIn,
    });
    return {
      accessToken,
      refreshToken,
      expiresIn: this.configService.get<string>('jwt.accessExpiresIn') ?? '15m',
    };
  }

  async mirrorSupabaseUser(
    supabaseUser: { id: string; phone?: string; email?: string },
    provider: 'phone' | 'google' | 'facebook',
    phone?: string,
    insertExtras?: Partial<typeof users.$inferInsert>,
  ): Promise<UserRow> {
    const resolvedPhone = phone ?? supabaseUser.phone ?? null;

    let user: UserRow;

    if (provider === 'phone') {
      const [row] = await this.db
        .insert(users)
        .values({ primaryPhone: resolvedPhone, ...insertExtras })
        .onConflictDoUpdate({
          target: users.primaryPhone,
          targetWhere: isNull(users.deletedAt),
          set: { updatedAt: new Date() },
        })
        .returning();
      user = row;
    } else {
      const [row] = await this.db
        .insert(users)
        .values({ email: supabaseUser.email ?? null })
        .onConflictDoUpdate({
          target: users.email,
          targetWhere: isNull(users.deletedAt),
          set: { updatedAt: new Date() },
        })
        .returning();
      user = row;
    }

    await this.db
      .insert(userAuthProviders)
      .values({ userId: user.id, provider })
      .onConflictDoNothing({
        target: [userAuthProviders.userId, userAuthProviders.provider],
      });

    if (resolvedPhone) {
      await this.db
        .insert(userPhones)
        .values({ userId: user.id, phone: resolvedPhone, isPrimary: true })
        .onConflictDoNothing();
    }

    return user;
  }

  private toPublicUser(user: UserRow): PublicUser {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _ph, ...publicUser } = user;
    return publicUser;
  }

  async findById(id: string): Promise<PublicUser> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!user) throw new NotFoundException('User not found');
    return this.toPublicUser(user);
  }
}
