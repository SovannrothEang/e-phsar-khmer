# ABA PayWay provider

PayWay's implementation of the `PaymentGatewayProvider` seam (see
[`../payment-gateway.interface.ts`](../payment-gateway.interface.ts) and the
[payment module README](../../README.md) for the general contract). This is
the only place in the codebase that knows PayWay's wire format: its request
signing, its callback signature scheme, its status codes, and which response
fields become the checkout artifact handed back to the client.

## Architecture

### One file per concern

| File                                     | Purpose                                                                                                                                                                                  |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aba-payway.provider.ts`                 | Implements `PaymentGatewayProvider` — `charge()`, `reconcile()`, `verifyWebhookSignature()`, `parseWebhookEvent()`, `redact()`. |
| `aba-payway.controller.ts`               | `AbaPaywayController` — ABA's dedicated webhook route (see [Webhook intake](#webhook-intake) below).                                                                                     |
| `handlers/create-transaction.handler.ts` | `createAbaPaywayTransaction` — the `purchase` network call behind `charge()`.                                                                                                            |
| `handlers/check-transaction.handler.ts`  | `checkAbaPaywayTransaction` — the `check-transaction-2` network call behind `reconcile()`.                                                                                               |
| `aba-payway.signing.ts`                  | The three outbound/inbound HMAC-SHA512 signing algorithms (see [Three signing algorithms](#three-signing-algorithms-not-one)).                                                           |
| `aba-payway.encoding.ts`                 | `base64EncodeAbaPaywayUrl` (the base64 encoding `return_url` needs) and `formatAbaPaywayReqTime` (the `YYYYMMDDHHmmss` UTC timestamp every outbound call needs).                         |
| `aba-payway.status.ts`                   | `toPaymentAttemptOutcome` — maps ABA's status codes/text onto `payment_attempts.status`.                                                                                                 |
| `aba-payway.types.ts`                    | Wire-format interfaces, field names taken verbatim from `spec.md`.                                                                                                                       |
| `spec.md`                                | The documented REST endpoints (purchase, check-transaction, transaction-detail, close-transaction, transaction-list).                                                                    |
| `*.spec.ts`                              | Unit tests for the pure functions (signing, encoding, status mapping).                                                                                                                   |

Each network call is a thin `Effect.fn` handler under `handlers/` — the same
split Bakong's provider uses (see `../bakong/handlers/`) — that POSTs via the
shared `ApiClient` (`../../../utils/api-client.ts`) and hands the raw typed
response back; interpreting `status.code` into a `ChargeResult` stays the
provider's job, not the handler's.

Two of `spec.md`'s five documented endpoints are wired up: `purchase` (via
`charge()`) and `check-transaction-2` (via `reconcile()`).
`transaction-detail`, `close-transaction`, and `transaction-list` are
documented but unused — nothing in this module currently needs them.

### `charge()` and `reconcile()`

`charge()` calls ABA's `purchase` endpoint. A `"00"` `status.code` means a
checkout session was created, not that money has moved — the attempt stays
`pending`. `abapay_deeplink` comes back as `ChargeResult.redirectUrl` for
the client to display; the KHQR itself (`qrString`/`qrImage`) travels
through `ChargeResult.rawResponse` (see [Three signing
algorithms](#three-signing-algorithms-not-one) below for why — there's no
`checkout_qr_url` field in ABA's real response, despite what `spec.md`
documents). `reconcile()` calls `check-transaction-2` and maps the
response through `toPaymentAttemptOutcome`; a non-`"00"` status here means
ABA has no record of the `tran_id` yet, which is treated as inconclusive
(`pending`), not a rejection.

`tran_id` sent to ABA is a short opaque id `AbaPaywayProvider.charge()`
generates per attempt (`generateTranId()`) — **not**
`payment_transactions.id`/`payment_attempts.id` (both 36-character UUIDs;
ABA's live validation rejects `tran_id` past ~20-25 characters, confirmed
2026-09-16). ABA echoes `tran_id` back verbatim on every subsequent call
(check-transaction, the callback body), and that echoed value is what
`payment_attempts.provider_attempt_id` stores — which is what lets a
webhook or a reconcile lookup correlate back to the right attempt, without
needing our own UUID to fit in ABA's field. See
`CreatePurchaseRequest.tran_id`'s own doc comment in `aba-payway.types.ts`.

### `return_url` vs `continue_success_url`/`cancel_url` — do not conflate these

Despite the name, ABA's `return_url` is a **server-to-server** field: the
URL ABA POSTs the payment result to once the payer completes or abandons
checkout — functionally a per-request webhook target, not a browser
redirect. It is always `webhookUrl()` (fixed server config,
`ABA_PAYWAY_WEBHOOK_URL`, pointed at `AbaPaywayController`'s own route) and
is never sourced from caller input — a client controlling where ABA's
payment-result notification goes would be a real vulnerability.
`continue_success_url`/`cancel_url` are the actual browser redirects, and
those are legitimately caller-supplied, via `ChargeRequest.returnUrl`/
`.cancelUrl` → `CreatePaymentDto.browserReturnUrl`/`.browserCancelUrl`.
**Only `return_url` is base64-encoded** (`aba-payway.encoding.ts`) —
confirmed against both ABA's own documented field description for
`return_url` ("encrypted with Base64") and its developer docs
([developer.payway.com.kh/purchase-14530820e0](https://developer.payway.com.kh/purchase-14530820e0)),
which call out base64 for `return_url` specifically and say nothing of the
sort for the other two — `continue_success_url`/`cancel_url` are sent as
plain URLs. (An earlier version of this provider applied the same encoding
to all three on an unconfirmed "same URL-field convention" assumption —
see git history — before the developer docs settled it.)

### Three signing algorithms, not one

ABA documents `purchase`, `check-transaction-2`/`transaction-detail`, and
inbound callbacks as three separate schemes — don't assume any two are
interchangeable:

- **`purchase`** (`signAbaPaywayPurchase`, used only by `charge()`):
  HMAC-SHA512 over the plain concatenation of exactly 23 fields, in this
  fixed order — `req_time, merchant_id, tran_id, amount, items, shipping,
