import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AnalyticsQuality } from "@/components/analytics-quality";
import type { InsightData } from "@/lib/insights";

const data: InsightData = {
  fixtures: [{
    id: 1, date: "2025-01-01", homeAway: "home", opponentClubId: 7,
    opponentClubName: "Visitors", venueName: "Home course",
  }],
  players: [{ id: 3, name: "No appearances", active: true }],
  matches: [{
    id: 1, fixtureId: 1, matchOrder: 1, fixtureDate: "2025-01-01",
    homeAway: "home", opponentClubId: 7, opponentClubName: "Visitors", venueName: "Home course",
    player1Id: 1, player2Id: 2, player1Name: "Known zero", player2Name: "Missing index",
    player1Handicap: 0, player2Handicap: null, opponent1Handicap: 1, opponent2Handicap: 2,
    opponent1Name: "Visitor A", opponent2Name: "Visitor B", opponent1Id: null, opponent2Id: null,
    opponent1PlayerName: null, opponent2PlayerName: null, result: "win", margin: null, notes: null,
  }],
};

test("quality queue filters retain scoped correction actions and exclude unrelated queues", () => {
  const handicaps = renderToStaticMarkup(createElement(AnalyticsQuality, {
    data, scope: "ndc", asOf: "2025-02-01", queue: "handicaps",
  }));
  assert.match(handicaps, /name="scope" value="ndc"/);
  assert.match(handicaps, /value="handicaps" selected=""/);
  assert.match(handicaps, /Missing match handicaps · 1/);
  assert.match(handicaps, /href="\/fixtures\/1#match-1"/);
  assert.match(handicaps, /<td[^>]*>Missing index<\/td>/);
  assert.doesNotMatch(handicaps, /Past fixtures without completed results ·|Roster without scoped appearances ·/);

  const results = renderToStaticMarkup(createElement(AnalyticsQuality, {
    data, scope: "all", asOf: "2025-02-01", queue: "results",
  }));
  assert.match(results, /name="scope" value="all"/);
  assert.match(results, /No partially completed scorecards in this scope/);
  assert.doesNotMatch(results, /Missing match handicaps ·|Roster without scoped appearances ·/);

  const roster = renderToStaticMarkup(createElement(AnalyticsQuality, {
    data, scope: "ndc", asOf: "2025-02-01", queue: "roster",
  }));
  assert.match(roster, /href="\/players\/3"/);
  assert.doesNotMatch(roster, /Missing match handicaps ·|Past fixtures without completed results ·/);
});
