"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { calcFixturePoints } from "@/lib/analytics";
import { fixtureStatus } from "./fixture-status";
import { useReportView } from "@/components/reports/report-provider";

export type ScheduleFixture = {
  id: number;
  date: string;
  homeAway: string;
  notes: string | null;
  teamName: string | null;
  opponentTeamName: string | null;
  clubName: string | null;
  venueName: string | null;
  total: number;
  wins: number;
  losses: number;
  halved: number;
  pending: number;
};

const statuses = [
  ["all", "All"], ["scheduled", "Scheduled"], ["recorded", "Recorded"],
  ["partial", "Partial"], ["noresults", "No results"],
] as const;
const statusLabels = { scheduled: "Scheduled", recorded: "Results recorded", partial: "Partial results", noresults: "No results" };

export function FixtureSchedule({ fixtures, today }: { fixtures: ScheduleFixture[]; today: string }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const filtered = fixtures.filter((fixture) =>
    (status === "all" || fixtureStatus(fixture, today) === status) &&
    [fixture.clubName, fixture.opponentTeamName, fixture.teamName, fixture.venueName, fixture.notes].join(" ").toLowerCase().includes(query.trim().toLowerCase()),
  );
  useReportView({filters:{fixtureIds:filtered.map(fixture=>fixture.id)},ready:filtered.length>0});

  return <section className="desk-panel overflow-hidden">
    <div className="desk-panel-header"><div><h2 className="font-semibold">Fixture schedule</h2><p className="text-sm text-muted-foreground">Home or away. One consistent record of every fixture.</p></div></div>
    <div className="desk-toolbar">
      <label className="min-w-0 flex-1"><span className="sr-only">Search opponent or venue</span><Input type="search" placeholder="Search opponent or venue…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Filter fixtures by result status">
        {statuses.map(([value, label]) => <Button key={value} size="sm" variant={status === value ? "default" : "ghost"} aria-pressed={status === value} onClick={() => setStatus(value)}>{label}</Button>)}
      </div>
    </div>
    <Table>
      <caption className="sr-only">Fixture schedule with recorded results and provisional points</caption>
      <TableHeader><TableRow><TableHead>Opponent</TableHead><TableHead>Date / venue</TableHead><TableHead>Match record</TableHead><TableHead>Points</TableHead><TableHead>Status</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader>
      <TableBody>{filtered.length === 0 ? <TableRow><TableCell colSpan={6} className="py-12 text-center text-muted-foreground">{fixtures.length ? "No fixtures match these filters." : "No fixtures yet. Create your first fixture to get started."}</TableCell></TableRow> : filtered.map((fixture) => {
        const completed = fixture.wins + fixture.losses + fixture.halved;
        const state = fixtureStatus(fixture, today);
        const { teamPoints, maxPoints } = calcFixturePoints(completed, fixture.wins, fixture.halved);
        const opponent = fixture.opponentTeamName ?? fixture.clubName ?? "Unknown club";
        const accent = state === "recorded" ? "border-l-emerald-500" : state === "partial" ? "border-l-amber-500" : "border-l-slate-300";
        return <TableRow key={fixture.id} data-fixture-id={fixture.id} className={`border-l-4 ${accent}`}>
          <TableCell><Link href={`/fixtures/${fixture.id}`} className="flex items-center gap-3 font-medium hover:underline"><span className="desk-avatar" aria-hidden="true">{opponent.split(/\s+/).slice(0, 2).map((part) => part[0]).join("")}</span><span>{opponent}{fixture.teamName && <span className="block text-xs font-normal text-muted-foreground">vs {fixture.teamName}</span>}</span></Link></TableCell>
          <TableCell><span>{new Date(`${fixture.date}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span><span className="mt-1 block text-xs text-muted-foreground">{fixture.venueName ?? "Unknown venue"}</span><span className="desk-status mt-1" data-tone={fixture.homeAway}>{fixture.homeAway}</span></TableCell>
          <TableCell><span className="numeric">{completed > 0 ? `${fixture.wins}W-${fixture.losses}L-${fixture.halved}H` : "—"}</span>{fixture.pending > 0 && <span className="mt-1 block text-xs text-amber-800">{completed}/{fixture.total} results recorded ({fixture.pending} pending)</span>}</TableCell>
          <TableCell>{completed > 0 ? <><strong className="numeric">{teamPoints.toFixed(2)}</strong><span className="block text-xs text-muted-foreground">/ {maxPoints.toFixed(2)} pts{fixture.pending > 0 ? " · provisional" : ""}</span></> : <span aria-label="No completed results">—</span>}</TableCell>
          <TableCell><span className="desk-status" data-tone={state === "recorded" ? "home" : state === "partial" ? "away" : "neutral"}>{statusLabels[state]}</span></TableCell>
          <TableCell><Button size="sm" variant="outline" render={<Link href={`/fixtures/${fixture.id}`} />}>View<span className="sr-only"> {opponent}</span></Button></TableCell>
        </TableRow>;
      })}</TableBody>
    </Table>
    <div className="desk-panel-footer text-xs text-muted-foreground" aria-live="polite">Showing {filtered.length} of {fixtures.length} fixtures · Points use completed results only. Pending matches are excluded.</div>
  </section>;
}
