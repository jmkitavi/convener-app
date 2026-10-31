import Link from "next/link";
import { getDataQuality, getHandicapInsights, getSeasonSummary, isInternalFixture, type DataScope, type InsightData } from "@/lib/insights";
import type { MatchWithDetails } from "@/lib/analytics";
import { TableCell, TableRow } from "@/components/ui/table";
import { AnalyticsPanel, AnalyticsStats, AnalyticsTable, percent } from "./analytics-view";
import { matchCorrectionHref } from "./analytics-navigation";

function missingHandicaps(match: MatchWithDetails) {
  return [
    [match.player1Name, match.player1Handicap], [match.player2Name, match.player2Handicap],
    [match.opponent1PlayerName ?? match.opponent1Name, match.opponent1Handicap],
    [match.opponent2PlayerName ?? match.opponent2Name, match.opponent2Handicap],
  ].filter(([, handicap]) => handicap === null).map(([name]) => name).join(", ");
}

function MatchQueue({ matches, handicaps = false }: { matches: MatchWithDetails[]; handicaps?: boolean }) {
  return (
    <AnalyticsTable label={handicaps ? "Missing match handicaps" : "Pending match results"}
      headings={["Fixture", "Pair", handicaps ? "Missing recorded indices" : "Recorded state", "Correction"]}
      empty={!matches.length ? "No rows in this queue." : undefined}>
      {matches.map((match) => <TableRow key={match.id}>
        <TableCell>{match.fixtureDate}<span className="block text-xs text-muted-foreground">{match.opponentClubName}</span></TableCell>
        <TableCell>{match.player1Name} / {match.player2Name}</TableCell>
        <TableCell className="max-w-80 whitespace-normal">{handicaps ? missingHandicaps(match) : "Pending result"}</TableCell>
        <TableCell><Link className="font-medium underline underline-offset-4" href={matchCorrectionHref(match)}>Edit match #{match.matchOrder}</Link></TableCell>
      </TableRow>)}
    </AnalyticsTable>
  );
}

