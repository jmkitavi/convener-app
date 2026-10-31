import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import { createTestDatabase } from "./test-database";
import { migrateDatabase } from "./migration-helper";
import { transferSqlite } from "./transfer";

test("full SQLite transfer preserves values, links, notes, booleans and prior identity allocation without overwriting a populated target", async () => {
  const source = new Database(":memory:");
  const target = await createTestDatabase();
  try {
    migrateDatabase(source);
    source.exec(`
      INSERT INTO players(id,name,email,phone,default_handicap,active,created_at) VALUES
        (4,'Synthetic One','private@example.test','synthetic contact',-2.123456789,0,'2026'),
        (8,'Synthetic Two',NULL,NULL,0,1,'2026'),
        (99,'Deleted allocation',NULL,NULL,18,1,'2026');
      DELETE FROM players WHERE id=99;
      INSERT INTO opponent_clubs(id,name,slope_rating) VALUES(5,'Synthetic club',113.123456789);
      INSERT INTO fixtures(id,date,opponent_club_id,notes,created_at) VALUES(6,'2026-06-14',5,'Keep fixture note','2026');
      INSERT INTO matches(id,fixture_id,player1_id,player2_id,player1_handicap,opponent1_name,opponent2_name,result,notes)
        VALUES(7,6,4,8,0,'A','B','halved','Keep ambiguity note');
      INSERT INTO opponent_lineups(id,name,fixture_id,club_id,created_at) VALUES(9,'Saved lineup',6,5,'2026');
      INSERT INTO opponent_lineup_pairs(id,lineup_id,match_order,opp1_name,opp1_handicap,opp2_name,opp2_handicap,is_red_match)
        VALUES(10,9,1,'A',0,'B',18.123456789,1);
      INSERT INTO result_imports VALUES('synthetic-import','committed','{"matchLinks":[{"key":"row","matchId":7}]}','synthetic-hash','2026','2026','{"fixtureId":6}');
    `);
    const result = await transferSqlite(source, target);
    assert.deepEqual(result.counts, { players: 2, opponent_clubs: 1, fixtures: 1, matches: 1, result_imports: 1, opponent_lineups: 1, opponent_lineup_pairs: 1 });
    const player = (await target.query("SELECT * FROM players WHERE id=4")).rows[0];
    assert.equal(player.default_handicap, -2.123456789);
    assert.equal(player.active, false);
    assert.equal(player.phone, "synthetic contact");
    assert.equal((await target.query("SELECT notes FROM matches")).rows[0].notes, "Keep ambiguity note");
    assert.equal((await target.query("SELECT is_red_match FROM opponent_lineup_pairs")).rows[0].is_red_match, true);
    assert.equal((await target.query("INSERT INTO players(name,created_at) VALUES('Next','2026') RETURNING id")).rows[0].id, 100);
    await assert.rejects(() => transferSqlite(source, target), /not empty/);
    assert.equal((await target.query("SELECT count(*)::integer AS count FROM matches")).rows[0].count, 1);
  } finally { source.close(); await target.close(); }
});
