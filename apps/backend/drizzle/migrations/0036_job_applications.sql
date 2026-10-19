CREATE TYPE "public"."job_application_status" AS ENUM('pending', 'viewed', 'hired', 'rejected');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"applicant_id" uuid NOT NULL,
	"poster_id" uuid NOT NULL,
	"cover_note" text,
	"resume_snapshot" jsonb,
	"status" "job_application_status" DEFAULT 'pending' NOT NULL,
	"viewed_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_applications_not_self" CHECK (applicant_id <> poster_id)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_applicant_id_users_id_fk" FOREIGN KEY ("applicant_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_poster_id_users_id_fk" FOREIGN KEY ("poster_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "job_applications_listing_applicant_uq" ON "job_applications" USING btree ("listing_id","applicant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_applications_poster_created_idx" ON "job_applications" USING btree ("poster_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "job_applications_applicant_created_idx" ON "job_applications" USING btree ("applicant_id","created_at");