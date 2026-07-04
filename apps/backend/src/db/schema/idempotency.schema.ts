import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const idempotencyStatusEnum = pgEnum('idempotency_status', [
  'processing',
  'completed',
  'failed',
]);

export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    key: varchar('key', { length: 255 }).notNull(),
    userId: uuid('user_id'),
    method: varchar('method', { length: 10 }).notNull(),
    path: varchar('path', { length: 512 }).notNull(),
    requestHash: varchar('request_hash', { length: 64 }),
    status: idempotencyStatusEnum('status').default('processing').notNull(),
    responseStatus: integer('response_status'),
    responseBody: jsonb('response_body'),
    lockedAt: timestamp('locked_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    // NULLS NOT DISTINCT so anonymous requests (userId null) still dedupe
    unique('idempotency_keys_key_method_path_user_uq')
      .on(t.key, t.method, t.path, t.userId)
      .nullsNotDistinct(),
    index('idempotency_keys_expires_at_idx').on(t.expiresAt),
  ],
);

export type IdempotencyKeyRow = typeof idempotencyKeys.$inferSelect;
export type NewIdempotencyKey = typeof idempotencyKeys.$inferInsert;
