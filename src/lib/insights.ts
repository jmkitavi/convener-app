import {
  calcFixturePoints, effectiveResult, getHandicapDifference, getHandicapMatchupStats,
  getTeamRecord, hasCompleteHandicaps, isCompletedMatch,
  type MatchWithDetails,
} from "./analytics";

/**
 * Pure/client-safe API: every helper defaults to NDC and all locations.
 * Yields/coverage fractions are 0–1; `*Pct` fields are 0–100.
 * Season/location scores sum final rounded fixture scores. Player/pair/scenario
 * credits round only their final totals, using full-precision weights throughout.
 * New yields/weights/means retain precision; legacy `winRate` fields retain
 * analytics.ts's three-decimal rounding.
 * Only completed matches count as appearances/results. Fixture scores with pending
 * rows remain provisional and contribute points, but not final fixture W/D/L.
 * `resultsCoveragePct` counts due fixtures with any result / all due fixtures.
 * Roster presence/active status is never inferred from appearances.
 */
export type DataScope = "ndc" | "all";
export type LocationFilter = "all" | "home" | "away";
export type InsightFixture = {
  id: number;
  date: string;
  homeAway: "home" | "away" | "neutral";
  opponentClubId: number;
  opponentClubName: string;
  venueName: string;
};
export type InsightPlayer = { id: number; name: string; active: boolean };
export type InsightData = {
  matches: MatchWithDetails[];
  fixtures: InsightFixture[];
  players: InsightPlayer[];
};
export type InsightOptions = {
  scope?: DataScope;
  location?: LocationFilter;
  /** ISO date or Date; only coverage/timeline classification depends on today. */
  asOf?: string | Date;
};

/** Club 15 is the application's existing internal-history convention. */
export function isInternalFixture(fixture: Pick<InsightFixture, "opponentClubId" | "opponentClubName">) {
  return fixture.opponentClubId === 15 || /kenya\s*air\s*force/i.test(fixture.opponentClubName);
}

export function selectMatchesByScope<T extends Pick<MatchWithDetails, "opponentClubId" | "opponentClubName">>(matches: T[], scope: DataScope): T[] {
  return matches.filter((match) => scope === "all" || !isInternalFixture(match));
}

export function selectInsightData(data: InsightData, options: InsightOptions = {}): InsightData {
  const { scope = "ndc", location = "all" } = options;
  const fixtures = data.fixtures.filter((f) =>
    (scope === "all" || !isInternalFixture(f)) &&
    (location === "all" || f.homeAway === location));
  const ids = new Set(fixtures.map((f) => f.id));
  return { fixtures, matches: data.matches.filter((m) => ids.has(m.fixtureId)), players: data.players };
}

const round = (n: number) => Math.round(n * 100) / 100;
const ratio = (n: number, d: number) => d ? n / d : 0;
const resultYield = (result: MatchWithDetails["result"]) => result === "win" ? 1 : result === "halved" ? 0.5 : 0;
const today = (asOf: InsightOptions["asOf"]) =>
  (asOf instanceof Date ? asOf.toISOString() : asOf ?? new Date().toISOString()).slice(0, 10);

function fixtureEvidence(data: InsightData, asOf?: InsightOptions["asOf"]) {
  const grouped = new Map<number, MatchWithDetails[]>();
  for (const match of data.matches) {
    const rows = grouped.get(match.fixtureId) ?? [];
    rows.push(match);
    grouped.set(match.fixtureId, rows);
  }
  return data.fixtures.map((fixture) => {
    const rows = grouped.get(fixture.id) ?? [];
    const completed = rows.filter(isCompletedMatch);
    const pending = rows.length - completed.length;
    const record = getTeamRecord(completed);
    const weight = completed.length ? Math.min(30 / completed.length, 2) : 0;
    const rawPoints = (record.wins + record.halved * 0.5) * weight;
    const { teamPoints, opponentPoints, maxPoints: availablePoints } =
      calcFixturePoints(completed.length, record.wins, record.halved);
    const provisional = completed.length > 0 && pending > 0;
    return {
      ...fixture, completed: completed.length, pending, recorded: rows.length,
      ...record, weight, rawPoints, availablePoints,
      teamPoints, opponentPoints,
      provisional, future: fixture.date.slice(0, 10) > today(asOf),
      result: completed.length === 0 || provisional ? null :
        record.wins === record.losses ? "draw" as const : record.wins > record.losses ? "win" as const : "loss" as const,
    };
  });
}

