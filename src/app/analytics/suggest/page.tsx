import { db } from "@/db";
import { players, opponentClubs } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { getAllMatches } from "@/lib/actions";
import type { MatchWithDetails } from "@/lib/analytics";
import { SuggestClient } from "./suggest-client";
import { getDataScope } from "@/lib/data-scope";
import { selectMatchesByScope } from "@/lib/insights";

export default async function SuggestPage() {
  const activePlayers = await db
    .select()
    .from(players)
    .where(eq(players.active, true))
    .orderBy(asc(players.name));

  const allClubs = await db
    .select()
    .from(opponentClubs)
    .orderBy(asc(opponentClubs.name));

  const [result, scope] = await Promise.all([getAllMatches(), getDataScope()]);
  const allMatches = selectMatchesByScope((result.data ?? []) as MatchWithDetails[], scope);

  return (
    <SuggestClient
      scope={scope}
      players={activePlayers}
      clubs={allClubs}
      allMatches={allMatches}
      historyError={!result.success}
    />
  );
}
