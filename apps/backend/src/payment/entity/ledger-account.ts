import {
  boolean,
  index,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { paymentSchema } from './payment.pg-schema';

export const ledgerAccountTypeEnum = paymentSchema.enum('ledger_account_type', [
  'asset',
  'liability',
  'equity',
  'revenue',
  'expense',
]);

export const ledgerAccountOwnerTypeEnum = paymentSchema.enum(
  'ledger_account_owner_type',
  ['system', 'customer', 'merchant'],
);

/**
 * Chart of accounts: what a ledger_entry can post against. System accounts
 * (platform revenue, provider clearing, tax payable) have `ownerId` null;
 * per-customer/merchant accounts (e.g. a wallet balance) set it. No FK to
 * `users` here on purpose — an owner account can outlive the concept it was
 * opened for, and the ledger must never cascade-delete on a user change.
 */
export const ledgerAccounts = paymentSchema.table(
  'ledger_accounts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: varchar('code', { length: 60 }).notNull(),
    name: varchar('name', { length: 150 }).notNull(),
    accountType: ledgerAccountTypeEnum('account_type').notNull(),
    ownerType: ledgerAccountOwnerTypeEnum('owner_type')
      .default('system')
      .notNull(),
    ownerId: uuid('owner_id'),
    currency: varchar('currency', { length: 3 }).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex('ledger_accounts_code_uq').on(t.code),
    index('ledger_accounts_owner_idx').on(t.ownerType, t.ownerId),
  ],
);

export type LedgerAccountRow = typeof ledgerAccounts.$inferSelect;
export type NewLedgerAccount = typeof ledgerAccounts.$inferInsert;
