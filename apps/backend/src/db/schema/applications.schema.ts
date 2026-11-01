import { sql } from 'drizzle-orm';
import {
  check,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { listings } from './listings.schema';
import { users } from './users.schema';
// Type-only: the stored snapshot IS the resume module's assembled document, so
// naming that type here beats re-declaring its shape. Erased at compile time —
// the schema layer gains no runtime dependency on the service.
import type { ResumeDocumentWire } from '../../resume/resume.service';

/**
 * Where an application stands. Deliberately four values and no more: the two
 * /me pages already speak this vocabulary (the seeker's filter is
 * Pending/Hired/Viewed/Rejected, the poster's is New/Viewed), so the enum is
 * the mock's own list, not an invented workflow.
 */
export const jobApplicationStatusEnum = pgEnum('job_application_status', [
  'pending',
  'viewed',
  'hired',
  'rejected',
]);

/**
 * One job application: `applicantId` applied to `listingId`, whose owner is
 * `posterId`.
 *
 * `posterId` is denormalized from the listing on purpose — the poster's
 * "applications I received" list is the hot read, and resolving it through a
 * join to `listings` would make every page of it a two-table scan. The listing's
 * owner cannot change (there is no transfer path), so the copy cannot drift.
 *
 * `resumeSnapshot` is the résumé **as it stood when the application was sent**,
 * assembled by the resume module and stored verbatim. That is the whole of the
 * recruiter-visibility design the resume ship specified: the poster reads this
 * blob, never the `resumes` tables, so `GET /resume` stays owner-only and
 * editing your CV afterwards cannot rewrite an application someone already
 * read. The CV *file* gets no column of its own — its id, name and size already
 * ride inside the snapshot, and the signed download re-checks them against the
 * application.
 *
 * Both user FKs cascade for the same reason every other FK into `users` does:
 * `AccountPurgeService` hard-deletes accounts after the recovery window and
 * relies on the database taking their rows along. The listing FK cascades too —
 * a hard-deleted listing must not strand applications pointing at it (the
 * soft-delete path keeps them, which is what the /me lists render a tombstone
 * for).
 */
export const jobApplications = pgTable(
  'job_applications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    applicantId: uuid('applicant_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    posterId: uuid('poster_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** The dialog's optional cover note, as typed. */
    coverNote: text('cover_note'),
    resumeSnapshot: jsonb('resume_snapshot').$type<ResumeDocumentWire | null>(),
    status: jobApplicationStatusEnum('status').default('pending').notNull(),
    /** Stamped the first time the poster opens the application. */
    viewedAt: timestamp('viewed_at', { withTimezone: true }),
    /** Stamped when the poster hires or rejects. */
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // One application per job per person, enforced here rather than in the
    // service so a race cannot double-apply (or double-notify the poster).
    uniqueIndex('job_applications_listing_applicant_uq').on(
      t.listingId,
      t.applicantId,
    ),
    // The two list reads, each newest-first.
    index('job_applications_poster_created_idx').on(t.posterId, t.createdAt),
    index('job_applications_applicant_created_idx').on(
      t.applicantId,
      t.createdAt,
    ),
    // Backstop under the service's own 400 — applying to your own job is
    // rejected before a row is ever built.
    check('job_applications_not_self', sql`applicant_id <> poster_id`),
  ],
);

export type JobApplicationRow = typeof jobApplications.$inferSelect;
export type NewJobApplication = typeof jobApplications.$inferInsert;
