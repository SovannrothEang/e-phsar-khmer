import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DbClient } from '../../db/drizzle.provider';
import { smsDeliveries, users } from '../../db/schema';
import { OutboxRegistry } from '../../outbox/outbox-registry.service';
import type { HandlerOutcome, OutboxHandler } from '../../outbox/outbox.types';
import type { OutboxEventRow } from '../../db/schema/outbox.schema';
import { maskPhone } from './mask-phone.util';
import { PlasGateClient } from './plasgate-client';
import { SmsRateLimiter } from './sms-rate-limiter';
import { SmsUserLimiter } from './sms-user-limiter';
import { SMS_REQUESTED_OUTBOX_EVENT_TYPE } from './sms-outbox-events';

/**
 * The only notification types that may go out as SMS, for now the phone-verify
 * and forgot-password flows. Anything else with `sendSms` is recorded
 * `skipped` / `type_not_allowed` and stays in-app only until added here.
 */
export const SMS_ALLOWED_TYPES: readonly string[] = [
  'auth.phone.verify',
  'auth.password.reset',
];

/** What `NotificationsService.notify()` enqueues for `notification.sms.requested`. */
export interface SmsOutboxPayload {
  userId: string;
  notificationType: string;
  /** The rendered message text — stripped by `redact()` once terminal. */
  content: string;
}

/**
 * Delivers one `notification.sms.requested` event through PlasGate.
 *
 * Order of gates, each independently sufficient to end the attempt without
 * ever calling PlasGate: unconfigured credentials → allowed-type list →
 * verified-phone gate → per-user cooldown/daily cap → global rate limiter →
 * the actual HTTP call. The per-user slot is taken only once the SMS is
 * otherwise sendable, and is given back if the global limiter or PlasGate
 * asks for a retry, so a retry never burns the user's cooldown. Every exit updates the matching
 * `sms_deliveries` row (looked up by `outboxEventId`, written by
 * `NotificationsService.notify()` at enqueue time) so the audit trail is
 * accurate even when nothing was ever sent.
 */
@Injectable()
export class SmsOutboxHandler implements OutboxHandler, OnModuleInit {
  readonly eventType = SMS_REQUESTED_OUTBOX_EVENT_TYPE;

  private readonly logger = new Logger(SmsOutboxHandler.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DbClient,
    private readonly plasGate: PlasGateClient,
    private readonly rateLimiter: SmsRateLimiter,
    private readonly userLimiter: SmsUserLimiter,
    private readonly registry: OutboxRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async handle(event: OutboxEventRow): Promise<HandlerOutcome> {
    const payload = event.payload as SmsOutboxPayload;

    if (!this.plasGate.isConfigured()) {
      await this.markSkipped(event, null, 'not_configured');
      return { status: 'published' };
    }

    if (!SMS_ALLOWED_TYPES.includes(payload.notificationType)) {
      await this.markSkipped(event, null, 'type_not_allowed');
      return { status: 'published' };
    }

    const [user] = await this.db
      .select({
        primaryPhone: users.primaryPhone,
        phoneVerifiedAt: users.phoneVerifiedAt,
      })
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    // No verified primary phone → never dial out, but this is a terminal
    // outcome, not a failure: the notification's in-app row is unaffected,
    // and nothing here will ever become sendable by retrying.
    if (!user?.primaryPhone || !user.phoneVerifiedAt) {
      await this.markSkipped(
        event,
        user?.primaryPhone ?? null,
        'phone_not_verified',
      );
      return { status: 'published' };
    }

    const to = this.plasGate.toInternational(user.primaryPhone);
    if (!to) {
      await this.markSkipped(event, user.primaryPhone, 'invalid_phone');
      return { status: 'published' };
    }

    const slot = {
      userId: payload.userId,
      notificationType: payload.notificationType,
      eventId: event.id,
    };
    const userDecision = await this.userLimiter.acquire(slot);
    if (userDecision === 'unavailable') {
      await this.bumpAttempt(event, user.primaryPhone);
      return { status: 'retry', error: 'SMS user limiter unavailable' };
    }
    if (userDecision !== 'allowed') {
      await this.markSkipped(
        event,
        user.primaryPhone,
        userDecision === 'cooldown' ? 'rate_limited' : 'daily_cap',
      );
      return { status: 'published' };
    }

    const decision = await this.rateLimiter.tryAcquire();
    if (decision !== 'allowed') {
      await this.userLimiter.release(slot);
      const error =
        decision === 'over_budget'
          ? 'Over the PlasGate rate-limit budget'
          : 'SMS rate limiter unavailable';
      await this.bumpAttempt(event, user.primaryPhone);
      return { status: 'retry', error };
    }

    const result = await this.plasGate.send({
      to,
      content: payload.content,
    });

    if (result.outcome === 'sent') {
      await this.db
        .update(smsDeliveries)
        .set({
          status: 'sent',
          maskedPhone: maskPhone(user.primaryPhone),
          sentAt: new Date(),
          providerStatus: result.providerStatus,
          providerReply: result.providerReply,
          attempts: event.attempts,
        })
        .where(eq(smsDeliveries.outboxEventId, event.id));
      return { status: 'published' };
    }

    if (result.outcome === 'failed') {
      await this.db
        .update(smsDeliveries)
        .set({
          status: 'failed',
          maskedPhone: maskPhone(user.primaryPhone),
          providerStatus: result.providerStatus,
          providerReply: result.providerReply,
          attempts: event.attempts,
        })
        .where(eq(smsDeliveries.outboxEventId, event.id));
      return {
        status: 'failed',
        error: result.providerReply ?? `PlasGate HTTP ${result.providerStatus}`,
      };
    }

    // outcome === 'retry' (network error, timeout, 429, 5xx)
    await this.userLimiter.release(slot);
    await this.db
      .update(smsDeliveries)
      .set({
        attempts: event.attempts,
        providerStatus: result.providerStatus,
        providerReply: result.providerReply,
      })
      .where(eq(smsDeliveries.outboxEventId, event.id));
    return {
      status: 'retry',
      error: result.providerReply ?? `PlasGate HTTP ${result.providerStatus}`,
    };
  }

  /** The outbox gave up — nothing will try this event again. */
  async onAbandoned(event: OutboxEventRow, lastError: string): Promise<void> {
    await this.db
      .update(smsDeliveries)
      .set({
        status: 'failed',
        providerReply: lastError,
        attempts: event.attempts,
      })
      .where(eq(smsDeliveries.outboxEventId, event.id));
    this.logger.warn(
      `SMS event ${event.id} abandoned after ${event.attempts} attempts: ${lastError}`,
    );
  }

  /** Strips the message text once the event reaches a terminal state. */
  redact(payload: unknown): unknown {
    const p = payload as Partial<SmsOutboxPayload>;
    return {
      userId: p.userId,
      notificationType: p.notificationType,
      content: '[redacted]',
    };
  }

  private async markSkipped(
    event: OutboxEventRow,
    phone: string | null,
    skipReason: string,
  ): Promise<void> {
    await this.db
      .update(smsDeliveries)
      .set({
        status: 'skipped',
        skipReason,
        maskedPhone: maskPhone(phone),
        attempts: event.attempts,
      })
      .where(eq(smsDeliveries.outboxEventId, event.id));
  }

  private async bumpAttempt(
    event: OutboxEventRow,
    phone: string | null,
  ): Promise<void> {
    await this.db
      .update(smsDeliveries)
      .set({ maskedPhone: maskPhone(phone), attempts: event.attempts })
      .where(eq(smsDeliveries.outboxEventId, event.id));
  }
}
