"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PlayerForm, PlayerStatusForm } from "@/components/player-form";
import { PageHeader } from "@/components/page-header";
import { Label } from "@/components/ui/label";
import { PlusIcon, PencilIcon, EyeIcon, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { FormMatch, PlayerStats } from "@/lib/analytics";
import type { DataScope } from "@/lib/insights";
import { useReportView } from "@/components/reports/report-provider";

interface Player {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  defaultHandicap: number;
  active: boolean;
  createdAt: string;
  stats: PlayerStats;
  form: FormMatch[];
}

interface PlayersListClientProps {
  scope?: DataScope;
  players: Player[];
  recordedFixtures: number;
  historyAvailable: boolean;
  createPlayer: (formData: FormData) => Promise<void>;
  updatePlayer: (formData: FormData) => Promise<void>;
  togglePlayerActive: (formData: FormData) => Promise<void>;
}

type PlayerSort = "name" | "handicap" | "appearances" | "record" | "yield";
type SortDirection = "asc" | "desc";

export function compareRosterPlayers(a: Player, b: Player, sortBy: PlayerSort, direction: SortDirection) {
  if (sortBy === "yield" || sortBy === "record") {
    const missing = Number(a.stats.played === 0) - Number(b.stats.played === 0);
    if (missing) return missing;
  }
  const difference = sortBy === "handicap"
    ? a.defaultHandicap - b.defaultHandicap
    : sortBy === "appearances"
      ? a.stats.played - b.stats.played
      : sortBy === "record"
        ? a.stats.wins - b.stats.wins || a.stats.halved - b.stats.halved || b.stats.losses - a.stats.losses
        : sortBy === "yield"
          ? a.stats.winRate - b.stats.winRate
          : a.name.localeCompare(b.name);
  return difference * (direction === "asc" ? 1 : -1) || a.name.localeCompare(b.name) || a.id - b.id;
}

export function PlayersListClient({
  scope = "ndc",
  players,
  recordedFixtures,
  historyAvailable,
  createPlayer,
  updatePlayer,
  togglePlayerActive,
}: PlayersListClientProps) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<PlayerSort>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  useReportView({filters:{search,sort:sortBy,direction:sortDirection,status},ready:historyAvailable});
  const activePlayers = players.filter((player) => player.active);
  const handicaps = activePlayers.map((player) => player.defaultHandicap).sort((a, b) => a - b);
  const middle = Math.floor(handicaps.length / 2);
  const median = handicaps.length ? (handicaps.length % 2 ? handicaps[middle] : (handicaps[middle - 1] + handicaps[middle]) / 2) : null;

  const filtered = players
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) && (status === "all" || p.active === (status === "active")))
    .sort((a, b) => compareRosterPlayers(a, b, sortBy, sortDirection));

  function changeSort(value: PlayerSort) {
    if (sortBy === value) {
      setSortDirection((direction) => direction === "asc" ? "desc" : "asc");
    } else {
      setSortBy(value);
      setSortDirection(value === "name" || value === "handicap" ? "asc" : "desc");
    }
  }

  function sortIcon(value: PlayerSort) {
    const Icon = sortBy !== value ? ArrowUpDown : sortDirection === "asc" ? ArrowUp : ArrowDown;
    return <Icon className="size-3.5" />;
  }

  async function handleCreate(formData: FormData) {
    await createPlayer(formData);
    setAddDialogOpen(false);
  }

  async function handleUpdate(formData: FormData) {
    if (editingPlayer) {
      formData.append("id", editingPlayer.id.toString());
      await updatePlayer(formData);
      setEditingPlayer(null);
    }
  }

  return (
    <div className="page-shell screen-desk">
      <PageHeader title="The people behind the points." eyebrow="The people / Squad"
        description="A considered view of your players, their form and their recorded matches."
        actions={
        <Dialog
          open={addDialogOpen}
          onOpenChange={(open) => setAddDialogOpen(open)}
        >
          <DialogTrigger render={<Button />}>
            <PlusIcon />
            Add Player
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Player</DialogTitle>
              <DialogDescription>
                Enter the player&apos;s details below.
              </DialogDescription>
            </DialogHeader>
            <PlayerForm onSubmit={handleCreate} submitLabel="Add Player" />
          </DialogContent>
        </Dialog>}
      />

      <div className="desk-stats">
        {[
          ["Squad members", players.length, `${activePlayers.length} active players`],
          ["Players fielded", historyAvailable ? players.filter((player) => player.stats.played > 0).length : "—", `Completed matches · ${scope === "ndc" ? "NDC only" : "includes internal"}`],
          ["Median handicap", median === null ? "—" : median.toFixed(1), "Active roster only"],
          ["Recorded fixtures", historyAvailable ? recordedFixtures : "—", "With at least one completed match"],
        ].map(([label, value, detail]) => <div className="desk-stat" key={label}>
          <p className="desk-stat-label">{label}</p><p className="desk-stat-value">{value}</p><p className="desk-stat-detail">{detail}</p>
        </div>)}
      </div>
      {!historyAvailable && <p role="alert" className="desk-note desk-note-amber">Match history could not be loaded. Roster details are available; reload to retry performance statistics.</p>}

      <section className="desk-panel">
      <div className="desk-panel-header">
        <div>
        <h2 className="font-semibold">Squad roster</h2>
        <p className="text-sm text-muted-foreground">Result yield is wins plus half of halved matches, divided by completed appearances. Select a column heading to sort; select it again to reverse.</p>
        </div>
      </div>
      <div className="desk-toolbar">
        <div className="min-w-0 flex-1 space-y-1.5 sm:max-w-sm">
        <Label htmlFor="squad-search">Find a player</Label>
        <Input
          id="squad-search"
          placeholder="Search players..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full"
        />
        </div>
        <div className="scope-controls self-end" role="group" aria-label="Filter squad status">
          {(["active", "inactive", "all"] as const).map((value) => <Button key={value} size="sm" variant={status === value ? "default" : "outline"} aria-pressed={status === value} onClick={() => setStatus(value)} className="capitalize">{value}</Button>)}
        </div>
        <div className="scope-controls self-end" role="group" aria-label="Sort squad">
          <Button
            variant={sortBy === "name" ? "default" : "outline"}
            size="sm"
            onClick={() => changeSort("name")}
            aria-pressed={sortBy === "name"}
          >
            {sortIcon("name")}
            Name
          </Button>
          <Button
            variant={sortBy === "handicap" ? "default" : "outline"}
            size="sm"
            onClick={() => changeSort("handicap")}
            aria-pressed={sortBy === "handicap"}
          >
            {sortIcon("handicap")}
            Handicap
          </Button>
        </div>
        <span role="status" className="text-sm text-muted-foreground">
          {filtered.length} player{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead aria-sort={sortBy === "name" || sortBy === "handicap" ? sortDirection === "asc" ? "ascending" : "descending" : "none"}>Player / index</TableHead>
              {([
                ["appearances", "Appearances"],
                ["record", "Record"],
                ["yield", "Result yield"],
              ] as const).map(([value, label]) => (
                <TableHead key={value} aria-sort={sortBy === value ? sortDirection === "asc" ? "ascending" : "descending" : "none"}>
                  <Button variant="ghost" size="sm" onClick={() => changeSort(value)} disabled={!historyAvailable}
                    title={value === "record" ? "Sort by wins, then halves, then fewer losses" : undefined}>
                    {label}{sortIcon(value)}
                  </Button>
                </TableHead>
              ))}
              <TableHead>Recent form</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground py-8"
                >
                  {search || status !== "all"
                    ? "No players match these filters."
                    : "No players yet. Add one to get started."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((player) => (
                <TableRow key={player.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3"><span className="desk-avatar" aria-hidden="true">{player.name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("")}</span><div><Link
                      href={`/players/${player.id}`}
                      className="hover:underline"
                    >
                      {player.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">Handicap {player.defaultHandicap.toFixed(1)}</p></div></div>
                  </TableCell>
                  <TableCell>{historyAvailable ? player.stats.played : "—"}</TableCell>
                  <TableCell>{historyAvailable ? `${player.stats.wins}W · ${player.stats.halved}H · ${player.stats.losses}L` : "—"}</TableCell>
                  <TableCell>{historyAvailable && player.stats.played ? `${(player.stats.winRate * 100).toFixed(0)}%` : "—"}</TableCell>
                  <TableCell><div className="flex gap-1" aria-label="Recent form, oldest to newest">{historyAvailable && player.form.length ? player.form.map((match) => <span key={match.id} className="desk-status" data-tone={match.result === "win" ? "home" : match.result === "loss" ? "danger" : "neutral"} title={`${match.fixtureDate}: ${match.result}`}>{match.result === "win" ? "W" : match.result === "loss" ? "L" : "H"}</span>) : <span className="text-muted-foreground">—</span>}</div></TableCell>
                  <TableCell>
                    <PlayerStatusForm id={player.id} active={player.active} action={togglePlayerActive} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" aria-label={`View ${player.name}`} render={<Link href={`/players/${player.id}`} />}>
                          <EyeIcon />
                        </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setEditingPlayer(player)}
                        aria-label={`Edit ${player.name}`}
                      >
                        <PencilIcon />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      <div className="desk-panel-footer">Recent form runs oldest to newest. Active status controls lineup selection, not fixture availability. Historical handicaps stay on the original scorecards.</div>
      </section>

      {/* Edit Player Dialog */}
      <Dialog
        open={editingPlayer !== null}
        onOpenChange={(open) => {
          if (!open) setEditingPlayer(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Player</DialogTitle>
            <DialogDescription>
              Update {editingPlayer?.name}&apos;s details.
            </DialogDescription>
          </DialogHeader>
          {editingPlayer && (
            <PlayerForm
              defaultValues={editingPlayer}
              onSubmit={handleUpdate}
              submitLabel="Update Player"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
