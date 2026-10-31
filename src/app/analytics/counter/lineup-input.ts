import type { OpponentPair } from "@/lib/pairing-engine";

export type OpponentRow = {
  opp1Name: string;
  opp1Handicap: string;
  opp2Name: string;
  opp2Handicap: string;
  isRedMatch: boolean;
};

export function completeOpponentPairs(rows: OpponentRow[]): OpponentPair[] {
  return rows
    .filter((row) => row.opp1Name.trim() && row.opp2Name.trim() && row.opp1Handicap.trim() && row.opp2Handicap.trim())
    .map((row) => ({
      opp1Name: row.opp1Name.trim(),
      opp1Handicap: Number(row.opp1Handicap),
      opp2Name: row.opp2Name.trim(),
      opp2Handicap: Number(row.opp2Handicap),
      isRedMatch: row.isRedMatch,
    }))
    .filter((pair) => Number.isFinite(pair.opp1Handicap) && Number.isFinite(pair.opp2Handicap));
}

export function moveOpponentRow(rows: OpponentRow[], index: number, direction: -1 | 1): OpponentRow[] {
  const target = index + direction;
  if (index < 0 || index >= rows.length || target < 0 || target >= rows.length) return rows;
  const next = [...rows];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
