import Link from "next/link";
import { loadInsightData } from "@/lib/insight-data";
import { getDataScope } from "@/lib/data-scope";
import { getHomeAwayComparisons } from "@/lib/insights";
import { AnalyticsAction, AnalyticsFilters, AnalyticsFrame, AnalyticsPanel, AnalyticsProgress, AnalyticsTable, percent, points } from "@/components/analytics-view";
import { analyticsHref, readAnalyticsFilters, type AnalyticsPageProps } from "@/components/analytics-navigation";
import { TableCell, TableRow } from "@/components/ui/table";

export default async function HomeAwayPage({ searchParams }: AnalyticsPageProps) {
  const [data, params, scope] = await Promise.all([loadInsightData(), searchParams, getDataScope()]);
  const { minAppearances, sort } = readAnalyticsFilters(params, 2);
  const comparison = getHomeAwayComparisons(data, { scope, minAppearances, sort });
  const gap = comparison.home.capturePct - comparison.away.capturePct;
  const comparable = comparison.home.availablePoints > 0 && comparison.away.availablePoints > 0;
  const awayLeaders = [...comparison.players].sort((a, b) => b.away.yield - a.away.yield || b.away.played - a.away.played || a.name.localeCompare(b.name)).slice(0, 4);
  return (
    <AnalyticsFrame title="Two sides of the same team." description="Points capture, not outright match win rate. Context matters."
      scope={scope} actions={<AnalyticsAction href={analyticsHref("/analytics/venues", scope)}>View venues</AnalyticsAction>}>
      <section className="desk-summary grid gap-6 p-5 sm:grid-cols-3 sm:p-7" aria-label="Home and away summary">
        <div><p className="text-sm uppercase tracking-wider opacity-80">Points capture gap</p>
          <p className="numeric mt-2 text-4xl font-semibold">{comparable ? `${gap > 0 ? "+" : ""}${gap.toFixed(1)}` : "—"} <span className="text-base opacity-80">{comparable ? "pp" : ""}</span></p>
          <p className="mt-3 text-xs opacity-80">Home capture minus away capture · descriptive, not causal</p></div>
        {(["home", "away"] as const).map((location) => <div key={location}>
          <p className="text-sm uppercase tracking-wider opacity-80">{location} points</p>
          <p className="numeric mt-2 text-4xl font-semibold">{points(comparison[location].teamPoints)} <span className="text-lg opacity-70">/ {points(comparison[location].availablePoints)}</span></p>
          <p className="mt-3 text-xs opacity-80">{comparison[location].recordedFixtureCount} recorded fixtures · {comparison[location].provisionalFixtureCount} provisional</p>
        </div>)}
      </section>
      <div className="desk-two-column">
      <AnalyticsPanel title="Two sides of the record" description="Same points scale. Different opponents and selections.">
        {(["home", "away"] as const).map((location) => {
          const summary = comparison[location];
          return <div key={location} className="space-y-3 border-b py-3 last:border-b-0">
            <div className="flex items-center justify-between"><span className="desk-status capitalize" data-tone={location}>{location}</span>
              <strong className="numeric text-3xl">{summary.availablePoints ? `${summary.capturePct.toFixed(1)}%` : "—"}</strong></div>
            <AnalyticsProgress value={summary.capturePct} label={`${location} points capture`} tone={location} />
            <p className="flex flex-wrap justify-between gap-2 text-sm text-muted-foreground"><span>{points(summary.teamPoints)} / {points(summary.availablePoints)} points</span>
              <span>{summary.recordedFixtureCount ? points(summary.pointsPerRecordedFixture) : "—"} points / recorded fixture</span></p>
            <p className="data-note">{summary.recordedFixtureCount} recorded / {summary.fixtureCount} fixtures · {summary.provisionalFixtureCount} provisional · Match W / H / L: {summary.matchRecord.wins} / {summary.matchRecord.halved} / {summary.matchRecord.losses}.
              {" "}Final fixture W / D / L: {summary.fixtureRecord.wins} / {summary.fixtureRecord.draws} / {summary.fixtureRecord.losses}.</p>
          </div>;
        })}
      </AnalyticsPanel>
      <AnalyticsPanel title="Travel-ready records" description={`Highest away yield among players with at least ${minAppearances} appearances in each location.`}>
        {!awayLeaders.length && <p className="data-note">No players qualify in both locations at this threshold.</p>}
        {awayLeaders.map((player) => <Link key={player.playerId} href={`/players/${player.playerId}`} className="flex items-center justify-between gap-4 border-b py-3 last:border-b-0 hover:text-primary">
          <span><strong className="text-sm">{player.name}</strong><span className="block text-xs text-muted-foreground">{player.away.played} away · {player.home.played} home appearances</span></span>
          <span className="numeric font-semibold">{percent(player.away.yield)}<span className="block text-[10px] font-normal uppercase tracking-wide text-muted-foreground">Away yield</span></span>
        </Link>)}
        <p className="desk-panel-footer text-xs text-muted-foreground">A descriptive record, not a selection recommendation. The complete comparison remains below.</p>
      </AnalyticsPanel>
      </div>
      <p className="data-note">Neutral fixtures are excluded. Points per recorded fixture includes fixtures with any completed result; partial scores are provisional.
        Different fields, partners and opponents limit direct comparisons. These are descriptive records, not a home-advantage estimate.</p>
      <AnalyticsFilters scope={scope} minimum={minAppearances} minimumLabel="Minimum appearances each side" sort={sort} />
      <AnalyticsPanel title={`Qualified player comparisons · ${comparison.players.length}`}
        description={`At least ${minAppearances} home and ${minAppearances} away appearances each. Default qualification: 2 in each location.`}>
        <AnalyticsTable label="Player home and away records"
          headings={["Player", "Home played", "Home W / H / L", "Home yield", "Away played", "Away W / H / L", "Away yield", "Home edge (pp)"]}
          empty={!comparison.players.length ? "No players qualify in both locations at this threshold." : undefined}>
          {comparison.players.map((player) => <TableRow key={player.playerId}>
            <TableCell className="font-medium"><Link className="hover:underline" href={`/players/${player.playerId}`}>{player.name}</Link></TableCell>
            <TableCell>{player.home.played}</TableCell><TableCell>{player.home.wins} / {player.home.halved} / {player.home.losses}</TableCell><TableCell>{percent(player.home.yield)}</TableCell>
            <TableCell>{player.away.played}</TableCell><TableCell>{player.away.wins} / {player.away.halved} / {player.away.losses}</TableCell><TableCell>{percent(player.away.yield)}</TableCell>
            <TableCell>{player.homeEdge > 0 ? "+" : ""}{(player.homeEdge * 100).toFixed(1)}</TableCell>
          </TableRow>)}
        </AnalyticsTable>
        <p className="data-note">Result yield = (W + ½H) / played, not pure win rate. Home edge is home yield minus away yield in percentage points; a negative edge means the away yield is higher.
          Sorting by home edge shows the largest signed edge first.</p>
      </AnalyticsPanel>
    </AnalyticsFrame>
  );
}
