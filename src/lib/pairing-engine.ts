import {
  type MatchWithDetails,
  getPairingStats,
  getVenueStats,
  getPlayerForm,
} from "@/lib/analytics";

export type AvailablePlayer = {
  id: number;
  name: string;
  handicap: number;
};

export type PairingSuggestion = {
  player1: AvailablePlayer;
  player2: AvailablePlayer;
  score: number;
  breakdown: {
    historicalWinRate: number;
    sampleConfidence: number;
    handicapCompatibility: number;
    venueAffinity: number;
    recentForm: number;
  };
  reasoning: string[];
  matchesPlayed: number;
  winRate: number;
};

const WEIGHTS = {
  historicalWinRate: 0.4,
  sampleConfidence: 0.1,
  handicapCompatibility: 0.2,
  venueAffinity: 0.15,
  recentForm: 0.15,
} as const;

// Minimum matches before we trust the historical record
const CONFIDENCE_THRESHOLD = 8;

// Bonus for pairs that have never played together (encourage exploration)
const EXPLORATION_BONUS = 0.55;

function pairKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/**
 * Score historical win rate on a 0–1 scale.
 * Returns the exploration bonus for untested pairings.
 */
function scoreHistoricalWinRate(
  wins: number,
  played: number,
): { score: number; isUntested: boolean } {
  if (played === 0) return { score: EXPLORATION_BONUS, isUntested: true };
  return { score: wins / played, isUntested: false };
}

/**
 * Confidence adjustment: ramps from 0.3 (no data) to 1.0 at CONFIDENCE_THRESHOLD matches.
 * Uses a sqrt curve so early matches count more.
 */
function scoreSampleConfidence(played: number): number {
  if (played === 0) return 0.3;
  const ratio = Math.min(played / CONFIDENCE_THRESHOLD, 1);
  return 0.3 + 0.7 * Math.sqrt(ratio);
}

/**
 * Handicap compatibility: prefer a spread between partners.
 * A pair with one low and one mid handicap is better than two extremes.
 * Score is 0–1 where 1 = ideal spread (~6–10 difference).
 */
function scoreHandicapCompatibility(h1: number, h2: number): number {
  const diff = Math.abs(h1 - h2);
  // Ideal spread is 6–10 strokes apart (low + mid-high)
  if (diff >= 6 && diff <= 10) return 1.0;
  if (diff >= 3 && diff < 6) return 0.8;
  if (diff > 10 && diff <= 15) return 0.7;
  if (diff >= 1 && diff < 3) return 0.6;
  // Very similar handicaps or extreme spread
  if (diff > 15) return 0.4;
  return 0.5; // diff === 0
}

/**
 * Venue affinity: how well does this pair perform at the given venue?
 * Falls back to the combined individual venue records if the pair has no venue data.
 */
function scoreVenueAffinity(
  pairMatches: MatchWithDetails[],
  allMatches: MatchWithDetails[],
  player1Id: number,
  player2Id: number,
  venueName: string | undefined,
): { score: number; venueWins: number; venuePlayed: number } {
  if (!venueName) return { score: 0.5, venueWins: 0, venuePlayed: 0 };

  // First try: pair's record at this venue
  const pairVenueMatches = pairMatches.filter((m) => m.venueName === venueName);
  if (pairVenueMatches.length >= 2) {
    const wins = pairVenueMatches.filter((m) => m.result === "win").length;
    const halved = pairVenueMatches.filter((m) => m.result === "halved").length;
    const points = wins + halved * 0.5;
    return {
      score: points / pairVenueMatches.length,
      venueWins: wins,
      venuePlayed: pairVenueMatches.length,
    };
  }

  // Fallback: individual venue records combined
  const playerVenueMatches = allMatches.filter(
    (m) =>
      m.venueName === venueName &&
      (m.player1Id === player1Id ||
        m.player2Id === player1Id ||
        m.player1Id === player2Id ||
        m.player2Id === player2Id),
  );

  if (playerVenueMatches.length === 0) {
    return { score: 0.5, venueWins: 0, venuePlayed: 0 };
  }

  const wins = playerVenueMatches.filter((m) => m.result === "win").length;
  const halved = playerVenueMatches.filter((m) => m.result === "halved").length;
  const points = wins + halved * 0.5;
  // Discount individual data slightly since it's not pair-specific
  const rawRate = points / playerVenueMatches.length;
  return {
    score: 0.3 + rawRate * 0.5,
    venueWins: wins,
    venuePlayed: playerVenueMatches.length,
  };
}

