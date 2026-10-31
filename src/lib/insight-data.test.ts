import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { createRequire } from "node:module";
import { RequestCookies } from "next/dist/compiled/@edge-runtime/cookies";
import { RequestCookiesAdapter } from "next/dist/server/web/spec-extension/adapters/request-cookies";
import { mkdir, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { createTestDatabase } from "../db/test-database";
import type { Pool } from "pg";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PathnameContext, SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { Nav } from "../components/nav";

function renderPage(page: ReactNode, pathname = "/", searchParams = new URLSearchParams()) {
  const noop = () => {};
  return renderToStaticMarkup(createElement(AppRouterContext.Provider, {
    value: { push: noop, replace: noop, refresh: noop, back: noop, forward: noop, prefetch: noop },
  }, createElement(PathnameContext.Provider, { value: pathname },
    createElement(SearchParamsContext.Provider, { value: searchParams }, page))));
}

test("analytics uses tiles on overview and one scoped navigation row inside a section", async () => {
  const overview = renderPage(createElement(Nav), "/analytics");
  assert.doesNotMatch(overview, /aria-label="Analytics sections"|href="\/analytics\/pairings/);
  for (const route of ["/analytics/pairings", "/analytics/suggest", "/analytics/counter"]) {
    const section = renderPage(createElement(Nav, { scope: "all" }), route, new URLSearchParams("scope=all"));
    assert.equal((section.match(/aria-label="Analytics sections"/g) ?? []).length, 1);
    assert.match(section, /href="\/analytics\?scope=all"[^>]*>Overview/);
    assert.match(section, /href="\/analytics\/suggest\?scope=all"/);
    assert.match(section, /href="\/analytics\/counter\?scope=all"/);
    const activeLink = [...section.matchAll(/<a\b[^>]*>/g)].find(([tag]) => tag.includes(`href="${route}?scope=all"`))?.[0];
    assert.ok(activeLink);
    assert.match(activeLink, /aria-current="page"/);
    assert.doesNotMatch(section, /ANALYSIS &amp; LINEUP TOOLS/);
  }
  for (const route of ["/", "/fixtures", "/players", "/clubs"]) {
    const outside = renderPage(createElement(Nav), route);
    assert.doesNotMatch(outside, /aria-label="Lineup tools"|aria-label="Analytics sections"|href="\/analytics\/suggest"|href="\/analytics\/counter"/);
    assert.match(outside, /href="\/analytics"/);
  }
});

test("live insight loading includes empty fixtures and inactive roster members, rereads edits, and surfaces query failures", async () => {
  let selectedScope = "ndc";
  const nextHeaders = createRequire(import.meta.url)("next/headers") as typeof import("next/headers");
  const cookieMock = mock.method(nextHeaders, "cookies", async () =>
    RequestCookiesAdapter.seal(new RequestCookies(new Headers({ cookie: `convener-data-scope=${selectedScope}` }))));
  const directory = path.resolve(`.insight-test-${randomUUID()}`);
  await mkdir(directory);
  const filename = path.join(directory, "test.db");
  const previousPath = process.env.CONVENER_DB_PATH;
  process.env.CONVENER_DB_PATH = filename;
  const sqlite = await createTestDatabase();
  let applicationDb: Pool | undefined;
  try {
    (await sqlite.exec(`
      INSERT INTO opponent_clubs (id,name) VALUES (1,'Test Away Club'),(15,'Kenya Air Force Golf Club');
      INSERT INTO players (id,name,active,created_at) VALUES
        (1,'Test One',true,'2026-01-01'),(2,'Test Two',true,'2026-01-01'),
        (3,'Test Three',true,'2026-01-01'),(4,'Test Four',false,'2026-01-01');
      INSERT INTO fixtures (id,date,opponent_club_id,home_away,created_at) VALUES
        (1,'2026-01-01',1,'away','2026-01-01'),
        (2,'2026-01-02',1,'home','2026-01-01'),
        (3,'2026-01-03',15,'home','2026-01-01');
      INSERT INTO matches (fixture_id,player1_id,player2_id,opponent1_name,opponent2_name,result) VALUES
        (1,1,2,'Other One','Other Two','win'),
        (1,3,4,'Other Three','Other Four','halved'),
        (3,1,2,'Test Three','Test Four','pending');
    `));
    const { loadInsightData } = await import("./insight-data");
    applicationDb = (await import("../db")).db.$client;
    const initial = await loadInsightData();
    assert.equal(initial.matches.length, 3);
    assert.equal(initial.fixtures.length, 3);
    assert.equal(initial.players.length, 4);
    assert.equal(initial.players.find((player) => player.id === 4)?.active, false);
    assert.equal(initial.fixtures.find((fixture) => fixture.id === 2)?.homeAway, "home");
    assert.equal(initial.matches.find((match) => match.fixtureId === 1)?.homeAway, "away");
    assert.ok(initial.players.every((player) => !("email" in player) && !("phone" in player)));

    const { default: DashboardPage } = await import("../app/page");
    const dashboard = renderPage(await DashboardPage());
    assert.match(dashboard, /Conveners desk/);
    assert.match(dashboard, /NDC only · Internal fixtures excluded/);
    assert.match(dashboard, /No upcoming fixture is recorded/);
    assert.match(dashboard, /href="\/analytics\/leaderboards\?scope=ndc"/);
    assert.match(dashboard, /1 past fixtures without completed results/);
    assert.doesNotMatch(dashboard, /mockups|dashboard-data\.js/);
    selectedScope = "all";
    const allDashboard = renderPage(await DashboardPage());
    assert.match(allDashboard, /All history · Includes internal fixtures/);
    assert.match(allDashboard, /2 past fixtures without completed results/);
    selectedScope = "ndc";

    const { default: LeaderboardsPage } = await import("../app/analytics/leaderboards/page");
    const leaderboard = renderPage(await LeaderboardsPage({
      searchParams: Promise.resolve({ location: "away", min: "1" }),
    }), "/analytics/leaderboards");
    assert.match(leaderboard, /Contribution, not just percentages/);
    assert.match(leaderboard, /4 qualifying players · Away/);
    assert.match(leaderboard, /Test Four/);
    const { default: HomeAwayPage } = await import("../app/analytics/home-away/page");
    const homeAway = renderPage(await HomeAwayPage({ searchParams: Promise.resolve({}) }), "/analytics/home-away");
    assert.match(homeAway, /No players qualify in both locations/);
    const { default: DataQualityPage } = await import("../app/analytics/data-quality/page");
    const quality = renderPage(await DataQualityPage({ searchParams: Promise.resolve({}) }), "/analytics/data-quality");
    assert.match(quality, /Missing match handicaps · 2/);
    assert.match(quality, /Internal pending matches · 1/);
    assert.match(quality, /href="\/fixtures\/1#match-1"/);
    assert.match(quality, /href="\/fixtures\/2"/);

    const remainingPages = await Promise.all([
      import("../app/analytics/page"),
      import("../app/analytics/pairings/page"),
      import("../app/analytics/venues/page"),
      import("../app/analytics/handicaps/page"),
    ]);
    for (const [index, title] of ["Performance &amp; decisions", "Chemistry, with evidence", "Different courses. Different stories", "Balance the squad, not just the numbers"].entries()) {
      const markup = renderPage(await remainingPages[index].default({ searchParams: Promise.resolve({}) }));
      assert.ok(markup.includes(title), `Rendered analytics page ${title}`);
      assert.match(markup, /NDC only · Internal fixtures excluded/);
      assert.doesNotMatch(markup, /aria-label="Analytics sections"/);
      if (index === 0) {
        assert.equal((markup.match(/class="desk-discovery-card /g) ?? []).length, 8);
        assert.doesNotMatch(markup, /Check data quality/);
      }
    }

    const { DashboardClient } = await import("../components/dashboard-client");
    const empty = renderPage(createElement(DashboardClient, {
      data: { ...initial, matches: [] }, scope: "ndc",
    }));
    assert.match(empty, /No completed results in this scope yet/);
    assert.match(empty, /2 past fixtures without completed results/);
    assert.match(empty, /href="\/fixtures\/1"/);
    assert.match(empty, /Roster participation/);

    (await sqlite.prepare(`INSERT INTO matches
      (fixture_id,player1_id,player2_id,opponent1_name,opponent2_name,result)
      VALUES (2,1,2,'Other One','Other Two','loss')`).run());
    (await sqlite.prepare("UPDATE matches SET result='win' WHERE fixture_id=3").run());
    const refreshed = await loadInsightData();
    assert.equal(refreshed.matches.length, 4);
    assert.equal(refreshed.matches.find((match) => match.fixtureId === 3)?.result, "win");
    assert.equal(refreshed.fixtures.length, 3);

    const [{ default: PlayersPage }, { default: PlayerDetailPage }, { default: SuggestPage }, { default: CounterPage }] = await Promise.all([
      import("../app/players/page"), import("../app/players/[id]/page"),
      import("../app/analytics/suggest/page"), import("../app/analytics/counter/page"),
    ]);
    for (const [scope, matchCount, appearances] of [["ndc", 3, 2], ["all", 4, 3]] as const) {
      selectedScope = scope;
      const roster = await PlayersPage();
      assert.equal(roster.props.scope, scope);
      assert.equal(roster.props.players.find((entry: { id: number }) => entry.id === 1).stats.played, appearances);
      const profile = await PlayerDetailPage({ params: Promise.resolve({ id: "1" }) });
      assert.equal(profile.props.scope, scope);
      assert.equal(profile.props.stats.played, appearances);
      assert.equal(profile.props.matchHistory.length, appearances);
      for (const tool of [await SuggestPage(), await CounterPage()]) {
        assert.equal(tool.props.scope, scope);
        assert.equal(tool.props.allMatches.length, matchCount);
      }
      const venuePage = await remainingPages[2].default({ searchParams: Promise.resolve({ scope: scope === "ndc" ? "all" : "ndc" }) });
      assert.equal(venuePage.props.scope, scope, "Stale per-page scope must not override the app setting");
    }
    selectedScope = "ndc";

    (await sqlite.prepare(`INSERT INTO fixtures (id,date,opponent_club_id,home_away,created_at)
      VALUES (4,'9999-12-01',1,'away','2026-01-01')`).run());
    const upcoming = renderPage(await DashboardPage());
    assert.match(upcoming, /9999-12-01/);
    assert.match(upcoming, /href="\/fixtures\/4"/);
    assert.doesNotMatch(upcoming, /No upcoming fixture is recorded/);

    (await sqlite.prepare("UPDATE fixtures SET home_away='unrecognized' WHERE id=4").run());
    await assert.rejects(() => loadInsightData(), /invalid home\/away location/);
    (await sqlite.prepare("UPDATE fixtures SET home_away='away' WHERE id=4").run());
    (await sqlite.exec("ALTER TABLE matches RENAME TO unavailable_matches"));
    await assert.rejects(() => loadInsightData(), /match|load|database|table/i);
    await assert.rejects(() => DashboardPage(), /Unable to load insight matches/);
  } finally {
    cookieMock.mock.restore();
    await applicationDb?.end();
    (await sqlite.close());
    if (previousPath === undefined) delete process.env.CONVENER_DB_PATH;
    else process.env.CONVENER_DB_PATH = previousPath;
    await rm(directory, { recursive: true, force: true });
  }
});