function weights(data: InsightData) {
  return new Map(fixtureEvidence(data).map((f) => [f.id, f.weight]));
}

function participants(m: MatchWithDetails) {
  const people = [
    { id: m.player1Id, name: m.player1Name },
    { id: m.player2Id, name: m.player2Name },
  ];
  if (isInternalFixture(m)) {
    if (m.opponent1Id !== null) people.push({ id: m.opponent1Id, name: m.opponent1PlayerName ?? m.opponent1Name });
    if (m.opponent2Id !== null) people.push({ id: m.opponent2Id, name: m.opponent2PlayerName ?? m.opponent2Name });
  }
  return people.filter((p, index) => people.findIndex((other) => other.id === p.id) === index);
}

export function getSeasonSummary(data: InsightData, options: InsightOptions = {}) {
  const scoped = selectInsightData(data, options);
  const fixtures = fixtureEvidence(scoped, options.asOf);
  const completed = scoped.matches.filter(isCompletedMatch);
  const recorded = fixtures.filter((f) => f.completed > 0);
  const points = round(fixtures.reduce((sum, f) => sum + f.teamPoints, 0));
  const availablePoints = fixtures.reduce((sum, f) => sum + f.availablePoints, 0);
  const participantIds = new Set(completed.flatMap((m) => participants(m).map((p) => p.id)));
  const dates = scoped.fixtures.map((f) => f.date).sort();
  return {
    teamPoints: round(points), availablePoints: round(availablePoints),
    capturePct: ratio(points, availablePoints) * 100,
    pointsPerRecordedFixture: ratio(points, recorded.length),
    fixtureRecord: {
      wins: fixtures.filter((f) => f.result === "win").length,
      draws: fixtures.filter((f) => f.result === "draw").length,
      losses: fixtures.filter((f) => f.result === "loss").length,
    },
    matchRecord: getTeamRecord(completed),
    fixtureCount: fixtures.length, recordedFixtureCount: recorded.length,
    provisionalFixtureCount: fixtures.filter((f) => f.provisional).length,
    pendingMatchCount: scoped.matches.length - completed.length,
    participantCount: participantIds.size,
    rosterParticipantCount: scoped.players.filter((p) => participantIds.has(p.id)).length,
    rosterCount: scoped.players.length,
    resultsCoveragePct: ratio(fixtures.filter((f) => !f.future && f.completed > 0).length,
      fixtures.filter((f) => !f.future).length) * 100,
    dateRange: dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null,
    fixtures,
  };
}

export type ContributionLeader = {
  playerId: number; name: string; played: number;
  wins: number; halved: number; losses: number;
  points: number; pointsPerAppearance: number; yield: number;
};

/** Each partner receives the FULL pair credit. Player credits are not extra team points. */
export function getContributionLeaders(
  data: InsightData, options: InsightOptions & { minAppearances?: number } = {},
): ContributionLeader[] {
  const scoped = selectInsightData(data, options);
  const weight = weights(scoped);
  const entries = new Map<number, ContributionLeader>();
  for (const m of scoped.matches.filter(isCompletedMatch).sort((a, b) => a.id - b.id)) {
    for (const p of participants(m)) {
      const entry = entries.get(p.id) ?? {
        playerId: p.id, name: p.name, played: 0, wins: 0, halved: 0, losses: 0,
        points: 0, pointsPerAppearance: 0, yield: 0,
      };
      const result = effectiveResult(m, p.id);
      entry.played++;
      if (result === "win") entry.wins++;
      else if (result === "halved") entry.halved++;
      else entry.losses++;
      entry.points += resultYield(result) * (weight.get(m.fixtureId) ?? 0);
      entries.set(p.id, entry);
    }
  }
  return [...entries.values()]
    .filter((p) => p.played >= (options.minAppearances ?? 3))
    .map((p) => ({
      ...p, pointsPerAppearance: p.points / p.played,
      yield: (p.wins + p.halved * 0.5) / p.played,
    }))
    .sort((a, b) => b.points - a.points || b.pointsPerAppearance - a.pointsPerAppearance ||
      b.played - a.played || a.name.localeCompare(b.name) || a.playerId - b.playerId)
    .map((p) => ({ ...p, points: round(p.points) }));
}

