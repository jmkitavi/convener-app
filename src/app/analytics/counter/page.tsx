import { db } from "@/db";
import { players, opponentClubs } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { getAllMatches, getLineups } from "@/lib/actions";
import type { MatchWithDetails } from "@/lib/analytics";
import { CounterClient } from "./counter-client";
import { getDataScope } from "@/lib/data-scope";
import { selectMatchesByScope } from "@/lib/insights";

export const dynamic = "force-dynamic";

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

  const [result, scope] = await Promise.all([getAllMatches(), getDataScope()]);
  const allMatches = selectMatchesByScope((result.data ?? []) as MatchWithDetails[], scope);

  const lineupsResult = await getLineups();
  const savedLineups = lineupsResult.data ?? [];

  return (
    <CounterClient
      scope={scope}
      players={activePlayers}
      clubs={allClubs}
      allMatches={allMatches}
      savedLineups={savedLineups}
      historyError={!result.success}
      savedLineupsError={!lineupsResult.success}
    />
  );
}
