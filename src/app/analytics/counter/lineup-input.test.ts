import assert from "node:assert/strict";
import test from "node:test";
import { completeOpponentPairs, moveOpponentRow, type OpponentRow } from "./lineup-input";
import { suggestCounterPairings, suggestPairings } from "@/lib/pairing-engine";

function row(name: string, handicap = "0"): OpponentRow {
  return { opp1Name: name, opp1Handicap: handicap, opp2Name: " Partner ", opp2Handicap: "-1.5", isRedMatch: true };
}

test("complete pairs retain zero and plus handicaps but exclude incomplete or non-finite rows", () => {
  const rows = [row(" Zero "), row("Decimal", "12.4"), row("Missing", ""), row("Infinity", "Infinity"), row("Malformed", "12oops"), row(" ", "7")];
  const before = structuredClone(rows);
  assert.deepEqual(completeOpponentPairs(rows), [
    { opp1Name: "Zero", opp1Handicap: 0, opp2Name: "Partner", opp2Handicap: -1.5, isRedMatch: true },
    { opp1Name: "Decimal", opp1Handicap: 12.4, opp2Name: "Partner", opp2Handicap: -1.5, isRedMatch: true },
  ]);
  assert.deepEqual(rows, before);
});

test("manual order changes move the entire opponent pair without mutating entries", () => {
  const rows = [row("First", "3"), { ...row("Second", "10"), isRedMatch: false }, row("Third", "18")];
  const before = structuredClone(rows);
  const reordered = moveOpponentRow(rows, 1, -1);
  assert.deepEqual(reordered, [rows[1], rows[0], rows[2]]);
  assert.deepEqual(completeOpponentPairs(reordered).map((pair) => [pair.opp1Name, pair.opp1Handicap, pair.isRedMatch]), [["Second", 10, false], ["First", 3, true], ["Third", 18, true]]);
  assert.deepEqual(rows, before);
  assert.deepEqual(moveOpponentRow(reordered, 0, 1), rows);
  assert.deepEqual(moveOpponentRow(rows, 0, -1), rows);
  assert.deepEqual(moveOpponentRow(rows, 2, 1), rows);
});

test("reordered opponent inputs still use engine scores, red caps and an odd candidate pool", () => {
  const opponents = completeOpponentPairs(moveOpponentRow([row("Red", "18"), { ...row("Regular", "9"), isRedMatch: false }], 1, -1));
  const players = [0, 7, 12, 16, 24].map((handicap, index) => ({ id: index + 1, name: `Player ${index + 1}`, handicap }));
  const before = structuredClone(players);
  const result = suggestCounterPairings(opponents, players, []);
  assert.equal(result.matchups.length, 2);
  assert.equal(result.unpairedPlayers.length, 1);
  for (const matchup of result.matchups) {
    assert.equal(matchup.opponent.opp1Name, opponents[matchup.matchNumber - 1].opp1Name);
    assert.equal(matchup.strokeAnalysis.maxStrokes, matchup.opponent.isRedMatch ? 4 : 8);
    assert.ok(Number.isFinite(matchup.score));
  }
  const assignedIds = result.matchups.flatMap((matchup) => [matchup.ourPlayer1.id, matchup.ourPlayer2.id]);
  assert.equal(new Set(assignedIds).size, 4);
  assert.deepEqual(players, before);
  assert.ok(suggestPairings(players.slice(0, 3), []).length > 0);
});
