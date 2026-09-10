import { Schema } from 'effect';

/**
 * Typed failures for the ledger use-cases (`ledgers/`). Kept separate from
 * `../payments/errors.ts` — the ledger cluster's own invariant (balanced
 * double-entry postings) has nothing to do with payment-transaction/attempt
 * lifecycle failures, even though a ledger use-case can also fail with the
 * generic `PaymentPersistenceError` from that file (imported directly where
 * needed, not re-exported here).
 */

/**
 * A ledger posting's entries don't sum to zero per currency (or fewer than
 * two entries were given). Thrown by `postLedgerTransaction` — see the
 * module README's "Balance invariant": Postgres CHECK constraints can't
 * see sibling rows, so this has to be a service-layer guard.
 */
export class LedgerImbalanceError extends Schema.TaggedError<LedgerImbalanceError>()(
  'LedgerImbalanceError',
  { idempotencyKey: Schema.String, detail: Schema.String },
) {}

export type LedgerUseCaseError = LedgerImbalanceError;
