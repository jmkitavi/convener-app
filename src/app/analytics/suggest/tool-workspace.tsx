"use client";

import { useId, useState, type ReactNode } from "react";
import Link from "next/link";
import { Check, ChevronDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ToolSection({
  title,
  badge,
  defaultOpen = true,
  open,
  onOpenChange,
  children,
}: {
  title: string;
  badge?: string;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const expanded = open ?? internalOpen;
  const id = useId();
  return (
    <section className="desk-panel min-w-0 !p-0">
      <h2>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => {
            setInternalOpen(!expanded);
            onOpenChange?.(!expanded);
          }}
          className="desk-panel-header !mb-0 flex w-full items-center justify-between gap-3 p-4 text-left sm:p-5"
        >
          <span className="flex min-w-0 flex-wrap items-center gap-2 font-semibold">
            {title}
            {badge && <span className="desk-status" data-tone="home">{badge}</span>}
          </span>
          <ChevronDown aria-hidden="true" className={`size-4 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      </h2>
      <div id={id} hidden={!expanded} className="min-w-0 space-y-4 px-4 pb-4 sm:px-5 sm:pb-5">
        {children}
      </div>
    </section>
  );
}

export function PlayerPicker({
  players,
  selectedIds,
  onToggle,
  onSelectAll,
  onClear,
}: {
  players: { id: number; name: string; defaultHandicap: number }[];
  selectedIds: Set<number>;
  onToggle: (id: number) => void;
  onSelectAll: () => void;
  onClear: () => void;
}) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"name" | "handicap">("name");
  const id = useId();
  const visible = players
    .filter((player) => player.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
    .sort((a, b) => sort === "handicap"
      ? (Number.isFinite(a.defaultHandicap) ? a.defaultHandicap : Infinity) - (Number.isFinite(b.defaultHandicap) ? b.defaultHandicap : Infinity) || a.name.localeCompare(b.name)
      : a.name.localeCompare(b.name));

  return (
    <div className="space-y-4">
      <div className="desk-toolbar flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <Label htmlFor={`${id}-search`}>Find a player</Label>
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground" />
            <Input id={`${id}-search`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search squad by name" className="pl-9" />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-sort`}>Sort players</Label>
          <select id={`${id}-sort`} value={sort} onChange={(event) => setSort(event.target.value as "name" | "handicap")} className="h-11 max-w-full rounded-lg border bg-card px-3 text-sm">
            <option value="name">Name</option>
            <option value="handicap">Handicap</option>
          </select>
        </div>
      </div>
      <div className="filter-bar justify-between">
        <p className="text-sm text-muted-foreground" role="status">{selectedIds.size} of {players.length} selected · {visible.length} shown</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onSelectAll} disabled={!players.length}>Select all squad</Button>
          <Button variant="ghost" size="sm" onClick={onClear} disabled={!selectedIds.size}>Clear selection</Button>
        </div>
      </div>
      {players.length === 0 ? (
        <p className="data-note">No active players found. <Link href="/players" className="font-medium underline">Manage the squad</Link> before generating pairings.</p>
      ) : visible.length === 0 ? (
        <div className="data-note">
          <p>No players match your search. Your selection is unchanged.</p>
          <Button variant="link" className="px-0" onClick={() => setSearch("")}>Clear search</Button>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {visible.map((player) => {
            const selected = selectedIds.has(player.id);
            return (
              <button
                key={player.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onToggle(player.id)}
                className={`flex min-h-16 min-w-0 items-center gap-3 rounded-lg border p-3 text-left text-sm transition-colors ${selected ? "border-primary/40 bg-primary/5" : "border-border bg-card hover:bg-muted"}`}
              >
                <span aria-hidden="true" className={`flex size-4 shrink-0 items-center justify-center rounded border ${selected ? "border-primary bg-primary text-primary-foreground" : "border-input"}`}>
                  {selected && <Check className="size-3" />}
                </span>
                <span aria-hidden="true" className="desk-avatar shrink-0">{player.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("")}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium [overflow-wrap:anywhere]">{player.name}</span>
                  <span className="numeric text-xs text-muted-foreground">HI {Number.isFinite(player.defaultHandicap) ? player.defaultHandicap : "Unknown"}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
      <p className="desk-note text-xs">Active squad only. This temporary selection does not record fixture availability or change player status.</p>
    </div>
  );
}

export function ScoreBar({ label, value }: { label: string; value: number }) {
  const percent = Math.round(value * 100);
  return (
    <div className="flex min-w-0 items-center gap-2 text-xs">
      <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
      <div aria-hidden="true" className="h-1.5 min-w-0 flex-1 rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
      </div>
      <span className="numeric w-9 shrink-0 text-right">{percent}%</span>
    </div>
  );
}

export function ScoreGuide({ counter = false, scope = "ndc" }: { counter?: boolean; scope?: "ndc" | "all" }) {
  return (
    <details className="desk-note text-sm">
      <summary className="cursor-pointer font-medium text-foreground">How to read these recommendations</summary>
      <div className="mt-3 space-y-2">
        <p>Engine scores are relative ratings out of 100, not predicted win probabilities or fixture points. Component bars show individual ratings before weighting. Recommendations follow the app-wide results scope: {scope === "ndc" ? "NDC only; internal matches excluded." : "all history, including internal matches."} Change the scope in the header to use different historical evidence.</p>
        {counter ? (
          <>
            <p>Weights: competitiveness 35%, historical win rate 20%, partner balance 15%, recent form 10%, venue affinity 10%, band coherence 5%, player strength 5%.</p>
            <p>Competitiveness compares effective handicaps after strokes. Band coherence favours a similar handicap range across all four players; strength favours lower handicaps; partner balance discourages an extreme gap within our pair.</p>
            <p>The engine concentrates stronger players on attainable matches and can assign weaker pairs to concessions. Selected players below handicap 14 are prioritised; players at 21 or above are drafted after stronger options. A selection is a candidate pool, not a guarantee of playing.</p>
            <p>Strategy tiers: target win, target half, competitive and concede describe the engine&apos;s allocation, not certain outcomes. They use effective spread and the available alternatives; a concession can retain its allocation even after a player swap.</p>
            <p>Strokes: 90% of the difference from the lowest handicap in the fourball, rounded down, capped at 8 for regular matches or 4 for red matches. [Brackets] show strokes received; “eff.” is handicap minus those strokes; a deficit shows strokes lost to the cap. Lower effective spread is better.</p>
          </>
        ) : (
          <>
            <p>Weights: historical win rate 40%, handicap fit 20%, venue affinity 15%, recent form 15%, sample confidence 10%.</p>
            <p>Handicap fit favours complementary partner handicaps, especially a 6–10 spread. Confidence grows with matches together, reaching its maximum at eight. Untested pairs receive an exploration baseline, not an observed win rate.</p>
            <p>These are ranked pair options, not a complete lineup. A player may appear in several recommendations.</p>
          </>
        )}
        <p>Historical win rate uses wins from the pairing record. Recent form uses each player&apos;s last five completed matches. Venue affinity uses pair history where available, then individual venue history; absent evidence has a neutral baseline. Unknown historical handicaps are not replaced with current values.</p>
      </div>
    </details>
  );
}