firstname, lastname, email, phone, type, payment_option, return_url,
cancel_url, continue_success_url, return_deeplink, currency,
custom_fields, return_params, payout, lifetime, additional_params,
google_pay_token, skip_success_page` — keyed by the merchant API key,
  base64-encoded. A field this codebase never populates (items, shipping,
  firstname, email, ...) still occupies its position as an **empty
  string**, never a skip — this is positional concatenation, so dropping a
  gap would desync every field after it. Confirmed against ABA's own
  developer docs
  ([developer.payway.com.kh/purchase-14530820e0](https://developer.payway.com.kh/purchase-14530820e0)).
  This superseded an earlier 5-field implementation (`req_time,
merchant_id, tran_id, amount, currency`, that order) that was wrong on
  both field count and order — see [Open items](#open-items) for how that
  was found.
- **`check-transaction-2`** (`signAbaPayway`, used by
  `reconcile()`): HMAC-SHA512 over the plain
  concatenation of the only 3 fields either endpoint takes —
  `req_time + merchant_id + tran_id` — base64-encoded. `null`/`undefined`
  values are skipped rather than stringified, harmless here since these
  two endpoints have no optional fields to leave gaps. Confirmed against
  ABA's own developer docs
  ([developer.payway.com.kh/check-transaction-14530826e0](https://developer.payway.com.kh/check-transaction-14530826e0)),
  including its PHP sample (`$req_time . $merchant_id . $tran_id`) — this
  one was already correct.
- **Inbound / callback** (`signAbaPaywayCallback` +
  `verifyAbaPaywayCallbackSignature`): sort the payload's top-level keys
  ascending, concatenate the values in that key order (JSON-encoding any
  non-string value), HMAC-SHA512 over that string keyed by the merchant API
  key, base64-encoded, then compared **in constant time**
  (`timingSafeEqual`, length-checked first since it throws rather than
  returning `false` on a mismatched length) against the
  `X-PayWay-Hmac-Sha512` request header. Confirmed against both ABA's own
  "Verify Callback Signature" documentation and its developer docs
  ([developer.payway.com.kh/ecommerce-checkout-3158159f0](https://developer.payway.com.kh/ecommerce-checkout-3158159f0)).

`req_time` itself is a 14-digit UTC timestamp (`YYYYMMDDHHmmss`,
`formatAbaPaywayReqTime` in `aba-payway.encoding.ts`), used identically by
all three outbound calls — confirmed against ABA's developer docs for both
`purchase` and `check-transaction-2`. This superseded an earlier
`String(Date.now())` (epoch milliseconds) implementation that would never
have matched what ABA expects — see [Open items](#open-items).

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

| Var                      | Required for                                                                                                                                                                                                                                       |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ABA_PAYWAY_API_KEY`     | Signing every outbound request and verifying every inbound callback.                                                                                                                                                                               |
| `ABA_PAYWAY_MERCHANT_ID` | Every outbound request.                                                                                                                                                                                                                            |
| `ABA_PAYWAY_BASE_URL`    | Defaults to `https://checkout-sandbox.payway.com.kh` — confirmed against ABA's own developer docs ([developer.payway.com.kh](https://developer.payway.com.kh)). An earlier default (`checkout-sandbox.abapayway.com`) was never a real ABA domain. |
| `ABA_PAYWAY_WEBHOOK_URL` | `return_url` on `charge()` — see below.                                                                                                                                                                                                            |

