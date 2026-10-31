import assert from "node:assert/strict";
import test from "node:test";
import {
  getCloseLossInsights, getContributionLeaders, getDataQuality, getHandicapInsights,
  getHomeAwayComparisons, getPairingEvidence, getSeasonSummary, isInternalFixture,
  selectInsightData, selectMatchesByScope, type InsightData, type InsightFixture,
} from "./insights";
import type { MatchWithDetails } from "./analytics";

function fixture(id = 1, overrides: Partial<InsightFixture> = {}): InsightFixture {
  return {
    id, date: "2025-01-01", homeAway: "home", opponentClubId: 7,
    opponentClubName: "Visitors", venueName: "Home course", ...overrides,
  };
}

function match(id = 1, overrides: Partial<MatchWithDetails> = {}): MatchWithDetails {
  return {
    id, fixtureId: 1, player1Id: 1, player2Id: 2, player1Name: "Alpha", player2Name: "Beta",
    player1Handicap: 0, player2Handicap: 3, opponent1Handicap: 1, opponent2Handicap: 2,
    opponent1Name: "Visitor A", opponent2Name: "Visitor B", opponent1Id: null, opponent2Id: null,
    opponent1PlayerName: null, opponent2PlayerName: null,
    fixtureDate: "2025-01-01", homeAway: "home", opponentClubId: 7, opponentClubName: "Visitors",
    venueName: "Home course", result: "win", margin: null, matchOrder: id, notes: null,
    ...overrides,
  };
}

function data(matches: MatchWithDetails[] = [], fixtures = [fixture()]): InsightData {
  return {
    matches, fixtures,
    players: [
      { id: 1, name: "Alpha", active: true }, { id: 2, name: "Beta", active: false },
      { id: 3, name: "Gamma", active: true }, { id: 4, name: "Delta", active: true },
    ],
  };
}
const asOf = "2025-02-01";

test("app-wide match scope uses the same internal ID/name rules and preserves historical values", () => {
  const rows = [
    match(1, { player1Handicap: null, player2Handicap: 0 }),
    match(2, { opponentClubId: 15, opponent1Id: 3, result: "pending" }),
    match(3, { opponentClubId: 99, opponentClubName: "Kenya Air Force Golf Club" }),
  ];
  assert.deepEqual(selectMatchesByScope(rows, "ndc").map(row => row.id), [1]);
  assert.deepEqual(selectMatchesByScope(rows, "all"), rows);
  assert.equal(selectMatchesByScope(rows, "ndc")[0].player1Handicap, null);
  assert.equal(selectMatchesByScope(rows, "ndc")[0].player2Handicap, 0);
  assert.equal(rows.length, 3);
});

test("22/17/small fields use full precision for contributions, season sums and scenarios", () => {
  const rows = Array.from({ length: 22 }, (_, i) => match(i + 1, { result: i < 5 ? "win" : i < 7 ? "halved" : "loss" }));
  const input = data(rows);
  const leader = getContributionLeaders(input)[0];
  assert.equal(leader.points, 8.18);
  assert.equal(leader.pointsPerAppearance, (6 * (30 / 22)) / 22);
  assert.equal(getSeasonSummary(input).teamPoints, 8.18);
  assert.equal(getSeasonSummary(input).fixtureRecord.losses, 1);
  const balanced = data(Array.from({ length: 17 }, (_, i) => match(i + 1, { result: i < 7 ? "win" : i < 10 ? "halved" : "loss" })));
  assert.equal(getSeasonSummary(balanced).teamPoints, 15);
  assert.equal(getSeasonSummary(balanced).fixtureRecord.draws, 1);
  assert.equal(getContributionLeaders(balanced)[0].points, 15);
  assert.equal(getSeasonSummary(data(rows.slice(0, 10))).availablePoints, 20);
  const multi = data([
    ...rows,
    ...rows.map((m) => ({ ...m, id: m.id + 100, fixtureId: 2 })),
    ...rows.map((m) => ({ ...m, id: m.id + 200, fixtureId: 3 })),
  ], [fixture(), fixture(2), fixture(3)]);
  assert.equal(getSeasonSummary(multi).teamPoints, 24.54);
  assert.equal(getContributionLeaders(multi)[0].points, 24.55);
  assert.deepEqual(getContributionLeaders({ ...multi, matches: [...multi.matches].reverse() }), getContributionLeaders(multi));
  assert.deepEqual(getPairingEvidence({ ...multi, matches: [...multi.matches].reverse() }), getPairingEvidence(multi));
  assert.equal(getSeasonSummary(data([match()])).teamPoints, 2);
});

