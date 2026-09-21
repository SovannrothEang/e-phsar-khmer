import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

interface RequestWithUser {
  user?: { id?: string };
  ips?: string[];
  ip?: string;
}

/**
 * Keys the rate limit on the authenticated user id when present, falling
 * back to IP for anonymous requests. Requires JwtAuthGuard to run BEFORE
 * this guard (see the APP_GUARD order in app.module.ts) so `req.user` is
 * already set — without that ordering this always falls back to IP.
 *
 * Fixes a real fairness bug: the default IP-keyed tracker shares one bucket
 * across every user behind the same NAT/proxy — one busy office or campus
 * throttles everyone else on it.
 */
@Injectable()
export class UserAwareThrottlerGuard extends ThrottlerGuard {
  // Signature is fixed by the base class (@nestjs/throttler) — matched
  // exactly so the override stays type-sound.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected getTracker(req: Record<string, any>): Promise<string> {
    const typed = req as RequestWithUser;
    if (typed.user?.id) return Promise.resolve(`user:${typed.user.id}`);
    return Promise.resolve(
      typed.ips?.length ? typed.ips[0] : (typed.ip ?? 'unknown'),
    );
  }
}
