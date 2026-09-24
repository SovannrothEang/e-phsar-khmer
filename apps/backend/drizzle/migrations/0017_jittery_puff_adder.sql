ALTER TABLE "communes" ADD COLUMN "name_km" varchar(100);--> statement-breakpoint
ALTER TABLE "districts" ADD COLUMN "name_km" varchar(100);--> statement-breakpoint
ALTER TABLE "provinces" ADD COLUMN "name_km" varchar(100);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "communes_district_slug_uq" ON "communes" USING btree ("district_id","slug");