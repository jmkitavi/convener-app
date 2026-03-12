import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import {
  fixtures,
  matches,
  opponentClubs,
  players,
} from "@/db/schema";
import { eq, asc, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { revalidatePath } from "next/cache";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Calendar, MapPin, Pencil, Trash2 } from "lucide-react";
import { MatchForm } from "@/components/match-form";
import { FixtureForm } from "@/components/fixture-form";

export default async function FixtureDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idParam } = await params;
  const fixtureId = Number(idParam);

  const [fixture] = await db
    .select({
      id: fixtures.id,
      date: fixtures.date,
      opponentClubId: fixtures.opponentClubId,
      homeAway: fixtures.homeAway,
      notes: fixtures.notes,
      clubName: opponentClubs.name,
      venueName: sql<string>`CASE WHEN ${fixtures.homeAway} = 'home' THEN 'Kenya Airforce Golf Club' ELSE ${opponentClubs.name} END`.as("venue_name"),
    })
    .from(fixtures)
    .leftJoin(opponentClubs, eq(fixtures.opponentClubId, opponentClubs.id))
    .where(eq(fixtures.id, fixtureId));

  if (!fixture) notFound();

  const p1 = alias(players, "p1");
  const p2 = alias(players, "p2");

  const matchList = await db
    .select({
      id: matches.id,
      player1Id: matches.player1Id,
      player2Id: matches.player2Id,
      player1Name: p1.name,
      player2Name: p2.name,
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
    })
    .from(matches)
    .leftJoin(p1, eq(matches.player1Id, p1.id))
    .leftJoin(p2, eq(matches.player2Id, p2.id))
    .where(eq(matches.fixtureId, fixtureId))
    .orderBy(asc(matches.matchOrder), asc(matches.id));

  const activePlayers = await db
    .select({
      id: players.id,
      name: players.name,
      defaultHandicap: players.defaultHandicap,
    })
    .from(players)
    .where(eq(players.active, true))
    .orderBy(players.name);

  const clubs = await db
    .select({ id: opponentClubs.id, name: opponentClubs.name })
    .from(opponentClubs)
    .orderBy(opponentClubs.name);

  // Summary stats
  const wins = matchList.filter((m) => m.result === "win").length;
  const losses = matchList.filter((m) => m.result === "loss").length;
  const halved = matchList.filter((m) => m.result === "halved").length;
  const pending = matchList.filter((m) => m.result === "pending").length;

  // Internal match = opponent club name contains "Kenya Airforce"
  const isInternalMatch = (fixture.clubName ?? "").includes("Kenya Airforce");

  async function createMatch(formData: FormData) {
    "use server";

    const fId = Number(formData.get("fixtureId"));
    const o1Id = formData.get("opponent1Id");
    const o2Id = formData.get("opponent2Id");

    await db.insert(matches).values({
      fixtureId: fId,
      player1Id: Number(formData.get("player1Id")),
      player2Id: Number(formData.get("player2Id")),
      player1Handicap: Number(formData.get("player1Handicap")),
      player2Handicap: Number(formData.get("player2Handicap")),
      opponent1Name: formData.get("opponent1Name") as string,
      opponent2Name: formData.get("opponent2Name") as string,
      opponent1Handicap: Number(formData.get("opponent1Handicap")),
      opponent2Handicap: Number(formData.get("opponent2Handicap")),
      opponent1Id: o1Id ? Number(o1Id) : null,
      opponent2Id: o2Id ? Number(o2Id) : null,
      result: formData.get("result") as "win" | "loss" | "halved",
      margin: (formData.get("margin") as string) || null,
      notes: (formData.get("notes") as string) || null,
    });

    revalidatePath(`/fixtures/${fId}`);
    redirect(`/fixtures/${fId}`);
  }

  async function deleteMatch(formData: FormData) {
    "use server";

    const matchId = Number(formData.get("matchId"));
    const fId = Number(formData.get("fixtureId"));

    await db.delete(matches).where(eq(matches.id, matchId));

    revalidatePath(`/fixtures/${fId}`);
    redirect(`/fixtures/${fId}`);
  }

  async function updateMatch(formData: FormData) {
    "use server";

    const matchId = Number(formData.get("matchId"));
    const fId = Number(formData.get("fixtureId"));
    const o1Id = formData.get("opponent1Id");
    const o2Id = formData.get("opponent2Id");

    await db
      .update(matches)
      .set({
        player1Id: Number(formData.get("player1Id")),
        player2Id: Number(formData.get("player2Id")),
        player1Handicap: Number(formData.get("player1Handicap")),
        player2Handicap: Number(formData.get("player2Handicap")),
        opponent1Name: formData.get("opponent1Name") as string,
        opponent2Name: formData.get("opponent2Name") as string,
        opponent1Handicap: Number(formData.get("opponent1Handicap")),
        opponent2Handicap: Number(formData.get("opponent2Handicap")),
        opponent1Id: o1Id ? Number(o1Id) : null,
        opponent2Id: o2Id ? Number(o2Id) : null,
        result: formData.get("result") as "win" | "loss" | "halved" | "pending",
        margin: (formData.get("margin") as string) || null,
        matchOrder: formData.get("matchOrder")
          ? Number(formData.get("matchOrder"))
          : null,
        notes: (formData.get("notes") as string) || null,
      })
      .where(eq(matches.id, matchId));

    revalidatePath(`/fixtures/${fId}`);
    redirect(`/fixtures/${fId}`);
  }

  async function updateFixture(formData: FormData) {
    "use server";

    const date = formData.get("date") as string;
    const opponentClubId = Number(formData.get("opponentClubId"));
    const homeAway = formData.get("homeAway") as
      | "home"
      | "away"
      | "neutral";
    const notes = (formData.get("notes") as string) || null;

    await db
      .update(fixtures)
      .set({ date, opponentClubId, homeAway, notes })
      .where(eq(fixtures.id, fixtureId));

    revalidatePath("/fixtures");
    revalidatePath(`/fixtures/${fixtureId}`);
    redirect(`/fixtures/${fixtureId}`);
  }

  function resultLabel(r: string) {
    if (r === "win") return "W";
    if (r === "loss") return "L";
    if (r === "pending") return "?";
    return "H";
  }

  function resultVariant(r: string) {
    if (r === "win") return "default" as const;
    if (r === "loss") return "destructive" as const;
    if (r === "pending") return "secondary" as const;
    return "outline" as const;
  }

  return (
    <div className="space-y-6">
      {/* Fixture header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              vs {fixture.clubName ?? "Unknown Club"}
            </h1>
            <Badge
              variant={
                fixture.homeAway === "home"
                  ? "default"
                  : fixture.homeAway === "away"
                    ? "secondary"
                    : "outline"
              }
            >
              {fixture.homeAway}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="size-3.5" />
              {new Date(fixture.date).toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="size-3.5" />
              {fixture.venueName ?? "Unknown Venue"}
            </span>
          </div>
          {fixture.notes && (
            <p className="text-sm text-muted-foreground">{fixture.notes}</p>
          )}
        </div>

        <Dialog>
          <DialogTrigger
            render={
              <Button variant="outline" size="sm">
                <Pencil data-icon="inline-start" />
                Edit Fixture
              </Button>
            }
          />
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Fixture</DialogTitle>
              <DialogDescription>
                Update the fixture details below.
              </DialogDescription>
            </DialogHeader>
            <FixtureForm
              clubs={clubs}
              action={updateFixture}
              defaultValues={{
                date: fixture.date,
                opponentClubId: fixture.opponentClubId,
                homeAway: fixture.homeAway,
                notes: fixture.notes ?? undefined,
              }}
              submitLabel="Update Fixture"
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary */}
      <Card size="sm">
        <CardContent className="flex items-center gap-6">
          <span className="text-sm text-muted-foreground">
            <strong className="text-foreground">{matchList.length}</strong>{" "}
            {matchList.length === 1 ? "match" : "matches"} recorded
          </span>
          {matchList.length > 0 && (
            <>
              <Separator orientation="vertical" className="h-4" />
              <span className="text-sm">
                <strong className="text-green-600">{wins}</strong> W
              </span>
              <span className="text-sm">
                <strong className="text-red-600">{losses}</strong> L
              </span>
              <span className="text-sm">
                <strong className="text-muted-foreground">{halved}</strong> H
              </span>
              {pending > 0 && (
                <span className="text-sm">
                  <strong className="text-yellow-600">{pending}</strong> Pending
                </span>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Match list */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Matches</h2>
          <Dialog>
            <DialogTrigger
              render={
                <Button size="sm">
                  <Plus data-icon="inline-start" />
                  Add Match
                </Button>
              }
            />
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Add Match</DialogTitle>
                <DialogDescription>
                  Record a foursome match result.
                </DialogDescription>
              </DialogHeader>
              <MatchForm
                players={activePlayers}
                fixtureId={fixtureId}
                action={createMatch}
                isInternalMatch={isInternalMatch}
              />
            </DialogContent>
          </Dialog>
        </div>

        {matchList.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No matches recorded yet. Add your first match above.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {matchList.map((match) => (
              <Card key={match.id} size="sm">
                <CardContent className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                      <span className="font-medium">
                        <Link href={`/players/${match.player1Id}`} className="underline-offset-2 hover:underline">
                          {match.player1Name ?? "?"}
                        </Link>{" "}
                        ({match.player1Handicap})
                        {" & "}
                        <Link href={`/players/${match.player2Id}`} className="underline-offset-2 hover:underline">
                          {match.player2Name ?? "?"}
                        </Link>{" "}
                        ({match.player2Handicap})
                      </span>
                      <span className="text-muted-foreground">vs</span>
                      <span>
                        {match.opponent1Id ? (
                          <Link href={`/players/${match.opponent1Id}`} className="underline-offset-2 hover:underline">
                            {match.opponent1Name}
                          </Link>
                        ) : (
                          match.opponent1Name
                        )}{" "}
                        ({match.opponent1Handicap})
                        {" & "}
                        {match.opponent2Id ? (
                          <Link href={`/players/${match.opponent2Id}`} className="underline-offset-2 hover:underline">
                            {match.opponent2Name}
                          </Link>
                        ) : (
                          match.opponent2Name
                        )}{" "}
                        ({match.opponent2Handicap})
                      </span>
                    </div>
                    {match.notes && (
                      <p className="text-xs text-muted-foreground">
                        {match.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={resultVariant(match.result)}>
                      {resultLabel(match.result)}
                      {match.margin ? ` ${match.margin}` : ""}
                    </Badge>
                    <Dialog>
                      <DialogTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Pencil />
                          </Button>
                        }
                      />
                      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Edit Match #{match.matchOrder ?? match.id}</DialogTitle>
                          <DialogDescription>
                            Update the match details below.
                          </DialogDescription>
                        </DialogHeader>
                        <MatchForm
                          players={activePlayers}
                          fixtureId={fixtureId}
                          matchId={match.id}
                          action={updateMatch}
                          submitLabel="Update Match"
                          isInternalMatch={isInternalMatch}
                          defaultValues={{
                            player1Id: match.player1Id,
                            player2Id: match.player2Id,
                            player1Handicap: match.player1Handicap,
                            player2Handicap: match.player2Handicap,
                            opponent1Name: match.opponent1Name,
                            opponent2Name: match.opponent2Name,
                            opponent1Handicap: match.opponent1Handicap,
                            opponent2Handicap: match.opponent2Handicap,
                            opponent1Id: match.opponent1Id,
                            opponent2Id: match.opponent2Id,
                            result: match.result,
                            margin: match.margin ?? undefined,
                            matchOrder: match.matchOrder ?? undefined,
                            notes: match.notes ?? undefined,
                          }}
                        />
                      </DialogContent>
                    </Dialog>
                    <form action={deleteMatch}>
                      <input type="hidden" name="matchId" value={match.id} />
                      <input
                        type="hidden"
                        name="fixtureId"
                        value={fixtureId}
                      />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon-xs"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 />
                      </Button>
                    </form>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="pt-4">
        <Button variant="outline" render={<Link href="/fixtures" />}>
          ← Back to Fixtures
        </Button>
      </div>
    </div>
  );
}
