CREATE TABLE IF NOT EXISTS "model_subcategory_links" (
	"model_id" uuid NOT NULL,
	"subcategory_id" uuid NOT NULL,
	CONSTRAINT "model_subcategory_links_model_id_subcategory_id_pk" PRIMARY KEY("model_id","subcategory_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "model_subcategory_links" ADD CONSTRAINT "model_subcategory_links_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "model_subcategory_links" ADD CONSTRAINT "model_subcategory_links_subcategory_id_subcategories_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "public"."subcategories"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "model_subcategory_links_subcategory_id_idx" ON "model_subcategory_links" USING btree ("subcategory_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "model_subcategory_links_model_id_idx" ON "model_subcategory_links" USING btree ("model_id");