/**
 * Recent form: average of both players' form over last 5 matches.
 */
function scoreRecentForm(
  allMatches: MatchWithDetails[],
  player1Id: number,
  player2Id: number,
): { score: number; p1FormWinRate: number; p2FormWinRate: number } {
  const p1Form = getPlayerForm(allMatches, player1Id, 5);
  const p2Form = getPlayerForm(allMatches, player2Id, 5);

  const p1WinRate =
    p1Form.length > 0 ? p1Form[p1Form.length - 1].runningWinRate : 0.5;
  const p2WinRate =
    p2Form.length > 0 ? p2Form[p2Form.length - 1].runningWinRate : 0.5;

  return {
    score: (p1WinRate + p2WinRate) / 2,
    p1FormWinRate: p1WinRate,
    p2FormWinRate: p2WinRate,
  };
}

function formatRecord(wins: number, losses: number, halved: number): string {
  const parts = [`${wins}-${losses}`];
  if (halved > 0) parts[0] += `-${halved}`;
  return parts[0];
}

function generateReasoning(
  pairData: {
    played: number;
    wins: number;
    losses: number;
    halved: number;
    isUntested: boolean;
  },
  venueData: { venueWins: number; venuePlayed: number },
  formData: { p1FormWinRate: number; p2FormWinRate: number },
  handicapScore: number,
  venueName: string | undefined,
  player1Name: string,
  player2Name: string,
): string[] {
  const reasons: string[] = [];

  if (pairData.isUntested) {
    reasons.push(
      `${player1Name} & ${player2Name} haven't paired before — worth exploring`,
    );
  } else {
    const record = formatRecord(
      pairData.wins,
      pairData.losses,
      pairData.halved,
    );
    reasons.push(`${record} record together (${pairData.played} matches)`);
    if (pairData.played >= 3 && (pairData.wins + pairData.halved * 0.5) / pairData.played >= 0.7) {
      reasons.push("Proven winning combination");
    }
  }

  if (venueData.venuePlayed >= 2 && venueName) {
    const venueRecord = formatRecord(
      venueData.venueWins,
      venueData.venuePlayed - venueData.venueWins,
      0,
    );
    reasons.push(`Strong at ${venueName} (${venueRecord})`);
  }

  if (formData.p1FormWinRate >= 0.6 && formData.p2FormWinRate >= 0.6) {
    reasons.push("Both in good recent form");
  } else if (formData.p1FormWinRate >= 0.6 || formData.p2FormWinRate >= 0.6) {
    reasons.push("One player in good form");
  }

  if (handicapScore >= 0.8) {
    reasons.push("Complementary handicap spread");
  }

  if (reasons.length === 0) {
    reasons.push("Baseline pairing");
  }

  return reasons;
}

