import Database from "better-sqlite3";
import path from "path";
import { migrateDatabase } from "./migration-helper";

const dbPath = path.join(process.cwd(), "convener.db");

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

try {
  migrateDatabase(sqlite);
  console.log("Migrations complete (pre-migration backups are stored beside the database).");
} finally {
  sqlite.close();
}
