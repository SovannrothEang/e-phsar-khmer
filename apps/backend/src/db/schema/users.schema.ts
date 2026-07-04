import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const userGenderEnum = pgEnum('user_gender', ['male', 'female']);
export const userRoleEnum = pgEnum('user_role', ['user', 'admin']);
export const userStatusEnum = pgEnum('user_status', [
  'active',
  'suspended',
  'deleted',
]);
export const authProviderEnum = pgEnum('auth_provider', [
  'phone',
  'username',
  'telegram',
  'facebook',
  'google',
]);

export const provinces = pgTable('provinces', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 80 }).unique().notNull(),
});

export const districts = pgTable(
  'districts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    provinceId: uuid('province_id')
      .notNull()
      .references(() => provinces.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    slug: varchar('slug', { length: 80 }).notNull(),
  },
  (t) => [
    uniqueIndex('districts_province_slug_uq').on(t.provinceId, t.slug),
    index('districts_province_id_idx').on(t.provinceId),
  ],
);

export const communes = pgTable(
  'communes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    districtId: uuid('district_id')
      .notNull()
      .references(() => districts.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    slug: varchar('slug', { length: 80 }).notNull(),
  },
  (t) => [index('communes_district_id_idx').on(t.districtId)],
);

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    username: varchar('username', { length: 50 }),
    passwordHash: text('password_hash'),
    primaryPhone: varchar('primary_phone', { length: 32 }),
    email: varchar('email', { length: 255 }),
    firstName: varchar('first_name', { length: 100 }),
    lastName: varchar('last_name', { length: 100 }),
    gender: userGenderEnum('gender'),
    yearOfBirth: integer('year_of_birth'),
    company: varchar('company', { length: 150 }),
    coverPhotoUrl: text('cover_photo_url'),
    profilePhotoUrl: text('profile_photo_url'),
    provinceId: uuid('province_id').references(() => provinces.id),
    districtId: uuid('district_id').references(() => districts.id),
    communeId: uuid('commune_id').references(() => communes.id),
    address: text('address'),
    latitude: numeric('latitude', { precision: 10, scale: 7 }),
    longitude: numeric('longitude', { precision: 10, scale: 7 }),
    preferredLanguage: varchar('preferred_language', { length: 5 })
      .default('en')
      .notNull(),
    role: userRoleEnum('role').default('user').notNull(),
    status: userStatusEnum('status').default('active').notNull(),
    isBusiness: boolean('is_business').default(false).notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    phoneVerifiedAt: timestamp('phone_verified_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // Partial uniques: soft-deleted users release username/phone/email for reuse
    uniqueIndex('users_username_active_uq')
      .on(t.username)
      .where(sql`deleted_at is null`),
    uniqueIndex('users_primary_phone_active_uq')
      .on(t.primaryPhone)
      .where(sql`deleted_at is null`),
    uniqueIndex('users_email_active_uq')
      .on(t.email)
      .where(sql`deleted_at is null`),
    index('users_status_idx').on(t.status),
    index('users_province_id_idx').on(t.provinceId),
    index('users_district_id_idx').on(t.districtId),
    index('users_commune_id_idx').on(t.communeId),
  ],
);

export const userPhones = pgTable(
  'user_phones',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    phone: varchar('phone', { length: 32 }).unique().notNull(),
    isPrimary: boolean('is_primary').default(false).notNull(),
  },
  (t) => [
    index('user_phones_user_id_idx').on(t.userId),
    // At most one primary phone per user, enforced at the DB level
    uniqueIndex('user_phones_user_primary_uq')
      .on(t.userId)
      .where(sql`is_primary = true`),
  ],
);

export const userAuthProviders = pgTable(
  'user_auth_providers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: authProviderEnum('provider').notNull(),
    providerAccountId: varchar('provider_account_id', { length: 120 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex('user_auth_providers_user_provider_uq').on(
      t.userId,
      t.provider,
    ),
    index('user_auth_providers_user_id_idx').on(t.userId),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type ProvinceRow = typeof provinces.$inferSelect;
export type NewProvince = typeof provinces.$inferInsert;
export type DistrictRow = typeof districts.$inferSelect;
export type NewDistrict = typeof districts.$inferInsert;
export type CommuneRow = typeof communes.$inferSelect;
export type NewCommune = typeof communes.$inferInsert;
export type UserPhoneRow = typeof userPhones.$inferSelect;
export type NewUserPhone = typeof userPhones.$inferInsert;
export type UserAuthProviderRow = typeof userAuthProviders.$inferSelect;
export type NewUserAuthProvider = typeof userAuthProviders.$inferInsert;
