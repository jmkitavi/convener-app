"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Shield,
  Check,
  Plus,
  Trash2,
  AlertTriangle,
  Save,
  FolderOpen,
  BarChart3,
} from "lucide-react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Collapsible } from "@/components/collapsible";
import {
  suggestCounterPairings,
  type AvailablePlayer,
  type OpponentPair,
  type CounterPairingResult,
  type MatchTier,
} from "@/lib/pairing-engine";
import type { MatchWithDetails } from "@/lib/analytics";
import { saveLineup, getLineup, deleteLineup } from "@/lib/actions";

type Player = {
  id: number;
  name: string;
  defaultHandicap: number;
  active: boolean;
  email: string | null;
  phone: string | null;
  createdAt: string;
};

type Club = {
  id: number;
  name: string;
  par: number | null;
  slopeRating: number | null;
  courseRating: number | null;
};

type SavedLineup = {
  id: number;
  name: string;
  fixtureId: number | null;
  clubId: number | null;
  clubName: string | null;
  createdAt: string;
  pairCount: number;
};

type OpponentRow = {
  opp1Name: string;
  opp1Handicap: string;
  opp2Name: string;
  opp2Handicap: string;
  isRedMatch: boolean;
};

const EMPTY_ROW: OpponentRow = {
  opp1Name: "",
  opp1Handicap: "",
  opp2Name: "",
  opp2Handicap: "",
  isRedMatch: false,
};

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <div className="h-2 flex-1 rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-emerald-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-right font-mono">{pct}%</span>
    </div>
  );
}

