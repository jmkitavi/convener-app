import { db } from "@/db";
import { players } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { getAllMatches } from "@/lib/actions";
import {
  getPlayerStats,
  getPlayerForm,
  getPlayerVenueStats,
  type MatchWithDetails,
} from "@/lib/analytics";
import { PlayerDetailClient } from "./player-detail-client";

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

  revalidatePath(`/players/${id}`);
  revalidatePath("/players");
}

async function togglePlayerActive(formData: FormData) {
  "use server";
  const id = parseInt(formData.get("id") as string);
  const currentActive = formData.get("active") === "true";

  await db
    .update(players)
    .set({ active: !currentActive })
    .where(eq(players.id, id));

  revalidatePath(`/players/${id}`);
  revalidatePath("/players");
}

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [player] = await db
    .select()
    .from(players)
    .where(eq(players.id, parseInt(id)));

  if (!player) {
    notFound();
  }

  const matchResult = await getAllMatches();
  const allMatches = (matchResult.data ?? []) as MatchWithDetails[];

  const stats = getPlayerStats(allMatches, player.id);
  const form = getPlayerForm(allMatches, player.id, 10);
  const venueStats = getPlayerVenueStats(allMatches, player.id);

  // Handicap trend — chronological order
  const playerMatchesSorted = allMatches
    .filter((m) => m.player1Id === player.id || m.player2Id === player.id)
    .sort(
      (a, b) =>
        new Date(a.fixtureDate).getTime() - new Date(b.fixtureDate).getTime()
    );

  const handicapTrend = playerMatchesSorted.map((m) => ({
    date: m.fixtureDate,
    handicap:
      m.player1Id === player.id ? m.player1Handicap : m.player2Handicap,
    result: m.result,
  }));

  // Match history — newest first
  const matchHistory = [...playerMatchesSorted].reverse().map((m) => ({
    id: m.id,
    fixtureDate: m.fixtureDate,
    courseName: m.courseName,
    opponentClubName: m.opponentClubName,
    partnerId: m.player1Id === player.id ? m.player2Id : m.player1Id,
    partnerName:
      m.player1Id === player.id ? m.player2Name : m.player1Name,
    opponent1Name: m.opponent1Name,
    opponent2Name: m.opponent2Name,
    result: m.result,
    margin: m.margin,
    playerHandicap:
      m.player1Id === player.id ? m.player1Handicap : m.player2Handicap,
  }));

  return (
    <PlayerDetailClient
      player={player}
      stats={stats}
      form={form}
      venueStats={venueStats}
      handicapTrend={handicapTrend}
      matchHistory={matchHistory}
      updatePlayer={updatePlayer}
      togglePlayerActive={togglePlayerActive}
    />
  );
}
