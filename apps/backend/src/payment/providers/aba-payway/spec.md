# Payment Service Specification
## Context

We need to build a payment processor for the ABA payway, to handle the payments when picking the aba_payway option.

## Create purchase
_**Endpoint:**_ `POST /api/payment-gateway/v1/payments/purchase`
_**Request Body (format in TypeScript effect):**_
```ts
export const CreatePurchaseSchema = Schema.struct({
    "additional_params": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "amount": Schema.number,
    "cancel_url": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "continue_success_url": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "currency": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "custom_fields": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "email": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "firstname": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "google_pay_token": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "hash": Schema.string,
    "items": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "lastname": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "lifetime": Schema.optional(Schema.union(Schema.number, Schema.null)),
    "merchant_id": Schema.string,
    "payment_gate": Schema.optional(Schema.union(Schema.number, Schema.null)),
    "payment_option": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "payout": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "phone": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "req_time": Schema.string,
    "return_deeplink": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "return_params": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "return_url": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "shipping": Schema.optional(Schema.union(Schema.number, Schema.null)),
    "skip_success_page": Schema.optional(Schema.union(Schema.number, Schema.null)),
    "tran_id": Schema.string,
    "type": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "view_type": Schema.optional(Schema.union(Schema.null, Schema.string)),
});
export type CreatePurchase = Schema.From<typeof CreatePurchaseSchema>;
```
_**Response Body (format in TypeScript effect):**_
```ts
export const StatusSchema = Schema.struct({
    "code": Schema.string,
    "message": Schema.string,
    "tran_id": Schema.string,
});
export type Status = Schema.From<typeof StatusSchema>;

export const CreatePurchaseResponseSchema = Schema.struct({
    "abapay_deeplink": Schema.string,
    "checkout_qr_url": Schema.string,
    "qr_string": Schema.string,
    "status": Schema.lazy(() => StatusSchema),
});
export type CreatePurchaseResponse = Schema.From<typeof CreatePurchaseResponseSchema>;
```

## Check transaction
_**Endpoint:**_ `POST /api/payment-gateway/v1/payments/check-transaction-2`
_**Request Body (format in TypeScript effect):**_
```ts
export const CheckTransactionSchema = Schema.struct({
    "hash": Schema.string,
    "merchant_id": Schema.string,
    "req_time": Schema.string,
    "tran_id": Schema.string,
});
export type CheckTransaction = Schema.From<typeof CheckTransactionSchema>;
```
_**Response Body (format in TypeScript effect):**_
```ts
export const StatusSchema = Schema.struct({
  "code": Schema.optional(Schema.union(Schema.null, Schema.string)),
  "message": Schema.optional(Schema.union(Schema.null, Schema.string)),
  "tran_id": Schema.optional(Schema.union(Schema.null, Schema.string)),
});
export type Status = Schema.From<typeof StatusSchema>;

export const DataSchema = Schema.struct({
  "apv": Schema.optional(Schema.union(Schema.null, Schema.string)),
  "discount_amount": Schema.optional(Schema.union(Schema.number, Schema.null)),
  "original_amount": Schema.optional(Schema.union(Schema.number, Schema.null)),
  "payment_amount": Schema.optional(Schema.union(Schema.number, Schema.null)),
  "payment_currency": Schema.optional(Schema.union(Schema.null, Schema.string)),
  "payment_status": Schema.optional(Schema.union(Schema.null, Schema.string)),
  "payment_status_code": Schema.optional(Schema.union(Schema.number, Schema.null)),
  "refund_amount": Schema.optional(Schema.union(Schema.number, Schema.null)),
  "status": Schema.optional(Schema.union(Schema.lazy(() => StatusSchema), Schema.null)),
  "total_amount": Schema.optional(Schema.union(Schema.number, Schema.null)),
  "transaction_date": Schema.optional(Schema.union(Schema.null, Schema.string)),
});
export type Data = Schema.From<typeof DataSchema>;

export const CheckTransactionResponseSchema = Schema.struct({
  "data": Schema.optional(Schema.union(Schema.lazy(() => DataSchema), Schema.null)),
});
export type CheckTransactionResponse = Schema.From<typeof CheckTransactionResponseSchema>;
```

