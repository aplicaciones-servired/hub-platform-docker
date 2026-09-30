ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;--> statement-breakpoint
CREATE INDEX "users_documento_deleted_at_idx" ON "users" ("documento", "deleted_at");--> statement-breakpoint
CREATE INDEX "users_deleted_at_idx" ON "users" ("deleted_at");--> statement-breakpoint
CREATE INDEX "incidents_deleted_at_idx" ON "incidents" ("deleted_at");