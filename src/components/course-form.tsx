"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogFooter } from "@/components/ui/dialog";

export function CourseForm({
  action,
  defaultValues,
  submitLabel = "Save",
}: {
  action: (formData: FormData) => Promise<void>;
  defaultValues?: {
    id?: number;
    name?: string;
    par?: number | null;
    slopeRating?: number | null;
    courseRating?: number | null;
  };
  submitLabel?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await action(formData);
        formRef.current?.reset();
      }}
      className="grid gap-4"
    >
      {defaultValues?.id && (
        <input type="hidden" name="id" value={defaultValues.id} />
      )}
      <div className="grid gap-2">
        <Label htmlFor="name">Course Name</Label>
        <Input
          id="name"
          name="name"
          placeholder="e.g. Portmarnock Links"
          required
          defaultValue={defaultValues?.name ?? ""}
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="par">Par</Label>
          <Input
            id="par"
            name="par"
            type="number"
            placeholder="72"
            defaultValue={defaultValues?.par ?? ""}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="slopeRating">Slope</Label>
          <Input
            id="slopeRating"
            name="slopeRating"
            type="number"
            step="any"
            placeholder="125"
            defaultValue={defaultValues?.slopeRating ?? ""}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="courseRating">Rating</Label>
          <Input
            id="courseRating"
            name="courseRating"
            type="number"
            step="any"
            placeholder="72.5"
            defaultValue={defaultValues?.courseRating ?? ""}
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="submit">{submitLabel}</Button>
      </DialogFooter>
    </form>
  );
}
