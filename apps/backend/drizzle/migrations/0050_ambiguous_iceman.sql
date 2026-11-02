CREATE TYPE "public"."sms_delivery_status" AS ENUM('queued', 'sent', 'failed', 'skipped');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sms_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"notification_type" varchar(80) NOT NULL,
	"masked_phone" varchar(32),
	"status" "sms_delivery_status" DEFAULT 'queued' NOT NULL,
	"skip_reason" varchar(60),
	"provider_status" integer,
	"provider_reply" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"outbox_event_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sms_deliveries" ADD CONSTRAINT "sms_deliveries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sms_deliveries_user_id_idx" ON "sms_deliveries" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sms_deliveries_outbox_event_id_uq" ON "sms_deliveries" USING btree ("outbox_event_id");