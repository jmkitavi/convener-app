import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

const migrationIds = ["0000_zippy_prima.sql", "0001_results_import_compatibility.sql"];

function columns(sqlite: Database.Database, table: string) {
  return sqlite.prepare(`PRAGMA table_info("${table}")`).all() as {
    name: string;
    notnull: number;
  }[];
}

function addColumn(sqlite: Database.Database, table: string, name: string, definition: string) {
  if (!columns(sqlite, table).some((column) => column.name === name)) {
    sqlite.exec(`ALTER TABLE "${table}" ADD COLUMN "${name}" ${definition}`);
  }
}

/** Reconcile legacy databases and apply tracked migrations without reseeding data. */
export function migrateDatabase(sqlite: Database.Database): void {
  if (sqlite.inTransaction) throw new Error("Migrations must run outside a transaction");
  const hasTracking = sqlite.prepare(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'",
  ).get();
  const applied = new Set(hasTracking
    ? (sqlite.prepare("SELECT id FROM schema_migrations").all() as { id: string }[]).map((row) => row.id)
    : []);
  const pending = migrationIds.filter((id) => !applied.has(id));
  if (pending.length === 0) return;

  // VACUUM INTO creates a consistent, synchronous backup including WAL contents.
  if (sqlite.name && sqlite.name !== ":memory:") {
    sqlite.prepare("VACUUM INTO ?").run(`${sqlite.name}.backup-${randomUUID()}`);
  }

  const foreignKeys = sqlite.pragma("foreign_keys", { simple: true });
  sqlite.pragma("foreign_keys = OFF");
  try {
    sqlite.transaction(() => {
      sqlite.exec("CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY NOT NULL, applied_at TEXT NOT NULL)");
      for (const id of pending) {
        const source = readFileSync(path.join(process.cwd(), "src/db/migrations", id), "utf8");
        if (id === migrationIds[0]) {
          // Existing installations predate tracking; retain their tables and all rows.
          sqlite.exec(source.replace(/CREATE TABLE /g, "CREATE TABLE IF NOT EXISTS "));
        } else {
          addColumn(sqlite, "matches", "opponent1_id", "INTEGER REFERENCES players(id)");
          addColumn(sqlite, "matches", "opponent2_id", "INTEGER REFERENCES players(id)");
          addColumn(sqlite, "fixtures", "venue_name", "TEXT");
          addColumn(sqlite, "fixtures", "team_name", "TEXT");
          addColumn(sqlite, "fixtures", "opponent_team_name", "TEXT");

          const handicapNames = ["player1_handicap", "player2_handicap", "opponent1_handicap", "opponent2_handicap"];
          if (columns(sqlite, "matches").some((column) => handicapNames.includes(column.name) && column.notnull)) {
            const sequence = sqlite.prepare("SELECT seq FROM sqlite_sequence WHERE name = 'matches'").get() as { seq: number } | undefined;
            const original = sqlite.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'matches'").get() as { sql: string };
            const dependentObjects = sqlite.prepare(
              "SELECT sql FROM sqlite_master WHERE tbl_name = 'matches' AND type IN ('index', 'trigger') AND sql IS NOT NULL",
            ).all() as { sql: string }[];
            let replacement = original.sql.replace(
              /^CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(?:"matches"|`matches`|\[matches\]|matches)/i,
              'CREATE TABLE "matches_nullable"',
            );
            for (const name of handicapNames) {
              replacement = replacement.replace(
                new RegExp(`(["\\x60\\[]?${name}["\\x60\\]]?\\s+real)\\s+NOT\\s+NULL`, "ig"),
                "$1",
              );
            }
            const names = columns(sqlite, "matches").map((column) => `"${column.name.replaceAll('"', '""')}"`).join(", ");
            sqlite.exec(replacement);
            sqlite.exec(`INSERT INTO matches_nullable (${names}) SELECT ${names} FROM matches`);
            sqlite.exec('DROP TABLE matches; ALTER TABLE matches_nullable RENAME TO matches');
            if (sequence) {
              sqlite.prepare("UPDATE sqlite_sequence SET seq = MAX(seq, ?) WHERE name = 'matches'").run(sequence.seq);
            }
            for (const object of dependentObjects) sqlite.exec(object.sql);
          }
          sqlite.exec(source);
        }
        sqlite.prepare("INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)").run(id, new Date().toISOString());
      }
      if ((sqlite.pragma("foreign_key_check") as unknown[]).length > 0) {
        throw new Error("Migration aborted: foreign key violations detected");
      }
    })();
  } finally {
    sqlite.pragma(`foreign_keys = ${foreignKeys ? "ON" : "OFF"}`);
  }
}
