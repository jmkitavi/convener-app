import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { renderToStaticMarkup } from "react-dom/server";
import { migrateDatabase } from "../db/migration-helper";

test("fixture cards distinguish no results, pending-only, partial and recorded results, including draws", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "convener-fixture-results-"));
  const filename = path.join(directory, "test.db");
  process.env.CONVENER_DB_PATH = filename;
  const sqlite = new Database(filename);
  let applicationDb: Database.Database | undefined;
  try {
    migrateDatabase(sqlite);
    sqlite.prepare("INSERT INTO opponent_clubs (id, name) VALUES (1, 'Test Club')").run();
    sqlite.prepare("INSERT INTO players (id, name, created_at) VALUES (1, 'Test Player 1', '2026-01-01'), (2, 'Test Player 2', '2026-01-01')").run();
    for (let id = 1; id <= 5; id++) {
      sqlite.prepare("INSERT INTO fixtures (id, date, opponent_club_id, home_away, created_at) VALUES (?, ?, 1, 'away', '2026-01-01')")
        .run(id, `2026-01-0${id}`);
    }
    sqlite.prepare("UPDATE fixtures SET home_away = 'home' WHERE id = 5").run();
    const insertMatch = sqlite.prepare("INSERT INTO matches (fixture_id, player1_id, player2_id, opponent1_name, opponent2_name, result) VALUES (?, 1, 2, 'Other Player 1', 'Other Player 2', ?)");
    for (const result of ["win", "loss", "halved"]) insertMatch.run(2, result);
    insertMatch.run(3, "pending");
    insertMatch.run(3, "pending");
    insertMatch.run(4, "win");
    insertMatch.run(4, "pending");
    insertMatch.run(5, "halved");

    const { default: FixturesPage } = await import("../app/fixtures/page");
    applicationDb = (await import("../db")).db.$client;
    const html = renderToStaticMarkup(await FixturesPage());
    const cards = new Map([...html.matchAll(/<a\b[^>]*href="\/fixtures\/(\d+)"[^>]*>([\s\S]*?)<\/a>/g)]
      .map((match) => [Number(match[1]), match[2]]));
    assert.equal(cards.size, 5);
    assert.match(cards.get(1)!, /No results/);
    assert.match(cards.get(1)!, /border-l-slate-300/);
    assert.doesNotMatch(cards.get(1)!, /pts/);
    assert.match(cards.get(2)!, /Results recorded/);
    assert.match(cards.get(2)!, /border-l-emerald-500/);
    assert.match(cards.get(3)!, /No results/);
    assert.match(cards.get(3)!, /0\/2 results recorded \(2 pending\)/);
    assert.doesNotMatch(cards.get(3)!, /0W-0L-0H|pts/);
    assert.match(cards.get(4)!, /Partial results/);
    assert.match(cards.get(4)!, /border-l-amber-500/);
    assert.match(cards.get(4)!, /1\/2 results recorded \(1 pending\)/);
    assert.match(cards.get(5)!, /Results recorded/);
    assert.match(cards.get(5)!, /Kenya Air Force Golf Club/);
  } finally {
    applicationDb?.close();
    sqlite.close();
    await rm(directory, { recursive: true, force: true });
  }
});
