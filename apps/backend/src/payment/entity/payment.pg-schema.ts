import { pgSchema } from 'drizzle-orm/pg-core';

/**
 * The dedicated Postgres schema for every table this module owns (the
 * processing cluster + the ledger — see `../README.md`'s Architecture
 * section for what's in each). Every entity file imports this instead of
 * calling the bare `pgTable`/`pgEnum` from `drizzle-orm/pg-core` directly,
 * so a new table here can't accidentally land back in `public` by using the
 * wrong import.
 *
 * `payment_transactions.customer_id` and `payment_status_history.actor_id`
 * are cross-schema foreign keys into `public.users` — Postgres allows FKs
 * across schemas within the same database with no special handling needed,
 * and Drizzle's `.references()` doesn't care which schema either side lives
 * in.
 */
export const paymentSchema = pgSchema('payment');
