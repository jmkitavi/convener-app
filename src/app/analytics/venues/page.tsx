import { loadInsightData } from "@/lib/insight-data";
import { getDataScope } from "@/lib/data-scope";
import { getSeasonSummary, selectInsightData } from "@/lib/insights";
import { getVenueStats } from "@/lib/analytics";
import { TableCell, TableRow } from "@/components/ui/table";
import { AnalyticsAction, AnalyticsFilters, AnalyticsFrame, AnalyticsPanel, AnalyticsProgress, AnalyticsTable, percent } from "@/components/analytics-view";
import { analyticsHref, readAnalyticsFilters, type AnalyticsPageProps } from "@/components/analytics-navigation";
import { VenueChart } from "./venue-chart";

export default async function VenuesPage({ searchParams }: AnalyticsPageProps) {
  const [data, params, scope] = await Promise.all([loadInsightData(), searchParams, getDataScope()]);
  const { location } = readAnalyticsFilters(params);
  const venues = getVenueStats(selectInsightData(data, { scope, location }).matches);
  const summary = getSeasonSummary(data, { scope, location });
  return (
    <AnalyticsFrame title="Different courses. Different stories." description="Compare completed match samples and results at each recorded venue."
      scope={scope} actions={<AnalyticsAction href={analyticsHref("/analytics/home-away", scope)}>Home &amp; away</AnalyticsAction>}>
      <AnalyticsFilters scope={scope} location={location} />
      <p className="data-note">{venues.length} venues · {summary.matchRecord.total} completed matches · {summary.pendingMatchCount} pending rows excluded.
        Home/away comes from fixture location, not venue names. This view groups venue names only.</p>
      <div className="desk-two-column">
      <AnalyticsPanel title="Results by recorded venue" description="Stacked counts of wins, halves and losses. Compare sample sizes before interpreting results.">
        <VenueChart venues={venues} />
      </AnalyticsPanel>
      <AnalyticsPanel title="Course notebook" description="Result yield · Selected location">
        {!venues.length && <p className="data-note">No completed venue records in the selected scope.</p>}
        {venues.map((venue) => {
          const resultYield = (venue.wins + venue.halved * 0.5) / venue.played;
          return <div key={venue.venueName} className="space-y-2 border-b pb-4 last:border-b-0">
            <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-medium">{venue.venueName}</h3><strong className="numeric">{percent(resultYield)}</strong></div>
            <AnalyticsProgress value={resultYield * 100} label={`${venue.venueName} result yield`} />
            <p className="flex justify-between gap-2 text-xs text-muted-foreground"><span>{venue.played} completed matches</span><span>{venue.wins}W · {venue.halved}H · {venue.losses}L</span></p>
          </div>;
        })}
      </AnalyticsPanel>
      </div>
      <p className="desk-note">Venue performance describes the recorded sample. It does not isolate a course effect or adjust for opponent strength. Yield is not fixture points capture.</p>
      <AnalyticsPanel title="Full venue records" description="Result yield = (W + ½H) / played, not pure win rate. It does not adjust for opponents, partners or field size.">
        <AnalyticsTable label="Venue match records" headings={["Venue", "Completed matches", "W", "H", "L", "Result yield"]}
          empty={!venues.length ? "No completed venue records in the selected scope." : undefined}>
          {venues.map((venue) => <TableRow key={venue.venueName}>
            <TableCell className="font-medium">{venue.venueName}</TableCell><TableCell>{venue.played}</TableCell><TableCell>{venue.wins}</TableCell>
            <TableCell>{venue.halved}</TableCell><TableCell>{venue.losses}</TableCell><TableCell>{percent((venue.wins + venue.halved * 0.5) / venue.played)}</TableCell>
          </TableRow>)}
        </AnalyticsTable>
      </AnalyticsPanel>
    </AnalyticsFrame>
  );
}
