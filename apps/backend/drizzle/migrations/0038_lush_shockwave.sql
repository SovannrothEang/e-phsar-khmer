CREATE TYPE "public"."listing_event_type" AS ENUM('impression', 'view', 'chat', 'call', 'show_contact', 'apply_job');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "listing_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"actor_id" uuid,
	"event_type" "listing_event_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "listing_events" ADD CONSTRAINT "listing_events_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "listing_events" ADD CONSTRAINT "listing_events_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "listing_events" ADD CONSTRAINT "listing_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "listing_events_owner_type_idx" ON "listing_events" USING btree ("owner_id","event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "listing_events_listing_id_idx" ON "listing_events" USING btree ("listing_id");