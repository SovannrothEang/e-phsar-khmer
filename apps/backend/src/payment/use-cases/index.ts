/**
 * The single import surface for this module's use-cases. Internally split
 * into `payments/` (payment_transaction/payment_attempt/provider-event
 * lifecycle) and `ledgers/` (double-entry posting) — see the module
 * README's Architecture section for why. Re-exported together here so
 * every other file in this module (and outside it) imports from one place
 * (`from '../use-cases'` / `from './use-cases'`) rather than reaching into
 * either subfolder directly.
 */
export * from './payments';
export * from './ledgers';
