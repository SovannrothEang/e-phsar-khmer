/**
 * A leaf file with no imports, so payment.module.ts and payment.controller.ts
 * can both depend on it without a module <-> controller import cycle.
 * (`@InjectQueue(PAYMENT_QUEUE)` evaluates at class-decoration time — a
 * cyclic import previously left this `undefined` there, silently binding to
 * BullMQ's "default" queue instead of "payments".)
 */
export const PAYMENT_QUEUE = 'payments';
