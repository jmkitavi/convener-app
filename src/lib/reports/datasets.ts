import {
  effectiveResult, getPlayerStats, getPlayerForm, getPlayerHandicapTrend, getPlayerVenueStats,
  getVenueStats, isPlayerInMatch, isOnOpponentSide, type MatchWithDetails,
} from "@/lib/analytics";
import {
  getSeasonSummary, getPairingEvidence, getContributionLeaders, getHomeAwayComparisons,
  getHandicapInsights, getCloseLossInsights, getDataQuality, selectInsightData, type DataScope,
} from "@/lib/insights";
import { reportCatalog, reportConfigSchema, type Cell, type Column, type ReportChart, type ReportConfig,
  type ReportSection, type ReportSnapshot, type ReportSource, type ReportTable, type SectionId } from "./contracts";
import type { PairingSuggestion, CounterPairingResult } from "@/lib/pairing-engine";
import { readAnalyticsFilters } from "@/components/analytics-navigation";
import { fixtureLocationColors, handicapResultColors } from "@/lib/chart-colors";

const colors = ["#296e66", "#d59c48", "#223f50", "#b13d3d"];
const title = (id: SectionId) => reportCatalog.find(([key]) => key === id)![1];
const table = (id: string, title: string, labels: string[], rows: Cell[][], percentages: number[] = []): ReportTable => ({
  id, title, columns: labels.map((label, index): Column => ({ label, type: percentages.includes(index) ? "percent" : label === "Date" ? "date" : undefined })), rows,
});
const chart = (id: string, title: string, labels: string[], values: (number | null)[], name: string, percent = false, kind: "bar" | "line" = "bar"): ReportChart =>
  ({ id, title, kind, labels, series: [{ name, values, color: colors[0] }], percent, notes: [] });
function matchRows(matches: MatchWithDetails[], playerId?: number): Cell[][] {
  return [...matches].sort((a,b) => b.fixtureDate.localeCompare(a.fixtureDate) || (a.matchOrder ?? a.id) - (b.matchOrder ?? b.id)).map(match => {
    const opposite = playerId !== undefined && isOnOpponentSide(match, playerId);
    return [match.id, match.fixtureDate, match.venueName, match.matchOrder,
      opposite ? match.opponent1PlayerName ?? match.opponent1Name : match.player1Name,
      opposite ? match.opponent2PlayerName ?? match.opponent2Name : match.player2Name,
      opposite ? match.opponent1Handicap : match.player1Handicap, opposite ? match.opponent2Handicap : match.player2Handicap,
      opposite ? match.player1Name : match.opponent1Name, opposite ? match.player2Name : match.opponent2Name,
      opposite ? match.player1Handicap : match.opponent1Handicap, opposite ? match.player2Handicap : match.opponent2Handicap,
      playerId === undefined ? match.result : effectiveResult(match, playerId), match.margin, match.fixtureId];
  });
}
const matchLabels = ["Match ID", "Date", "Venue", "Order", "Partner 1", "Partner 2", "HI 1", "HI 2", "Opponent 1", "Opponent 2", "Opponent HI 1", "Opponent HI 2", "Result", "Margin", "Fixture ID"];

