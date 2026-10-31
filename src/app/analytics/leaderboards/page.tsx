import Link from "next/link";
import { loadInsightData } from "@/lib/insight-data";
import { getDataScope } from "@/lib/data-scope";
import { getContributionLeaders } from "@/lib/insights";
import { AnalyticsFilters, AnalyticsFrame, AnalyticsPanel, AnalyticsProgress, AnalyticsTable, percent, points } from "@/components/analytics-view";
import { readAnalyticsFilters, type AnalyticsPageProps } from "@/components/analytics-navigation";
import { TableCell, TableRow } from "@/components/ui/table";

export default async function LeaderboardsPage({ searchParams }: AnalyticsPageProps) {
  const [data, params, scope] = await Promise.all([loadInsightData(), searchParams, getDataScope()]);
  const { location, minAppearances } = readAnalyticsFilters(params);
  const leaders = getContributionLeaders(data, { scope, location, minAppearances });
  return (
    <AnalyticsFrame title="Contribution, not just percentages." description="Pair points credited to each partner. Never add these to the team total."
      scope={scope}>
      <AnalyticsFilters scope={scope} minimum={minAppearances} location={location} />
      <AnalyticsPanel title={`${leaders.length} qualifying players · ${location === "all" ? "All locations" : location === "home" ? "Home" : "Away"}`}
        description={`At least ${minAppearances} completed appearances in this scope and location. Ranked by points, then points per appearance and sample size.`}>
        <AnalyticsTable label="Contribution rankings" headings={["Rank / player", "Played", "Record · W / H / L", "Points / appearance", "Result yield", "Total points"]}
          empty={!leaders.length ? "No players meet these filters. Lower the minimum or choose a different location." : undefined}>
          {leaders.map((player, index) => <TableRow key={player.playerId}>
            <TableCell><Link className="flex items-center gap-3 font-medium hover:underline" href={`/players/${player.playerId}`}>
              <span className="numeric w-5 text-muted-foreground">{index + 1}</span><span className="desk-avatar" aria-hidden="true">{player.name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("")}</span>{player.name}
            </Link></TableCell>
            <TableCell>{player.played}</TableCell><TableCell>{player.wins} / {player.halved} / {player.losses}</TableCell>
            <TableCell>{points(player.pointsPerAppearance)}</TableCell><TableCell>{percent(player.yield)}</TableCell>
            <TableCell className="min-w-32"><strong className="numeric">{points(player.points)}</strong><AnalyticsProgress
              value={leaders[0].points ? player.points / leaders[0].points * 100 : 0}
              label={`${player.name}: ${points(player.points)} points; relative contribution to leading player`} /></TableCell>
          </TableRow>)}
        </AnalyticsTable>
        <p className="data-note">Each partner receives the full pair credit: 1 for a win or ½ for a half, multiplied by min(30 / completed fixture matches, 2).
          Player credits must not be summed as extra team points. Credits use full precision before rounding; season team points sum rounded fixture scores.</p>
        <p className="data-note">Result yield = (W + ½H) / played, not pure win rate. All locations includes neutral fixtures. The default minimum is 3 appearances in the selected location.</p>
      </AnalyticsPanel>
    </AnalyticsFrame>
  );
}
