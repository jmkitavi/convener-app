import Link from "next/link";
import {
  Trophy,
  TrendingUp,
  Users,
  Calendar,
  Building2,
  MapPin,
  BarChart3,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAllMatches } from "@/lib/actions";
import {
  getTeamRecord,
  getRecentFixtureResults,
  getPlayerStats,
  type MatchWithDetails,
} from "@/lib/analytics";
import { db } from "@/db";
import { players } from "@/db/schema";
import { eq } from "drizzle-orm";
import { FixtureChart } from "@/components/fixture-chart";

function resultBadgeVariant(wins: number, losses: number) {
  if (wins > losses) return "default" as const;
  if (losses > wins) return "destructive" as const;
  return "outline" as const;
}

function resultLabel(wins: number, losses: number, halved: number) {
  if (wins > losses) return "Won";
  if (losses > wins) return "Lost";
  return "Drawn";
}

export default async function DashboardPage() {
  const { data: rawMatches } = await getAllMatches();
  const allMatches = (rawMatches ?? []) as MatchWithDetails[];

  const activePlayers = await db
    .select()
    .from(players)
    .where(eq(players.active, true))
    .all();

  if (allMatches.length === 0) {
    return <EmptyState />;
  }

  const record = getTeamRecord(allMatches);
  const recentFixtures = getRecentFixtureResults(allMatches, 5);

  // Player appearance counts and win rates
  const playerMap = new Map<number, { name: string; played: number; wins: number }>();
  for (const m of allMatches) {
    for (const pid of [m.player1Id, m.player2Id]) {
      const name = pid === m.player1Id ? m.player1Name : m.player2Name;
      const entry = playerMap.get(pid) ?? { name, played: 0, wins: 0 };
      entry.played++;
      if (m.result === "win") entry.wins++;
      playerMap.set(pid, entry);
    }
  }

  const playerStats = Array.from(playerMap.entries())
    .map(([id, s]) => ({ id, ...s, winRate: s.played > 0 ? s.wins / s.played : 0 }));

  const mostPlayed = [...playerStats].sort((a, b) => b.played - a.played).slice(0, 3);
  const topWinRate = [...playerStats]
    .filter((p) => p.played >= 3)
    .sort((a, b) => b.winRate - a.winRate || b.played - a.played)
    .slice(0, 3);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Nairobi District Golf League — season overview
        </p>
      </div>

      {/* Team Record */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Overall Record</CardDescription>
            <CardTitle className="text-2xl">
              {record.wins}W – {record.losses}L – {record.halved}H
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Trophy className="h-4 w-4 text-emerald-600" />
              Win rate: {(record.winRate * 100).toFixed(1)}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Matches Played</CardDescription>
            <CardTitle className="text-2xl">{record.total}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4 text-emerald-600" />
              Across {recentFixtures.length > 0
                ? new Set(allMatches.map((m) => m.fixtureId)).size
                : 0} fixtures
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Active Players</CardDescription>
            <CardTitle className="text-2xl">{activePlayers.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4 text-emerald-600" />
              {playerMap.size} have played
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Top Win Rate</CardDescription>
            <CardTitle className="text-2xl">
              {topWinRate[0]
                ? `${(topWinRate[0].winRate * 100).toFixed(0)}%`
                : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              {topWinRate[0]?.name ?? "No data yet"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart + Recent Fixtures */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-emerald-600" />
              Results by Fixture
            </CardTitle>
            <CardDescription>Wins, losses &amp; halved per recent fixture</CardDescription>
          </CardHeader>
          <CardContent>
            <FixtureChart fixtures={recentFixtures} />
          </CardContent>
        </Card>

        {/* Recent Fixtures List */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Fixtures</CardTitle>
            <CardDescription>Last {recentFixtures.length} fixture results</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentFixtures.map((f) => (
              <Link
                key={f.fixtureId}
                href={`/fixtures/${f.fixtureId}`}
                className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">
                    vs {f.opponentClubName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(f.fixtureDate).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}{" "}
                    · {f.courseName}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {f.wins}W-{f.losses}L-{f.halved}H
                  </span>
                  <Badge variant={resultBadgeVariant(f.wins, f.losses)}>
                    {resultLabel(f.wins, f.losses, f.halved)}
                  </Badge>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Most Played */}
        <Card>
          <CardHeader>
            <CardTitle>Most Played</CardTitle>
            <CardDescription>Players with the most match appearances</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {mostPlayed.map((p, i) => (
              <Link
                key={p.id}
                href={`/players/${p.id}`}
                className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium">{p.name}</span>
                </div>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {p.played} matches
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* Best Win Rate */}
        <Card>
          <CardHeader>
            <CardTitle>Best Win Rate</CardTitle>
            <CardDescription>
              Players with the highest win rate (min. 3 matches)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {topWinRate.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Not enough data yet
              </p>
            ) : (
              topWinRate.map((p, i) => (
                <Link
                  key={p.id}
                  href={`/players/${p.id}`}
                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium">{p.name}</span>
                  </div>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {(p.winRate * 100).toFixed(0)}% ({p.wins}/{p.played})
                  </span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmptyState() {
  const links = [
    { href: "/players", label: "Add Players", icon: Users },
    { href: "/clubs", label: "Add Clubs", icon: Building2 },
    { href: "/courses", label: "Add Courses", icon: MapPin },
    { href: "/fixtures", label: "Create a Fixture", icon: Calendar },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Nairobi District Golf League — season overview
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Trophy className="h-12 w-12 text-emerald-600/40 mb-4" />
          <h2 className="text-lg font-semibold">Welcome to Convener!</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Get started by setting up your league. Add players, opponent clubs,
            courses, then create your first fixture and record match results.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {links.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href}>
                <Button variant="outline">
                  <Icon className="h-4 w-4" />
                  {label}
                </Button>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
