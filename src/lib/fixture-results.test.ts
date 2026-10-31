import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { createRequire } from "node:module";
import { RequestCookies } from "next/dist/compiled/@edge-runtime/cookies";
import { RequestCookiesAdapter } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createTestDatabase } from "../db/test-database";
import type { Pool } from "pg";
import { renderToStaticMarkup } from "react-dom/server";

test("fixture schedule distinguishes no results, pending-only, partial and recorded results, including draws", async () => {
  let selectedScope = "ndc";
  const nextHeaders = createRequire(import.meta.url)("next/headers") as typeof import("next/headers");
  const cookieMock = mock.method(nextHeaders, "cookies", async () =>
    RequestCookiesAdapter.seal(new RequestCookies(new Headers({ cookie: `convener-data-scope=${selectedScope}` }))));
  const directory = await mkdtemp(path.join(tmpdir(), "convener-fixture-results-"));
  const filename = path.join(directory, "test.db");
  process.env.CONVENER_DB_PATH = filename;
  const sqlite = await createTestDatabase();
  let applicationDb: Pool | undefined;
  try {
    (await sqlite.prepare("INSERT INTO opponent_clubs (id, name) VALUES (1, 'Test Club')").run());
    (await sqlite.prepare("INSERT INTO players (id, name, created_at) VALUES (1, 'Test Player 1', '2026-01-01'), (2, 'Test Player 2', '2026-01-01')").run());
    for (let id = 1; id <= 5; id++) {
      (await sqlite.prepare("INSERT INTO fixtures (id, date, opponent_club_id, home_away, created_at) VALUES (?, ?, 1, 'away', '2026-01-01')")
        .run(id, `2026-01-0${id}`));
    }
    (await sqlite.prepare("UPDATE fixtures SET home_away = 'home' WHERE id = 5").run());
    const insertMatch = sqlite.prepare("INSERT INTO matches (fixture_id, player1_id, player2_id, opponent1_name, opponent2_name, result) VALUES (?, 1, 2, 'Other Player 1', 'Other Player 2', ?)");
    for (const result of ["win", "loss", "halved"]) await insertMatch.run(2, result);
    await insertMatch.run(3, "pending");
    await insertMatch.run(3, "pending");
    await insertMatch.run(4, "win");
    await insertMatch.run(4, "pending");
    await insertMatch.run(5, "halved");

    const { default: FixturesPage } = await import("../app/fixtures/page");
    applicationDb = (await import("../db")).db.$client;
    const html = renderToStaticMarkup(await FixturesPage());
    const cards = new Map([...html.matchAll(/<tr\b[^>]*data-fixture-id="(\d+)"[^>]*>[\s\S]*?<\/tr>/g)]
      .map((match) => [Number(match[1]), match[0]]));
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
    (await sqlite.prepare("INSERT INTO opponent_clubs (id,name) VALUES (15,'Internal club')").run());
    (await sqlite.prepare("UPDATE fixtures SET opponent_club_id=15 WHERE id=2").run());
    const ndc = renderToStaticMarkup(await FixturesPage());
    assert.doesNotMatch(ndc, /data-fixture-id="2"/);
    selectedScope = "all";
    const all = renderToStaticMarkup(await FixturesPage());
    assert.match(all, /data-fixture-id="2"/);
  } finally {
    cookieMock.mock.restore();
    await applicationDb?.end();
    (await sqlite.close());
    await rm(directory, { recursive: true, force: true });
  }
});
