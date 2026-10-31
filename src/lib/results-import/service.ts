import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { first, rows as queryRows, transaction, type Connection } from "@/db/connection";
import { syncPlayerHandicaps } from "@/lib/handicaps";
import { reviewSchema, type ExistingMatch, type Person, type Preview, type Review, type ReviewRow } from "./contracts";
import { normalizeName } from "./normalize";

function samePair(a: number[], b: number[]) {
  return [...a].sort((x, y) => x - y).join() === [...b].sort((x, y) => x - y).join();
}

export async function validateReview(db: Connection, input: unknown): Promise<Review> {
  const review = reviewSchema.parse(input);
  if (!review.rows.some((row) => row.selected)) throw new Error("Select at least one row.");
  if (new Set(review.rows.map((row) => row.key)).size !== review.rows.length) throw new Error("Duplicate source row keys.");
  const fixture = review.fixtureId
    ? (await first(db, "SELECT * FROM fixtures WHERE id = $1", [review.fixtureId])) as { opponent_club_id: number } | undefined
    : null;
  if (review.fixtureId && !fixture) throw new Error("Fixture no longer exists.");
  if (!fixture && !review.clubId && !review.newClubName) throw new Error("Select a club or explicitly name a new club.");
  const clubId = fixture?.opponent_club_id ?? review.clubId;
  const club = clubId ? (await first(db, "SELECT id, name FROM opponent_clubs WHERE id = $1", [clubId])) as { id: number; name: string } | undefined : null;
  if (clubId && !club) throw new Error("Opponent club not found.");
  if (review.internal && !/Kenya Air\s*force/i.test(club?.name ?? review.newClubName)) {
    throw new Error("For an internal fixture, select the Kenya Air Force Golf Club entry (the two squad names are separate team labels).");
  }
  const participants = new Set<string>();
  const orders = new Set<number>();
  for (const row of review.rows.filter((row) => row.selected)) {
    if (!row.reviewed || !row.result) throw new Error("Review every selected row and resolve its outcome.");
    if (row.result === "halved" || row.result === "pending") row.margin = null;
    else if (row.margin && !/^(?:[1-9]\d?UP|[1-9]\d?&\d{1,2})$/.test(row.margin)) throw new Error("Use a margin such as 3&2 or 1UP.");
    if (row.margin?.endsWith("UP") && Number(row.margin.slice(0, -2)) > 18) throw new Error("Invalid match margin.");
    if (row.margin?.includes("&")) {
      const [up, remaining] = row.margin.split("&").map(Number);
      if (up > 18 || remaining >= up) throw new Error("Invalid match margin.");
    }
    if (row.order !== null) {
      if (orders.has(row.order)) throw new Error("Duplicate foursome number. Correct or skip the duplicate row.");
      orders.add(row.order);
    }
    for (const person of [...row.players, ...(review.internal ? row.opponents : [])]) {
      if (!person.name || (!person.id && !person.create)) throw new Error("Resolve every selected team player's identity or explicitly create them.");
      if (person.id && person.create) throw new Error("Choose an existing player OR create a player.");
      if (person.id && !(await first(db, "SELECT id FROM players WHERE id = $1", [person.id]))) throw new Error("Selected player no longer exists.");
      const key = person.id ? `id:${person.id}` : `name:${normalizeName(person.name)}`;
      if (participants.has(key)) throw new Error("A player appears more than once. Resolve duplicate assignments or skip the row.");
      participants.add(key);
    }
    if (row.opponents.some((person) => !person.name)) throw new Error("Both opponent names are required.");
    if (!review.internal && row.opponents.some((person) => person.id || person.create)) {
      throw new Error("External opponents should be names, not linked internal players.");
    }
  }
  return review;
}

