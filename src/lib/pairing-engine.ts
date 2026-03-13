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

export type MatchTier = "target" | "competitive" | "concede";

export type CounterMatchup = {
  matchNumber: number;
  ourPlayer1: AvailablePlayer;
  ourPlayer2: AvailablePlayer;
  opponent: OpponentPair;
  score: number;
  tier: MatchTier;
  breakdown: {
    competitiveness: number;
    historicalWinRate: number;
    recentForm: number;
    venueAffinity: number;
    bandCoherence: number;
    playerStrength: number;
  };
  strokeAnalysis: StrokeAnalysis;
  effectiveSpread: number;
  reasoning: string[];
};

export type CounterPairingResult = {
  matchups: CounterMatchup[];
  totalNetStrokes: number;
  avgCompetitiveness: number;
  unpairedPlayers: AvailablePlayer[];
  tierSummary: { target: number; competitive: number; concede: number };
};

/** Player priority thresholds */
const MUST_PLAY_THRESHOLD = 14; // handicap < 14 must always be drafted
const BENCH_THRESHOLD = 21; // handicap >= 21 only drafted when stronger players exhausted

const COUNTER_WEIGHTS = {
  competitiveness: 0.40,
  historicalWinRate: 0.25,
  recentForm: 0.15,
  venueAffinity: 0.10,
  bandCoherence: 0.05,
  playerStrength: 0.05,
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
 * Score competitiveness based on effective spread after stroke allocation.
 * Lower effective spread = more competitive match = higher score.
 * Also penalizes stroke deficits on our players.
 *
 * Scoring bands (based on match analysis — see PAIRING-ANALYSIS.md):
 *   Spread 0–1.5: excellent (0.85–1.0)
 *   Spread 1.5–3.0: good (0.55–0.85)
 *   Spread 3.0–5.0: marginal (0.25–0.55)
 *   Spread 5.0+: poor (0.0–0.25)
 * Deficit penalty: −0.1 per stroke of deficit on our players.
 */
function scoreCompetitiveness(analysis: StrokeAnalysis): {
  score: number;
  effectiveSpread: number;
} {
  const allEff = [
    analysis.ourPlayer1EffHcp,
    analysis.ourPlayer2EffHcp,
    analysis.opp1EffHcp,
    analysis.opp2EffHcp,
  ];
  const effectiveSpread =
    Math.round((Math.max(...allEff) - Math.min(...allEff)) * 10) / 10;

  // Piecewise linear mapping: spread → base score
  let base: number;
  if (effectiveSpread <= 1.5) {
    base = 1.0 - (effectiveSpread / 1.5) * 0.15; // 1.0 → 0.85
  } else if (effectiveSpread <= 3.0) {
    base = 0.85 - ((effectiveSpread - 1.5) / 1.5) * 0.3; // 0.85 → 0.55
  } else if (effectiveSpread <= 5.0) {
    base = 0.55 - ((effectiveSpread - 3.0) / 2.0) * 0.3; // 0.55 → 0.25
  } else {
    base = Math.max(0, 0.25 - ((effectiveSpread - 5.0) / 10.0) * 0.25); // 0.25 → 0
  }

  // Also factor in directional advantage: are OUR effective hcps lower (better)?
  const ourBestEff = Math.min(
    analysis.ourPlayer1EffHcp,
    analysis.ourPlayer2EffHcp,
  );
  const oppBestEff = Math.min(analysis.opp1EffHcp, analysis.opp2EffHcp);
  const ourSecondEff = Math.max(
    analysis.ourPlayer1EffHcp,
    analysis.ourPlayer2EffHcp,
  );
  const oppSecondEff = Math.max(analysis.opp1EffHcp, analysis.opp2EffHcp);
  // Small bonus/penalty based on who has the edge (±0.1)
  const dirAdv =
    ((oppBestEff - ourBestEff) * 0.6 +
      (oppSecondEff - ourSecondEff) * 0.4) /
    10;
  base += Math.max(-0.1, Math.min(0.1, dirAdv));

  // Deficit penalty: subtract 0.1 per stroke of deficit on our players
  const totalDeficit =
    analysis.ourPlayer1Deficit + analysis.ourPlayer2Deficit;
  base -= totalDeficit * 0.1;

  return {
    score: Math.max(0, Math.min(1, base)),
    effectiveSpread,
  };
}

/**
 * Score band coherence — whether all 4 players are in a similar raw handicap range.
 * When all 4 are within ~8 strokes, the match is naturally competitive.
 */
function scoreBandCoherence(
  ourH1: number,
  ourH2: number,
  oppH1: number,
  oppH2: number,
): number {
  const rawSpread = Math.max(ourH1, ourH2, oppH1, oppH2) - Math.min(ourH1, ourH2, oppH1, oppH2);
  if (rawSpread <= 5) return 1.0;
  if (rawSpread <= 8) return 0.7;
  if (rawSpread <= 12) return 0.4;
  if (rawSpread <= 16) return 0.2;
  return 0.0;
}

/**
 * Score player strength — prefer fielding stronger (lower handicap) players.
 * Normalized so a pair of scratch golfers scores 1.0 and a pair of 30+ scores 0.0.
 */
function scorePlayerStrength(ourH1: number, ourH2: number): number {
  const combined = ourH1 + ourH2;
  // 0 combined = 1.0, 60 combined = 0.0
  return Math.max(0, Math.min(1, 1 - combined / 60));
}

function generateCounterReasoning(
  strokeAnalysis: StrokeAnalysis,
  effectiveSpread: number,
  tier: MatchTier,
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

  // Tier indicator
  if (tier === "concede") {
    reasons.push("🏳 Concede — save strength elsewhere");
  } else if (tier === "target") {
    reasons.push("🎯 Target win");
  }

  // Effective spread summary
  const spreadLabel =
    effectiveSpread <= 1.5
      ? "Excellent"
      : effectiveSpread <= 3.0
        ? "Good"
        : effectiveSpread <= 5.0
          ? "Marginal"
          : "Wide";
  reasons.push(`Spread ${effectiveSpread.toFixed(1)} (${spreadLabel})`);

  // Effective handicap position
  const ourBest = Math.min(strokeAnalysis.ourPlayer1EffHcp, strokeAnalysis.ourPlayer2EffHcp);
  const ourSecond = Math.max(strokeAnalysis.ourPlayer1EffHcp, strokeAnalysis.ourPlayer2EffHcp);
  const oppBest = Math.min(strokeAnalysis.opp1EffHcp, strokeAnalysis.opp2EffHcp);
  const oppSecond = Math.max(strokeAnalysis.opp1EffHcp, strokeAnalysis.opp2EffHcp);
  reasons.push(`Eff. ${ourBest} & ${ourSecond} vs ${oppBest} & ${oppSecond}`);

  // Deficit warnings
  const deficits: string[] = [];
  if (strokeAnalysis.ourPlayer1Deficit > 0) {
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

/** Threshold: if no pair can achieve effective spread below this, concede the match */
const CONCEDE_THRESHOLD = 4.0;
/** Matches with spread below this are target wins */
const TARGET_THRESHOLD = 2.0;

/**
 * Determine match tier based on best achievable competitiveness.
 */
function classifyTier(effectiveSpread: number): MatchTier {
  if (effectiveSpread <= TARGET_THRESHOLD) return "target";
  if (effectiveSpread <= CONCEDE_THRESHOLD) return "competitive";
  return "concede";
}

/**
 * Given opponent pairs (received lineup), suggest counter-pairings
 * from our available players using a 2-phase concede-and-focus strategy.
 *
 * Phase 1: Score all (opponent, our_pair) combinations. Identify opponent pairs
 *          where no available pair can achieve effective spread < CONCEDE_THRESHOLD.
 *          Assign weakest available players to these unwinnable matches.
 * Phase 2: Assign remaining players optimally to winnable matches, prioritizing
 *          target wins (spread < 2.0) then competitive matches.
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
      tierSummary: { target: 0, competitive: 0, concede: 0 },
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

  // Helper: score a specific pair against an opponent
  const scorePairVsOpponent = (
    p1: AvailablePlayer,
    p2: AvailablePlayer,
    opp: OpponentPair,
  ) => {
    const strokeAnalysis = calculateStrokeAnalysis(
      p1.handicap,
      p2.handicap,
      opp.opp1Handicap,
      opp.opp2Handicap,
      opp.isRedMatch,
    );
    const { score: compScore, effectiveSpread } =
      scoreCompetitiveness(strokeAnalysis);
    const bandScore = scoreBandCoherence(
      p1.handicap,
      p2.handicap,
      opp.opp1Handicap,
      opp.opp2Handicap,
    );

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
      competitiveness: Math.round(compScore * 1000) / 1000,
      historicalWinRate: Math.round(winRateScore * 1000) / 1000,
      recentForm: Math.round(formResult.score * 1000) / 1000,
      venueAffinity: Math.round(venueResult.score * 1000) / 1000,
      bandCoherence: Math.round(bandScore * 1000) / 1000,
      playerStrength: Math.round(scorePlayerStrength(p1.handicap, p2.handicap) * 1000) / 1000,
    };

    const totalScore =
      breakdown.competitiveness * COUNTER_WEIGHTS.competitiveness +
      breakdown.historicalWinRate * COUNTER_WEIGHTS.historicalWinRate +
      breakdown.recentForm * COUNTER_WEIGHTS.recentForm +
      breakdown.venueAffinity * COUNTER_WEIGHTS.venueAffinity +
      breakdown.bandCoherence * COUNTER_WEIGHTS.bandCoherence +
      breakdown.playerStrength * COUNTER_WEIGHTS.playerStrength;

    const tier = classifyTier(effectiveSpread);

    return {
      totalScore,
      breakdown,
      strokeAnalysis,
      effectiveSpread,
      tier,
      pairData: { played, wins, losses, halved, isUntested },
      formResult,
      venueResult,
    };
  };

  // Index opponent pairs with original order
  const indexed = opponentPairs.map((opp, i) => ({
    ...opp,
    originalIndex: i,
  }));

  // Phase 1: Find the BEST possible effective spread for each opponent pair
  // to determine which are concession matches
  const bestSpreadPerOpp = new Map<number, number>();
  for (const opp of indexed) {
    let bestSpread = Infinity;
    for (let i = 0; i < availablePlayers.length; i++) {
      for (let j = i + 1; j < availablePlayers.length; j++) {
        const sa = calculateStrokeAnalysis(
          availablePlayers[i].handicap,
          availablePlayers[j].handicap,
          opp.opp1Handicap,
          opp.opp2Handicap,
          opp.isRedMatch,
        );
        const allEff = [sa.ourPlayer1EffHcp, sa.ourPlayer2EffHcp, sa.opp1EffHcp, sa.opp2EffHcp];
        const spread = Math.max(...allEff) - Math.min(...allEff);
        if (spread < bestSpread) bestSpread = spread;
      }
    }
    bestSpreadPerOpp.set(opp.originalIndex, bestSpread);
  }

  // Separate into concession and competitive opponent pairs
  const concessionOpps = indexed.filter(
    (opp) => (bestSpreadPerOpp.get(opp.originalIndex) ?? Infinity) > CONCEDE_THRESHOLD,
  );
  const competitiveOpps = indexed.filter(
    (opp) => (bestSpreadPerOpp.get(opp.originalIndex) ?? Infinity) <= CONCEDE_THRESHOLD,
  );

  // Sort competitive: red matches first, then by their combined handicap (strongest first)
  competitiveOpps.sort((a, b) => {
    if (a.isRedMatch && !b.isRedMatch) return -1;
    if (!a.isRedMatch && b.isRedMatch) return 1;
    return a.opp1Handicap + a.opp2Handicap - (b.opp1Handicap + b.opp2Handicap);
  });

  // Sort concession by combined handicap (strongest first — assign weakest players to strongest opps)
  concessionOpps.sort(
    (a, b) => a.opp1Handicap + a.opp2Handicap - (b.opp1Handicap + b.opp2Handicap),
  );

  const usedPlayerIds = new Set<number>();
  const matchups: CounterMatchup[] = [];

  /**
   * Build the candidate pool for a match, enforcing strength-first drafting.
   * Must-play (<14 hcp) and preferred (14–20) players are considered first.
   * Bench (21+) players only enter the pool when stronger players are exhausted.
   */
  const buildCandidatePool = (): AvailablePlayer[] => {
    const remaining = availablePlayers.filter(
      (p) => !usedPlayerIds.has(p.id),
    );
    // Separate into tiers
    const mustPlay = remaining.filter((p) => p.handicap < MUST_PLAY_THRESHOLD);
    const preferred = remaining.filter(
      (p) => p.handicap >= MUST_PLAY_THRESHOLD && p.handicap < BENCH_THRESHOLD,
    );
    const bench = remaining.filter((p) => p.handicap >= BENCH_THRESHOLD);

    // Start with must-play + preferred
    const pool = [...mustPlay, ...preferred];
    // Only add bench players if pool has fewer than 2
    if (pool.length < 2) {
      pool.push(...bench);
    }
    return pool;
  };

  // Helper: assign best pair from a candidate pool to an opponent match
  const assignMatch = (
    opp: typeof competitiveOpps[0],
    tierOverride?: MatchTier,
  ): boolean => {
    const pool = buildCandidatePool();
    if (pool.length < 2) return false;

    let bestScore = -1;
    let bestResult: ReturnType<typeof scorePairVsOpponent> | null = null;
    let bestPair: [AvailablePlayer, AvailablePlayer] | null = null;

    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        const result = scorePairVsOpponent(pool[i], pool[j], opp);
        if (result.totalScore > bestScore) {
          bestScore = result.totalScore;
          bestResult = result;
          bestPair = [pool[i], pool[j]];
        }
      }
    }

    if (bestPair && bestResult) {
      usedPlayerIds.add(bestPair[0].id);
      usedPlayerIds.add(bestPair[1].id);
      const tier = tierOverride ?? bestResult.tier;
      const reasoning = generateCounterReasoning(
        bestResult.strokeAnalysis,
        bestResult.effectiveSpread,
        tier,
        bestResult.pairData,
        bestResult.formResult,
        bestResult.venueResult,
        opp.isRedMatch,
        venueName,
        bestPair[0].name,
        bestPair[1].name,
      );
      matchups.push({
        matchNumber: opp.originalIndex + 1,
        ourPlayer1: bestPair[0],
        ourPlayer2: bestPair[1],
        opponent: opp,
        score: Math.round(bestScore * 1000) / 1000,
        tier,
        breakdown: bestResult.breakdown,
        strokeAnalysis: bestResult.strokeAnalysis,
        effectiveSpread: bestResult.effectiveSpread,
        reasoning,
      });
      return true;
    }
    return false;
  };

  // Phase 2a: Assign pairs to competitive matches (best matchup from strongest available)
  for (const opp of competitiveOpps) {
    assignMatch(opp);
  }

  // Phase 2b: Assign pairs to concession matches (still draws from strongest available first)
  for (const opp of concessionOpps) {
    assignMatch(opp, "concede");
  }

  // Safety net: ensure no must-play player (<14) is left on reserves
  const reserves = availablePlayers.filter((p) => !usedPlayerIds.has(p.id));
  const strandedMustPlay = reserves.filter(
    (p) => p.handicap < MUST_PLAY_THRESHOLD,
  );
  for (const mustPlay of strandedMustPlay) {
    // Find the matchup with the weakest (highest hcp) drafted player and swap
    let worstDraftedHcp = -1;
    let worstMatchIdx = -1;
    let worstSlot: 1 | 2 = 1;
    for (let mi = 0; mi < matchups.length; mi++) {
      const m = matchups[mi];
      if (m.ourPlayer1.handicap > worstDraftedHcp) {
        worstDraftedHcp = m.ourPlayer1.handicap;
        worstMatchIdx = mi;
        worstSlot = 1;
      }
      if (m.ourPlayer2.handicap > worstDraftedHcp) {
        worstDraftedHcp = m.ourPlayer2.handicap;
        worstMatchIdx = mi;
        worstSlot = 2;
      }
    }
    if (worstMatchIdx >= 0 && worstDraftedHcp > mustPlay.handicap) {
      const m = matchups[worstMatchIdx];
      const swappedOut = worstSlot === 1 ? m.ourPlayer1 : m.ourPlayer2;
      usedPlayerIds.delete(swappedOut.id);
      usedPlayerIds.add(mustPlay.id);
      if (worstSlot === 1) m.ourPlayer1 = mustPlay;
      else m.ourPlayer2 = mustPlay;
      // Re-score the matchup
      const updated = scorePairVsOpponent(m.ourPlayer1, m.ourPlayer2, m.opponent);
      m.score = Math.round(updated.totalScore * 1000) / 1000;
      m.breakdown = updated.breakdown;
      m.strokeAnalysis = updated.strokeAnalysis;
      m.effectiveSpread = updated.effectiveSpread;
      m.tier = m.tier === "concede" ? "concede" : updated.tier;
      m.reasoning = generateCounterReasoning(
        updated.strokeAnalysis,
        updated.effectiveSpread,
        m.tier,
        updated.pairData,
        updated.formResult,
        updated.venueResult,
        m.opponent.isRedMatch,
        venueName,
        m.ourPlayer1.name,
        m.ourPlayer2.name,
      );
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
      ? matchups.reduce((sum, m) => sum + m.breakdown.competitiveness, 0) /
        matchups.length
      : 0;
  const unpairedPlayers = availablePlayers.filter(
    (p) => !usedPlayerIds.has(p.id),
  );

  const tierSummary = {
    target: matchups.filter((m) => m.tier === "target").length,
    competitive: matchups.filter((m) => m.tier === "competitive").length,
    concede: matchups.filter((m) => m.tier === "concede").length,
  };

  return { matchups, totalNetStrokes, avgCompetitiveness, unpairedPlayers, tierSummary };
}
