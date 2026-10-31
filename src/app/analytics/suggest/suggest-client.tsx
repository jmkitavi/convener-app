"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Lightbulb } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { suggestPairings, type PairingSuggestion } from "@/lib/pairing-engine";
import type { MatchWithDetails } from "@/lib/analytics";
import type { DataScope } from "@/lib/insights";
import { useReportView } from "@/components/reports/report-provider";
import { recommendationSection } from "@/lib/reports/datasets";
import { PlayerPicker, ScoreBar, ScoreGuide, ToolSection } from "./tool-workspace";

type Player = { id: number; name: string; defaultHandicap: number };
type Club = { id: number; name: string };

export function SuggestClient({
  scope = "ndc",
  players,
  clubs,
  allMatches,
  historyError = false,
}: {
  scope?: DataScope;
  players: Player[];
  clubs: Club[];
  allMatches: MatchWithDetails[];
  historyError?: boolean;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [venueName, setVenueName] = useState<string | undefined>();
  const [savedSuggestions, setSuggestions] = useState<{ scope: DataScope; items: PairingSuggestion[] } | null>(null);
  const suggestions = savedSuggestions?.scope === scope ? savedSuggestions.items : null;
  useReportView({ready:!historyError&&suggestions!==null,section:suggestions?recommendationSection(suggestions,null,venueName):undefined});
  const [error, setError] = useState("");
  const selectedCount = selectedIds.size;

  function updateSelection(ids: Set<number>) {
    setSelectedIds(ids);
    setSuggestions(null);
    setError("");
  }

  function handleSuggest() {
    setError("");
    try {
      const available = players
        .filter((player) => selectedIds.has(player.id))
        .map((player) => ({ id: player.id, name: player.name, handicap: player.defaultHandicap }));
      if (available.some((player) => !Number.isFinite(player.handicap))) {
        setError("A selected player has no valid handicap. Update their squad record or deselect them before generating.");
        return;
      }
      setSuggestions({ scope, items: suggestPairings(available, allMatches, venueName) });
    } catch {
      setError("Pairings could not be generated. Your selection is unchanged; please try again.");
    }
  }

  return (
    <div className="page-shell screen-desk">
      <PageHeader
        eyebrow="Selection tools / Home"
        title="Build a lineup with intention."
        description="Choose your squad, then explore partnerships informed by your match history."
        actions={<Link href="/analytics/pairings" className="inline-flex min-h-11 items-center gap-2 rounded-lg border bg-card px-4 text-sm font-medium hover:bg-muted"><ArrowLeft aria-hidden="true" className="size-4" />Partnership evidence</Link>}
      />
      <section className="desk-summary grid gap-4 sm:grid-cols-3" aria-label="Planning summary">
        <div><p className="text-sm text-white/75">1 · Select the squad</p><p className="numeric mt-1 text-2xl font-semibold">{selectedCount}<span className="text-sm font-normal text-white/75"> / {players.length} players</span></p></div>
        <div className="min-w-0"><p className="text-sm text-white/75">2 · Set the venue</p><p className="mt-1 font-semibold [overflow-wrap:anywhere]">{venueName ?? "Any venue"}</p></div>
        <div><p className="text-sm text-white/75">3 · Review pair options</p><p className="mt-1 font-semibold">{suggestions === null ? "Ready when you are" : `${suggestions.length} ranked options`}</p></div>
      </section>

      {historyError && <p role="alert" className="data-note attention-note">Match history could not be loaded. Generation is paused to avoid misleading recommendations. <Link href="/analytics/suggest" className="font-medium underline">Reload this tool</Link> to retry.</p>}

      <div className="tool-workspace desk-two-column items-start">
      <div className="desk-stack min-w-0 space-y-4">
      <ToolSection title="1 · Who’s in your squad?" badge={`${selectedCount} selected`}>
        <PlayerPicker
          players={players}
          selectedIds={selectedIds}
          onToggle={(id) => {
            const next = new Set(selectedIds);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            updateSelection(next);
          }}
          onSelectAll={() => updateSelection(new Set(players.map((player) => player.id)))}
          onClear={() => updateSelection(new Set())}
        />
      </ToolSection>

      <section className="desk-panel space-y-4" aria-labelledby="suggest-generate">
        <h2 id="suggest-generate" className="font-semibold">2 · Choose venue &amp; generate</h2>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor="suggest-venue">Venue (optional)</Label>
            <Select value={venueName ?? ""} onValueChange={(value) => { setVenueName(value || undefined); setSuggestions(null); setError(""); }}>
              <SelectTrigger id="suggest-venue" className="w-full min-w-0"><SelectValue className="min-w-0 truncate">{venueName ?? "Any venue"}</SelectValue></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Any venue</SelectItem>
                {clubs.map((club) => <SelectItem key={club.id} value={club.name}><span className="whitespace-normal [overflow-wrap:anywhere]">{club.name}</span></SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSuggest} disabled={selectedCount < 2 || historyError}><Lightbulb aria-hidden="true" className="size-4" />Suggest pairings</Button>
        </div>
        {selectedCount < 2 ? <p className="text-sm text-muted-foreground">Select at least two players to start.</p> : selectedCount % 2 !== 0 ? <p className="data-note attention-note">An odd squad is fine for exploring pairs. These options are not a full lineup; one player would remain unpaired if everyone else played.</p> : <p className="text-sm text-muted-foreground">Changing the squad or venue clears the previous recommendations.</p>}
        {error && <p role="alert" className="data-note attention-note">{error}</p>}
      </section>
      </div>

      <section className="desk-stack min-w-0 space-y-4" aria-labelledby="suggest-results">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="suggest-results" className="text-lg font-semibold">{suggestions === null ? "Your selection workspace" : "3 · Pairings to discuss"}</h2>
          {suggestions !== null && <span role="status" className="text-sm text-muted-foreground">{suggestions.length} ranked pair options</span>}
        </div>
        {suggestions === null ? (
          <div className="desk-panel px-5 py-14 text-center"><Lightbulb aria-hidden="true" className="mx-auto mb-4 size-8 text-primary" /><p className="font-semibold">Good pairings start with your squad.</p><p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">Select at least two players, choose a venue if useful, then generate to compare pair records and score components.</p></div>
        ) : suggestions.length === 0 ? (
          <p className="data-note attention-note">No pair options were returned. Select at least two players and try again.</p>
        ) : (
          <div className="grid min-w-0 gap-4">
            {suggestions.map((suggestion, index) => (
              <Card key={`${suggestion.player1.id}-${suggestion.player2.id}`} className="min-w-0 border-t-2 border-t-primary">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-primary">Pair option {index + 1}</p>
                      <CardTitle className="leading-relaxed [overflow-wrap:anywhere]">{suggestion.player1.name} <span className="text-sm font-normal text-muted-foreground">({suggestion.player1.handicap})</span><br />&amp; {suggestion.player2.name} <span className="text-sm font-normal text-muted-foreground">({suggestion.player2.handicap})</span></CardTitle>
                      <CardDescription>{suggestion.matchesPlayed > 0 ? `${suggestion.matchesPlayed} matches together · ${(suggestion.winRate * 100).toFixed(0)}% win rate` : "Untested pairing · exploration baseline"}</CardDescription>
                    </div>
                    <div className="shrink-0 text-center"><Badge className="numeric h-auto py-1 text-base">{(suggestion.score * 100).toFixed(0)}</Badge><p className="mt-1 text-[10px] text-muted-foreground">Score / 100</p></div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2" aria-label="Score components">
                    <ScoreBar label="Historical win rate" value={suggestion.breakdown.historicalWinRate} />
                    <ScoreBar label="Sample confidence" value={suggestion.breakdown.sampleConfidence} />
                    <ScoreBar label="Handicap fit" value={suggestion.breakdown.handicapCompatibility} />
                    <ScoreBar label="Venue affinity" value={suggestion.breakdown.venueAffinity} />
                    <ScoreBar label="Recent form" value={suggestion.breakdown.recentForm} />
                  </div>
                  <ul className="space-y-2 border-t pt-3 text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
                    {suggestion.reasoning.map((reason, reasonIndex) => <li key={reasonIndex}>{reason}</li>)}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        <div className="desk-note text-sm leading-relaxed">These are ranked pair options, not a complete lineup. Players can appear in more than one option. Scores compare the available evidence; they are not predicted win probabilities.</div>
        <ScoreGuide scope={scope} />
      </section>
      </div>
    </div>
  );
}