export function valuesForRow(row: ReviewRow, internal: boolean, existing: ExistingMatch | null) {
  const hcp = (person: Person, name: string) => {
    if (person.handicap !== null) return person.handicap;
    if (person.clearHandicap) return null;
    if (!existing) return null;
    // Missing source values retain the value for the SAME player, not the same slot.
    if (person.id === existing.player1_id) return existing.player1_handicap;
    if (person.id === existing.player2_id) return existing.player2_handicap;
    if (person.id && person.id === existing.opponent1_id) return existing.opponent1_handicap;
    if (person.id && person.id === existing.opponent2_id) return existing.opponent2_handicap;
    if (normalizeName(name) === normalizeName(existing.opponent1_name)) return existing.opponent1_handicap;
    if (normalizeName(name) === normalizeName(existing.opponent2_name)) return existing.opponent2_handicap;
    return null;
  };
  return {
    player1_id: row.players[0].id, player2_id: row.players[1].id,
    player1_handicap: hcp(row.players[0], row.players[0].name),
    player2_handicap: hcp(row.players[1], row.players[1].name),
    opponent1_name: row.opponents[0].name, opponent2_name: row.opponents[1].name,
    opponent1_handicap: hcp(row.opponents[0], row.opponents[0].name),
    opponent2_handicap: hcp(row.opponents[1], row.opponents[1].name),
    opponent1_id: internal ? row.opponents[0].id : null,
    opponent2_id: internal ? row.opponents[1].id : null,
    result: row.result, margin: row.result === "halved" || row.result === "pending" || row.clearMargin ? null : row.margin ?? existing?.margin ?? null,
    match_order: row.order ?? existing?.match_order ?? null,
    notes: row.clearNotes ? null : row.notes || existing?.notes || null,
  };
}

export async function prepareReview(db: Connection, input: unknown): Promise<{ review: Review; preview: Preview }> {
  const review = await validateReview(db, input);
  const existing = review.fixtureId
    ? (await queryRows(db, "SELECT * FROM matches WHERE fixture_id = $1 ORDER BY id", [review.fixtureId])) as ExistingMatch[] : [];
  const used = new Set<number>();
  const rows = review.rows.filter((row) => row.selected).map((row) => {
    let candidates: ExistingMatch[];
    if (row.matchId) candidates = existing.filter((match) => match.id === row.matchId);
    else candidates = existing.filter((match) => row.players.every((p) => p.id) &&
      samePair([match.player1_id, match.player2_id], row.players.map((p) => p.id!)));
    if (candidates.length > 1) throw new Error(`Multiple matches fit foursome ${row.order ?? row.key}. Select the existing match explicitly.`);
    const before = candidates[0] ?? null;
    if (row.matchId && !before) throw new Error("Existing match does not belong to this fixture.");
    if (before && used.has(before.id)) throw new Error("Two source rows target the same existing match.");
    if (!before && existing.some((match) => row.order !== null && match.match_order === row.order)) {
      throw new Error(`Foursome ${row.order} already exists with different players. Select that match explicitly or correct the number.`);
    }
    if (before) used.add(before.id);
    const values = valuesForRow(row, review.internal, before);
    const changes = before ? Object.entries(values).filter(([key, value]) => before[key as keyof ExistingMatch] !== value).map(([key]) => key) : [];
    return { key: row.key, operation: before ? changes.length ? "update" as const : "unchanged" as const : "add" as const, matchId: before?.id ?? null, before, changes, after: values };
  });
  const fixtureSnapshot = review.fixtureId
    ? JSON.stringify((await first(db, "SELECT * FROM fixtures WHERE id = $1", [review.fixtureId]))) : null;
  return { review, preview: { version: randomUUID(), rows, fixtureSnapshot } };
}

async function resolvePerson(db: Connection, person: Person) {
  if (person.id) return person.id;
  const existing = ((await queryRows(db, "SELECT id, name FROM players", [])) as { id: number; name: string }[])
    .filter((p) => normalizeName(p.name) === normalizeName(person.name));
  if (existing.length) throw new Error(`Player "${person.name}" already exists. Select their identity and review again.`);
  return (await first<{ id: number }>(db, "INSERT INTO players (name, default_handicap, active, created_at) VALUES ($1, $2, true, $3) RETURNING id", [person.name, person.handicap ?? 18, new Date().toISOString()]))!.id;
}

export type CommitResult = { fixtureId: number; added: number; updated: number; unchanged: number; skipped: number };

