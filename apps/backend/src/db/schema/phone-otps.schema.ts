import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const otpPurposeEnum = pgEnum('otp_purpose', [
  'register',
  'login',
  'password_reset',
]);

/**
 * One row per issued phone one-time code (`src/otp/`). Deliberately has no
 * plaintext-code column: `codeHash` is an HMAC-SHA256 keyed with a server
 * secret, so a database leak alone cannot be brute-forced offline. There is
 * no FK to `users` on purpose — a registering phone has no user yet.
 */
export const phoneOtps = pgTable(
  'phone_otps',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    phone: varchar('phone', { length: 32 }).notNull(),
    purpose: otpPurposeEnum('purpose').notNull(),
    codeHash: text('code_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    // Wrong (and right) verification attempts spent on this code.
    attempts: integer('attempts').default(0).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    requestIp: varchar('request_ip', { length: 64 }),
  },
  (t) => [index('phone_otps_phone_purpose_idx').on(t.phone, t.purpose)],
);

export type PhoneOtpRow = typeof phoneOtps.$inferSelect;
export type NewPhoneOtp = typeof phoneOtps.$inferInsert;
