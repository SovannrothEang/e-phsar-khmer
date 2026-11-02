import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from './users.schema';

/**
 * Outcome of one SMS delivery attempt.
 *
 * `skipped` covers both "unconfigured" (no PlasGate credentials) and
 * "unverified phone" (see `src/notifications/sms/`) — the row still records
 * that the attempt happened and why it never reached PlasGate.
 */
export const smsDeliveryStatusEnum = pgEnum('sms_delivery_status', [
  'queued',
  'sent',
  'failed',
  'skipped',
]);

/**
 * Audit trail for every SMS the outbox was asked to send, written by
 * `SmsOutboxHandler` (`src/notifications/sms/`). Deliberately carries NO
 * message-text column — a notification's body can hold a one-time code, and
 * this table is meant to survive long after the outbox's own payload is
 * redacted (`OutboxHandler.redact`). `maskedPhone` is the only phone-shaped
 * value here, and it is masked before it is ever written.
 */
export const smsDeliveries = pgTable(
  'sms_deliveries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // Null for OTP sends (`OtpSmsSender`): the registering phone has no user
    // row yet. Notification rows always carry one.
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'cascade',
    }),
    // Mirrors notifications.type / outbox_events.eventType's dotted
    // namespace, e.g. 'payment.succeeded'.
    notificationType: varchar('notification_type', { length: 80 }).notNull(),
    maskedPhone: varchar('masked_phone', { length: 32 }),
    status: smsDeliveryStatusEnum('status').default('queued').notNull(),
    // Why a 'skipped' row never reached PlasGate, e.g. 'not_configured' or
    // 'phone_not_verified'. Null for queued/sent/failed rows.
    skipReason: varchar('skip_reason', { length: 60 }),
    // PlasGate's raw HTTP status and response body for the last attempt —
    // never the request (which would carry the private key/secret).
    providerStatus: integer('provider_status'),
    providerReply: text('provider_reply'),
    attempts: integer('attempts').default(0).notNull(),
    // The outbox_events row this delivery is tracking. Not a DB foreign key
    // on purpose: outbox rows are purged by `OutboxRetention` once published,
    // and this audit trail must outlive that purge.
    // Null for OTP sends, which never touch the outbox (the code must not sit
    // in an outbox payload). The unique index below ignores nulls.
    outboxEventId: uuid('outbox_event_id'),
    // Set for OTP sends: 'register' | 'login' | 'password_reset'.
    purpose: varchar('purpose', { length: 30 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
  },
  (t) => [
    index('sms_deliveries_user_id_idx').on(t.userId),
    // Dedupe guard: `NotificationsService.notify()` enqueues at most one
    // outbox event per `notification.sms.requested` dedupe key, and this
    // unique index is what makes the matching delivery row insert equally
    // idempotent — `onConflictDoNothing({ target: outboxEventId })` on a
    // retried enqueue never writes a second row for the same event.
    uniqueIndex('sms_deliveries_outbox_event_id_uq').on(t.outboxEventId),
  ],
);

export type SmsDeliveryRow = typeof smsDeliveries.$inferSelect;
export type NewSmsDelivery = typeof smsDeliveries.$inferInsert;
