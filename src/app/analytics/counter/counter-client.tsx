"use client";

import { useState, useMemo, useRef, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Shield,
  Plus,
  Trash2,
  AlertTriangle,
  Save,
  FolderOpen,
  ArrowUp,
  ArrowDown,
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
import { PageHeader } from "@/components/page-header";
import { PlayerPicker, ScoreBar, ScoreGuide, ToolSection } from "../suggest/tool-workspace";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  suggestCounterPairings,
  type AvailablePlayer,
  type CounterPairingResult,
} from "@/lib/pairing-engine";
import type { MatchWithDetails } from "@/lib/analytics";
import type { DataScope } from "@/lib/insights";
import { useReportView } from "@/components/reports/report-provider";
import { recommendationSection } from "@/lib/reports/datasets";
import { saveLineup, getLineup, deleteLineup } from "@/lib/actions";
import { completeOpponentPairs, moveOpponentRow, type OpponentRow } from "./lineup-input";

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

const EMPTY_ROW: OpponentRow = {
  opp1Name: "",
  opp1Handicap: "",
  opp2Name: "",
  opp2Handicap: "",
  isRedMatch: false,
};

export function CounterClient({
  scope = "ndc",
  players,
  clubs,
  allMatches,
  savedLineups: initialLineups,
  historyError = false,
  savedLineupsError = false,
}: {
  scope?: DataScope;
  players: Player[];
  clubs: Club[];
  allMatches: MatchWithDetails[];
  savedLineups: SavedLineup[];
  historyError?: boolean;
  savedLineupsError?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [opponentRows, setOpponentRows] = useState<OpponentRow[]>(
    Array.from({ length: 15 }, () => ({ ...EMPTY_ROW })),
  );
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [venueName, setVenueName] = useState<string | undefined>(undefined);
  const [selectedClubId, setSelectedClubId] = useState<number | undefined>(undefined);
  const [savedResult, setResult] = useState<{ scope: DataScope; value: CounterPairingResult } | null>(null);
  const result = savedResult?.scope === scope ? savedResult.value : null;
  useReportView({ready:!historyError&&result!==null,section:result?recommendationSection(null,result,venueName):undefined});

  // Collapsible state
  const [lineupOpen, setLineupOpen] = useState(true);
  const [playersOpen, setPlayersOpen] = useState(true);
  const [resultsOpen, setResultsOpen] = useState(true);
  const [stage, setStage] = useState(0);
  const [showAllRows, setShowAllRows] = useState(false);
  const stepButtons = useRef<(HTMLButtonElement | null)[]>([]);

  function goToStage(next: number) {
    setStage(next);
    stepButtons.current[next]?.focus();
  }

  // Save/load state
  const [savedLineups, setSavedLineups] = useState(initialLineups);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SavedLineup | null>(null);

  function runLineupAction(action: () => Promise<void>) {
    setError("");
    setNotice("");
    startTransition(async () => {
      try {
        await action();
      } catch {
        setError("The lineup request failed. Your current entries are unchanged. Please try again.");
      }
    });
  }

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
    setShowAllRows(true);
    setResult(null);
  }

  function removeRow(index: number) {
    setOpponentRows((prev) => prev.filter((_, i) => i !== index));
    setResult(null);
  }

  function moveRow(index: number, direction: -1 | 1) {
    setOpponentRows((prev) => moveOpponentRow(prev, index, direction));
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

  function getValidOpponentPairs() {
    return completeOpponentPairs(opponentRows);
  }

  function handleGenerate() {
    const opponentPairs = getValidOpponentPairs();
    const available: AvailablePlayer[] = players
      .filter((p) => selectedIds.has(p.id))
      .map((p) => ({ id: p.id, name: p.name, handicap: p.defaultHandicap }));

    setError("");
    if (available.some((player) => !Number.isFinite(player.handicap))) {
      setError("A selected player has no valid handicap. Update their squad record or deselect them before generating.");
      return;
    }
    try {
      const res = suggestCounterPairings(opponentPairs, available, allMatches, venueName);
      setResult({ scope, value: res });
      setLineupOpen(false);
      setPlayersOpen(false);
      setResultsOpen(true);
      goToStage(2);
    } catch {
      setError("Counter-pairings could not be generated. Your entries are unchanged; please try again.");
    }
  }

  // Save lineup
  async function handleSave() {
    if (!saveName.trim() || isPending) return;
    const pairs = getValidOpponentPairs();
    if (pairs.length === 0) return;

    runLineupAction(async () => {
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
        setNotice("Opponent lineup saved.");
      } else {
        setError(res.error ?? "The lineup could not be saved. Your entries are unchanged.");
      }
    });
  }

  // Load lineup
  async function handleLoad(id: number) {
    runLineupAction(async () => {
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
        setSelectedClubId(res.data.clubId ?? undefined);
        const club = clubs.find((c) => c.id === res.data!.clubId);
        setVenueName(club?.name);
        setNotice("Opponent lineup loaded. Review it before generating.");
      } else {
        setError(res.error ?? "The saved lineup could not be loaded.");
      }
    });
  }

  // Delete lineup
  async function handleDelete(id: number) {
    runLineupAction(async () => {
      const res = await deleteLineup(id);
      if (res.success) {
        setSavedLineups((prev) => prev.filter((l) => l.id !== id));
        setDeleteTarget(null);
        router.refresh();
        setNotice("Saved opponent lineup deleted. Current entries are unchanged.");
      } else {
        setError(res.error ?? "The saved lineup could not be deleted.");
      }
    });
  }

  const validPairs = getValidOpponentPairs();
  const redCount = validPairs.filter((p) => p.isRedMatch).length;
  const selectedCount = selectedIds.size;
  const canGenerate = validPairs.length > 0 && selectedCount >= 2 && !historyError;

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
    <div className="page-shell screen-desk">
      <PageHeader
        eyebrow="Selection tools / Away"
        title="Meet their lineup with a plan."
        description="An ordered response, with every decision still in your hands."
        actions={<Link href="/analytics/suggest" className="inline-flex min-h-11 items-center gap-2 rounded-lg border bg-card px-4 text-sm font-medium hover:bg-muted"><ArrowLeft aria-hidden="true" className="size-4" />Home pairing tool</Link>}
      />
      <nav aria-label="Counter tool steps" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {["Opponent lineup", "Our response", "Review matchups"].map((label, index) => (
          <button key={label} ref={(button) => { stepButtons.current[index] = button; }} type="button" aria-current={stage === index ? "step" : undefined} aria-controls={`counter-stage-${index}`} onClick={() => goToStage(index)} className={`flex min-h-12 items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm font-medium ${stage === index ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"}`}>
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-current text-xs">{index + 1}</span>{label}
          </button>
        ))}
      </nav>
      <section className="desk-summary grid gap-4 sm:grid-cols-3" aria-label="Planning summary">
        <div><p className="text-sm text-white/75">1 · Opponent lineup</p><p className="numeric mt-1 text-2xl font-semibold">{validPairs.length}<span className="text-sm font-normal text-white/75"> complete pairs</span></p></div>
        <div><p className="text-sm text-white/75">2 · Select the squad</p><p className="numeric mt-1 text-2xl font-semibold">{selectedCount}<span className="text-sm font-normal text-white/75"> / {players.length} players</span></p></div>
        <div><p className="text-sm text-white/75">3 · Review matchups</p><p className="mt-1 font-semibold">{result === null ? "Ready when you are" : `${result.matchups.length} matchups generated`}</p></div>
      </section>
      {historyError && <p role="alert" className="data-note attention-note">Match history could not be loaded. Generation is paused to avoid misleading recommendations. <Link href="/analytics/counter" className="font-medium underline">Reload this tool</Link> to retry.</p>}
      {savedLineupsError && <p role="alert" className="data-note attention-note">Saved lineups could not be loaded. This does not mean none exist. <Link href="/analytics/counter" className="font-medium underline">Reload to retry.</Link></p>}
      {error && <p role="alert" className="data-note attention-note">{error}</p>}
      {notice && <p role="status" className="data-note">{notice}</p>}
      {isPending && <p role="status" className="text-sm text-muted-foreground">Updating saved lineups…</p>}

      {/* Opponent Lineup */}
      <div id="counter-stage-0" className="tool-workspace desk-two-column items-start" style={stage !== 0 ? { display: "none" } : undefined}>
      <div className="desk-stack min-w-0 space-y-4">
      <ToolSection
        title="1 · Opponent lineup"
        badge={validPairs.length > 0 ? `${validPairs.length} pairs` : undefined}
        open={lineupOpen}
        onOpenChange={setLineupOpen}
      >
        <div className="space-y-3">
          {/* Club selector + Save/Load toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="space-y-1">
              <Label htmlFor="counter-club">Opponent club</Label>
              <Select
                value={selectedClubId ? String(selectedClubId) : ""}
                onValueChange={(val) => {
                  const id = val ? parseInt(val) : undefined;
                  setSelectedClubId(id);
                  setResult(null);
                  if (id) {
                    const club = clubs.find((c) => c.id === id);
                    if (club) setVenueName(club.name);
                  } else setVenueName(undefined);
                }}
              >
                <SelectTrigger id="counter-club" className="w-full min-w-0 sm:w-64">
                  <SelectValue placeholder="Select club">
                    {selectedClubId
                      ? clubs.find((c) => c.id === selectedClubId)?.name ?? "Select club"
                      : "Select club"}
                  </SelectValue>
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
                disabled={validPairs.length === 0 || isPending}
              >
                <Save className="mr-1 h-3 w-3" />
                Save
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLoadDialogOpen(true)}
                disabled={isPending || savedLineupsError}
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

          {/* Save and load retain the existing opponent-lineup actions. */}
          <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
            <DialogContent>
              <DialogHeader><DialogTitle>Save opponent lineup</DialogTitle><DialogDescription>Save the {validPairs.length} complete opponent pairs for a future planning session. This does not save generated counter-pairings.</DialogDescription></DialogHeader>
              <Label htmlFor="counter-save-name">Lineup name</Label>
              <Input
                id="counter-save-name"
                placeholder="Lineup name (e.g., Thika SC - Mar 2026)"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                className="min-w-0"
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <div className="page-actions">
              <Button onClick={handleSave} disabled={!saveName.trim() || isPending}>
                Save
              </Button>
              <Button variant="outline" disabled={isPending} onClick={() => setSaveDialogOpen(false)}>
                Cancel
              </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader><DialogTitle>Saved opponent lineups</DialogTitle><DialogDescription>Loading replaces your current opponent entries. Your squad selection is kept.</DialogDescription></DialogHeader>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <div className="space-y-2">
              {savedLineups.length === 0 ? (
                <p className="text-sm text-muted-foreground">No saved lineups yet.</p>
              ) : (
                savedLineups.map((l) => (
                  <div key={l.id} className="flex min-w-0 items-center justify-between gap-2 rounded-lg border px-3 py-2">
                    <button
                      type="button"
                      onClick={() => handleLoad(l.id)}
                      className="min-h-11 min-w-0 flex-1 text-left text-sm [overflow-wrap:anywhere]"
                      disabled={isPending}
                    >
                      <span className="font-medium">{l.name}</span>
                      {l.clubName && (
                        <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                          {l.clubName}
                        </span>
                      )}
                      <span className="ml-2 text-muted-foreground">
                        {l.pairCount} pairs • {new Date(l.createdAt).toLocaleDateString()}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(l)}
                      className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Delete saved lineup ${l.name}`}
                      disabled={isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open && !isPending) setDeleteTarget(null); }}>
            <DialogContent>
              <DialogHeader><DialogTitle>Delete saved opponent lineup?</DialogTitle><DialogDescription>“{deleteTarget?.name}” will be permanently deleted. Your current opponent entries and squad selection will not change.</DialogDescription></DialogHeader>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <div className="page-actions">
                <Button variant="outline" disabled={isPending} onClick={() => setDeleteTarget(null)}>Cancel</Button>
                <Button variant="destructive" disabled={isPending} onClick={() => { if (deleteTarget) handleDelete(deleteTarget.id); }}>Delete lineup</Button>
              </div>
            </DialogContent>
          </Dialog>
          <p className="data-note">Only rows with both names and both handicaps are used. Red matches cap strokes at 4; regular matches cap strokes at 8. Empty or incomplete rows are not saved or generated.</p>

          {/* Column headers */}
          <div className="hidden lg:grid lg:grid-cols-[2rem_minmax(0,1fr)_4rem_minmax(0,1fr)_4rem_4rem_2.75rem] lg:gap-2 lg:px-3 text-xs font-medium text-muted-foreground">
            <span>#</span>
            <span>Opponent 1</span>
            <span>Hcp</span>
            <span>Opponent 2</span>
            <span>Hcp</span>
            <span>Red</span>
            <span />
          </div>

          {opponentRows.map((row, i) => !showAllRows && i >= 4 && !row.opp1Name && !row.opp2Name && !row.opp1Handicap && !row.opp2Handicap && !row.isRedMatch ? null : (
            <div
              key={i}
              className={`min-w-0 rounded-lg border p-3 ${row.isRedMatch ? "border-destructive/40 bg-destructive/5" : "bg-muted/20"}`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Position {i + 1}</span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" aria-label={`Move opponent match ${i + 1} up`} disabled={i === 0} onClick={() => moveRow(i, -1)}><ArrowUp aria-hidden="true" className="size-4" /></Button>
                  <Button variant="ghost" size="icon" aria-label={`Move opponent match ${i + 1} down`} disabled={i === opponentRows.length - 1} onClick={() => moveRow(i, 1)}><ArrowDown aria-hidden="true" className="size-4" /></Button>
                </div>
              </div>
              <div className="grid grid-cols-[1.5rem_minmax(0,1fr)_4rem] gap-2 lg:grid-cols-[2rem_minmax(0,1fr)_4rem_minmax(0,1fr)_4rem_4rem_2.75rem] items-center">
                <span className="text-xs font-medium text-muted-foreground text-center">
                  {i + 1}
                </span>
                <Input
                  placeholder="Player 1 name"
                  aria-label={`Match ${i + 1}, opponent 1 name`}
                  value={row.opp1Name}
                  onChange={(e) => updateRow(i, "opp1Name", e.target.value)}
                  className="h-10 text-sm"
                />
                <Input
                  type="number"
                  placeholder="Hcp"
                  aria-label={`Match ${i + 1}, opponent 1 handicap`}
                  step="any"
                  value={row.opp1Handicap}
                  onChange={(e) => updateRow(i, "opp1Handicap", e.target.value)}
                  className="h-10 text-sm"
                />
                <Input
                  placeholder="Player 2 name"
                  aria-label={`Match ${i + 1}, opponent 2 name`}
                  value={row.opp2Name}
                  onChange={(e) => updateRow(i, "opp2Name", e.target.value)}
                  className="h-10 text-sm col-start-2 lg:col-start-auto"
                />
                <Input
                  type="number"
                  placeholder="Hcp"
                  aria-label={`Match ${i + 1}, opponent 2 handicap`}
                  step="any"
                  value={row.opp2Handicap}
                  onChange={(e) => updateRow(i, "opp2Handicap", e.target.value)}
                  className="h-10 text-sm col-start-3 lg:col-start-auto"
                />
                <button
                  type="button"
                  onClick={() => updateRow(i, "isRedMatch", !row.isRedMatch)}
                  aria-label={`Match ${i + 1}, red match (4 stroke cap)`}
                  aria-pressed={row.isRedMatch}
                  className={`col-start-2 flex h-11 items-center justify-center rounded border text-xs font-medium transition-colors lg:col-start-auto ${
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
                  aria-label={`Remove opponent match ${i + 1}`}
                  className="flex size-11 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
          {opponentRows.length > 4 && (
            <Button variant="outline" className="w-full" onClick={() => setShowAllRows((shown) => !shown)}>
              {showAllRows ? "Hide unused positions after the first four" : `Show all ${opponentRows.length} opponent positions`}
            </Button>
          )}
        </div>
      </ToolSection>

      {/* Opponent Analysis */}
      {opponentAnalysis && (
        <ToolSection
          title="Opponent Analysis"
          badge={`${opponentAnalysis.totalPairs} pairs`}
          defaultOpen={true}
        >
          <div className="grid gap-3 sm:grid-cols-2">
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
        </ToolSection>
      )}
      <div className="desk-panel-footer flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{validPairs.length} complete pairs · {validPairs.length * 2} players needed</p>
        <Button onClick={() => { setPlayersOpen(true); goToStage(1); }}>Choose our response</Button>
      </div>
      </div>
      <aside className="desk-panel space-y-5">
        <div className="desk-panel-header"><h2 className="font-semibold">Order changes the question.</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Away selection responds to a declared opponent order. Enter the names and handicaps, and move rows to match their lineup.</p></div>
        <dl className="space-y-4 text-sm">
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Opponent pairs</dt><dd className="numeric font-semibold">{validPairs.length}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Required players</dt><dd className="numeric font-semibold">{validPairs.length * 2}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Red matches</dt><dd className="numeric font-semibold">{redCount}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Response</dt><dd className="font-semibold">{result ? "Generated" : "Not generated"}</dd></div>
        </dl>
        <p className="desk-note text-sm leading-relaxed">Save and load retain the opponent lineup only. Your squad selection and generated response remain temporary.</p>
      </aside>
      </div>

      {/* Available Players */}
      <div id="counter-stage-1" className="tool-workspace desk-two-column items-start" style={stage !== 1 ? { display: "none" } : undefined}>
      <div className="desk-stack min-w-0 space-y-4">
      <ToolSection
        title="2 · Select players"
        badge={`${selectedCount} selected`}
        open={playersOpen}
        onOpenChange={setPlayersOpen}
      >
        <PlayerPicker players={players} selectedIds={selectedIds} onToggle={togglePlayer} onSelectAll={selectAll} onClear={clearAll} />
      </ToolSection>

      {/* Venue + Generate */}
      <section className="desk-panel space-y-4">
        <h2 className="font-semibold">Set the venue &amp; build our response</h2>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor="counter-venue">Venue (optional)</Label>
          <Select
            value={venueName ?? ""}
            onValueChange={(val) => { setVenueName(val || undefined); setResult(null); }}
          >
            <SelectTrigger id="counter-venue" className="w-full min-w-0">
              <SelectValue className="min-w-0 truncate">{venueName ?? "Any venue"}</SelectValue>
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
          Generate counter-pairings
        </Button>
        </div>
        <p className="text-sm text-muted-foreground">Changing opponent entries, the squad or venue clears previous recommendations. Saved opponent lineups are separate from this temporary selection.</p>
        {!validPairs.length && <p className="data-note">Complete at least one opponent pair and select at least two squad players to generate.</p>}
      </section>

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
      <Button variant="outline" onClick={() => { setLineupOpen(true); goToStage(0); }}><ArrowLeft aria-hidden="true" className="size-4" />Back to opponents</Button>
      </div>
      <aside className="desk-panel space-y-4">
        <h2 className="font-semibold">A response worth reviewing.</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">Choose a candidate pool for {validPairs.length} opponent pairs. The engine considers handicaps, partnership records, recent form and venue history.</p>
        <p className="desk-note text-sm leading-relaxed">{selectedCount} selected · {validPairs.length * 2} needed for a complete response. Extra or odd players may remain in reserve; selection does not guarantee a place.</p>
        <ScoreGuide counter scope={scope} />
      </aside>
      </div>

      {/* Results */}
      <div id="counter-stage-2" className="desk-stack min-w-0 space-y-4" style={stage !== 2 ? { display: "none" } : undefined}>
      <div className="desk-panel flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-semibold">A response for the team conversation.</h2><p className="mt-1 text-sm text-muted-foreground">Review the scores, strokes and strategy before deciding your final lineup.</p></div>
        <Button variant="outline" onClick={() => { setPlayersOpen(true); goToStage(1); }}>Adjust our response</Button>
      </div>
      <ScoreGuide counter scope={scope} />
      {result === null ? (
        <div className="desk-panel py-8 text-center"><Shield aria-hidden="true" className="mx-auto mb-3 size-6 text-primary" /><h2 className="font-medium">Your matchups will appear here</h2><p className="mt-1 text-sm text-muted-foreground">Complete the opponent lineup, choose your squad and generate to compare strategies.</p></div>
      ) : (
        <ToolSection
          title="Counter-pairing recommendations"
          badge={`${result.matchups.length} matchups`}
          open={resultsOpen}
          onOpenChange={setResultsOpen}
        >
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
                    <span className="text-xs font-bold text-blue-600">🤝 {result.tierSummary.target_half}</span>
                    <span className="text-xs font-bold text-amber-600">⚔ {result.tierSummary.competitive}</span>
                    <span className="text-xs font-bold text-gray-400">🏳 {result.tierSummary.concede}</span>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Match Strategy</p>
                    <p className="text-sm">
                      <span className="text-emerald-600">{result.tierSummary.target} win</span>
                      {result.tierSummary.target_half > 0 && <span className="text-blue-600"> · {result.tierSummary.target_half} half</span>}
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
                {(["target", "target_half", "competitive", "concede"] as const).map((tier) => {
                  const tierMatchups = result.matchups.filter((m) => m.tier === tier);
                  if (tierMatchups.length === 0) return null;
                  const tierConfig = {
                    target: { label: "🎯 Target Wins", color: "text-emerald-700", border: "border-emerald-200", bg: "bg-emerald-50" },
                    target_half: { label: "🤝 Target Half", color: "text-blue-700", border: "border-blue-200", bg: "bg-blue-50" },
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
                            : tier === "target_half"
                              ? "border-blue-200"
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
                                    : tier === "target_half"
                                      ? "bg-blue-100 text-blue-700"
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
                                : tier === "target_half"
                                  ? "bg-blue-100 text-blue-700"
                                  : tier === "concede"
                                    ? "bg-gray-100 text-gray-500"
                                    : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {m.effectiveSpread.toFixed(1)} spread
                          </Badge>
                        </div>

                        {/* Matchup details */}
                        <div className="min-w-0 flex-1 space-y-3 [overflow-wrap:anywhere]">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                            <div className="min-w-0 flex-1">
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

                            <div className="min-w-0 flex-1">
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
                            <ScoreBar label="Venue affinity" value={m.breakdown.venueAffinity} />
                            <ScoreBar label="Band" value={m.breakdown.bandCoherence} />
                            <ScoreBar label="Strength" value={m.breakdown.playerStrength} />
                            <ScoreBar label="Partner Bal." value={m.breakdown.partnerBalance} />
                          </div>

                          {/* Reasoning */}
                          <div className="flex flex-wrap gap-1.5">
                            {m.reasoning.map((r, ri) => (
                              <Badge key={ri} variant="secondary" className="h-auto max-w-full whitespace-normal text-xs">
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
                          <p className="mt-1 text-[10px] text-muted-foreground">Score / 100</p>
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
        </ToolSection>
      )}
      </div>
    </div>
  );
}