test("season and home/away totals sum rounded fixture scores, unlike full-precision player and pair credits", () => {
  const fixtures = [fixture(), fixture(2), fixture(3)];
  const rows = fixtures.flatMap((f) =>
    Array.from({ length: 22 }, (_, i) => match(f.id * 100 + i, {
      fixtureId: f.id, result: i < 5 ? "win" : i < 7 ? "halved" : "loss",
    })));
  const input = data(rows, fixtures);
  const summary = getSeasonSummary(input);
  const roundedRawSeason = Math.round(summary.fixtures.reduce((sum, f) => sum + f.rawPoints, 0) * 100) / 100;
  assert.equal(roundedRawSeason, 24.55);
  assert.equal(summary.teamPoints, 24.54);
  assert.equal(summary.pointsPerRecordedFixture, 24.54 / 3);
  assert.equal(summary.capturePct, (24.54 / 90) * 100);
  assert.equal(getHomeAwayComparisons(input).home.teamPoints, 24.54);
  assert.equal(getContributionLeaders(input)[0].points, 24.55);
  assert.equal(getPairingEvidence(input).pairs[0].pointsTogether, 24.55);
});

test("empty, pending-only, provisional and future inventory retain separate records and queues", () => {
  const input = data([
    match(1, { fixtureId: 2, result: "pending" }),
    match(2, { fixtureId: 3 }),
    match(3, { fixtureId: 3, result: "pending" }),
  ], [fixture(), fixture(2), fixture(3), fixture(4, { date: "2025-03-01" })]);
  const summary = getSeasonSummary(input, { asOf });
  assert.equal(summary.fixtureCount, 4);
  assert.equal(summary.recordedFixtureCount, 1);
  assert.equal(summary.provisionalFixtureCount, 1);
  assert.deepEqual(summary.fixtureRecord, { wins: 0, draws: 0, losses: 0 });
  assert.equal(summary.matchRecord.total, 1);
  assert.equal(summary.pendingMatchCount, 2);
  assert.ok(Math.abs(summary.resultsCoveragePct - 100 / 3) < 1e-12);
  assert.equal(summary.fixtures.find((f) => f.id === 3)!.teamPoints, 2);
  const quality = getDataQuality(input, { asOf: new Date("2025-02-01T10:00:00Z") });
  assert.deepEqual(quality.pastFixturesWithoutResults.map((f) => f.id), [1, 2]);
  assert.deepEqual(quality.emptyPastFixtures.map((f) => f.id), [1]);
  assert.deepEqual(quality.futureFixtures.map((f) => f.id), [4]);
  assert.deepEqual(quality.provisionalFixtures.map((f) => f.id), [3]);
  assert.equal(getSeasonSummary(data([], []), { asOf }).resultsCoveragePct, 0);
  assert.equal(getSeasonSummary(data([match(1, { fixtureId: 4 })], [fixture(4, { date: "2025-03-01" })]), { asOf }).resultsCoveragePct, 0);
});

