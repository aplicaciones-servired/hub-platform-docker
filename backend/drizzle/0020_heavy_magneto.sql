ALTER TABLE "incidents" ADD COLUMN "tecnico_id" uuid;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_tecnico_id_users_id_fk" FOREIGN KEY ("tecnico_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "incidents_tecnico_id_idx" ON "incidents" USING btree ("tecnico_id");--> statement-breakpoint
WITH "unique_technicians" AS (
  SELECT u."id", u."nombre"
  FROM "users" AS u
  WHERE u."rol" = 'tecnico'
    AND u."deleted_at" IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM "users" AS other
      WHERE other."rol" = 'tecnico'
        AND other."deleted_at" IS NULL
        AND other."nombre" = u."nombre"
        AND other."id" <> u."id"
    )
)
UPDATE "incidents" AS i
SET "tecnico_id" = t."id"
FROM "unique_technicians" AS t
WHERE i."tecnico_id" IS NULL AND i."agente" = t."nombre";