import { getAllMatches, getFixturesWithDetails, getPlayers } from "./actions";
import type { InsightData, InsightFixture } from "./insights";

/** Request-fresh server loader. Never import this module into client components. */
export async function loadInsightData(): Promise<InsightData> {
  const [matches, fixtures, players] = await Promise.all([
    getAllMatches(), getFixturesWithDetails(), getPlayers(),
  ]);
  for (const [label, result] of [["matches", matches], ["fixtures", fixtures], ["roster", players]] as const) {
    if (!result.success) throw new Error(`Unable to load insight ${label}: ${result.error ?? "query failed"}`);
  }
  return {
    // getAllMatches' failure branch has a generic empty-array type; success was checked above.
    matches: matches.data as InsightData["matches"],
    fixtures: fixtures.data.map((f): InsightFixture => {
      if (f.homeAway !== "home" && f.homeAway !== "away" && f.homeAway !== "neutral") {
        throw new Error(`Unable to load insight fixture ${f.id}: invalid home/away location`);
      }
      return {
        id: f.id, date: f.date, homeAway: f.homeAway,
        opponentClubId: f.opponentClubId, opponentClubName: f.opponentClubName, venueName: f.venueName,
      };
    }),
    players: players.data.map(({ id, name, active }) => ({ id, name, active })),
  };
}