test("internal classification, both-side effective results and scoped pending preserve team totals", () => {
  const input = data([
    match(),
    match(2, {
      fixtureId: 2, opponentClubId: 15, opponent1Id: 3, opponent2Id: 4,
      opponent1PlayerName: "Gamma", opponent2PlayerName: "Delta", result: "loss",
    }),
    match(3, { fixtureId: 2, opponentClubId: 15, result: "pending" }),
  ], [fixture(), fixture(2, { opponentClubId: 15 })]);
  assert.equal(isInternalFixture({ opponentClubId: 7, opponentClubName: "Kenya Airforce Golf Club" }), true);
  assert.equal(selectInsightData(input).matches.length, 1);
  assert.equal(getContributionLeaders(input, { minAppearances: 2 }).length, 0);
  assert.equal(getContributionLeaders(input, { scope: "all", minAppearances: 2 }).length, 2);
  const leaders = getContributionLeaders(input, { scope: "all", minAppearances: 1 });
  assert.equal(leaders.find((p) => p.playerId === 3)!.wins, 1);
  assert.equal(leaders.find((p) => p.playerId === 3)!.points, 2);
  assert.equal(leaders.find((p) => p.playerId === 1)!.losses, 1);
  assert.equal(getSeasonSummary(input, { scope: "all" }).teamPoints, 2);
  assert.equal(getSeasonSummary(input, { scope: "all" }).matchRecord.total, 2);
  assert.equal(getSeasonSummary(input, { scope: "all" }).participantCount, 4);
  const quality = getDataQuality(input, { asOf });
  assert.equal(quality.pendingMatches.length, 0);
  assert.equal(quality.internalPendingMatches.length, 1);
  assert.equal(getDataQuality(input, { scope: "all", asOf }).pendingMatches.length, 1);
  assert.deepEqual(quality.rosterWithoutAppearances.map((p) => p.id), [3, 4]);
  assert.equal(input.players.find((p) => p.id === 3)!.active, true);
  assert.equal(quality.rosterWithoutAppearances.some((p) => p.id === 2), false);
  assert.equal(getDataQuality(input, { location: "away", asOf }).internalPendingMatches.length, 0);
});

test("rankings apply scope/location thresholds before ordering and remain deterministic on ties", () => {
  const rows = [
    match(), match(2), match(3, { fixtureId: 2, homeAway: "away" }),
    match(4, { fixtureId: 2, homeAway: "away", result: "halved" }),
    match(5, { fixtureId: 3, homeAway: "neutral" }),
  ];
  const input = data(rows, [fixture(), fixture(2, { homeAway: "away" }), fixture(3, { homeAway: "neutral" })]);
  assert.equal(getContributionLeaders(input).length, 2);
  assert.equal(getContributionLeaders(input, { location: "home" }).length, 0);
  assert.equal(getContributionLeaders(input, { location: "away" }).length, 0);
  assert.deepEqual(getContributionLeaders(input, { location: "away", minAppearances: 2 }).map((p) => p.playerId), [1, 2]);
  const compare = getHomeAwayComparisons(input);
  assert.equal(compare.players.length, 2);
  assert.equal(compare.players[0].home.played, 2);
  assert.equal(compare.players[0].away.played, 2);
  assert.equal(compare.players[0].away.yield, 0.75);
  assert.equal(compare.players[0].homeEdge, 0.25);
  assert.equal(compare.home.teamPoints, 4);
  assert.equal(compare.away.teamPoints, 3);
  assert.equal(getHomeAwayComparisons(input, { minAppearances: 3 }).players.length, 0);
  assert.deepEqual(getHomeAwayComparisons(input, { sort: "home-edge" }).players.map((p) => p.playerId), [1, 2]);
  assert.deepEqual(getContributionLeaders({ ...input, matches: [...rows].reverse() }).map((p) => p.playerId), [1, 2]);
});

