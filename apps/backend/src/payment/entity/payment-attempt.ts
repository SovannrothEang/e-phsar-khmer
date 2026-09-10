import { index, numeric, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { paymentTransactions } from './payment-transaction';
import { paymentSchema } from './payment.pg-schema';

export const paymentAttemptMethodEnum = paymentSchema.enum(
  'payment_attempt_method',
  ['card', 'bank', 'wallet', 'other'],
);

export const paymentAttemptStatusEnum = paymentSchema.enum(
  'payment_attempt_status',
  ['pending', 'succeeded', 'failed'],
);

/**
 * One try against a provider for a payment_transaction. A single transaction
 * can have several — a declined card retried on a different method, a
 * timed-out attempt retried after backoff. This is where "which attempt
 * actually succeeded" lives; the transaction's own status is the aggregate.
 */
export const paymentAttempts = paymentSchema.table(
  'payment_attempts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    paymentTransactionId: uuid('payment_transaction_id')
      .notNull()
      .references(() => paymentTransactions.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    providerAttemptId: text('provider_attempt_id'),
    method: paymentAttemptMethodEnum('method').notNull(),
    status: paymentAttemptStatusEnum('status').default('pending').notNull(),
    amount: numeric('amount', { precision: 20, scale: 2 }).notNull(),
    currency: text('currency').notNull(),
    failureCode: text('failure_code'),
    failureMessage: text('failure_message'),
    attemptedAt: timestamp('attempted_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index('payment_attempts_transaction_idx').on(
      t.paymentTransactionId,
      t.attemptedAt,
    ),
    index('payment_attempts_provider_attempt_idx').on(
      t.provider,
      t.providerAttemptId,
    ),
  ],
);

export type PaymentAttemptRow = typeof paymentAttempts.$inferSelect;
export type NewPaymentAttempt = typeof paymentAttempts.$inferInsert;
