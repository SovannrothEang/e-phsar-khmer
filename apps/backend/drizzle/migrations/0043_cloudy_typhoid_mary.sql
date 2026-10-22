ALTER TABLE "users" ADD COLUMN "discoverable_by_gender" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "discoverable_by_date_of_birth" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "discoverable_by_phone" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "discoverable_by_email" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "discoverable_by_location" boolean DEFAULT true NOT NULL;