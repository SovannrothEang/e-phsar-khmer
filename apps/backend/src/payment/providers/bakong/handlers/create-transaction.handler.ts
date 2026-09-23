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

function toBakongCurrency(currency: string): number {
  return currency.toUpperCase() === 'USD'
    ? khqrData.currency.usd
    : khqrData.currency.khr;
}

/**
 * Bakong has no server-side "create purchase" endpoint — this handler *is*
 * that action, entirely offline via the `bakong-khqr` SDK. No error
 * channel: a rejected KHQR is a normal outcome via `CreateTransactionResult.ok`,
 * not a thrown error. The returned `md5` is Bakong's only correlation key
 * going forward — `checkBakongTransaction` polls with it, and it becomes
 * both `providerAttemptId` and `providerTransactionId` on the `ChargeResult`.
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
