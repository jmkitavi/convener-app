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
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { parseMatchHandicap, syncPlayerHandicaps } from "@/lib/handicaps";
import { calcFixturePoints } from "@/lib/analytics";
import { PageHeader } from "@/components/page-header";
import { fixtureStatus } from "../fixture-status";

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
      teamName: fixtures.teamName,
      opponentTeamName: fixtures.opponentTeamName,
      explicitVenueName: fixtures.venueName,
      clubName: opponentClubs.name,
      venueName: sql<string>`COALESCE(NULLIF(TRIM(${fixtures.venueName}), ''), CASE WHEN ${fixtures.homeAway} = 'home' THEN 'Kenya Air Force Golf Club' ELSE ${opponentClubs.name} END)`.as("venue_name"),
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

  // Points calculation
  const decidedMatches = wins + losses + halved;
  const { pointsPerMatch: ppm, teamPoints, maxPoints } = calcFixturePoints(decidedMatches, wins, halved);
  const status = fixtureStatus({ ...fixture, wins, losses, halved, pending, total: matchList.length }, new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" }));

  const isInternalMatch = /Kenya Air\s*force/i.test(fixture.clubName ?? "") ||
    matchList.some((match) => match.opponent1Id !== null || match.opponent2Id !== null);

  async function createMatch(formData: FormData) {
    "use server";

    const fId = Number(formData.get("fixtureId"));
    const p1Id = Number(formData.get("player1Id"));
    const p2Id = Number(formData.get("player2Id"));
    const o1Id = formData.get("opponent1Id");
    const o2Id = formData.get("opponent2Id");

    if (!p1Id || !p2Id) {
      throw new Error("Both players must be selected");
    }

    await db.insert(matches).values({
      fixtureId: fId,
      player1Id: p1Id,
      player2Id: p2Id,
      player1Handicap: parseMatchHandicap(formData.get("player1Handicap")),
      player2Handicap: parseMatchHandicap(formData.get("player2Handicap")),
      opponent1Name: formData.get("opponent1Name") as string,
      opponent2Name: formData.get("opponent2Name") as string,
      opponent1Handicap: parseMatchHandicap(formData.get("opponent1Handicap")),
      opponent2Handicap: parseMatchHandicap(formData.get("opponent2Handicap")),
      opponent1Id: o1Id ? Number(o1Id) : null,
      opponent2Id: o2Id ? Number(o2Id) : null,
      result: formData.get("result") as "win" | "loss" | "halved" | "pending",
      matchOrder: formData.get("matchOrder") ? Number(formData.get("matchOrder")) : null,
      margin: (formData.get("margin") as string) || null,
      notes: (formData.get("notes") as string) || null,
    });

    // Sync handicaps for involved players
    const playerIds = [
      p1Id,
      p2Id,
      ...(o1Id ? [Number(o1Id)] : []),
      ...(o2Id ? [Number(o2Id)] : []),
    ];
    syncPlayerHandicaps(db.$client, playerIds);

    revalidatePath(`/fixtures/${fId}`);
    revalidatePath("/", "layout");
    redirect(`/fixtures/${fId}`);
  }

  async function deleteMatch(formData: FormData) {
    "use server";

    const matchId = Number(formData.get("matchId"));
    const fId = Number(formData.get("fixtureId"));

    const previous = db.select().from(matches).where(eq(matches.id, matchId)).get();
    await db.delete(matches).where(eq(matches.id, matchId));
    if (previous) syncPlayerHandicaps(db.$client, [
      previous.player1Id, previous.player2Id,
      ...[previous.opponent1Id, previous.opponent2Id].filter((id): id is number => id !== null),
    ]);

    revalidatePath(`/fixtures/${fId}`);
    revalidatePath("/", "layout");
    redirect(`/fixtures/${fId}`);
  }

  async function updateMatch(formData: FormData) {
    "use server";

    const matchId = Number(formData.get("matchId"));
    const fId = Number(formData.get("fixtureId"));
    const p1Id = Number(formData.get("player1Id"));
    const p2Id = Number(formData.get("player2Id"));
    const o1Id = formData.get("opponent1Id");
    const o2Id = formData.get("opponent2Id");

    if (!p1Id || !p2Id) {
      throw new Error("Both players must be selected");
    }

    const previous = db.select().from(matches).where(eq(matches.id, matchId)).get();
    await db
      .update(matches)
      .set({
        player1Id: p1Id,
        player2Id: p2Id,
        player1Handicap: parseMatchHandicap(formData.get("player1Handicap")),
        player2Handicap: parseMatchHandicap(formData.get("player2Handicap")),
        opponent1Name: formData.get("opponent1Name") as string,
        opponent2Name: formData.get("opponent2Name") as string,
        opponent1Handicap: parseMatchHandicap(formData.get("opponent1Handicap")),
        opponent2Handicap: parseMatchHandicap(formData.get("opponent2Handicap")),
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

    // Sync handicaps for involved players
    const playerIds = [
      p1Id,
      p2Id,
      ...(o1Id ? [Number(o1Id)] : []),
      ...(o2Id ? [Number(o2Id)] : []),
    ];
    if (previous) playerIds.push(...[
      previous.player1Id, previous.player2Id, previous.opponent1Id, previous.opponent2Id,
    ].filter((id): id is number => id !== null));
    syncPlayerHandicaps(db.$client, playerIds);

    revalidatePath(`/fixtures/${fId}`);
    revalidatePath("/", "layout");
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
    const venueName = (formData.get("venueName") as string)?.trim() || null;
    const teamName = (formData.get("teamName") as string)?.trim() || null;
    const opponentTeamName = (formData.get("opponentTeamName") as string)?.trim() || null;

    await db
      .update(fixtures)
      .set({ date, opponentClubId, homeAway, notes, venueName, teamName, opponentTeamName })
      .where(eq(fixtures.id, fixtureId));

    revalidatePath("/fixtures");
    revalidatePath("/", "layout");
    revalidatePath(`/fixtures/${fixtureId}`);
    redirect(`/fixtures/${fixtureId}`);
  }

  function resultLabel(r: string) {
    if (r === "win") return "Won";
    if (r === "loss") return "Lost";
    if (r === "pending") return "Pending";
    return "Halved";
  }

  function resultVariant(r: string) {
    if (r === "win") return "default" as const;
    if (r === "loss") return "destructive" as const;
    if (r === "pending") return "secondary" as const;
    return "outline" as const;
  }

  return (
    <div className="page-shell screen-desk">
      {/* Fixture header */}
      <PageHeader
        eyebrow="Fixture scorecard"
        title={`${fixture.teamName ? `${fixture.teamName} vs ` : "vs "}${fixture.opponentTeamName ?? fixture.clubName ?? "Unknown Club"}`}
        actions={<>
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
        <Badge variant="outline" className={decidedMatches === 0 ? "border-away/40 bg-away/10 text-away-foreground" : pending ? "border-away/40 bg-away/10 text-away-foreground" : "border-home/30 bg-home/10 text-home-foreground"}>
          {status === "scheduled" ? "Scheduled" : status === "noresults" ? "No results" : status === "partial" ? "Partial results" : "Results recorded"}
        </Badge>
        <Button variant="outline" size="sm" render={<Link href={`/fixtures/import?fixtureId=${fixtureId}`} />}>Import Results</Button>
        <Dialog key={JSON.stringify([fixture.date, fixture.opponentClubId, fixture.homeAway, fixture.notes, fixture.explicitVenueName, fixture.teamName, fixture.opponentTeamName])}>
          <DialogTrigger render={<Button variant="outline" size="sm"><Pencil data-icon="inline-start" />Edit Fixture</Button>} />
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>Edit Fixture</DialogTitle><DialogDescription>Update the fixture details below.</DialogDescription></DialogHeader>
            <FixtureForm clubs={clubs} action={updateFixture}
              defaultValues={{ date: fixture.date, opponentClubId: fixture.opponentClubId, homeAway: fixture.homeAway, notes: fixture.notes ?? undefined, venueName: fixture.explicitVenueName, teamName: fixture.teamName, opponentTeamName: fixture.opponentTeamName }}
              submitLabel="Update Fixture"
            />
          </DialogContent>
        </Dialog>
        </>}
      >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="size-3.5" />
              {new Date(`${fixture.date}T12:00:00`).toLocaleDateString("en-GB", {
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
      </PageHeader>

      {/* Summary */}
      <section className="desk-summary grid gap-6 sm:grid-cols-3" aria-label="Scorecard summary">
        <div><p className="text-xs uppercase tracking-wider text-white/65">Fixture points{pending > 0 && decidedMatches > 0 ? " · provisional" : ""}</p><p className="numeric mt-2 text-3xl font-semibold">{decidedMatches > 0 ? teamPoints.toFixed(2) : "—"}{decidedMatches > 0 && <span className="text-base font-normal text-white/70"> / {maxPoints.toFixed(2)}</span>}</p><p className="mt-2 text-xs text-white/75">{decidedMatches > 0 ? `${wins} won · ${halved} halved · ${losses} lost` : "No completed results yet"}</p></div>
        <div><p className="text-xs uppercase tracking-wider text-white/65">Pair matches</p><p className="numeric mt-2 text-3xl font-semibold">{matchList.length}</p><p className="mt-2 text-xs text-white/75">{decidedMatches} completed · {pending} pending</p></div>
        <div><p className="text-xs uppercase tracking-wider text-white/65">Venue</p><p className="mt-2 text-3xl font-semibold capitalize">{fixture.homeAway}</p><p className="mt-2 text-xs text-white/75">{fixture.venueName ?? "Unknown venue"}</p></div>
      </section>
      {pending > 0 && <p className="desk-note desk-note-amber">Provisional score: {pending} pending match{pending === 1 ? "" : "es"} excluded. Points shown use completed results only and may change as the scorecard is completed.</p>}

      {/* Match list */}
      <div className="desk-two-column">
      <section className="desk-panel min-w-0 overflow-hidden">
        <div className="desk-panel-header flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-semibold">The scorecard</h2><p className="text-sm text-muted-foreground">Record the result from our team&apos;s perspective.</p></div>
          <Dialog key={`add-match-${matchList.length}`}>
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
          <Table>
            <caption className="sr-only">Fixture match scorecard. Handicaps are shown in parentheses.</caption>
            <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Our pairing / opponents</TableHead><TableHead>Result</TableHead><TableHead>Score</TableHead><TableHead><span className="sr-only">Match actions</span></TableHead></TableRow></TableHeader>
            <TableBody>
            {matchList.map((match) => (
              <TableRow key={match.id} id={`match-${match.id}`} className="scroll-mt-24">
                  <TableCell className="text-muted-foreground">{match.matchOrder ?? "—"}</TableCell>
                  <TableCell className="min-w-60 whitespace-normal [overflow-wrap:anywhere]">
                      <span className="block font-medium">
                        <Link href={`/players/${match.player1Id}`} className="underline-offset-2 hover:underline">
                          {match.player1Name ?? "?"}
                        </Link>{" "}
                        ({match.player1Handicap ?? "—"})
                        {" & "}
                        <Link href={`/players/${match.player2Id}`} className="underline-offset-2 hover:underline">
                          {match.player2Name ?? "?"}
                        </Link>{" "}
                        ({match.player2Handicap ?? "—"})
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">vs{" "}
                        {match.opponent1Id ? (
                          <Link href={`/players/${match.opponent1Id}`} className="underline-offset-2 hover:underline">
                            {match.opponent1Name}
                          </Link>
                        ) : (
                          match.opponent1Name
                        )}{" "}
                        ({match.opponent1Handicap ?? "—"})
                        {" & "}
                        {match.opponent2Id ? (
                          <Link href={`/players/${match.opponent2Id}`} className="underline-offset-2 hover:underline">
                            {match.opponent2Name}
                          </Link>
                        ) : (
                          match.opponent2Name
                        )}{" "}
                        ({match.opponent2Handicap ?? "—"})
                      </span>
                    {match.notes && (
                      <p className="text-xs text-muted-foreground">
                        {match.notes}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={resultVariant(match.result)}>
                      {resultLabel(match.result)}
                    </Badge>
                  </TableCell>
                  <TableCell className="numeric">{match.margin ?? "—"}</TableCell>
                  <TableCell><div className="flex items-center gap-1">
                    <Dialog key={JSON.stringify(match)}>
                      <DialogTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label={`Edit match ${match.matchOrder ?? match.id}`}
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
                        aria-label={`Delete match ${match.matchOrder ?? match.id}`}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 />
                      </Button>
                    </form>
                  </div></TableCell>
              </TableRow>
            ))}
            </TableBody>
          </Table>
        )}
        <div className="desk-panel-footer text-xs text-muted-foreground">{decidedMatches > 0 ? `${ppm.toFixed(2)} points per completed match on the normalized fixture scale. ` : ""}Pending matches are excluded. Handicaps in parentheses are match-day values; “—” means unknown.</div>
      </section>
      <aside className="desk-stack self-start">
        <section className="desk-panel"><div className="desk-panel-header"><h2 className="font-semibold">Match-day notes</h2></div><p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{fixture.notes || "No notes recorded. Use Edit Fixture to add meeting details or match-day context."}</p></section>
        <section className="desk-panel"><div className="desk-panel-header"><h2 className="font-semibold">Next steps</h2></div><div className="desk-stack">
          <div><p className="text-sm font-medium">Review the partnerships</p><p className="mb-3 text-xs text-muted-foreground">See the record beyond this fixture.</p><Button variant="outline" size="sm" render={<Link href="/analytics/pairings" />}>Explore pairings</Button></div>
          <div><p className="text-sm font-medium">Have a full scorecard?</p><p className="mb-3 text-xs text-muted-foreground">Review extracted rows before saving.</p><Button variant="outline" size="sm" render={<Link href={`/fixtures/import?fixtureId=${fixtureId}`} />}>Import results</Button></div>
        </div></section>
        <p className="desk-note">A recorded result means all entered matches are decided, not that an expected number of pairs has been verified.</p>
      </aside>
      </div>

      <div className="pt-4">
        <Button variant="outline" render={<Link href="/fixtures" />}>
          ← Back to Fixtures
        </Button>
      </div>
    </div>
  );
}
