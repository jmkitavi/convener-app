import assert from "node:assert/strict";
import test from "node:test";
import { findDuplicatePlayerAssignments, initialReview, normalizeResult, playerCandidates, resolvePlayer, resolveReviewIdentities, rowConfirmationIssues } from "./normalize";
import type { Extraction, PlayerOption } from "./contracts";

test("interprets score columns from the confirmed team's perspective", () => {
  assert.deepEqual(normalizeResult("5/3", "LOST", "right"), { result: "loss", margin: "5&3" });
  assert.deepEqual(normalizeResult("LOST", "2 UP", "right"), { result: "win", margin: "2UP" });
  assert.deepEqual(normalizeResult(null, "4/3", "left"), { result: "loss", margin: "4&3" });
  assert.deepEqual(normalizeResult("A/S", "A/S", "right"), { result: "halved", margin: null });
  assert.deepEqual(normalizeResult("LOST", null, "right"), { result: "win", margin: null });
});

test("blank, crossed-out, annotated and contradictory results require review", () => {
  for (const [left, right] of [[null, null], ["-", null], ["6/5 **", null], ["3/2", "2/1"], ["A/S", "1UP"], ["4/6", null], ["99UP", null]]) {
    const result = normalizeResult(left, right, "right");
    assert.equal(result.result, null);
    assert.ok(result.warning);
  }
});

test("preserves source foursome ordering and unknown handicaps without applying defaults", () => {
  const players: PlayerOption[] = [{ id: 1, name: "A. Example", defaultHandicap: 18, active: true }];
  const extraction: Extraction = {
    date: "2026-06-14", venue: "Neutral Course", leftTeam: "Warriors", rightTeam: "Top Guns", warnings: [],
    rows: [1, 3, 2].map((order) => ({
      order, page: 1, tee: order === 2 ? "10" : "1", warnings: [],
      left: [{ name: "Opponent A", handicap: null }, { name: "Opponent B", handicap: 0 }],
      right: [{ name: order === 1 ? "A Example" : `Unknown ${order}`, handicap: null }, { name: "Unknown", handicap: null }],
      leftResult: "LOST", rightResult: "1UP",
    })),
  };
  const review = initialReview(extraction, players, "right");
  assert.deepEqual(review.rows.map((row) => row.order), [1, 3, 2]);
  assert.equal(review.rows[0].players[0].id, 1);
  assert.equal(review.rows[0].players[0].handicap, null);
  assert.equal(review.rows[0].opponents[1].handicap, 0);
  assert.equal(review.rows[0].reviewed, false);
});

test("ambiguous initials produce candidates, not an automatic identity", () => {
  const players: PlayerOption[] = [
    { id: 1, name: "A. Smith", defaultHandicap: 10, active: false },
    { id: 2, name: "B. Smith", defaultHandicap: 12, active: true },
  ];
  assert.equal(playerCandidates("Smith", players).length, 2);
});

test("resolves unique full names, initials and reordered names without changing historical handicaps", () => {
  const players: PlayerOption[] = [
    { id: 1, name: "J. Example", defaultHandicap: 18, active: false },
    { id: 2, name: "Anne Sample", defaultHandicap: 12, active: true },
  ];
  assert.equal(resolvePlayer("Joseph Example", players).confidentId, 1);
  assert.equal(resolvePlayer("Example Joseph", players).confidentId, 1);
  assert.equal(resolvePlayer("A. Sample", players).confidentId, 2);
  assert.equal(resolvePlayer("Anne Sámple", players).confidentId, 2);
  assert.equal(resolvePlayer("D Example", players).confidentId, null);
  assert.equal(resolvePlayer("Example", players).confidentId, null);
});

test("ranks likely spelling matches but leaves close, conflicting or missing identities unsure", () => {
  const players: PlayerOption[] = [
    { id: 1, name: "Anne Example", defaultHandicap: 18, active: true },
    { id: 2, name: "Amy Example", defaultHandicap: 12, active: true },
    { id: 3, name: "D. Sample", defaultHandicap: 10, active: false },
  ];
  const ambiguous = resolvePlayer("A Example", players);
  assert.equal(ambiguous.confidentId, null);
  assert.deepEqual(new Set(ambiguous.candidates.slice(0, 2).map((candidate) => candidate.player.id)), new Set([1, 2]));
  const typo = resolvePlayer("D Sampl", players);
  assert.equal(typo.suggestedId, 3);
  assert.equal(typo.confidentId, null);
  assert.equal(resolvePlayer("", players).suggestedId, null);
  assert.equal(resolvePlayer("Unrelated Nobody", players).confidentId, null);
  assert.equal(resolvePlayer("Anne Example", [...players, { ...players[0], id: 4 }]).confidentId, null);
});

