import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import Database from "better-sqlite3";
import { migrateDatabase } from "./migration-helper";

function withDatabase(run: (sqlite: Database.Database, directory: string) => void) {
  const directory = path.join(process.cwd(), `.migration-test-${randomUUID()}`);
  mkdirSync(directory);
  const sqlite = new Database(path.join(directory, "test.db"));
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  try {
    run(sqlite, directory);
  } finally {
    sqlite.close();
    rmSync(directory, { recursive: true, force: true });
  }
}

function seedLegacy(sqlite: Database.Database) {
  sqlite.exec(readFileSync(path.join(process.cwd(), "src/db/migrations/0000_zippy_prima.sql"), "utf8"));
  sqlite.exec(`
    INSERT INTO players (id, name, created_at) VALUES (1, 'One', '2020'), (2, 'Two', '2020'), (3, 'Three', '2020'), (4, 'Four', '2020');
    INSERT INTO opponent_clubs (id, name) VALUES (1, 'Kenya Airforce');
    INSERT INTO fixtures (id, date, opponent_club_id, created_at) VALUES (7, '2025-01-01', 1, '2020');
    INSERT INTO matches (id, fixture_id, player1_id, player2_id, player1_handicap, player2_handicap,
      opponent1_name, opponent2_name, opponent1_handicap, opponent2_handicap, result, match_order)
    VALUES (9, 7, 1, 2, 0, -2.5, 'Three', 'Four', 10.1, 54, 'win', 17);
  `);
}

test("fresh file database gains the current schema, nullable handicaps and tracked idempotent migrations", () => {
  withDatabase((sqlite, directory) => {
    migrateDatabase(sqlite);
    const backups = readdirSync(directory).filter((name) => name.includes(".backup-"));
    assert.equal(backups.length, 1);
    sqlite.exec(`
      INSERT INTO players (id, name, created_at) VALUES (1, 'One', '2020'), (2, 'Two', '2020');
      INSERT INTO opponent_clubs (id, name) VALUES (1, 'Club');
      INSERT INTO fixtures (id, date, opponent_club_id, venue_name, team_name, opponent_team_name, created_at)
        VALUES (1, '2025-01-01', 1, 'Limuru', 'Warriors', 'Top Guns', '2020');
      INSERT INTO matches (fixture_id, player1_id, player2_id, opponent1_name, opponent2_name, result)
        VALUES (1, 1, 2, 'A', 'B', 'pending');
      INSERT INTO result_imports (id, status, data, source_hash, expires_at, created_at)
        VALUES ('import', 'review', '{}', 'hash', '2030', '2025');
      INSERT INTO opponent_lineups (id, name, fixture_id, created_at) VALUES (1, 'Lineup', 1, '2025');
      INSERT INTO opponent_lineup_pairs (lineup_id, match_order, opp1_name, opp1_handicap, opp2_name, opp2_handicap)
        VALUES (1, 1, 'A', 0, 'B', 10);
    `);
    assert.deepEqual(sqlite.prepare("SELECT player1_handicap, opponent2_handicap FROM matches").get(), {
      player1_handicap: null, opponent2_handicap: null,
    });
    assert.throws(() => sqlite.exec("UPDATE opponent_lineup_pairs SET opp1_handicap = NULL"), /NOT NULL/);
    migrateDatabase(sqlite);
    assert.equal((sqlite.prepare("SELECT count(*) AS n FROM schema_migrations").get() as { n: number }).n, 2);
    assert.equal(readdirSync(directory).filter((name) => name.includes(".backup-")).length, 1);
    assert.deepEqual(sqlite.pragma("foreign_key_check"), []);
    assert.equal(sqlite.pragma("foreign_keys", { simple: true }), 1);
  });
});

