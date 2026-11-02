import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE } from '../../db/drizzle.provider';
import type { DbClient } from '../../db/drizzle.provider';
import { users } from '../../db/schema/users.schema';
import { userLoginDevices } from '../../db/schema/login-devices.schema';
import type { RequestUser } from '../../common/types/api-response.types';
import { WS_TICKET_TYP } from '../../chat/ws-ticket';
import { PASSWORD_RESET_TYP } from '../password-reset-token';
import { isIssuedBeforeCutoff } from '../token-cutoff.util';

interface JwtPayload {
  sub: string;
  role: 'user' | 'admin' | 'super_admin';
  typ?: string;
  /** Device row revocation epoch (`null`/absent on legacy/admin tokens). */
  sid?: string;
  /** Issued-at, seconds (added by the JWT library). */
  iat?: number;
}

const SESSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    @Inject(DRIZZLE) private readonly db: DbClient,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret')!,
    });
  }

  async validate(payload: JwtPayload): Promise<RequestUser> {
    // Chat WS tickets share JWT_SECRET but are single-purpose — never a bearer.
    if (payload.typ === WS_TICKET_TYP) {
      throw new UnauthorizedException('Invalid token type');
    }

    // A password-reset proof shares JWT_SECRET too. It is a one-shot grant
    // for the confirm step, never a session.
    if (payload.typ === PASSWORD_RESET_TYP) {
      throw new UnauthorizedException('Invalid token type');
    }

    // The `sid` is minted by this service, but a malformed value would reach
    // Postgres as a UUID cast error; reject it as a bad credential instead.
    if (payload.sid !== undefined && !SESSION_ID_PATTERN.test(payload.sid)) {
      throw new UnauthorizedException('Invalid session');
    }

    // New tokens are bound to a device row: one indexed query checks the user
    // and the row's revocation epoch together. Legacy tokens (no `sid`) take
    // the original user-only path and stay valid until they expire.
    if (payload.sid) {
      const [row] = await this.db
        .select({
          id: users.id,
          role: users.role,
          status: users.status,
          deletedAt: users.deletedAt,
          tokensValidAfter: users.tokensValidAfter,
          revokedAt: userLoginDevices.revokedAt,
        })
        .from(users)
        .innerJoin(
          userLoginDevices,
          and(
            eq(userLoginDevices.userId, users.id),
            eq(userLoginDevices.sessionId, payload.sid),
          ),
        )
        .where(eq(users.id, payload.sub))
        .limit(1);

      if (!row || row.status !== 'active' || row.deletedAt || row.revokedAt) {
        throw new UnauthorizedException('Session revoked');
      }
      if (isIssuedBeforeCutoff(payload.iat, row.tokensValidAfter)) {
        throw new UnauthorizedException('Session revoked');
      }

      return { id: row.id, role: row.role, sessionId: payload.sid };
    }

    const [user] = await this.db
      .select({
        id: users.id,
        role: users.role,
        status: users.status,
        deletedAt: users.deletedAt,
        tokensValidAfter: users.tokensValidAfter,
      })
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);

    if (!user || user.status !== 'active' || user.deletedAt) {
      throw new UnauthorizedException('User not found or suspended');
    }
    if (isIssuedBeforeCutoff(payload.iat, user.tokensValidAfter)) {
      throw new UnauthorizedException('Session revoked');
    }

    return { id: user.id, role: user.role, sessionId: null };
  }
}