test("resolves saved unresolved drafts and internal opponents, preserves manual choices, and avoids duplicate auto-assignments", () => {
  const players: PlayerOption[] = [
    { id: 1, name: "Anne Example", defaultHandicap: 18, active: true },
    { id: 2, name: "Bea Sample", defaultHandicap: 12, active: true },
    { id: 3, name: "Charlie Other", defaultHandicap: 14, active: true },
    { id: 4, name: "Drew Guest", defaultHandicap: 16, active: true },
  ];
  const extraction: Extraction = {
    date: null, venue: null, leftTeam: null, rightTeam: null, warnings: [],
    rows: [{
      order: 1, page: 1, tee: null, warnings: [], leftResult: "A/S", rightResult: null,
      left: [{ name: "C. Other", handicap: null }, { name: "D Guest", handicap: null }],
      right: [{ name: "A Example", handicap: null }, { name: "B Sample", handicap: 0 }],
    }],
  };
  const review = initialReview(extraction, players, "right");
  assert.equal(review.rows[0].players[0].id, 1);
  assert.equal(review.rows[0].players[1].id, 2);
  assert.equal(review.rows[0].players[0].identitySource, "automatic");
  assert.equal(review.rows[0].players[1].handicap, 0);
  assert.equal(review.rows[0].opponents[0].id, null);
  review.internal = true;
  const internal = resolveReviewIdentities(review, players);
  assert.equal(internal.rows[0].opponents[0].id, 3);
  assert.equal(internal.rows[0].opponents[1].id, 4);
  review.rows[0].players[0] = { ...review.rows[0].players[0], id: null, identitySource: "manual" };
  assert.equal(resolveReviewIdentities(review, players).rows[0].players[0].id, null);
  review.rows[0].players[0] = { ...review.rows[0].players[0], identitySource: undefined };
  review.rows.push({ ...structuredClone(review.rows[0]), key: "second-row" });
  const duplicated = resolveReviewIdentities(review, players);
  assert.equal(duplicated.rows[0].players[0].id, null);
  assert.equal(duplicated.rows[1].players[0].id, null);
});

test("explains the remaining missing name after correcting a score, without blocking unknown handicaps", () => {
  const players: PlayerOption[] = [
    { id: 1, name: "Anne Example", defaultHandicap: 18, active: true },
    { id: 2, name: "Bea Sample", defaultHandicap: 12, active: true },
  ];
  const extraction: Extraction = {
    date: null, venue: null, leftTeam: null, rightTeam: null, warnings: [],
    rows: [{
      order: 15, page: 1, tee: null, warnings: ["Read 14UP; opponent name is blank."],
      leftResult: null, rightResult: "14UP",
      left: [{ name: "Other Player", handicap: null }, { name: null, handicap: null }],
      right: [{ name: "A Example", handicap: null }, { name: "B Sample", handicap: null }],
    }],
  };
  const row = initialReview(extraction, players, "right").rows[0];
  row.margin = "1UP";
  assert.deepEqual(rowConfirmationIssues(row, false), ["Opponent 2 name is missing."]);
  row.opponents[1].name = "Corrected Opponent";
  assert.deepEqual(rowConfirmationIssues(row, false), []);
  row.players[0].id = null;
  assert.deepEqual(rowConfirmationIssues(row, false), ["Our player 1 identity needs confirmation."]);
  row.players[0].create = true;
  assert.deepEqual(rowConfirmationIssues(row, false), []);
  assert.equal(rowConfirmationIssues(row, true).length, 2, "internal opponents still need linked identities");
  row.result = null;
  assert.deepEqual(rowConfirmationIssues(row, false), ["Select an outcome for our side."]);
});

function duplicateReview() {
  return initialReview({
    date: null, venue: null, leftTeam: null, rightTeam: null, warnings: [],
    rows: [3, 11].map((order) => ({
      order, page: 1, tee: null, warnings: [], leftResult: "A/S", rightResult: null,
      left: [{ name: "Repeated external name", handicap: null }, { name: "Other opponent", handicap: null }],
      right: [{ name: `Player ${order} A`, handicap: null }, { name: `Player ${order} B`, handicap: null }],
    })),
  }, [], "right");
}

test("locates every duplicate player by identity even with different readings or confirmed rows, and clears after correction or exclusion", () => {
  const review = duplicateReview();
  review.rows[0].players[0].id = 7;
  review.rows[1].players[1].id = 7;
  review.rows[0].reviewed = true;
  const duplicates = findDuplicatePlayerAssignments(review);
  assert.equal(duplicates.length, 1);
  assert.equal(duplicates[0].playerId, 7);
  assert.deepEqual(duplicates[0].occurrences, [
    { rowIndex: 0, order: 3, group: "players", personIndex: 0 },
    { rowIndex: 1, order: 11, group: "players", personIndex: 1 },
  ]);
  review.rows[1].selected = false;
  assert.deepEqual(findDuplicatePlayerAssignments(review), []);
  review.rows[1].selected = true;
  review.rows[1].players[1].id = 8;
  assert.deepEqual(findDuplicatePlayerAssignments(review), []);
  review.rows[0].players[1].id = 7;
  assert.deepEqual(findDuplicatePlayerAssignments(review)[0].occurrences.map((location) => location.personIndex), [0, 1]);
});

test("detects duplicate new-player names using the save-time normalization, without treating unresolved or external names as assignments", () => {
  const review = duplicateReview();
  assert.deepEqual(findDuplicatePlayerAssignments(review), []);
  review.rows[0].players[0] = { id: null, name: "A. Example", handicap: null, create: true };
  review.rows[1].players[1] = { id: null, name: "Á EXAMPLE", handicap: null, create: true };
  const duplicates = findDuplicatePlayerAssignments(review);
  assert.equal(duplicates.length, 1);
  assert.equal(duplicates[0].identity, "name:aexample");
  review.rows[1].players[1].create = false;
  assert.deepEqual(findDuplicatePlayerAssignments(review), []);
});

test("includes linked opponents only for internal fixtures and reports their exact conflicting field", () => {
  const review = duplicateReview();
  review.rows[0].players[0].id = 7;
  review.rows[1].opponents[1].id = 7;
  assert.deepEqual(findDuplicatePlayerAssignments(review), []);
  review.internal = true;
  assert.deepEqual(findDuplicatePlayerAssignments(review)[0].occurrences, [
    { rowIndex: 0, order: 3, group: "players", personIndex: 0 },
    { rowIndex: 1, order: 11, group: "opponents", personIndex: 1 },
  ]);
});
