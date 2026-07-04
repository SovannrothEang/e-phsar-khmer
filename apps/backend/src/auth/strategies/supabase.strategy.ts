import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { ExtractJwt } from 'passport-jwt';
import { SupabaseService } from '../../common/supabase/supabase.service';
import type { RequestUser } from '../../common/types/api-response.types';

@Injectable()
export class SupabaseStrategy extends PassportStrategy(Strategy, 'supabase') {
  constructor(private readonly supabaseService: SupabaseService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: 'placeholder',
      passReqToCallback: false,
    });
  }

  async validate(
    _payload: unknown,
    done: (err: Error | null, user?: RequestUser) => void,
  ) {
    try {
      const token = '';
      const { data, error } = await this.supabaseService.getUser(token);
      if (error || !data.user) {
        done(new UnauthorizedException('Invalid Supabase token'));
        return;
      }
      done(null, { id: data.user.id, role: 'user' });
    } catch (err) {
      done(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
