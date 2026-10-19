import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { communes, districts, provinces, users } from './users.schema';

/**
 * The CV's document root and its ownership anchor: one resume per user
 * (`UNIQUE(user_id)`), enforced here rather than in the service so a race
 * cannot produce two. Every section table hangs off this row and cascades with
 * it, so `AccountPurgeService`'s hard delete of a user takes the whole CV.
 *
 * `summary` and `hobbies` live here as plain columns (not their own tables):
 * they are single free-text blocks whose only "presence" test in the UI is a
 * non-empty string — there is nothing to address per row.
 *
 * The resume is the CV's own copy of the human behind it, deliberately not a
 * read-through to `users`: prefilled from the account but free to differ, and
 * editing the CV must never rename the account.
 */
export const resumes = pgTable(
  'resumes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    summary: text('summary').default('').notNull(),
    hobbies: text('hobbies').default('').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex('resumes_user_id_uq').on(t.userId)],
);

/**
 * Step 1's block — `resume_id` is the PRIMARY KEY, so a second personal row is
 * impossible by construction (no unique index needed, unlike the 1:1 tables
 * that hang off `users`).
 *
 * `phones` is a JSONB string list capped at three (the form's own limit) with
 * a DB CHECK as the backstop; the DTO caps it too. Geography is stored as ids
 * with RESTRICT deletes — the same rule `users` and `listings` follow, so a
 * geography re-seed can never silently blank a CV's location.
 */
export const resumePersonal = pgTable(
  'resume_personal',
  {
    resumeId: uuid('resume_id')
      .primaryKey()
      .references(() => resumes.id, { onDelete: 'cascade' }),
    firstName: varchar('first_name', { length: 50 }).notNull(),
    lastName: varchar('last_name', { length: 50 }).notNull(),
    gender: varchar('gender', { length: 20 }),
    dob: date('dob'),
    nationality: varchar('nationality', { length: 50 }),
    email: varchar('email', { length: 254 }),
    educationLevel: varchar('education_level', { length: 40 }),
    maritalStatus: varchar('marital_status', { length: 20 }),
    provinceId: uuid('province_id').references(() => provinces.id, {
      onDelete: 'restrict',
    }),
    districtId: uuid('district_id').references(() => districts.id, {
      onDelete: 'restrict',
    }),
    communeId: uuid('commune_id').references(() => communes.id, {
      onDelete: 'restrict',
    }),
    address: varchar('address', { length: 200 }),
    position: varchar('position', { length: 100 }),
    yearsOfExperience: integer('years_of_experience'),
    phones: jsonb('phones').$type<string[]>().default([]).notNull(),
    photoUrl: text('photo_url'),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  // Both constraints are column checks, so the callback needs no table handle.
  () => [
    check(
      'resume_personal_years_range',
      sql`years_of_experience is null or years_of_experience between 0 and 60`,
    ),
    check('resume_personal_phones_max', sql`jsonb_array_length(phones) <= 3`),
  ],
);

/**
 * One work-experience entry. The two CHECKs encode the form's own date rule —
 * an entry is either ongoing (`is_current`, no end date) or finished with an
 * end date at or after its start — so no API path can store a contradictory
 * row. The service raises the same rules as 400s, with a message the client
 * can act on.
 */
export const resumeExperiences = pgTable(
  'resume_experiences',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    resumeId: uuid('resume_id')
      .notNull()
      .references(() => resumes.id, { onDelete: 'cascade' }),
    company: varchar('company', { length: 100 }).notNull(),
    position: varchar('position', { length: 100 }).notNull(),
    provinceId: uuid('province_id').references(() => provinces.id, {
      onDelete: 'restrict',
    }),
    districtId: uuid('district_id').references(() => districts.id, {
      onDelete: 'restrict',
    }),
    communeId: uuid('commune_id').references(() => communes.id, {
      onDelete: 'restrict',
    }),
    startDate: date('start_date').notNull(),
    endDate: date('end_date'),
    isCurrent: boolean('is_current').default(false).notNull(),
    description: text('description').default('').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index('resume_experiences_resume_id_idx').on(t.resumeId),
    check(
      'resume_experiences_dates_ordered',
      sql`end_date is null or end_date >= start_date`,
    ),
    check(
      'resume_experiences_current_no_end',
      sql`not is_current or end_date is null`,
    ),
  ],
);

/** One education entry — `resume_experiences`' shape with school/degree/major. */
export const resumeEducations = pgTable(
  'resume_educations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    resumeId: uuid('resume_id')
      .notNull()
      .references(() => resumes.id, { onDelete: 'cascade' }),
    school: varchar('school', { length: 100 }).notNull(),
    degree: varchar('degree', { length: 40 }).notNull(),
    major: varchar('major', { length: 100 }).notNull(),
    provinceId: uuid('province_id').references(() => provinces.id, {
      onDelete: 'restrict',
    }),
    districtId: uuid('district_id').references(() => districts.id, {
      onDelete: 'restrict',
    }),
    communeId: uuid('commune_id').references(() => communes.id, {
      onDelete: 'restrict',
    }),
    startDate: date('start_date').notNull(),
    endDate: date('end_date'),
    isCurrent: boolean('is_current').default(false).notNull(),
    description: text('description').default('').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index('resume_educations_resume_id_idx').on(t.resumeId),
    check(
      'resume_educations_dates_ordered',
      sql`end_date is null or end_date >= start_date`,
    ),
    check(
      'resume_educations_current_no_end',
      sql`not is_current or end_date is null`,
    ),
  ],
);

