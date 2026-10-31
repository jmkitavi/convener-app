import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { Pool } from "pg";
import { rows, transaction, requireDatabaseUrl } from "./connection";
import { migratePostgres } from "./postgres-migrate";

export const transferTables = ["players", "opponent_clubs", "fixtures", "matches", "result_imports", "opponent_lineups", "opponent_lineup_pairs"] as const;
const booleans: Record<string, string[]> = { players: ["active"], opponent_lineup_pairs: ["is_red_match"] };
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;

export async function transferSqlite(source: Database.Database, destination: Pool) {
  if (source.pragma("integrity_check", { simple: true }) !== "ok" || (source.pragma("foreign_key_check") as unknown[]).length) {
    throw new Error("SQLite source integrity check failed.");
  }
  const snapshot = source.transaction(() => {
    const data = Object.fromEntries(transferTables.map(table => [table,
      (source.prepare(`SELECT * FROM ${quote(table)} ORDER BY id`).all() as Record<string, unknown>[])
        .map(row => Object.fromEntries(Object.entries(row).map(([key, value]) =>
          [key, booleans[table]?.includes(key) ? Boolean(value) : value]))),
    ])) as Record<typeof transferTables[number], Record<string, unknown>[]>;
    const sequences = source.prepare("SELECT name, seq FROM sqlite_sequence").all() as { name: string; seq: number }[];
    const metadata = source.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all();
    return { data, sequences, metadata };
  })();
  if (snapshot.data.result_imports.some(row => row.status !== "committed")) {
    throw new Error("Uncommitted import sources must be migrated before transferring this snapshot.");
  }
  await migratePostgres(destination);
  return transaction(destination, async connection => {
    await connection.query(`LOCK TABLE ${transferTables.map(quote).join(", ")} IN ACCESS EXCLUSIVE MODE`);
    for (const table of transferTables) {
      if ((await connection.query(`SELECT 1 FROM ${quote(table)} LIMIT 1`)).rows.length) {
        throw new Error("Destination is not empty. Refusing to overwrite hosted data.");
      }
    }
    const counts: Record<string, number> = {};
    for (const table of transferTables) {
      const data = snapshot.data[table];
      const columns = (source.prepare(`PRAGMA table_info(${quote(table)})`).all() as { name: string }[]).map(column => column.name);
      const targetColumns = await rows<{ column_name: string }>(connection,
        "SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1 ORDER BY ordinal_position", [table]);
      if (columns.length !== targetColumns.length || columns.some(column => !targetColumns.some(target => target.column_name === column))) {
        throw new Error(`Schema mismatch in ${table}; no data was imported.`);
      }
      for (const row of data) {
        await connection.query(`INSERT INTO ${quote(table)} (${columns.map(quote).join(", ")}) VALUES (${columns.map((_, index) => `$${index + 1}`).join(", ")})`,
          columns.map(column => row[column]));
      }
      const actual = await rows(connection, `SELECT ${columns.map(quote).join(", ")} FROM ${quote(table)} ORDER BY id`);
      const canonical = (records: Record<string, unknown>[]) => JSON.stringify(records.map(row => columns.map(column => row[column])));
      if (canonical(actual) !== canonical(data)) throw new Error(`Value verification failed in ${table}; import rolled back.`);
      if (table !== "result_imports") {
        const highest = Math.max(0, ...data.map(row => Number(row.id)), snapshot.sequences.find(sequence => sequence.name === table)?.seq ?? 0);
        await connection.query("SELECT setval(pg_get_serial_sequence($1, 'id'), $2, $3)", [table, highest || 1, highest > 0]);
      }
      counts[table] = data.length;
    }
    await connection.query("CREATE TABLE IF NOT EXISTS sqlite_transfer_history (source_hash text PRIMARY KEY, metadata text NOT NULL, transferred_at text NOT NULL)");
    const hash = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
    await connection.query("INSERT INTO sqlite_transfer_history VALUES ($1, $2, $3)",
      [hash, JSON.stringify({ tables: snapshot.metadata, sequences: snapshot.sequences, counts }), new Date().toISOString()]);
    return { counts, hash };
  });
}

if (process.argv[1]?.endsWith("/transfer.ts")) {
  const filename = process.argv[2];
  if (!filename) throw new Error("Pass a WAL-consistent SQLite backup filename.");
  const source = new Database(filename, { readonly: true, fileMustExist: true });
  const destination = new Pool({ connectionString: requireDatabaseUrl("DATABASE_URL_UNPOOLED"), max: 1 });
  transferSqlite(source, destination).then(result => console.log("Verified full data transfer:", JSON.stringify(result.counts)))
    .catch(error => { console.error(error instanceof Error && /Destination is not empty|Schema mismatch|integrity|Uncommitted/.test(error.message)
      ? error.message : "Data transfer failed and was rolled back; credentials and row values were not logged."); process.exitCode = 1; })
    .finally(async () => { source.close(); await destination.end(); });
}