for (const current of [false, true]) {
  test(`populated ${current ? "current untracked" : "initial legacy"} database preserves rows, IDs, indexes, triggers and foreign keys`, () => {
    withDatabase((sqlite, directory) => {
      seedLegacy(sqlite);
      if (current) {
        sqlite.exec(`
          ALTER TABLE matches ADD COLUMN opponent1_id INTEGER REFERENCES players(id);
          ALTER TABLE matches ADD COLUMN opponent2_id INTEGER REFERENCES players(id);
          UPDATE matches SET opponent1_id = 3, opponent2_id = 4;
          CREATE TABLE opponent_lineups (id INTEGER PRIMARY KEY, name TEXT NOT NULL, fixture_id INTEGER REFERENCES fixtures(id), club_id INTEGER REFERENCES opponent_clubs(id), created_at TEXT NOT NULL);
          INSERT INTO opponent_lineups VALUES (3, 'Saved lineup', 7, 1, '2020');
        `);
      }
      sqlite.exec(`
        CREATE INDEX retained_match_index ON matches(fixture_id, match_order);
        CREATE TABLE audit (match_id INTEGER);
        CREATE TRIGGER retained_match_trigger AFTER UPDATE ON matches BEGIN INSERT INTO audit VALUES (new.id); END;
        CREATE TABLE links (match_id INTEGER REFERENCES matches(id));
        INSERT INTO links VALUES (9);
      `);
      const before = sqlite.prepare("SELECT * FROM matches").get() as Record<string, unknown>;
      sqlite.exec("UPDATE sqlite_sequence SET seq = 99 WHERE name = 'matches'");
      migrateDatabase(sqlite);
      const after = sqlite.prepare("SELECT * FROM matches").get() as Record<string, unknown>;
      for (const [key, value] of Object.entries(before)) assert.equal(after[key], value);
      assert.equal(after.opponent1_id, current ? 3 : null);
      assert.equal((sqlite.prepare("SELECT seq FROM sqlite_sequence WHERE name = 'matches'").get() as { seq: number }).seq, 99);
      assert.ok(sqlite.prepare("SELECT 1 FROM sqlite_master WHERE name = 'retained_match_index'").get());
      assert.deepEqual(sqlite.pragma("foreign_key_check"), []);
      assert.throws(() => sqlite.exec("UPDATE matches SET player1_id = 999"), /FOREIGN KEY/);
      assert.throws(() => sqlite.exec("UPDATE matches SET opponent1_id = 999"), /FOREIGN KEY/);
      sqlite.exec("UPDATE matches SET player1_handicap = NULL, opponent2_handicap = NULL WHERE id = 9");
      assert.deepEqual(sqlite.prepare("SELECT match_id FROM audit").all(), [{ match_id: 9 }]);
      if (current) assert.equal((sqlite.prepare("SELECT name FROM opponent_lineups WHERE id = 3").get() as { name: string }).name, "Saved lineup");
      const backupFile = readdirSync(directory).find((name) => name.includes(".backup-"))!;
      const backup = new Database(path.join(directory, backupFile), { readonly: true });
      try {
        assert.deepEqual(backup.prepare("SELECT * FROM matches").get(), before);
      } finally {
        backup.close();
      }
      migrateDatabase(sqlite);
      sqlite.exec("DELETE FROM links; DELETE FROM opponent_lineups; DELETE FROM fixtures WHERE id = 7");
      assert.equal((sqlite.prepare("SELECT count(*) AS n FROM matches").get() as { n: number }).n, 0);
    });
  });
}

test("foreign key violations roll back the entire migration and restore foreign-key enforcement", () => {
  withDatabase((sqlite) => {
    seedLegacy(sqlite);
    sqlite.pragma("foreign_keys = OFF");
    sqlite.exec("UPDATE matches SET player1_id = 999");
    sqlite.pragma("foreign_keys = ON");
    assert.throws(() => migrateDatabase(sqlite), /foreign key violations/);
    assert.equal(sqlite.pragma("foreign_keys", { simple: true }), 1);
    assert.equal(sqlite.prepare("SELECT 1 FROM sqlite_master WHERE name = 'schema_migrations'").get(), undefined);
    assert.equal(sqlite.prepare("SELECT 1 FROM pragma_table_info('fixtures') WHERE name = 'venue_name'").get(), undefined);
    assert.equal((sqlite.prepare("SELECT player1_handicap AS h FROM matches").get() as { h: number }).h, 0);
  });
});
