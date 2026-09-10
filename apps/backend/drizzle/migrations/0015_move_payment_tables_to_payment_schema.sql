CREATE SCHEMA IF NOT EXISTS "payment";
--> statement-breakpoint
ALTER TYPE "public"."payment_transaction_type" SET SCHEMA "payment";
--> statement-breakpoint
ALTER TYPE "public"."payment_transaction_status" SET SCHEMA "payment";
--> statement-breakpoint
ALTER TYPE "public"."payment_attempt_method" SET SCHEMA "payment";
--> statement-breakpoint
ALTER TYPE "public"."payment_attempt_status" SET SCHEMA "payment";
--> statement-breakpoint
ALTER TYPE "public"."payment_status_actor_type" SET SCHEMA "payment";
--> statement-breakpoint
ALTER TYPE "public"."payment_provider_event_status" SET SCHEMA "payment";
--> statement-breakpoint
ALTER TYPE "public"."payment_log_level" SET SCHEMA "payment";
--> statement-breakpoint
ALTER TYPE "public"."ledger_account_owner_type" SET SCHEMA "payment";
--> statement-breakpoint
ALTER TYPE "public"."ledger_account_type" SET SCHEMA "payment";
--> statement-breakpoint
ALTER TYPE "public"."ledger_transaction_status" SET SCHEMA "payment";
--> statement-breakpoint
ALTER TYPE "public"."ledger_transaction_type" SET SCHEMA "payment";
--> statement-breakpoint
ALTER TYPE "public"."ledger_entry_type" SET SCHEMA "payment";
--> statement-breakpoint
ALTER TABLE "public"."payment_transactions" SET SCHEMA "payment";
--> statement-breakpoint
ALTER TABLE "public"."payment_attempts" SET SCHEMA "payment";
--> statement-breakpoint
ALTER TABLE "public"."payment_status_history" SET SCHEMA "payment";
--> statement-breakpoint
ALTER TABLE "public"."payment_provider_events" SET SCHEMA "payment";
--> statement-breakpoint
ALTER TABLE "public"."payment_transaction_details" SET SCHEMA "payment";
--> statement-breakpoint
ALTER TABLE "public"."payment_logs" SET SCHEMA "payment";
--> statement-breakpoint
ALTER TABLE "public"."ledger_accounts" SET SCHEMA "payment";
--> statement-breakpoint
ALTER TABLE "public"."ledger_transactions" SET SCHEMA "payment";
--> statement-breakpoint
ALTER TABLE "public"."ledger_entries" SET SCHEMA "payment";
