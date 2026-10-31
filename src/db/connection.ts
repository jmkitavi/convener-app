import type { Pool, PoolClient, QueryResultRow } from "pg";

export type Connection = Pick<Pool | PoolClient, "query">;

export function requireDatabaseUrl(name = "DATABASE_URL") {
  const value = process.env[name];
  if (!value || value === "[SENSITIVE]") throw new Error(`${name} must contain a PostgreSQL connection.`);
  const url = new URL(value);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error(`${name} must contain a PostgreSQL connection.`);
  return value;
}

export async function rows<T extends QueryResultRow>(connection: Connection, text: string, values: unknown[] = []): Promise<T[]> {
  return (await connection.query<T>(text, values)).rows;
}

export async function first<T extends QueryResultRow>(connection: Connection, text: string, values: unknown[] = []): Promise<T | undefined> {
  return (await rows<T>(connection, text, values))[0];
}

export async function transaction<T>(pool: Pool, operation: (connection: PoolClient) => Promise<T>): Promise<T> {
  const connection = await pool.connect();
  try {
    await connection.query("BEGIN");
    const result = await operation(connection);
    await connection.query("COMMIT");
    return result;
  } catch (error) {
    await connection.query("ROLLBACK");
    throw error;
  } finally {
    connection.release();
  }
}
