/**
 * ABA PayWay wire-format types, field names taken verbatim from
 * `./spec.md`. Plain interfaces rather than a runtime schema — nothing
 * else in `providers/` validates an external payload at the type level
 * either (see `payment-gateway.types.ts`); the spec.md's own footnote says
 * naming/reuse across endpoints doesn't need to be strict, so shared
 * shapes (`AbaPaywayStatus`) are reused where the fields genuinely match.
 */

export interface AbaPaywayStatus {
  code: string;
  message: string;
  tran_id: string;
}

export interface CreatePurchaseRequest {
  req_time: string;
  merchant_id: string;
  tran_id: string;
  amount: number;
  currency?: string;
  items?: string;
  payment_option?: string;
  return_url?: string;
  cancel_url?: string;
  continue_success_url?: string;
  custom_fields?: string;
  hash: string;
}

export interface CreatePurchaseResponse {
  status: AbaPaywayStatus;
  qr_string?: string;
  abapay_deeplink?: string;
  checkout_qr_url?: string;
}

export interface CheckTransactionRequest {
  hash: string;
  merchant_id: string;
  req_time: string;
  tran_id: string;
}

export interface CheckTransactionData {
  apv?: string | null;
  discount_amount?: number | null;
  original_amount?: number | null;
  payment_amount?: number | null;
  payment_currency?: string | null;
  payment_status?: string | null;
  payment_status_code?: number | null;
  refund_amount?: number | null;
  status?: AbaPaywayStatus | null;
  total_amount?: number | null;
  transaction_date?: string | null;
}

export interface CheckTransactionResponse {
  data?: CheckTransactionData | null;
}

/**
 * `transaction-detail`'s request body is identical in shape to
 * check-transaction's (`hash`, `merchant_id`, `req_time`, `tran_id`) — reused
 * rather than redeclared, per spec.md's own footnote that naming/reuse
 * across endpoints doesn't need to be strict when the required fields match.
 */
export type GetTransactionDetailRequest = CheckTransactionRequest;

export interface AbaPaywayTransactionOperation {
  amount?: number | null;
  bank_ref?: string | null;
  status?: string | null;
  transaction_date?: string | null;
}

export interface GetTransactionDetailData {
  apv?: string | null;
  bank_name?: string | null;
  bank_ref?: string | null;
  card_source?: string | null;
  discount_amount?: number | null;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  original_amount?: number | null;
  original_currency?: string | null;
  payer_account?: string | null;
  payment_amount?: number | null;
  payment_currency?: string | null;
  payment_status?: string | null;
  payment_status_code?: number | null;
  payment_type?: string | null;
  phone?: string | null;
  refund_amount?: number | null;
  status?: AbaPaywayStatus | null;
  total_amount?: number | null;
  transaction_date?: string | null;
  transaction_id?: string | null;
  transaction_operations?: AbaPaywayTransactionOperation[] | null;
}

export interface GetTransactionDetailResponse {
  data?: GetTransactionDetailData | null;
}

/**
 * ABA's async payment notification ("Pushback Data") POSTed to `return_url`.
 * Not documented in spec.md (which only covers the 5 REST endpoints) — this
 * is the real, doc-confirmed shape (the "Handle Callback URL" guide's
 * schema + sample payload), which turned out to differ from what the
 * `payway-gateway` reference's own webhook intake assumed (it used
 * `transaction_id`/`payment_status_code`/`payment_status`, none of which
 * appear in ABA's actual callback body).
 */
export interface AbaPaywayWebhookPayload {
  /** Echoes the `tran_id` sent on the purchase call. */
  tran_id: string;
  /** Approval code. */
  apv?: string;
  /** "0" on success; other values are ABA-defined failure/pending codes not further documented. */
  status: string;
  /** JSON-string echo of whatever `return_params` was sent on the purchase call, if any. */
  return_params?: string;
  /** Our own reference, round-tripped by ABA when present. */
  merchant_ref?: string;
}
