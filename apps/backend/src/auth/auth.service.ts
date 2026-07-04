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
import { and, eq, isNull, or } from 'drizzle-orm';
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
import type { RegisterDto } from './dto/register.dto';
import type { VerifyOtpDto } from './dto/verify-otp.dto';
import type { RefreshDto } from './dto/refresh.dto';
import type { SocialLoginDto } from './dto/social-login.dto';
import {
  buildUsernameBase,
  generateUniqueUsername,
} from '../users/username.util';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

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

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('INVALID_CREDENTIALS');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('INVALID_CREDENTIALS');
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
    const { data, error } = await this.supabaseService.verifyOtp(
      dto.phone,
      dto.token,
    );
    if (error || !data.user)
      throw new UnauthorizedException('Invalid or expired OTP');

    const user = await this.mirrorSupabaseUser(data.user, 'phone', dto.phone);
    const tokens = this.issueTokens(user);
    return { ...tokens, user: this.toPublicUser(user) };
  }

  async requestPhoneOtp(phone: string): Promise<{ otpSent: true }> {
    await this.supabaseService.signInWithOtp(phone);
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
    let payload: { sub: string; role: 'user' | 'admin' };
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
  ): Promise<UserRow> {
    const resolvedPhone = phone ?? supabaseUser.phone ?? null;

    let user: UserRow;

    if (provider === 'phone') {
      const [row] = await this.db
        .insert(users)
        .values({ primaryPhone: resolvedPhone })
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
