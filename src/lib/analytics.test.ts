import assert from "node:assert/strict";
import test from "node:test";
import {
  calcFixturePoints,
  effectiveResult,
  getHandicapMatchupStats,
  getPairingStats,
  getPlayerForm,
  getPlayerHandicapTrend,
  getPlayerStats,
  getPlayerVenueStats,
  getRecentFixtureResults,
  getTeamRecord,
  getVenueStats,
  type MatchWithDetails,
} from "./analytics";

test("fixture scores round only final totals and preserve the two-point match cap", () => {
  assert.deepEqual(calcFixturePoints(22, 5, 2), {
    pointsPerMatch: 1.36, teamPoints: 8.18, opponentPoints: 21.82, maxPoints: 30,
  });
  assert.deepEqual(calcFixturePoints(17, 7, 3), {
    pointsPerMatch: 1.76, teamPoints: 15, opponentPoints: 15, maxPoints: 30,
  });
  assert.deepEqual(calcFixturePoints(22, 22, 0), {
    pointsPerMatch: 1.36, teamPoints: 30, opponentPoints: 0, maxPoints: 30,
  });
  assert.deepEqual(calcFixturePoints(10, 4, 2), {
    pointsPerMatch: 2, teamPoints: 10, opponentPoints: 10, maxPoints: 20,
  });
  assert.deepEqual(calcFixturePoints(0, 0, 0), {
    pointsPerMatch: 0, teamPoints: 0, opponentPoints: 0, maxPoints: 0,
  });
});

function match(overrides: Partial<MatchWithDetails> = {}): MatchWithDetails {
  return {
    id: 1, fixtureId: 1,
    player1Id: 1, player2Id: 2, player1Name: "One", player2Name: "Two",
    player1Handicap: null, player2Handicap: null,
    opponent1Name: "Three", opponent2Name: "Four",
    opponent1Handicap: null, opponent2Handicap: null,
    opponent1Id: 3, opponent2Id: 4, opponent1PlayerName: "Three", opponent2PlayerName: "Four",
    result: "win", margin: null, matchOrder: 17, notes: null,
    fixtureDate: "2025-01-01", homeAway: "home", venueName: "Limuru", opponentClubId: 1, opponentClubName: "Kenya Airforce",
    ...overrides,
  };
}

test("unknown handicaps remain in ordinary results, explicit venue records and both sides' histories; pending never counts", () => {
  const results = [
    match(),
    match({ id: 2, result: "halved" }),
    match({ id: 3, result: "pending" }),
  ];
  assert.deepEqual(getTeamRecord(results), { wins: 1, losses: 0, halved: 1, total: 2, winRate: 0.75 });
  assert.equal(getPlayerStats(results, 1).played, 2);
  const opponentStats = getPlayerStats(results, 3);
  assert.equal(opponentStats.played, 2);
  assert.equal(opponentStats.losses, 1);
  assert.equal(opponentStats.halved, 1);
  assert.equal(opponentStats.partners[0].partnerId, 4);
  assert.deepEqual(getVenueStats(results), [{
    venueName: "Limuru", played: 2, wins: 1, losses: 0, halved: 1, winRate: 0.75,
  }]);
  assert.equal(getPlayerVenueStats(results, 3)[0].winRate, 0.25);
  assert.equal(effectiveResult(results[2], 3), "pending");
  const form = getPlayerForm(results, 3);
  assert.equal(form.length, 2);
  assert.equal(form[0].result, "loss");
  assert.equal(form[0].playerHandicap, null);
  assert.equal(form[1].runningWinRate, 0.25);
  const fixture = getRecentFixtureResults([...results, match({ fixtureId: 2, result: "pending" })]);
  assert.equal(fixture.length, 1);
  assert.equal(fixture[0].total, 2);
  assert.equal(fixture[0].teamPoints, 3);
  assert.equal(fixture[0].maxPoints, 4);
});

