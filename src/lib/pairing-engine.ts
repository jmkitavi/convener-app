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
 * Venue affinity: how well does this pair perform at the given course?
 * Falls back to the combined individual venue records if the pair has no venue data.
 */
function scoreVenueAffinity(
  pairMatches: MatchWithDetails[],
  allMatches: MatchWithDetails[],
  player1Id: number,
  player2Id: number,
  courseId: number | undefined,
): { score: number; venueWins: number; venuePlayed: number } {
  if (!courseId) return { score: 0.5, venueWins: 0, venuePlayed: 0 };

  // First try: pair's record at this venue
  const pairVenueMatches = pairMatches.filter((m) => m.courseId === courseId);
  if (pairVenueMatches.length >= 2) {
    const wins = pairVenueMatches.filter((m) => m.result === "win").length;
    return {
      score: wins / pairVenueMatches.length,
      venueWins: wins,
      venuePlayed: pairVenueMatches.length,
    };
  }

  // Fallback: individual venue records combined
  const playerVenueMatches = allMatches.filter(
    (m) =>
      m.courseId === courseId &&
      (m.player1Id === player1Id ||
        m.player2Id === player1Id ||
        m.player1Id === player2Id ||
        m.player2Id === player2Id),
  );

  if (playerVenueMatches.length === 0) {
    return { score: 0.5, venueWins: 0, venuePlayed: 0 };
  }

  const wins = playerVenueMatches.filter((m) => m.result === "win").length;
  // Discount individual data slightly since it's not pair-specific
  const rawRate = wins / playerVenueMatches.length;
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
  courseName: string | undefined,
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
    if (pairData.played >= 3 && pairData.wins / pairData.played >= 0.7) {
      reasons.push("Proven winning combination");
    }
  }

  if (venueData.venuePlayed >= 2 && courseName) {
    const venueRecord = formatRecord(
      venueData.venueWins,
      venueData.venuePlayed - venueData.venueWins,
      0,
    );
    reasons.push(`Strong at ${courseName} (${venueRecord})`);
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
  courseId?: number,
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

  const venueStatsMap = new Map<number, { wins: number; played: number }>();
  if (courseId) {
    for (const vs of getVenueStats(historicalMatches)) {
      if (vs.courseId === courseId) {
        venueStatsMap.set(courseId, { wins: vs.wins, played: vs.played });
      }
    }
  }

  // Look up course name if we have a courseId
  const courseName = courseId
    ? historicalMatches.find((m) => m.courseId === courseId)?.courseName
    : undefined;

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

      // Score each factor
      const { score: winRateScore, isUntested } = scoreHistoricalWinRate(
        wins,
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
        courseId,
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
        courseName,
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
        winRate: played > 0 ? Math.round((wins / played) * 1000) / 1000 : 0,
      });
    }
  }

  return suggestions.sort((a, b) => b.score - a.score).slice(0, topN);
}
