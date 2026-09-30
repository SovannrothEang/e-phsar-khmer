import { Effect } from 'effect';
import { eq } from 'drizzle-orm';
import { DbClientTag } from '../../../db/db.provider';
import {
  ledgerTransactions,
  ledgerTransactionTypeEnum,
  ledgerEntries,
  ledgerEntryTypeEnum,
  type LedgerTransactionRow,
} from '../../entity';
import { PaymentPersistenceError } from '../payments';
import { LedgerImbalanceError } from './errors';
import { checkEntriesBalance } from './ledger-balance';

export interface PostLedgerTransactionEntryInput {
  accountId: string;
  entryType: (typeof ledgerEntryTypeEnum.enumValues)[number];
  amount: string;
}

export interface PostLedgerTransactionInput {
  paymentTransactionId: string;
  reference: string;
  transactionType: (typeof ledgerTransactionTypeEnum.enumValues)[number];
  currency: string;
  description?: string;
  idempotencyKey: string;
  occurredAt: Date;
  entries: PostLedgerTransactionEntryInput[];
}

export interface PostLedgerTransactionResult {
  ledgerTransaction: LedgerTransactionRow;
  /** false when a ledger_transaction for this idempotencyKey already existed — entries were not re-inserted. */
  isNew: boolean;
}

type PostLedgerTransactionError =
  | LedgerImbalanceError
  | PaymentPersistenceError;

/**
 * Posts one balanced double-entry ledger_transaction + its ledger_entries.
 * Balance (debits sum to credits, per currency) is checked here rather than
 * left to Postgres — a CHECK constraint can't see sibling rows (see the
 * module README's "Balance invariant"); the exactness rules behind that
 * check live in `ledger-balance.ts` so they can be unit-tested without
 * Effect. Dedupes on `idempotencyKey` exactly
 * like createPaymentProviderEvent: a caller retrying the same settlement
 * (e.g. a redelivered BullMQ job that got this far before a prior crash)
 * gets the existing row back with `isNew: false` instead of a duplicate
 * posting. Callers are expected to already be inside a runInTransaction
 * block, same as every other multi-row write in this module.
 */
export const postLedgerTransaction = Effect.fn('postLedgerTransaction')(
  function* (
    input: PostLedgerTransactionInput,
  ): Effect.fn.Return<
    PostLedgerTransactionResult,
    PostLedgerTransactionError,
    DbClientTag
  > {
    const balance = checkEntriesBalance(input.entries, input.currency);
    if (!balance.ok) {
      return yield* new LedgerImbalanceError({
        idempotencyKey: input.idempotencyKey,
        detail: balance.detail,
      });
    }

    const db = yield* DbClientTag;
    const insertedRows = yield* Effect.tryPromise({
      try: () =>
        db
          .insert(ledgerTransactions)
          .values({
            paymentTransactionId: input.paymentTransactionId,
            reference: input.reference,
            transactionType: input.transactionType,
            currency: input.currency,
            description: input.description ?? null,
            idempotencyKey: input.idempotencyKey,
            occurredAt: input.occurredAt,
          })
          .onConflictDoNothing({ target: ledgerTransactions.idempotencyKey })
          .returning(),
      catch: (cause) => new PaymentPersistenceError({ cause }),
    });

    const [insertedRow] = insertedRows;
    if (insertedRow) {
      yield* Effect.tryPromise({
        try: () =>
          db.insert(ledgerEntries).values(
            input.entries.map((entry, index) => ({
              ledgerTransactionId: insertedRow.id,
              accountId: entry.accountId,
              entryType: entry.entryType,
              amount: entry.amount,
              currency: input.currency,
              sequence: index + 1,
            })),
          ),
        catch: (cause) => new PaymentPersistenceError({ cause }),
      });
      return { ledgerTransaction: insertedRow, isNew: true };
    }

    const existingRows = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(ledgerTransactions)
          .where(eq(ledgerTransactions.idempotencyKey, input.idempotencyKey)),
      catch: (cause) => new PaymentPersistenceError({ cause }),
    });
    const [existingRow] = existingRows;
    return { ledgerTransaction: existingRow, isNew: false };
  },
);
