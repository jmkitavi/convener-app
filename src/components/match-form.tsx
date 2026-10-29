"use client";

import { useRef, useState } from "react";
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
  const formRef = useRef<HTMLFormElement>(null);

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
      ref={formRef}
      action={async (formData) => {
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
        await action(formData);
        formRef.current?.reset();
      }}
      className="grid gap-4"
    >
      <p className="text-sm font-medium">Our Pair</p>
      <p className="text-xs text-muted-foreground">
        Leave unknown handicaps blank. Current player defaults are suggestions only; apply them explicitly if they match this result.
      </p>
      <div className="grid grid-cols-[1fr_5rem] gap-3">
        <div className="grid gap-2">
          <Label>Player 1</Label>
          <PlayerCombobox
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

      <div className="grid grid-cols-[1fr_5rem] gap-3">
        <div className="grid gap-2">
          <Label>Player 2</Label>
          <PlayerCombobox
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
      <p className="text-sm font-medium">Opponents</p>

      <div className="grid grid-cols-[1fr_5rem] gap-3">
        <div className="grid gap-2">
          <Label>Opponent 1</Label>
          {isInternalMatch ? (
            <PlayerCombobox
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

      <div className="grid grid-cols-[1fr_5rem] gap-3">
        <div className="grid gap-2">
          <Label>Opponent 2</Label>
          {isInternalMatch ? (
            <PlayerCombobox
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
      <p className="text-sm font-medium">Result</p>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label>Result</Label>
          <Select value={result} onValueChange={setResult}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select result" />
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

      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
