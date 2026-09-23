import { pgSchema } from 'drizzle-orm/pg-core';

/**
 * Dedicated Postgres schema for every table this module owns — see
 * `../README.md`. Entity files import this instead of the bare
 * `pgTable`/`pgEnum`, so a new table can't accidentally land in `public`.
 * Cross-schema FKs into `public.users` (`customer_id`, `actor_id`) work
 * with no special handling — Postgres and Drizzle both allow that.
 */
export const paymentSchema = pgSchema('payment');