/**
 * One skill. Insertion order is the display order (`created_at asc, id asc`),
 * so there is no `sort` column — nothing in the UI reorders rows by hand.
 */
export const resumeSkills = pgTable(
  'resume_skills',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    resumeId: uuid('resume_id')
      .notNull()
      .references(() => resumes.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 50 }).notNull(),
    level: varchar('level', { length: 20 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index('resume_skills_resume_id_idx').on(t.resumeId)],
);

/** One language. Same shape and ordering rules as `resume_skills`. */
export const resumeLanguages = pgTable(
  'resume_languages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    resumeId: uuid('resume_id')
      .notNull()
      .references(() => resumes.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 50 }).notNull(),
    level: varchar('level', { length: 20 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index('resume_languages_resume_id_idx').on(t.resumeId)],
);

/** One reference: the same contact trio the account and listings carry. */
export const resumeReferences = pgTable(
  'resume_references',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    resumeId: uuid('resume_id')
      .notNull()
      .references(() => resumes.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 50 }).notNull(),
    company: varchar('company', { length: 100 }).notNull(),
    position: varchar('position', { length: 100 }).notNull(),
    phones: jsonb('phones').$type<string[]>().default([]).notNull(),
    email: varchar('email', { length: 254 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index('resume_references_resume_id_idx').on(t.resumeId),
    check('resume_references_phones_max', sql`jsonb_array_length(phones) <= 3`),
  ],
);

/**
 * The Job Preferences card — 1:1 like `resume_personal`, so `resume_id` is the
 * primary key. The three pickers store the option *labels* the form shows
 * (they come from the same backend reads the form renders), not ids: the UI
 * renders them as text chips and never resolves them back to a row.
 */
export const resumeJobPreferences = pgTable('resume_job_preferences', {
  resumeId: uuid('resume_id')
    .primaryKey()
    .references(() => resumes.id, { onDelete: 'cascade' }),
  openJob: boolean('open_job').default(false).notNull(),
  position: varchar('position', { length: 100 }),
  categories: jsonb('categories').$type<string[]>().default([]).notNull(),
  locations: jsonb('locations').$type<string[]>().default([]).notNull(),
  jobTypes: jsonb('job_types').$type<string[]>().default([]).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

/**
 * The uploaded CV file — a private-bucket object with the chat attachment
 * lifecycle (pending → attached, with `expired` for a rejected upload).
 *
 * `resume_id` is nullable and SET NULL comes from the same reasoning as
 * `chat.attachments.message_id`: a row with no resume is exactly "uploaded but
 * never attached", which is what the orphan job sweeps. `actual_size` is the
 * only size read back from storage; `declared_size` is the client's claim and
 * is used for the early cap check only.
 */
export const resumeAttachments = pgTable(
  'resume_attachments',
  {
    // Client-generated, so a retried create returns the same row.
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    resumeId: uuid('resume_id').references(() => resumes.id, {
      onDelete: 'set null',
    }),
    // `{userId}/{id}/{safeFileName}` in the resume-files bucket — server-built.
    objectKey: text('object_key').notNull(),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    // 'pending' | 'attached' | 'expired'
    status: varchar('status', { length: 20 }).default('pending').notNull(),
    declaredSize: integer('declared_size').notNull(),
    actualSize: integer('actual_size'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }),
    attachedAt: timestamp('attached_at', { withTimezone: true }),
  },
  (t) => [
    index('resume_attachments_resume_idx').on(t.resumeId),
    index('resume_attachments_orphan_idx')
      .on(t.createdAt)
      .where(sql`resume_id is null`),
    index('resume_attachments_user_created_idx').on(t.userId, t.createdAt),
  ],
);

export type ResumeRow = typeof resumes.$inferSelect;
export type ResumePersonalRow = typeof resumePersonal.$inferSelect;
export type ResumeExperienceRow = typeof resumeExperiences.$inferSelect;
export type ResumeEducationRow = typeof resumeEducations.$inferSelect;
export type ResumeSkillRow = typeof resumeSkills.$inferSelect;
export type ResumeLanguageRow = typeof resumeLanguages.$inferSelect;
export type ResumeReferenceRow = typeof resumeReferences.$inferSelect;
export type ResumeJobPreferenceRow = typeof resumeJobPreferences.$inferSelect;
export type ResumeAttachmentRow = typeof resumeAttachments.$inferSelect;
