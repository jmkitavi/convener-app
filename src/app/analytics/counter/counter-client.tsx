"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Shield,
  Check,
  Plus,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
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
import {
  suggestCounterPairings,
  type AvailablePlayer,
  type OpponentPair,
  type CounterPairingResult,
} from "@/lib/pairing-engine";
import type { MatchWithDetails } from "@/lib/analytics";

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
}: {
  players: Player[];
  clubs: Club[];
  allMatches: MatchWithDetails[];
}) {
  const [opponentRows, setOpponentRows] = useState<OpponentRow[]>(
    Array.from({ length: 15 }, () => ({ ...EMPTY_ROW })),
  );
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [venueName, setVenueName] = useState<string | undefined>(undefined);
  const [result, setResult] = useState<CounterPairingResult | null>(null);

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

  // Validate and convert rows to OpponentPair[]
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
      .filter(
        (p) => !isNaN(p.opp1Handicap) && !isNaN(p.opp2Handicap),
      );
  }

  function handleGenerate() {
    const opponentPairs = getValidOpponentPairs();
    const available: AvailablePlayer[] = players
      .filter((p) => selectedIds.has(p.id))
      .map((p) => ({ id: p.id, name: p.name, handicap: p.defaultHandicap }));

    const res = suggestCounterPairings(
      opponentPairs,
      available,
      allMatches,
      venueName,
    );
    setResult(res);
  }

  const validPairs = getValidOpponentPairs();
  const redCount = validPairs.filter((p) => p.isRedMatch).length;
  const selectedCount = selectedIds.size;
  const canGenerate = validPairs.length > 0 && selectedCount >= 2;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/analytics"
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Counter-Pairing (Away Match)
          </h1>
          <p className="text-muted-foreground">
            Enter the opponent&apos;s lineup and get optimal counter-pairings
          </p>
        </div>
      </div>

      {/* Opponent Lineup Entry */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Opponent Lineup</CardTitle>
              <CardDescription>
                {validPairs.length} valid pair{validPairs.length !== 1 ? "s" : ""} entered
                {redCount > 0 && ` • ${redCount} red match${redCount !== 1 ? "es" : ""}`}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={addRow}>
              <Plus className="mr-1 h-3 w-3" />
              Add Match
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
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
                  {/* Match number */}
                  <span className="text-xs font-medium text-muted-foreground text-center">
                    {i + 1}
                  </span>

                  {/* Opp1 Name */}
                  <Input
                    placeholder="Player 1 name"
                    value={row.opp1Name}
                    onChange={(e) => updateRow(i, "opp1Name", e.target.value)}
                    className="h-8 text-sm"
                  />

                  {/* Opp1 Hcp */}
                  <Input
                    type="number"
                    placeholder="Hcp"
                    value={row.opp1Handicap}
                    onChange={(e) => updateRow(i, "opp1Handicap", e.target.value)}
                    className="h-8 text-sm"
                  />

                  {/* Opp2 Name - on new line on mobile */}
                  <Input
                    placeholder="Player 2 name"
                    value={row.opp2Name}
                    onChange={(e) => updateRow(i, "opp2Name", e.target.value)}
                    className="h-8 text-sm col-span-2 lg:col-span-1 col-start-2"
                  />

                  {/* Opp2 Hcp */}
                  <Input
                    type="number"
                    placeholder="Hcp"
                    value={row.opp2Handicap}
                    onChange={(e) => updateRow(i, "opp2Handicap", e.target.value)}
                    className="h-8 text-sm col-start-3 lg:col-start-auto"
                  />

                  {/* Red match toggle */}
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

                  {/* Remove */}
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
        </CardContent>
      </Card>

      {/* Available Players */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Available Players</CardTitle>
              <CardDescription>
                {selectedCount} of {players.length} selected
                {validPairs.length > 0 &&
                  ` (need at least ${validPairs.length * 2} for ${validPairs.length} matches)`}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAll}>
                Select All
              </Button>
              <Button variant="outline" size="sm" onClick={clearAll}>
                Clear
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {players.length === 0 ? (
            <p className="text-muted-foreground">
              No active players found. Add players first.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {players.map((p) => {
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
        </CardContent>
      </Card>

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
            You have {validPairs.length} opponent pairs but only {selectedCount} player{selectedCount !== 1 ? "s" : ""} selected.
            Need at least {validPairs.length * 2} players to counter all matches.
          </span>
        </div>
      )}

      {/* Results */}
      {result !== null && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid gap-3 sm:grid-cols-3">
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
                    result.totalNetStrokes >= 0
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  <span className="text-sm font-bold">
                    {result.totalNetStrokes >= 0 ? "+" : ""}
                    {result.totalNetStrokes}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Net Stroke Advantage</p>
                  <p className="text-lg font-semibold">
                    {result.totalNetStrokes >= 0 ? "Favorable" : "Unfavorable"}
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
                      ? result.unpairedPlayers.map((p) => p.name).join(", ")
                      : "None"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Matchups */}
          <h2 className="text-lg font-semibold">
            Counter-Pairings ({result.matchups.length})
          </h2>

          {result.matchups.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Not enough players to generate counter-pairings.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {result.matchups.map((m) => (
                <Card
                  key={m.matchNumber}
                  className={m.opponent.isRedMatch ? "border-red-300" : ""}
                >
                  <CardContent className="py-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
                      {/* Match number + red badge */}
                      <div className="flex items-center gap-2 lg:w-16 lg:shrink-0">
                        <span
                          className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                            m.opponent.isRedMatch
                              ? "bg-red-100 text-red-700"
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

                      {/* Matchup details */}
                      <div className="flex-1 space-y-3">
                        {/* Our pair vs Their pair */}
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
                            </p>
                            <p className="font-semibold">
                              {m.ourPlayer2.name}{" "}
                              <span className="text-muted-foreground font-normal">
                                ({m.ourPlayer2.handicap})
                              </span>
                              <span className="text-xs text-emerald-600 ml-1">
                                [{m.strokeAnalysis.ourPlayer2Strokes}]
                              </span>
                            </p>
                          </div>

                          <div className="flex items-center gap-2 sm:gap-3">
                            <span className="text-sm font-medium text-muted-foreground">
                              vs
                            </span>
                            <div
                              className={`rounded-lg px-3 py-1 text-center text-sm font-bold ${
                                m.strokeAnalysis.netAdvantage > 0
                                  ? "bg-emerald-100 text-emerald-700"
                                  : m.strokeAnalysis.netAdvantage < 0
                                    ? "bg-red-100 text-red-700"
                                    : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {m.strokeAnalysis.netAdvantage > 0 ? "+" : ""}
                              {m.strokeAnalysis.netAdvantage}
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
                            </p>
                            <p className="font-semibold">
                              {m.opponent.opp2Name}{" "}
                              <span className="text-muted-foreground font-normal">
                                ({m.opponent.opp2Handicap})
                              </span>
                              <span className="text-xs text-red-600 ml-1">
                                [{m.strokeAnalysis.opp2Strokes}]
                              </span>
                            </p>
                          </div>
                        </div>

                        {/* Score breakdown */}
                        <div className="space-y-1">
                          <ScoreBar
                            label="Strokes"
                            value={m.breakdown.strokeAdvantage}
                          />
                          <ScoreBar
                            label="Win Rate"
                            value={m.breakdown.historicalWinRate}
                          />
                          <ScoreBar
                            label="Form"
                            value={m.breakdown.recentForm}
                          />
                          <ScoreBar
                            label="Venue"
                            value={m.breakdown.venueAffinity}
                          />
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
                        <Badge className="text-base">
                          {(m.score * 100).toFixed(0)}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
