CREATE TYPE "public"."payment_transaction_status" AS ENUM('pending', 'processing', 'succeeded', 'failed', 'cancelled', 'expired', 'refund_pending', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."payment_transaction_type" AS ENUM('payment', 'refund', 'capture', 'void');--> statement-breakpoint
CREATE TYPE "public"."payment_attempt_method" AS ENUM('card', 'bank', 'wallet', 'other');--> statement-breakpoint
CREATE TYPE "public"."payment_attempt_status" AS ENUM('pending', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."payment_status_actor_type" AS ENUM('system', 'webhook', 'admin');--> statement-breakpoint
CREATE TYPE "public"."payment_provider_event_status" AS ENUM('received', 'processed', 'ignored', 'failed');--> statement-breakpoint
CREATE TYPE "public"."payment_log_level" AS ENUM('debug', 'info', 'warn', 'error');--> statement-breakpoint
CREATE TYPE "public"."ledger_account_owner_type" AS ENUM('system', 'customer', 'merchant');--> statement-breakpoint
CREATE TYPE "public"."ledger_account_type" AS ENUM('asset', 'liability', 'equity', 'revenue', 'expense');--> statement-breakpoint
CREATE TYPE "public"."ledger_transaction_status" AS ENUM('posted', 'reversed');--> statement-breakpoint
CREATE TYPE "public"."ledger_transaction_type" AS ENUM('payment', 'transfer', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."ledger_entry_type" AS ENUM('debit', 'credit');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"idempotency_key" text,
	"amount" numeric(20, 2) NOT NULL,
	"currency" text NOT NULL,
	"type" "payment_transaction_type" NOT NULL,
	"status" "payment_transaction_status" DEFAULT 'pending' NOT NULL,
	"customer_id" uuid,
	"order_id" uuid,
	"description" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_transaction_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_attempt_id" text,
	"method" "payment_attempt_method" NOT NULL,
	"status" "payment_attempt_status" DEFAULT 'pending' NOT NULL,
	"amount" numeric(20, 2) NOT NULL,
	"currency" text NOT NULL,
	"failure_code" text,
	"failure_message" text,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_transaction_id" uuid NOT NULL,
	"from_status" "payment_transaction_status",
	"to_status" "payment_transaction_status" NOT NULL,
	"actor_type" "payment_status_actor_type" DEFAULT 'system' NOT NULL,
	"actor_id" uuid,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_provider_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_attempt_id" uuid,
	"provider" text NOT NULL,
	"provider_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "payment_provider_event_status" DEFAULT 'received' NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_transaction_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_transaction_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_transaction_id" text,
	"payment_method_type" text,
	"masked_account" text,
	"redirect_url" text,
	"raw_response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_transaction_id" uuid,
	"payment_attempt_id" uuid,
	"level" "payment_log_level" DEFAULT 'info' NOT NULL,
	"message" text NOT NULL,
	"context" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_logs_target_present" CHECK (payment_transaction_id is not null or payment_attempt_id is not null)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ledger_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(60) NOT NULL,
	"name" varchar(150) NOT NULL,
	"account_type" "ledger_account_type" NOT NULL,
	"owner_type" "ledger_account_owner_type" DEFAULT 'system' NOT NULL,
	"owner_id" uuid,
	"currency" varchar(3) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ledger_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_transaction_id" uuid,
	"reference" text NOT NULL,
	"transaction_type" "ledger_transaction_type" NOT NULL,
	"status" "ledger_transaction_status" DEFAULT 'posted' NOT NULL,
	"currency" text NOT NULL,
	"description" text,
	"idempotency_key" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ledger_transaction_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"entry_type" "ledger_entry_type" NOT NULL,
	"amount" numeric(20, 2) NOT NULL,
	"currency" varchar(3) NOT NULL,
	"sequence" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_payment_transaction_id_payment_transactions_id_fk" FOREIGN KEY ("payment_transaction_id") REFERENCES "public"."payment_transactions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_status_history" ADD CONSTRAINT "payment_status_history_payment_transaction_id_payment_transactions_id_fk" FOREIGN KEY ("payment_transaction_id") REFERENCES "public"."payment_transactions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_status_history" ADD CONSTRAINT "payment_status_history_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_provider_events" ADD CONSTRAINT "payment_provider_events_payment_attempt_id_payment_attempts_id_fk" FOREIGN KEY ("payment_attempt_id") REFERENCES "public"."payment_attempts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_transaction_details" ADD CONSTRAINT "payment_transaction_details_payment_transaction_id_payment_transactions_id_fk" FOREIGN KEY ("payment_transaction_id") REFERENCES "public"."payment_transactions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_logs" ADD CONSTRAINT "payment_logs_payment_transaction_id_payment_transactions_id_fk" FOREIGN KEY ("payment_transaction_id") REFERENCES "public"."payment_transactions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payment_logs" ADD CONSTRAINT "payment_logs_payment_attempt_id_payment_attempts_id_fk" FOREIGN KEY ("payment_attempt_id") REFERENCES "public"."payment_attempts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_payment_transaction_id_payment_transactions_id_fk" FOREIGN KEY ("payment_transaction_id") REFERENCES "public"."payment_transactions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_ledger_transaction_id_ledger_transactions_id_fk" FOREIGN KEY ("ledger_transaction_id") REFERENCES "public"."ledger_transactions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_account_id_ledger_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."ledger_accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_transactions_idempotency_key_uq" ON "payment_transactions" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_transactions_customer_idx" ON "payment_transactions" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_transactions_status_idx" ON "payment_transactions" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_attempts_transaction_idx" ON "payment_attempts" USING btree ("payment_transaction_id","attempted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_attempts_provider_attempt_idx" ON "payment_attempts" USING btree ("provider","provider_attempt_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_status_history_transaction_idx" ON "payment_status_history" USING btree ("payment_transaction_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_provider_events_provider_event_uq" ON "payment_provider_events" USING btree ("provider","provider_event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_provider_events_attempt_idx" ON "payment_provider_events" USING btree ("payment_attempt_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_provider_events_status_idx" ON "payment_provider_events" USING btree ("status","received_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_transaction_details_transaction_uq" ON "payment_transaction_details" USING btree ("payment_transaction_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_logs_transaction_idx" ON "payment_logs" USING btree ("payment_transaction_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_logs_attempt_idx" ON "payment_logs" USING btree ("payment_attempt_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ledger_accounts_code_uq" ON "ledger_accounts" USING btree ("code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ledger_accounts_owner_idx" ON "ledger_accounts" USING btree ("owner_type","owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ledger_transactions_payment_transaction_idx" ON "ledger_transactions" USING btree ("payment_transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ledger_transactions_idempotency_key_uq" ON "ledger_transactions" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ledger_entries_transaction_idx" ON "ledger_entries" USING btree ("ledger_transaction_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ledger_entries_account_idx" ON "ledger_entries" USING btree ("account_id","created_at");