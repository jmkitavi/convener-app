import { db } from "@/db";
import { players, courses } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { getAllMatches } from "@/lib/actions";
import type { MatchWithDetails } from "@/lib/analytics";
import { SuggestClient } from "./suggest-client";

export default async function SuggestPage() {
  const activePlayers = await db
    .select()
    .from(players)
    .where(eq(players.active, true))
    .orderBy(asc(players.name));

  const allCourses = await db
    .select()
    .from(courses)
    .orderBy(asc(courses.name));

  const result = await getAllMatches();
  const allMatches = (result.data ?? []) as MatchWithDetails[];

  return (
    <SuggestClient
      players={activePlayers}
      courses={allCourses}
      allMatches={allMatches}
    />
  );
}
