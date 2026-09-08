import { sql } from 'drizzle-orm';
import {
  check,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { paymentTransactions } from './payment-transaction';
import { paymentAttempts } from './payment-attempt';

export const paymentLogLevelEnum = pgEnum('payment_log_level', [
  'debug',
  'info',
  'warn',
  'error',
]);

/**
 * Free-form operational/debug trail (a retried step, a provider timeout, an
 * internal error) — distinct from payment_status_history, which only ever
 * records a business-state transition. Scoped to a transaction and/or a
 * specific attempt; at least one must be set.
 */
export const paymentLogs = pgTable(
  'payment_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    paymentTransactionId: uuid('payment_transaction_id').references(
      () => paymentTransactions.id,
      { onDelete: 'cascade' },
    ),
    paymentAttemptId: uuid('payment_attempt_id').references(
      () => paymentAttempts.id,
      { onDelete: 'cascade' },
    ),
    level: paymentLogLevelEnum('level').default('info').notNull(),
    message: text('message').notNull(),
    context: jsonb('context'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index('payment_logs_transaction_idx').on(
      t.paymentTransactionId,
      t.createdAt,
    ),
    index('payment_logs_attempt_idx').on(t.paymentAttemptId, t.createdAt),
    check(
      'payment_logs_target_present',
      sql`payment_transaction_id is not null or payment_attempt_id is not null`,
    ),
  ],
);

export type PaymentLogRow = typeof paymentLogs.$inferSelect;
export type NewPaymentLog = typeof paymentLogs.$inferInsert;
