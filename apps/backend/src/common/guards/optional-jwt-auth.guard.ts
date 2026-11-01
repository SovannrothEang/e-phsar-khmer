import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { RequestUser } from '../types/api-response.types';

/**
 * Authentication that is allowed to fail.
 *
 * The global `JwtAuthGuard` skips `@Public()` routes entirely, so a public
 * route that still wants the viewer's identity when a token happens to be
 * present uses this guard instead. `@nestjs/passport`'s `canActivate`
 * assigns the `handleRequest` result to `req.user` and always resolves true,
 * so returning null keeps the request anonymous rather than rejecting it.
 * `JwtStrategy` still applies its usual active-user and WS-ticket checks when
 * a token is present, which is what keeps a stale token from reaching a
 * foreign-key insert.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = RequestUser>(
    _err: unknown,
    user: TUser | false | null,
  ): TUser {
    // The cast only satisfies the base signature; the runtime value is null
    // for anonymous callers, and `CurrentUser` reads it back as `| null`.
    return (user || null) as TUser;
  }
}
