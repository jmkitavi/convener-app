import { db } from "@/db";
import { players, opponentClubs } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { getAllMatches } from "@/lib/actions";
import type { MatchWithDetails } from "@/lib/analytics";
import { CounterClient } from "./counter-client";

export default async function CounterPage() {
  const activePlayers = await db
    .select()
    .from(players)
    .where(eq(players.active, true))
    .orderBy(asc(players.name));

  const allClubs = await db
    .select()
    .from(opponentClubs)
    .orderBy(asc(opponentClubs.name));

  const result = await getAllMatches();
  const allMatches = (result.data ?? []) as MatchWithDetails[];

  return (
    <CounterClient
      players={activePlayers}
      clubs={allClubs}
      allMatches={allMatches}
    />
  );
}
