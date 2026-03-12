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
  isPlayerInMatch,
  isOnOpponentSide,
  effectiveResult,
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

  // Handicap trend — chronological order (includes opponent-side appearances)
  const playerMatchesSorted = allMatches
    .filter((m) => isPlayerInMatch(m, player.id))
    .sort(
      (a, b) =>
        new Date(a.fixtureDate).getTime() - new Date(b.fixtureDate).getTime()
    );

  const handicapTrend = playerMatchesSorted.map((m) => {
    const onOppSide = isOnOpponentSide(m, player.id);
    let handicap: number;
    if (onOppSide) {
      handicap = m.opponent1Id === player.id ? m.opponent1Handicap : m.opponent2Handicap;
    } else {
      handicap = m.player1Id === player.id ? m.player1Handicap : m.player2Handicap;
    }
    return {
      date: m.fixtureDate,
      handicap,
      result: effectiveResult(m, player.id),
    };
  });

  // Match history — newest first (includes opponent-side appearances)
  const matchHistory = [...playerMatchesSorted].reverse().map((m) => {
    const onOppSide = isOnOpponentSide(m, player.id);
    let partnerId: number;
    let partnerName: string;
    let playerHandicap: number;

    if (onOppSide) {
      partnerId = m.opponent1Id === player.id ? (m.opponent2Id ?? 0) : (m.opponent1Id ?? 0);
      partnerName = m.opponent1Id === player.id
        ? (m.opponent2PlayerName ?? m.opponent2Name)
        : (m.opponent1PlayerName ?? m.opponent1Name);
      playerHandicap = m.opponent1Id === player.id ? m.opponent1Handicap : m.opponent2Handicap;
    } else {
      partnerId = m.player1Id === player.id ? m.player2Id : m.player1Id;
      partnerName = m.player1Id === player.id ? m.player2Name : m.player1Name;
      playerHandicap = m.player1Id === player.id ? m.player1Handicap : m.player2Handicap;
    }

    return {
      id: m.id,
      fixtureDate: m.fixtureDate,
      venueName: m.venueName,
      opponentClubName: m.opponentClubName,
      partnerId,
      partnerName,
      opponent1Name: onOppSide ? m.player1Name : m.opponent1Name,
      opponent2Name: onOppSide ? m.player2Name : m.opponent2Name,
      result: effectiveResult(m, player.id),
      margin: m.margin,
      playerHandicap,
    };
  });

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