test("pair evidence uses scoped team yield, three equivalent matches and unique repeated-match coverage", () => {
  const input = data([
    match(), match(2, { result: "halved" }),
    match(3, { player1Id: 3, player2Id: 4, player1Name: "Gamma", player2Name: "Delta", result: "loss" }),
    match(4, { result: "pending" }),
  ]);
  const evidence = getPairingEvidence(input);
  assert.equal(evidence.teamYield, 0.5);
  assert.equal(evidence.uniquePairCount, 2);
  assert.equal(evidence.repeatedPairCount, 1);
  assert.equal(evidence.repeatedMatchCoverage, 2 / 3);
  const pair = evidence.pairs.find((p) => p.player1Id === 1)!;
  assert.equal(pair.played, 2);
  assert.equal(pair.pointsTogether, 3);
  assert.equal(pair.rawYield, 0.75);
  assert.equal(pair.adjustedYield, (1.5 + 3 * 0.5) / 5);
  const internal = data([
    match(1, { opponentClubId: 15, opponent1Id: 3, opponent2Id: 4 }),
    match(2, { opponentClubId: 15, opponent1Id: 4, opponent2Id: 3, result: "halved" }),
  ], [fixture(1, { opponentClubId: 15 })]);
  const both = getPairingEvidence(internal, { scope: "all" });
  assert.equal(both.repeatedPairCount, 2);
  assert.equal(both.repeatedMatchCount, 2);
  assert.equal(both.repeatedMatchCoverage, 1);
  assert.equal(both.pairs.find((p) => p.player1Id === 3)!.rawYield, 0.25);
  assert.equal(getPairingEvidence(internal).pairs.length, 0);
});

test("handicap insights have continuous decimal buckets, complete-only means, valid zero and nullable empty means", () => {
  const differences = [-0.1, 0, 0.1, 3, 3.1, 6, 6.1, 9.9, 10, 10.1];
  const rows = differences.map((diff, i) => match(i + 1, {
    player1Handicap: diff, player2Handicap: 0, opponent1Handicap: 0, opponent2Handicap: 0,
  }));
  rows.push(match(20, { player1Handicap: null }));
  rows.push(match(21, { result: "pending" }));
  rows.push(match(22, { player1Handicap: 0.1, player2Handicap: 0.2, opponent1Handicap: 0.3, opponent2Handicap: 0 }));
  const result = getHandicapInsights(data(rows));
  assert.equal(result.completedCount, 12);
  assert.equal(result.completeCount, 11);
  assert.equal(result.excludedCount, 1);
  assert.deepEqual(result.buckets.map((b) => b.played), [1, 4, 2, 2, 2]);
  assert.equal(result.buckets.reduce((sum, b) => sum + b.played, 0), 11);
  assert.ok(Math.abs(result.meanDifference! - differences.reduce((sum, diff) => sum + diff, 0) / 11) < 1e-12);
  assert.equal(result.byLocation.find((r) => r.location === "away")!.meanTeamCombined, null);
  assert.equal(getHandicapInsights(data([match(1, { player1Handicap: null })])).meanDifference, null);
  assert.equal(getDataQuality(data(rows)).incompleteHandicaps.length, 1);
});

test("close margins include only completed losses; scenarios use each fixture's full weight", () => {
  const rows = Array.from({ length: 22 }, (_, i) => match(i + 1, {
    result: "loss", margin: i === 0 ? "1 up" : i === 1 ? "2UP" : i === 2 ? "2 & 1" : i === 3 ? null : "3&2",
  }));
  rows.push(match(23, { fixtureId: 2, result: "loss", margin: "1UP" }));
  rows.push(match(24, { fixtureId: 2, result: "pending", margin: "1UP" }));
  rows.push(match(25, { fixtureId: 2, result: "win", margin: "1UP" }));
  const result = getCloseLossInsights(data(rows, [fixture(), fixture(2)]));
  assert.equal(result.lossCount, 23);
  assert.equal(result.closeLossCount, 4);
  assert.equal(result.oneUpLossCount, 2);
  assert.equal(result.excludedMarginCount, 1);
  assert.equal(result.hypotheticalExtraPoints, 1.68);
  assert.equal(getCloseLossInsights(data(rows.slice(0, 10))).hypotheticalExtraPoints, 1);
  assert.equal(getCloseLossInsights(data([])).hypotheticalExtraPoints, 0);
});