export async function commitReview(pool: Pool, id: string, version: string, approvals: string[]): Promise<CommitResult> {
  return transaction(pool, async (db) => {
    // Block ordinary writes as well as other imports while rechecking and applying the review.
    await db.query("LOCK TABLE players, opponent_clubs, fixtures, matches IN SHARE ROW EXCLUSIVE MODE");
    const draft = (await first(db, "SELECT * FROM result_imports WHERE id = $1 FOR UPDATE", [id])) as {
      status: string; expires_at: string; data: string; commit_result: string | null;
    } | undefined;
    if (!draft) throw new Error("Import not found.");
    if (draft.status === "committed") return JSON.parse(draft.commit_result!);
    if (draft.status !== "prepared" || draft.expires_at <= new Date().toISOString()) throw new Error("Review is not ready or has expired.");
    const data = JSON.parse(draft.data);
    const review = await validateReview(db, data.review);
    const preview: Preview = data.preview;
    if (preview.version !== version) throw new Error("Review changed. Prepare it again.");
    if (review.fixtureId && JSON.stringify((await first(db, "SELECT * FROM fixtures WHERE id = $1", [review.fixtureId]))) !== preview.fixtureSnapshot) {
      throw new Error("Fixture changed during review. Prepare the preview again.");
    }
    for (const proposal of preview.rows) {
      if (proposal.before && JSON.stringify((await first(db, "SELECT * FROM matches WHERE id = $1", [proposal.before.id]))) !== JSON.stringify(proposal.before)) {
        throw new Error("A match changed during review. Prepare the preview again.");
      }
    }
    // Also detect a new overlapping row inserted after the preview.
    const refreshed = await prepareReview(db, review);
    if (JSON.stringify(refreshed.preview.rows) !== JSON.stringify(preview.rows)) throw new Error("Match list changed. Prepare the preview again.");
    const eligible = preview.rows.filter((p) => p.operation !== "update" || approvals.includes(p.key));
    if (!eligible.length) throw new Error("No additions, unchanged rows or approved updates selected.");
    let fixtureId = review.fixtureId;
    if (!fixtureId) {
      let clubId = review.clubId;
      if (!clubId) {
        const duplicate = ((await queryRows(db, "SELECT id, name FROM opponent_clubs", [])) as { id: number; name: string }[])
          .find((club) => normalizeName(club.name) === normalizeName(review.newClubName));
        if (duplicate) throw new Error("That club already exists. Select it and review again.");
        clubId = (await first<{ id: number }>(db, "INSERT INTO opponent_clubs (name) VALUES ($1) RETURNING id", [review.newClubName]))!.id;
      }
      if ((await first(db, "SELECT id FROM fixtures WHERE date = $1 AND opponent_club_id = $2", [review.date, clubId]))) {
        throw new Error("A fixture with that date and club already exists. Select it and review again.");
      }
      fixtureId = (await first<{ id: number }>(db, "INSERT INTO fixtures (date, opponent_club_id, home_away, venue_name, team_name, opponent_team_name, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id", [review.date, clubId, review.homeAway, review.venueName, review.teamName, review.opponentTeamName, new Date().toISOString()]))!.id;
    } else {
      (await db.query("UPDATE fixtures SET date = $1, home_away = $2, venue_name = $3, team_name = $4, opponent_team_name = $5 WHERE id = $6", [review.date, review.homeAway, review.venueName, review.teamName, review.opponentTeamName, fixtureId]));
    }
    const result: CommitResult = { fixtureId, added: 0, updated: 0, unchanged: 0, skipped: review.rows.length - eligible.length };
    const touched = new Set<number>();
    const links: { key: string; matchId: number }[] = [];
    for (const proposal of eligible) {
      const row = review.rows.find((row) => row.key === proposal.key)!;
      if (proposal.operation === "unchanged") {
        result.unchanged++;
        links.push({ key: row.key, matchId: proposal.matchId! });
        continue;
      }
      for (const person of [...row.players, ...(review.internal ? row.opponents : [])]) {
        person.id = await resolvePerson(db, person);
        touched.add(person.id);
      }
      const values = valuesForRow(row, review.internal, proposal.before);
      let matchId = proposal.matchId;
      if (matchId) {
        await db.query(`UPDATE matches SET ${Object.keys(values).map((key, index) => `${key} = $${index + 1}`).join(", ")} WHERE id = $${Object.keys(values).length + 1}`,
          [...Object.values(values), matchId]);
        result.updated++;
      } else {
        matchId = (await first<{ id: number }>(db, `INSERT INTO matches (fixture_id, ${Object.keys(values).join(", ")}) VALUES ($1, ${Object.keys(values).map((_, index) => `$${index + 2}`).join(", ")}) RETURNING id`,
          [fixtureId, ...Object.values(values)]))!.id;
        result.added++;
      }
      links.push({ key: row.key, matchId });
    }
    await syncPlayerHandicaps(db, [...touched]);
    (await db.query("UPDATE result_imports SET status = 'committed', data = $1, commit_result = $2 WHERE id = $3", [JSON.stringify({ pageCount: data.pageCount, extractionVersion: data.extractionVersion, model: data.model, matchLinks: links }), JSON.stringify(result), id]));
    return result;
  });
}
