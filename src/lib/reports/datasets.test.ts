import assert from "node:assert/strict";
import test from "node:test";
import { getSeasonSummary, getContributionLeaders } from "@/lib/insights";
import { buildReport, configForPath, recommendationSection } from "./datasets";
import { reportCatalog, reportConfigSchema, type ReportSource } from "./contracts";
import { suggestPairings } from "@/lib/pairing-engine";

const source: ReportSource = {
  players: [{id:1,name:"Alpha",active:true,defaultHandicap:0},{id:2,name:"Beta",active:false,defaultHandicap:18},
    {id:3,name:"Gamma",active:true,defaultHandicap:10},{id:4,name:"Unused",active:true,defaultHandicap:24}],
  clubs:[{id:7,name:"Visitors",par:null,slopeRating:0,courseRating:71},{id:15,name:"Kenya Air Force Golf Club",par:72,slopeRating:120,courseRating:72}],
  fixtures:[
    {id:1,date:"2026-01-01",homeAway:"home",opponentClubId:7,opponentClubName:"Visitors",venueName:"Actual venue",teamName:"Tracked team",opponentTeamName:"Visitors side"},
    {id:2,date:"2026-02-01",homeAway:"away",opponentClubId:15,opponentClubName:"Kenya Air Force Golf Club",venueName:"Internal venue"},
  ],
  matches:[],
};
source.matches=[{
  id:1,fixtureId:1,fixtureDate:"2026-01-01",homeAway:"home",opponentClubId:7,opponentClubName:"Visitors",venueName:"Actual venue",
  player1Id:1,player2Id:2,player1Name:"Alpha",player2Name:"Beta",player1Handicap:0,player2Handicap:null,
  opponent1Name:"Away A",opponent2Name:"Away B",opponent1Handicap:12,opponent2Handicap:8,opponent1Id:null,opponent2Id:null,
  opponent1PlayerName:null,opponent2PlayerName:null,result:"win",margin:"1UP",matchOrder:1,notes:"PRIVATE DO NOT EXPORT",
}];
source.matches.push({...source.matches[0],id:2,result:"pending",matchOrder:2});
source.matches.push({...source.matches[0],id:3,fixtureId:2,fixtureDate:"2026-02-01",homeAway:"away",
  opponentClubId:15,opponentClubName:"Kenya Air Force Golf Club",venueName:"Internal venue",opponent1Id:3,opponent1PlayerName:"Gamma",result:"loss"});

test("reports retain canonical scope, pending/provisional, internal-side and null/zero semantics",()=>{
  const report=buildReport(source,"ndc",{sections:["season","scorecard","player"],playerIds:[1]});
  const summary=report.sections[0].tables[0].rows[0];
  const expected=getSeasonSummary(source,{scope:"ndc"});
  assert.deepEqual(summary,[expected.teamPoints,expected.availablePoints,expected.capturePct/100,1,1,1]);
  const matches=report.sections[1].tables[0].rows;
  assert.equal(matches.length,2);
  assert.equal(matches[0][6],0);
  assert.equal(matches[0][7],null);
  assert.equal(matches[1][12],"pending");
  assert.ok(report.sections[0].tables.find(t=>t.id==="season-fixtures")!.rows.some(row=>row.includes("Provisional")));
  const internal=buildReport(source,"all",{sections:["player"],playerIds:[3]});
  const player=internal.sections[0].tables[0].rows[0];
  assert.equal(player[2],1,"Opponent-side internal result is a win");
  const history=internal.sections[0].tables.find(t=>t.id==="history-3")!;
  assert.equal(history.rows[0][12],"win");
  assert.doesNotMatch(JSON.stringify(report),/PRIVATE DO NOT EXPORT|email|phone|sourceHash/);
});

test("player selection never reweights fixture denominators, and dates/locations filter before ranking",()=>{
  const large={...source,matches:Array.from({length:22},(_,index)=>({...source.matches[0],id:index+1,player1Id:index===0?1:3}))};
  const report=buildReport(large,"ndc",{sections:["leaderboards","season"],playerIds:[1]});
  assert.equal(report.sections[0].tables[0].rows.length,1);
  assert.equal(report.sections[0].tables[0].rows[0][5],getContributionLeaders(large,{scope:"ndc",minAppearances:1}).find(p=>p.playerId===1)!.points);
  assert.equal(report.sections[1].tables[0].rows[0][0],30);
  const filtered=buildReport(source,"all",{sections:["scorecard"],from:"2026-02-01",to:"2026-02-01",location:"away"});
  assert.deepEqual(filtered.sections[0].tables[0].rows.map(row=>row.at(-1)),[2]);
  assert.throws(()=>buildReport(source,"all",{sections:["season"],from:"2026-02-02",to:"2026-01-01"}),/Start date/);
  assert.throws(()=>buildReport(source,"ndc",{sections:["player"],playerIds:[999]}),/no longer exists/);
});

