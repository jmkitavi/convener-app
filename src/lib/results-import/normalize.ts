import type { Extraction, Outcome, Person, PlayerOption, Review, ReviewRow, Side } from "./contracts";

function readResult(raw: string | null) {
  if (!raw?.trim() || /^[-\u2013\u2014]+$/.test(raw.trim())) return null;
  const cleaned = raw.toUpperCase().replace(/\s/g, "");
  if (["A/S", "AS", "ALLSQUARE", "HALVED"].includes(cleaned)) return { kind: "halved" as const, margin: null };
  if (["LOST", "LOSS", "L"].includes(cleaned)) return { kind: "loss" as const, margin: null };
  if (["WON", "WIN", "W"].includes(cleaned)) return { kind: "win" as const, margin: null };
  const up = cleaned.match(/^([1-9]\d?)UP$/);
  if (up && Number(up[1]) <= 18) return { kind: "win" as const, margin: `${Number(up[1])}UP` };
  const score = cleaned.match(/^([1-9]\d?)[/&]([0-9]\d?)$/);
  if (score && Number(score[2]) < Number(score[1]) && Number(score[1]) <= 18) {
    return { kind: "win" as const, margin: `${Number(score[1])}&${Number(score[2])}` };
  }
  return { kind: "unknown" as const, margin: null };
}

export function normalizeResult(left: string | null, right: string | null, side: Side): {
  result: Outcome | null; margin: string | null; warning?: string;
} {
  const a = readResult(left), b = readResult(right);
  if (a?.kind === "unknown" || b?.kind === "unknown") return { result: null, margin: null, warning: "Unclear or annotated result: confirm the reading." };
  if (!a && !b) return { result: null, margin: null, warning: "No readable result. Confirm or explicitly choose pending." };
  if (a?.kind === "halved" || b?.kind === "halved") {
    if ((a && a.kind !== "halved") || (b && b.kind !== "halved")) return { result: null, margin: null, warning: "Conflicting draw and win/loss markings." };
    return { result: "halved", margin: null };
  }
  if (a && b && a.kind === b.kind) return { result: null, margin: null, warning: "Both sides show the same outcome. Confirm the winning side." };
  const leftWon = a ? a.kind === "win" : b?.kind === "loss";
  return {
    result: (side === "left" ? leftWon : !leftWon) ? "win" : "loss",
    margin: a?.margin ?? b?.margin ?? null,
  };
}

