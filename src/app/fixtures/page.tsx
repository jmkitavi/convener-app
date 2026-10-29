import Link from "next/link";
import { db } from "@/db";
import { fixtures, matches, opponentClubs } from "@/db/schema";
import { eq, asc, sql } from "drizzle-orm";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, MapPin, CheckCircle2, Clock3, CircleDashed } from "lucide-react";
import { calcFixturePoints } from "@/lib/analytics";

export default async function FixturesPage() {
  const fixtureList = await db
    .select({
      id: fixtures.id,
      date: fixtures.date,
      homeAway: fixtures.homeAway,
      notes: fixtures.notes,
      teamName: fixtures.teamName,
      opponentTeamName: fixtures.opponentTeamName,
      clubName: opponentClubs.name,
      venueName: sql<string>`COALESCE(NULLIF(TRIM(${fixtures.venueName}), ''), CASE WHEN ${fixtures.homeAway} = 'home' THEN 'Kenya Air Force Golf Club' ELSE ${opponentClubs.name} END)`.as("venue_name"),
    })
    .from(fixtures)
    .leftJoin(opponentClubs, eq(fixtures.opponentClubId, opponentClubs.id))
    .orderBy(asc(fixtures.date));

  // Get match results per fixture for points calculation
  const matchResults = await db
    .select({
      fixtureId: matches.fixtureId,
      result: matches.result,
    })
    .from(matches);

  const fixtureMatchStats = new Map<number, { total: number; wins: number; losses: number; halved: number; pending: number }>();
  for (const m of matchResults) {
    const entry = fixtureMatchStats.get(m.fixtureId) ?? { total: 0, wins: 0, losses: 0, halved: 0, pending: 0 };
    entry.total++;
    if (m.result === "win") entry.wins++;
    else if (m.result === "loss") entry.losses++;
    else if (m.result === "halved") entry.halved++;
    else entry.pending++;
    fixtureMatchStats.set(m.fixtureId, entry);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Fixtures</h1>
        <div className="flex gap-2">
        <Button variant="outline" render={<Link href="/fixtures/import" />}>Import Results</Button>
        <Button render={<Link href="/fixtures/new" />}>
          <Plus data-icon="inline-start" />
          New Fixture
        </Button>
        </div>
      </div>

      {fixtureList.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No fixtures yet. Create your first fixture to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {fixtureList.map((fixture) => {
            const stats = fixtureMatchStats.get(fixture.id);
            const total = stats?.total ?? 0;
            const wins = stats?.wins ?? 0;
            const halved = stats?.halved ?? 0;
            const losses = stats?.losses ?? 0;
            const completed = wins + losses + halved;
            const pending = stats?.pending ?? 0;
            const status = completed === 0
              ? { label: "No results", accent: "border-l-slate-300", badge: "border-slate-200 bg-slate-100 text-slate-700", Icon: CircleDashed }
              : pending > 0
                ? { label: "Partial results", accent: "border-l-amber-500", badge: "border-amber-200 bg-amber-50 text-amber-800", Icon: Clock3 }
                : { label: "Results recorded", accent: "border-l-emerald-500", badge: "border-emerald-200 bg-emerald-50 text-emerald-800", Icon: CheckCircle2 };
            const { teamPoints: teamPts, maxPoints: maxPts } = calcFixturePoints(completed, wins, halved);

            return (
            <Link
              key={fixture.id}
              href={`/fixtures/${fixture.id}`}
              className="block min-w-0 rounded-xl outline-offset-4 focus-visible:outline-2 focus-visible:outline-primary"
            >
              <Card className={`border-l-4 ${status.accent} transition-colors hover:bg-muted/50`}>
                <CardHeader>
                  <CardTitle className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="min-w-0 break-words">{fixture.teamName ? `${fixture.teamName} vs ` : ""}{fixture.opponentTeamName ?? fixture.clubName ?? "Unknown Club"}</span>
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
                    <Badge variant="outline" className={status.badge}>
                      <status.Icon aria-hidden="true" />
                      {status.label}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="flex flex-wrap items-center gap-4">
                    <span className="flex items-center gap-1">
                      <Calendar className="size-3.5" />
                      {new Date(fixture.date).toLocaleDateString("en-GB", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="size-3.5" />
                      {fixture.venueName ?? "Unknown Venue"}
                    </span>
                    {completed > 0 && (
                      <span className="text-xs font-medium">
                        {wins}W-{losses}L-{halved}H
                        {" · "}
                        <strong className="text-emerald-700">{teamPts.toFixed(2)}</strong>/{maxPts.toFixed(2)} pts{pending > 0 ? " · provisional" : ""}
                      </span>
                    )}
                    {pending > 0 && (
                      <span className="text-xs font-medium text-amber-800">
                        {completed}/{total} results recorded ({pending} pending)
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>
                {fixture.notes && (
                  <CardContent>
                    <p className="break-words text-sm text-muted-foreground">{fixture.notes}</p>
                  </CardContent>
                )}
              </Card>
            </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
