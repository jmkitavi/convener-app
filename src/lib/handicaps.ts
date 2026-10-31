import { first, type Connection } from "@/db/connection";

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
export async function syncPlayerHandicaps(connection: Connection, playerIds: number[]): Promise<void> {
  for (const id of [...new Set(playerIds)].sort((a, b) => a - b)) {
    const row = await first<{ handicap: number }>(connection, `
      SELECT handicap FROM (
        SELECT player1_handicap AS handicap, fixture_id, id FROM matches WHERE player1_id = $1
        UNION ALL SELECT player2_handicap, fixture_id, id FROM matches WHERE player2_id = $1
        UNION ALL SELECT opponent1_handicap, fixture_id, id FROM matches WHERE opponent1_id = $1
        UNION ALL SELECT opponent2_handicap, fixture_id, id FROM matches WHERE opponent2_id = $1
      ) h JOIN fixtures f ON f.id = h.fixture_id
      WHERE handicap IS NOT NULL ORDER BY f.date DESC, h.id DESC LIMIT 1`, [id]);
    if (row) await connection.query("UPDATE players SET default_handicap = $1 WHERE id = $2", [row.handicap, id]);
  }
}
