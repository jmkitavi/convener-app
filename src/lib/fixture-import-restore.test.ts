import assert from "node:assert/strict";
import test from "node:test";
import { restoreDraftReview } from "../app/fixtures/import/restore-review";
import type { DraftData, FixtureOption, Review } from "./results-import/contracts";

function savedReview(): Review {
  return {
    fixtureId: 3, clubId: 1, newClubName: "", date: "2026-10-17", homeAway: "home",
    venueName: "Synthetic Course", teamName: "Home Team", opponentTeamName: "Visitors",
    side: "left", internal: false, fixtureConfirmed: true,
    rows: [{
      key: "saved-row", page: 1, order: 2, selected: true, reviewed: true,
      players: [
        { id: 1, name: "Original source name", handicap: null, create: false, identitySource: "manual" },
        { id: 2, name: "Second Player", handicap: 0, create: false, identitySource: "manual" },
      ],
      opponents: [
        { id: null, name: "Visitor A", handicap: null, create: false },
        { id: null, name: "Visitor B", handicap: 0, create: false },
      ],
      result: "win", margin: "2&1", notes: "Checked against source", matchId: 11,
    }],
  };
}

test("resumes a saved review without extraction, preserving manual identity, confirmation and unknown/zero handicaps", () => {
  const review = savedReview();
  const fixture: FixtureOption = { id: 9, date: "2026-11-01", opponentClubId: 2, homeAway: "away", venueName: "Other course", teamName: null, opponentTeamName: null, clubName: "Other club" };
  const restored = restoreDraftReview({ pageCount: 1, extractionVersion: 1, review }, [
    { id: 1, name: "Canonical Player", defaultHandicap: 18, active: true },
    { id: 2, name: "Second Player", defaultHandicap: 19, active: true },
  ], fixture);
  assert.equal(restored?.fixtureId, review.fixtureId);
  assert.equal(restored?.side, review.side);
  assert.deepEqual(restored?.rows[0].players, review.rows[0].players);
  assert.deepEqual(restored?.rows[0].opponents.map((person) => person.handicap), [null, 0]);
  assert.equal(restored?.rows[0].reviewed, true);
  assert.equal(restored?.rows[0].matchId, 11);
});

test("prepared saved reviews are restored exactly, without changing their approved identity snapshot", () => {
  const review = savedReview();
  review.rows[0].players[0].identitySource = "automatic";
  const data: DraftData = { pageCount: 1, extractionVersion: 1, review, preview: { version: "saved-version", fixtureSnapshot: null, rows: [] } };
  assert.equal(restoreDraftReview(data, []), review);
});