export function buildReport(source: ReportSource, scope: DataScope, input: unknown, generatedAt = new Date().toISOString()): ReportSnapshot {
  const config = reportConfigSchema.parse(input);
  for (const id of config.playerIds) if (!source.players.some(player => player.id === id)) throw new Error("A selected player no longer exists.");
  for (const id of config.fixtureIds) if (!source.fixtures.some(fixture => fixture.id === id)) throw new Error("A selected fixture no longer exists.");
  const inventory = source.fixtures.filter(fixture => (!config.from || fixture.date >= config.from) && (!config.to || fixture.date <= config.to)
    && (!config.fixtureIds.length || config.fixtureIds.includes(fixture.id)));
  const inventoryIds = new Set(inventory.map(fixture => fixture.id));
  const data = { ...source, fixtures: inventory, matches: source.matches.filter(match => inventoryIds.has(match.fixtureId)) };
  const scoped = selectInsightData(data, { scope, location: config.location });
  const playerMatches = scoped.matches.filter(match => !config.playerIds.length || config.playerIds.some(id => isPlayerInMatch(match,id)));
  const snapshot: ReportSnapshot = {
    title: config.title, generatedAt, scope, showCharts: config.charts, showTables: config.tables,
    filters: [
      scope === "ndc" ? "NDC only - internal fixtures excluded" : "All (internal) - internal fixtures included",
      `Fixture dates: ${config.from ?? "first recorded"} to ${config.to ?? "latest recorded"} (inclusive)`,
      `Location: ${config.location}; minimum appearances: ${config.minimum} (partnerships, leaders and home/away comparisons)`,
      ...(config.playerIds.length ? [`Players: ${source.players.filter(player => config.playerIds.includes(player.id)).map(player => player.name).join(", ")}`] : []),
      ...(config.fixtureIds.length ? [`Fixture IDs: ${config.fixtureIds.join(", ")}`] : []),
      ...(config.search ? [`Search: ${config.search}`] : []),
      ...(config.status !== "all" ? [`Roster status: ${config.status}`] : []),
      `Sort: ${config.sort} (${config.direction}); profile tab: ${config.profileTab}; quality queue: ${config.queue}`,
      "Completed results drive performance. Pending matches are excluded; partial scorecards remain provisional. Unknown handicaps are blank, not zero.",
      "Player selection filters player evidence, not the team fixture denominator. Player credits must not be added as extra team points.",
    ], sections: [],
  };
  for (const id of config.sections) {
    if (id.startsWith("lineup-")) continue;
    const section: ReportSection = { id, title: title(id), tables: [], charts: [], notes: [] };
    const options = { scope, location: config.location };
    if (id === "season" || id === "fixtures") {
      const summary = getSeasonSummary(data, options);
      section.notes.push("Team totals include every selected fixture; player selections do not narrow team totals.");
      if (id === "season") section.tables.push(table("season-summary", "Season totals",
        ["Team points", "Available points", "Capture", "Recorded fixtures", "Provisional fixtures", "Pending matches"],
        [[summary.teamPoints, summary.availablePoints, summary.availablePoints ? summary.capturePct/100 : null, summary.recordedFixtureCount, summary.provisionalFixtureCount, summary.pendingMatchCount]], [2]));
      if (id === "season") section.tables.push(table("season-coverage", "Season records and coverage",
        ["Total fixtures","Match wins","Match halves","Match losses","Fixture wins","Fixture draws","Fixture losses","Points / recorded fixture","Roster players","Roster fielded","Due fixture results coverage"],
        [[summary.fixtureCount,summary.matchRecord.wins,summary.matchRecord.halved,summary.matchRecord.losses,summary.fixtureRecord.wins,summary.fixtureRecord.draws,summary.fixtureRecord.losses,summary.recordedFixtureCount?summary.pointsPerRecordedFixture:null,summary.rosterCount,summary.rosterParticipantCount,summary.resultsCoveragePct/100]],[10]));
      section.tables.push(table(`${id}-fixtures`, "Fixture points", ["Fixture ID","Date","Opponent","Venue","Location","Team","Opponent team","Completed","Pending","Team points","Opponent points","Available","State"],
        summary.fixtures.filter(f => !config.search || `${f.opponentClubName} ${f.venueName}`.toLowerCase().includes(config.search.toLowerCase())).map(f => {
          const names = source.fixtures.find(entry => entry.id === f.id);
          return [f.id,f.date,f.opponentClubName,f.venueName,f.homeAway,names?.teamName ?? null,names?.opponentTeamName ?? null,f.completed,f.pending,f.completed ? f.teamPoints : null,f.completed ? f.opponentPoints : null,f.completed ? f.availablePoints : null,f.provisional ? "Provisional" : f.result ?? "No results"];
        })));
      const fixtures = summary.fixtures.filter(f => f.completed > 0).sort((a,b)=>a.date.localeCompare(b.date)||a.id-b.id);
      section.charts.push({ id: `${id}-points`, title: "Points across the season", kind:"bar", labels: fixtures.map(f => `${f.date} ${f.opponentClubName}${f.provisional ? " (P)" : ""}`),
        series: [{name:"Team points",color:fixtureLocationColors.home,values:fixtures.map(f=>f.teamPoints),
          pointColors:fixtures.map(f=>fixtureLocationColors[f.homeAway]),pointLabels:fixtures.map(f=>f.provisional||!f.result?"P":f.result==="win"?"W":f.result==="draw"?"D":"L")}],
        legend: Object.entries(fixtureLocationColors).map(([name,color])=>({name,color})),
        fixturePoints: fixtures,
        domain: [0,30], referenceLines:[{name:"Full-field even split",value:15,color:"#b5a886"}],
        ...(config.referenceTargets?{targets:{name:"Reference target (not a prediction)",color:"#9c6a28",values:fixtures.map(f=>f.homeAway==="home"?22:f.homeAway==="away"?16:null)}}:{}),
        notes: ["Team points; P = provisional. The full-field even split is 15 points; smaller fields offer fewer points.",
          ...(config.referenceTargets ? ["Reference targets (not predictions): home 22 points; away 16 points."] : [])] });
    } else if (id === "squad") {
      const players = source.players.filter(player => (!config.playerIds.length || config.playerIds.includes(player.id))
        && (config.status==="all" || player.active === (config.status==="active")) && player.name.toLowerCase().includes(config.search.toLowerCase()))
        .map(player => ({...player, stats:getPlayerStats(scoped.matches,player.id)}));
      players.sort((a,b) => {
        if (config.sort==="record"||config.sort==="yield") { const missing=Number(!a.stats.played)-Number(!b.stats.played); if(missing)return missing; }
        const d=config.sort==="handicap"?a.defaultHandicap-b.defaultHandicap:config.sort==="appearances"?a.stats.played-b.stats.played:
          config.sort==="record"?a.stats.wins-b.stats.wins||a.stats.halved-b.stats.halved||b.stats.losses-a.stats.losses:
          config.sort==="yield"?a.stats.winRate-b.stats.winRate:a.name.localeCompare(b.name);
        return d*(config.direction==="asc"?1:-1)||a.name.localeCompare(b.name)||a.id-b.id;
      });
      section.tables.push(table("squad", "Squad performance", ["Player ID","Player","Current handicap","Status","Appearances","Wins","Halves","Losses","Result yield","Recent form"],
        players.map(p => [p.id,p.name,p.defaultHandicap,p.active?"Active":"Inactive",p.stats.played,p.stats.wins,p.stats.halved,p.stats.losses,p.stats.played?p.stats.winRate:null,getPlayerForm(scoped.matches,p.id,5).map(m=>m.result).join(" / ")]),[8]));
      section.charts.push(chart("squad-appearances","Completed appearances",players.map(p=>p.name),players.map(p=>p.stats.played),"Appearances"));
    } else if (id === "player") {
      const players = source.players.filter(player => config.playerIds.includes(player.id));
      if (!players.length) section.notes.push("Select one or more players to include their performance and history.");
      for (const player of players) {
        const stats=getPlayerStats(scoped.matches,player.id);
        section.tables.push(table(`player-${player.id}`,`${player.name} - performance`,["Player","Appearances","Wins","Halves","Losses","Result yield","Current handicap"],
          [[player.name,stats.played,stats.wins,stats.halved,stats.losses,stats.played?stats.winRate:null,player.defaultHandicap]],[5]));
        if (config.profileTab==="overview"||config.profileTab==="history") section.tables.push(table(`history-${player.id}`,`${player.name} - match history`,matchLabels,matchRows(scoped.matches.filter(m=>isPlayerInMatch(m,player.id)),player.id)));
        if(config.profileTab==="overview"||config.profileTab==="partners") section.tables.push(table(`partners-${player.id}`,`${player.name} - partners`,["Partner","Played","Wins","Halves","Yield"],stats.partners.map(p=>[p.partnerName,p.played,p.wins,p.halved,p.winRate]),[4]));
        const trend=getPlayerHandicapTrend(scoped.matches,player.id);
        if(config.profileTab==="overview"||config.profileTab==="handicaps") {
          section.tables.push(table(`handicaps-${player.id}`,`${player.name} - handicap history`,["Date","Handicap","Result"],trend.map(p=>[p.date,p.handicap,p.result])));
          const trendChart=chart(`trend-${player.id}`,`${player.name} - handicap history`,trend.map(p=>p.date),trend.map(p=>p.handicap),"Recorded handicap",false,"line");
          trendChart.handicapHistory=trend;
          trendChart.series[0].pointColors=trend.map(p=>handicapResultColors[p.result]);
          trendChart.legend=Object.entries(handicapResultColors).map(([name,color])=>({name,color}));
          if(trend.length)trendChart.domain=[Math.min(...trend.map(p=>p.handicap))-1,Math.max(...trend.map(p=>p.handicap))+1];
          trendChart.notes.push("Historical scorecard snapshots, not a connected handicap service. Dots: green win, red loss, amber halved.");
          section.charts.push(trendChart);
          section.notes.push(`${player.name}: ${stats.played-trend.length} completed appearances excluded from handicap trend because their recorded handicap is unknown.`);
        }
        if(config.profileTab==="overview"||config.profileTab==="venues") {
          const venues=getPlayerVenueStats(scoped.matches,player.id);
          section.tables.push(table(`venues-${player.id}`,`${player.name} - venues`,["Venue","Played","Wins","Halves","Losses","Yield"],venues.map(v=>[v.venueName,v.played,v.wins,v.halved,v.losses,v.winRate]),[5]));
          section.charts.push(chart(`venues-${player.id}`,`${player.name} - venue yield`,venues.map(v=>v.venueName),venues.map(v=>v.winRate),"Result yield",true));
        }
      }
    } else if (id==="pairings") {
      const evidence=getPairingEvidence(data,options);
      const pairs=evidence.pairs.filter(p=>p.played>=config.minimum && (!config.playerIds.length||config.playerIds.includes(p.player1Id)||config.playerIds.includes(p.player2Id)));
      section.tables.push(table("pairings","Partnership evidence",["Player 1","Player 2","Played","Wins","Halves","Losses","Points together","Raw yield","Adjusted yield"],
        pairs.map(p=>[p.player1Name,p.player2Name,p.played,p.wins,p.halved,p.losses,p.pointsTogether,p.rawYield,p.adjustedYield]),[7,8]));
      section.charts.push(chart("pairing-yield","Partnership adjusted yield",pairs.map(p=>`${p.player1Name} / ${p.player2Name}`),pairs.map(p=>p.adjustedYield),"Adjusted yield",true));
      section.notes.push("Adjusted yield uses a three-match prior at the scoped team result yield. It is descriptive, not a prediction.");
    } else if(id==="leaderboards") {
      const leaders=getContributionLeaders(data,{...options,minAppearances:config.minimum}).filter(p=>!config.playerIds.length||config.playerIds.includes(p.playerId));
      section.tables.push(table("leaders","Contribution rankings",["Player","Played","Wins","Halves","Losses","Total points","Points / appearance","Result yield"],
        leaders.map(p=>[p.name,p.played,p.wins,p.halved,p.losses,p.points,p.pointsPerAppearance,p.yield]),[7]));
      section.charts.push(chart("leaders","Player contribution points",leaders.map(p=>p.name),leaders.map(p=>p.points),"Pair credit points"));
    } else if(id==="home-away") {
      const comparison=getHomeAwayComparisons(data,{scope,minAppearances:config.minimum,sort:config.sort==="home-edge"?"home-edge":"away"});
      section.tables.push(table("locations","Home and away team capture",["Location","Team points","Available","Capture","Recorded fixtures","Provisional","Points / recorded fixture","Match wins","Match halves","Match losses","Fixture wins","Fixture draws","Fixture losses"],(["home","away"] as const).map(location=>{
        const s=comparison[location];return [location,s.teamPoints,s.availablePoints,s.availablePoints?s.capturePct/100:null,s.recordedFixtureCount,s.provisionalFixtureCount,s.recordedFixtureCount?s.pointsPerRecordedFixture:null,s.matchRecord.wins,s.matchRecord.halved,s.matchRecord.losses,s.fixtureRecord.wins,s.fixtureRecord.draws,s.fixtureRecord.losses];
      }),[3]));
      const players=comparison.players.filter(p=>!config.playerIds.length||config.playerIds.includes(p.playerId));
      section.tables.push(table("comparison","Player location comparison",["Player","Home appearances","Home wins","Home halves","Home losses","Home yield","Away appearances","Away wins","Away halves","Away losses","Away yield","Home edge"],players.map(p=>[p.name,p.home.played,p.home.wins,p.home.halved,p.home.losses,p.home.yield,p.away.played,p.away.wins,p.away.halved,p.away.losses,p.away.yield,p.homeEdge]),[5,10,11]));
      section.charts.push(chart("location-capture","Home vs away points capture",["Home","Away"],[comparison.home,comparison.away].map(s=>s.availablePoints?s.capturePct/100:null),"Points capture",true));
      section.notes.push("This comparison always includes both home and away, regardless of the location filter. Team capture uses the complete scoped fixture, not just selected players. Neutral fixtures do not enter this comparison.");
    } else if(id==="venues") {
      const venues=getVenueStats(playerMatches);
      section.tables.push(table("venues","Recorded venue results",["Venue","Played","Wins","Halves","Losses","Result yield"],venues.map(v=>[v.venueName,v.played,v.wins,v.halved,v.losses,v.winRate]),[5]));
      section.charts.push({id:"venues",title:"Results by venue",kind:"bar",labels:venues.map(v=>v.venueName),series:["wins","halved","losses"].map((key,i)=>({name:key,color:colors[i],values:venues.map(v=>v[key as "wins"|"halved"|"losses"])})),notes:["Completed matches only."]});
      section.notes.push("Venue records use the tracked team's perspective, including internal fixtures. Use individual player profiles for opponent-side results.");
    } else if(id==="handicaps") {
      const handicap=getHandicapInsights({...data,matches:playerMatches},options);
      section.tables.push(table("handicap-coverage","Historical index coverage",["Completed","Complete","Excluded","Mean team combined","Mean opponent combined","Mean gap"],[[handicap.completedCount,handicap.completeCount,handicap.excludedCount,handicap.meanTeamCombined,handicap.meanOpponentCombined,handicap.meanDifference]]));
      section.tables.push(table("buckets","Index gap records",["Gap","Played","Wins","Halves","Losses","Result yield"],handicap.buckets.map(b=>[b.label,b.played,b.wins,b.halved,b.losses,b.played?b.winRate:null]),[5]));
      section.charts.push(chart("handicap-yield","Result yield by index gap",handicap.buckets.map(b=>b.label),handicap.buckets.map(b=>b.played?b.winRate:null),"Result yield",true));
      section.charts.push({id:"handicap-samples",title:"Index gap sample sizes",kind:"bar",labels:handicap.buckets.map(b=>b.label),series:["wins","halved","losses"].map((key,i)=>({name:key,color:colors[i],values:handicap.buckets.map(b=>b[key as "wins"|"halved"|"losses"])})),notes:[]});
      section.notes.push(`${handicap.excludedCount} of ${handicap.completedCount} completed matches excluded from index analysis because at least one handicap is unknown.`);
      section.notes.push("Index gaps use the tracked team's perspective, even when selected players appeared on the internal opponent side.");
    } else if(id==="scorecard") {
      section.tables.push(table("scorecards","Ordered match scorecards",matchLabels,matchRows(playerMatches)));
      const selectedFixtures=new Set(playerMatches.map(match=>match.fixtureId));
      const fixtures=getSeasonSummary(data,options).fixtures.filter(fixture=>!config.playerIds.length||selectedFixtures.has(fixture.id));
      section.tables.push(table("scorecard-fixtures","Fixture details",["Fixture ID","Date","Team","Opponent team","Opponent club","Venue","Location","Completed","Pending","Team points","Opponent points","State"],
        fixtures.map(fixture=>{
          const names=source.fixtures.find(entry=>entry.id===fixture.id);
          return [fixture.id,fixture.date,names?.teamName??null,names?.opponentTeamName??null,fixture.opponentClubName,fixture.venueName,fixture.homeAway,fixture.completed,fixture.pending,fixture.completed?fixture.teamPoints:null,fixture.completed?fixture.opponentPoints:null,fixture.provisional?"Provisional":fixture.result??"No results"];
        })));
      section.notes.push("Match results are from the tracked team's perspective. Player-specific perspective is available in Player performance.");
    } else if(id==="close-losses") {
      const close=getCloseLossInsights(data,options);
      section.tables.push(table("close-summary","Close-loss context",["Losses","Close losses","One-up losses","Unknown/unrecognized margins","Hypothetical extra team points"],[[close.lossCount,close.closeLossCount,close.oneUpLossCount,close.excludedMarginCount,close.hypotheticalExtraPoints]]));
      section.tables.push(table("close-matches","Close-loss scorecards",matchLabels,matchRows(close.closeLosses)));
      section.notes.push("Scenario only: turn every recorded 1UP loss into a half, holding the fixture field and other results fixed. Not a forecast; 1UP does not establish a last-hole finish. This team-level scenario ignores player selections.");
    } else if(id==="quality") {
      const quality=getDataQuality(data,options);
      const selectedMatch=(match:MatchWithDetails)=>!config.playerIds.length||config.playerIds.some(id=>isPlayerInMatch(match,id));
      if(config.queue==="all"||config.queue==="handicaps") section.tables.push(table("missing-handicaps","Missing historical handicaps",matchLabels,matchRows(quality.incompleteHandicaps.filter(selectedMatch))));
      if(config.queue==="all"||config.queue==="results") {
        section.tables.push(table("pending","Pending results",matchLabels,matchRows(quality.pendingMatches.filter(selectedMatch))));
        section.tables.push(table("unrecorded","Due fixtures without completed results",["Fixture ID","Date","Opponent","Pending"],quality.pastFixturesWithoutResults.map(f=>[f.id,f.date,f.opponentClubName,f.pending])));
        section.tables.push(table("provisional","Partial scorecards",["Fixture ID","Date","Opponent","Completed","Pending"],quality.provisionalFixtures.map(f=>[f.id,f.date,f.opponentClubName,f.completed,f.pending])));
      }
      if(config.queue==="all"||config.queue==="roster") section.tables.push(table("unfielded","Roster without scoped appearances",["Player","Active"],quality.rosterWithoutAppearances.filter(p=>!config.playerIds.length||config.playerIds.includes(p.id)).map(p=>[p.name,p.active])));
      section.notes.push("Queues overlap; do not sum them into a unique issue count.");
    } else if(id==="clubs") {
      section.tables.push(table("clubs","Club course records",["Club","Par","Slope","Course rating","Scoped fixtures"],source.clubs.filter(c=>c.name.toLowerCase().includes(config.search.toLowerCase())).map(c=>[c.name,c.par,c.slopeRating,c.courseRating,scoped.fixtures.filter(f=>f.opponentClubId===c.id).length])));
      section.notes.push("Course details are recorded values, not calculated playing handicaps. Club directory remains complete; fixture counts follow report scope.");
    }
    if (section.tables.every(t=>!t.rows.length)) section.notes.push("No matching records in this selection.");
    snapshot.sections.push(section);
  }
  const total=snapshot.sections.reduce((sum,s)=>sum+s.tables.reduce((n,t)=>n+t.rows.length,0),0);
  if(total>20000) throw new Error("This report exceeds 20,000 rows. Narrow the date range or selected sections.");
  return snapshot;
}

