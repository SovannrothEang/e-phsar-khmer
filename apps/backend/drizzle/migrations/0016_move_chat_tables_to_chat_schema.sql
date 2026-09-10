CREATE SCHEMA "chat";
--> statement-breakpoint
ALTER TABLE "conversations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "messages" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."conversations" SET SCHEMA "chat";
--> statement-breakpoint
ALTER TABLE "public"."messages" SET SCHEMA "chat";
