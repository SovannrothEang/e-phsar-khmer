ALTER TABLE "users" DROP CONSTRAINT "users_supabase_user_id_unique";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "supabase_user_id";