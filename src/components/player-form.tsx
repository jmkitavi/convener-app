"use client";

import { useTransition } from "react";
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

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await onSubmit(formData);
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="space-y-2">
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
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Saving..." : submitLabel}
      </Button>
    </form>
  );
}
