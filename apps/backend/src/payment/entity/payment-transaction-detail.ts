import {
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { paymentTransactions } from './payment-transaction';

/**
 * 1:1 satellite for bulky/sensitive provider payload — masked account,
 * redirect URLs, raw response JSON. Kept off payment_transactions so the hot
 * table (queried on every status check) stays lean; same pattern as
 * user_phones sitting off users. `providerTransactionId` is not enforced
 * unique here because a provider may not distinguish a capture/refund
 * response's own id from the parent transaction's.
 */
export const paymentTransactionDetails = pgTable(
  'payment_transaction_details',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    paymentTransactionId: uuid('payment_transaction_id')
      .notNull()
      .references(() => paymentTransactions.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    providerTransactionId: text('provider_transaction_id'),
    paymentMethodType: text('payment_method_type'),
    maskedAccount: text('masked_account'),
    redirectUrl: text('redirect_url'),
    rawResponse: jsonb('raw_response'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex('payment_transaction_details_transaction_uq').on(
      t.paymentTransactionId,
    ),
  ],
);

export type PaymentTransactionDetailRow =
  typeof paymentTransactionDetails.$inferSelect;
export type NewPaymentTransactionDetail =
  typeof paymentTransactionDetails.$inferInsert;
