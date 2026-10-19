CREATE TABLE IF NOT EXISTS "banned_phones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" varchar(32) NOT NULL,
	"user_id" uuid,
	"report_id" uuid,
	"banned_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "taken_down_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "listing_reports" ADD COLUMN "image_paths" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "banned_phones" ADD CONSTRAINT "banned_phones_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "banned_phones" ADD CONSTRAINT "banned_phones_report_id_user_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."user_reports"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "banned_phones" ADD CONSTRAINT "banned_phones_banned_by_id_users_id_fk" FOREIGN KEY ("banned_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "banned_phones_phone_uq" ON "banned_phones" USING btree ("phone");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "banned_phones_user_id_idx" ON "banned_phones" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "banned_phones_report_id_idx" ON "banned_phones" USING btree ("report_id");