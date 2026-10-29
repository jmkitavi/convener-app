import type Database from "better-sqlite3";

export function parseMatchHandicap(value: FormDataEntryValue | null): number | null {
  if (value === null || (typeof value === "string" && value.trim() === "")) return null;
  if (typeof value !== "string") throw new Error("Invalid handicap");
  const handicap = Number(value);
  if (!Number.isFinite(handicap) || handicap < -8 || handicap > 54) {
    throw new Error("Handicap must be between -8 and 54, or blank if unknown");
  }
  return handicap;
}

/** Missing historical values must never erase or fabricate a player's default. */
export function syncPlayerHandicaps(sqlite: Database.Database, playerIds: number[]): void {
  const latest = sqlite.prepare(`
    SELECT CASE
      WHEN m.player1_id = @id THEN m.player1_handicap
      WHEN m.player2_id = @id THEN m.player2_handicap
      WHEN m.opponent1_id = @id THEN m.opponent1_handicap
      WHEN m.opponent2_id = @id THEN m.opponent2_handicap
    END AS handicap
    FROM matches m JOIN fixtures f ON f.id = m.fixture_id
    WHERE (m.player1_id = @id OR m.player2_id = @id OR m.opponent1_id = @id OR m.opponent2_id = @id)
      AND handicap IS NOT NULL
    ORDER BY f.date DESC, m.id DESC LIMIT 1
  `);
  const update = sqlite.prepare("UPDATE players SET default_handicap = ? WHERE id = ?");
  for (const id of new Set(playerIds)) {
    const row = latest.get({ id }) as { handicap: number } | undefined;
    if (row) update.run(row.handicap, id);
  }
}