test("pair means use only known partner pairs as denominator, retain zero and return null with no eligible records", () => {
  const results = [
    match({ player1Handicap: 0, player2Handicap: 10, opponent1Handicap: 5, opponent2Handicap: 15 }),
    match({ id: 2, player1Handicap: null, player2Handicap: 50, result: "loss" }),
    match({ id: 3, player1Handicap: 10, player2Handicap: 10, result: "halved" }),
    match({ id: 4, player1Handicap: 50, player2Handicap: 50, result: "pending" }),
  ];
  const pairings = getPairingStats(results);
  const tracked = pairings.find((pair) => pair.player1Id === 1)!;
  assert.equal(tracked.played, 3);
  assert.equal(tracked.avgCombinedHandicap, 15);
  assert.equal(tracked.handicapExcluded, 1);
  const internalOpponent = pairings.find((pair) => pair.player1Id === 3)!;
  assert.equal(internalOpponent.played, 3);
  assert.equal(internalOpponent.avgCombinedHandicap, 20);
  assert.equal(internalOpponent.handicapExcluded, 2);
  assert.equal(getPairingStats([match()])[0].avgCombinedHandicap, null);
  assert.equal(getPairingStats([match({ player1Handicap: 0, player2Handicap: 0 })])
    .find((pair) => pair.player1Id === 1)!.avgCombinedHandicap, 0);
});

test("differential analysis requires all four handicaps, without dropping those results from ordinary analysis", () => {
  const complete = match({ player1Handicap: 0, player2Handicap: 10, opponent1Handicap: 5, opponent2Handicap: 5 });
  const results = [
    complete,
    ...(["player1Handicap", "player2Handicap", "opponent1Handicap", "opponent2Handicap"] as const)
      .map((key) => ({ ...complete, [key]: null })),
    { ...complete, result: "pending" as const },
  ];
  const buckets = getHandicapMatchupStats(results);
  assert.equal(buckets.reduce((sum, bucket) => sum + bucket.played, 0), 1);
  assert.equal(buckets.find((bucket) => bucket.played === 1)!.wins, 1);
  assert.equal(getTeamRecord(results).total, 5);
});

test("player trends need only that player's known value, preserve zero, flip internal outcomes and exclude pending", () => {
  const results = [
    match({ fixtureDate: "2025-03-01", player1Handicap: 2 }),
    match({ fixtureDate: "2025-01-01", opponent1Id: 1, player1Id: 3, opponent1Handicap: 0 }),
    match({ fixtureDate: "2025-02-01" }),
    match({ player1Handicap: 50, result: "pending" }),
  ];
  assert.deepEqual(getPlayerHandicapTrend(results, 1), [
    { date: "2025-01-01", handicap: 0, result: "loss" },
    { date: "2025-03-01", handicap: 2, result: "win" },
  ]);
  assert.equal(getPlayerStats(results, 1).played, 3);
});

test("handicap buckets cover fractional gaps and normalize exact decimal boundaries", () => {
  const rows = [-2.5, -0.5, 0, 0.5, 3, 3.5, 6, 6.5, 9.5, 10, 10.5].map((diff, i) =>
    match({
      id: i + 1, player1Handicap: diff, player2Handicap: 0,
      opponent1Handicap: 0, opponent2Handicap: 0,
    }));
  rows.push(match({
    id: 20, player1Handicap: 3.1, player2Handicap: 0.2,
    opponent1Handicap: 0.3, opponent2Handicap: 0,
  }));
  const buckets = getHandicapMatchupStats(rows);
  assert.deepEqual(buckets.map((b) => b.label), ["<0", "0–3", ">3–6", ">6–<10", ">=10"]);
  assert.deepEqual(buckets.map((b) => b.played), [2, 4, 2, 2, 2]);
  assert.equal(buckets.reduce((sum, b) => sum + b.played, 0), rows.length);
});