/** Descriptive three-match shrinkage, not a pairing-engine score or prediction. */
export function getPairingEvidence(data: InsightData, options: InsightOptions = {}) {
  const scoped = selectInsightData(data, options);
  const completed = scoped.matches.filter(isCompletedMatch).sort((a, b) => a.id - b.id);
  const weight = weights(scoped);
  const teamYield = ratio(completed.reduce((sum, m) => sum + resultYield(m.result), 0), completed.length);
  const pairs = new Map<string, {
    player1Id: number; player2Id: number; player1Name: string; player2Name: string;
    played: number; wins: number; losses: number; halved: number; pointsTogether: number; matchIds: number[];
  }>();
  for (const m of completed) {
    const sides = [[
      { id: m.player1Id, name: m.player1Name }, { id: m.player2Id, name: m.player2Name },
    ]];
    if (isInternalFixture(m) && m.opponent1Id !== null && m.opponent2Id !== null) {
      sides.push([
        { id: m.opponent1Id, name: m.opponent1PlayerName ?? m.opponent1Name },
        { id: m.opponent2Id, name: m.opponent2PlayerName ?? m.opponent2Name },
      ]);
    }
    for (const side of sides) {
      const [a, b] = side.sort((a, b) => a.id - b.id);
      const key = `${a.id}:${b.id}`;
      const p = pairs.get(key) ?? {
        player1Id: a.id, player2Id: b.id, player1Name: a.name, player2Name: b.name,
        played: 0, wins: 0, losses: 0, halved: 0, pointsTogether: 0, matchIds: [],
      };
      const result = effectiveResult(m, a.id);
      p.played++;
      if (result === "win") p.wins++;
      else if (result === "halved") p.halved++;
      else p.losses++;
      p.pointsTogether += resultYield(result) * (weight.get(m.fixtureId) ?? 0);
      p.matchIds.push(m.id);
      pairs.set(key, p);
    }
  }
  const repeated = [...pairs.values()].filter((p) => p.played >= 2);
  const covered = new Set(repeated.flatMap((p) => p.matchIds));
  return {
    teamYield, priorEquivalentMatches: 3,
    uniquePairCount: pairs.size, repeatedPairCount: repeated.length,
    repeatedMatchCount: covered.size, completedMatchCount: completed.length,
    repeatedMatchCoverage: ratio(covered.size, completed.length),
    pairs: [...pairs.values()].map((p) => ({
      player1Id: p.player1Id, player2Id: p.player2Id,
      player1Name: p.player1Name, player2Name: p.player2Name,
      played: p.played, wins: p.wins, losses: p.losses, halved: p.halved,
      pointsTogether: round(p.pointsTogether),
      rawYield: (p.wins + 0.5 * p.halved) / p.played,
      adjustedYield: (p.wins + 0.5 * p.halved + 3 * teamYield) / (p.played + 3),
    })).sort((a, b) => b.adjustedYield - a.adjustedYield || b.played - a.played ||
      a.player1Id - b.player1Id || a.player2Id - b.player2Id),
  };
}

export function getHomeAwayComparisons(
  data: InsightData,
  options: Omit<InsightOptions, "location"> & { minAppearances?: number; sort?: "away" | "home-edge" } = {},
) {
  const homeOptions = { ...options, location: "home" as const };
  const awayOptions = { ...options, location: "away" as const };
  const home = getContributionLeaders(data, { ...homeOptions, minAppearances: 0 });
  const away = new Map(getContributionLeaders(data, { ...awayOptions, minAppearances: 0 }).map((p) => [p.playerId, p]));
  const min = options.minAppearances ?? 2;
  return {
    home: getSeasonSummary(data, homeOptions), away: getSeasonSummary(data, awayOptions),
    players: home.flatMap((h) => {
      const a = away.get(h.playerId);
      return h.played >= min && a && a.played >= min ?
        [{ playerId: h.playerId, name: h.name, home: h, away: a, homeEdge: h.yield - a.yield }] : [];
    }).sort((a, b) => (options.sort === "home-edge" ? b.homeEdge - a.homeEdge : b.away.yield - a.away.yield) ||
      b.away.played - a.away.played || a.name.localeCompare(b.name) || a.playerId - b.playerId),
  };
}

