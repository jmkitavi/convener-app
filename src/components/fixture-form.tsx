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

interface Club {
  id: number;
  name: string;
}

export function FixtureForm({
  clubs,
  action,
  defaultValues,
  submitLabel = "Create Fixture",
}: {
  clubs: Club[];
  action: (formData: FormData) => Promise<void>;
  defaultValues?: {
    date?: string;
    opponentClubId?: number;
    homeAway?: string;
    notes?: string;
    venueName?: string | null;
    teamName?: string | null;
    opponentTeamName?: string | null;
  };
  submitLabel?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [clubId, setClubId] = useState<string | null>(
    defaultValues?.opponentClubId?.toString() ?? null,
  );
  const [homeAway, setHomeAway] = useState<string | null>(
    defaultValues?.homeAway ?? "home",
  );

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        setError("");
        if (!clubId) {
          setError("Select an opponent club before saving.");
          return;
        }
        if (clubId) formData.set("opponentClubId", clubId);
        if (homeAway) formData.set("homeAway", homeAway);
        startTransition(async () => {
          try { await action(formData); }
          catch (error) {
            unstable_rethrow(error);
            setError("The fixture could not be saved. Your entries are still here; please retry.");
          }
        });
      }}
      aria-busy={pending}
      className="desk-form-grid grid min-w-0 gap-4 sm:grid-cols-2"
    >
      <div className="grid gap-2">
        <Label htmlFor="date">Date</Label>
        <Input
          id="date"
          name="date"
          type="date"
          required
          defaultValue={defaultValues?.date ?? ""}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="opponentClubId">Opponent Club</Label>
        <Select value={clubId} onValueChange={setClubId}>
          <SelectTrigger id="opponentClubId" className="w-full min-w-0">
            <SelectValue placeholder="Select a club">{clubs.find((club) => club.id.toString() === clubId)?.name}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {clubs.map((club) => (
              <SelectItem key={club.id} value={club.id.toString()}>
                {club.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="homeAway">Home / Away</Label>
        <Select value={homeAway} onValueChange={setHomeAway}>
          <SelectTrigger id="homeAway" className="w-full">
            <SelectValue>{homeAway === "home" ? "Home" : homeAway === "away" ? "Away" : "Neutral"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="home">Home</SelectItem>
            <SelectItem value="away">Away</SelectItem>
            <SelectItem value="neutral">Neutral</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          When venue is blank: Home → Kenya Air Force Golf Club, Away/Neutral → opponent&apos;s club.
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="venueName">Venue (optional)</Label>
        <Input id="venueName" name="venueName" defaultValue={defaultValues?.venueName ?? ""} placeholder="Independent course or venue" />
      </div>
      <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="teamName">Our team (optional)</Label>
          <Input id="teamName" name="teamName" defaultValue={defaultValues?.teamName ?? ""} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="opponentTeamName">Opponent team (optional)</Label>
          <Input id="opponentTeamName" name="opponentTeamName" defaultValue={defaultValues?.opponentTeamName ?? ""} />
        </div>
      </div>

      <div className="grid gap-2 sm:col-span-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          placeholder="Meeting point, travel arrangements, or selection notes…"
          defaultValue={defaultValues?.notes ?? ""}
        />
      </div>

      {clubs.length === 0 && <p className="desk-note desk-note-amber sm:col-span-2">Add an opponent club on the Clubs page before creating a fixture.</p>}
      {error && <p role="alert" className="text-sm text-destructive sm:col-span-2">{error}</p>}
      <div className="flex justify-end border-t pt-4 sm:col-span-2"><Button type="submit" disabled={pending || clubs.length === 0}>{pending ? "Saving fixture…" : submitLabel}</Button></div>
    </form>
  );
}
