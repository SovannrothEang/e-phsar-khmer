CREATE TABLE IF NOT EXISTS "chat"."attachments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"uploader_id" uuid NOT NULL,
	"message_id" uuid,
	"object_key" text NOT NULL,
	"kind" varchar(10) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"declared_size" integer NOT NULL,
	"actual_size" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"uploaded_at" timestamp with time zone,
	"attached_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat"."attachments" ADD CONSTRAINT "attachments_uploader_id_users_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "chat"."attachments" ADD CONSTRAINT "attachments_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "chat"."messages"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attachments_message_idx" ON "chat"."attachments" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attachments_orphan_idx" ON "chat"."attachments" USING btree ("created_at") WHERE message_id is null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attachments_uploader_created_idx" ON "chat"."attachments" USING btree ("uploader_id","created_at");