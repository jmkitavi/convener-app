import { db } from "@/db";
import { players } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { PlayersListClient } from "./players-list-client";
import { getAllMatches } from "@/lib/actions";
import { getPlayerForm, getPlayerStats, type MatchWithDetails } from "@/lib/analytics";
import { getDataScope } from "@/lib/data-scope";
import { selectMatchesByScope } from "@/lib/insights";

async function createPlayer(formData: FormData) {
  "use server";
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const phone = formData.get("phone") as string;
  const defaultHandicap = parseFloat(
    formData.get("defaultHandicap") as string
  );

  await db.insert(players).values({
    name,
    email: email || null,
    phone: phone || null,
    defaultHandicap,
  });

  revalidatePath("/players");
  revalidatePath("/", "layout");
}

async function updatePlayer(formData: FormData) {
  "use server";
  const id = parseInt(formData.get("id") as string);
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const phone = formData.get("phone") as string;
  const defaultHandicap = parseFloat(
    formData.get("defaultHandicap") as string
  );

  await db
    .update(players)
    .set({
      name,
      email: email || null,
      phone: phone || null,
      defaultHandicap,
    })
    .where(eq(players.id, id));

  revalidatePath("/players");
  revalidatePath("/", "layout");
}

async function togglePlayerActive(formData: FormData) {
  "use server";
  const id = parseInt(formData.get("id") as string);
  const currentActive = formData.get("active") === "true";

  await db
    .update(players)
    .set({ active: !currentActive })
    .where(eq(players.id, id));

  revalidatePath("/players");
  revalidatePath("/", "layout");
}

export default async function PlayersPage() {
  const [allPlayers, matchResult, scope] = await Promise.all([
    db.select().from(players).orderBy(players.name),
    getAllMatches(),
    getDataScope(),
  ]);
  const matches = selectMatchesByScope((matchResult.data ?? []) as MatchWithDetails[], scope);

  return (
    <PlayersListClient
      scope={scope}
      players={allPlayers.map((player) => ({
        ...player,
        stats: getPlayerStats(matches, player.id),
        form: getPlayerForm(matches, player.id, 5),
      }))}
      recordedFixtures={new Set(matches.filter((match) => match.result !== "pending").map((match) => match.fixtureId)).size}
      historyAvailable={matchResult.success}
      createPlayer={createPlayer}
      updatePlayer={updatePlayer}
      togglePlayerActive={togglePlayerActive}
    />
  );
}
