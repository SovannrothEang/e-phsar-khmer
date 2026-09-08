import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { paymentAttempts } from './payment-attempt';

export const paymentProviderEventStatusEnum = pgEnum(
  'payment_provider_event_status',
  ['received', 'processed', 'ignored', 'failed'],
);

/**
 * Inbound webhook intake — the provider's inbox, deduped on
 * (provider, providerEventId). This is the mirror image of outbox_events
 * (src/db/schema/outbox.schema.ts), which is for events *we* publish
 * outward; this table is for events a gateway pushes *in*. `paymentAttemptId`
 * is nullable and SET NULL on delete: an event can arrive before it's been
 * correlated to an attempt, and the raw payload must survive either way.
 */
export const paymentProviderEvents = pgTable(
  'payment_provider_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    paymentAttemptId: uuid('payment_attempt_id').references(
      () => paymentAttempts.id,
      { onDelete: 'set null' },
    ),
    provider: text('provider').notNull(),
    providerEventId: text('provider_event_id').notNull(),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').notNull(),
    status: paymentProviderEventStatusEnum('status')
      .default('received')
      .notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex('payment_provider_events_provider_event_uq').on(
      t.provider,
      t.providerEventId,
    ),
    index('payment_provider_events_attempt_idx').on(t.paymentAttemptId),
    index('payment_provider_events_status_idx').on(t.status, t.receivedAt),
  ],
);

export type PaymentProviderEventRow = typeof paymentProviderEvents.$inferSelect;
export type NewPaymentProviderEvent = typeof paymentProviderEvents.$inferInsert;
