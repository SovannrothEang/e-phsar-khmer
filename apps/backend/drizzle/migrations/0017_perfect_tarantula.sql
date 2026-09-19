CREATE TABLE IF NOT EXISTS "chat"."user_e2e_identities" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"identity_key" text NOT NULL,
	"registration_id" integer NOT NULL,
	"signed_prekey_id" integer NOT NULL,
	"signed_prekey_public" text NOT NULL,
	"signed_prekey_signature" text NOT NULL,
	"signed_prekey_created_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat"."user_e2e_one_time_prekeys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"prekey_id" integer NOT NULL,
	"public_key" text NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat"."messages" DROP CONSTRAINT "messages_body_length_max";--> statement-breakpoint
ALTER TABLE "chat"."messages" ADD COLUMN "is_e2e" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "chat"."messages" ADD COLUMN "e2e_header" jsonb;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat"."user_e2e_identities" ADD CONSTRAINT "user_e2e_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat"."user_e2e_one_time_prekeys" ADD CONSTRAINT "user_e2e_one_time_prekeys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_e2e_otp_user_prekey_uq" ON "chat"."user_e2e_one_time_prekeys" USING btree ("user_id","prekey_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_e2e_otp_available_idx" ON "chat"."user_e2e_one_time_prekeys" USING btree ("user_id") WHERE used_at is null;--> statement-breakpoint
ALTER TABLE "chat"."messages" ADD CONSTRAINT "messages_body_length_max" CHECK (char_length(body) <= 24000);