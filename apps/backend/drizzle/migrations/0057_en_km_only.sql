ALTER TABLE "public"."category_translations" ALTER COLUMN "locale" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "public"."subcategory_translations" ALTER COLUMN "locale" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."locale";--> statement-breakpoint
CREATE TYPE "public"."locale" AS ENUM('en', 'km');--> statement-breakpoint
ALTER TABLE "public"."category_translations" ALTER COLUMN "locale" SET DATA TYPE "public"."locale" USING "locale"::"public"."locale";--> statement-breakpoint
ALTER TABLE "public"."subcategory_translations" ALTER COLUMN "locale" SET DATA TYPE "public"."locale" USING "locale"::"public"."locale";