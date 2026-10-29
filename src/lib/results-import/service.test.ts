import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { migrateDatabase } from "../../db/migration-helper";
import type { Review } from "./contracts";
import { commitReview, prepareReview } from "./service";

function database() {
  const db = new Database(":memory:");
  migrateDatabase(db);
  db.prepare("INSERT INTO opponent_clubs (id, name) VALUES (1, 'Visiting Club'), (2, 'Kenya Airforce Golf Club')").run();
  for (let id = 1; id <= 4; id++) {
    db.prepare("INSERT INTO players (id, name, default_handicap, active, created_at) VALUES (?, ?, 18, 1, '2026-01-01')").run(id, `Player ${id}`);
  }
  db.prepare("INSERT INTO fixtures (id, date, opponent_club_id, home_away, created_at) VALUES (1, '2026-06-14', 1, 'away', '2026-01-01')").run();
  return db;
}

function review(): Review {
  return {
    fixtureId: 1, clubId: 1, newClubName: "", date: "2026-06-14", homeAway: "away",
    venueName: "Actual Course", teamName: "Our Team", opponentTeamName: "Visitors", side: "right",
    internal: false, fixtureConfirmed: true,
    rows: [{
      key: "row-1", page: 1, order: 1, selected: true, reviewed: true,
      players: [{ id: 1, name: "Player 1", handicap: null, create: false }, { id: 2, name: "Player 2", handicap: 0, create: false }],
      opponents: [{ id: null, name: "Opponent A", handicap: null, create: false }, { id: null, name: "Opponent B", handicap: null, create: false }],
      result: "win", margin: "2&1", notes: "", matchId: null,
    }],
  };
}

function prepare(db: Database.Database, input = review(), id = "test-draft") {
  const prepared = prepareReview(db, input);
  db.prepare("INSERT OR REPLACE INTO result_imports (id, status, data, source_hash, expires_at, created_at) VALUES (?, 'prepared', ?, 'synthetic', '2099-01-01', '2026-01-01')")
    .run(id, JSON.stringify({ ...prepared, pageCount: 1, extractionVersion: 1 }));
  return prepared.preview;
}

test("commits once, preserves unknown/zero handicaps and discards transient extracted data", () => {
  const db = database();
  try {
    const preview = prepare(db);
    const result = commitReview(db, "test-draft", preview.version, []);
    assert.deepEqual(result, { fixtureId: 1, added: 1, updated: 0, unchanged: 0, skipped: 0 });
    const match = db.prepare("SELECT * FROM matches").get() as Record<string, unknown>;
    assert.equal(match.player1_handicap, null);
    assert.equal(match.player2_handicap, 0);
    assert.equal((db.prepare("SELECT default_handicap FROM players WHERE id = 1").get() as { default_handicap: number }).default_handicap, 18);
    assert.equal((db.prepare("SELECT default_handicap FROM players WHERE id = 2").get() as { default_handicap: number }).default_handicap, 0);
    assert.deepEqual(commitReview(db, "test-draft", preview.version, []), result);
    assert.equal((db.prepare("SELECT COUNT(*) count FROM matches").get() as { count: number }).count, 1);
    const data = JSON.parse((db.prepare("SELECT data FROM result_imports").get() as { data: string }).data);
    assert.equal(data.review, undefined);
    assert.equal(data.extraction, undefined);
    assert.equal(data.matchLinks[0].matchId, match.id);
  } finally { db.close(); }
});

test("conflicting updates require individual approval and retain missing source values", () => {
  const db = database();
  try {
    commitReview(db, "test-draft", prepare(db).version, []);
    db.prepare("UPDATE matches SET player1_handicap = 9, notes = 'Keep', margin = '2&1'").run();
    const input = review(); input.rows[0].result = "loss"; input.rows[0].margin = null;
    const preview = prepare(db, input, "update-draft");
    assert.equal(preview.rows[0].operation, "update");
    assert.equal(preview.rows[0].after.player1_handicap, 9);
    assert.equal(preview.rows[0].after.notes, "Keep");
    assert.throws(() => commitReview(db, "update-draft", preview.version, []), /No additions/);
    assert.equal((db.prepare("SELECT result FROM matches").get() as { result: string }).result, "win");
    const result = commitReview(db, "update-draft", preview.version, ["row-1"]);
    assert.equal(result.updated, 1);
    assert.equal((db.prepare("SELECT result FROM matches").get() as { result: string }).result, "loss");
  } finally { db.close(); }
});

