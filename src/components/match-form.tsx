"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { PlayerCombobox } from "@/components/player-combobox";

interface Player {
  id: number;
  name: string;
  defaultHandicap: number;
}

export function MatchForm({
  players,
  fixtureId,
  action,
  matchId,
  defaultValues,
  submitLabel = "Add Match",
  isInternalMatch = false,
}: {
  players: Player[];
  fixtureId: number;
  action: (formData: FormData) => Promise<void>;
  matchId?: number;
  defaultValues?: {
    player1Id?: number;
    player2Id?: number;
    player1Handicap?: number | null;
    player2Handicap?: number | null;
    opponent1Name?: string;
    opponent2Name?: string;
    opponent1Handicap?: number | null;
    opponent2Handicap?: number | null;
    opponent1Id?: number | null;
    opponent2Id?: number | null;
    result?: string;
    margin?: string;
    matchOrder?: number;
    notes?: string;
  };
  submitLabel?: string;
  isInternalMatch?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const defaultP1 = defaultValues?.player1Id
    ? players.find((p) => p.id === defaultValues.player1Id)
    : undefined;
  const defaultP2 = defaultValues?.player2Id
    ? players.find((p) => p.id === defaultValues.player2Id)
    : undefined;

  const [player1Id, setPlayer1Id] = useState<number | null>(
    defaultValues?.player1Id ?? null,
  );
  const [player1Display, setPlayer1Display] = useState(
    defaultP1?.name ?? "",
  );
  const [player2Id, setPlayer2Id] = useState<number | null>(
    defaultValues?.player2Id ?? null,
  );
  const [player2Display, setPlayer2Display] = useState(
    defaultP2?.name ?? "",
  );
  const [player1Handicap, setPlayer1Handicap] = useState(
    defaultValues?.player1Handicap?.toString() ?? "",
  );
  const [player2Handicap, setPlayer2Handicap] = useState(
    defaultValues?.player2Handicap?.toString() ?? "",
  );

  const [opponent1Name, setOpponent1Name] = useState(
    defaultValues?.opponent1Name ?? "",
  );
  const [opponent1Id, setOpponent1Id] = useState<number | null>(
    defaultValues?.opponent1Id ?? null,
  );
  const [opponent1Handicap, setOpponent1Handicap] = useState(
    defaultValues?.opponent1Handicap?.toString() ?? "",
  );
  const [opponent2Name, setOpponent2Name] = useState(
    defaultValues?.opponent2Name ?? "",
  );
  const [opponent2Id, setOpponent2Id] = useState<number | null>(
    defaultValues?.opponent2Id ?? null,
  );
  const [opponent2Handicap, setOpponent2Handicap] = useState(
    defaultValues?.opponent2Handicap?.toString() ?? "",
  );

  const [result, setResult] = useState<string | null>(
    defaultValues?.result ?? null,
  );
  const selectedP1 = players.find((player) => player.id === player1Id);
  const selectedP2 = players.find((player) => player.id === player2Id);
  const selectedO1 = players.find((player) => player.id === opponent1Id);
  const selectedO2 = players.find((player) => player.id === opponent2Id);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        setError("");
        if (!player1Id || !player2Id || !result) {
          setError("Select both players and an explicit result, including Pending if it is not yet known.");
          return;
        }
        formData.set("fixtureId", fixtureId.toString());
        if (matchId) formData.set("matchId", matchId.toString());
        if (player1Id) formData.set("player1Id", player1Id.toString());
        if (player2Id) formData.set("player2Id", player2Id.toString());
        formData.set("player1Handicap", player1Handicap);
        formData.set("player2Handicap", player2Handicap);
        formData.set("opponent1Name", opponent1Name);
        formData.set("opponent2Name", opponent2Name);
        formData.set("opponent1Handicap", opponent1Handicap);
        formData.set("opponent2Handicap", opponent2Handicap);
        if (opponent1Id) formData.set("opponent1Id", opponent1Id.toString());
        if (opponent2Id) formData.set("opponent2Id", opponent2Id.toString());
        if (result) formData.set("result", result);
        startTransition(async () => {
          try { await action(formData); }
          catch (error) {
            unstable_rethrow(error);
            setError("The match could not be saved. Your entries are still here; please retry.");
          }
        });
      }}
      aria-busy={pending}
      className="grid min-w-0 gap-4 [&>div]:min-w-0"
    >
      <p className="text-sm font-semibold">Our pairing</p>
      <p className="desk-note text-xs">
        Leave unknown handicaps blank. Current player defaults are suggestions only; apply them explicitly if they match this result.
      </p>
      <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-3">
        <div className="grid gap-2">
          <Label htmlFor="matchPlayer1">Player 1</Label>
          <PlayerCombobox
            id="matchPlayer1"
            players={players}
            value={player1Display}
            onChange={(val, player) => {
              setPlayer1Display(val);
              if (player) {
                if (player.id !== player1Id) setPlayer1Handicap("");
                setPlayer1Id(player.id);
              } else {
                setPlayer1Id(null);
              }
            }}
            placeholder="Search player..."
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="player1Handicap">Hcp</Label>
          <Input
            id="player1Handicap"
            type="number"
            step="0.1"
            min="-8"
            max="54"
            value={player1Handicap}
            onChange={(e) => setPlayer1Handicap(e.target.value)}
            placeholder="Unknown"
          />
          {selectedP1 && (
            <button type="button" className="text-xs text-primary underline" onClick={() => setPlayer1Handicap(selectedP1.defaultHandicap.toString())}>
              Use default ({selectedP1.defaultHandicap})
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-3">
        <div className="grid gap-2">
          <Label htmlFor="matchPlayer2">Player 2</Label>
          <PlayerCombobox
            id="matchPlayer2"
            players={players}
            value={player2Display}
            onChange={(val, player) => {
              setPlayer2Display(val);
              if (player) {
                if (player.id !== player2Id) setPlayer2Handicap("");
                setPlayer2Id(player.id);
              } else {
                setPlayer2Id(null);
              }
            }}
            placeholder="Search player..."
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="player2Handicap">Hcp</Label>
          <Input
            id="player2Handicap"
            type="number"
            step="0.1"
            min="-8"
            max="54"
            value={player2Handicap}
            onChange={(e) => setPlayer2Handicap(e.target.value)}
            placeholder="Unknown"
          />
          {selectedP2 && (
            <button type="button" className="text-xs text-primary underline" onClick={() => setPlayer2Handicap(selectedP2.defaultHandicap.toString())}>
              Use default ({selectedP2.defaultHandicap})
            </button>
          )}
        </div>
      </div>

      <Separator />
      <p className="text-sm font-semibold">Opponent pairing</p>

      <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-3">
        <div className="grid gap-2">
          <Label htmlFor="matchOpponent1">Opponent 1</Label>
          {isInternalMatch ? (
            <PlayerCombobox
              id="matchOpponent1"
              players={players}
              value={opponent1Name}
              onChange={(val, player) => {
                setOpponent1Name(val);
                if (player) {
                  if (player.id !== opponent1Id) setOpponent1Handicap("");
                  setOpponent1Id(player.id);
                } else {
                  setOpponent1Id(null);
                }
              }}
              placeholder="Search player..."
            />
          ) : (
            <Input
              id="matchOpponent1"
              value={opponent1Name}
              onChange={(e) => setOpponent1Name(e.target.value)}
              placeholder="Opponent name"
              required
            />
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="opponent1Handicap">Hcp</Label>
          <Input
            id="opponent1Handicap"
            type="number"
            step="0.1"
            min="-8"
            max="54"
            value={opponent1Handicap}
            onChange={(e) => setOpponent1Handicap(e.target.value)}
            placeholder="Unknown"
          />
          {selectedO1 && (
            <button type="button" className="text-xs text-primary underline" onClick={() => setOpponent1Handicap(selectedO1.defaultHandicap.toString())}>
              Use default ({selectedO1.defaultHandicap})
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-3">
        <div className="grid gap-2">
          <Label htmlFor="matchOpponent2">Opponent 2</Label>
          {isInternalMatch ? (
            <PlayerCombobox
              id="matchOpponent2"
              players={players}
              value={opponent2Name}
              onChange={(val, player) => {
                setOpponent2Name(val);
                if (player) {
                  if (player.id !== opponent2Id) setOpponent2Handicap("");
                  setOpponent2Id(player.id);
                } else {
                  setOpponent2Id(null);
                }
              }}
              placeholder="Search player..."
            />
          ) : (
            <Input
              id="matchOpponent2"
              value={opponent2Name}
              onChange={(e) => setOpponent2Name(e.target.value)}
              placeholder="Opponent name"
              required
            />
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="opponent2Handicap">Hcp</Label>
          <Input
            id="opponent2Handicap"
            type="number"
            step="0.1"
            min="-8"
            max="54"
            value={opponent2Handicap}
            onChange={(e) => setOpponent2Handicap(e.target.value)}
            placeholder="Unknown"
          />
          {selectedO2 && (
            <button type="button" className="text-xs text-primary underline" onClick={() => setOpponent2Handicap(selectedO2.defaultHandicap.toString())}>
              Use default ({selectedO2.defaultHandicap})
            </button>
          )}
        </div>
      </div>

      <Separator />
      <p className="text-sm font-semibold">Result from our team&apos;s perspective</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="matchResult">Result</Label>
          <Select value={result} onValueChange={setResult}>
            <SelectTrigger id="matchResult" className="w-full">
              <SelectValue placeholder="Select result">{result === "win" ? "Win" : result === "loss" ? "Loss" : result === "halved" ? "Halved" : result === "pending" ? "Pending" : undefined}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="win">Win</SelectItem>
              <SelectItem value="loss">Loss</SelectItem>
              <SelectItem value="halved">Halved</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label htmlFor="margin">Margin</Label>
            <Input
              id="margin"
              name="margin"
              placeholder="e.g. 3&2"
              defaultValue={defaultValues?.margin ?? ""}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="matchOrder">Foursome #</Label>
            <Input
              id="matchOrder"
              name="matchOrder"
              type="number"
              placeholder="e.g. 1, 2, 3..."
              defaultValue={defaultValues?.matchOrder ?? ""}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="matchNotes">Notes</Label>
        <Textarea
          id="matchNotes"
          name="notes"
          placeholder="Optional notes..."
          defaultValue={defaultValues?.notes ?? ""}
        />
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end border-t pt-4"><Button type="submit" disabled={pending}>{pending ? "Saving match…" : submitLabel}</Button></div>
    </form>
  );
}