export function recommendationSection(home: PairingSuggestion[] | null, away: CounterPairingResult | null, venue?: string): ReportSection {
  if(home) return {id:"lineup-home",title:title("lineup-home"),notes:[`Venue: ${venue??"Any venue"}. Ranked options, not a complete lineup; players may repeat. Scores are relative ratings, not predicted probabilities.`],charts:[],tables:[
    table("home-recommendations","Generated pair options",["Rank","Player 1","HI 1","Player 2","HI 2","Score / 100","Together","Result yield","Historical component","Confidence","Handicap fit","Venue affinity","Recent form","Reasoning"],home.map((p,i)=>[i+1,p.player1.name,p.player1.handicap,p.player2.name,p.player2.handicap,p.score*100,p.matchesPlayed,p.matchesPlayed?p.winRate:null,p.breakdown.historicalWinRate,p.breakdown.sampleConfidence,p.breakdown.handicapCompatibility,p.breakdown.venueAffinity,p.breakdown.recentForm,p.reasoning.join(" ") ]),[7]),
  ]};
  if(!away) throw new Error("Generate recommendations before exporting this section.");
  return {id:"lineup-away",title:title("lineup-away"),notes:[`Venue: ${venue??"Any venue"}. Matchups are recommendations, not guaranteed outcomes. 90% strokes rounded down, capped at 4 (red) or 8 (regular).`],charts:[],tables:[
    table("away-recommendations","Generated counter matchups",["Match","Player 1","HI 1","Player 2","HI 2","Opponent 1","HI","Opponent 2","HI","Red","Tier","Score / 100","Our strokes","Opponent strokes","Net strokes","Effective spread","Reasoning"],
      away.matchups.map(m=>[m.matchNumber,m.ourPlayer1.name,m.ourPlayer1.handicap,m.ourPlayer2.name,m.ourPlayer2.handicap,m.opponent.opp1Name,m.opponent.opp1Handicap,m.opponent.opp2Name,m.opponent.opp2Handicap,m.opponent.isRedMatch,m.tier,m.score*100,m.strokeAnalysis.ourTotalStrokes,m.strokeAnalysis.oppTotalStrokes,m.strokeAnalysis.netAdvantage,m.effectiveSpread,m.reasoning.join(" ")])),
    table("reserves","Unpaired players / reserves",["Player","Handicap"],away.unpairedPlayers.map(p=>[p.name,p.handicap])),
    table("strategy-summary","Lineup summary",["Net strokes","Average competitiveness","Target","Target half","Competitive","Concede"],[[away.totalNetStrokes,away.avgCompetitiveness,away.tierSummary.target,away.tierSummary.target_half,away.tierSummary.competitive,away.tierSummary.concede]]),
  ]};
}

