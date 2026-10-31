import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { requireDatabaseUrl } from "./connection";

const state = globalThis as typeof globalThis & { convenerPool?: Pool };
export const pool = state.convenerPool ?? new Pool({
  connectionString: requireDatabaseUrl(),
  max: 3,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 10_000,
  allowExitOnIdle: true,
});
if (process.env.NODE_ENV !== "production") state.convenerPool = pool;
pool.on("error", () => console.error("An idle database connection closed; new requests will reconnect."));

export const db = drizzle(pool, { schema });
export type DB = typeof db;
