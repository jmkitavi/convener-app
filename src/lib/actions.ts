"use server";

import { db } from "@/db";
import {
  players,
  opponentClubs,
  fixtures,
  matches,
  opponentLineups,
  opponentLineupPairs,
} from "@/db/schema";
import { eq, desc, asc, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { syncPlayerHandicaps } from "@/lib/handicaps";

type ActionResult<T = undefined> = T extends undefined
  ? { success: boolean; error?: string }
  : { success: boolean; error?: string; data?: T };

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

export async function createPlayer(data: {
  name: string;
  email?: string;
  phone?: string;
  defaultHandicap?: number;
}) {
  try {
    const result = (await db
      .insert(players)
      .values({
        name: data.name,
        email: data.email ?? null,
        phone: data.phone ?? null,
        defaultHandicap: data.defaultHandicap ?? 18,
      })
      .returning())[0];
    revalidatePath("/", "layout");
    revalidatePath("/players");
    return { success: true, data: result };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function updatePlayer(
  id: number,
  data: {
    name?: string;
    email?: string | null;
    phone?: string | null;
    defaultHandicap?: number;
    active?: boolean;
  },
) {
  try {
    const result = (await db
      .update(players)
      .set(data)
      .where(eq(players.id, id))
      .returning())[0];
    revalidatePath("/", "layout");
    revalidatePath("/players");
    revalidatePath(`/players/${id}`);
    return { success: true, data: result };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function togglePlayerActive(id: number) {
  try {
    const player = (await db
      .select()
      .from(players)
      .where(eq(players.id, id)))[0];
    if (!player) return { success: false, error: "Player not found" };

    const result = (await db
      .update(players)
      .set({ active: !player.active })
      .where(eq(players.id, id))
      .returning())[0];
    revalidatePath("/", "layout");
    revalidatePath("/players");
    revalidatePath(`/players/${id}`);
    return { success: true, data: result };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function getPlayers(activeOnly = false) {
  try {
    const query = activeOnly
      ? await db
          .select()
          .from(players)
          .where(eq(players.active, true))
          .orderBy(asc(players.name))
      : await db.select().from(players).orderBy(asc(players.name));
    return { success: true, data: query };
  } catch (e) {
    return { success: false, error: (e as Error).message, data: [] as (typeof players.$inferSelect)[] };
  }
}

export async function getPlayer(id: number) {
  try {
    const result = (await db
      .select()
      .from(players)
      .where(eq(players.id, id)))[0];
    if (!result) return { success: false, error: "Player not found" };
    return { success: true, data: result };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Opponent Clubs
// ---------------------------------------------------------------------------

export async function createClub(data: {
  name: string;
  par?: number;
  slopeRating?: number;
  courseRating?: number;
}) {
  try {
    const result = (await db
      .insert(opponentClubs)
      .values({
        name: data.name,
        par: data.par ?? null,
        slopeRating: data.slopeRating ?? null,
        courseRating: data.courseRating ?? null,
      })
      .returning())[0];
    revalidatePath("/", "layout");
    revalidatePath("/clubs");
    return { success: true, data: result };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function updateClub(
  id: number,
  data: {
    name?: string;
    par?: number | null;
    slopeRating?: number | null;
    courseRating?: number | null;
  },
) {
  try {
    const result = (await db
      .update(opponentClubs)
      .set(data)
      .where(eq(opponentClubs.id, id))
      .returning())[0];
    revalidatePath("/", "layout");
    revalidatePath("/clubs");
    revalidatePath(`/clubs/${id}`);
    return { success: true, data: result };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function deleteClub(id: number) {
  try {
    const fixtureUsingClub = (await db
      .select({ id: fixtures.id })
      .from(fixtures)
      .where(eq(fixtures.opponentClubId, id)))[0];
    if (fixtureUsingClub) {
      return {
        success: false,
        error: "Cannot delete club that is referenced by a fixture",
      };
    }
    await db.delete(opponentClubs).where(eq(opponentClubs.id, id));
    revalidatePath("/", "layout");
    revalidatePath("/clubs");
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function getClubs() {
  try {
    const result = await db
      .select()
      .from(opponentClubs)
      .orderBy(asc(opponentClubs.name));
    return { success: true, data: result };
  } catch (e) {
    return { success: false, error: (e as Error).message, data: [] as (typeof opponentClubs.$inferSelect)[] };
  }
}

export async function getClub(id: number) {
  try {
    const result = (await db
      .select()
      .from(opponentClubs)
      .where(eq(opponentClubs.id, id)))[0];
    if (!result) return { success: false, error: "Club not found" };
    return { success: true, data: result };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

export async function createFixture(data: {
  date: string;
  opponentClubId: number;
  homeAway?: "home" | "away" | "neutral";
  venueName?: string | null;
  teamName?: string | null;
  opponentTeamName?: string | null;
  notes?: string;
}) {
  try {
    const result = (await db
      .insert(fixtures)
      .values({
        date: data.date,
        opponentClubId: data.opponentClubId,
        homeAway: data.homeAway ?? "home",
        venueName: data.venueName?.trim() || null,
        teamName: data.teamName?.trim() || null,
        opponentTeamName: data.opponentTeamName?.trim() || null,
        notes: data.notes ?? null,
      })
      .returning())[0];
    revalidatePath("/", "layout");
    revalidatePath("/fixtures");
    return { success: true, data: result };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function updateFixture(
  id: number,
  data: {
    date?: string;
    opponentClubId?: number;
    homeAway?: "home" | "away" | "neutral";
    venueName?: string | null;
    teamName?: string | null;
    opponentTeamName?: string | null;
    notes?: string | null;
  },
) {
  try {
    const result = (await db
      .update(fixtures)
      .set({
        ...data,
        ...(data.venueName !== undefined ? { venueName: data.venueName?.trim() || null } : {}),
        ...(data.teamName !== undefined ? { teamName: data.teamName?.trim() || null } : {}),
        ...(data.opponentTeamName !== undefined ? { opponentTeamName: data.opponentTeamName?.trim() || null } : {}),
      })
      .where(eq(fixtures.id, id))
      .returning())[0];
    revalidatePath("/", "layout");
    revalidatePath("/fixtures");
    revalidatePath(`/fixtures/${id}`);
    return { success: true, data: result };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function deleteFixture(id: number) {
  try {
    // Matches cascade-delete via FK, so just delete the fixture
    await db.delete(fixtures).where(eq(fixtures.id, id));
    revalidatePath("/", "layout");
    revalidatePath("/fixtures");
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function getFixtures() {
  try {
    const result = await db
      .select()
      .from(fixtures)
      .orderBy(asc(fixtures.date));
    return { success: true, data: result };
  } catch (e) {
    return { success: false, error: (e as Error).message, data: [] as (typeof fixtures.$inferSelect)[] };
  }
}

export async function getFixture(id: number) {
  try {
    const result = (await db
      .select()
      .from(fixtures)
      .where(eq(fixtures.id, id)))[0];
    if (!result) return { success: false, error: "Fixture not found" };
    return { success: true, data: result };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function getFixtureWithDetails(id: number) {
  try {
    const result = (await db
      .select({
        id: fixtures.id,
        date: fixtures.date,
        opponentClubId: fixtures.opponentClubId,
        homeAway: fixtures.homeAway,
        notes: fixtures.notes,
        teamName: fixtures.teamName,
        opponentTeamName: fixtures.opponentTeamName,
        explicitVenueName: fixtures.venueName,
        createdAt: fixtures.createdAt,
        opponentClubName: opponentClubs.name,
        venueName: sql<string>`COALESCE(NULLIF(TRIM(${fixtures.venueName}), ''), CASE WHEN ${fixtures.homeAway} = 'home' THEN 'Kenya Air Force Golf Club' ELSE ${opponentClubs.name} END)`.as("venue_name"),
        clubPar: opponentClubs.par,
        clubSlopeRating: opponentClubs.slopeRating,
        clubCourseRating: opponentClubs.courseRating,
      })
      .from(fixtures)
      .innerJoin(opponentClubs, eq(fixtures.opponentClubId, opponentClubs.id))
      .where(eq(fixtures.id, id)))[0];
    if (!result) return { success: false, error: "Fixture not found" };
    return { success: true, data: result };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function getFixturesWithDetails() {
  try {
    const result = await db
      .select({
        id: fixtures.id,
        date: fixtures.date,
        opponentClubId: fixtures.opponentClubId,
        homeAway: fixtures.homeAway,
        notes: fixtures.notes,
        teamName: fixtures.teamName,
        opponentTeamName: fixtures.opponentTeamName,
        explicitVenueName: fixtures.venueName,
        createdAt: fixtures.createdAt,
        opponentClubName: opponentClubs.name,
        venueName: sql<string>`COALESCE(NULLIF(TRIM(${fixtures.venueName}), ''), CASE WHEN ${fixtures.homeAway} = 'home' THEN 'Kenya Air Force Golf Club' ELSE ${opponentClubs.name} END)`.as("venue_name"),
      })
      .from(fixtures)
      .innerJoin(opponentClubs, eq(fixtures.opponentClubId, opponentClubs.id))
      .orderBy(asc(fixtures.date));
    return { success: true, data: result };
  } catch (e) {
    return { success: false, error: (e as Error).message, data: [] as Array<{
      id: number;
      date: string;
      opponentClubId: number;
      homeAway: string;
      notes: string | null;
      teamName: string | null;
      opponentTeamName: string | null;
      explicitVenueName: string | null;
      createdAt: string;
      opponentClubName: string;
      venueName: string;
    }> };
  }
}

// ---------------------------------------------------------------------------
// Matches
// ---------------------------------------------------------------------------

export async function createMatch(data: {
  fixtureId: number;
  player1Id: number;
  player2Id: number;
  player1Handicap: number | null;
  player2Handicap: number | null;
  opponent1Name: string;
  opponent2Name: string;
  opponent1Handicap: number | null;
  opponent2Handicap: number | null;
  opponent1Id?: number | null;
  opponent2Id?: number | null;
  result: "win" | "loss" | "halved" | "pending";
  margin?: string;
  matchOrder?: number;
  notes?: string;
}) {
  try {
    const result = (await db
      .insert(matches)
      .values({
        fixtureId: data.fixtureId,
        player1Id: data.player1Id,
        player2Id: data.player2Id,
        player1Handicap: data.player1Handicap,
        player2Handicap: data.player2Handicap,
        opponent1Name: data.opponent1Name,
        opponent2Name: data.opponent2Name,
        opponent1Handicap: data.opponent1Handicap,
        opponent2Handicap: data.opponent2Handicap,
        opponent1Id: data.opponent1Id ?? null,
        opponent2Id: data.opponent2Id ?? null,
        result: data.result,
        margin: data.margin ?? null,
        matchOrder: data.matchOrder ?? null,
        notes: data.notes ?? null,
      })
      .returning())[0];
    await syncPlayerHandicaps(db.$client, [data.player1Id, data.player2Id, data.opponent1Id, data.opponent2Id].filter((id): id is number => id != null));
    revalidatePath("/", "layout");
    revalidatePath(`/fixtures/${data.fixtureId}`);
    revalidatePath("/fixtures");
    return { success: true, data: result };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function updateMatch(
  id: number,
  data: {
    player1Id?: number;
    player2Id?: number;
    player1Handicap?: number | null;
    player2Handicap?: number | null;
    opponent1Name?: string;
    opponent2Name?: string;
    opponent1Handicap?: number | null;
    opponent2Handicap?: number | null;
    opponent1Id?: number | null;
    opponent2Id?: number | null;
    result?: "win" | "loss" | "halved" | "pending";
    margin?: string | null;
    matchOrder?: number | null;
    notes?: string | null;
  },
) {
  try {
    const previous = (await db.select().from(matches).where(eq(matches.id, id)))[0];
    const result = (await db
      .update(matches)
      .set(data)
      .where(eq(matches.id, id))
      .returning())[0];
    if (result) {
      await syncPlayerHandicaps(db.$client, [previous, result].flatMap((match) => match
        ? [match.player1Id, match.player2Id, match.opponent1Id, match.opponent2Id].filter((id): id is number => id != null)
        : []));
      revalidatePath(`/fixtures/${result.fixtureId}`);
    }
    revalidatePath("/", "layout");
    revalidatePath("/fixtures");
    return { success: true, data: result };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function deleteMatch(id: number) {
  try {
    const match = (await db
      .select()
      .from(matches)
      .where(eq(matches.id, id)))[0];
    await db.delete(matches).where(eq(matches.id, id));
    if (match) {
      await syncPlayerHandicaps(db.$client, [match.player1Id, match.player2Id, match.opponent1Id, match.opponent2Id].filter((id): id is number => id != null));
      revalidatePath(`/fixtures/${match.fixtureId}`);
    }
    revalidatePath("/", "layout");
    revalidatePath("/fixtures");
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function getMatchesByFixture(fixtureId: number) {
  try {
    const p1 = db
      .select({
        id: players.id,
        name: players.name,
      })
      .from(players)
      .as("p1");

    const p2 = db
      .select({
        id: players.id,
        name: players.name,
      })
      .from(players)
      .as("p2");

    const result = await db
      .select({
        id: matches.id,
        fixtureId: matches.fixtureId,
        player1Id: matches.player1Id,
        player2Id: matches.player2Id,
        player1Handicap: matches.player1Handicap,
        player2Handicap: matches.player2Handicap,
        opponent1Name: matches.opponent1Name,
        opponent2Name: matches.opponent2Name,
        opponent1Handicap: matches.opponent1Handicap,
        opponent2Handicap: matches.opponent2Handicap,
        opponent1Id: matches.opponent1Id,
        opponent2Id: matches.opponent2Id,
        result: matches.result,
        margin: matches.margin,
        matchOrder: matches.matchOrder,
        notes: matches.notes,
        player1Name: p1.name,
        player2Name: p2.name,
      })
      .from(matches)
      .innerJoin(p1, eq(matches.player1Id, p1.id))
      .innerJoin(p2, eq(matches.player2Id, p2.id))
      .where(eq(matches.fixtureId, fixtureId))
      .orderBy(sql`${matches.matchOrder} ASC NULLS FIRST`)
    return { success: true, data: result };
  } catch (e) {
    return { success: false, error: (e as Error).message, data: [] as Array<Record<string, unknown>> };
  }
}

export async function getMatchesByPlayer(playerId: number) {
  try {
    const result = await db
      .select({
        id: matches.id,
        fixtureId: matches.fixtureId,
        player1Id: matches.player1Id,
        player2Id: matches.player2Id,
        player1Handicap: matches.player1Handicap,
        player2Handicap: matches.player2Handicap,
        opponent1Name: matches.opponent1Name,
        opponent2Name: matches.opponent2Name,
        opponent1Handicap: matches.opponent1Handicap,
        opponent2Handicap: matches.opponent2Handicap,
        opponent1Id: matches.opponent1Id,
        opponent2Id: matches.opponent2Id,
        result: matches.result,
        margin: matches.margin,
        matchOrder: matches.matchOrder,
        notes: matches.notes,
        fixtureDate: fixtures.date,
        opponentClubName: opponentClubs.name,
        venueName: sql<string>`COALESCE(NULLIF(TRIM(${fixtures.venueName}), ''), CASE WHEN ${fixtures.homeAway} = 'home' THEN 'Kenya Air Force Golf Club' ELSE ${opponentClubs.name} END)`.as("venue_name"),
      })
      .from(matches)
      .innerJoin(fixtures, eq(matches.fixtureId, fixtures.id))
      .innerJoin(opponentClubs, eq(fixtures.opponentClubId, opponentClubs.id))
      .where(
        or(
          eq(matches.player1Id, playerId),
          eq(matches.player2Id, playerId),
          eq(matches.opponent1Id, playerId),
          eq(matches.opponent2Id, playerId),
        ),
      )
      .orderBy(desc(fixtures.date));
    return { success: true, data: result };
  } catch (e) {
    return { success: false, error: (e as Error).message, data: [] as Array<Record<string, unknown>> };
  }
}

// ---------------------------------------------------------------------------
// Analytics – all matches with full context
// ---------------------------------------------------------------------------

export async function getAllMatches() {
  try {
    const p1 = db
      .select({
        id: players.id,
        name: players.name,
      })
      .from(players)
      .as("p1");

    const p2 = db
      .select({
        id: players.id,
        name: players.name,
      })
      .from(players)
      .as("p2");

    const o1 = db
      .select({
        id: players.id,
        name: players.name,
      })
      .from(players)
      .as("o1");

    const o2 = db
      .select({
        id: players.id,
        name: players.name,
      })
      .from(players)
      .as("o2");

    const result = await db
      .select({
        id: matches.id,
        fixtureId: matches.fixtureId,
        player1Id: matches.player1Id,
        player2Id: matches.player2Id,
        player1Handicap: matches.player1Handicap,
        player2Handicap: matches.player2Handicap,
        opponent1Name: matches.opponent1Name,
        opponent2Name: matches.opponent2Name,
        opponent1Handicap: matches.opponent1Handicap,
        opponent2Handicap: matches.opponent2Handicap,
        opponent1Id: matches.opponent1Id,
        opponent2Id: matches.opponent2Id,
        result: matches.result,
        margin: matches.margin,
        matchOrder: matches.matchOrder,
        notes: matches.notes,
        player1Name: p1.name,
        player2Name: p2.name,
        opponent1PlayerName: o1.name,
        opponent2PlayerName: o2.name,
        fixtureDate: fixtures.date,
        homeAway: fixtures.homeAway,
        opponentClubId: fixtures.opponentClubId,
        opponentClubName: opponentClubs.name,
        venueName: sql<string>`COALESCE(NULLIF(TRIM(${fixtures.venueName}), ''), CASE WHEN ${fixtures.homeAway} = 'home' THEN 'Kenya Air Force Golf Club' ELSE ${opponentClubs.name} END)`.as("venue_name"),
      })
      .from(matches)
      .innerJoin(fixtures, eq(matches.fixtureId, fixtures.id))
      .innerJoin(opponentClubs, eq(fixtures.opponentClubId, opponentClubs.id))
      .innerJoin(p1, eq(matches.player1Id, p1.id))
      .innerJoin(p2, eq(matches.player2Id, p2.id))
      .leftJoin(o1, eq(matches.opponent1Id, o1.id))
      .leftJoin(o2, eq(matches.opponent2Id, o2.id))
      .orderBy(desc(fixtures.date), sql`${matches.matchOrder} ASC NULLS FIRST`)
    return { success: true, data: result };
  } catch (e) {
    return { success: false, error: (e as Error).message, data: [] as Array<Record<string, unknown>> };
  }
}

// ---------------------------------------------------------------------------
// Opponent Lineups
// ---------------------------------------------------------------------------

export async function saveLineup(data: {
  name: string;
  fixtureId?: number;
  clubId?: number;
  pairs: {
    matchOrder: number;
    opp1Name: string;
    opp1Handicap: number;
    opp2Name: string;
    opp2Handicap: number;
    isRedMatch: boolean;
  }[];
}): Promise<ActionResult<{ id: number }>> {
  try {
    const lineup = (await db
      .insert(opponentLineups)
      .values({
        name: data.name,
        fixtureId: data.fixtureId ?? null,
        clubId: data.clubId ?? null,
      })
      .returning())[0];

    if (data.pairs.length > 0) {
      await db.insert(opponentLineupPairs)
        .values(
          data.pairs.map((p) => ({
            lineupId: lineup.id,
            matchOrder: p.matchOrder,
            opp1Name: p.opp1Name,
            opp1Handicap: p.opp1Handicap,
            opp2Name: p.opp2Name,
            opp2Handicap: p.opp2Handicap,
            isRedMatch: p.isRedMatch,
          })),
        );
    }

    revalidatePath("/analytics/counter");
    return { success: true, data: { id: lineup.id } };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function getLineups(): Promise<
  ActionResult<
    {
      id: number;
      name: string;
      fixtureId: number | null;
      clubId: number | null;
      clubName: string | null;
      createdAt: string;
      pairCount: number;
    }[]
  >
> {
  try {
    const rows = await db
      .select({
        id: opponentLineups.id,
        name: opponentLineups.name,
        fixtureId: opponentLineups.fixtureId,
        clubId: opponentLineups.clubId,
        clubName: opponentClubs.name,
        createdAt: opponentLineups.createdAt,
        pairCount: sql<number>`count(${opponentLineupPairs.id})::integer`,
      })
      .from(opponentLineups)
      .leftJoin(
        opponentLineupPairs,
        eq(opponentLineups.id, opponentLineupPairs.lineupId),
      )
      .leftJoin(
        opponentClubs,
        eq(opponentLineups.clubId, opponentClubs.id),
      )
      .groupBy(opponentLineups.id, opponentClubs.id)
      .orderBy(desc(opponentLineups.createdAt));
    return { success: true, data: rows };
  } catch (e) {
    return { success: false, error: (e as Error).message, data: [] };
  }
}

export async function getLineup(id: number): Promise<
  ActionResult<{
    id: number;
    name: string;
    fixtureId: number | null;
    clubId: number | null;
    createdAt: string;
    pairs: {
      matchOrder: number;
      opp1Name: string;
      opp1Handicap: number;
      opp2Name: string;
      opp2Handicap: number;
      isRedMatch: boolean;
    }[];
  }>
> {
  try {
    const lineup = (await db
      .select()
      .from(opponentLineups)
      .where(eq(opponentLineups.id, id)))[0];
    if (!lineup) return { success: false, error: "Lineup not found" };

    const pairs = await db
      .select()
      .from(opponentLineupPairs)
      .where(eq(opponentLineupPairs.lineupId, id))
      .orderBy(asc(opponentLineupPairs.matchOrder));

    return {
      success: true,
      data: {
        ...lineup,
        pairs: pairs.map((p) => ({
          matchOrder: p.matchOrder,
          opp1Name: p.opp1Name,
          opp1Handicap: p.opp1Handicap,
          opp2Name: p.opp2Name,
          opp2Handicap: p.opp2Handicap,
          isRedMatch: p.isRedMatch,
        })),
      },
    };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

export async function deleteLineup(id: number): Promise<ActionResult> {
  try {
    await db.delete(opponentLineups).where(eq(opponentLineups.id, id));
    revalidatePath("/analytics/counter");
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}
