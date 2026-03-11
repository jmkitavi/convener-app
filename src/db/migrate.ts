import Database from "better-sqlite3";
import { readFileSync, readdirSync } from "fs";
import path from "path";

const dbPath = path.join(process.cwd(), "convener.db");
const migrationsDir = path.join(process.cwd(), "src/db/migrations");

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

for (const file of files) {
  console.log(`Running migration: ${file}`);
  const sql = readFileSync(path.join(migrationsDir, file), "utf-8");
  sqlite.exec(sql);
}

console.log("Migrations complete.");
sqlite.close();
