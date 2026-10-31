"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, Pencil, Plus, Trash2 } from "lucide-react";
import { useReportView } from "@/components/reports/report-provider";

export function ClubForm({
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
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        setError(""); setSaved(false);
        startTransition(async () => {
          try {
            await action(formData);
            if (!defaultValues?.id) formRef.current?.reset();
            setSaved(true);
          } catch { setError("The club could not be saved. Your entries are still here; please retry."); }
        });
      }}
      aria-busy={pending}
      className="grid min-w-0 gap-4"
    >
      {defaultValues?.id && (
        <input type="hidden" name="id" value={defaultValues.id} />
      )}
      <div className="grid gap-2">
        <Label htmlFor="name">Club Name</Label>
        <Input
          id="name"
          name="name"
          placeholder="e.g. Royal Dublin"
          required
          defaultValue={defaultValues?.name ?? ""}
        />
      </div>
      <p className="desk-note">Course details are optional. Leave unknown values blank.</p>
      <div className="desk-form-grid [&>div]:min-w-0">
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
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {saved && <p role="status" className="text-sm text-emerald-700">Club saved.</p>}
      <DialogFooter>
        <Button type="submit" disabled={pending}>{pending ? "Saving club…" : submitLabel}</Button>
      </DialogFooter>
    </form>
  );
}

type DirectoryClub = {
  id: number;
  name: string;
  par: number | null;
  slopeRating: number | null;
  courseRating: number | null;
  fixtureCount: number;
};

export function ClubsDirectory({ clubs, createClub, updateClub, deleteClub }: {
  clubs: DirectoryClub[];
  createClub: (data: FormData) => Promise<void>;
  updateClub: (data: FormData) => Promise<void>;
  deleteClub: (data: FormData) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  useReportView({filters:{search:query}});
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<DirectoryClub | null>(null);
  const [deleting, setDeleting] = useState<DirectoryClub | null>(null);
  const [pending, startTransition] = useTransition();
  const [deleteError, setDeleteError] = useState("");
  const filtered = clubs.filter((club) => club.name.toLowerCase().includes(query.toLowerCase()));
  const complete = clubs.filter((club) => club.par !== null && club.slopeRating !== null && club.courseRating !== null).length;

  return <div className="page-shell screen-desk">
    <PageHeader eyebrow="The league / Clubs" title="Know the opposition." description="A tidy address book for the clubs on your fixture schedule."
      actions={<Button onClick={() => setAdding(true)}><Plus />Add club</Button>} />
    <div className="desk-two-column">
      <section className="desk-panel">
        <div className="desk-panel-header"><div><h2 className="font-semibold">Opponent clubs</h2><p className="text-sm text-muted-foreground">Club records and course information, ready for your next fixture.</p></div></div>
        <div className="desk-toolbar"><div className="w-full space-y-1.5 sm:max-w-sm"><Label htmlFor="club-search">Find a club</Label><Input id="club-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search clubs…" /></div><p role="status" className="text-xs text-muted-foreground">{filtered.length} of {clubs.length} clubs</p></div>
        <Table>
          <TableHeader><TableRow><TableHead>Club</TableHead><TableHead>Par / slope</TableHead><TableHead>Rating</TableHead><TableHead>Fixtures</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>{filtered.length ? filtered.map((club) => <TableRow key={club.id}>
            <TableCell><div className="flex items-center gap-3"><span className="desk-avatar" aria-hidden="true"><Building2 className="size-4" /></span><span className="font-medium">{club.name}</span></div></TableCell>
            <TableCell>{club.par ?? "—"} / {club.slopeRating ?? "—"}</TableCell><TableCell>{club.courseRating ?? "—"}</TableCell><TableCell>{club.fixtureCount}</TableCell>
            <TableCell><div className="flex justify-end gap-1"><Button variant="outline" size="sm" onClick={() => setEditing(club)} aria-label={`Manage ${club.name}`}><Pencil />Manage</Button><Button variant="ghost" size="icon-sm" onClick={() => { setDeleting(club); setDeleteError(""); }} aria-label={`Delete ${club.name}`}><Trash2 /></Button></div></TableCell>
          </TableRow>) : <TableRow><TableCell colSpan={5} className="py-12 text-center text-muted-foreground">{query ? "No clubs match your search." : "No clubs yet. Add your first opponent club to get started."}</TableCell></TableRow>}</TableBody>
        </Table>
        <div className="desk-panel-footer">Course details are optional. A dash means the value has not been recorded.</div>
      </section>
      <aside className="desk-panel self-start">
        <div className="desk-panel-header"><div><h2 className="font-semibold">Your club directory</h2><p className="text-sm text-muted-foreground">The records behind your schedule.</p></div></div>
        <span className="desk-avatar mb-4" aria-hidden="true"><Building2 className="size-5" /></span>
        <dl className="space-y-4 text-sm">
          {[
            ["Opponent clubs", clubs.length],
            ["Linked fixtures", clubs.reduce((total, club) => total + club.fixtureCount, 0)],
            ["Complete course details", complete],
            ["Missing course details", clubs.length - complete],
          ].map(([label, value]) => <div key={label} className="flex items-center justify-between gap-3 border-b pb-3"><dt className="text-muted-foreground">{label}</dt><dd className="font-semibold">{value}</dd></div>)}
        </dl>
        <div className="desk-note mt-5">Fixture venue overrides remain available for matches played elsewhere. Club records do not store locations or a home-club profile.</div>
      </aside>
    </div>
    <Dialog open={adding || editing !== null} onOpenChange={(open) => { if (!open) { setAdding(false); setEditing(null); } }}>
      <DialogContent><DialogHeader><DialogTitle>{editing ? "Edit club" : "Add club"}</DialogTitle><DialogDescription>{editing ? `Update ${editing.name}'s course details.` : "Add an opponent club to your directory."}</DialogDescription></DialogHeader>
        <ClubForm key={editing?.id ?? "new"} defaultValues={editing ?? undefined} action={async (data) => { await (editing ? updateClub(data) : createClub(data)); setAdding(false); setEditing(null); }} submitLabel={editing ? "Save changes" : "Add club"} />
      </DialogContent>
    </Dialog>
    <Dialog open={deleting !== null} onOpenChange={(open) => { if (!open && !pending) setDeleting(null); }}>
      <DialogContent><DialogHeader><DialogTitle>Delete club?</DialogTitle><DialogDescription>{deleting?.name} will be removed from your directory. Clubs referenced by fixtures or saved lineups cannot be deleted.</DialogDescription></DialogHeader>
        {deleteError && <p role="alert" className="text-sm text-destructive">{deleteError}</p>}
        <DialogFooter><Button variant="outline" disabled={pending} onClick={() => setDeleting(null)}>Cancel</Button><Button variant="destructive" disabled={pending} onClick={() => {
          if (!deleting) return;
          const data = new FormData(); data.set("id", String(deleting.id));
          startTransition(async () => { try { await deleteClub(data); setDeleting(null); } catch { setDeleteError("The club could not be deleted. Remove its fixture or lineup references first, or retry."); } });
        }}>{pending ? "Deleting…" : "Delete club"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
