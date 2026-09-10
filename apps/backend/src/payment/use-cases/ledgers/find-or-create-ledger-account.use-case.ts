import { Effect } from 'effect';
import { eq } from 'drizzle-orm';
import { DbClientTag } from '../../../db/db.provider';
import {
  ledgerAccounts,
  ledgerAccountTypeEnum,
  type LedgerAccountRow,
} from '../../entity';
import { PaymentPersistenceError } from '../payments';

export interface FindOrCreateSystemLedgerAccountInput {
  code: string;
  name: string;
  accountType: (typeof ledgerAccountTypeEnum.enumValues)[number];
  currency: string;
}

type FindOrCreateSystemLedgerAccountError = PaymentPersistenceError;

/**
 * Resolves a system ledger_account by its unique `code`, creating it on
 * first use. System accounts (provider clearing, platform revenue, ...)
 * are self-provisioning per currency rather than pre-seeded — the set of
 * currencies actually settled is a runtime fact (whatever a registered
 * gateway charges in), not something to hardcode in a seed file. Same
 * race-safe insert-then-select shape as createPaymentProviderEvent: a
 * concurrent first-use of the same code is a safe no-op, not a 23505.
 */
export const findOrCreateSystemLedgerAccount = Effect.fn(
  'findOrCreateSystemLedgerAccount',
)(function* (
  input: FindOrCreateSystemLedgerAccountInput,
): Effect.fn.Return<
  LedgerAccountRow,
  FindOrCreateSystemLedgerAccountError,
  DbClientTag
> {
  const db = yield* DbClientTag;
  const insertedRows = yield* Effect.tryPromise({
    try: () =>
      db
        .insert(ledgerAccounts)
        .values({
          code: input.code,
          name: input.name,
          accountType: input.accountType,
          ownerType: 'system',
          currency: input.currency,
        })
        .onConflictDoNothing({ target: ledgerAccounts.code })
        .returning(),
    catch: (cause) => new PaymentPersistenceError({ cause }),
  });

  const [insertedRow] = insertedRows;
  if (insertedRow) {
    return insertedRow;
  }

  const existingRows = yield* Effect.tryPromise({
    try: () =>
      db
        .select()
        .from(ledgerAccounts)
        .where(eq(ledgerAccounts.code, input.code)),
    catch: (cause) => new PaymentPersistenceError({ cause }),
  });
  const [existingRow] = existingRows;
  return existingRow;
});
