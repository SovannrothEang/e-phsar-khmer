import { jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './users.schema';

/**
 * Runtime-tunable policy, one row per key.
 *
 * Every other numeric knob in this backend is an env var validated by
 * `config.validation.ts`, which needs a redeploy. A moderation threshold is
 * the first value that has to change while the process is up, so it lives
 * here instead — the key allowlist, types and defaults are in
 * `src/settings/settings.keys.ts`, and a missing row is never an error.
 */
export const appSettings = pgTable('app_settings', {
  key: varchar('key', { length: 64 }).primaryKey(),
  value: jsonb('value').notNull(),
  updatedById: uuid('updated_by_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type AppSettingRow = typeof appSettings.$inferSelect;
export type NewAppSetting = typeof appSettings.$inferInsert;
