ALTER TYPE "public"."listing_status" ADD VALUE 'inactive';--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "inactive_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "inactive_by_id" uuid;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "inactive_reason" varchar(500);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "listings" ADD CONSTRAINT "listings_inactive_by_id_users_id_fk" FOREIGN KEY ("inactive_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
