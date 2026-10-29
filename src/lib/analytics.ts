export type MatchWithDetails = {
  id: number;
  fixtureId: number;
  player1Id: number;
  player2Id: number;
  player1Handicap: number | null;
  player2Handicap: number | null;
  opponent1Name: string;
  opponent2Name: string;
  opponent1Handicap: number | null;
  opponent2Handicap: number | null;
  opponent1Id: number | null;
  opponent2Id: number | null;
  opponent1PlayerName: string | null;
  opponent2PlayerName: string | null;
  result: "win" | "loss" | "halved" | "pending";
  margin: string | null;
  matchOrder: number | null;
  notes: string | null;
  fixtureDate: string;
  homeAway: "home" | "away" | "neutral";
  venueName: string;
  opponentClubId: number;
  opponentClubName: string;
  player1Name: string;
  player2Name: string;
};

export type TeamRecord = {
  wins: number;
  losses: number;
  halved: number;
  total: number;
  winRate: number;
};

export type PartnerRecord = {
  partnerId: number;
  partnerName: string;
  played: number;
  wins: number;
  halved: number;
  winRate: number;
};

export type PlayerStats = {
  played: number;
  wins: number;
  losses: number;
  halved: number;
  winRate: number;
  partners: PartnerRecord[];
};

export type PairingRecord = {
  player1Id: number;
  player2Id: number;
  player1Name: string;
  player2Name: string;
  played: number;
  wins: number;
  losses: number;
  halved: number;
  winRate: number;
  avgCombinedHandicap: number | null;
  handicapExcluded: number;
};

export type VenueRecord = {
  venueName: string;
  played: number;
  wins: number;
  losses: number;
  halved: number;
  winRate: number;
};

export type HandicapBucket = {
  label: string;
  minDiff: number;
  maxDiff: number;
  played: number;
  wins: number;
  losses: number;
  halved: number;
  winRate: number;
};

export type FormMatch = {
  id: number;
  fixtureDate: string;
  venueName: string;
  opponentClubName: string;
  partnerId: number;
  partnerName: string;
  playerHandicap: number | null;
  partnerHandicap: number | null;
  opponent1Name: string;
  opponent2Name: string;
  opponent1Handicap: number | null;
  opponent2Handicap: number | null;
  result: "win" | "loss" | "halved";
  margin: string | null;
  runningWinRate: number;
};

export type FixtureResult = {
  fixtureId: number;
  fixtureDate: string;
  venueName: string;
  opponentClubName: string;
  matches: {
    id: number;
    player1Name: string;
    player2Name: string;
    result: "win" | "loss" | "halved";
    margin: string | null;
  }[];
  wins: number;
  losses: number;
  halved: number;
  total: number;
  teamPoints: number;
  maxPoints: number;
  pointsPerMatch: number;
};

export type FixturePoints = {
  pointsPerMatch: number;
  teamPoints: number;
  opponentPoints: number;
  maxPoints: number;
};

/** Calculate fixture points. 30 pts split across matches, capped at 2 pts/match. */
export function calcFixturePoints(
  totalMatches: number,
  wins: number,
  halved: number,
): FixturePoints {
  if (totalMatches === 0) return { pointsPerMatch: 0, teamPoints: 0, opponentPoints: 0, maxPoints: 0 };
  const raw = 30 / totalMatches;
  const pointsPerMatch = Math.min(raw, 2);
  const ppm2 = Math.round(pointsPerMatch * 100) / 100;
  const maxPoints = Math.min(totalMatches * 2, 30);
  const teamPoints = Math.min(Math.round((wins + halved * 0.5) * pointsPerMatch * 100) / 100, maxPoints);
  const opponentPoints = Math.round((maxPoints - teamPoints) * 100) / 100;
  return { pointsPerMatch: ppm2, teamPoints, opponentPoints, maxPoints };
}

function calcWinRate(wins: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((wins / total) * 1000) / 1000;
}

