import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import type Redis from 'ioredis';
import {
  THROTTLER_REDIS,
  throttleKeyPrefix,
} from '../common/throttler/throttler-storage';

/** How long a started social flow may be completed. */
export const SOCIAL_STATE_TTL_SECONDS = 600;

/**
 * The shape every consumer may send back: 24 random bytes, base64url, so 32
 * characters of `[A-Za-z0-9_-]`. Anchored and length-bounded because it is
 * checked before it is used as a Redis key.
 */
export const SOCIAL_STATE_PATTERN = /^[A-Za-z0-9_-]{32}$/;

/**
 * Server-side half of the social-login CSRF defence: every authorize URL is
 * minted together with a single-use nonce, and the callback is only accepted
 * when that nonce comes back.
 *
 * What this buys, stated honestly: the callback token a victim's browser
 * presents must be paired with a nonce that was minted by this service and
 * never used before. That stops a replayed/guessed callback, and — because
 * the web layer stores the nonce in an httpOnly cookie bound to the browser
 * that started the flow — it stops a *crafted* callback URL from completing
 * with someone else's Supabase token. It is not a defence against an attacker
 * who can already read the victim's cookies or URL bar.
 *
 * FAILS CLOSED, unlike the throttler and the login lockout: their choice of
 * availability over limiting is about not locking users out during a Redis
 * outage, but a state check that fails open is not a state check. Phone,
 * password and OTP sign-in are unaffected when this refuses.
 */
@Injectable()
export class SocialStateService {
  private readonly logger = new Logger(SocialStateService.name);
  private readonly prefix: string;

  constructor(
    @Inject(THROTTLER_REDIS) private readonly redis: Redis,
    configService: ConfigService,
  ) {
    // Same namespace as the throttler and the BullMQ queues, so two
    // environments sharing one Redis never accept each other's nonces.
    this.prefix = throttleKeyPrefix(configService);
  }

  /** Mints a nonce for `provider` and remembers it until it is consumed. */
  async issue(provider: string): Promise<string> {
    const state = randomBytes(24).toString('base64url');
    try {
      await this.redis.set(
        this.key(state),
        provider,
        'EX',
        SOCIAL_STATE_TTL_SECONDS,
      );
    } catch (err) {
      this.logger.error(`Could not mint a social state: ${this.message(err)}`);
      throw new ServiceUnavailableException(
        'Social sign-in is temporarily unavailable',
      );
    }
    return state;
  }

  /**
   * Consumes `state` and reports whether it was minted for `provider`.
   * GETDEL, so two callbacks racing on one nonce cannot both win.
   */
  async consume(state: string, provider: string): Promise<boolean> {
    if (!SOCIAL_STATE_PATTERN.test(state)) return false;
    let stored: string | null;
    try {
      stored = await this.redis.getdel(this.key(state));
    } catch (err) {
      this.logger.warn(
        `Social state check unavailable, refusing the callback: ${this.message(err)}`,
      );
      return false;
    }
    return stored === provider;
  }

  private key(state: string): string {
    return `${this.prefix}:social-state:${state}`;
  }

  private message(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
