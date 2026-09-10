import { pgSchema } from 'drizzle-orm/pg-core';

/**
 * The dedicated Postgres schema for every table the chat module owns
 * (`conversations`, `messages`) — mirrors `payment/entity/payment.pg-schema.ts`.
 * `chat.schema.ts` imports this instead of calling the bare `pgTable` from
 * `drizzle-orm/pg-core` directly, so a new chat table can't accidentally
 * land back in `public` by using the wrong import.
 *
 * `conversations.user_a_id`/`user_b_id`, `messages.sender_id`, and
 * `messages.listing_id` are cross-schema foreign keys into `public.users` /
 * `public.listings` — Postgres allows FKs across schemas within the same
 * database with no special handling needed, and Drizzle's `.references()`
 * doesn't care which schema either side lives in.
 */
export const chatSchema = pgSchema('chat');
