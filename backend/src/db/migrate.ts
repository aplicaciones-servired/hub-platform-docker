import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { env } from "../config/env";
import { logger } from "../lib/logger";
import "dotenv/config";

async function runMigrations() {
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: env.DB_SSL
      ? { rejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED }
      : false,
    connectionTimeoutMillis: 10000,
    query_timeout: 15000,
  });

  const db = drizzle(pool);

  logger.info("Running migrations...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  logger.info("Migrations completed.");

  await pool.end().catch(() => {});
  logger.info("Migrate script done.");
}

runMigrations().catch((err) => {
  const cause = err instanceof Error ? (err as Error & { cause?: unknown }).cause : undefined;
  logger.error("Migration failed", {
    error: err instanceof Error ? err.message : err,
    cause: cause instanceof Error ? cause.message : undefined,
  });
  process.exit(1);
});
