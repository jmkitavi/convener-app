"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Lightbulb, Check } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  suggestPairings,
  type AvailablePlayer,
  type PairingSuggestion,
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

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
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

export function SuggestClient({
  players,
  clubs,
  allMatches,
}: {
  players: Player[];
  clubs: Club[];
  allMatches: MatchWithDetails[];
}) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [venueName, setVenueName] = useState<string | undefined>(undefined);
  const [suggestions, setSuggestions] = useState<PairingSuggestion[] | null>(
    null,
  );

  function togglePlayer(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSuggestions(null);
  }

  function selectAll() {
    setSelectedIds(new Set(players.map((p) => p.id)));
    setSuggestions(null);
  }

  function clearAll() {
    setSelectedIds(new Set());
    setSuggestions(null);
  }

  function handleSuggest() {
    const available: AvailablePlayer[] = players
      .filter((p) => selectedIds.has(p.id))
      .map((p) => ({ id: p.id, name: p.name, handicap: p.defaultHandicap }));

    const results = suggestPairings(available, allMatches, venueName);
    setSuggestions(results);
  }

  const selectedCount = selectedIds.size;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/analytics"
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Pairing Suggestions
          </h1>
          <p className="text-muted-foreground">
            Select available players and get optimal pairing recommendations
          </p>
        </div>
      </div>

      {/* Player selection */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Available Players</CardTitle>
              <CardDescription>
                {selectedCount} of {players.length} selected (minimum 2 needed)
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

      {/* Venue selection + suggest button */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">
            Venue (optional)
          </label>
          <Select
            value={venueName ?? ""}
            onValueChange={(val) =>
              setVenueName(val || undefined)
            }
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
          onClick={handleSuggest}
          disabled={selectedCount < 2}
          className="gap-1.5"
        >
          <Lightbulb className="h-4 w-4" />
          Suggest Pairings
        </Button>
      </div>

      {/* Results */}
      {suggestions !== null && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">
            Top Suggestions ({suggestions.length})
          </h2>

          {suggestions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Select at least 2 players to generate suggestions.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {suggestions.map((s, i) => (
                <Card key={`${s.player1.id}-${s.player2.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                            {i + 1}
                          </span>
                          {s.player1.name} &amp; {s.player2.name}
                        </CardTitle>
                        <CardDescription>
                          {s.matchesPlayed > 0
                            ? `${s.matchesPlayed} matches together • ${(s.winRate * 100).toFixed(0)}% win rate`
                            : "Never paired before"}
                        </CardDescription>
                      </div>
                      <Badge className="text-base">
                        {(s.score * 100).toFixed(0)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Score breakdown */}
                    <div className="space-y-1.5">
                      <ScoreBar
                        label="Win Rate"
                        value={s.breakdown.historicalWinRate}
                      />
                      <ScoreBar
                        label="Confidence"
                        value={s.breakdown.sampleConfidence}
                      />
                      <ScoreBar
                        label="Handicap Fit"
                        value={s.breakdown.handicapCompatibility}
                      />
                      <ScoreBar
                        label="Venue Affinity"
                        value={s.breakdown.venueAffinity}
                      />
                      <ScoreBar
                        label="Recent Form"
                        value={s.breakdown.recentForm}
                      />
                    </div>

                    {/* Reasoning */}
                    <div className="flex flex-wrap gap-1.5">
                      {s.reasoning.map((r, ri) => (
                        <Badge key={ri} variant="secondary">
                          {r}
                        </Badge>
                      ))}
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