export function suggestPairings(
  availablePlayers: AvailablePlayer[],
  historicalMatches: MatchWithDetails[],
  venueName?: string,
  topN: number = 20,
): PairingSuggestion[] {
  if (availablePlayers.length < 2) return [];

  // Pre-compute pairing stats and venue stats for efficiency
  const pairingStatsMap = new Map<
    string,
    {
      played: number;
      wins: number;
      losses: number;
      halved: number;
      winRate: number;
    }
  >();
  for (const ps of getPairingStats(historicalMatches)) {
    const key = pairKey(ps.player1Id, ps.player2Id);
    pairingStatsMap.set(key, ps);
  }

  const venueStatsMap = new Map<string, { wins: number; played: number }>();
  if (venueName) {
    for (const vs of getVenueStats(historicalMatches)) {
      if (vs.venueName === venueName) {
        venueStatsMap.set(venueName, { wins: vs.wins, played: vs.played });
      }
    }
  }

  const suggestions: PairingSuggestion[] = [];

  // Generate all possible pairs
  for (let i = 0; i < availablePlayers.length; i++) {
    for (let j = i + 1; j < availablePlayers.length; j++) {
      const p1 = availablePlayers[i];
      const p2 = availablePlayers[j];
      const key = pairKey(p1.id, p2.id);

      const pairStats = pairingStatsMap.get(key);
      const played = pairStats?.played ?? 0;
      const wins = pairStats?.wins ?? 0;
      const losses = pairStats?.losses ?? 0;
      const halved = pairStats?.halved ?? 0;

      // Get pair-specific matches for venue analysis
      const pairMatches = historicalMatches.filter(
        (m) =>
          (m.player1Id === p1.id && m.player2Id === p2.id) ||
          (m.player1Id === p2.id && m.player2Id === p1.id),
      );

      // Score each factor (halved = 0.5 points)
      const points = wins + halved * 0.5;
      const { score: winRateScore, isUntested } = scoreHistoricalWinRate(
        points,
        played,
      );
      const confidenceScore = scoreSampleConfidence(played);
      const handicapScore = scoreHandicapCompatibility(
        p1.handicap,
        p2.handicap,
      );
      const venueResult = scoreVenueAffinity(
        pairMatches,
        historicalMatches,
        p1.id,
        p2.id,
        venueName,
      );
      const formResult = scoreRecentForm(historicalMatches, p1.id, p2.id);

      const breakdown = {
        historicalWinRate: Math.round(winRateScore * 1000) / 1000,
        sampleConfidence: Math.round(confidenceScore * 1000) / 1000,
        handicapCompatibility: Math.round(handicapScore * 1000) / 1000,
        venueAffinity: Math.round(venueResult.score * 1000) / 1000,
        recentForm: Math.round(formResult.score * 1000) / 1000,
      };

      const totalScore =
        breakdown.historicalWinRate * WEIGHTS.historicalWinRate +
        breakdown.sampleConfidence * WEIGHTS.sampleConfidence +
        breakdown.handicapCompatibility * WEIGHTS.handicapCompatibility +
        breakdown.venueAffinity * WEIGHTS.venueAffinity +
        breakdown.recentForm * WEIGHTS.recentForm;

      const reasoning = generateReasoning(
        { played, wins, losses, halved, isUntested },
        venueResult,
        formResult,
        handicapScore,
        venueName,
        p1.name,
        p2.name,
      );

      suggestions.push({
        player1: p1,
        player2: p2,
        score: Math.round(totalScore * 1000) / 1000,
        breakdown,
        reasoning,
        matchesPlayed: played,
        winRate: played > 0 ? Math.round(((wins + halved * 0.5) / played) * 1000) / 1000 : 0,
      });
    }
  }

  return suggestions.sort((a, b) => b.score - a.score).slice(0, topN);
}

// ---- Counter-Pairing Engine (Away Match) ----

export type OpponentPair = {
  opp1Name: string;
  opp1Handicap: number;
  opp2Name: string;
  opp2Handicap: number;
  isRedMatch: boolean;
};

export type StrokeAnalysis = {
  backMarkerHandicap: number;
  ourPlayer1Strokes: number;
  ourPlayer2Strokes: number;
  opp1Strokes: number;
  opp2Strokes: number;
  ourTotalStrokes: number;
  oppTotalStrokes: number;
  netAdvantage: number;
  maxStrokes: number;
  // Effective handicaps after stroke allocation (lower = stronger)
  ourPlayer1EffHcp: number;
  ourPlayer2EffHcp: number;
  opp1EffHcp: number;
  opp2EffHcp: number;
  // Strokes lost to the cap (0 = fully covered, >0 = under-compensated)
  ourPlayer1Deficit: number;
  ourPlayer2Deficit: number;
  opp1Deficit: number;
  opp2Deficit: number;
  // 4BBB competitiveness gaps (positive = our advantage)
  bestVsBest: number;
  secondVsSecond: number;
};

export type CounterMatchup = {
  matchNumber: number;
  ourPlayer1: AvailablePlayer;
  ourPlayer2: AvailablePlayer;
  opponent: OpponentPair;
  score: number;
  breakdown: {
    strokeAdvantage: number;
    historicalWinRate: number;
    recentForm: number;
    venueAffinity: number;
  };
  strokeAnalysis: StrokeAnalysis;
  reasoning: string[];
};

export type CounterPairingResult = {
  matchups: CounterMatchup[];
  totalNetStrokes: number;
  avgCompetitiveness: number; // average of per-matchup competitiveness scores (0–1)
  unpairedPlayers: AvailablePlayer[];
};