export function normalizeName(name: string) {
  return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export type DuplicatePlayerOccurrence = {
  rowIndex: number;
  order: number | null;
  group: "players" | "opponents";
  personIndex: number;
};

export function findDuplicatePlayerAssignments(review: Review) {
  const assignments = new Map<string, {
    identity: string;
    playerId: number | null;
    name: string;
    occurrences: DuplicatePlayerOccurrence[];
  }>();
  review.rows.forEach((row, rowIndex) => {
    if (!row.selected) return;
    for (const group of review.internal ? ["players", "opponents"] as const : ["players"] as const) {
      row[group].forEach((person, personIndex) => {
        const identity = person.id ? `id:${person.id}` : person.create && person.name.trim() ? `name:${normalizeName(person.name)}` : null;
        if (!identity) return;
        const assignment = assignments.get(identity) ?? { identity, playerId: person.id, name: person.name, occurrences: [] };
        assignment.occurrences.push({ rowIndex, order: row.order, group, personIndex });
        assignments.set(identity, assignment);
      });
    }
  });
  return [...assignments.values()].filter((assignment) => assignment.occurrences.length > 1);
}

export type DuplicatePlayerAssignment = ReturnType<typeof findDuplicatePlayerAssignments>[number];

export function rowConfirmationIssues(row: ReviewRow, internal: boolean): string[] {
  if (!row.selected) return ["Include this row before confirming."];
  const issues: string[] = [];
  if (!row.result) issues.push("Select an outcome for our side.");
  for (const [group, people, linked] of [
    ["Our player", row.players, true],
    ["Opponent", row.opponents, internal],
  ] as const) {
    people.forEach((person, i) => {
      if (!person.name.trim()) issues.push(`${group} ${i + 1} name is missing.`);
      else if (linked && !person.id && !person.create) issues.push(`${group} ${i + 1} identity needs confirmation.`);
    });
  }
  return issues;
}

function nameTokens(name: string): string[] {
  return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function similarity(a: string, b: string) {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return 1 - previous[b.length] / Math.max(a.length, b.length, 1);
}

function tokenCompatible(a: string, b: string) {
  return a === b || (Math.min(a.length, b.length) === 1 && a[0] === b[0]);
}

function allTokensMatch(a: string[], b: string[]): boolean {
  if (!a.length) return !b.length;
  return b.some((token, i) => tokenCompatible(a[0], token) && allTokensMatch(a.slice(1), b.filter((_, j) => j !== i)));
}

export function resolvePlayer(name: string, players: PlayerOption[]) {
  const tokens = nameTokens(name);
  const normalized = normalizeName(name);
  const candidates = players.map((player) => {
    const other = nameTokens(player.name);
    const fullAnchor = tokens.some((token) => token.length >= 3 && other.includes(token));
    if (fullAnchor && normalized === normalizeName(player.name)) return { player, score: 1, reason: "Exact name match" };
    if (fullAnchor && tokens.length >= 2 && tokens.length === other.length && tokens.length <= 6 && allTokensMatch(tokens, other)) {
      return { player, score: 0.96, reason: "Matching name and initials" };
    }
    const tokenScore = (a: string[], b: string[]) => a.reduce((total, token) => total + Math.max(0, ...b.map((otherToken) =>
      token === otherToken ? 1 : tokenCompatible(token, otherToken) ? 0.6 : similarity(token, otherToken) * 0.8,
    )), 0) / Math.max(a.length, b.length, 1);
    const score = Math.max(
      similarity(normalized, normalizeName(player.name)) * 0.8,
      (tokenScore(tokens, other) + tokenScore(other, tokens)) / 2 * 0.89,
    );
    return { player, score, reason: fullAnchor ? "Partial name match; confirm identity" : "Similar spelling; confirm identity" };
  }).filter((candidate) => normalized.length >= 3 && candidate.score >= 0.5)
    .sort((a, b) => b.score - a.score || a.player.name.localeCompare(b.player.name) || a.player.id - b.player.id)
    .slice(0, 8);
  const best = candidates[0];
  const strong = Boolean(best && best.score >= 0.96 && (!candidates[1] || best.score - candidates[1].score >= 0.08));
  return { candidates, suggestedId: best?.player.id ?? null, confidentId: strong ? best.player.id : null };
}

export function playerCandidates(name: string, players: PlayerOption[]) {
  return resolvePlayer(name, players).candidates.map((candidate) => candidate.player);
}

export function resolvePersonIdentity(person: Person, players: PlayerOption[]): Person {
  if (person.id || person.create || person.identitySource === "manual") return person;
  const id = resolvePlayer(person.name, players).confidentId;
  return id ? { ...person, id, identitySource: "automatic" } : person;
}

export function resolveReviewIdentities(review: Review, players: PlayerOption[]): Review {
  const rows = review.rows.map((row) => ({
    ...row,
    players: row.players.map((person) => resolvePersonIdentity(person, players)) as [Person, Person],
    opponents: row.opponents.map((person) => review.internal ? resolvePersonIdentity(person, players) : { ...person, id: null, create: false, identitySource: undefined }) as [Person, Person],
  }));
  const counts = new Map<number, number>();
  for (const row of rows.filter((row) => row.selected)) {
    for (const person of [...row.players, ...(review.internal ? row.opponents : [])]) {
      if (person.id) counts.set(person.id, (counts.get(person.id) ?? 0) + 1);
    }
  }
  const clearDuplicates = (person: Person): Person => person.id && person.identitySource === "automatic" && (counts.get(person.id) ?? 0) > 1
    ? { ...person, id: null, identitySource: undefined } : person;
  return {
    ...review,
    rows: rows.map((row, i) => {
      const next = {
        ...row,
        players: row.players.map(clearDuplicates) as [Person, Person],
        opponents: row.opponents.map(clearDuplicates) as [Person, Person],
      };
      const changed = [...next.players, ...next.opponents].some((person, j) => person.id !== [...review.rows[i].players, ...review.rows[i].opponents][j].id);
      return changed ? { ...next, reviewed: false } : next;
    }),
  };
}

export function initialReview(extraction: Extraction, players: PlayerOption[], side: Side): Review {
  const person = (p: Extraction["rows"][number]["left"][number]): Person => {
    return { id: null, name: p.name ?? "", handicap: p.handicap, create: false };
  };
  return resolveReviewIdentities({
    fixtureId: null, clubId: null, newClubName: "", date: extraction.date ?? "",
    homeAway: "away", venueName: extraction.venue ?? "",
    teamName: (side === "left" ? extraction.leftTeam : extraction.rightTeam) ?? "",
    opponentTeamName: (side === "left" ? extraction.rightTeam : extraction.leftTeam) ?? "",
    side, internal: false, fixtureConfirmed: true,
    rows: extraction.rows.map((row, i) => {
      const score = normalizeResult(row.leftResult, row.rightResult, side);
      return {
        key: `source-${i}`, page: row.page, order: row.order, selected: true, reviewed: false,
        players: (side === "left" ? row.left : row.right).map(person) as [Person, Person],
        opponents: (side === "left" ? row.right : row.left).map((p) => ({ ...person(p), id: null, create: false })) as [Person, Person],
        result: score.result, margin: score.margin, matchId: null,
        notes: [row.tee ? `Starting tee: ${row.tee}` : "", ...row.warnings].filter(Boolean).join("\n"),
      };
    }),
  }, players);
}
