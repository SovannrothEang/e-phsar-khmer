CREATE TABLE IF NOT EXISTS "user_username_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"username" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX IF EXISTS "users_username_active_uq";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_username_history" ADD CONSTRAINT "user_username_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_username_history_username_uq" ON "user_username_history" USING btree ("username");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_username_history_user_id_idx" ON "user_username_history" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_active_uq" ON "users" USING btree (lower("username")) WHERE deleted_at is null;