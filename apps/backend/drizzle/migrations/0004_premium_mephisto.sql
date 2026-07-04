ALTER TABLE "users" DROP CONSTRAINT "users_username_unique";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_primary_phone_unique";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_email_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "idempotency_keys_key_method_path_uq";--> statement-breakpoint
DROP INDEX IF EXISTS "listings_status_created_at_idx";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_phones_user_primary_uq" ON "user_phones" USING btree ("user_id") WHERE is_primary = true;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_active_uq" ON "users" USING btree ("username") WHERE deleted_at is null;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_primary_phone_active_uq" ON "users" USING btree ("primary_phone") WHERE deleted_at is null;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_active_uq" ON "users" USING btree ("email") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "listings_commune_id_idx" ON "listings" USING btree ("commune_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "listings_status_created_at_idx" ON "listings" USING btree ("status","created_at","id");--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_key_method_path_user_uq" UNIQUE NULLS NOT DISTINCT("key","method","path","user_id");--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_price_nonnegative" CHECK (price >= 0);--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_discount_value_nonnegative" CHECK (discount_value >= 0);--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_discount_pair" CHECK ((discount_value is null) = (discount_type is null));--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_discount_percent_max" CHECK (discount_type <> 'percent' or discount_value <= 100);