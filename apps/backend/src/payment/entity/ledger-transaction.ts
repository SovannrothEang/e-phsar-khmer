import { index, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { paymentTransactions } from './payment-transaction';
import { paymentSchema } from './payment.pg-schema';

export const ledgerTransactionTypeEnum = paymentSchema.enum(
  'ledger_transaction_type',
  ['payment', 'transfer', 'adjustment'],
);

export const ledgerTransactionStatusEnum = paymentSchema.enum(
  'ledger_transaction_status',
  ['posted', 'reversed'],
);

/**
 * A posted unit of double-entry bookkeeping. Created once, when a
 * payment_transaction settles — never while it's still in flight. A mistake
 * is corrected by posting a new reversing ledger_transaction, never by
 * editing this row or its entries in place.
 */
export const ledgerTransactions = paymentSchema.table(
  'ledger_transactions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // Null for adjustments/transfers with no originating payment operation.
    paymentTransactionId: uuid('payment_transaction_id').references(
      () => paymentTransactions.id,
      { onDelete: 'set null' },
    ),
    reference: text('reference').notNull(),
    transactionType: ledgerTransactionTypeEnum('transaction_type').notNull(),
    status: ledgerTransactionStatusEnum('status').default('posted').notNull(),
    currency: text('currency').notNull(),
    description: text('description'),
    idempotencyKey: text('idempotency_key'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index('ledger_transactions_payment_transaction_idx').on(
      t.paymentTransactionId,
    ),
    // Postgres unique indexes ignore NULLs, so entries without a key never collide.
    uniqueIndex('ledger_transactions_idempotency_key_uq').on(t.idempotencyKey),
  ],
);

export type LedgerTransactionRow = typeof ledgerTransactions.$inferSelect;
export type NewLedgerTransaction = typeof ledgerTransactions.$inferInsert;