const COUNTER_WEIGHTS = {
  strokeAdvantage: 0.4,
  historicalWinRate: 0.25,
  recentForm: 0.2,
  venueAffinity: 0.15,
} as const;

/**
 * NDC stroke allowance: 90% of handicap difference from back marker,
 * capped at max strokes (4 for red matches, 8 for regular).
 * Also computes effective handicaps and 4BBB competitiveness gaps.
 */
function calculateStrokeAnalysis(
  ourH1: number,
  ourH2: number,
  oppH1: number,
  oppH2: number,
  isRedMatch: boolean,
): StrokeAnalysis {
  const maxStrokes = isRedMatch ? 4 : 8;
  const backMarker = Math.min(ourH1, ourH2, oppH1, oppH2);

  const uncapped = (h: number) => Math.max(Math.floor(0.9 * (h - backMarker)), 0);
  const capped = (h: number) => Math.min(uncapped(h), maxStrokes);

  const ourP1 = capped(ourH1);
  const ourP2 = capped(ourH2);
  const opp1 = capped(oppH1);
  const opp2 = capped(oppH2);

  // Effective handicap = raw handicap minus strokes received
  const ourEff1 = ourH1 - ourP1;
  const ourEff2 = ourH2 - ourP2;
  const oppEff1 = oppH1 - opp1;
  const oppEff2 = oppH2 - opp2;

  // Deficit: strokes needed but not received due to cap
  const ourDef1 = uncapped(ourH1) - ourP1;
  const ourDef2 = uncapped(ourH2) - ourP2;
  const oppDef1 = uncapped(oppH1) - opp1;
  const oppDef2 = uncapped(oppH2) - opp2;

  // 4BBB competitiveness: best ball of each pair
  const ourBestEff = Math.min(ourEff1, ourEff2);
  const ourSecondEff = Math.max(ourEff1, ourEff2);
  const oppBestEff = Math.min(oppEff1, oppEff2);
  const oppSecondEff = Math.max(oppEff1, oppEff2);

  // Positive = our advantage (their effective is higher = weaker)
  const bestVsBest = oppBestEff - ourBestEff;
  const secondVsSecond = oppSecondEff - ourSecondEff;

  return {
    backMarkerHandicap: backMarker,
    ourPlayer1Strokes: ourP1,
    ourPlayer2Strokes: ourP2,
    opp1Strokes: opp1,
    opp2Strokes: opp2,
    ourTotalStrokes: ourP1 + ourP2,
    oppTotalStrokes: opp1 + opp2,
    netAdvantage: ourP1 + ourP2 - (opp1 + opp2),
    maxStrokes,
    ourPlayer1EffHcp: Math.round(ourEff1 * 10) / 10,
    ourPlayer2EffHcp: Math.round(ourEff2 * 10) / 10,
    opp1EffHcp: Math.round(oppEff1 * 10) / 10,
    opp2EffHcp: Math.round(oppEff2 * 10) / 10,
    ourPlayer1Deficit: ourDef1,
    ourPlayer2Deficit: ourDef2,
    opp1Deficit: oppDef1,
    opp2Deficit: oppDef2,
    bestVsBest: Math.round(bestVsBest * 10) / 10,
    secondVsSecond: Math.round(secondVsSecond * 10) / 10,
  };
}

/**
 * Score stroke advantage based on effective handicap competitiveness.
 * In 4BBB, at least one player must compete per hole, so we weight:
 * - Best vs Best (60%): can our strongest player match theirs?
 * - Second vs Second (40%): is our second player also competitive?
 * Normalized to 0–1 where 0.5 = even, 1.0 = dominant, 0.0 = outclassed.
 */
function scoreStrokeAdvantage(analysis: StrokeAnalysis): number {
  const composite =
    analysis.bestVsBest * 0.6 + analysis.secondVsSecond * 0.4;
  // ±10 window: a 10-stroke effective advantage is near-max
  const normalized = (composite + 10) / 20;
  return Math.max(0, Math.min(1, normalized));
}

