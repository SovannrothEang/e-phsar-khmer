CREATE TYPE "public"."otp_purpose" AS ENUM('register', 'login', 'password_reset');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "phone_otps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" varchar(32) NOT NULL,
	"purpose" "otp_purpose" NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"request_ip" varchar(64)
);
--> statement-breakpoint
ALTER TABLE "sms_deliveries" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sms_deliveries" ALTER COLUMN "outbox_event_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sms_deliveries" ADD COLUMN "purpose" varchar(30);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "phone_otps_phone_purpose_idx" ON "phone_otps" USING btree ("phone","purpose");