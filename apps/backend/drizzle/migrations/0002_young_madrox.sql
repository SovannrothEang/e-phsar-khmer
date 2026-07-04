DROP INDEX IF EXISTS "users_username_normalized_uq";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "username_normalized";