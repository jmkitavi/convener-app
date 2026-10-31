import assert from "node:assert/strict";
import test from "node:test";
import { createTestDatabase } from "../db/test-database";
import { parseMatchHandicap, syncPlayerHandicaps } from "./handicaps";
test("blank historical handicaps remain null, zero is real, and malformed values are rejected", async () => {
  for (const value of [null, "", "   "]) assert.equal(parseMatchHandicap(value), null);
  assert.equal(parseMatchHandicap("0"), 0);
  assert.equal(parseMatchHandicap("-2.5"), -2.5);
  assert.equal(parseMatchHandicap("54"), 54);
  for (const value of ["NaN", "Infinity", "garbage", "55", "-9"]) {
    assert.throws(() => parseMatchHandicap(value), /Handicap/);
  }
});

test("default sync uses the newest known historical value on either side, retaining defaults when none are known", async () => {
  const sqlite = await createTestDatabase();
  try {
    (await sqlite.exec(`
      INSERT INTO players (id, name, default_handicap, created_at) VALUES
        (1, 'One', 18, '2020'), (2, 'Two', 19, '2020'), (3, 'Three', 20, '2020'), (4, 'Four', 21, '2020');
      INSERT INTO opponent_clubs (id, name) VALUES (1, 'Internal');
      INSERT INTO fixtures (id, date, opponent_club_id, created_at) VALUES
        (1, '2025-01-01', 1, '2020'), (2, '2025-02-01', 1, '2020'), (3, '2025-03-01', 1, '2020');
      INSERT INTO matches (fixture_id, player1_id, player2_id, opponent1_id, opponent2_id,
        player1_handicap, player2_handicap, opponent1_handicap, opponent2_handicap, opponent1_name, opponent2_name, result)
      VALUES
        (1, 1, 2, 3, 4, 12, 14, 16, NULL, 'Three', 'Four', 'win'),
        (2, 3, 4, 1, 2, 15, NULL, 0, NULL, 'One', 'Two', 'halved'),
        (3, 1, 2, 3, 4, NULL, NULL, NULL, NULL, 'Three', 'Four', 'loss');
    `));
    (await syncPlayerHandicaps(sqlite, [1, 2, 3, 4]));
    assert.deepEqual((await sqlite.prepare("SELECT default_handicap FROM players ORDER BY id").all()), [
      { default_handicap: 0 }, { default_handicap: 14 }, { default_handicap: 15 }, { default_handicap: 21 },
    ]);
  } finally {
    (await sqlite.close());
  }
});