function generateCounterReasoning(
  strokeAnalysis: StrokeAnalysis,
  pairData: {
    played: number;
    wins: number;
    losses: number;
    halved: number;
    isUntested: boolean;
  },
  formData: { p1FormWinRate: number; p2FormWinRate: number },
  venueData: { venueWins: number; venuePlayed: number },
  isRedMatch: boolean,
  venueName: string | undefined,
  p1Name: string,
  p2Name: string,
): string[] {
  const reasons: string[] = [];

  // Effective handicap position summary
  const ourBest = Math.min(strokeAnalysis.ourPlayer1EffHcp, strokeAnalysis.ourPlayer2EffHcp);
  const ourSecond = Math.max(strokeAnalysis.ourPlayer1EffHcp, strokeAnalysis.ourPlayer2EffHcp);
  const oppBest = Math.min(strokeAnalysis.opp1EffHcp, strokeAnalysis.opp2EffHcp);
  const oppSecond = Math.max(strokeAnalysis.opp1EffHcp, strokeAnalysis.opp2EffHcp);
  reasons.push(`Eff. ${ourBest} & ${ourSecond} vs ${oppBest} & ${oppSecond}`);

  // Deficit warnings
  const deficits: string[] = [];
  if (strokeAnalysis.ourPlayer1Deficit > 0) {
    const name = strokeAnalysis.ourPlayer1EffHcp <= strokeAnalysis.ourPlayer2EffHcp ? p1Name : p1Name;
    deficits.push(`${p1Name} capped ${strokeAnalysis.ourPlayer1Deficit} short`);
  }
  if (strokeAnalysis.ourPlayer2Deficit > 0) {
    deficits.push(`${p2Name} capped ${strokeAnalysis.ourPlayer2Deficit} short`);
  }
  if (deficits.length > 0) {
    reasons.push(`⚠ ${deficits.join(", ")}`);
  }

  if (isRedMatch) {
    reasons.push(`Red match (max ${strokeAnalysis.maxStrokes} strokes)`);
  }

  if (pairData.isUntested) {
    reasons.push("Untested pairing");
  } else {
    const record = formatRecord(
      pairData.wins,
      pairData.losses,
      pairData.halved,
    );
    reasons.push(`${record} together (${pairData.played} matches)`);
    if (
      pairData.played >= 3 &&
      (pairData.wins + pairData.halved * 0.5) / pairData.played >= 0.7
    ) {
      reasons.push("Proven winning pair");
    }
  }

  if (formData.p1FormWinRate >= 0.6 && formData.p2FormWinRate >= 0.6) {
    reasons.push("Both in good form");
  }

  if (venueData.venuePlayed >= 2 && venueName) {
    reasons.push(`${venueData.venueWins}/${venueData.venuePlayed} at venue`);
  }

  return reasons;
}

/**
 * Given opponent pairs (received lineup), suggest counter-pairings
 * from our available players. Processes red matches first, then
 * strongest opponent pairs, using greedy assignment.
 */
