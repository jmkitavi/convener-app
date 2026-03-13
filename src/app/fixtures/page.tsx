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
import { Plus, Calendar, MapPin } from "lucide-react";

export default async function FixturesPage() {
  const fixtureList = await db
    .select({
      id: fixtures.id,
      date: fixtures.date,
      homeAway: fixtures.homeAway,
      notes: fixtures.notes,
      clubName: opponentClubs.name,
      venueName: sql<string>`CASE WHEN ${fixtures.homeAway} = 'home' THEN 'Kenya Airforce Golf Club' ELSE ${opponentClubs.name} END`.as("venue_name"),
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
        <Button render={<Link href="/fixtures/new" />}>
          <Plus data-icon="inline-start" />
          New Fixture
        </Button>
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
            const ppm = total > 0 ? Math.round(Math.min(30 / total, 2) * 100) / 100 : 0;
            const teamPts = total > 0
              ? Math.min(Math.round((wins * ppm + halved * ppm * 0.5) * 100) / 100, Math.min(total * ppm, 30))
              : 0;
            const maxPts = total > 0 ? Math.min(Math.round(total * ppm * 100) / 100, 30) : 0;

            return (
            <Link
              key={fixture.id}
              href={`/fixtures/${fixture.id}`}
              className="block"
            >
              <Card className="transition-colors hover:bg-muted/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {fixture.clubName ?? "Unknown Club"}
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
                    {total > 0 && (
                      <span className="text-xs font-medium">
                        {wins}W-{losses}L-{halved}H
                        {" · "}
                        <strong className="text-emerald-600">{teamPts.toFixed(2)}</strong>/{maxPts.toFixed(2)} pts
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>
                {fixture.notes && (
                  <CardContent>
                    <p className="text-muted-foreground">{fixture.notes}</p>
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
