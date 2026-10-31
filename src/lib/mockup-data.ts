import { getPlayerForm } from "./analytics";
import {
  getCloseLossInsights, getContributionLeaders, getDataQuality, getHandicapInsights,
  getHomeAwayComparisons, getPairingEvidence, getSeasonSummary, selectInsightData,
  type InsightData,
} from "./insights";

export function getMockupData(input: InsightData, asOf = new Date().toISOString()) {
  const options = { asOf };
  const data = selectInsightData(input);
  const season = getSeasonSummary(data, options);
  const quality = getDataQuality(input, options);
  const pairs = getPairingEvidence(data);
  const handicaps = getHandicapInsights(data);
  const close = getCloseLossInsights(data);
  const location = (place: "home" | "away") => handicaps.byLocation.find((row) => row.location === place)!;
  const leaders = (place: "all" | "home" | "away") =>
    getContributionLeaders(data, { location: place }).slice(0, 5).map((p) => ({
      id: p.playerId, name: p.name, played: p.played, points: p.points, perMatch: p.pointsPerAppearance,
    }));
  const pending = new Map<number, { id: number; date: string; matches: number }>();
  for (const match of quality.internalPendingMatches) {
    const row = pending.get(match.fixtureId) ?? { id: match.fixtureId, date: match.fixtureDate, matches: 0 };
    row.matches++;
    pending.set(match.fixtureId, row);
  }
  return {
    asOf: new Date(asOf).toLocaleString("en-GB", { timeZone: "Africa/Nairobi", dateStyle: "long", timeStyle: "short" }),
    roster: season.rosterCount,
    fielded: season.rosterParticipantCount,
    missingHandicaps: handicaps.excludedCount,
    fixtures: season.fixtures.sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id).map((f) => ({
      id: f.id, date: f.date, name: f.opponentClubName,
      short: f.opponentClubName.replace(/\s+(?:Golf & Country Club|Golf Club|Sports Club|Country Club|Golf Resort)$/i, ""),
      home_away: f.homeAway, total: f.completed, wins: f.wins, losses: f.losses, halved: f.halved,
      points: f.teamPoints, maximum: f.availablePoints, future: f.future, provisional: f.provisional,
    })),
    players: getContributionLeaders(data).sort((a, b) => b.yield - a.yield || b.played - a.played).slice(0, 6).map((p) => ({
      id: p.playerId, name: p.name, played: p.played, wins: p.wins, losses: p.losses, halved: p.halved,
      rate: p.yield * 100, form: getPlayerForm(data.matches, p.playerId, 5).map((m) => m.result),
    })),
    pairs: pairs.pairs.filter((p) => p.played >= 2).slice(0, 5).map((p) => ({
      ids: [p.player1Id, p.player2Id], names: [p.player1Name, p.player2Name],
      played: p.played, wins: p.wins, losses: p.losses, halved: p.halved, points: p.pointsTogether,
    })),
    insights: {
      leaders: { all: leaders("all"), home: leaders("home"), away: leaders("away") },
      pairCoverage: { repeated: pairs.repeatedPairCount, total: pairs.uniquePairCount, priorMatches: pairs.priorEquivalentMatches },
      travelPlayers: getHomeAwayComparisons(data).players.map((p) => ({
        id: p.playerId, name: p.name, homePlayed: p.home.played, awayPlayed: p.away.played,
        homeYield: p.home.yield * 100, awayYield: p.away.yield * 100,
      })),
      handicap: {
        known: handicaps.completeCount, missing: handicaps.excludedCount,
        homeMean: location("home").meanDifference, awayMean: location("away").meanDifference,
        homeCount: location("home").completeCount, awayCount: location("away").completeCount,
        buckets: handicaps.buckets.map((b) => ({
          label: b.label, played: b.played, wins: b.wins, halved: b.halved,
          yieldRate: b.played ? (b.wins + b.halved * 0.5) / b.played * 100 : 0,
        })),
      },
      closeLosses: {
        count: close.closeLossCount, oneUp: close.oneUpLossCount,
        oneUpDrawGain: close.hypotheticalExtraPoints, unknownMargins: close.excludedMarginCount,
      },
      pending: [...pending.values()].sort((a, b) => a.date.localeCompare(b.date)),
      referenceTargets: { home: 22, away: 16, verified: false },
    },
  };
}
