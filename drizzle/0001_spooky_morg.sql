CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "companies" ALTER COLUMN "color_hex" SET DEFAULT '#3B6EF6';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" text DEFAULT 'content_creator' NOT NULL;