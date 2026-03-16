"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Users,
  GitCompareArrows,
  MapPin,
  Lightbulb,
  Shield,
  TrendingUp,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  getTeamRecord,
  getPairingStats,
  getVenueStats,
  type MatchWithDetails,
} from "@/lib/analytics";

const INTERNAL_CLUB_IDS = new Set([16, 17]);

type DataMode = "ndc" | "all";

const subPages = [
  {
    href: "/analytics/pairings",
    title: "Partner Compatibility",
    description: "Win rates for every player pairing combination",
    icon: Users,
  },
  {
    href: "/analytics/handicaps",
    title: "Handicap Matchups",
    description: "Performance by handicap differential ranges",
    icon: GitCompareArrows,
  },
  {
    href: "/analytics/venues",
    title: "Venue Performance",
    description: "Win rates broken down by venue",
    icon: MapPin,
  },
  {
    href: "/analytics/suggest",
    title: "Pairing Suggestions",
    description: "Optimal pairing recommendations for home matches",
    icon: Lightbulb,
  },
  {
    href: "/analytics/counter",
    title: "Counter-Pairing",
    description: "Counter opponent lineups for away matches with stroke analysis",
    icon: Shield,
  },
] as const;

export function AnalyticsClient({
  allMatches,
}: {
  allMatches: MatchWithDetails[];
}) {
  const [mode, setMode] = useState<DataMode>("ndc");

  const matches = useMemo(() => {
    if (mode === "all") return allMatches;
    return allMatches.filter((m) => !INTERNAL_CLUB_IDS.has(m.opponentClubId));
  }, [allMatches, mode]);

  const teamRecord = useMemo(() => getTeamRecord(matches), [matches]);
  const pairings = useMemo(() => getPairingStats(matches), [matches]);
  const venues = useMemo(() => getVenueStats(matches), [matches]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">
            Deep-dive into team performance and pairing insights
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

      {/* Summary stats */}
      {matches.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card size="sm">
            <CardContent className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Team Record</p>
                <p className="text-lg font-semibold">
                  {teamRecord.wins}-{teamRecord.losses}-{teamRecord.halved}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Win Rate</p>
                <p className="text-lg font-semibold">
                  {(teamRecord.winRate * 100).toFixed(1)}%
                </p>
              </div>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pairings Tested</p>
                <p className="text-lg font-semibold">{pairings.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Venues Played</p>
                <p className="text-lg font-semibold">{venues.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sub-page links */}
      <div className="grid gap-4 sm:grid-cols-2">
        {subPages.map(({ href, title, description, icon: Icon }) => (
          <Link key={href} href={href} className="group">
            <Card className="transition-shadow group-hover:ring-2 group-hover:ring-emerald-500/30">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle>{title}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      {matches.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No {mode === "ndc" ? "NDC league " : ""}match data yet. Record some
            fixtures and matches to see analytics.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