test("roster sorting, selected profile tabs, complete rows and section order survive exports",()=>{
  const config={sections:["clubs","squad","player"],sort:"appearances",direction:"desc",status:"active",search:"a",playerIds:[1],profileTab:"handicaps"};
  const report=buildReport(source,"all",config);
  assert.deepEqual(report.sections.map(section=>section.id),config.sections);
  assert.equal(report.sections[1].tables[0].rows.length,1);
  assert.equal(report.sections[1].tables[0].rows[0][1],"Alpha");
  assert.ok(report.sections[2].tables.some(t=>t.id==="handicaps-1"));
  assert.ok(!report.sections[2].tables.some(t=>t.id==="history-1"));
  const club=buildReport(source,"ndc",{sections:["clubs"]}).sections[0].tables[0].rows[0];
  assert.deepEqual(club.slice(1,4),[null,0,71]);
  const pairs=buildReport(source,"all",{sections:["pairings"],minimum:2});
  assert.ok(pairs.sections[0].tables[0].rows.every(row=>Number(row[2])>=2));
  const charts=buildReport(source,"all",{sections:["season"],location:"away",referenceTargets:true}).sections[0].charts[0];
  assert.equal(charts.labels.length,1);
  assert.ok(charts.notes.some(note=>note.includes("home 22")));
});

test("every supported historical section builds without contacts or fabricated empty statistics",()=>{
  const sections=reportCatalog.map(([id])=>id).filter(id=>!id.startsWith("lineup-"));
  const report=buildReport(source,"all",{sections,playerIds:[1]});
  assert.equal(report.sections.length,sections.length);
  const empty=buildReport({...source,matches:[],fixtures:[]},"ndc",{sections:["season","handicaps","player"],playerIds:[1]});
  assert.equal(empty.sections[0].tables[0].rows[0][2],null);
  assert.equal(empty.sections[0].charts[0].labels.length,0);
  assert.equal(empty.sections[1].tables[0].rows[0][3],null);
  const home=suggestPairings(source.players.slice(0,2).map(p=>({id:p.id,name:p.name,handicap:p.defaultHandicap})),source.matches);
  const recommendation=recommendationSection(home,null,"Actual venue");
  assert.equal(recommendation.tables[0].rows[0][5],home[0].score*100);
  assert.throws(()=>recommendationSection(null,null),/Generate/);
});

test("current-page configuration validates inputs without taking scope from stale URLs",()=>{
  const profile=configForPath("/players/3",new URLSearchParams("scope=all"))!;
  assert.deepEqual(profile.playerIds,[3]);
  assert.equal("scope" in profile,false);
  assert.equal(configForPath("/fixtures/new",new URLSearchParams()),null);
  assert.equal(configForPath("/analytics/leaderboards",new URLSearchParams())!.minimum,3);
  assert.equal(configForPath("/analytics/leaderboards",new URLSearchParams("min=0.1&queue=invalid"))!.minimum,3);
  assert.equal(configForPath("/analytics/home-away",new URLSearchParams("min=99999&sort=invalid"))!.sort,"away");
  assert.throws(()=>reportConfigSchema.parse({sections:["season","season"]}));
  assert.throws(()=>reportConfigSchema.parse({sections:["season"],from:"2026-02-30"}));
});

test("handicap and season reports retain source-chart history, bounds and result/location markers",()=>{
  const data:ReportSource={...source,
    fixtures:source.fixtures.map(fixture=>({...fixture,opponentClubId:7,opponentClubName:"Visitors"})),
    matches:[
      {...source.matches[0],player1Handicap:8.4,result:"loss"},
      {...source.matches[2],opponentClubId:7,opponentClubName:"Visitors",player1Handicap:7.6,result:"win"},
    ],
  };
  const report=buildReport(data,"ndc",{sections:["player","season"],playerIds:[1],profileTab:"handicaps"});
  const trend=report.sections[0].charts[0];
  assert.deepEqual(trend.handicapHistory?.map(p=>[p.date,p.handicap,p.result]),[
    ["2026-01-01",8.4,"loss"],["2026-02-01",7.6,"win"],
  ]);
  assert.deepEqual(trend.series[0].values,[8.4,7.6]);
  assert.deepEqual(trend.series[0].pointColors,["#b13d3d","#3e7055"]);
  assert.deepEqual(trend.domain,[6.6,9.4]);
  assert.deepEqual(report.sections[0].tables.find(t=>t.id==="handicaps-1")!.rows,trend.handicapHistory!.map(p=>[p.date,p.handicap,p.result]));
  const season=report.sections[1].charts[0];
  assert.deepEqual(season.fixturePoints?.map(f=>f.id),[1,2]);
  assert.deepEqual(season.series[0].values,season.fixturePoints?.map(f=>f.teamPoints));
  assert.deepEqual(season.series[0].pointColors,["#3f7058","#d59c48"]);
  assert.deepEqual(season.series[0].pointLabels,["L","W"]);
  assert.deepEqual(season.domain,[0,30]);
});