All four are optional at the `ConfigModule` level (empty-string defaults) so
the app can boot without ABA credentials, but `charge()` throws immediately
if `ABA_PAYWAY_WEBHOOK_URL` is unset, and `ensureConfigured()` throws
immediately (called at the top of `charge()`/`reconcile()`) if either
`ABA_PAYWAY_API_KEY` or
`ABA_PAYWAY_MERCHANT_ID` is unset — fail fast with a clear message rather
than sending ABA a malformed, unsigned, or unroutable request.

## Current state

| Piece                             | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `charge()` (purchase)             | Done — confirmed live against the sandbox (2026-09-16), not just unit-tested.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `reconcile()` (check-transaction) | Done — confirmed live against the sandbox (2026-09-16).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `verifyWebhookSignature()`        | Done — real HMAC check, not a stub.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `parseWebhookEvent()`             | Done.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `redact()`                        | Identity function — correct, not unimplemented (see the doc comment on `AbaPaywayProvider.redact`; no PAN/account/token field appears anywhere in `spec.md`'s documented shapes).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Unit tests                        | Signing (all three algorithms), encoding (base64 + `req_time` formatting), and status-mapping pure functions are covered (`*.spec.ts`). No test exercises `charge()`/`reconcile()`/the controller against a live or mocked HTTP layer.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Live verification                 | **`charge()` and `reconcile()` both confirmed live against the sandbox (2026-09-16)** — real credentials, real `AbaPaywayProvider` instance, no mocking. `charge()` returned `status.code: "00"`, a working `redirectUrl` (`abapay_deeplink`), and a real KHQR (`qrString`/`qrImage`); `reconcile()` on the same `tran_id` round-tripped cleanly. This also caught and fixed three bugs no amount of doc-reading surfaced: ABA rejects `tran_id` over ~20-25 characters (a `payment_transactions.id` UUID is 36 — see `CreatePurchaseRequest.tran_id`'s doc comment), the purchase endpoint returns a rendered HTML page instead of JSON unless the request sends `Accept: application/json`, and the real JSON response shape (`qrString`/`qrImage`, no `checkout_qr_url`) doesn't match `spec.md`'s documented schema at all. **Not yet verified: a real webhook callback** — that needs either a publicly reachable `ABA_PAYWAY_WEBHOOK_URL` or an actually-completed sandbox payment (see [Open items](#open-items)), neither of which this environment has. |

## Open items

- **Resolved and confirmed live (2026-09-16)** against the real sandbox
  with real credentials, using the actual `AbaPaywayProvider` class (not a
  reimplementation) — not just cross-checked against docs:
  - The sandbox base URL was never a real ABA domain
    (`checkout-sandbox.abapayway.com` → `checkout-sandbox.payway.com.kh`).
  - `req_time`'s wire format is `YYYYMMDDHHmmss` UTC, not epoch
    milliseconds.
  - The `purchase` hash algorithm is 23 fixed-position fields, not the 5
    the previous implementation signed in a materially different order
    (`currency` was 5th instead of 17th, among other differences).
  - **`tran_id` must be ≤ ~20-25 characters** — ABA's live validation
    rejected the 36-character UUID this provider used to send
    (`payment_transactions.id`) with `"The tran_id cannot empty and
exceed 25 characters"`. `AbaPaywayProvider` now generates a short
    opaque id per attempt instead (`generateTranId()`, 20 characters);
    correlation still works because `payment_attempts.provider_attempt_id`
    was already populated from whatever ABA echoes back, not from our own
    UUID directly. This wasn't something any documentation would have
    caught — the reference implementation and `spec.md` both send the raw
    transaction id too.
  - **ABA's purchase endpoint returns a rendered HTML checkout page (200
    OK) instead of the documented JSON body unless the request sends
    `Accept: application/json`.** Without it, `response.status` is
    `undefined` on an HTML string — every purchase would have silently
    been read as failed. Now set on the shared `apiClient` construction.
  - **The real JSON response shape doesn't match `spec.md`'s
    `CreatePurchaseResponseSchema` at all.** Confirmed shape: `qrString`
    (camelCase, not `qr_string`), `qrImage` (a ready-to-display
    `data:image/png` base64 URI, not documented at all), `abapay_deeplink`,
    `app_store`, `play_store`, `description`, and `status` (the one field
    that does match). There is no `checkout_qr_url` field — `redirectUrl`
    now maps to `abapay_deeplink`; the KHQR data travels through
    `rawResponse`, same pattern `../bakong/bakong.provider.ts` uses.

  Any one of the first three would have made a live call fail outright;
  the last three would have made it silently misread success as failure
  even once signing was correct — together, the most likely reasons a
  first live attempt would have failed or appeared to fail, ahead of
  anything about `continue_success_url`/`cancel_url` encoding.

- **`continue_success_url`/`cancel_url` base64 encoding — resolved, no
  longer applied.** ABA's developer docs single out `return_url` for
  base64 encoding and say nothing about it for the other two URL fields —
  they're now sent plain. This reverses an earlier assumption (matching
  `return_url`'s convention) that this same investigation showed was
  probably wrong. Not independently confirmed against a live payer
  actually landing on the right page (that needs a completed payment —
  see the webhook item below), but the purchase call itself accepts the
  plain URLs without complaint.
- **A real webhook callback still hasn't been observed** — the one piece
  of the [Current state](#current-state) table's Live verification row
  genuinely still open. `verifyWebhookSignature()`/`signAbaPaywayCallback`
  are independently confirmed against both ABA's documented sample
  payload and its developer docs (algorithm-level), but ABA only ever
  sends this callback once a payment actually completes — which needs
  either a publicly reachable `ABA_PAYWAY_WEBHOOK_URL` (currently unset in
  `apps/backend/.env` — `charge()` refuses to call ABA at all without it)
  or a test card
  ([developer.payway.com.kh/resources-3305682f0](https://developer.payway.com.kh/resources-3305682f0)
  lists sandbox test cards for completing a transaction without a real
  bank account) run through the checkout page at the confirmed-working
  `abapay_deeplink`/`qrImage`. Neither has been available in this
  environment. Whoever has a tunnel (ngrok/cloudflared) and 2 minutes
  with a test card can close this the rest of the way.
  - `signAbaPaywayCallback`/`verifyAbaPaywayCallbackSignature` are
    unit-tested against ABA's own documented sample payload, and the
    algorithm itself (sort keys, concatenate, HMAC-SHA512, base64) is now
    independently confirmed against ABA's developer docs
    ([developer.payway.com.kh/ecommerce-checkout-3158159f0](https://developer.payway.com.kh/ecommerce-checkout-3158159f0)),
    not just the sample payload. What still isn't verified is whether a
    real callback's field set matches the documented one
    (`tran_id`/`apv`/`status`/`return_params`/`merchant_ref`) exactly —
    undocumented fields or different key casing would silently change the
    signed string. This provider has no `reconcile()` fallback for a
    signature check that's wrong in production — `processProviderEvent`
    trusts the payload once it clears `verifyWebhookSignature()`, full
    stop (the `reconcile()` corroboration described under [Webhook
    intake](#webhook-intake) only runs after signature verification
    already passed).
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
