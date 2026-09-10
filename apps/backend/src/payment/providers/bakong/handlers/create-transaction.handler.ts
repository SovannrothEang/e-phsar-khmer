import { Effect } from 'effect';
import {
  BakongKHQR,
  IndividualInfo,
  khqrData,
  MerchantInfo,
} from 'bakong-khqr';
import type { ChargeRequest } from '../../payment-gateway.types';
import type {
  BakongAccountConfig,
  BakongKhqrGenerateResult,
} from '../bakong.types';

export type CreateTransactionResult =
  | {
      ok: true;
      qr: string;
      md5: string;
      expiresAt: number;
      raw: BakongKhqrGenerateResult;
    }
  | {
      ok: false;
      errorCode?: number;
      errorMessage?: string;
      raw: BakongKhqrGenerateResult;
    };

const khqr = new BakongKHQR();

/**
 * The KHQR spec's hard cap on the `billNumber` additional-data field
 * (`emv.INVALID_LENGTH.BILL_NUMBER` in `bakong-khqr`, not exported so
 * duplicated here) — `payment_transactions.id` is a 36-character UUID,
 * which always exceeded it before this was added, failing every Bakong
 * charge with "Bill Name Length is invalid" regardless of merchant config.
 */
const BILL_NUMBER_MAX_LENGTH = 25;

function toBakongCurrency(currency: string): number {
  return currency.toUpperCase() === 'USD'
    ? khqrData.currency.usd
    : khqrData.currency.khr;
}

/**
 * The create-transaction action for Bakong. Bakong has no server-side
 * "create purchase" endpoint (see `../../README.md`'s Bakong section) —
 * this handler *is* that action, and it never touches the network: it
 * builds a KHQR string + its MD5 entirely offline via the `bakong-khqr`
 * SDK. No error channel — a rejected KHQR (e.g. an amount the SDK won't
 * accept) is a normal, modeled outcome via `CreateTransactionResult.ok`,
 * the same way ABA's non-"00" purchase status becomes a `failed`
 * `ChargeResult` rather than a thrown error (see `PaymentGatewayCallError`'s
 * doc comment in `../../../use-cases/errors.ts`).
 *
 * Branches on `account.type` — `generateMerchant`/`generateIndividual` are
 * two different SDK entry points, not one function with an optional field
 * (see `BakongAccountConfig`'s doc comment for why `individual` exists at
 * all: it needs no registered merchant account, just a personal Bakong
 * alias).
 *
 * The returned `md5` is the only correlation key Bakong understands going
 * forward — it's what `checkBakongTransaction` polls with, so it becomes
 * both `providerAttemptId` and `providerTransactionId` on the `ChargeResult`
 * `BakongProvider` builds from this.
 */
export const createBakongTransaction = Effect.fn('createBakongTransaction')(
  // A plain function returning an Effect, not a generator — there's nothing
  // to `yield*` (no network, no other Effect dependency), and a
  // zero-yield generator is exactly what the `require-yield` lint rule
  // (rightly) flags. `Effect.fn` accepts either shape; this still gets the
  // named tracing span the generator form would have.
  (
    request: ChargeRequest,
    account: BakongAccountConfig,
    qrExpirySeconds: number,
  ): Effect.Effect<CreateTransactionResult> => {
    // Any amount > 0 makes this a "dynamic" KHQR, which the SDK requires an
    // expirationTimestamp for (see bakong-khqr.d.ts) — every ChargeRequest
    // carries an amount, so this always applies.
    const expiresAt = Date.now() + qrExpirySeconds * 1000;

    const optional = {
      currency: toBakongCurrency(request.currency),
      amount: Number(request.amount),
      // Bakong's own reference for this QR — round-trips nowhere on our
      // side (reconcile correlates on `md5`, not this), but gives the
      // payer's banking app a human-readable bill reference. Truncated:
      // the full UUID (36 chars) always exceeds BILL_NUMBER_MAX_LENGTH.
      // billNumber: request.transactionId.slice(0, BILL_NUMBER_MAX_LENGTH),
      expirationTimestamp: expiresAt,
    };

    const result =
      account.type === 'merchant'
        ? khqr.generateMerchant(
            new MerchantInfo(
              account.accountId,
              account.displayName,
              account.city,
              account.merchantId,
              account.acquiringBank,
              optional,
            ),
          )
        : khqr.generateIndividual(
            new IndividualInfo(
              account.accountId,
              account.displayName,
              account.city,
              optional,
            ),
          );

    if (result.status.code !== 0 || !result.data) {
      return Effect.succeed({
        ok: false,
        errorCode: result.status.errorCode ?? undefined,
        errorMessage: result.status.message ?? 'Bakong KHQR generation failed',
        raw: result,
      });
    }

    return Effect.succeed({
      ok: true,
      qr: result.data.qr,
      md5: result.data.md5,
      expiresAt,
      raw: result,
    });
  },
);
