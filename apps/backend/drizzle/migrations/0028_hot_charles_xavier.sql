CREATE TABLE IF NOT EXISTS "chat"."e2e_backup_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"device_id" uuid,
	"ciphertext" text NOT NULL,
	"message_count" integer NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat"."e2e_backups" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"key_check" text NOT NULL,
	"passcode_salt" text,
	"passcode_params" jsonb,
	"wrapped_key" text,
	"passcode_auth_hash" text,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat"."e2e_history_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"requester_device_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"approver_device_id" uuid,
	"header" jsonb,
	"wrapped_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat"."user_e2e_devices" ADD COLUMN "label" varchar(100);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat"."e2e_backup_segments" ADD CONSTRAINT "e2e_backup_segments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat"."e2e_backup_segments" ADD CONSTRAINT "e2e_backup_segments_device_id_user_e2e_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "chat"."user_e2e_devices"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat"."e2e_backups" ADD CONSTRAINT "e2e_backups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat"."e2e_history_requests" ADD CONSTRAINT "e2e_history_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat"."e2e_history_requests" ADD CONSTRAINT "e2e_history_requests_requester_device_id_user_e2e_devices_id_fk" FOREIGN KEY ("requester_device_id") REFERENCES "chat"."user_e2e_devices"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat"."e2e_history_requests" ADD CONSTRAINT "e2e_history_requests_approver_device_id_user_e2e_devices_id_fk" FOREIGN KEY ("approver_device_id") REFERENCES "chat"."user_e2e_devices"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "e2e_backup_segments_user_created_idx" ON "chat"."e2e_backup_segments" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "e2e_history_requests_user_idx" ON "chat"."e2e_history_requests" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "e2e_history_requests_pending_uq" ON "chat"."e2e_history_requests" USING btree ("requester_device_id") WHERE status = 'pending';