export function CounterClient({
  players,
  clubs,
  allMatches,
  savedLineups: initialLineups,
}: {
  players: Player[];
  clubs: Club[];
  allMatches: MatchWithDetails[];
  savedLineups: SavedLineup[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [opponentRows, setOpponentRows] = useState<OpponentRow[]>(
    Array.from({ length: 15 }, () => ({ ...EMPTY_ROW })),
  );
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [playerSort, setPlayerSort] = useState<"name" | "handicap">("name");
  const [venueName, setVenueName] = useState<string | undefined>(undefined);
  const [selectedClubId, setSelectedClubId] = useState<number | undefined>(undefined);
  const [result, setResult] = useState<CounterPairingResult | null>(null);

  // Collapsible state
  const [lineupOpen, setLineupOpen] = useState(true);
  const [playersOpen, setPlayersOpen] = useState(true);
  const [resultsOpen, setResultsOpen] = useState(true);

  // Save/load state
  const [savedLineups, setSavedLineups] = useState(initialLineups);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);

  // Sorted players
  const sortedPlayers = useMemo(() => {
    const copy = [...players];
    if (playerSort === "handicap") {
      copy.sort((a, b) => a.defaultHandicap - b.defaultHandicap);
    }
    return copy;
  }, [players, playerSort]);

  function updateRow(index: number, field: keyof OpponentRow, value: string | boolean) {
    setOpponentRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    setResult(null);
  }

  function addRow() {
    setOpponentRows((prev) => [...prev, { ...EMPTY_ROW }]);
    setResult(null);
  }

  function removeRow(index: number) {
    setOpponentRows((prev) => prev.filter((_, i) => i !== index));
    setResult(null);
  }

  function togglePlayer(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setResult(null);
  }

  function selectAll() {
    setSelectedIds(new Set(players.map((p) => p.id)));
    setResult(null);
  }

  function clearAll() {
    setSelectedIds(new Set());
    setResult(null);
  }

  function getValidOpponentPairs(): OpponentPair[] {
    return opponentRows
      .filter(
        (r) =>
          r.opp1Name.trim() &&
          r.opp2Name.trim() &&
          r.opp1Handicap.trim() &&
          r.opp2Handicap.trim(),
      )
      .map((r) => ({
        opp1Name: r.opp1Name.trim(),
        opp1Handicap: parseFloat(r.opp1Handicap),
        opp2Name: r.opp2Name.trim(),
        opp2Handicap: parseFloat(r.opp2Handicap),
        isRedMatch: r.isRedMatch,
      }))
      .filter((p) => !isNaN(p.opp1Handicap) && !isNaN(p.opp2Handicap));
  }

  function handleGenerate() {
    const opponentPairs = getValidOpponentPairs();
    const available: AvailablePlayer[] = players
      .filter((p) => selectedIds.has(p.id))
      .map((p) => ({ id: p.id, name: p.name, handicap: p.defaultHandicap }));

    const res = suggestCounterPairings(opponentPairs, available, allMatches, venueName);
    setResult(res);
    setLineupOpen(false);
    setPlayersOpen(false);
    setResultsOpen(true);
  }

  // Save lineup
  async function handleSave() {
    if (!saveName.trim()) return;
    const pairs = getValidOpponentPairs();
    if (pairs.length === 0) return;

    startTransition(async () => {
      const res = await saveLineup({
        name: saveName.trim(),
        clubId: selectedClubId,
        pairs: pairs.map((p, i) => ({ ...p, matchOrder: i + 1 })),
      });
      if (res.success) {
        setSaveDialogOpen(false);
        setSaveName("");
        router.refresh();
        const club = selectedClubId ? clubs.find((c) => c.id === selectedClubId) : undefined;
        setSavedLineups((prev) => [
          { id: res.data!.id, name: saveName.trim(), fixtureId: null, clubId: selectedClubId ?? null, clubName: club?.name ?? null, createdAt: new Date().toISOString(), pairCount: pairs.length },
          ...prev,
        ]);
      }
    });
  }

  // Load lineup
  async function handleLoad(id: number) {
    const lineup = savedLineups.find((l) => l.id === id);
    startTransition(async () => {
      const res = await getLineup(id);
      if (res.success && res.data) {
        const rows: OpponentRow[] = res.data.pairs.map((p) => ({
          opp1Name: p.opp1Name,
          opp1Handicap: String(p.opp1Handicap),
          opp2Name: p.opp2Name,
          opp2Handicap: String(p.opp2Handicap),
          isRedMatch: p.isRedMatch,
        }));
        setOpponentRows(rows);
        setLoadDialogOpen(false);
        setResult(null);
        setLineupOpen(true);
        // Set club and venue from lineup
        if (res.data.clubId) {
          setSelectedClubId(res.data.clubId);
          const club = clubs.find((c) => c.id === res.data!.clubId);
          if (club) setVenueName(club.name);
        }
      }
    });
  }

  // Delete lineup
  async function handleDelete(id: number) {
    startTransition(async () => {
      const res = await deleteLineup(id);
      if (res.success) {
        setSavedLineups((prev) => prev.filter((l) => l.id !== id));
        router.refresh();
      }
    });
  }

  const validPairs = getValidOpponentPairs();
  const redCount = validPairs.filter((p) => p.isRedMatch).length;
  const selectedCount = selectedIds.size;
  const canGenerate = validPairs.length > 0 && selectedCount >= 2;

  // Opponent analysis (computed from valid pairs)
  const opponentAnalysis = useMemo(() => {
    if (validPairs.length === 0) return null;
    const allHcps = validPairs.flatMap((p) => [p.opp1Handicap, p.opp2Handicap]);
    const combinedHcps = validPairs.map((p) => p.opp1Handicap + p.opp2Handicap);
    const minCombined = Math.min(...combinedHcps);
    const maxCombined = Math.max(...combinedHcps);
    const avgCombined = combinedHcps.reduce((s, h) => s + h, 0) / combinedHcps.length;
    const strongestIdx = combinedHcps.indexOf(minCombined);
    const weakestIdx = combinedHcps.indexOf(maxCombined);

    const redPairs = validPairs.filter((p) => p.isRedMatch);
    const redCombinedHcps = redPairs.map((p) => p.opp1Handicap + p.opp2Handicap);

    return {
      totalPairs: validPairs.length,
      redCount,
      avgCombinedHcp: avgCombined,
      minHcp: Math.min(...allHcps),
      maxHcp: Math.max(...allHcps),
      strongestPair: validPairs[strongestIdx],
      strongestCombined: minCombined,
      weakestPair: validPairs[weakestIdx],
      weakestCombined: maxCombined,
      redAvgCombined: redCombinedHcps.length > 0
        ? redCombinedHcps.reduce((s, h) => s + h, 0) / redCombinedHcps.length
        : 0,
    };
  }, [validPairs, redCount]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/analytics"
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            Counter-Pairing (Away Match)
          </h1>
          <p className="text-muted-foreground">
            Enter the opponent&apos;s lineup and get optimal counter-pairings
          </p>
        </div>
      </div>

      {/* Opponent Lineup */}
      <Collapsible
        title="Opponent Lineup"
        badge={validPairs.length > 0 ? `${validPairs.length} pairs` : undefined}
        open={lineupOpen}
        onOpenChange={setLineupOpen}
      >
        <div className="space-y-3">
          {/* Club selector + Save/Load toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Opponent Club</Label>
              <Select
                value={selectedClubId ? String(selectedClubId) : ""}
                onValueChange={(val) => {
                  const id = val ? parseInt(val) : undefined;
                  setSelectedClubId(id);
                  if (id) {
                    const club = clubs.find((c) => c.id === id);
                    if (club) setVenueName(club.name);
                  }
                }}
              >
                <SelectTrigger className="h-8 w-52">
                  <SelectValue placeholder="Select club" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No club</SelectItem>
                  {clubs.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setSaveDialogOpen(true); setSaveName(""); }}
                disabled={validPairs.length === 0}
              >
                <Save className="mr-1 h-3 w-3" />
                Save
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLoadDialogOpen(!loadDialogOpen)}
              >
                <FolderOpen className="mr-1 h-3 w-3" />
                Load
                {savedLineups.length > 0 && (
                  <span className="ml-1 rounded-full bg-muted px-1.5 text-[10px]">{savedLineups.length}</span>
                )}
              </Button>
            </div>
            <div className="flex-1" />
            <div className="pt-4">
              <Button variant="outline" size="sm" onClick={addRow}>
                <Plus className="mr-1 h-3 w-3" />
                Add Match
              </Button>
            </div>
          </div>

          {/* Save dialog inline */}
          {saveDialogOpen && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <Input
                placeholder="Lineup name (e.g., Thika SC - Mar 2026)"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                className="h-8 flex-1 min-w-[200px]"
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />
              <Button size="sm" onClick={handleSave} disabled={!saveName.trim() || isPending}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSaveDialogOpen(false)}>
                Cancel
              </Button>
            </div>
          )}

          {/* Load dropdown */}
          {loadDialogOpen && (
            <div className="rounded-lg border p-3 space-y-2">
              {savedLineups.length === 0 ? (
                <p className="text-sm text-muted-foreground">No saved lineups yet.</p>
              ) : (
                savedLineups.map((l) => (
                  <div key={l.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                    <button
                      type="button"
                      onClick={() => handleLoad(l.id)}
                      className="flex-1 text-left text-sm"
                      disabled={isPending}
                    >
                      <span className="font-medium">{l.name}</span>
                      {l.clubName && (
                        <span className="ml-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-muted-foreground">
                          {l.clubName}
                        </span>
                      )}
                      <span className="ml-2 text-muted-foreground">
                        {l.pairCount} pairs • {new Date(l.createdAt).toLocaleDateString()}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(l.id)}
                      className="ml-2 rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-500"
                      disabled={isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Column headers */}
          <div className="hidden lg:grid lg:grid-cols-[2rem_1fr_4rem_1fr_4rem_4rem_2rem] lg:gap-2 lg:px-1 text-xs font-medium text-muted-foreground">
            <span>#</span>
            <span>Opponent 1</span>
            <span>Hcp</span>
            <span>Opponent 2</span>
            <span>Hcp</span>
            <span>Red</span>
            <span />
          </div>

          {opponentRows.map((row, i) => (
            <div
              key={i}
              className={`rounded-lg border p-2 ${row.isRedMatch ? "border-red-300 bg-red-50" : ""}`}
            >
              <div className="grid grid-cols-[2rem_1fr_4rem] gap-2 lg:grid-cols-[2rem_1fr_4rem_1fr_4rem_4rem_2rem] lg:gap-2 items-center">
                <span className="text-xs font-medium text-muted-foreground text-center">
                  {i + 1}
                </span>
                <Input
                  placeholder="Player 1 name"
                  value={row.opp1Name}
                  onChange={(e) => updateRow(i, "opp1Name", e.target.value)}
                  className="h-8 text-sm"
                />
                <Input
                  type="number"
                  placeholder="Hcp"
                  value={row.opp1Handicap}
                  onChange={(e) => updateRow(i, "opp1Handicap", e.target.value)}
                  className="h-8 text-sm"
                />
                <Input
                  placeholder="Player 2 name"
                  value={row.opp2Name}
                  onChange={(e) => updateRow(i, "opp2Name", e.target.value)}
                  className="h-8 text-sm col-span-2 lg:col-span-1 col-start-2"
                />
                <Input
                  type="number"
                  placeholder="Hcp"
                  value={row.opp2Handicap}
                  onChange={(e) => updateRow(i, "opp2Handicap", e.target.value)}
                  className="h-8 text-sm col-start-3 lg:col-start-auto"
                />
                <button
                  type="button"
                  onClick={() => updateRow(i, "isRedMatch", !row.isRedMatch)}
                  className={`flex h-8 items-center justify-center rounded border text-xs font-medium transition-colors ${
                    row.isRedMatch
                      ? "border-red-400 bg-red-500 text-white"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                  title={row.isRedMatch ? "Red match (max 4 strokes)" : "Regular match (max 8 strokes)"}
                >
                  {row.isRedMatch ? "RED" : "Reg"}
                </button>
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Collapsible>

      {/* Opponent Analysis */}
      {opponentAnalysis && (
        <Collapsible
          title="Opponent Analysis"
          badge={`${opponentAnalysis.totalPairs} pairs`}
          defaultOpen={true}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Avg Combined Hcp</p>
              <p className="text-xl font-semibold">{opponentAnalysis.avgCombinedHcp.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">
                Range: {opponentAnalysis.minHcp}–{opponentAnalysis.maxHcp}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Strongest Pair</p>
              <p className="text-sm font-semibold">
                {opponentAnalysis.strongestPair.opp1Name} & {opponentAnalysis.strongestPair.opp2Name}
              </p>
              <p className="text-xs text-muted-foreground">
                Combined: {opponentAnalysis.strongestCombined.toFixed(1)}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Weakest Pair</p>
              <p className="text-sm font-semibold">
                {opponentAnalysis.weakestPair.opp1Name} & {opponentAnalysis.weakestPair.opp2Name}
              </p>
              <p className="text-xs text-muted-foreground">
                Combined: {opponentAnalysis.weakestCombined.toFixed(1)}
              </p>
            </div>
            {opponentAnalysis.redCount > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-xs text-red-600">Red Matches</p>
                <p className="text-xl font-semibold text-red-700">{opponentAnalysis.redCount}</p>
                <p className="text-xs text-red-600">
                  Avg combined: {opponentAnalysis.redAvgCombined.toFixed(1)}
                </p>
              </div>
            )}
          </div>
        </Collapsible>
      )}

      {/* Available Players */}
      <Collapsible
        title="Available Players"
        badge={`${selectedCount} selected`}
        open={playersOpen}
        onOpenChange={setPlayersOpen}
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {selectedCount} of {players.length} selected
                {validPairs.length > 0 && ` (need ≥${validPairs.length * 2})`}
              </span>
            </div>
            <div className="flex gap-2">
              <div className="flex rounded-md border">
                <button
                  type="button"
                  onClick={() => setPlayerSort("name")}
                  className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                    playerSort === "name"
                      ? "bg-emerald-50 text-emerald-700"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  Name
                </button>
                <button
                  type="button"
                  onClick={() => setPlayerSort("handicap")}
                  className={`border-l px-2.5 py-1 text-xs font-medium transition-colors ${
                    playerSort === "handicap"
                      ? "bg-emerald-50 text-emerald-700"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  Handicap
                </button>
              </div>
              <Button variant="outline" size="sm" onClick={selectAll}>
                Select All
              </Button>
              <Button variant="outline" size="sm" onClick={clearAll}>
                Clear
              </Button>
            </div>
          </div>

          {players.length === 0 ? (
            <p className="text-muted-foreground">No active players found.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {sortedPlayers.map((p) => {
                const isSelected = selectedIds.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePlayer(p.id)}
                    className={`flex items-center gap-3 rounded-lg border p-3 text-left text-sm transition-colors ${
                      isSelected
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    <div
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-gray-300"
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Handicap: {p.defaultHandicap}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </Collapsible>

      {/* Venue + Generate */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label>Venue (optional)</Label>
          <Select
            value={venueName ?? ""}
            onValueChange={(val) => setVenueName(val || undefined)}
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Any venue" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Any venue</SelectItem>
              {clubs.map((c) => (
                <SelectItem key={c.id} value={c.name}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={handleGenerate}
          disabled={!canGenerate}
          className="gap-1.5"
        >
          <Shield className="h-4 w-4" />
          Generate Counter-Pairings
        </Button>
      </div>

      {/* Insufficient players warning */}
      {validPairs.length > 0 && selectedCount < validPairs.length * 2 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            {validPairs.length} opponent pairs but only {selectedCount} player{selectedCount !== 1 ? "s" : ""} selected.
            Need at least {validPairs.length * 2}.
          </span>
        </div>
      )}

      {/* Results */}
      {result !== null && (
        <Collapsible
          title="Counter-Pairings"
          badge={`${result.matchups.length} matchups`}
          open={resultsOpen}
          onOpenChange={setResultsOpen}
        >
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid gap-3 sm:grid-cols-4">
              <Card size="sm">
                <CardContent className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Matches Paired</p>
                    <p className="text-lg font-semibold">
                      {result.matchups.length} / {validPairs.length}
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card size="sm">
                <CardContent className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                      result.avgCompetitiveness >= 0.5
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    <span className="text-sm font-bold">
                      {(result.avgCompetitiveness * 100).toFixed(0)}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Avg Competitiveness</p>
                    <p className="text-lg font-semibold">
                      {result.avgCompetitiveness >= 0.6
                        ? "Strong"
                        : result.avgCompetitiveness >= 0.45
                          ? "Even"
                          : "Tough"}
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card size="sm">
                <CardContent className="flex items-center gap-3">
                  <div className="flex flex-col items-center gap-0.5 shrink-0">
                    <span className="text-xs font-bold text-emerald-600">🎯 {result.tierSummary.target}</span>
                    <span className="text-xs font-bold text-amber-600">⚔ {result.tierSummary.competitive}</span>
                    <span className="text-xs font-bold text-gray-400">🏳 {result.tierSummary.concede}</span>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Match Strategy</p>
                    <p className="text-sm">
                      <span className="text-emerald-600">{result.tierSummary.target} target</span>
                      {result.tierSummary.competitive > 0 && <span className="text-amber-600"> · {result.tierSummary.competitive} fight</span>}
                      {result.tierSummary.concede > 0 && <span className="text-gray-400"> · {result.tierSummary.concede} concede</span>}
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card size="sm">
                <CardContent className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                    <span className="text-sm font-bold">
                      {result.unpairedPlayers.length}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Reserve Players</p>
                    <p className="text-sm text-muted-foreground">
                      {result.unpairedPlayers.length > 0
                        ? result.unpairedPlayers.map((p) => `${p.name}(${p.handicap})`).join(", ")
                        : "None"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Matchups */}
            {result.matchups.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Not enough players to generate counter-pairings.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Group by tier */}
                {(["target", "competitive", "concede"] as const).map((tier) => {
                  const tierMatchups = result.matchups.filter((m) => m.tier === tier);
                  if (tierMatchups.length === 0) return null;
                  const tierConfig = {
                    target: { label: "🎯 Target Wins", color: "text-emerald-700", border: "border-emerald-200", bg: "bg-emerald-50" },
                    competitive: { label: "⚔ Competitive", color: "text-amber-700", border: "border-amber-200", bg: "bg-amber-50" },
                    concede: { label: "🏳 Concede", color: "text-gray-500", border: "border-gray-200", bg: "bg-gray-50" },
                  }[tier];
                  return (
                    <div key={tier}>
                      <div className={`flex items-center gap-2 mb-2 px-1`}>
                        <span className={`text-sm font-semibold ${tierConfig.color}`}>
                          {tierConfig.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({tierMatchups.length} match{tierMatchups.length !== 1 ? "es" : ""})
                        </span>
                      </div>
                      <div className="space-y-3">
                        {tierMatchups.map((m) => (
                  <Card
                    key={m.matchNumber}
                    className={
                      m.opponent.isRedMatch
                        ? "border-red-300"
                        : tier === "concede"
                          ? "border-gray-200 opacity-75"
                          : tier === "target"
                            ? "border-emerald-200"
                            : ""
                    }
                  >
                    <CardContent className="py-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
                        {/* Match number + tier badge */}
                        <div className="flex items-center gap-2 lg:w-20 lg:shrink-0 lg:flex-col lg:items-start">
                          <div className="flex items-center gap-2">
                            <span
                              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                                m.opponent.isRedMatch
                                  ? "bg-red-100 text-red-700"
                                  : tier === "concede"
                                    ? "bg-gray-100 text-gray-500"
                                    : "bg-emerald-100 text-emerald-700"
                              }`}
                            >
                              {m.matchNumber}
                            </span>
                            {m.opponent.isRedMatch && (
                              <Badge variant="destructive" className="text-[10px]">
                                RED
                              </Badge>
                            )}
                          </div>
                          <Badge
                            variant="secondary"
                            className={`text-[10px] ${
                              tier === "target"
                                ? "bg-emerald-100 text-emerald-700"
                                : tier === "concede"
                                  ? "bg-gray-100 text-gray-500"
                                  : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {m.effectiveSpread.toFixed(1)} spread
                          </Badge>
                        </div>

                        {/* Matchup details */}
                        <div className="flex-1 space-y-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                            <div className="flex-1">
                              <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider">
                                Our Pair
                              </p>
                              <p className="font-semibold">
                                {m.ourPlayer1.name}{" "}
                                <span className="text-muted-foreground font-normal">
                                  ({m.ourPlayer1.handicap})
                                </span>
                                <span className="text-xs text-emerald-600 ml-1">
                                  [{m.strokeAnalysis.ourPlayer1Strokes}]
                                </span>
                                <span className="text-xs text-gray-500 ml-1">
                                  eff. {m.strokeAnalysis.ourPlayer1EffHcp}
                                </span>
                                {m.strokeAnalysis.ourPlayer1Deficit > 0 && (
                                  <span className="text-xs text-amber-600 ml-1">
                                    ⚠ -{m.strokeAnalysis.ourPlayer1Deficit}
                                  </span>
                                )}
                              </p>
                              <p className="font-semibold">
                                {m.ourPlayer2.name}{" "}
                                <span className="text-muted-foreground font-normal">
                                  ({m.ourPlayer2.handicap})
                                </span>
                                <span className="text-xs text-emerald-600 ml-1">
                                  [{m.strokeAnalysis.ourPlayer2Strokes}]
                                </span>
                                <span className="text-xs text-gray-500 ml-1">
                                  eff. {m.strokeAnalysis.ourPlayer2EffHcp}
                                </span>
                                {m.strokeAnalysis.ourPlayer2Deficit > 0 && (
                                  <span className="text-xs text-amber-600 ml-1">
                                    ⚠ -{m.strokeAnalysis.ourPlayer2Deficit}
                                  </span>
                                )}
                              </p>
                            </div>

                            <div className="flex flex-col items-center gap-1 sm:gap-2">
                              <span className="text-sm font-medium text-muted-foreground">
                                vs
                              </span>
                              <div
                                className={`rounded-lg px-3 py-1 text-center text-xs font-bold ${
                                  m.effectiveSpread <= 2.0
                                    ? "bg-emerald-100 text-emerald-700"
                                    : m.effectiveSpread > 4.0
                                      ? "bg-red-100 text-red-700"
                                      : "bg-amber-100 text-amber-700"
                                }`}
                                title={`Effective spread: ${m.effectiveSpread.toFixed(1)} (lower is better)`}
                              >
                                {m.effectiveSpread <= 1.5 ? "Excellent" : m.effectiveSpread <= 3.0 ? "Good" : m.effectiveSpread <= 5.0 ? "Marginal" : "Wide"}
                              </div>
                            </div>

                            <div className="flex-1">
                              <p className="text-xs font-medium text-red-600 uppercase tracking-wider">
                                Their Pair
                              </p>
                              <p className="font-semibold">
                                {m.opponent.opp1Name}{" "}
                                <span className="text-muted-foreground font-normal">
                                  ({m.opponent.opp1Handicap})
                                </span>
                                <span className="text-xs text-red-600 ml-1">
                                  [{m.strokeAnalysis.opp1Strokes}]
                                </span>
                                <span className="text-xs text-gray-500 ml-1">
                                  eff. {m.strokeAnalysis.opp1EffHcp}
                                </span>
                              </p>
                              <p className="font-semibold">
                                {m.opponent.opp2Name}{" "}
                                <span className="text-muted-foreground font-normal">
                                  ({m.opponent.opp2Handicap})
                                </span>
                                <span className="text-xs text-red-600 ml-1">
                                  [{m.strokeAnalysis.opp2Strokes}]
                                </span>
                                <span className="text-xs text-gray-500 ml-1">
                                  eff. {m.strokeAnalysis.opp2EffHcp}
                                </span>
                              </p>
                            </div>
                          </div>

                          {/* Score breakdown */}
                          <div className="space-y-1">
                            <ScoreBar label="Competitive" value={m.breakdown.competitiveness} />
                            <ScoreBar label="Win Rate" value={m.breakdown.historicalWinRate} />
                            <ScoreBar label="Form" value={m.breakdown.recentForm} />
                            <ScoreBar label="Band" value={m.breakdown.bandCoherence} />
                          </div>

                          {/* Reasoning */}
                          <div className="flex flex-wrap gap-1.5">
                            {m.reasoning.map((r, ri) => (
                              <Badge key={ri} variant="secondary" className="text-xs">
                                {r}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        {/* Overall score */}
                        <div className="lg:w-14 lg:shrink-0 lg:text-center">
                          <Badge className={`text-base ${
                            tier === "concede" ? "bg-gray-200 text-gray-600" : ""
                          }`}>
                            {(m.score * 100).toFixed(0)}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Collapsible>
      )}
    </div>
  );
}
