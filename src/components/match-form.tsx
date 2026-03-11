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

interface Player {
  id: number;
  name: string;
  defaultHandicap: number;
}

export function MatchForm({
  players,
  fixtureId,
  action,
  defaultValues,
  submitLabel = "Add Match",
}: {
  players: Player[];
  fixtureId: number;
  action: (formData: FormData) => Promise<void>;
  defaultValues?: {
    player1Id?: number;
    player2Id?: number;
    player1Handicap?: number;
    player2Handicap?: number;
    opponent1Name?: string;
    opponent2Name?: string;
    opponent1Handicap?: number;
    opponent2Handicap?: number;
    result?: string;
    margin?: string;
    notes?: string;
  };
  submitLabel?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  const [player1Id, setPlayer1Id] = useState<string | null>(
    defaultValues?.player1Id?.toString() ?? null,
  );
  const [player2Id, setPlayer2Id] = useState<string | null>(
    defaultValues?.player2Id?.toString() ?? null,
  );
  const [player1Handicap, setPlayer1Handicap] = useState(
    defaultValues?.player1Handicap?.toString() ?? "",
  );
  const [player2Handicap, setPlayer2Handicap] = useState(
    defaultValues?.player2Handicap?.toString() ?? "",
  );
  const [result, setResult] = useState<string | null>(
    defaultValues?.result ?? null,
  );

  function handlePlayer1Change(id: string | null) {
    setPlayer1Id(id);
    if (!id) return;
    const player = players.find((p) => p.id.toString() === id);
    if (player) setPlayer1Handicap(player.defaultHandicap.toString());
  }

  function handlePlayer2Change(id: string | null) {
    setPlayer2Id(id);
    if (!id) return;
    const player = players.find((p) => p.id.toString() === id);
    if (player) setPlayer2Handicap(player.defaultHandicap.toString());
  }

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        formData.set("fixtureId", fixtureId.toString());
        if (player1Id) formData.set("player1Id", player1Id);
        if (player2Id) formData.set("player2Id", player2Id);
        formData.set("player1Handicap", player1Handicap);
        formData.set("player2Handicap", player2Handicap);
        if (result) formData.set("result", result);
        await action(formData);
        formRef.current?.reset();
      }}
      className="grid gap-4"
    >
      <p className="text-sm font-medium">Our Pair</p>
      <div className="grid grid-cols-[1fr_5rem] gap-3">
        <div className="grid gap-2">
          <Label>Player 1</Label>
          <Select value={player1Id} onValueChange={handlePlayer1Change}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select player" />
            </SelectTrigger>
            <SelectContent>
              {players.map((p) => (
                <SelectItem key={p.id} value={p.id.toString()}>
                  {p.name} ({p.defaultHandicap})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="player1Handicap">Hcp</Label>
          <Input
            id="player1Handicap"
            type="number"
            step="0.1"
            value={player1Handicap}
            onChange={(e) => setPlayer1Handicap(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-[1fr_5rem] gap-3">
        <div className="grid gap-2">
          <Label>Player 2</Label>
          <Select value={player2Id} onValueChange={handlePlayer2Change}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select player" />
            </SelectTrigger>
            <SelectContent>
              {players.map((p) => (
                <SelectItem key={p.id} value={p.id.toString()}>
                  {p.name} ({p.defaultHandicap})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="player2Handicap">Hcp</Label>
          <Input
            id="player2Handicap"
            type="number"
            step="0.1"
            value={player2Handicap}
            onChange={(e) => setPlayer2Handicap(e.target.value)}
            required
          />
        </div>
      </div>

      <Separator />
      <p className="text-sm font-medium">Opponents</p>

      <div className="grid grid-cols-[1fr_5rem] gap-3">
        <div className="grid gap-2">
          <Label htmlFor="opponent1Name">Opponent 1</Label>
          <Input
            id="opponent1Name"
            name="opponent1Name"
            placeholder="Name"
            required
            defaultValue={defaultValues?.opponent1Name ?? ""}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="opponent1Handicap">Hcp</Label>
          <Input
            id="opponent1Handicap"
            name="opponent1Handicap"
            type="number"
            step="0.1"
            required
            defaultValue={defaultValues?.opponent1Handicap ?? ""}
          />
        </div>
      </div>

      <div className="grid grid-cols-[1fr_5rem] gap-3">
        <div className="grid gap-2">
          <Label htmlFor="opponent2Name">Opponent 2</Label>
          <Input
            id="opponent2Name"
            name="opponent2Name"
            placeholder="Name"
            required
            defaultValue={defaultValues?.opponent2Name ?? ""}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="opponent2Handicap">Hcp</Label>
          <Input
            id="opponent2Handicap"
            name="opponent2Handicap"
            type="number"
            step="0.1"
            required
            defaultValue={defaultValues?.opponent2Handicap ?? ""}
          />
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
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="margin">Margin</Label>
          <Input
            id="margin"
            name="margin"
            placeholder="e.g. 3&2"
            defaultValue={defaultValues?.margin ?? ""}
          />
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