export function suggestCounterPairings(
  opponentPairs: OpponentPair[],
  availablePlayers: AvailablePlayer[],
  historicalMatches: MatchWithDetails[],
  venueName?: string,
): CounterPairingResult {
  if (opponentPairs.length === 0 || availablePlayers.length < 2) {
    return {
      matchups: [],
      totalNetStrokes: 0,
      avgCompetitiveness: 0,
      unpairedPlayers: [...availablePlayers],
    };
  }

  // Pre-compute pairing stats for efficiency
  const pairingStatsMap = new Map<
    string,
    {
      played: number;
      wins: number;
      losses: number;
      halved: number;
      winRate: number;
    }
  >();
  for (const ps of getPairingStats(historicalMatches)) {
    pairingStatsMap.set(pairKey(ps.player1Id, ps.player2Id), ps);
  }

  // Track original order, then sort for strategic processing
  const indexed = opponentPairs.map((opp, i) => ({
    ...opp,
    originalIndex: i,
  }));
  // Red matches first (limited strokes need careful matching), then strongest opponents
  const processingOrder = [...indexed].sort((a, b) => {
    if (a.isRedMatch && !b.isRedMatch) return -1;
    if (!a.isRedMatch && b.isRedMatch) return 1;
    return (
      a.opp1Handicap + a.opp2Handicap - (b.opp1Handicap + b.opp2Handicap)
    );
  });

  const usedPlayerIds = new Set<number>();
  const matchups: CounterMatchup[] = [];

  for (const opp of processingOrder) {
    const remaining = availablePlayers.filter(
      (p) => !usedPlayerIds.has(p.id),
    );
    if (remaining.length < 2) break;

    let bestScore = -1;
    let bestPair: [AvailablePlayer, AvailablePlayer] | null = null;
    let bestBreakdown: CounterMatchup["breakdown"] | null = null;
    let bestStroke: StrokeAnalysis | null = null;
    let bestReasoning: string[] = [];

    for (let i = 0; i < remaining.length; i++) {
      for (let j = i + 1; j < remaining.length; j++) {
        const p1 = remaining[i];
        const p2 = remaining[j];

        const strokeAnalysis = calculateStrokeAnalysis(
          p1.handicap,
          p2.handicap,
          opp.opp1Handicap,
          opp.opp2Handicap,
          opp.isRedMatch,
        );
        const strokeScore = scoreStrokeAdvantage(strokeAnalysis);

        const key = pairKey(p1.id, p2.id);
        const pairStat = pairingStatsMap.get(key);
        const played = pairStat?.played ?? 0;
        const wins = pairStat?.wins ?? 0;
        const halved = pairStat?.halved ?? 0;
        const losses = pairStat?.losses ?? 0;
        const { score: winRateScore, isUntested } = scoreHistoricalWinRate(
          wins + halved * 0.5,
          played,
        );

        const formResult = scoreRecentForm(historicalMatches, p1.id, p2.id);

        const pairMatches = historicalMatches.filter(
          (m) =>
            (m.player1Id === p1.id && m.player2Id === p2.id) ||
            (m.player1Id === p2.id && m.player2Id === p1.id),
        );
        const venueResult = scoreVenueAffinity(
          pairMatches,
          historicalMatches,
          p1.id,
          p2.id,
          venueName,
        );

        const breakdown = {
          strokeAdvantage: Math.round(strokeScore * 1000) / 1000,
          historicalWinRate: Math.round(winRateScore * 1000) / 1000,
          recentForm: Math.round(formResult.score * 1000) / 1000,
          venueAffinity: Math.round(venueResult.score * 1000) / 1000,
        };

        const totalScore =
          breakdown.strokeAdvantage * COUNTER_WEIGHTS.strokeAdvantage +
          breakdown.historicalWinRate * COUNTER_WEIGHTS.historicalWinRate +
          breakdown.recentForm * COUNTER_WEIGHTS.recentForm +
          breakdown.venueAffinity * COUNTER_WEIGHTS.venueAffinity;

        if (totalScore > bestScore) {
          bestScore = totalScore;
          bestPair = [p1, p2];
          bestBreakdown = breakdown;
          bestStroke = strokeAnalysis;
          bestReasoning = generateCounterReasoning(
            strokeAnalysis,
            { played, wins, losses, halved, isUntested },
            formResult,
            venueResult,
            opp.isRedMatch,
            venueName,
            p1.name,
            p2.name,
          );
        }
      }
    }

    if (bestPair && bestBreakdown && bestStroke) {
      usedPlayerIds.add(bestPair[0].id);
      usedPlayerIds.add(bestPair[1].id);
      matchups.push({
        matchNumber: opp.originalIndex + 1,
        ourPlayer1: bestPair[0],
        ourPlayer2: bestPair[1],
        opponent: opp,
        score: Math.round(bestScore * 1000) / 1000,
        breakdown: bestBreakdown,
        strokeAnalysis: bestStroke,
        reasoning: bestReasoning,
      });
    }
  }

  // Re-sort by original match order for display
  matchups.sort((a, b) => a.matchNumber - b.matchNumber);

  const totalNetStrokes = matchups.reduce(
    (sum, m) => sum + m.strokeAnalysis.netAdvantage,
    0,
  );
  const avgCompetitiveness =
    matchups.length > 0
      ? matchups.reduce((sum, m) => sum + m.breakdown.strokeAdvantage, 0) /
        matchups.length
      : 0;
  const unpairedPlayers = availablePlayers.filter(
    (p) => !usedPlayerIds.has(p.id),
  );

  return { matchups, totalNetStrokes, avgCompetitiveness, unpairedPlayers };
}