export function configForPath(path: string, query: URLSearchParams): ReportConfig | null {
  const map: Record<string,SectionId[]> = {"/":["season","close-losses"],"/analytics":["season","pairings","home-away","leaderboards","venues","handicaps","quality"],
    "/players":["squad"],"/fixtures":["fixtures"],"/clubs":["clubs"]};
  const detail=path.match(/^\/(players|fixtures)\/(\d+)$/);
  const destination=reportCatalog.find(([id])=>path===`/analytics/${id}`)?.[0];
  const aliases:Record<string,SectionId>={"/analytics/data-quality":"quality","/analytics/suggest":"lineup-home","/analytics/counter":"lineup-away"};
  const sections=detail?[detail[1]==="players"?"player":"scorecard"] as SectionId[]:map[path]??(destination?[destination]:aliases[path]?[aliases[path]]:null);
  if(!sections)return null;
  const defaultMinimum=path==="/analytics/leaderboards"?3:path==="/analytics/home-away"?2:1;
  const {minAppearances:minimum,sort}=readAnalyticsFilters(Object.fromEntries(query),defaultMinimum);
  const requestedQueue=query.get("queue")??"all";
  return reportConfigSchema.parse({
    sections, title: sections.length===1?title(sections[0]):"Conveners desk report",
    playerIds:detail?.[1]==="players"?[Number(detail[2])]:[],fixtureIds:detail?.[1]==="fixtures"?[Number(detail[2])]:[],
    location:["home","away"].includes(query.get("location")??"")?query.get("location"):"all",
    minimum,
    sort:path==="/analytics/home-away"?sort:(query.get("sort")??"name").slice(0,40),queue:["all","results","handicaps","roster"].includes(requestedQueue)?requestedQueue:"all",
  });
}