test("rejects stale changes and rolls back entity creation if a row cannot be saved", () => {
  const db = database();
  try {
    commitReview(db, "test-draft", prepare(db).version, []);
    const input = review(); input.rows[0].result = "loss";
    const preview = prepare(db, input, "stale");
    db.prepare("UPDATE matches SET notes = 'Edited elsewhere'").run();
    assert.throws(() => commitReview(db, "stale", preview.version, ["row-1"]), /changed during review/);
    const fresh = review(); fresh.fixtureId = null; fresh.clubId = null; fresh.newClubName = "New Club";
    fresh.rows[0].players[0] = { id: null, name: "New Player", handicap: null, create: true };
    const rollback = prepare(db, fresh, "rollback");
    db.exec("CREATE TRIGGER reject_match BEFORE INSERT ON matches BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END");
    assert.throws(() => commitReview(db, "rollback", rollback.version, []), /synthetic failure/);
    assert.equal(db.prepare("SELECT id FROM players WHERE name = 'New Player'").get(), undefined);
    assert.equal(db.prepare("SELECT id FROM opponent_clubs WHERE name = 'New Club'").get(), undefined);
    assert.equal((db.prepare("SELECT status FROM result_imports WHERE id = 'rollback'").get() as { status: string }).status, "prepared");
  } finally { db.close(); }
});

test("supports internal IDs and explicit venue, and prevents duplicate assignments", () => {
  const db = database();
  try {
    const input = review();
    input.fixtureId = null; input.clubId = 2; input.internal = true; input.homeAway = "neutral";
    input.rows[0].opponents = [{ id: 3, name: "Player 3", handicap: null, create: false }, { id: 4, name: "Player 4", handicap: null, create: false }];
    const result = commitReview(db, "internal", prepare(db, input, "internal").version, []);
    const match = db.prepare("SELECT * FROM matches WHERE fixture_id = ?").get(result.fixtureId) as Record<string, unknown>;
    assert.equal(match.opponent1_id, 3);
    assert.equal(match.opponent2_id, 4);
    assert.equal((db.prepare("SELECT venue_name FROM fixtures WHERE id = ?").get(result.fixtureId) as { venue_name: string }).venue_name, "Actual Course");
    input.rows[0].opponents[0].id = 1;
    assert.throws(() => prepareReview(db, input), /more than once/);
  } finally { db.close(); }
});

test("recognizes the canonical Air Force club spelling for internal fixtures", () => {
  const db = database();
  try {
    db.prepare("UPDATE opponent_clubs SET name = 'Kenya Air Force Golf Club' WHERE id = 2").run();
    const input = review();
    input.fixtureId = null; input.clubId = 2; input.internal = true;
    input.rows[0].opponents = [
      { id: 3, name: "Player 3", handicap: null, create: false },
      { id: 4, name: "Player 4", handicap: null, create: false },
    ];
    assert.doesNotThrow(() => prepareReview(db, input));
  } finally { db.close(); }
});

test("skips unresolved excluded rows and handles explicit clearing and halved margins", () => {
  const db = database();
  try {
    const input = review();
    input.rows.push({
      ...structuredClone(input.rows[0]), key: "unreadable", selected: false, reviewed: false, result: null,
      players: [{ id: null, name: "", handicap: null, create: false }, { id: null, name: "", handicap: null, create: false }],
    });
    const result = commitReview(db, "test-draft", prepare(db, input).version, []);
    assert.equal(result.skipped, 1);
    db.prepare("UPDATE matches SET player1_handicap = 12, margin = '2&1'").run();
    const update = review(); update.rows[0].players[0].clearHandicap = true; update.rows[0].result = "halved";
    const preview = prepare(db, update, "clear");
    commitReview(db, "clear", preview.version, ["row-1"]);
    const match = db.prepare("SELECT player1_handicap, margin FROM matches").get() as { player1_handicap: number | null; margin: string | null };
    assert.equal(match.player1_handicap, null);
    assert.equal(match.margin, null);
  } finally { db.close(); }
});

test("blocks invalid dates, duplicate document rows and unreviewed results", () => {
  const db = database();
  try {
    const input = review(); input.date = "2026-02-31";
    assert.throws(() => prepareReview(db, input));
    input.date = "2026-06-14"; input.rows[0].reviewed = false;
    assert.throws(() => prepareReview(db, input), /Review every/);
    input.rows[0].reviewed = true; input.rows.push(structuredClone(input.rows[0]));
    assert.throws(() => prepareReview(db, input), /Duplicate source/);
  } finally { db.close(); }
});
