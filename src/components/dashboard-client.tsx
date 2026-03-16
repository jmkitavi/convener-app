"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Trophy,
  TrendingUp,
  Users,
  Calendar,
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
import { FixtureChart } from "@/components/fixture-chart";
import {
  getTeamRecord,
  getRecentFixtureResults,
  calcFixturePoints,
  type MatchWithDetails,
} from "@/lib/analytics";

// Internal/friendly fixture club IDs (not NDC league matches)
const INTERNAL_CLUB_IDS = new Set([16, 17]);

type DataMode = "ndc" | "all";

function resultBadgeVariant(wins: number, losses: number) {
  if (wins > losses) return "default" as const;
  if (losses > wins) return "destructive" as const;
  return "outline" as const;
}

function resultLabel(wins: number, losses: number) {
  if (wins > losses) return "Won";
  if (losses > wins) return "Lost";
  return "Drawn";
}

export function DashboardClient({
  allMatches,
  activePlayerCount,
}: {
  allMatches: MatchWithDetails[];
  activePlayerCount: number;
}) {
  const [mode, setMode] = useState<DataMode>("ndc");

  const matches = useMemo(() => {
    if (mode === "all") return allMatches;
    return allMatches.filter((m) => !INTERNAL_CLUB_IDS.has(m.opponentClubId));
  }, [allMatches, mode]);

  const record = useMemo(() => getTeamRecord(matches), [matches]);
  const recentFixtures = useMemo(
    () => getRecentFixtureResults(matches, 5),
    [matches],
  );
  const allFixtureResults = useMemo(
    () => getRecentFixtureResults(matches, 999),
    [matches],
  );

  const totalTeamPts = allFixtureResults.reduce(
    (sum, f) => sum + f.teamPoints,
    0,
  );
  const totalMaxPts = allFixtureResults.reduce(
    (sum, f) => sum + f.maxPoints,
    0,
  );

  // Player appearance counts and win rates
  const { playerStats, mostPlayed, topWinRate } = useMemo(() => {
    const playerMap = new Map<
      number,
      { name: string; played: number; wins: number; halved: number }
    >();
    for (const m of matches) {
      for (const pid of [m.player1Id, m.player2Id]) {
        const name = pid === m.player1Id ? m.player1Name : m.player2Name;
        const entry = playerMap.get(pid) ?? {
          name,
          played: 0,
          wins: 0,
          halved: 0,
        };
        entry.played++;
        if (m.result === "win") entry.wins++;
        else if (m.result === "halved") entry.halved++;
        playerMap.set(pid, entry);
      }
      for (const pid of [m.opponent1Id, m.opponent2Id]) {
        if (!pid) continue;
        const name =
          pid === m.opponent1Id
            ? (m.opponent1PlayerName ?? m.opponent1Name)
            : (m.opponent2PlayerName ?? m.opponent2Name);
        const entry = playerMap.get(pid) ?? {
          name,
          played: 0,
          wins: 0,
          halved: 0,
        };
        entry.played++;
        if (m.result === "loss") entry.wins++;
        else if (m.result === "halved") entry.halved++;
        playerMap.set(pid, entry);
      }
    }

    const stats = Array.from(playerMap.entries()).map(([id, s]) => ({
      id,
      ...s,
      winRate: s.played > 0 ? (s.wins + s.halved * 0.5) / s.played : 0,
    }));

    return {
      playerStats: stats,
      mostPlayed: [...stats].sort((a, b) => b.played - a.played).slice(0, 3),
      topWinRate: [...stats]
        .filter((p) => p.played >= 3)
        .sort((a, b) => b.winRate - a.winRate || b.played - a.played)
        .slice(0, 3),
    };
  }, [matches]);

  return (
    <div className="space-y-6">
      {/* Header with toggle */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Nairobi District Golf League — season overview
          </p>
        </div>
        <div className="inline-flex rounded-lg border bg-muted p-0.5 text-sm">
          <button
            onClick={() => setMode("ndc")}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              mode === "ndc"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            NDC Only
          </button>
          <button
            onClick={() => setMode("all")}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
              mode === "all"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All
          </button>
        </div>
      </div>

      {matches.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No {mode === "ndc" ? "NDC league" : ""} matches recorded yet.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Team Record */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
                <CardDescription>Total Points</CardDescription>
                <CardTitle className="text-2xl">
                  {totalTeamPts.toFixed(2)}{" "}
                  <span className="text-base font-normal text-muted-foreground">
                    / {totalMaxPts.toFixed(2)}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <BarChart3 className="h-4 w-4 text-emerald-600" />
                  {allFixtureResults.length} fixture
                  {allFixtureResults.length !== 1 ? "s" : ""} played
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
                  Across{" "}
                  {new Set(matches.map((m) => m.fixtureId)).size} fixtures
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardDescription>Active Players</CardDescription>
                <CardTitle className="text-2xl">{activePlayerCount}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4 text-emerald-600" />
                  {new Set(
                    matches.flatMap((m) =>
                      [m.player1Id, m.player2Id, m.opponent1Id, m.opponent2Id].filter(Boolean),
                    ),
                  ).size}{" "}
                  have played
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-emerald-600" />
                  Results by Fixture
                </CardTitle>
                <CardDescription>
                  Wins, losses &amp; halved per recent fixture
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FixtureChart fixtures={recentFixtures} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Fixtures</CardTitle>
                <CardDescription>
                  Last {recentFixtures.length} fixture results
                </CardDescription>
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
                        · {f.venueName}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {f.wins}W-{f.losses}L-{f.halved}H ·{" "}
                        {f.teamPoints.toFixed(2)}/{f.maxPoints.toFixed(2)}pts
                      </span>
                      <Badge variant={resultBadgeVariant(f.wins, f.losses)}>
                        {resultLabel(f.wins, f.losses)}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Quick Stats */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Most Played</CardTitle>
                <CardDescription>
                  Players with the most match appearances
                </CardDescription>
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

            <Card>
              <CardHeader>
                <CardTitle>Best Win Rate</CardTitle>
                <CardDescription>
                  Players with the highest win rate (W=1, H=½, min. 3 matches)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {topWinRate.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
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
                        {(p.winRate * 100).toFixed(0)}% ({p.wins}W {p.halved}H{" "}
                        {p.played - p.wins - p.halved}L)
                      </span>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
