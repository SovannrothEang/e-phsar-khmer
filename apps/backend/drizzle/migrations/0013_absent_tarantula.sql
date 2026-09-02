CREATE TYPE "public"."outbox_event_status" AS ENUM('pending', 'processing', 'published', 'failed');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" varchar(80) NOT NULL,
	"aggregate_type" varchar(40) NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"dedupe_key" varchar(200),
	"payload" jsonb NOT NULL,
	"status" "outbox_event_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" varchar(100),
	"last_error" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outbox_events_status_available_at_idx" ON "outbox_events" USING btree ("status","available_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outbox_events_aggregate_idx" ON "outbox_events" USING btree ("aggregate_type","aggregate_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "outbox_events_dedupe_key_idx" ON "outbox_events" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outbox_events_published_at_idx" ON "outbox_events" USING btree ("published_at") WHERE status in ('published','failed');