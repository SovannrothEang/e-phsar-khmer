CREATE TABLE IF NOT EXISTS "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"name" varchar(200) NOT NULL,
	"phone" varchar(32) NOT NULL,
	"email" varchar(254),
	"description" text NOT NULL,
	"image_paths" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feedback_created_at_idx" ON "feedback" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feedback_user_id_idx" ON "feedback" USING btree ("user_id");