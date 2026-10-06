import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../db/drizzle.provider';
import type { DbClient } from '../../db/drizzle.provider';
import { users } from '../../db/schema/users.schema';
import type { RequestUser } from '../../common/types/api-response.types';
import { WS_TICKET_TYP } from '../../chat/ws-ticket';

interface JwtPayload {
  sub: string;
  role: 'user' | 'admin' | 'super_admin';
  typ?: string;
}

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

    const [user] = await this.db
      .select({
        id: users.id,
        role: users.role,
        status: users.status,
        deletedAt: users.deletedAt,
      })
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);

    if (!user || user.status !== 'active' || user.deletedAt) {
      throw new UnauthorizedException('User not found or suspended');
    }

    return { id: user.id, role: user.role };
  }
}
