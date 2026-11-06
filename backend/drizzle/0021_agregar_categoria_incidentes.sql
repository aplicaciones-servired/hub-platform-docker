ALTER TABLE "incidents" ADD COLUMN "categoria" varchar(50);--> statement-breakpoint
CREATE INDEX "incidents_categoria_idx" ON "incidents" USING btree ("categoria");