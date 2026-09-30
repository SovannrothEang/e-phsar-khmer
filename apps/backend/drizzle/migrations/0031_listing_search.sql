-- pg_trgm backs the keyword search's trigram indexes below. Supabase keeps
-- extensions in the `extensions` schema (on the default search_path); a plain
-- Postgres without that schema gets the default creation schema instead.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'extensions') THEN
    CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
  ELSE
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "effective_price" numeric(14, 2) GENERATED ALWAYS AS (CASE
        WHEN price IS NULL THEN NULL
        WHEN discount_value IS NULL OR discount_type IS NULL OR discount_value <= 0 THEN price
        WHEN discount_type = 'percent' THEN
          CASE WHEN discount_value >= 100 THEN 0
               ELSE round(price * (1 - discount_value / 100), 2) END
        ELSE GREATEST(round(price - discount_value, 2), 0)
      END) STORED;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "listings_status_effective_price_idx" ON "listings" USING btree ("status","effective_price","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "listings_title_trgm_idx" ON "listings" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "listings_description_trgm_idx" ON "listings" USING gin ("description" gin_trgm_ops);