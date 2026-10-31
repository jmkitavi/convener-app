import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FixturePointsChart } from "../components/fixture-chart";
import type { FixtureEvidence } from "./insights";

function fixture(id: number, overrides: Partial<FixtureEvidence> = {}): FixtureEvidence {
  return {
    id, date: "2026-03-01", homeAway: "home", opponentClubId: 7,
    opponentClubName: `Club ${id}`, venueName: "Home course",
    completed: 15, pending: 0, recorded: 15,
    wins: 8, losses: 7, halved: 0, total: 15, winRate: 0.533,
    weight: 2, rawPoints: 16, availablePoints: 30, teamPoints: 16,
    opponentPoints: 14, provisional: false, future: false, result: "win",
    ...overrides,
  };
}

test("chart alternative excludes pending-only fixtures, sorts dates, and retains exact small-field and provisional evidence", () => {
  const fixtures = [
    fixture(3, { date: "2026-04-01", completed: 1, pending: 1, recorded: 2, provisional: true, result: null, teamPoints: 2, opponentPoints: 0, availablePoints: 2 }),
    fixture(2, { homeAway: "neutral", completed: 4, wins: 2, losses: 2, teamPoints: 4, opponentPoints: 4, availablePoints: 8, result: "draw" }),
    fixture(1, { completed: 0, pending: 2, recorded: 2, teamPoints: 0, availablePoints: 0, result: null }),
    fixture(4, { date: "2026-02-01", teamPoints: 8.18, opponentPoints: 21.82 }),
  ];
  const before = structuredClone(fixtures);
  const html = renderToStaticMarkup(createElement(FixturePointsChart, { fixtures }));
  const body = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? "";
  const rows = [...body.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((match) => match[1]);
  assert.equal(rows.length, 3);
  assert.match(rows[0], /Club 4/);
  assert.match(rows[0], /<td>8\.18<\/td><td>21\.82<\/td>/);
  assert.match(rows[1], /Club 2/);
  assert.match(rows[1], /neutral/);
  assert.match(rows[1], /Drawn/);
  assert.match(rows[1], /<td>8\.00<\/td><td>4<\/td><td>0<\/td><td>4\.00<\/td>/);
  assert.match(rows[2], /Club 3/);
  assert.match(rows[2], /Provisional/);
  assert.doesNotMatch(rows[2], />Won</);
  assert.match(rows[2], /<td>2\.00<\/td><td>1<\/td><td>1<\/td><td>1\.00<\/td>/);
  assert.match(html, /1 fixture without completed matches excluded/);
  assert.deepEqual(fixtures, before);
});

test("pending-only and empty scopes expose no misleading zero-point result", () => {
  for (const fixtures of [[], [fixture(1, { completed: 0, pending: 2, result: null })]]) {
    const html = renderToStaticMarkup(createElement(FixturePointsChart, { fixtures }));
    assert.match(html, /No recorded results in this scope yet/);
    assert.match(html, /<tbody><\/tbody>/);
    assert.doesNotMatch(html, /<td>Won<\/td>/);
  }
});

test("read-only report charts preserve fixture evidence and reference targets without page controls",()=>{
  const html=renderToStaticMarkup(createElement(FixturePointsChart,{
    fixtures:[fixture(1)],readOnly:true,referenceTargetsVisible:true,
  }));
  assert.doesNotMatch(html,/aria-label="Filter fixture points by location"|Show reference targets|Hide reference targets/);
  assert.match(html,/Dashed reference targets: 22 home \/ 16 away/);
  assert.match(html,/<td>16\.00<\/td><td>14\.00<\/td>/);
});
