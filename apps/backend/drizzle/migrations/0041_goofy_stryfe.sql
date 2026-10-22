ALTER TABLE "user_login_devices" ADD COLUMN "client_type" varchar(16);--> statement-breakpoint
ALTER TABLE "user_login_devices" ADD COLUMN "browser_name" varchar(40);--> statement-breakpoint
ALTER TABLE "user_login_devices" ADD COLUMN "browser_version" varchar(40);--> statement-breakpoint
ALTER TABLE "user_login_devices" ADD COLUMN "os_name" varchar(40);--> statement-breakpoint
ALTER TABLE "user_login_devices" ADD COLUMN "os_version" varchar(40);--> statement-breakpoint
ALTER TABLE "user_login_devices" ADD COLUMN "device_model" varchar(80);--> statement-breakpoint
ALTER TABLE "user_login_devices" ADD COLUMN "client_version" varchar(40);--> statement-breakpoint
ALTER TABLE "user_login_devices" ADD COLUMN "user_agent" varchar(512);--> statement-breakpoint
ALTER TABLE "user_login_devices" ADD COLUMN "session_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "user_login_devices" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_login_devices_user_session_uq" ON "user_login_devices" USING btree ("user_id","session_id");