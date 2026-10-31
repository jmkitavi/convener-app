"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface PlayerFormProps {
  defaultValues?: {
    name: string;
    email: string | null;
    phone: string | null;
    defaultHandicap: number;
  };
  onSubmit: (formData: FormData) => Promise<void>;
  submitLabel?: string;
}

export function PlayerForm({
  defaultValues,
  onSubmit,
  submitLabel = "Save",
}: PlayerFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleSubmit(formData: FormData) {
    setError("");
    startTransition(async () => {
      try { await onSubmit(formData); }
      catch { setError("The player could not be saved. Your entries are still here; please retry."); }
    });
  }

  return (
    <form onSubmit={(event) => {
      event.preventDefault();
      handleSubmit(new FormData(event.currentTarget));
    }} aria-busy={isPending} className="min-w-0 space-y-4">
      <div className="desk-form-grid">
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          name="name"
          required
          defaultValue={defaultValues?.name ?? ""}
          placeholder="Player name"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          defaultValue={defaultValues?.email ?? ""}
          placeholder="email@example.com"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={defaultValues?.phone ?? ""}
          placeholder="Phone number"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="defaultHandicap">Handicap *</Label>
        <Input
          id="defaultHandicap"
          name="defaultHandicap"
          type="number"
          required
          step="0.1"
          min="-8"
          max="54"
          defaultValue={defaultValues?.defaultHandicap ?? 18}
        />
      </div>
      </div>
      <p className="desk-note">This is the player&apos;s current default handicap. Editing it does not replace unknown historical match handicaps. Active status is managed separately on the roster or profile.</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Saving..." : submitLabel}
      </Button>
    </form>
  );
}

export function PlayerStatusForm({ id, active, action }: {
  id: number;
  active: boolean;
  action: (formData: FormData) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  return <form onSubmit={(event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError("");
    startTransition(async () => {
      try { await action(data); }
      catch { setError("Status was not changed. Please retry."); }
    });
  }} className="space-y-1">
    <input type="hidden" name="id" value={id} />
    <input type="hidden" name="active" value={String(active)} />
    <Button type="submit" variant="ghost" size="sm" disabled={pending}
      className="desk-status" data-tone={active ? "home" : "neutral"}
      title={`Mark player ${active ? "inactive" : "active"}`}
      aria-label={`${active ? "Active" : "Inactive"} player; mark ${active ? "inactive" : "active"}`}>
      {pending ? "Updating…" : active ? "Active" : "Inactive"}
    </Button>
    {error && <p role="alert" className="max-w-48 whitespace-normal text-xs text-destructive">{error}</p>}
  </form>;
}
