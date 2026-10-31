import type { DataScope, LocationFilter } from "@/lib/insights";

export type AnalyticsSearchParams = Record<string, string | string[] | undefined>;
export type AnalyticsPageProps = { searchParams: Promise<AnalyticsSearchParams> };

export function readAnalyticsFilters(params: AnalyticsSearchParams, defaultMinimum = 3) {
  const rawMinimum = typeof params.min === "string" ? Number(params.min) : NaN;
  return {
    location: (params.location === "home" || params.location === "away" ? params.location : "all") as LocationFilter,
    minAppearances: Number.isSafeInteger(rawMinimum) && rawMinimum >= 1 && rawMinimum <= 1000
      ? rawMinimum : defaultMinimum,
    sort: params.sort === "home-edge" ? "home-edge" as const : "away" as const,
  };
}

export function analyticsHref(path: string, scope: DataScope) {
  return `${path}?scope=${scope}`;
}

export function matchCorrectionHref(match: { fixtureId: number; id: number }) {
  return `/fixtures/${match.fixtureId}#match-${match.id}`;
}

export const analyticsDestinations = [
  { href: "/analytics/pairings", title: "Partnership evidence", description: "Raw records, points together and sample-adjusted result yield." },
  { href: "/analytics/venues", title: "Venue performance", description: "Completed match samples and results at each recorded venue." },
  { href: "/analytics/handicaps", title: "Handicap context", description: "Recorded index gaps, continuous buckets and missing-data coverage." },
  { href: "/analytics/leaderboards", title: "Points leaders", description: "Full contribution rankings, appearance thresholds and location filters." },
  { href: "/analytics/home-away", title: "Home vs away", description: "Team points capture and qualified player comparisons with both samples." },
  { href: "/analytics/data-quality", title: "Data quality", description: "Actionable correction queues linked to existing scorecards and profiles." },
  { href: "/analytics/suggest", title: "Home pairing suggestions", description: "Build home pairings with the existing recommendation engine." },
  { href: "/analytics/counter", title: "Away counter-pairing", description: "Work with opponent lineups and existing matchup tools." },
] as const;
