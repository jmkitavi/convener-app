import Link from "next/link";
import { ArrowUpRight, Flag, MapPin, Users, BarChart3, ShieldCheck, Target } from "lucide-react";
import { AnalyticsFrame, AnalyticsPanel, points } from "./analytics-view";
import { analyticsDestinations, analyticsHref, matchCorrectionHref } from "./analytics-navigation";
import {
  getCloseLossInsights, getDataQuality, getPairingEvidence, getSeasonSummary,
  type DataScope, type InsightData,
} from "@/lib/insights";

export function AnalyticsClient({ data, scope }: { data: InsightData; scope: DataScope }) {
  const summary = getSeasonSummary(data, { scope });
  const pairs = getPairingEvidence(data, { scope });
  const close = getCloseLossInsights(data, { scope });
  const quality = getDataQuality(data, { scope });
  const home = getSeasonSummary(data, { scope, location: "home" });
  const away = getSeasonSummary(data, { scope, location: "away" });
  const icons = [Users, MapPin, BarChart3, Flag, MapPin, ShieldCheck, Target, Target];
  return (
    <AnalyticsFrame title="Make the next decision a better one." description="Performance & decisions, with the recorded patterns and their limitations kept in view."
      scope={scope}>
      <section className="desk-summary grid gap-6 p-5 sm:grid-cols-3 sm:p-7" aria-label="Scope summary">
        <div><p className="text-sm uppercase tracking-wider opacity-80">Points captured</p><p className="numeric mt-2 text-4xl font-semibold">{points(summary.teamPoints)} <span className="text-lg opacity-70">/ {points(summary.availablePoints)}</span></p>
          <p className="mt-3 text-xs opacity-80">{summary.availablePoints ? `${summary.capturePct.toFixed(1)}% capture · ` : ""}{summary.recordedFixtureCount} recorded fixtures · {summary.provisionalFixtureCount} provisional</p></div>
        {[{ label: "At home", value: home }, { label: "On the road", value: away }].map(({ label, value }) =>
          <div key={label}><p className="text-sm uppercase tracking-wider opacity-80">{label}</p>
            <p className="numeric mt-2 text-4xl font-semibold">{value.availablePoints ? `${value.capturePct.toFixed(1)}%` : "—"}</p>
            <p className="mt-3 text-xs opacity-80">{points(value.teamPoints)} of {points(value.availablePoints)} points · {value.recordedFixtureCount} recorded fixtures · {value.provisionalFixtureCount} provisional</p>
          </div>)}
      </section>
      <p className="data-note">{summary.dateRange ? `Recorded fixture inventory: ${summary.dateRange.from} to ${summary.dateRange.to}.` : "No fixtures in this scope yet."}
        {" "}Fixture scores with pending rows remain provisional. Result yield is not a pure win rate.</p>
      <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">A clearer picture of the recorded history</h2>
      <div className="desk-discovery-grid grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {analyticsDestinations.map(({ href, title, description }, index) => {
          const Icon = icons[index];
          return <Link key={href} href={analyticsHref(href, scope)} className="desk-discovery-card desk-panel group min-w-0 space-y-4 p-5 transition-shadow hover:shadow-md">
            <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
            <h2 className="flex items-center justify-between gap-3 text-base font-semibold">{title}<ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" /></h2>
            <p className="mt-2 text-sm text-muted-foreground">{description}</p>
            {href === "/analytics/data-quality" && <p className="mt-3 text-sm font-medium">{quality.incompleteHandicaps.length} incomplete handicap rows · {quality.pastFixturesWithoutResults.length} past fixtures without results</p>}
            {href === "/analytics/pairings" && <p className="text-xs text-muted-foreground">{pairs.uniquePairCount} partnerships · {pairs.repeatedPairCount} repeated</p>}
            <span className="inline-flex items-center gap-2 text-sm font-medium text-primary">Explore <ArrowUpRight className="h-4 w-4" aria-hidden="true" /></span>
          </Link>
        })}
      </div>
      <AnalyticsPanel title="Close losses · context, not a forecast" description="Close means recorded margins of 1UP, 2UP or 2&1. A 1UP result does not establish that the match was decided on the last hole.">
        <div className="grid gap-4 sm:grid-cols-3">
          <div><p className="text-sm text-muted-foreground">Close losses / all losses</p><p className="numeric text-2xl font-semibold">{close.closeLossCount} / {close.lossCount}</p></div>
          <div><p className="text-sm text-muted-foreground">Of these, one-up losses</p><p className="numeric text-2xl font-semibold">{close.oneUpLossCount}</p></div>
          <div><p className="text-sm text-muted-foreground">Hypothetical extra team points</p><p className="numeric text-2xl font-semibold">{points(close.hypotheticalExtraPoints)}</p></div>
        </div>
        <p className="data-note">Scenario only: turn every recorded 1UP loss into a half, holding the fixture field and all other results fixed. Uses each fixture&apos;s full-precision match weight.
          {" "}{close.excludedMarginCount} losses with unknown or unrecognized margins are excluded from margin analysis.</p>
        {close.closeLosses.length > 0 && <details>
          <summary className="cursor-pointer text-sm font-medium">Review {close.closeLossCount} close-loss scorecards</summary>
          <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            {close.closeLosses.map((match) => <li key={match.id}>
              <Link className="underline underline-offset-4" href={matchCorrectionHref(match)}>
                {match.fixtureDate} · {match.player1Name} / {match.player2Name} · {match.margin}
              </Link>
            </li>)}
          </ul>
        </details>}
      </AnalyticsPanel>
    </AnalyticsFrame>
  );
}
