import Link from "next/link";
import { db } from "@/db";
import { fixtures, matches, opponentClubs } from "@/db/schema";
import { eq, asc, sql } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { FixtureSchedule } from "./fixture-schedule";
import { fixtureStatus } from "./fixture-status";
import { getDataScope } from "@/lib/data-scope";
import { isInternalFixture } from "@/lib/insights";

export default async function FixturesPage() {
  const scope = await getDataScope();
  const allFixtures = await db
    .select({
      id: fixtures.id,
      opponentClubId: fixtures.opponentClubId,
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
  const fixtureList = allFixtures.filter((fixture) => scope === "all" ||
    !isInternalFixture({ opponentClubId: fixture.opponentClubId, opponentClubName: fixture.clubName ?? "" }));
  const fixtureIds = new Set(fixtureList.map((fixture) => fixture.id));

  // Get match results per fixture for points calculation
  const allMatchResults = await db
    .select({
      fixtureId: matches.fixtureId,
      result: matches.result,
    })
    .from(matches);
  const matchResults = allMatchResults.filter((match) => fixtureIds.has(match.fixtureId));

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

  const schedule = fixtureList.map((fixture) => ({ ...fixture, ...(fixtureMatchStats.get(fixture.id) ?? { total: 0, wins: 0, losses: 0, halved: 0, pending: 0 }) }));
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
  const recorded = schedule.filter((fixture) => fixtureStatus(fixture, today) === "recorded").length;
  const scheduled = schedule.filter((fixture) => fixtureStatus(fixture, today) === "scheduled").length;
  const needsResults = schedule.filter((fixture) => ["partial", "noresults"].includes(fixtureStatus(fixture, today))).length;

  return (
    <div className="page-shell screen-desk">
      <PageHeader title="Fixtures & results" eyebrow="The match desk / Fixtures" description="Every fixture, from the first tee to the final scorecard." actions={<>
        <Button variant="outline" render={<Link href="/fixtures/import" />}>Import Results</Button>
        <Button render={<Link href="/fixtures/new" />}>
          <Plus data-icon="inline-start" />
          New Fixture
        </Button>
      </>} />

      <section className="desk-stats" aria-label="Fixture coverage">
        <article className="desk-stat"><p className="desk-stat-label">Fixtures on record</p><p className="desk-stat-value">{fixtureList.length}</p><p className="desk-stat-detail">{recorded} recorded · {scheduled} scheduled</p></article>
        <article className="desk-stat"><p className="desk-stat-label">Completed results</p><p className="desk-stat-value">{matchResults.filter((match) => match.result !== "pending").length}</p><p className="desk-stat-detail">Individual paired matches</p></article>
        <article className="desk-stat"><p className="desk-stat-label">Pending matches</p><p className="desk-stat-value">{matchResults.filter((match) => match.result === "pending").length}</p><p className="desk-stat-detail">Not included in points</p></article>
        <article className="desk-stat"><p className="desk-stat-label">Needs results</p><p className="desk-stat-value">{needsResults}</p><p className="desk-stat-detail">Partial or no recorded results</p></article>
      </section>

      <FixtureSchedule fixtures={schedule} today={today} />
    </div>
  );
}
