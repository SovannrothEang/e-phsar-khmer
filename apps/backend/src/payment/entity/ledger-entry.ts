import {
  index,
  integer,
  numeric,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { ledgerTransactions } from './ledger-transaction';
import { ledgerAccounts } from './ledger-account';
import { paymentSchema } from './payment.pg-schema';

export const ledgerEntryTypeEnum = paymentSchema.enum('ledger_entry_type', [
  'debit',
  'credit',
]);

/**
 * One debit or credit line under a ledger_transaction. Balance (debits sum to
 * credits per currency, per transaction) is a service-layer invariant, not a
 * DB constraint — Postgres CHECK constraints can't see sibling rows.
 * `sequence` fixes line order for display/replay without relying on
 * insertion order.
 */
export const ledgerEntries = paymentSchema.table(
  'ledger_entries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ledgerTransactionId: uuid('ledger_transaction_id')
      .notNull()
      .references(() => ledgerTransactions.id, { onDelete: 'cascade' }),
    accountId: uuid('account_id')
      .notNull()
      .references(() => ledgerAccounts.id),
    entryType: ledgerEntryTypeEnum('entry_type').notNull(),
    amount: numeric('amount', { precision: 20, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    sequence: integer('sequence').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index('ledger_entries_transaction_idx').on(t.ledgerTransactionId),
    index('ledger_entries_account_idx').on(t.accountId, t.createdAt),
  ],
);

export type LedgerEntryRow = typeof ledgerEntries.$inferSelect;
export type NewLedgerEntry = typeof ledgerEntries.$inferInsert;
