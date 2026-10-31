import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "node:path";
import { requireDatabaseUrl } from "./connection";

export async function migratePostgres(pool: Pool) {
  await migrate(drizzle(pool), { migrationsFolder: path.resolve("src/db/postgres-migrations") });
  await pool.query(`CREATE TABLE IF NOT EXISTS import_processing_leases (
    name text PRIMARY KEY, owner text NOT NULL, expires_at timestamptz NOT NULL
  )`);
}

if (process.argv[1]?.endsWith("/postgres-migrate.ts")) {
  const pool = new Pool({ connectionString: requireDatabaseUrl("DATABASE_URL_UNPOOLED"), max: 1 });
  migratePostgres(pool).then(() => console.log("PostgreSQL migrations complete."))
    .catch(() => { console.error("PostgreSQL migration failed; no credentials were logged."); process.exitCode = 1; })
    .finally(() => pool.end());
}
