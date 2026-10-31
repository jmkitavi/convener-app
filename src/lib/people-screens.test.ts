import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PlayersListClient, compareRosterPlayers } from "../app/players/players-list-client";
import { PlayerDetailClient } from "../app/players/[id]/player-detail-client";
import { ClubsDirectory } from "../components/club-form";
import { getPlayerForm, getPlayerStats, type MatchWithDetails } from "./analytics";

const noWrite = async () => {};
const player = { id: 1, name: "Player One", email: null, phone: null, defaultHandicap: 12, active: true, createdAt: "2026-01-01" };
const match: MatchWithDetails = {
  id: 1, fixtureId: 7, player1Id: 3, player2Id: 4, player1Name: "Home One", player2Name: "Home Two",
  player1Handicap: null, player2Handicap: 0, opponent1Id: 1, opponent2Id: null,
  opponent1Name: "Player One", opponent2Name: "Unlinked Partner", opponent1PlayerName: "Player One", opponent2PlayerName: null,
  opponent1Handicap: null, opponent2Handicap: 5, result: "loss", margin: "2&1", matchOrder: 1, notes: null,
  fixtureDate: "2026-06-01", homeAway: "away", venueName: "Actual Venue", opponentClubId: 2, opponentClubName: "Actual Club",
};

test("roster uses active-only median and completed both-side history without inventing performance for unfielded players", () => {
  const players = [player, { ...player, id: 2, name: "Unfielded", defaultHandicap: 20 }, { ...player, id: 3, name: "Inactive", active: false, defaultHandicap: 54 }]
    .map((entry) => ({ ...entry, stats: getPlayerStats([match], entry.id), form: getPlayerForm([match], entry.id, 5) }));
  const html = renderToStaticMarkup(createElement(PlayersListClient, {
    players, recordedFixtures: 1, historyAvailable: true, createPlayer: noWrite, updatePlayer: noWrite, togglePlayerActive: noWrite,
  }));
  assert.match(html, /Median handicap<\/p><p[^>]*>16\.0<\/p>/);
  const rows = [...html.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/g)].map((entry) => entry[0]);
  const linkedOpponent = rows.find((row) => row.includes('href="/players/1"'))!;
  assert.match(linkedOpponent, /1W · 0H · 0L/);
  assert.match(linkedOpponent, /100%/);
  const unfielded = rows.find((row) => row.includes('href="/players/2"'))!;
  assert.match(unfielded, /0W · 0H · 0L/);
  assert.doesNotMatch(unfielded, /\d+%/);
  assert.match(html, /Filter squad status/);
  assert.match(html, /Sort squad/);
});

test("roster sorts completed appearances, record and full-precision yield in both directions", () => {
  const entry = (id: number, name: string, wins: number, halved: number, losses: number) => ({
    ...player, id, name, form: [],
    stats: { played: wins + halved + losses, wins, halved, losses, winRate: (wins + halved / 2) / (wins + halved + losses || 1), partners: [] },
  });
  const players = [
    entry(1, "Unfielded", 0, 0, 0), entry(2, "Many games", 3, 0, 7),
    entry(3, "Perfect", 2, 0, 0), entry(4, "Half", 3, 1, 0),
    entry(5, "Fewer losses", 3, 0, 2), entry(6, "More halves", 3, 2, 0),
    entry(7, "Zero yield", 0, 0, 1),
  ];
  const sorted = (by: "appearances" | "record" | "yield", direction: "asc" | "desc") =>
    [...players].sort((a, b) => compareRosterPlayers(a, b, by, direction)).map((p) => p.id);
  assert.deepEqual(sorted("appearances", "desc"), [2, 5, 6, 4, 3, 7, 1]);
  assert.deepEqual(sorted("appearances", "asc"), [1, 7, 3, 4, 5, 6, 2]);
  assert.deepEqual(sorted("record", "desc"), [6, 4, 5, 2, 3, 7, 1]);
  assert.deepEqual(sorted("record", "asc"), [7, 3, 2, 5, 4, 6, 1]);
  assert.deepEqual(sorted("yield", "desc"), [3, 4, 6, 5, 2, 7, 1]);
  assert.deepEqual(sorted("yield", "asc"), [7, 2, 5, 6, 4, 3, 1]);
  const closeRates = [entry(8, "Alphabetically first", 100, 0, 101), entry(9, "Alphabetically last", 101, 0, 102)];
  assert.equal(compareRosterPlayers(closeRates[0], closeRates[1], "yield", "desc") > 0, true);
  assert.deepEqual(players.map((p) => p.id), [1, 2, 3, 4, 5, 6, 7]);
});

test("profile keeps unknown scorecard handicaps, real fixture links and unlinked partners without a player-zero link", () => {
  const form = getPlayerForm([match], player.id);
  const html = renderToStaticMarkup(createElement(PlayerDetailClient, {
    player, stats: getPlayerStats([match], player.id), form, venueStats: [], handicapTrend: [], handicapTrendExcluded: 1,
    matchHistory: [{ ...form[0], fixtureId: 7 }],
    homeAwayStats: [{ location: "away", played: 1, yield: 1 }], historyAvailable: true,
    updatePlayer: noWrite, togglePlayerActive: noWrite,
  }));
  assert.match(html, /href="\/fixtures\/7"/);
  assert.match(html, /Unlinked Partner/);
  assert.doesNotMatch(html, /href="\/players\/0"/);
  assert.match(html, /\(—\)/);
  assert.match(html, /\(0\)/);
  assert.match(html, /Match history/);
  assert.match(html, /Handicap history/);
  assert.match(html, /Venues/);
  const empty = renderToStaticMarkup(createElement(PlayerDetailClient, {
    player, stats: getPlayerStats([], player.id), form: [], venueStats: [], handicapTrend: [], handicapTrendExcluded: 0,
    matchHistory: [], homeAwayStats: [], historyAvailable: true, updatePlayer: noWrite, togglePlayerActive: noWrite,
  }));
  assert.match(empty, /Complete a match to see location performance/);
  assert.match(empty, /No matches recorded yet/);
  assert.doesNotMatch(empty, /0\.0%/);
});

test("club directory preserves unknown and zero course values and counts linked fixtures", () => {
  const html = renderToStaticMarkup(createElement(ClubsDirectory, {
    clubs: [{ id: 2, name: "Actual Club", par: null, slopeRating: 0, courseRating: null, fixtureCount: 3 }],
    createClub: noWrite, updateClub: noWrite, deleteClub: noWrite,
  }));
  assert.match(html, /— \/ 0/);
  assert.match(html, /Linked fixtures<\/dt><dd[^>]*>3<\/dd>/);
  assert.match(html, /Missing course details<\/dt><dd[^>]*>1<\/dd>/);
  assert.doesNotMatch(html, /Falcon Hills|Nairobi District|Lake County/);
});
