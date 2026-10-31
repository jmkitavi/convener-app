import Link from "next/link";
import { loadInsightData } from "@/lib/insight-data";
import { getDataScope } from "@/lib/data-scope";
import { getPairingEvidence } from "@/lib/insights";
import { TableCell, TableRow } from "@/components/ui/table";
import { AnalyticsAction, AnalyticsFilters, AnalyticsFrame, AnalyticsPanel, AnalyticsStats, AnalyticsTable, percent, points } from "@/components/analytics-view";
import { analyticsHref, readAnalyticsFilters, type AnalyticsPageProps } from "@/components/analytics-navigation";

export default async function PairingsPage({ searchParams }: AnalyticsPageProps) {
  const [data, params, scope] = await Promise.all([loadInsightData(), searchParams, getDataScope()]);
  const { location, minAppearances } = readAnalyticsFilters(params, 1);
  const evidence = getPairingEvidence(data, { scope, location });
  const pairs = evidence.pairs.filter((pair) => pair.played >= minAppearances);
  const established = Math.max(0, ...evidence.pairs.map((pair) => pair.played));
  return (
    <AnalyticsFrame title="Chemistry, with evidence." description="Look beyond the unbeaten pairing that has only played once."
      scope={scope} actions={<AnalyticsAction href={analyticsHref("/analytics/suggest", scope)}>Build a home lineup</AnalyticsAction>}>
      <AnalyticsStats items={[
        { label: "Unique pairings", value: evidence.uniquePairCount, detail: "Across completed matches in this location" },
        { label: "Repeated partnerships", value: evidence.repeatedPairCount, detail: "At least two shared appearances" },
        { label: "Most established", value: established ? `${established} matches` : "—", detail: "Largest recorded shared sample" },
        { label: "Repeated-match coverage", value: evidence.completedMatchCount ? percent(evidence.repeatedMatchCoverage) : "—", detail: `${evidence.repeatedMatchCount} / ${evidence.completedMatchCount} completed matches` },
      ]} />
      <AnalyticsFilters scope={scope} location={location} minimum={minAppearances} minimumLabel="Minimum shared appearances" />
      <AnalyticsPanel title={`Partnerships worth revisiting · ${pairs.length}`} description="Adjusted yield keeps short, unbeaten runs in perspective. Sorted by adjusted yield, then appearances; no top-list cutoff.">
        <AnalyticsTable label="Partnership records" headings={["Partnership", "Played", "Record · W / H / L", "Points together", "Raw yield", "Adjusted yield"]}
          empty={!pairs.length ? "No pairs meet this appearance threshold in the selected scope." : undefined}>
          {pairs.map((pair) => <TableRow key={`${pair.player1Id}-${pair.player2Id}`}>
            <TableCell className="font-medium"><Link href={`/players/${pair.player1Id}`} className="hover:underline">{pair.player1Name}</Link><Link href={`/players/${pair.player2Id}`} className="block text-xs text-muted-foreground hover:underline">+ {pair.player2Name}</Link></TableCell>
            <TableCell>{pair.played}</TableCell><TableCell>{pair.wins} / {pair.halved} / {pair.losses}</TableCell>
            <TableCell>{points(pair.pointsTogether)}</TableCell><TableCell>{percent(pair.rawYield)}</TableCell><TableCell><strong className="text-primary">{percent(pair.adjustedYield)}</strong><span className="block text-xs text-muted-foreground">{pair.played >= 2 ? "Repeated pairing" : "Small sample"}</span></TableCell>
          </TableRow>)}
        </AnalyticsTable>
        <p className="desk-note">Adjusted yield shrinks small samples toward the team average. It is an exploratory measure, not a predicted win probability or pairing-engine score.</p>
        <details className="desk-panel-footer text-sm">
          <summary className="cursor-pointer font-medium">How to read this table</summary>
          <p className="data-note">Sample-adjusted yield = (W + ½H + 3 × team result yield) / (played + 3). The three-match prior shrinks small samples toward the scoped team yield ({evidence.completedMatchCount ? percent(evidence.teamYield) : "—"}). Raw yield = (W + ½H) / played, not pure win rate. Points together are fixture-weighted team-side credits, not additional team points. Internal fixtures may contribute both linked partnerships without double-counting match coverage.</p>
        </details>
      </AnalyticsPanel>
    </AnalyticsFrame>
  );
}
