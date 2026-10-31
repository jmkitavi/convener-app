"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChartNoAxesCombined, MapPin, Plus, Users } from "lucide-react";
import { FixturePointsChart } from "@/components/fixture-chart";
import { AnalyticsTable, percent, points } from "@/components/analytics-view";
import { analyticsHref, matchCorrectionHref } from "@/components/analytics-navigation";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  getCloseLossInsights, getContributionLeaders, getDataQuality, getHandicapInsights,
  getHomeAwayComparisons, getPairingEvidence, getSeasonSummary,
  type DataScope, type InsightData, type LocationFilter,
} from "@/lib/insights";

function DetailLink({ href, children, className = "text-link" }: {
  href: string; children: React.ReactNode; className?: string;
}) {
  return <Link href={href} className={className}>{children}<ArrowRight aria-hidden="true" className="icon" /></Link>;
}

function dateLabel(date: string, year = false) {
  return new Date(`${date.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}), timeZone: "UTC",
  });
}

function PointsLeaders({ data, scope }: { data: InsightData; scope: DataScope }) {
  const [location, setLocation] = useState<LocationFilter>("all");
  const leaders = getContributionLeaders(data, { scope, location });
  const highestPoints = leaders[0]?.points ?? 0;
  return <section className="panel points-leaders" aria-labelledby="points-leaders-title">
    <div className="panel-heading"><div><div className="eyebrow">Contribution, not just percentages</div>
      <h2 id="points-leaders-title">Who brings home the points?</h2></div></div>
    <p className="section-description">Pair points credited to each partner; these are not extra team points.</p>
    <div className="leaderboard-controls">
      <span>Minimum 3 appearances in the selected scope</span>
      <div className="segmented" role="group" aria-label="Filter player points">
        {(["all", "home", "away"] as const).map((value) => <button key={value} type="button"
          className={location === value ? "selected" : ""} aria-pressed={location === value}
          onClick={() => setLocation(value)}>{value === "all" ? "All" : value === "home" ? "Home" : "Away"}</button>)}
      </div>
    </div>
    <div className="table-scroll" aria-live="polite">
      {leaders.length ? <table className="leader-table">
        <caption className="sr-only">{location} points contributors, minimum three completed appearances</caption>
        <thead><tr><th scope="col">Player</th><th scope="col">Played</th><th scope="col">Pts / app.</th><th scope="col">Points</th></tr></thead>
        <tbody>{leaders.slice(0, 5).map((player, index) => <tr key={player.playerId}>
          <td><Link href={`/players/${player.playerId}`}><span className="leader-rank">{index + 1}</span><span>
            <strong>{player.name}</strong><span className="leader-track" aria-hidden="true">
              <i style={{ width: `${highestPoints ? player.points / highestPoints * 100 : 0}%` }} /></span>
          </span></Link></td>
          <td>{player.played}</td><td>{points(player.pointsPerAppearance)}</td><td><strong>{points(player.points)}</strong></td>
        </tr>)}</tbody>
      </table> : <p className="empty-state">No players have three completed {location === "all" ? "scoped" : location} appearances yet. The full rankings let you lower the minimum.</p>}
    </div>
    <p className="subtle-note">Points per appearance reflects field size. A perfect record over a small sample need not be the largest season contribution. Pending matches are excluded.</p>
    <DetailLink href={`${analyticsHref("/analytics/leaderboards", scope)}${location === "all" ? "" : `&location=${location}`}`}>Full points rankings</DetailLink>
  </section>;
}

export function DashboardClient({ data, scope }: { data: InsightData; scope: DataScope }) {
  const summary = getSeasonSummary(data, { scope });
  const pairs = getPairingEvidence(data, { scope });
  const comparison = getHomeAwayComparisons(data, { scope });
  const quality = getDataQuality(data, { scope });
  const handicap = getHandicapInsights(data, { scope });
  const close = getCloseLossInsights(data, { scope });
  const selectionRef = useRef<HTMLDetailsElement>(null);
  const recorded = summary.fixtures.filter((fixture) => fixture.completed > 0)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  const latest = recorded.at(-1);
  const homeFixtures = recorded.filter((fixture) => fixture.homeAway === "home");
  const awayFixtures = recorded.filter((fixture) => fixture.homeAway === "away");
  const next = [...quality.futureFixtures].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)[0];
  const dueCount = summary.fixtures.filter((fixture) => !fixture.future).length;
  const href = (path: string) => analyticsHref(path, scope);
  const bothLocations = comparison.home.availablePoints > 0 && comparison.away.availablePoints > 0;
  const homeEdge = comparison.home.capturePct - comparison.away.capturePct;
  const signalTitle = bothLocations
    ? Math.abs(homeEdge) < 0.05 ? "An even points capture." : homeEdge > 0 ? "Better at home.\nRoom to grow away." : "A stronger away record."
    : comparison.home.availablePoints ? "Home evidence, so far."
      : comparison.away.availablePoints ? "Away evidence, so far."
        : summary.recordedFixtureCount ? "Neutral-ground evidence." : "The season starts with a scorecard.";
  const locationHeading = bothLocations
    ? Math.abs(homeEdge) < 0.05 ? "An even home and away capture." : homeEdge > 0 ? "A stronger home record." : "A stronger away record."
    : "Home and away, as recorded.";
  const scopeLabel = scope === "ndc" ? "NDC" : "All history";

  return (
    <div className="conveners-home captain-main">
      <header className="page-header">
        <div><div className="eyebrow">Team intelligence <span className="tiny-divider" /> {scopeLabel}
          {summary.dateRange ? ` · ${dateLabel(summary.dateRange.from, true)} – ${dateLabel(summary.dateRange.to, true)}` : " · No fixture coverage yet"}</div>
          <h1>Conveners desk</h1><p>Turn the scorecards into your next good decision.</p></div>
        <div className="header-actions">
          <Link className="button primary" href="/fixtures/import"><Plus aria-hidden="true" className="icon" />Record results</Link></div>
      </header>
      <p className="scope-note">{scope === "ndc" ? "NDC only · Internal fixtures excluded." : "All history · Includes internal fixtures and linked players on either side."} Completed results drive points; pending matches are excluded.</p>

      <section className="captain-summary" aria-label="Recorded season summary">
        <div className="captain-total">
          <div className="eyebrow inverse">{scopeLabel} / Recorded points</div>
          <div>{points(summary.teamPoints)}<span>/ {points(summary.availablePoints)}</span></div>
          <p>{summary.availablePoints ? `${summary.capturePct.toFixed(1)}% captured` : "No available points recorded"} across {summary.recordedFixtureCount} fixtures<br />
            <strong>{summary.recordedFixtureCount ? points(summary.pointsPerRecordedFixture) : "—"} pts / fixture</strong> · recorded field sizes vary</p>
        </div>
        <div className="captain-insight">
          <span className="summary-label"><ChartNoAxesCombined aria-hidden="true" className="icon" />The season signal</span>
          <h2>{signalTitle.split("\n").map((line, index) => <span key={line}>{index > 0 && <br />}{line}</span>)}</h2>
          <p>{(["home", "away"] as const).map((location) => <span key={location}>
            {location === "home" ? "Home" : "Away"}: {comparison[location].recordedFixtureCount
              ? `${points(comparison[location].pointsPerRecordedFixture)} pts per fixture (${comparison[location].recordedFixtureCount} recorded).`
              : "No completed results yet."}<br />
          </span>)}{bothLocations ? "Capture compares available points, not causes or selection quality." : "More location evidence is needed before comparing selections."}</p>
          <a className="button light" href="#selection-insights" onClick={() => { if (selectionRef.current) selectionRef.current.open = true; }}>
            Explore selection insights<ArrowRight aria-hidden="true" className="icon" /></a>
        </div>
        <div className="latest-result">
          <span className="eyebrow inverse">Latest result{latest ? ` / ${dateLabel(latest.date, true)}` : ""}</span>
          {latest ? <>
            <div className="latest-opponent">{latest.opponentClubName}<span>{latest.homeAway === "neutral" ? "Neutral venue" : `${latest.homeAway === "home" ? "Home" : "Away"} fixture`} · {latest.venueName}</span></div>
            <div className="latest-score">{points(latest.teamPoints)}<i>:</i>{points(latest.opponentPoints)}</div>
            <span className={`result-badge ${latest.provisional ? "provisional" : latest.result === "draw" ? "halved" : latest.result}`}>
              {latest.provisional ? "Provisional" : latest.result === "draw" ? "Drawn" : latest.result === "win" ? "Won" : "Lost"}</span>
            <DetailLink href={`/fixtures/${latest.id}`}>Open scorecard</DetailLink>
          </> : <><div className="latest-opponent">No completed result yet</div><DetailLink href="/fixtures">Review fixtures</DetailLink></>}
        </div>
      </section>
      {summary.provisionalFixtureCount > 0 && <p className="summary-notice">Points include {summary.provisionalFixtureCount} partial scorecard(s). These are provisional, not final fixture results; {summary.pendingMatchCount} pending match(es) are excluded.</p>}

      <div className="captain-workgrid">
        <div className="captain-primary">
          <section className="panel performance" aria-labelledby="season-points-title">
            <div className="panel-heading"><div><div className="eyebrow">The big picture</div>
              <h2 id="season-points-title">Points across the season</h2>
              <p className="section-description">Home or away. A 30-point allocation, with a two-point match cap; smaller fields offer fewer points.</p>
            </div></div>
            <FixturePointsChart fixtures={recorded} />
            {!recorded.length && <p className="empty-state">No completed results in this scope yet. Empty and pending fixtures remain in the correction queues below.</p>}
            {recorded.length > 0 && <div className="trend-notes">
              <div><span>Away, recently</span><strong>{awayFixtures.length ? awayFixtures.slice(-2).map((fixture) => points(fixture.teamPoints)).join(" & ") : "—"}{awayFixtures.length > 0 && " pts"}</strong>
                <p>{awayFixtures.length ? `Latest ${Math.min(2, awayFixtures.length)} of ${awayFixtures.length} recorded away fixtures.` : "No completed away results yet."}</p></div>
              <div><span>Home, first to latest</span><strong>{homeFixtures.length ? <>{points(homeFixtures[0].teamPoints)} <i>→</i> {points(homeFixtures.at(-1)!.teamPoints)} pts</> : "—"}</strong>
                <p>{homeFixtures.length ? `${homeFixtures.length} recorded home fixture${homeFixtures.length === 1 ? "" : "s"}; field sizes and opponents can differ.` : "No completed home results yet."}</p></div>
              <div><span>Field size matters</span><strong>{latest ? points(latest.weight) : "—"} <small>pts / win</small></strong>
                <p>Latest scorecard: {latest?.completed} completed matches{latest?.provisional ? `; ${latest.pending} pending, so provisional` : ""}. Not all fixtures have equal available points.</p></div>
            </div>}
            {recorded.length > 0 && <details className="method-note scorecard-details"><summary>Exact scores & scorecards</summary>
              <AnalyticsTable label="Recorded fixture points" headings={["Date / opponent", "Location", "Team", "Opponent", "Completed / pending", "State"]}>
                {[...recorded].reverse().map((fixture) => <TableRow key={fixture.id}>
                  <TableCell><Link href={`/fixtures/${fixture.id}`} className="underline underline-offset-4">{dateLabel(fixture.date, true)}<span className="block">{fixture.opponentClubName}</span></Link></TableCell>
                  <TableCell className="capitalize">{fixture.homeAway}</TableCell><TableCell>{points(fixture.teamPoints)}</TableCell><TableCell>{points(fixture.opponentPoints)}</TableCell>
                  <TableCell>{fixture.completed} / {fixture.pending}</TableCell>
                  <TableCell>{fixture.provisional ? "Provisional" : fixture.result === "draw" ? "Drawn" : fixture.result === "win" ? "Won" : "Lost"}</TableCell>
                </TableRow>)}
              </AnalyticsTable>
            </details>}
          </section>

          <section className="panel pairings" aria-labelledby="partnership-title">
            <div className="panel-heading"><div><div className="eyebrow">Chemistry, with evidence</div><h2 id="partnership-title">Partnerships worth revisiting</h2></div>
              <DetailLink href={href("/analytics/pairings")}>All pairings</DetailLink></div>
            <p className="section-description">Sample-adjusted yield, rather than a misleading perfect record after two games.</p>
            <div className="pairing-list">{pairs.pairs.length ? pairs.pairs.slice(0, 5).map((pair) => <div className="pairing-row" key={`${pair.player1Id}-${pair.player2Id}`}>
              <span className="pair-rating"><strong>{(pair.adjustedYield * 100).toFixed(0)}<span>%</span></strong><small>Adjusted</small></span>
              <div className="pair-players"><Link href={`/players/${pair.player1Id}`}>{pair.player1Name}</Link><span className="pair-plus">+</span><Link href={`/players/${pair.player2Id}`}>{pair.player2Name}</Link>
                <small>{pair.played} together / {pair.wins}W {pair.halved}H {pair.losses}L / {points(pair.pointsTogether)} pts</small></div>
              <span className="sample-badge">{pair.played} match{pair.played === 1 ? "" : "es"}<br />{pair.played < 3 ? "Early evidence" : "Sample still matters"}</span>
            </div>) : <p className="empty-state">No completed partnerships in this scope yet.</p>}</div>
            <div className="pair-coverage"><Users aria-hidden="true" className="icon" /><span><strong>{pairs.repeatedPairCount} of {pairs.uniquePairCount} partnerships</strong> have played together at least twice.
              {" "}{percent(pairs.repeatedMatchCoverage)} of completed matches feature a repeated pair.</span></div>
            <details className="method-note"><summary>How the adjusted yield works</summary>
              <p>100 × (wins + half of halves + {pairs.priorEquivalentMatches} × scoped team yield) / (appearances + {pairs.priorEquivalentMatches}).
                Team yield: {percent(pairs.teamYield)}. Descriptive sample adjustment, not the pairing engine&apos;s score or a prediction. Even repeated pairs are not proven.</p></details>
          </section>
        </div>

        <div className="captain-secondary">
          <PointsLeaders data={data} scope={scope} />
          <section className="panel home-away" aria-labelledby="home-away-title">
            <div className="eyebrow">Where we play</div><h2 id="home-away-title">{locationHeading}</h2>
            <p className="section-description">Points capture, not outright match win rate.</p>
            {(["home", "away"] as const).map((location) => {
              const record = comparison[location];
              return <div className={`venue-stat ${location}`} key={location}>
                <div><span><MapPin aria-hidden="true" className="icon" />{location === "home" ? "Home" : "Away"} <small>{record.recordedFixtureCount ? points(record.pointsPerRecordedFixture) : "—"} pts / fixture</small></span>
                  <strong>{record.availablePoints ? record.capturePct.toFixed(1) : "—"}{record.availablePoints > 0 && <small>%</small>}</strong></div>
                <div className="track" role="meter" aria-label={`${location} points capture`} aria-valuemin={0} aria-valuemax={100}
                  aria-valuenow={record.capturePct} aria-valuetext={record.availablePoints ? `${record.capturePct.toFixed(1)}%` : "No available points"}>
                  <span style={{ width: `${record.capturePct}%` }} /></div>
                <p>{points(record.teamPoints)} / {points(record.availablePoints)} pts <span>{record.recordedFixtureCount} fixtures · {record.matchRecord.total} matches</span></p>
                {record.provisionalFixtureCount > 0 && <p className="subtle-note">{record.provisionalFixtureCount} provisional scorecard(s) included.</p>}
              </div>;
            })}
            <div className="insight-note"><ChartNoAxesCombined aria-hidden="true" className="icon" /><span>
              {summary.teamPoints > 0
                ? <>Home fixtures supplied <strong>{(comparison.home.teamPoints / summary.teamPoints * 100).toFixed(0)}% of scoped points</strong> from {comparison.home.recordedFixtureCount} of {summary.recordedFixtureCount} recorded fixtures. </>
                : "No team points have been recorded in this scope. "}
              Different fields, opponents and selections limit comparisons. Neutral fixtures are excluded from these two records.</span></div>
            <DetailLink href={href("/analytics/home-away")}>Explore home & away performance</DetailLink>
          </section>
        </div>
      </div>

      <details className="selection-insights" id="selection-insights" ref={selectionRef}>
        <summary><span><span className="eyebrow">Go one level deeper</span><strong>Selection and match-up insights</strong>
          <small>{comparison.players.length} home/away comparisons / {handicap.completeCount} complete handicap records / {close.closeLossCount} close losses</small></span>
          <span className="expand-insights">Explore <Plus aria-hidden="true" className="icon" /></span></summary>
        <div className="selection-grid">
          <section className="panel"><div className="eyebrow">Choose with the venue in mind</div><h2>Player home & away evidence</h2>
            <p className="section-description">At least two completed appearances at each location. Yield counts halves as half a win; this is not points capture.</p>
            <AnalyticsTable label="Player home and away evidence" headings={["Player", "Home yield / sample", "Away yield / sample"]}
              empty={!comparison.players.length ? "No players meet both appearance minimums yet." : undefined}>
              {comparison.players.slice(0, 5).map((player) => <TableRow key={player.playerId}><TableCell><Link href={`/players/${player.playerId}`}>{player.name}</Link></TableCell>
                <TableCell>{percent(player.home.yield)} / {player.home.played}</TableCell><TableCell>{percent(player.away.yield)} / {player.away.played}</TableCell></TableRow>)}
            </AnalyticsTable><DetailLink href={href("/analytics/home-away")}>All player comparisons</DetailLink>
          </section>
          <div>
            <section className="panel"><div className="eyebrow">Recorded match-up context</div><h2>Handicap evidence</h2>
              <p>{handicap.completeCount} / {handicap.completedCount} completed matches have all four historical indices. {handicap.excludedCount} excluded from handicap analysis only.</p>
              <p className="subtle-note">Mean combined index gap: {handicap.meanDifference === null ? "—" : handicap.meanDifference.toFixed(2)}. Unknown is never zero; current indices do not fill history.</p>
              <DetailLink href={href("/analytics/handicaps")}>Gap buckets & coverage</DetailLink></section>
            <section className="panel"><div className="eyebrow">A practice conversation</div><h2>Small margins, meaningful points</h2>
              <p>{close.closeLossCount} / {close.lossCount} losses recorded as 1UP, 2UP or 2&amp;1; {close.oneUpLossCount} were 1UP.</p>
              <p>Turning recorded 1UP losses into halves, holding all else fixed, would add <strong>{points(close.hypotheticalExtraPoints)} team points</strong>.</p>
              <p className="subtle-note">Hypothetical only, not a forecast or a claim about the final hole. {close.excludedMarginCount} unknown or unrecognized loss margins excluded.</p>
              <DetailLink href={href("/analytics")}>Scenario details & scorecards</DetailLink></section>
          </div>
        </div>
      </details>

      <section className="match-planning"><div><span className="eyebrow">When the next fixture is ready</span><h2>Take the insights into your lineup.</h2>
        <p>{next ? <>Next recorded fixture: <time dateTime={next.date}>{dateLabel(next.date, true)}</time> · {next.opponentClubName} · {next.homeAway} · {next.venueName}. <Link href={`/fixtures/${next.id}`}>Open fixture</Link></>
          : "No upcoming fixture is recorded in this scope. No availability or submission deadlines have been assumed."}</p></div>
        <div><DetailLink href={href("/analytics/suggest")} className="button planning-button">Home lineup</DetailLink>
          <DetailLink href={href("/analytics/counter")} className="button planning-button">Away counter-pairing</DetailLink>
          <DetailLink href="/fixtures/new">Schedule a fixture</DetailLink></div>
      </section>
      <details className="selection-insights">
        <summary><span><span className="eyebrow">Better inputs, sharper decisions</span><strong>Results coverage & correction queues</strong>
          <small>{dueCount ? `${summary.resultsCoveragePct.toFixed(1)}%` : "No fixtures due"} with at least one result · {quality.pastFixturesWithoutResults.length} past fixtures without completed results · {quality.provisionalFixtures.length} partial scorecards</small></span>
          <span className="expand-insights">Review <Plus aria-hidden="true" className="icon" /></span></summary>
        <div className="panel">
          <p>{summary.fixtureRecord.wins} won / {summary.fixtureRecord.draws} drawn / {summary.fixtureRecord.losses} lost final fixtures.
            {" "}{summary.matchRecord.wins}W / {summary.matchRecord.halved}H / {summary.matchRecord.losses}L completed paired matches.
            {" "}Roster participation: {summary.rosterParticipantCount} / {summary.rosterCount} roster players have a completed scoped appearance, not an active-status measure.</p>
          <p className="subtle-note">Coverage counts due fixtures with any completed result, not complete scorecards. {quality.incompleteHandicaps.length} incomplete handicap rows.
            {" "}{quality.internalPendingMatches.length} internal pending rows are tracked separately from NDC. Queues overlap; do not add them into one issue count.</p>
          {quality.pastFixturesWithoutResults.slice(0, 2).map((fixture) => <p key={fixture.id}><Link href={`/fixtures/${fixture.id}`}>{dateLabel(fixture.date, true)} · {fixture.opponentClubName} · no completed results</Link></p>)}
          {quality.incompleteHandicaps.slice(0, 1).map((match) => <p key={match.id}><Link href={matchCorrectionHref(match)}>Review indices: {match.player1Name} / {match.player2Name}</Link></p>)}
          <DetailLink href={href("/analytics/data-quality")}>All correction queues</DetailLink>
        </div>
      </details>
      <footer className="page-footer"><span>Conveners desk · {scopeLabel} · Recorded results only</span><DetailLink href={href("/analytics")}>Explore all analytics</DetailLink></footer>
    </div>
  );
}
