"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { PlayerForm, PlayerStatusForm } from "@/components/player-form";
import { PageHeader } from "@/components/page-header";
import { ArrowLeftIcon, PencilIcon, MailIcon, PhoneIcon } from "lucide-react";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { PlayerHandicapChart, type HandicapHistoryPoint } from "@/components/player-handicap-chart";
import type { PlayerStats, FormMatch, VenueRecord } from "@/lib/analytics";
import type { DataScope } from "@/lib/insights";
import { useReportView } from "@/components/reports/report-provider";
import type { ReportConfig } from "@/lib/reports/contracts";

interface Player {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  defaultHandicap: number;
  active: boolean;
  createdAt: string;
}

type MatchHistoryEntry = {
  id: number;
  fixtureId: number;
  fixtureDate: string;
  venueName: string;
  opponentClubName: string;
  partnerId: number;
  partnerName: string;
  playerHandicap: number | null;
  partnerHandicap: number | null;
  opponent1Name: string;
  opponent2Name: string;
  opponent1Handicap: number | null;
  opponent2Handicap: number | null;
  result: "win" | "loss" | "halved" | "pending";
  margin: string | null;
};

interface PlayerDetailClientProps {
  scope?: DataScope;
  player: Player;
  stats: PlayerStats;
  form: FormMatch[];
  venueStats: VenueRecord[];
  handicapTrend: HandicapHistoryPoint[];
  handicapTrendExcluded: number;
  matchHistory: MatchHistoryEntry[];
  homeAwayStats: { location: "home" | "away" | "neutral"; played: number; yield: number }[];
  historyAvailable: boolean;
  updatePlayer: (formData: FormData) => Promise<void>;
  togglePlayerActive: (formData: FormData) => Promise<void>;
}