export function AnalyticsQuality({ data, scope, asOf, queue = "all" }: {
  data: InsightData; scope: DataScope; asOf?: string; queue?: "all" | "results" | "handicaps" | "roster";
}) {
  const quality = getDataQuality(data, { scope, asOf });
  const summary = getSeasonSummary(data, { scope, asOf });
  const handicaps = getHandicapInsights(data, { scope });
  const past = summary.fixtures.filter((fixture) => !fixture.future);
  const ndcPending = quality.pendingMatches.filter((match) => !isInternalFixture(match));
  return (
    <>
      <AnalyticsStats items={[
        { label: "Past-fixture results coverage", value: past.length ? `${summary.resultsCoveragePct.toFixed(1)}%` : "—", detail: `${past.filter((fixture) => fixture.completed > 0).length} of ${past.length} past fixtures have completed results` },
        { label: "Historical index coverage", value: handicaps.completedCount ? percent(handicaps.completeCount / handicaps.completedCount) : "—", detail: `${handicaps.completeCount} of ${handicaps.completedCount} completed matches have four indices` },
        { label: "Provisional scorecards", value: quality.provisionalFixtures.length, detail: "Both completed and pending match rows" },
        { label: "Past fixtures to review", value: quality.pastFixturesWithoutResults.length, detail: "No completed results; future fixtures excluded" },
      ]} />
      <form method="get" className="desk-toolbar flex flex-wrap items-end gap-3">
        <input type="hidden" name="scope" value={scope} />
        <label className="grid gap-1 text-sm">Correction queues
          <select name="queue" defaultValue={queue} className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="all">All checks</option><option value="results">Results & scorecards</option>
            <option value="handicaps">Historical indices</option><option value="roster">Roster history</option>
          </select>
        </label>
        <button type="submit" className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Apply filters</button>
      </form>
      <p className="desk-note desk-note-amber">These queues overlap and must not be added as a unique issue total. A pending-only fixture can also appear under past fixtures without completed results.
        Corrections use the existing fixture, match and player editors; no bulk changes are applied here.</p>
      {(queue === "all" || queue === "handicaps") && <AnalyticsPanel title={`Missing match handicaps · ${quality.incompleteHandicaps.length}`}
        description="Completed matches with at least one unknown historical index. Ordinary results still count; only handicap-dependent analysis excludes them. Zero is a known index.">
        <MatchQueue matches={quality.incompleteHandicaps} handicaps />
      </AnalyticsPanel>}
      {(queue === "all" || queue === "results") && <>
      <AnalyticsPanel title={`Past fixtures without completed results · ${quality.pastFixturesWithoutResults.length}`}
        description={`${quality.emptyPastFixtures.length} have no match rows. Due through today; future fixtures are excluded. Pending-only fixtures also appear in the pending queue.`}>
        <AnalyticsTable label="Past fixtures without completed results" headings={["Date", "Opponent", "Venue", "Recorded rows", "Correction"]}
          empty={!quality.pastFixturesWithoutResults.length ? "All past fixtures in this scope have at least one completed result." : undefined}>
          {quality.pastFixturesWithoutResults.map((fixture) => <TableRow key={fixture.id}>
            <TableCell>{fixture.date}</TableCell><TableCell>{fixture.opponentClubName}</TableCell><TableCell>{fixture.venueName}</TableCell>
            <TableCell>{fixture.pending ? `${fixture.pending} pending` : "No match rows"}</TableCell>
            <TableCell><Link href={`/fixtures/${fixture.id}`} className="font-medium underline underline-offset-4">Review scorecard</Link></TableCell>
          </TableRow>)}
        </AnalyticsTable>
      </AnalyticsPanel>
      <AnalyticsPanel title={`Partial fixtures · ${quality.provisionalFixtures.length}`}
        description="Fixtures with both completed and pending match rows. Their current points are provisional, not a final fixture result.">
        <AnalyticsTable label="Partial fixture results" headings={["Date", "Opponent", "Completed", "Pending", "Correction"]}
          empty={!quality.provisionalFixtures.length ? "No partially completed scorecards in this scope." : undefined}>
          {quality.provisionalFixtures.map((fixture) => <TableRow key={fixture.id}>
            <TableCell>{fixture.date}</TableCell><TableCell>{fixture.opponentClubName}</TableCell><TableCell>{fixture.completed}</TableCell><TableCell>{fixture.pending}</TableCell>
            <TableCell><Link href={`/fixtures/${fixture.id}`} className="font-medium underline underline-offset-4">Complete scorecard</Link></TableCell>
          </TableRow>)}
        </AnalyticsTable>
      </AnalyticsPanel>
      <AnalyticsPanel title={`NDC pending matches · ${ndcPending.length}`} description="Unresolved NDC rows, including future scheduled matches. A pending row is not a loss or evidence of an overdue result.">
        <MatchQueue matches={ndcPending} />
      </AnalyticsPanel>
      <AnalyticsPanel title={`Internal pending matches · ${quality.internalPendingMatches.length}`}
        description="Shown separately for visibility, even in NDC-only scope. Internal pending rows are not included in the NDC pending count.">
        <MatchQueue matches={quality.internalPendingMatches} />
      </AnalyticsPanel>
      </>}
      {(queue === "all" || queue === "roster") && <AnalyticsPanel title={`Roster without scoped appearances · ${quality.rosterWithoutAppearances.length}`}
        description="No completed appearances in this scope is not inactivity or an error. Review identity/history only if needed; this page does not change active status.">
        <AnalyticsTable label="Roster without scoped appearances" headings={["Player", "Recorded roster status", "Review"]}
          empty={!quality.rosterWithoutAppearances.length ? "Every roster player has a completed appearance in this scope." : undefined}>
          {quality.rosterWithoutAppearances.map((player) => <TableRow key={player.id}>
            <TableCell className="font-medium">{player.name}</TableCell><TableCell>{player.active ? "Active" : "Inactive"}</TableCell>
            <TableCell><Link className="underline underline-offset-4" href={`/players/${player.id}`}>Review profile</Link></TableCell>
          </TableRow>)}
        </AnalyticsTable>
      </AnalyticsPanel>}
      <p className="desk-note">A structurally complete record can still contain an incorrect score. Confirm the original scorecard before using results for selection. These checks do not infer missing scores, validate names or change roster status.</p>
    </>
  );
}
