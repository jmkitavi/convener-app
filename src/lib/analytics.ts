export type MatchWithDetails = {
  id: number;
  fixtureId: number;
  player1Id: number;
  player2Id: number;
  player1Handicap: number;
  player2Handicap: number;
  opponent1Name: string;
  opponent2Name: string;
  opponent1Handicap: number;
  opponent2Handicap: number;
  result: "win" | "loss" | "halved";
  margin: string | null;
  matchOrder: number | null;
  notes: string | null;
  fixtureDate: string;
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
  avgCombinedHandicap: number;
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
};

function calcWinRate(wins: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((wins / total) * 1000) / 1000;
}

/** Canonical key for a player pair, always lower ID first */
function pairKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

export function getTeamRecord(matches: MatchWithDetails[]): TeamRecord {
  const wins = matches.filter((m) => m.result === "win").length;
  const losses = matches.filter((m) => m.result === "loss").length;
  const halved = matches.filter((m) => m.result === "halved").length;
  const total = matches.length;
  return { wins, losses, halved, total, winRate: calcWinRate(wins, total) };
}

export function getPlayerStats(
  matches: MatchWithDetails[],
  playerId: number,
): PlayerStats {
  const playerMatches = matches.filter(
    (m) => m.player1Id === playerId || m.player2Id === playerId,
  );

  const wins = playerMatches.filter((m) => m.result === "win").length;
  const losses = playerMatches.filter((m) => m.result === "loss").length;
  const halved = playerMatches.filter((m) => m.result === "halved").length;

  const partnerMap = new Map<
    number,
    { partnerName: string; played: number; wins: number }
  >();

  for (const m of playerMatches) {
    const partnerId = m.player1Id === playerId ? m.player2Id : m.player1Id;
    const partnerName =
      m.player1Id === playerId ? m.player2Name : m.player1Name;

    const entry = partnerMap.get(partnerId) ?? {
      partnerName,
      played: 0,
      wins: 0,
    };
    entry.played++;
    if (m.result === "win") entry.wins++;
    partnerMap.set(partnerId, entry);
  }

  const partners: PartnerRecord[] = Array.from(partnerMap.entries())
    .map(([partnerId, data]) => ({
      partnerId,
      partnerName: data.partnerName,
      played: data.played,
      wins: data.wins,
      winRate: calcWinRate(data.wins, data.played),
    }))
    .sort((a, b) => b.winRate - a.winRate || b.played - a.played);

  return {
    played: playerMatches.length,
    wins,
    losses,
    halved,
    winRate: calcWinRate(wins, playerMatches.length),
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
      played: number;
    }
  >();

  for (const m of matches) {
    const key = pairKey(m.player1Id, m.player2Id);
    const [lowId, highId] =
      m.player1Id < m.player2Id
        ? [m.player1Id, m.player2Id]
        : [m.player2Id, m.player1Id];
    const [lowName, highName] =
      m.player1Id < m.player2Id
        ? [m.player1Name, m.player2Name]
        : [m.player2Name, m.player1Name];

    const entry = pairings.get(key) ?? {
      p1Id: lowId,
      p2Id: highId,
      p1Name: lowName,
      p2Name: highName,
      wins: 0,
      losses: 0,
      halved: 0,
      totalCombinedHandicap: 0,
      played: 0,
    };

    entry.played++;
    if (m.result === "win") entry.wins++;
    else if (m.result === "loss") entry.losses++;
    else entry.halved++;
    entry.totalCombinedHandicap += m.player1Handicap + m.player2Handicap;

    pairings.set(key, entry);
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
      winRate: calcWinRate(p.wins, p.played),
      avgCombinedHandicap:
        Math.round((p.totalCombinedHandicap / p.played) * 10) / 10,
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

  for (const m of matches) {
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
      winRate: calcWinRate(v.wins, v.played),
    }))
    .sort((a, b) => b.played - a.played);
}

export function getPlayerVenueStats(
  matches: MatchWithDetails[],
  playerId: number,
): VenueRecord[] {
  const playerMatches = matches.filter(
    (m) => m.player1Id === playerId || m.player2Id === playerId,
  );
  return getVenueStats(playerMatches);
}

const HANDICAP_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: "-5 to -3", min: -Infinity, max: -3 },
  { label: "-2 to 0", min: -2, max: 0 },
  { label: "1 to 3", min: 1, max: 3 },
  { label: "4 to 6", min: 4, max: 6 },
  { label: "7+", min: 7, max: Infinity },
];

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

  for (const m of matches) {
    const teamHandicap = m.player1Handicap + m.player2Handicap;
    const opponentHandicap = m.opponent1Handicap + m.opponent2Handicap;
    // Positive differential = our team has higher (worse) combined handicap
    const diff = teamHandicap - opponentHandicap;

    const bucket = HANDICAP_BUCKETS.findIndex(
      (b) => diff >= b.min && diff <= b.max,
    );
    if (bucket === -1) continue;

    buckets[bucket].played++;
    if (m.result === "win") buckets[bucket].wins++;
    else if (m.result === "loss") buckets[bucket].losses++;
    else buckets[bucket].halved++;
  }

  for (const b of buckets) {
    b.winRate = calcWinRate(b.wins, b.played);
  }

  return buckets;
}

export function getPlayerForm(
  matches: MatchWithDetails[],
  playerId: number,
  lastN: number = 10,
): FormMatch[] {
  const playerMatches = matches
    .filter((m) => m.player1Id === playerId || m.player2Id === playerId)
    .sort(
      (a, b) =>
        new Date(a.fixtureDate).getTime() - new Date(b.fixtureDate).getTime(),
    );

  const recent = playerMatches.slice(-lastN);
  let totalWins = 0;
  let totalPlayed = 0;

  // Calculate running win rate across the selected window
  return recent.map((m) => {
    totalPlayed++;
    if (m.result === "win") totalWins++;

    const partnerId = m.player1Id === playerId ? m.player2Id : m.player1Id;
    const partnerName =
      m.player1Id === playerId ? m.player2Name : m.player1Name;

    return {
      id: m.id,
      fixtureDate: m.fixtureDate,
      venueName: m.venueName,
      opponentClubName: m.opponentClubName,
      partnerId,
      partnerName,
      result: m.result,
      margin: m.margin,
      runningWinRate: calcWinRate(totalWins, totalPlayed),
    };
  });
}

export function getRecentFixtureResults(
  matches: MatchWithDetails[],
  lastN: number = 5,
): FixtureResult[] {
  const fixtureMap = new Map<number, MatchWithDetails[]>();
  for (const m of matches) {
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