export function getHandicapInsights(data: InsightData, options: InsightOptions = {}) {
  const scoped = selectInsightData(data, options);
  const completed = scoped.matches.filter(isCompletedMatch);
  const complete = completed.filter(hasCompleteHandicaps);
  function means(rows: MatchWithDetails[]) {
    return {
      completeCount: rows.length,
      meanTeamCombined: rows.length ? rows.reduce((sum, m) => sum + m.player1Handicap! + m.player2Handicap!, 0) / rows.length : null,
      meanOpponentCombined: rows.length ? rows.reduce((sum, m) => sum + m.opponent1Handicap! + m.opponent2Handicap!, 0) / rows.length : null,
      meanDifference: rows.length ? rows.reduce((sum, m) => sum + getHandicapDifference(m)!, 0) / rows.length : null,
    };
  }
  return {
    completedCount: completed.length,
    excludedCount: completed.length - complete.length,
    ...means(complete),
    byLocation: (["home", "away", "neutral"] as const).map((location) => ({
      location, ...means(complete.filter((m) => m.homeAway === location)),
      excludedCount: completed.filter((m) => m.homeAway === location && !hasCompleteHandicaps(m)).length,
    })),
    buckets: getHandicapMatchupStats(completed),
  };
}

export function getCloseLossInsights(data: InsightData, options: InsightOptions = {}) {
  const scoped = selectInsightData(data, options);
  const weight = weights(scoped);
  const losses = scoped.matches.filter(isCompletedMatch).filter((m) => m.result === "loss");
  const normalized = (m: MatchWithDetails) => (m.margin ?? "").toUpperCase().replace(/\s+/g, "");
  const oneUp = losses.filter((m) => normalized(m) === "1UP");
  const close = losses.filter((m) => ["1UP", "2UP", "2&1"].includes(normalized(m)));
  const unknown = losses.filter((m) => !/^(?:\d+UP|\d+&\d+)$/.test(normalized(m)));
  return {
    lossCount: losses.length, closeLossCount: close.length, oneUpLossCount: oneUp.length,
    excludedMarginCount: unknown.length, closeLosses: close, oneUpLosses: oneUp,
    hypotheticalExtraPoints: round(oneUp.reduce((sum, m) => sum + (weight.get(m.fixtureId) ?? 0) * 0.5, 0)),
  };
}

/** Queues overlap; their lengths must not be added as a unique issue count. */
export function getDataQuality(data: InsightData, options: InsightOptions = {}) {
  const scoped = selectInsightData(data, options);
  const fixtures = fixtureEvidence(scoped, options.asOf);
  const appeared = new Set(scoped.matches.filter(isCompletedMatch).flatMap((m) => participants(m).map((p) => p.id)));
  const internal = selectInsightData(data, { ...options, scope: "all" });
  return {
    incompleteHandicaps: scoped.matches.filter(isCompletedMatch).filter((m) => !hasCompleteHandicaps(m)),
    pastFixturesWithoutResults: fixtures.filter((f) => !f.future && f.completed === 0),
    emptyPastFixtures: fixtures.filter((f) => !f.future && f.recorded === 0),
    futureFixtures: fixtures.filter((f) => f.future),
    provisionalFixtures: fixtures.filter((f) => f.provisional),
    pendingMatches: scoped.matches.filter((m) => !isCompletedMatch(m)),
    internalPendingMatches: internal.matches.filter((m) => isInternalFixture(m) && !isCompletedMatch(m)),
    rosterWithoutAppearances: scoped.players.filter((p) => !appeared.has(p.id)),
  };
}

export type SeasonSummary = ReturnType<typeof getSeasonSummary>;
export type FixtureEvidence = SeasonSummary["fixtures"][number];
export type PairingEvidence = ReturnType<typeof getPairingEvidence>;
export type HomeAwayComparisons = ReturnType<typeof getHomeAwayComparisons>;
export type HandicapInsights = ReturnType<typeof getHandicapInsights>;
export type CloseLossInsights = ReturnType<typeof getCloseLossInsights>;
export type DataQuality = ReturnType<typeof getDataQuality>;