/** Canonical key for a player pair, always lower ID first */
function pairKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/** Check if a player participated in a match (either side) */
export function isPlayerInMatch(m: MatchWithDetails, playerId: number): boolean {
  return (
    m.player1Id === playerId ||
    m.player2Id === playerId ||
    m.opponent1Id === playerId ||
    m.opponent2Id === playerId
  );
}

/** Check if player is on the opponent side of the match */
export function isOnOpponentSide(m: MatchWithDetails, playerId: number): boolean {
  return m.opponent1Id === playerId || m.opponent2Id === playerId;
}

type CompletedMatch = MatchWithDetails & { result: "win" | "loss" | "halved" };

export function isCompletedMatch(m: MatchWithDetails): m is CompletedMatch {
  return m.result !== "pending";
}

export function hasCompleteHandicaps(m: MatchWithDetails): boolean {
  return m.player1Handicap !== null && m.player2Handicap !== null &&
    m.opponent1Handicap !== null && m.opponent2Handicap !== null;
}

export function getPlayerHandicapTrend(matches: MatchWithDetails[], playerId: number) {
  return matches.filter(isCompletedMatch)
    .filter((m) => isPlayerInMatch(m, playerId))
    .flatMap((m) => {
      const handicap = isOnOpponentSide(m, playerId)
        ? (m.opponent1Id === playerId ? m.opponent1Handicap : m.opponent2Handicap)
        : (m.player1Id === playerId ? m.player1Handicap : m.player2Handicap);
      return handicap === null ? [] : [{
        date: m.fixtureDate,
        handicap,
        result: effectiveResult(m, playerId),
      }];
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Get the result from a player's perspective (flipped if on opponent side). */
export function effectiveResult(m: CompletedMatch, playerId: number): CompletedMatch["result"];
export function effectiveResult(m: MatchWithDetails, playerId: number): MatchWithDetails["result"];
export function effectiveResult(m: MatchWithDetails, playerId: number): MatchWithDetails["result"] {
  const flip = isOnOpponentSide(m, playerId);
  if (!flip) return m.result;
  if (m.result === "win") return "loss";
  if (m.result === "loss") return "win";
  return m.result;
}

export function getTeamRecord(matches: MatchWithDetails[]): TeamRecord {
  matches = matches.filter(isCompletedMatch);
  const wins = matches.filter((m) => m.result === "win").length;
  const losses = matches.filter((m) => m.result === "loss").length;
  const halved = matches.filter((m) => m.result === "halved").length;
  const total = matches.length;
  return { wins, losses, halved, total, winRate: calcWinRate(wins + halved * 0.5, total) };
}

export function getPlayerStats(
  matches: MatchWithDetails[],
  playerId: number,
): PlayerStats {
  const playerMatches = matches.filter(isCompletedMatch).filter((m) => isPlayerInMatch(m, playerId));

  const wins = playerMatches.filter((m) => effectiveResult(m, playerId) === "win").length;
  const losses = playerMatches.filter((m) => effectiveResult(m, playerId) === "loss").length;
  const halved = playerMatches.filter((m) => effectiveResult(m, playerId) === "halved").length;

  const partnerMap = new Map<
    number,
    { partnerName: string; played: number; wins: number; halved: number }
  >();

  for (const m of playerMatches) {
    const onOppSide = isOnOpponentSide(m, playerId);
    let partnerId: number;
    let partnerName: string;

    if (onOppSide) {
      // Partner is the other opponent
      partnerId = m.opponent1Id === playerId ? (m.opponent2Id ?? 0) : (m.opponent1Id ?? 0);
      partnerName = m.opponent1Id === playerId
        ? (m.opponent2PlayerName ?? m.opponent2Name)
        : (m.opponent1PlayerName ?? m.opponent1Name);
    } else {
      partnerId = m.player1Id === playerId ? m.player2Id : m.player1Id;
      partnerName = m.player1Id === playerId ? m.player2Name : m.player1Name;
    }

    if (!partnerId) continue;

    const entry = partnerMap.get(partnerId) ?? {
      partnerName,
      played: 0,
      wins: 0,
      halved: 0,
    };
    entry.played++;
    const res = effectiveResult(m, playerId);
    if (res === "win") entry.wins++;
    else if (res === "halved") entry.halved++;
    partnerMap.set(partnerId, entry);
  }

  const partners: PartnerRecord[] = Array.from(partnerMap.entries())
    .map(([partnerId, data]) => ({
      partnerId,
      partnerName: data.partnerName,
      played: data.played,
      wins: data.wins,
      halved: data.halved,
      winRate: calcWinRate(data.wins + data.halved * 0.5, data.played),
    }))
    .sort((a, b) => b.winRate - a.winRate || b.played - a.played);

  return {
    played: playerMatches.length,
    wins,
    losses,
    halved,
    winRate: calcWinRate(wins + halved * 0.5, playerMatches.length),
    partners,
  };
}

export function getPairingStats(matches: MatchWithDetails[]): PairingRecord[] {
  const pairings = new Map<
    string,
    {
      p1Id: number;
      p2Id: number;
      p1Name: string;
      p2Name: string;
      wins: number;
      losses: number;
      halved: number;
      totalCombinedHandicap: number;
      knownHandicapCount: number;
      played: number;
    }
  >();

  function addPairing(
    id1: number, id2: number,
    name1: string, name2: string,
    hcp1: number | null, hcp2: number | null,
    result: "win" | "loss" | "halved",
  ) {
    const key = pairKey(id1, id2);
    const [lowId, highId] = id1 < id2 ? [id1, id2] : [id2, id1];
    const [lowName, highName] = id1 < id2 ? [name1, name2] : [name2, name1];

    const entry = pairings.get(key) ?? {
      p1Id: lowId, p2Id: highId,
      p1Name: lowName, p2Name: highName,
      wins: 0, losses: 0, halved: 0,
      totalCombinedHandicap: 0, knownHandicapCount: 0, played: 0,
    };

    entry.played++;
    if (result === "win") entry.wins++;
    else if (result === "loss") entry.losses++;
    else entry.halved++;
    if (hcp1 !== null && hcp2 !== null) {
      entry.totalCombinedHandicap += hcp1 + hcp2;
      entry.knownHandicapCount++;
    }
    pairings.set(key, entry);
  }

  for (const m of matches.filter(isCompletedMatch)) {
    // Standard team pairing (player1 + player2)
    addPairing(
      m.player1Id, m.player2Id,
      m.player1Name, m.player2Name,
      m.player1Handicap, m.player2Handicap,
      m.result as "win" | "loss" | "halved",
    );

    // Opponent-side pairing for internal matches (when both opponents have IDs)
    if (m.opponent1Id && m.opponent2Id) {
      const flipped = m.result === "win" ? "loss" : m.result === "loss" ? "win" : "halved";
      addPairing(
        m.opponent1Id, m.opponent2Id,
        m.opponent1PlayerName ?? m.opponent1Name, m.opponent2PlayerName ?? m.opponent2Name,
        m.opponent1Handicap, m.opponent2Handicap,
        flipped as "win" | "loss" | "halved",
      );
    }
  }

  return Array.from(pairings.values())
    .map((p) => ({
      player1Id: p.p1Id,
      player2Id: p.p2Id,
      player1Name: p.p1Name,
      player2Name: p.p2Name,
      played: p.played,
      wins: p.wins,
      losses: p.losses,
      halved: p.halved,
      winRate: calcWinRate(p.wins + p.halved * 0.5, p.played),
      avgCombinedHandicap:
        p.knownHandicapCount === 0 ? null : Math.round((p.totalCombinedHandicap / p.knownHandicapCount) * 10) / 10,
      handicapExcluded: p.played - p.knownHandicapCount,
    }))
    .sort((a, b) => b.winRate - a.winRate || b.played - a.played);
}

export function getVenueStats(matches: MatchWithDetails[]): VenueRecord[] {
  const venues = new Map<
    string,
    {
      wins: number;
      losses: number;
      halved: number;
      played: number;
    }
  >();

  for (const m of matches.filter(isCompletedMatch)) {
    const entry = venues.get(m.venueName) ?? {
      wins: 0,
      losses: 0,
      halved: 0,
      played: 0,
    };
    entry.played++;
    if (m.result === "win") entry.wins++;
    else if (m.result === "loss") entry.losses++;
    else entry.halved++;
    venues.set(m.venueName, entry);
  }

  return Array.from(venues.entries())
    .map(([venueName, v]) => ({
      venueName,
      played: v.played,
      wins: v.wins,
      losses: v.losses,
      halved: v.halved,
      winRate: calcWinRate(v.wins + v.halved * 0.5, v.played),
    }))
    .sort((a, b) => b.played - a.played);
}

export function getPlayerVenueStats(
  matches: MatchWithDetails[],
  playerId: number,
): VenueRecord[] {
  const playerMatches = matches.filter(isCompletedMatch).filter((m) => isPlayerInMatch(m, playerId));

  const venues = new Map<
    string,
    { wins: number; losses: number; halved: number; played: number }
  >();

  for (const m of playerMatches) {
    const result = effectiveResult(m, playerId);
    const entry = venues.get(m.venueName) ?? { wins: 0, losses: 0, halved: 0, played: 0 };
    entry.played++;
    if (result === "win") entry.wins++;
    else if (result === "loss") entry.losses++;
    else entry.halved++;
    venues.set(m.venueName, entry);
  }

  return Array.from(venues.entries())
    .map(([venueName, v]) => ({
      venueName,
      played: v.played,
      wins: v.wins,
      losses: v.losses,
      halved: v.halved,
      winRate: calcWinRate(v.wins + v.halved * 0.5, v.played),
    }))
    .sort((a, b) => b.played - a.played);
}

const HANDICAP_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: "<0", min: -Infinity, max: 0 },
  { label: "0–3", min: 0, max: 3 },
  { label: ">3–6", min: 3, max: 6 },
  { label: ">6–<10", min: 6, max: 10 },
  { label: ">=10", min: 10, max: Infinity },
];

/** Normalize arithmetic residuals, not the recorded historical indices. */
export function getHandicapDifference(m: MatchWithDetails): number | null {
  if (!hasCompleteHandicaps(m)) return null;
  return Math.round((m.player1Handicap! + m.player2Handicap! -
    m.opponent1Handicap! - m.opponent2Handicap!) * 1e9) / 1e9;
}

export function getHandicapMatchupStats(
  matches: MatchWithDetails[],
): HandicapBucket[] {
  const buckets = HANDICAP_BUCKETS.map((b) => ({
    label: b.label,
    minDiff: b.min === -Infinity ? -99 : b.min,
    maxDiff: b.max === Infinity ? 99 : b.max,
    played: 0,
    wins: 0,
    losses: 0,
    halved: 0,
    winRate: 0,
  }));

  for (const m of matches.filter(isCompletedMatch)) {
    if (m.player1Handicap === null || m.player2Handicap === null ||
        m.opponent1Handicap === null || m.opponent2Handicap === null) continue;
    // Positive differential = our team has higher (worse) combined handicap
    const diff = getHandicapDifference(m)!;
    const bucket = diff < 0 ? 0 : diff <= 3 ? 1 : diff <= 6 ? 2 : diff < 10 ? 3 : 4;

    buckets[bucket].played++;
    if (m.result === "win") buckets[bucket].wins++;
    else if (m.result === "loss") buckets[bucket].losses++;
    else buckets[bucket].halved++;
  }

  for (const b of buckets) {
    b.winRate = calcWinRate(b.wins + b.halved * 0.5, b.played);
  }

  return buckets;
}

export function getPlayerForm(
  matches: MatchWithDetails[],
  playerId: number,
  lastN: number = 10,
): FormMatch[] {
  const playerMatches = matches
    .filter(isCompletedMatch)
    .filter((m) => isPlayerInMatch(m, playerId))
    .sort(
      (a, b) =>
        new Date(a.fixtureDate).getTime() - new Date(b.fixtureDate).getTime(),
    );

  const recent = playerMatches.slice(-lastN);
  let totalWins = 0;
  let totalPlayed = 0;

  return recent.map((m) => {
    const result = effectiveResult(m, playerId);
    totalPlayed++;
    if (result === "win") totalWins++;
    else if (result === "halved") totalWins += 0.5;

    const onOppSide = isOnOpponentSide(m, playerId);
    let partnerId: number;
    let partnerName: string;
    let playerHandicap: number | null;
    let partnerHandicap: number | null;
    let opponent1Name: string;
    let opponent2Name: string;
    let opponent1Handicap: number | null;
    let opponent2Handicap: number | null;

    if (onOppSide) {
      partnerId = m.opponent1Id === playerId ? (m.opponent2Id ?? 0) : (m.opponent1Id ?? 0);
      partnerName = m.opponent1Id === playerId
        ? (m.opponent2PlayerName ?? m.opponent2Name)
        : (m.opponent1PlayerName ?? m.opponent1Name);
      playerHandicap = m.opponent1Id === playerId ? m.opponent1Handicap : m.opponent2Handicap;
      partnerHandicap = m.opponent1Id === playerId ? m.opponent2Handicap : m.opponent1Handicap;
      opponent1Name = m.player1Name;
      opponent2Name = m.player2Name;
      opponent1Handicap = m.player1Handicap;
      opponent2Handicap = m.player2Handicap;
    } else {
      partnerId = m.player1Id === playerId ? m.player2Id : m.player1Id;
      partnerName = m.player1Id === playerId ? m.player2Name : m.player1Name;
      playerHandicap = m.player1Id === playerId ? m.player1Handicap : m.player2Handicap;
      partnerHandicap = m.player1Id === playerId ? m.player2Handicap : m.player1Handicap;
      opponent1Name = m.opponent1Name;
      opponent2Name = m.opponent2Name;
      opponent1Handicap = m.opponent1Handicap;
      opponent2Handicap = m.opponent2Handicap;
    }

    return {
      id: m.id,
      fixtureDate: m.fixtureDate,
      venueName: m.venueName,
      opponentClubName: m.opponentClubName,
      partnerId,
      partnerName,
      playerHandicap,
      partnerHandicap,
      opponent1Name,
      opponent2Name,
      opponent1Handicap,
      opponent2Handicap,
      result,
      margin: m.margin,
      runningWinRate: calcWinRate(totalWins, totalPlayed),
    };
  });
}

export function getRecentFixtureResults(
  matches: MatchWithDetails[],
  lastN: number = 5,
): FixtureResult[] {
  const fixtureMap = new Map<number, CompletedMatch[]>();
  for (const m of matches.filter(isCompletedMatch)) {
    const group = fixtureMap.get(m.fixtureId) ?? [];
    group.push(m);
    fixtureMap.set(m.fixtureId, group);
  }

  const fixtures: FixtureResult[] = Array.from(fixtureMap.entries()).map(
    ([fixtureId, fMatches]) => {
      const first = fMatches[0];
      const wins = fMatches.filter((m) => m.result === "win").length;
      const losses = fMatches.filter((m) => m.result === "loss").length;
      const halved = fMatches.filter((m) => m.result === "halved").length;

      const pts = calcFixturePoints(fMatches.length, wins, halved);

      return {
        fixtureId,
        fixtureDate: first.fixtureDate,
        venueName: first.venueName,
        opponentClubName: first.opponentClubName,
        matches: fMatches
          .sort((a, b) => (a.matchOrder ?? 0) - (b.matchOrder ?? 0))
          .map((m) => ({
            id: m.id,
            player1Name: m.player1Name,
            player2Name: m.player2Name,
            result: m.result,
            margin: m.margin,
          })),
        wins,
        losses,
        halved,
        total: fMatches.length,
        teamPoints: pts.teamPoints,
        maxPoints: pts.maxPoints,
        pointsPerMatch: pts.pointsPerMatch,
      };
    },
  );

  return fixtures
    .sort(
      (a, b) =>
        new Date(b.fixtureDate).getTime() - new Date(a.fixtureDate).getTime(),
    )
    .slice(0, lastN);
}
