# ABA PayWay provider

PayWay's implementation of the `PaymentGatewayProvider` seam (see
[`../payment-gateway.interface.ts`](../payment-gateway.interface.ts) and the
[payment module README](../../README.md) for the general contract). This is
the only place in the codebase that knows PayWay's wire format: its request
signing, its callback signature scheme, its status codes, and which response
fields become the checkout artifact handed back to the client.

## Architecture

### One file per concern

| File                       | Purpose                                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `aba-payway.provider.ts`   | Implements `PaymentGatewayProvider` — `charge()`, `reconcile()`, `verifyWebhookSignature()`, `parseWebhookEvent()`, `redact()`. |
| `aba-payway.controller.ts` | `AbaPaywayController` — ABA's dedicated webhook route (see [Webhook intake](#webhook-intake) below).                            |
| `aba-payway.signing.ts`    | The two outbound/inbound HMAC-SHA512 signing algorithms (see [Two signing algorithms](#two-signing-algorithms-not-one)).        |
| `aba-payway.encoding.ts`   | `base64EncodeAbaPaywayUrl` — the base64 encoding ABA's docs require on URL fields.                                              |
| `aba-payway.status.ts`     | `toPaymentAttemptOutcome` — maps ABA's status codes/text onto `payment_attempts.status`.                                        |
| `aba-payway.types.ts`      | Wire-format interfaces, field names taken verbatim from `spec.md`.                                                              |
| `spec.md`                  | The documented REST endpoints (purchase, check-transaction, transaction-detail, close-transaction, transaction-list).           |
| `*.spec.ts`                | Unit tests for the pure functions (signing, encoding, status mapping).                                                          |

Only two of `spec.md`'s five documented endpoints are actually wired up:
`purchase` (via `charge()`) and `check-transaction-2` (via `reconcile()`).
`transaction-detail`, `close-transaction`, and `transaction-list` are
documented but unused — nothing in this module currently needs them.

### `charge()` and `reconcile()`

`charge()` calls ABA's `purchase` endpoint. A `"00"` `status.code` means a
checkout session was created, not that money has moved — the attempt stays
`pending`, and `checkout_qr_url` comes back as `ChargeResult.redirectUrl` for
the client to display. `reconcile()` calls `check-transaction-2` and maps
the response through `toPaymentAttemptOutcome`; a non-`"00"` status here
means ABA has no record of the `tran_id` yet, which is treated as
inconclusive (`pending`), not a rejection.

`tran_id` sent to ABA is always the `payment_transactions.id` UUID
(`ChargeRequest.transactionId`), never the free-text `reference` — `id` is
the column with a uniqueness constraint, and ABA echoes `tran_id` back
verbatim on every subsequent call (check-transaction, the callback body),
which is what lets a webhook or a reconcile lookup correlate back to the
right attempt without a second, ABA-specific reference column.

### `return_url` vs `continue_success_url` — do not conflate these

Despite the name, ABA's `return_url` is a **server-to-server** field: the
URL ABA POSTs the payment result to once the payer completes or abandons
checkout — functionally a per-request webhook target, not a browser
redirect. It is always `webhookUrl()` (fixed server config,
`ABA_PAYWAY_WEBHOOK_URL`, pointed at `AbaPaywayController`'s own route) and
is never sourced from caller input — a client controlling where ABA's
payment-result notification goes would be a real vulnerability.
`continue_success_url` is the actual browser redirect, and that one is
legitimately caller-supplied via `ChargeRequest.returnUrl`. Both are
base64-encoded before being sent (`aba-payway.encoding.ts`) — confirmed
against ABA's own documented field description for `return_url` only (see
[Open items](#open-items)).

### Two signing algorithms, not one

ABA documents outbound requests and inbound callbacks as two separate
schemes — don't assume they're interchangeable:

- **Outbound** (`signAbaPayway`, used by `charge()`/`reconcile()`):
  HMAC-SHA512 over the plain concatenation of the request's required
  values, in the API's documented positional order (5 fields for purchase —
  `req_time, merchant_id, tran_id, amount, currency`; 3 for
  check-transaction), keyed by the merchant API key, base64-encoded.
  `null`/`undefined` values are skipped rather than stringified, so a sparse
  request signs the same way ABA computes it on its side. Ported from the
  verified `payway-gateway` reference implementation.
- **Inbound / callback** (`signAbaPaywayCallback` +
  `verifyAbaPaywayCallbackSignature`): sort the payload's top-level keys
  ascending, concatenate the values in that key order (JSON-encoding any
  non-string value), HMAC-SHA512 over that string keyed by the merchant API
  key, base64-encoded, then compared **in constant time**
  (`timingSafeEqual`, length-checked first since it throws rather than
  returning `false` on a mismatched length) against the
  `X-PayWay-Hmac-Sha512` request header. Confirmed against ABA's own
  "Verify Callback Signature" documentation.

### Status mapping

`toPaymentAttemptOutcome` (`aba-payway.status.ts`) is the single place that
turns ABA's status vocabulary into `payment_attempts.status`:
`payment_status_code === 0` (or `payment_status` text
APPROVED/SUCCESS/COMPLETED) → `succeeded`; PENDING/PRE-AUTH/PREAUTH/PROCESSING
→ `pending`; any other numeric code → `failed`. Anything unrecognized stays
`pending` — an attempt is only ever marked `failed` on an explicit
rejection, never on an ambiguous response. `ABA_PAYWAY_API_OK` (`"00"`) is
the separate transport-level code checked before this mapping even applies
(it means the API call itself succeeded, not that the payment did).

## Webhook intake

ABA's async payment notification ("Pushback Data", POSTed to `return_url`)
doesn't match the generic `PaymentsController.webhook()` envelope
(`{provider, providerEventId, eventType, payload}`), so it gets its own
route rather than requiring ABA to be taught a shape it doesn't send:

```
POST /payments/aba-payway/webhook   (@Public())
```

1. `verifyWebhookSignature()` checks the `X-PayWay-Hmac-Sha512` header
   before anything else — a mismatch returns 401 and nothing is written to
   the database.
2. `parseWebhookEvent()` normalizes the body into a `ParsedProviderEvent`.
   `providerEventId` is `${tran_id}:${status}` (see
   [Open items](#open-items) for the dedup implication).
3. The controller looks up the correlated `payment_attempts` row by
   `(provider, providerAttemptId)` outside any transaction (no isolation
   needed for a read), then writes the `payment_provider_events` row and its
   outbox row together via `PaymentEffectRunner.runDurably` — same
   commit-then-enqueue pattern the rest of the module uses.
4. The response body is `{ code: 0, message: 'Received' }` — ABA retries on
   a non-zero `code` in the JSON body, not just on HTTP status, so this
   exact shape is what stops it resending.

The processor's `reconcile()` call is a second line of defense on top of
signature verification: even a signature-valid callback is corroborated
against `check-transaction-2` before its reported status is trusted.

## Configuration

| Var                      | Required for                                                         |
| ------------------------ | -------------------------------------------------------------------- |
| `ABA_PAYWAY_API_KEY`     | Signing every outbound request and verifying every inbound callback. |
| `ABA_PAYWAY_MERCHANT_ID` | Every outbound request.                                              |
| `ABA_PAYWAY_BASE_URL`    | Defaults to `https://checkout-sandbox.abapayway.com`.                |
| `ABA_PAYWAY_WEBHOOK_URL` | `return_url` on `charge()` — see below.                              |

All four are optional at the `ConfigModule` level (empty-string defaults) so
the app can boot without ABA credentials, but `charge()` throws immediately
if `ABA_PAYWAY_WEBHOOK_URL` is unset, and `post()` throws immediately if
either `ABA_PAYWAY_API_KEY` or `ABA_PAYWAY_MERCHANT_ID` is unset — fail
fast with a clear message rather than sending ABA a malformed, unsigned, or
unroutable request.

## Current state

| Piece                             | Status                                                                                                                                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `charge()` (purchase)             | Done, against the sandbox base URL.                                                                                                                                                              |
| `reconcile()` (check-transaction) | Done.                                                                                                                                                                                            |
| `verifyWebhookSignature()`        | Done — real HMAC check, not a stub.                                                                                                                                                              |
| `parseWebhookEvent()`             | Done.                                                                                                                                                                                            |
| `redact()`                        | Identity function — correct, not unimplemented (see the doc comment on `AbaPaywayProvider.redact`; no PAN/account/token field appears anywhere in `spec.md`'s documented shapes).                |
| Unit tests                        | Signing (both algorithms), encoding, and status-mapping pure functions are covered (`*.spec.ts`). No test exercises `charge()`/`reconcile()`/the controller against a live or mocked HTTP layer. |
| Live verification                 | None — no sandbox credentials or public callback endpoint have been available in this environment. Everything below is doc-derived, not observed.                                                |

## Open items

- **`ABA_PAYWAY_WEBHOOK_URL` must be set, and publicly reachable, before any
  purchase can be charged.** `return_url` is the server-to-server field ABA
  posts the payment result to; `charge()` refuses to call ABA at all if it's
  unset. In local dev without a public tunnel (ngrok/cloudflared), ABA has
  nowhere to deliver a real notification — `reconcile()` is the fallback
  poll path for that case, not a substitute for having the webhook reachable
  in any real deployment.
- **`return_url`/`continue_success_url` base64 encoding is only half
  doc-confirmed.** ABA's purchase-endpoint docs state `return_url` must be
  base64-encoded ("encrypted with Base64") — confirmed. `encoding.ts`
  applies the same encoding to `continue_success_url` on the assumption
  that it follows the same "URL field" convention, but that specific field
  isn't independently confirmed against ABA's docs. The `payway-gateway`
  reference implementation has a matching `EncodeBase64Builder` utility but
  never actually calls it on `return_url` — this exact step was apparently
  left unfinished there too. `cancel_url` isn't wired at all yet (no
  `ChargeRequest` field carries a distinct cancel destination).
- **The outbound hash field order isn't independently verified against
  ABA's own merchant docs.** The signing in `aba-payway.signing.ts` (5
  fields for purchase, 3 for check-transaction, that specific order) is
  ported from the working `payway-gateway` reference implementation, not
  derived from `spec.md` — whose only note on the topic is "typically a
  SHA256 hash of the concatenated string of required parameters," which
  doesn't even match the HMAC-SHA512 algorithm actually used here or by the
  reference. If a live sandbox call is rejected with a signature error,
  this field order/algorithm is the first thing to cross-check against
  ABA's current merchant integration guide. Same caveat for `req_time`'s
  wire format: sent as `String(Date.now())` (epoch ms as a string, matching
  `spec.md`'s declared `string` type) rather than a `YYYYMMDDHHmmss`-style
  timestamp — neither `spec.md` nor the reference implementation states
  which ABA actually expects.
- **The callback signature scheme is implemented from ABA's own docs, not
  independently tested against a live callback.** `verifyWebhookSignature()`
  - `signAbaPaywayCallback`/`verifyAbaPaywayCallbackSignature` are
    unit-tested against ABA's own documented sample payload, but what isn't
    verified is whether that sample's key/value shape is exactly what a real
    callback delivers — undocumented fields or different key casing would
    silently change the signed string. This provider has no `reconcile()`
    fallback for a signature check that's wrong in production —
    `processProviderEvent` trusts the payload once it clears
    `verifyWebhookSignature()`, full stop (the `reconcile()` corroboration
    described under [Webhook intake](#webhook-intake) only runs after
    signature verification already passed).
- **`ParsedProviderEvent.providerEventId` is `${tran_id}:${status}`.** This
  dedupes a true retry (same outcome resent) but treats a later, genuinely
  different status for the same transaction as a new event — reasonable for
  a single-shot KHQR purchase-then-pay flow, untested against a
  refund/chargeback notification, which this provider doesn't model yet.
- **Callback `status` values beyond `"0"` (approved) aren't documented.**
  `parseWebhookEvent` maps any other numeric value to `failed` via
  `toPaymentAttemptOutcome`'s existing "non-zero code = rejection" rule
  (same convention as check-transaction's `payment_status_code`) —
  reasonable, but not confirmed against an enumerated list of ABA's actual
  callback status codes.
