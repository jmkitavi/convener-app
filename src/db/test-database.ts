import EmbeddedPostgres from "embedded-postgres";
import { Pool } from "pg";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { migratePostgres } from "./postgres-migrate";

export class TestDatabase extends Pool {
  constructor(url: string, private server: EmbeddedPostgres, private directory: string) {
    super({ connectionString: url, max: 5, allowExitOnIdle: true });
  }

  prepare(text: string) {
    let index = 0;
    let sql = text.replace(/\?/g, () => `$${++index}`).replace(/COUNT\(\*\)/gi, "COUNT(*)::integer");
    if (sql.startsWith("INSERT OR REPLACE INTO result_imports")) {
      sql = sql.replace("INSERT OR REPLACE", "INSERT") +
        " ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, data = EXCLUDED.data, source_hash = EXCLUDED.source_hash, expires_at = EXCLUDED.expires_at, created_at = EXCLUDED.created_at";
    }
    return {
      get: async (...values: unknown[]) => (await this.query(sql, values)).rows[0],
      all: async (...values: unknown[]) => (await this.query(sql, values)).rows,
      run: async (...values: unknown[]) => this.query(sql, values),
    };
  }

  async exec(sql: string) { await this.query(sql); }

  async close() {
    await this.end();
    await this.server.stop();
    await rm(this.directory, { recursive: true, force: true });
  }
}

export async function createTestDatabase() {
  const socket = createServer();
  await new Promise<void>(resolve => socket.listen(0, "127.0.0.1", resolve));
  const port = (socket.address() as { port: number }).port;
  await new Promise<void>((resolve, reject) => socket.close(error => error ? reject(error) : resolve()));
  const directory = await mkdtemp(path.join(tmpdir(), "convener-pg-test-"));
  const password = randomUUID();
  const server = new EmbeddedPostgres({
    databaseDir: path.join(directory, "cluster"), user: "postgres", password, port,
    persistent: true, postgresFlags: ["-h", "127.0.0.1", "-k", directory],
    onLog: () => {}, onError: () => {},
  });
  try {
    await server.initialise();
    await server.start();
    await server.createDatabase("convener_test");
    const url = `postgresql://postgres:${password}@127.0.0.1:${port}/convener_test`;
    process.env.DATABASE_URL = url;
    const db = new TestDatabase(url, server, directory);
    await migratePostgres(db);
    return db;
  } catch (error) {
    await server.stop().catch(() => {});
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}
