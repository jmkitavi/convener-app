import Link from "next/link";
import { loadInsightData } from "@/lib/insight-data";
import { getDataScope } from "@/lib/data-scope";
import { getHandicapInsights } from "@/lib/insights";
import { TableCell, TableRow } from "@/components/ui/table";
import { AnalyticsAction, AnalyticsFrame, AnalyticsPanel, AnalyticsStats, AnalyticsTable, percent } from "@/components/analytics-view";
import { analyticsHref } from "@/components/analytics-navigation";
import { HandicapChart } from "./handicap-chart";

const mean = (value: number | null) => value === null ? "—" : value.toFixed(2);

export default async function HandicapsPage() {
  const [data, scope] = await Promise.all([loadInsightData(), getDataScope()]);
  const insight = getHandicapInsights(data, { scope });
  return (
    <AnalyticsFrame title="Balance the squad, not just the numbers." description="Historical index gaps and observed results, without overstating the link."
      scope={scope} actions={<AnalyticsAction href="/players">Explore the squad</AnalyticsAction>}>
      <AnalyticsStats items={[
        { label: "Complete historical sample", value: insight.completeCount, detail: "All four recorded match indices known" },
        { label: "Excluded from index analysis", value: insight.excludedCount, detail: "At least one historical index is unknown" },
        { label: "Recorded index coverage", value: insight.completedCount ? percent(insight.completeCount / insight.completedCount) : "—", detail: `${insight.completeCount} of ${insight.completedCount} completed matches` },
        { label: "Mean combined index gap", value: mean(insight.meanDifference), detail: "Team indices minus opponent indices" },
      ]} />
      <p className="desk-note desk-note-amber">{insight.completeCount} complete / {insight.completedCount} completed matches · {insight.excludedCount} excluded because at least one historical handicap is unknown.
        {" "}<Link href={analyticsHref("/analytics/data-quality", scope)} className="underline underline-offset-4">Review missing indices</Link></p>
      <div className="desk-two-column">
      <AnalyticsPanel title="A view of the recorded index gaps" description="Completed matches grouped by combined index difference, not current roster index bands.">
        <HandicapChart buckets={insight.buckets} mode="samples" />
        <p className="desk-panel-footer text-xs text-muted-foreground">Historical snapshots only. Missing indices are never replaced with current player indices.</p>
      </AnalyticsPanel>
      <AnalyticsPanel title="Results by index gap" description="Continuous, non-overlapping buckets include decimal index differences.">
        <AnalyticsTable label="Results by recorded index gap" headings={["Combined index gap", "Played", "W / H / L", "Result yield"]}
          empty={!insight.completeCount ? "No completed matches have all four recorded indices in this scope." : undefined}>
          {insight.buckets.map((bucket) => <TableRow key={bucket.label}>
            <TableCell>{bucket.label}</TableCell><TableCell>{bucket.played}</TableCell>
            <TableCell>{bucket.wins} / {bucket.halved} / {bucket.losses}</TableCell><TableCell>{bucket.played ? percent((bucket.wins + 0.5 * bucket.halved) / bucket.played) : "—"}</TableCell>
          </TableRow>)}
        </AnalyticsTable>
        <p className="desk-note">Small samples and partner effects mean this is not a selection rule. Result yield = (W + ½H) / played, not pure win rate.</p>
      </AnalyticsPanel>
      </div>
      <AnalyticsPanel title="Recorded index context" description="Positive gaps mean a higher combined team index. These are index differences, not playing strokes or allocated shots.">
        <AnalyticsTable label="Mean recorded indices by location" headings={["Location", "Complete sample", "Excluded", "Mean team combined", "Mean opponent combined", "Mean index gap"]}>
          {[{ location: "all", ...insight }, ...insight.byLocation].map((row) => <TableRow key={row.location}>
            <TableCell className="capitalize">{row.location}</TableCell><TableCell>{row.completeCount}</TableCell><TableCell>{row.excludedCount}</TableCell>
            <TableCell>{mean(row.meanTeamCombined)}</TableCell><TableCell>{mean(row.meanOpponentCombined)}</TableCell><TableCell>{mean(row.meanDifference)}</TableCell>
          </TableRow>)}
        </AnalyticsTable>
        <p className="data-note">Only completed matches with all four recorded handicaps contribute. Unknown is not zero; current player indices do not fill historical gaps.
          These associations do not show that handicap gaps cause results. Course and playing-handicap rules are not modeled here.</p>
      </AnalyticsPanel>
    </AnalyticsFrame>
  );
}
