CREATE TYPE "public"."outbox_status" AS ENUM('pending', 'processing', 'published', 'dead');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "outbox_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic" varchar(80) NOT NULL,
	"aggregate_id" uuid,
	"payload" jsonb NOT NULL,
	"status" "outbox_status" DEFAULT 'pending' NOT NULL,
	"priority" smallint DEFAULT 0 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dedupe_key" varchar(160),
	"locked_by" varchar(64),
	"locked_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outbox_messages_claim_idx" ON "outbox_messages" USING btree ("priority" DESC NULLS LAST,"next_attempt_at") WHERE status = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "outbox_messages_dedupe_key_uq" ON "outbox_messages" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outbox_messages_published_idx" ON "outbox_messages" USING btree ("published_at") WHERE status = 'published';