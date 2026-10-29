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
  const formRef = useRef<HTMLFormElement>(null);
  const [clubId, setClubId] = useState<string | null>(
    defaultValues?.opponentClubId?.toString() ?? null,
  );
  const [homeAway, setHomeAway] = useState<string | null>(
    defaultValues?.homeAway ?? "home",
  );

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        if (clubId) formData.set("opponentClubId", clubId);
        if (homeAway) formData.set("homeAway", homeAway);
        await action(formData);
      }}
      className="grid gap-4"
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
        <Label>Opponent Club</Label>
        <Select value={clubId} onValueChange={setClubId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a club" />
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
        <Label>Home / Away</Label>
        <Select value={homeAway} onValueChange={setHomeAway}>
          <SelectTrigger className="w-full">
            <SelectValue />
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
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="teamName">Our team (optional)</Label>
          <Input id="teamName" name="teamName" defaultValue={defaultValues?.teamName ?? ""} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="opponentTeamName">Opponent team (optional)</Label>
          <Input id="opponentTeamName" name="opponentTeamName" defaultValue={defaultValues?.opponentTeamName ?? ""} />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          placeholder="Optional notes..."
          defaultValue={defaultValues?.notes ?? ""}
        />
      </div>

      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