function ResultBadge({ result }: { result: MatchHistoryEntry["result"] }) {
  return <span className="desk-status capitalize" data-tone={result === "win" ? "home" : result === "loss" ? "danger" : "neutral"}>{result}</span>;
}
function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function PanelHeader({ title, description }: { title: string; description?: string }) {
  return <div className="desk-panel-header"><div><h2 className="font-semibold">{title}</h2>{description && <p className="text-sm text-muted-foreground">{description}</p>}</div></div>;
}
function PartnerLink({ id, name }: { id: number; name: string }) {
  return id > 0 ? <Link href={`/players/${id}`} className="text-primary hover:underline">{name}</Link> : <span>{name}</span>;
}
function MatchTable({ matches, player }: { matches: MatchHistoryEntry[]; player: Player }) {
  return <Table>
    <TableHeader><TableRow><TableHead>Fixture</TableHead><TableHead>Pairing / handicaps</TableHead><TableHead>Opponents / handicaps</TableHead><TableHead>Result</TableHead></TableRow></TableHeader>
    <TableBody>{matches.length ? matches.map((match) => <TableRow key={match.id}>
      <TableCell><Link href={`/fixtures/${match.fixtureId}`} className="font-medium hover:underline">{match.opponentClubName}</Link><span className="block text-xs text-muted-foreground">{formatDate(match.fixtureDate)} · {match.venueName}</span></TableCell>
      <TableCell><span className="font-medium">{player.name}</span> <span className="text-xs text-muted-foreground">({match.playerHandicap ?? "—"})</span><br /><PartnerLink id={match.partnerId} name={match.partnerName} /> <span className="text-xs text-muted-foreground">({match.partnerHandicap ?? "—"})</span></TableCell>
      <TableCell>{match.opponent1Name} <span className="text-xs text-muted-foreground">({match.opponent1Handicap ?? "—"})</span><br />{match.opponent2Name} <span className="text-xs text-muted-foreground">({match.opponent2Handicap ?? "—"})</span></TableCell>
      <TableCell><ResultBadge result={match.result} />{match.margin && <span className="ml-1.5 text-xs text-muted-foreground">{match.margin}</span>}</TableCell>
    </TableRow>) : <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">No matches recorded yet.</TableCell></TableRow>}</TableBody>
  </Table>;
}

export function PlayerDetailClient({
  scope = "ndc",
  player, stats, form, venueStats, handicapTrend, handicapTrendExcluded, matchHistory,
  homeAwayStats, historyAvailable, updatePlayer, togglePlayerActive,
}: PlayerDetailClientProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [profileTab,setProfileTab] = useState<ReportConfig["profileTab"]>("overview");
  useReportView({filters:{profileTab},ready:historyAvailable});
  const recentMatches = [...form].reverse().flatMap((match) => {
    const history = matchHistory.find((entry) => entry.id === match.id);
    return history ? [history] : [];
  });
  const latest = matchHistory.find((match) => match.result !== "pending");
  const chartData = homeAwayStats.filter((record) => record.played > 0).map((record) => ({
    ...record, label: record.location[0].toUpperCase() + record.location.slice(1), resultYield: record.yield * 100,
  }));
  async function handleUpdate(data: FormData) {
    data.append("id", String(player.id));
    await updatePlayer(data);
    setEditDialogOpen(false);
  }

  return <div className="page-shell screen-desk">
    <header className="flex flex-wrap items-center gap-4 border-b pb-6">
      <span className="desk-avatar !size-16 !text-xl" aria-hidden="true">{player.name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("")}</span>
      <div className="min-w-0 flex-1"><PageHeader title={player.name} eyebrow="The squad / Player profile" description={`Handicap ${player.defaultHandicap.toFixed(1)} · ${player.active ? "Active" : "Inactive"} squad · ${scope === "ndc" ? "NDC only" : "Includes internal matches"}`} /></div>
      <div className="flex flex-wrap items-center gap-2"><Button variant="outline" onClick={() => setEditDialogOpen(true)}><PencilIcon />Edit player</Button><Button variant="outline" render={<Link href="/players" />}><ArrowLeftIcon />The squad</Button></div>
    </header>
    {!historyAvailable && <p role="alert" className="desk-note desk-note-amber">Match history could not be loaded. Player details are available; reload to retry performance statistics.</p>}

    <Tabs value={profileTab} onValueChange={value=>setProfileTab(value as ReportConfig["profileTab"])}>
      <TabsList variant="line" className="max-w-full flex-wrap">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="history">Match history</TabsTrigger>
        <TabsTrigger value="partners">Pairings</TabsTrigger>
        <TabsTrigger value="handicaps">Handicap history</TabsTrigger>
        <TabsTrigger value="venues">Venues</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="space-y-5">
        <div className="desk-stats">
          {[
            ["Appearances", historyAvailable ? stats.played : "—", "Completed matches · both sides"],
            ["Result yield", historyAvailable && stats.played ? `${(stats.winRate * 100).toFixed(1)}%` : "—", "Wins + half of halved / played"],
            ["Recorded wins", historyAvailable ? stats.wins : "—", historyAvailable ? `${stats.halved} halved · ${stats.losses} losses` : "Match history unavailable"],
            ["Handicap index", player.defaultHandicap.toFixed(1), "Current player default"],
          ].map(([label, value, detail]) => <div className="desk-stat" key={label}><p className="desk-stat-label">{label}</p><p className="desk-stat-value">{value}</p><p className="desk-stat-detail">{detail}</p></div>)}
        </div>
        <div className="desk-two-column">
          <section className="desk-panel">
            <PanelHeader title="Home ground, away days." description="Recorded result yield by fixture location, not an outcome prediction." />
            {chartData.length ? <div className="h-60" role="img" aria-label={chartData.map((record) => `${record.label}: ${record.resultYield.toFixed(1)}% yield from ${record.played} appearances`).join(". ")}>
              <ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 16, right: 12, bottom: 4, left: 0 }}><CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="label" fontSize={12} /><YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} fontSize={11} /><Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, "Result yield"]} /><Bar dataKey="resultYield" maxBarSize={75} radius={[3, 3, 0, 0]}>{chartData.map((record) => <Cell key={record.location} fill={record.location === "home" ? "#3e7055" : record.location === "away" ? "#805719" : "#7c8079"} />)}</Bar></BarChart></ResponsiveContainer>
            </div> : <p className="py-16 text-center text-sm text-muted-foreground">{historyAvailable ? "Complete a match to see location performance." : "Match statistics are unavailable."}</p>}
            <div className="desk-note">{homeAwayStats.map((record) => `${record.location}: ${record.played}`).join(" · ")} completed appearances. Home/away follows the recorded fixture, including opponent-side appearances. A small sample tells only part of the story; partner selection and opposition also matter.</div>
          </section>
          <aside className="desk-panel">
            <PanelHeader title="Player notebook" description="Recorded details, without assumptions." />
            <dl className="space-y-4 text-sm">
              <div className="flex items-center justify-between gap-3 border-b pb-3"><dt className="text-muted-foreground">Squad status</dt><dd><PlayerStatusForm id={player.id} active={player.active} action={togglePlayerActive} /></dd></div>
              <div className="border-b pb-3"><dt className="text-muted-foreground">Last completed appearance</dt><dd className="mt-1 font-medium">{latest ? <Link className="hover:underline" href={`/fixtures/${latest.fixtureId}`}>{formatDate(latest.fixtureDate)} · {latest.venueName}</Link> : historyAvailable ? "No completed appearances" : "Unavailable"}</dd></div>
              <div><dt className="text-muted-foreground">Contact details</dt><dd className="mt-2 space-y-2">
                {player.email && <div className="flex items-center gap-2"><MailIcon className="size-4 shrink-0" /><span className="min-w-0 [overflow-wrap:anywhere]">{player.email}</span></div>}
                {player.phone && <div className="flex items-center gap-2"><PhoneIcon className="size-4 shrink-0" />{player.phone}</div>}
                {!player.email && !player.phone && <span>No contact information provided.</span>}
              </dd></div>
            </dl>
            <div className="mt-6 flex flex-wrap gap-1">{form.length ? form.map((match) => <span key={match.id} className="desk-status" data-tone={match.result === "win" ? "home" : match.result === "loss" ? "danger" : "neutral"} title={`${formatDate(match.fixtureDate)}: ${match.result}`}>{match.result === "win" ? "W" : match.result === "loss" ? "L" : "H"}</span>) : <span className="text-sm text-muted-foreground">No recent form recorded.</span>}</div>
            <div className="desk-panel-footer">Oldest → newest · W win / H halved / L loss. Active status is not a record of fixture availability.</div>
          </aside>
        </div>
        <section className="desk-panel"><PanelHeader title="Recent form" description={`Last ${form.length} completed appearances, newest first. Historical unknown handicaps remain blank (—).`} /><MatchTable matches={recentMatches} player={player} /></section>
      </TabsContent>

      <TabsContent value="history"><section className="desk-panel"><PanelHeader title="A record, match by match." description={`${matchHistory.length} matches in the selected scope, newest first, including pending results.${scope === "all" ? " Internal fixtures included." : " Internal fixtures excluded."}`} /><MatchTable matches={matchHistory} player={player} /><div className="desk-panel-footer">Handicaps belong to their original scorecards. An unknown historical handicap is shown as —, never replaced with the current default.</div></section></TabsContent>

      <TabsContent value="partners" className="space-y-5">
        <section className="desk-panel"><PanelHeader title="Partnerships" description="Completed appearances with linked squad partners. Yield includes half of halved matches." />
          <Table><TableHeader><TableRow><TableHead>Partner</TableHead><TableHead>Played</TableHead><TableHead>W / H / L</TableHead><TableHead>Result yield</TableHead></TableRow></TableHeader><TableBody>{stats.partners.length ? stats.partners.map((partner) => <TableRow key={partner.partnerId}><TableCell><PartnerLink id={partner.partnerId} name={partner.partnerName} /></TableCell><TableCell>{partner.played}</TableCell><TableCell>{partner.wins} / {partner.halved} / {partner.played - partner.wins - partner.halved}</TableCell><TableCell>{(partner.winRate * 100).toFixed(1)}%</TableCell></TableRow>) : <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">No completed matches with linked squad partners.</TableCell></TableRow>}</TableBody></Table>
        </section>
        <section className="desk-panel"><PanelHeader title="Pairings and opponent matchups" description="The complete pairing record, including partners who are not linked to the squad." /><MatchTable matches={matchHistory} player={player} /></section>
      </TabsContent>

      <TabsContent value="handicaps"><section className="desk-panel">
        <PanelHeader title="The handicap journey." description="Historical scorecard snapshots, not a connected handicap service." />
        {handicapTrend.length > 1 && <PlayerHandicapChart points={handicapTrend} />}
        <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Recorded handicap</TableHead><TableHead>Result</TableHead></TableRow></TableHeader><TableBody>{handicapTrend.length ? handicapTrend.map((point, index) => <TableRow key={`${point.date}-${index}`}><TableCell>{formatDate(point.date)}</TableCell><TableCell>{point.handicap.toFixed(1)}</TableCell><TableCell><ResultBadge result={point.result} /></TableCell></TableRow>) : <TableRow><TableCell colSpan={3} className="py-10 text-center text-muted-foreground">No completed matches with a known player handicap.</TableCell></TableRow>}</TableBody></Table>
        <div className="desk-panel-footer">Current default: {player.defaultHandicap.toFixed(1)}. Excludes {handicapTrendExcluded} completed match{handicapTrendExcluded === 1 ? "" : "es"} with an unknown player handicap, and all pending results. Chart dots: green win, red loss, amber halved.</div>
      </section></TabsContent>

      <TabsContent value="venues"><section className="desk-panel"><PanelHeader title="Venue performance" description="Completed-match records at each recorded venue, including both-side appearances." />
        <Table><TableHeader><TableRow><TableHead>Venue</TableHead><TableHead>Played</TableHead><TableHead>W</TableHead><TableHead>H</TableHead><TableHead>L</TableHead><TableHead>Result yield</TableHead></TableRow></TableHeader><TableBody>{venueStats.length ? venueStats.map((venue) => <TableRow key={venue.venueName}><TableCell className="font-medium">{venue.venueName}</TableCell><TableCell>{venue.played}</TableCell><TableCell>{venue.wins}</TableCell><TableCell>{venue.halved}</TableCell><TableCell>{venue.losses}</TableCell><TableCell>{(venue.winRate * 100).toFixed(1)}%</TableCell></TableRow>) : <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No completed venue records available.</TableCell></TableRow>}</TableBody></Table>
      </section></TabsContent>
    </Tabs>
    <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}><DialogContent><DialogHeader><DialogTitle>Edit player</DialogTitle><DialogDescription>Update {player.name}&apos;s details. Historical scorecards are unchanged.</DialogDescription></DialogHeader><PlayerForm defaultValues={player} onSubmit={handleUpdate} submitLabel="Save changes" /></DialogContent></Dialog>
  </div>;
}
