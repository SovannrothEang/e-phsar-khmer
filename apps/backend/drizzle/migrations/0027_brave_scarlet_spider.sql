CREATE TABLE IF NOT EXISTS "chat"."message_envelopes" (
	"message_id" uuid NOT NULL,
	"recipient_device_id" uuid NOT NULL,
	"header" jsonb NOT NULL,
	"wrapped_key" text NOT NULL,
	CONSTRAINT "message_envelopes_message_id_recipient_device_id_pk" PRIMARY KEY("message_id","recipient_device_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat"."user_e2e_device_prekeys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"prekey_id" integer NOT NULL,
	"public_key" text NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat"."user_e2e_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"identity_key" text NOT NULL,
	"identity_signing_key" text NOT NULL,
	"registration_id" integer NOT NULL,
	"signed_prekey_id" integer NOT NULL,
	"signed_prekey_public" text NOT NULL,
	"signed_prekey_signature" text NOT NULL,
	"signed_prekey_created_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat"."messages" ADD COLUMN "e2e_version" smallint;--> statement-breakpoint
ALTER TABLE "chat"."messages" ADD COLUMN "sender_device_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat"."message_envelopes" ADD CONSTRAINT "message_envelopes_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "chat"."messages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat"."message_envelopes" ADD CONSTRAINT "message_envelopes_recipient_device_id_user_e2e_devices_id_fk" FOREIGN KEY ("recipient_device_id") REFERENCES "chat"."user_e2e_devices"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat"."user_e2e_device_prekeys" ADD CONSTRAINT "user_e2e_device_prekeys_device_id_user_e2e_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "chat"."user_e2e_devices"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat"."user_e2e_devices" ADD CONSTRAINT "user_e2e_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_e2e_device_prekeys_device_prekey_uq" ON "chat"."user_e2e_device_prekeys" USING btree ("device_id","prekey_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_e2e_device_prekeys_available_idx" ON "chat"."user_e2e_device_prekeys" USING btree ("device_id") WHERE used_at is null;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_e2e_devices_user_identity_uq" ON "chat"."user_e2e_devices" USING btree ("user_id","identity_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_e2e_devices_user_idx" ON "chat"."user_e2e_devices" USING btree ("user_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat"."messages" ADD CONSTRAINT "messages_sender_device_id_user_e2e_devices_id_fk" FOREIGN KEY ("sender_device_id") REFERENCES "chat"."user_e2e_devices"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
-- Backfill (hand-written): every existing E2E message is v1.
UPDATE "chat"."messages" SET "e2e_version" = 1 WHERE "is_e2e" = true AND "e2e_version" IS NULL;--> statement-breakpoint
-- Backfill (hand-written): each v1 identity becomes that user's first device,
-- with the SAME keys (last_seen_at = now(): a 30-day window to come back online) — the browser holding those private keys claims this row
-- by identity key on its next load, so nothing it could decrypt before breaks.
INSERT INTO "chat"."user_e2e_devices" ("user_id", "identity_key", "identity_signing_key", "registration_id", "signed_prekey_id", "signed_prekey_public", "signed_prekey_signature", "signed_prekey_created_at", "last_seen_at")
SELECT "user_id", "identity_key", "identity_signing_key", "registration_id", "signed_prekey_id", "signed_prekey_public", "signed_prekey_signature", "signed_prekey_created_at", now()
FROM "chat"."user_e2e_identities"
ON CONFLICT ("user_id", "identity_key") DO NOTHING;
