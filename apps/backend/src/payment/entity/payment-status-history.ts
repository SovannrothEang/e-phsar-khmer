import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  paymentTransactions,
  paymentTransactionStatusEnum,
} from './payment-transaction';
import { users } from '../../db/schema/users.schema';

export const paymentStatusActorTypeEnum = pgEnum('payment_status_actor_type', [
  'system',
  'webhook',
  'admin',
]);

/**
 * Business-state audit trail: every status transition on a payment_transaction,
 * and who/what caused it. Distinct from payment_log (free-form operational
 * noise) — this only ever records a status change, so "why is this
 * REFUND_PENDING" is answerable months later without grepping logs.
 */
export const paymentStatusHistory = pgTable(
  'payment_status_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    paymentTransactionId: uuid('payment_transaction_id')
      .notNull()
      .references(() => paymentTransactions.id, { onDelete: 'cascade' }),
    fromStatus: paymentTransactionStatusEnum('from_status'),
    toStatus: paymentTransactionStatusEnum('to_status').notNull(),
    actorType: paymentStatusActorTypeEnum('actor_type')
      .default('system')
      .notNull(),
    // Set only when actorType = 'admin'; who made the manual override.
    actorId: uuid('actor_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index('payment_status_history_transaction_idx').on(
      t.paymentTransactionId,
      t.createdAt,
    ),
  ],
);

export type PaymentStatusHistoryRow = typeof paymentStatusHistory.$inferSelect;
export type NewPaymentStatusHistory = typeof paymentStatusHistory.$inferInsert;
