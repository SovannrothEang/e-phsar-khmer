CREATE TABLE IF NOT EXISTS "resume_attachments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"resume_id" uuid,
	"object_key" text NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"declared_size" integer NOT NULL,
	"actual_size" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"uploaded_at" timestamp with time zone,
	"attached_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resume_educations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resume_id" uuid NOT NULL,
	"school" varchar(100) NOT NULL,
	"degree" varchar(40) NOT NULL,
	"major" varchar(100) NOT NULL,
	"province_id" uuid,
	"district_id" uuid,
	"commune_id" uuid,
	"start_date" date NOT NULL,
	"end_date" date,
	"is_current" boolean DEFAULT false NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resume_educations_dates_ordered" CHECK (end_date is null or end_date >= start_date),
	CONSTRAINT "resume_educations_current_no_end" CHECK (not is_current or end_date is null)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resume_experiences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resume_id" uuid NOT NULL,
	"company" varchar(100) NOT NULL,
	"position" varchar(100) NOT NULL,
	"province_id" uuid,
	"district_id" uuid,
	"commune_id" uuid,
	"start_date" date NOT NULL,
	"end_date" date,
	"is_current" boolean DEFAULT false NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resume_experiences_dates_ordered" CHECK (end_date is null or end_date >= start_date),
	CONSTRAINT "resume_experiences_current_no_end" CHECK (not is_current or end_date is null)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resume_job_preferences" (
	"resume_id" uuid PRIMARY KEY NOT NULL,
	"open_job" boolean DEFAULT false NOT NULL,
	"position" varchar(100),
	"categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"locations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"job_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resume_languages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resume_id" uuid NOT NULL,
	"title" varchar(50) NOT NULL,
	"level" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resume_personal" (
	"resume_id" uuid PRIMARY KEY NOT NULL,
	"first_name" varchar(50) NOT NULL,
	"last_name" varchar(50) NOT NULL,
	"gender" varchar(20),
	"dob" date,
	"nationality" varchar(50),
	"email" varchar(254),
	"education_level" varchar(40),
	"marital_status" varchar(20),
	"province_id" uuid,
	"district_id" uuid,
	"commune_id" uuid,
	"address" varchar(200),
	"position" varchar(100),
	"years_of_experience" integer,
	"phones" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"photo_url" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resume_personal_years_range" CHECK (years_of_experience is null or years_of_experience between 0 and 60),
	CONSTRAINT "resume_personal_phones_max" CHECK (jsonb_array_length(phones) <= 3)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resume_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resume_id" uuid NOT NULL,
	"name" varchar(50) NOT NULL,
	"company" varchar(100) NOT NULL,
	"position" varchar(100) NOT NULL,
	"phones" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"email" varchar(254),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resume_references_phones_max" CHECK (jsonb_array_length(phones) <= 3)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resume_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resume_id" uuid NOT NULL,
	"title" varchar(50) NOT NULL,
	"level" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resumes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"hobbies" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resume_attachments" ADD CONSTRAINT "resume_attachments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resume_attachments" ADD CONSTRAINT "resume_attachments_resume_id_resumes_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resume_educations" ADD CONSTRAINT "resume_educations_resume_id_resumes_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resume_educations" ADD CONSTRAINT "resume_educations_province_id_provinces_id_fk" FOREIGN KEY ("province_id") REFERENCES "public"."provinces"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resume_educations" ADD CONSTRAINT "resume_educations_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resume_educations" ADD CONSTRAINT "resume_educations_commune_id_communes_id_fk" FOREIGN KEY ("commune_id") REFERENCES "public"."communes"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resume_experiences" ADD CONSTRAINT "resume_experiences_resume_id_resumes_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resume_experiences" ADD CONSTRAINT "resume_experiences_province_id_provinces_id_fk" FOREIGN KEY ("province_id") REFERENCES "public"."provinces"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resume_experiences" ADD CONSTRAINT "resume_experiences_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resume_experiences" ADD CONSTRAINT "resume_experiences_commune_id_communes_id_fk" FOREIGN KEY ("commune_id") REFERENCES "public"."communes"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resume_job_preferences" ADD CONSTRAINT "resume_job_preferences_resume_id_resumes_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resume_languages" ADD CONSTRAINT "resume_languages_resume_id_resumes_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resume_personal" ADD CONSTRAINT "resume_personal_resume_id_resumes_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resume_personal" ADD CONSTRAINT "resume_personal_province_id_provinces_id_fk" FOREIGN KEY ("province_id") REFERENCES "public"."provinces"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resume_personal" ADD CONSTRAINT "resume_personal_district_id_districts_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."districts"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resume_personal" ADD CONSTRAINT "resume_personal_commune_id_communes_id_fk" FOREIGN KEY ("commune_id") REFERENCES "public"."communes"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resume_references" ADD CONSTRAINT "resume_references_resume_id_resumes_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resume_skills" ADD CONSTRAINT "resume_skills_resume_id_resumes_id_fk" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resumes" ADD CONSTRAINT "resumes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resume_attachments_resume_idx" ON "resume_attachments" USING btree ("resume_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resume_attachments_orphan_idx" ON "resume_attachments" USING btree ("created_at") WHERE resume_id is null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resume_attachments_user_created_idx" ON "resume_attachments" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resume_educations_resume_id_idx" ON "resume_educations" USING btree ("resume_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resume_experiences_resume_id_idx" ON "resume_experiences" USING btree ("resume_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resume_languages_resume_id_idx" ON "resume_languages" USING btree ("resume_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resume_references_resume_id_idx" ON "resume_references" USING btree ("resume_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resume_skills_resume_id_idx" ON "resume_skills" USING btree ("resume_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "resumes_user_id_uq" ON "resumes" USING btree ("user_id");