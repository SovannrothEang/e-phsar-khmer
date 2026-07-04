CREATE TABLE IF NOT EXISTS "listing_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"url" text NOT NULL,
	"path" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "listing_photos" ADD CONSTRAINT "listing_photos_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "listing_photos_listing_id_idx" ON "listing_photos" USING btree ("listing_id");--> statement-breakpoint
INSERT INTO "listing_photos" ("listing_id", "url", "path", "sort")
SELECT
  l."id",
  (photo->>'url')::text,
  (photo->>'path')::text,
  COALESCE((photo->>'sort')::integer, 0)
FROM "listings" l
CROSS JOIN LATERAL jsonb_array_elements(l."photos") AS photo
WHERE jsonb_array_length(l."photos") > 0;
--> statement-breakpoint
ALTER TABLE "listings" DROP COLUMN IF EXISTS "photos";