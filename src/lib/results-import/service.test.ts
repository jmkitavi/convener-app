import assert from "node:assert/strict";
import test from "node:test";
import { createTestDatabase, type TestDatabase } from "../../db/test-database";
import type { Review } from "./contracts";
import { commitReview, prepareReview } from "./service";
async function database() {
  const db = await createTestDatabase();
  (await db.prepare("INSERT INTO opponent_clubs (id, name) VALUES (1, 'Visiting Club'), (2, 'Kenya Airforce Golf Club')").run());
  for (let id = 1; id <= 4; id++) {
    (await db.prepare("INSERT INTO players (id, name, default_handicap, active, created_at) VALUES (?, ?, 18, true, '2026-01-01')").run(id, `Player ${id}`));
  }
  (await db.prepare("INSERT INTO fixtures (id, date, opponent_club_id, home_away, created_at) VALUES (1, '2026-06-14', 1, 'away', '2026-01-01')").run());
  await db.query("SELECT setval('players_id_seq', 4), setval('opponent_clubs_id_seq', 2), setval('fixtures_id_seq', 1)");
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

async function prepare(db: TestDatabase, input = review(), id = "test-draft") {
  const prepared = (await prepareReview(db, input));
  (await db.prepare("INSERT OR REPLACE INTO result_imports (id, status, data, source_hash, expires_at, created_at) VALUES (?, 'prepared', ?, 'synthetic', '2099-01-01', '2026-01-01')")
    .run(id, JSON.stringify({ ...prepared, pageCount: 1, extractionVersion: 1 })));
  return prepared.preview;
}

test("commits once, preserves unknown/zero handicaps and discards transient extracted data", async () => {
  const db = (await database());
  try {
    const preview = (await prepare(db));
    const result = (await commitReview(db, "test-draft", preview.version, []));
    assert.deepEqual(result, { fixtureId: 1, added: 1, updated: 0, unchanged: 0, skipped: 0 });
    const match = (await db.prepare("SELECT * FROM matches").get()) as Record<string, unknown>;
    assert.equal(match.player1_handicap, null);
    assert.equal(match.player2_handicap, 0);
    assert.equal(((await db.prepare("SELECT default_handicap FROM players WHERE id = 1").get()) as { default_handicap: number }).default_handicap, 18);
    assert.equal(((await db.prepare("SELECT default_handicap FROM players WHERE id = 2").get()) as { default_handicap: number }).default_handicap, 0);
    assert.deepEqual((await commitReview(db, "test-draft", preview.version, [])), result);
    assert.equal(((await db.prepare("SELECT COUNT(*) count FROM matches").get()) as { count: number }).count, 1);
    const data = JSON.parse(((await db.prepare("SELECT data FROM result_imports").get()) as { data: string }).data);
    assert.equal(data.review, undefined);
    assert.equal(data.extraction, undefined);
    assert.equal(data.matchLinks[0].matchId, match.id);
  } finally { (await db.close()); }
});

test("conflicting updates require individual approval and retain missing source values", async () => {
  const db = (await database());
  try {
    (await commitReview(db, "test-draft", (await prepare(db)).version, []));
    (await db.prepare("UPDATE matches SET player1_handicap = 9, notes = 'Keep', margin = '2&1'").run());
    const input = review(); input.rows[0].result = "loss"; input.rows[0].margin = null;
    const preview = (await prepare(db, input, "update-draft"));
    assert.equal(preview.rows[0].operation, "update");
    assert.equal(preview.rows[0].after.player1_handicap, 9);
    assert.equal(preview.rows[0].after.notes, "Keep");
    (await assert.rejects(async () => (await commitReview(db, "update-draft", preview.version, [])), /No additions/));
    assert.equal(((await db.prepare("SELECT result FROM matches").get()) as { result: string }).result, "win");
    const result = (await commitReview(db, "update-draft", preview.version, ["row-1"]));
    assert.equal(result.updated, 1);
    assert.equal(((await db.prepare("SELECT result FROM matches").get()) as { result: string }).result, "loss");
  } finally { (await db.close()); }
});

test("rejects stale changes and rolls back entity creation if a row cannot be saved", async () => {
  const db = (await database());
  try {
    (await commitReview(db, "test-draft", (await prepare(db)).version, []));
    const input = review(); input.rows[0].result = "loss";
    const preview = (await prepare(db, input, "stale"));
    (await db.prepare("UPDATE matches SET notes = 'Edited elsewhere'").run());
    (await assert.rejects(async () => (await commitReview(db, "stale", preview.version, ["row-1"])), /changed during review/));
    const fresh = review(); fresh.fixtureId = null; fresh.clubId = null; fresh.newClubName = "New Club";
    fresh.rows[0].players[0] = { id: null, name: "New Player", handicap: null, create: true };
    const rollback = (await prepare(db, fresh, "rollback"));
    await db.exec(`CREATE FUNCTION reject_match() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic failure'; END $$;
      CREATE TRIGGER reject_match BEFORE INSERT ON matches FOR EACH ROW EXECUTE FUNCTION reject_match()`);
    (await assert.rejects(async () => (await commitReview(db, "rollback", rollback.version, [])), /synthetic failure/));
    assert.equal((await db.prepare("SELECT id FROM players WHERE name = 'New Player'").get()), undefined);
    assert.equal((await db.prepare("SELECT id FROM opponent_clubs WHERE name = 'New Club'").get()), undefined);
    assert.equal(((await db.prepare("SELECT status FROM result_imports WHERE id = 'rollback'").get()) as { status: string }).status, "prepared");
  } finally { (await db.close()); }
});

test("supports internal IDs and explicit venue, and prevents duplicate assignments", async () => {
  const db = (await database());
  try {
    const input = review();
    input.fixtureId = null; input.clubId = 2; input.internal = true; input.homeAway = "neutral";
    input.rows[0].opponents = [{ id: 3, name: "Player 3", handicap: null, create: false }, { id: 4, name: "Player 4", handicap: null, create: false }];
    const result = (await commitReview(db, "internal", (await prepare(db, input, "internal")).version, []));
    const match = (await db.prepare("SELECT * FROM matches WHERE fixture_id = ?").get(result.fixtureId)) as Record<string, unknown>;
    assert.equal(match.opponent1_id, 3);
    assert.equal(match.opponent2_id, 4);
    assert.equal(((await db.prepare("SELECT venue_name FROM fixtures WHERE id = ?").get(result.fixtureId)) as { venue_name: string }).venue_name, "Actual Course");
    input.rows[0].opponents[0].id = 1;
    (await assert.rejects(async () => (await prepareReview(db, input)), /more than once/));
  } finally { (await db.close()); }
});

test("recognizes the canonical Air Force club spelling for internal fixtures", async () => {
  const db = (await database());
  try {
    (await db.prepare("UPDATE opponent_clubs SET name = 'Kenya Air Force Golf Club' WHERE id = 2").run());
    const input = review();
    input.fixtureId = null; input.clubId = 2; input.internal = true;
    input.rows[0].opponents = [
      { id: 3, name: "Player 3", handicap: null, create: false },
      { id: 4, name: "Player 4", handicap: null, create: false },
    ];
    (await assert.doesNotReject(async () => (await prepareReview(db, input))));
  } finally { (await db.close()); }
});

test("skips unresolved excluded rows and handles explicit clearing and halved margins", async () => {
  const db = (await database());
  try {
    const input = review();
    input.rows.push({
      ...structuredClone(input.rows[0]), key: "unreadable", selected: false, reviewed: false, result: null,
      players: [{ id: null, name: "", handicap: null, create: false }, { id: null, name: "", handicap: null, create: false }],
    });
    const result = (await commitReview(db, "test-draft", (await prepare(db, input)).version, []));
    assert.equal(result.skipped, 1);
    (await db.prepare("UPDATE matches SET player1_handicap = 12, margin = '2&1'").run());
    const update = review(); update.rows[0].players[0].clearHandicap = true; update.rows[0].result = "halved";
    const preview = (await prepare(db, update, "clear"));
    (await commitReview(db, "clear", preview.version, ["row-1"]));
    const match = (await db.prepare("SELECT player1_handicap, margin FROM matches").get()) as { player1_handicap: number | null; margin: string | null };
    assert.equal(match.player1_handicap, null);
    assert.equal(match.margin, null);
  } finally { (await db.close()); }
});

test("blocks invalid dates, duplicate document rows and unreviewed results", async () => {
  const db = (await database());
  try {
    const input = review(); input.date = "2026-02-31";
    (await assert.rejects(async () => (await prepareReview(db, input))));
    input.date = "2026-06-14"; input.rows[0].reviewed = false;
    (await assert.rejects(async () => (await prepareReview(db, input)), /Review every/));
    input.rows[0].reviewed = true; input.rows.push(structuredClone(input.rows[0]));
    (await assert.rejects(async () => (await prepareReview(db, input)), /Duplicate source/));
  } finally { (await db.close()); }
});

test("concurrent confirmations commit once and another prepared import cannot insert an overlapping match", async () => {
  const db = await database();
  try {
    await db.query("UPDATE fixtures SET venue_name='Actual Course', team_name='Our Team', opponent_team_name='Visitors' WHERE id=1");
    const first = await prepare(db, review(), "first");
    const stale = await prepare(db, review(), "second");
    const results = await Promise.all([
      commitReview(db, "first", first.version, []),
      commitReview(db, "first", first.version, []),
    ]);
    assert.deepEqual(results[0], results[1]);
    assert.equal((await db.query("SELECT count(*)::integer AS count FROM matches")).rows[0].count, 1);
    await assert.rejects(() => commitReview(db, "second", stale.version, []), /Match list changed/);
  } finally { await db.close(); }
});