## Get transaction details
_**Endpoint:**_ `POST /api/payment-gateway/v1/payments/transaction-detail`
_**Request Body (format in TypeScript effect):**_
```ts
export const GetTransactionDetailSchema = Schema.struct({
    "hash": Schema.string,
    "merchant_id": Schema.string,
    "req_time": Schema.string,
    "tran_id": Schema.string,
});
export type GetTransactionDetail = Schema.From<typeof GetTransactionDetailSchema>;
```
_**Response Body (format in TypeScript effect):**_
```ts
export const TransactionOperationSchema = Schema.struct({
    "amount": Schema.optional(Schema.union(Schema.number, Schema.null)),
    "bank_ref": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "status": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "transaction_date": Schema.optional(Schema.union(Schema.null, Schema.string)),
});
export type TransactionOperation = Schema.From<typeof TransactionOperationSchema>;

export const StatusSchema = Schema.struct({
    "code": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "message": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "tran_id": Schema.optional(Schema.union(Schema.null, Schema.string)),
});
export type Status = Schema.From<typeof StatusSchema>;

export const DataSchema = Schema.struct({
    "apv": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "bank_name": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "bank_ref": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "card_source": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "discount_amount": Schema.optional(Schema.union(Schema.number, Schema.null)),
    "email": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "first_name": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "last_name": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "original_amount": Schema.optional(Schema.union(Schema.number, Schema.null)),
    "original_currency": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "payer_account": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "payment_amount": Schema.optional(Schema.union(Schema.number, Schema.null)),
    "payment_currency": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "payment_status": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "payment_status_code": Schema.optional(Schema.union(Schema.number, Schema.null)),
    "payment_type": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "phone": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "refund_amount": Schema.optional(Schema.union(Schema.number, Schema.null)),
    "status": Schema.optional(Schema.union(Schema.lazy(() => StatusSchema), Schema.null)),
    "total_amount": Schema.optional(Schema.union(Schema.number, Schema.null)),
    "transaction_date": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "transaction_id": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "transaction_operations": Schema.optional(Schema.union(Schema.array(Schema.lazy(() => TransactionOperationSchema)), Schema.null)),
});
export type Data = Schema.From<typeof DataSchema>;

export const GetTransactionDetailResponseSchema = Schema.struct({
    "data": Schema.optional(Schema.union(Schema.lazy(() => DataSchema), Schema.null)),
});
export type GetTransactionDetailResponse = Schema.From<typeof GetTransactionDetailResponseSchema>;
```

## Close transaction
_**Endpoint:**_ `POST /api/payment-gateway/v1/payments/close-transaction`
_**Request Body (format in TypeScript effect):**_
```ts
export const CloseTransactionSchema = Schema.struct({
    "hash": Schema.string,
    "merchant_id": Schema.string,
    "req_time": Schema.string,
    "tran_id": Schema.string,
});
export type CloseTransaction = Schema.From<typeof CloseTransactionSchema>;
```
_**Response Body (format in TypeScript effect):**_
```ts
export const StatusSchema = Schema.struct({
    "code": Schema.string,
    "message": Schema.string,
    "tran_id": Schema.string,
});
export type Status = Schema.From<typeof StatusSchema>;

export const CloseTransactionResponseSchema = Schema.struct({
    "status": Schema.lazy(() => StatusSchema),
});
export type CloseTransactionResponse = Schema.From<typeof CloseTransactionResponseSchema>;
```

## Get transaction list
_**Endpoint:**_ `POST /api/payment-gateway/v1/payments/transaction-list-2`
_**Request Body (format in TypeScript effect):**_
```ts
export const GetTransactionListSchema = Schema.struct({
    "from_amount": Schema.optional(Schema.union(Schema.number, Schema.null)),
    "from_date": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "hash": Schema.string,
    "merchant_id": Schema.string,
    "page": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "pagination": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "req_time": Schema.string,
    "status": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "to_amount": Schema.optional(Schema.union(Schema.number, Schema.null)),
    "to_date": Schema.optional(Schema.union(Schema.null, Schema.string)),
});
export type GetTransactionList = Schema.From<typeof GetTransactionListSchema>;
```
_**Response Body (format in TypeScript effect):**_
```ts
export const StatusSchema = Schema.struct({
    "code": Schema.optional(Schema.union(Schema.number, Schema.null, Schema.string)),
    "message": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "tran_id": Schema.optional(Schema.union(Schema.null, Schema.string)),
});
export type Status = Schema.From<typeof StatusSchema>;

export const DatumSchema = Schema.struct({
    "apv": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "bank_name": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "bank_ref": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "card_source": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "discount_amount": Schema.optional(Schema.union(Schema.number, Schema.null)),
    "email": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "first_name": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "last_name": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "original_amount": Schema.optional(Schema.union(Schema.number, Schema.null)),
    "original_currency": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "payer_account": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "payment_amount": Schema.optional(Schema.union(Schema.number, Schema.null)),
    "payment_currency": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "payment_status": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "payment_status_code": Schema.optional(Schema.union(Schema.number, Schema.null)),
    "payment_type": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "phone": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "refund_amount": Schema.optional(Schema.union(Schema.number, Schema.null)),
    "total_amount": Schema.optional(Schema.union(Schema.number, Schema.null)),
    "transaction_date": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "transaction_id": Schema.optional(Schema.union(Schema.null, Schema.string)),
});
export type Datum = Schema.From<typeof DatumSchema>;

export const GetTransactionDetailResponseSchema = Schema.struct({
    "data": Schema.optional(Schema.union(Schema.array(Schema.lazy(() => DatumSchema)), Schema.null)),
    "page": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "pagination": Schema.optional(Schema.union(Schema.null, Schema.string)),
    "status": Schema.optional(Schema.union(Schema.lazy(() => StatusSchema), Schema.null)),
});
export type GetTransactionDetailResponse = Schema.From<typeof GetTransactionDetailResponseSchema>;
```

_**Notice:**_ the naming is not needing to be entirely consistent with the given names, let's make sure the class/record can be reused if required fields are the same.
also making sure the `hash` field is using the encoding method as specified in the ABA payway documentation, which is typically a SHA256 hash of the concatenated string of required parameters and a secret key.