"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, FileUp, LoaderCircle } from "lucide-react";
import type {
  DraftData, ExistingMatch, Extraction, FixtureOption, Person, PlayerOption, Preview, Review, ReviewRow, Side,
} from "@/lib/results-import/contracts";
import { findDuplicatePlayerAssignments, normalizeResult, resolvePersonIdentity, resolvePlayer, resolveReviewIdentities, rowConfirmationIssues, type DuplicatePlayerAssignment, type DuplicatePlayerOccurrence } from "@/lib/results-import/normalize";
import { chooseFixture, restoreDraftReview } from "@/app/fixtures/import/restore-review";

type Options = { configured: boolean; players: PlayerOption[]; clubs: { id: number; name: string }[]; fixtures: FixtureOption[] };
type Loaded = { id: string; status: string; data: DraftData; expiresAt: string; repeated: boolean; existingMatches: ExistingMatch[]; result?: { fixtureId: number } };
const selectClass = "h-10 w-full min-w-0 max-w-full truncate rounded-lg border border-input bg-card px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60";
const labelClass = "grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1.5 text-sm font-medium";
const base = "/api/results-imports";

function duplicateLocationLabel(location: DuplicatePlayerOccurrence) {
  return `Row ${location.rowIndex + 1}${location.order !== null ? ` (foursome ${location.order})` : ""}, ${location.group === "players" ? "our player" : "opponent"} ${location.personIndex + 1}`;
}

function personEditorId(location: Pick<DuplicatePlayerOccurrence, "rowIndex" | "group" | "personIndex">) {
  return `import-person-${location.rowIndex}-${location.group}-${location.personIndex}`;
}

async function request<T>(url: string, method = "GET", data?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    ...(data instanceof FormData ? { body: data } : data !== undefined ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) } : {}),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Request failed.");
  return result;
}

export function ResultsImport() {
  const params = useSearchParams();
  const [options, setOptions] = useState<Options | null>(null);
  const [draft, setDraft] = useState<Loaded | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [approvals, setApprovals] = useState<string[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadFixtureId, setUploadFixtureId] = useState(params.get("fixtureId") ?? "");
  const reviewRef = useRef(review);
  reviewRef.current = review;

  useEffect(() => {
    let active = true;
    request<Options>(base).then(async (loadedOptions) => {
      if (!active) return;
      setOptions(loadedOptions);
      const id = params.get("import");
      if (!id) return;
      const loaded = await request<Loaded>(`${base}/${id}`);
      if (!active) return;
      setDraft(loaded);
      const fixture = loadedOptions.fixtures.find((fixture) => fixture.id === Number(params.get("fixtureId")));
      setReview(restoreDraftReview(loaded.data, loadedOptions.players, fixture));
      setPreview(loaded.data.preview ?? null);
      if (loaded.data.preview) setConfirmed(true);
    }).catch((e) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [params]);

  async function perform(label: string, action: () => Promise<void>) {
    setBusy(label); setError(""); setNotice("");
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : "Import failed."); }
    finally { setBusy(""); }
  }

  async function load(id: string) {
    const loaded = await request<Loaded>(`${base}/${id}`);
    setDraft(loaded);
    if (options) {
      const fixture = options.fixtures.find((f) => f.id === Number(uploadFixtureId));
      setReview(restoreDraftReview(loaded.data, options.players, fixture));
    }
    setPreview(loaded.data.preview ?? null);
  }

  // Persist bounded drafts without storing document/player data in browser storage.
  useEffect(() => {
    if (!draft || draft.status !== "ready" || !review || preview || busy) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      setSaved(false);
      fetch(`${base}/${draft.id}/draft`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(review), signal: controller.signal,
      }).then((response) => {
        if (!response.ok) throw new Error("Draft could not be saved.");
        setSaved(true);
      }).catch((e) => {
        if (e.name !== "AbortError") setNotice("Draft autosave failed. Keep this page open and retry.");
      });
    }, 750);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [review, draft, preview, busy]);

  function changeReview(next: Review) { setReview(next); setConfirmed(false); setSaved(false); setError(""); }
  function changeRow(index: number, patch: Partial<ReviewRow>) {
    if (!review) return;
    setError("");
    setReview({ ...review, rows: review.rows.map((row, i) => i === index ? { ...row, ...patch, reviewed: patch.reviewed ?? false } : row) });
  }

  function jumpToDuplicate(location: DuplicatePlayerOccurrence) {
    if (!review) return;
    setPage(review.rows[location.rowIndex].page);
    const editor = document.getElementById(personEditorId(location));
    const control = editor?.querySelector<HTMLSelectElement | HTMLInputElement>("select") ?? editor?.querySelector<HTMLInputElement>("input");
    control?.scrollIntoView({ behavior: "smooth", block: "end" });
    control?.focus({ preventScroll: true });
  }

  async function extract(id: string) {
    try { await request(`${base}/${id}/extract`, "POST", { consent: true }); }
    finally { await load(id); }
  }

  async function upload() {
    if (!file || !consent) return;
    const form = new FormData(); form.set("file", file);
    const uploaded = await request<{ id: string; repeated: boolean }>(base, "POST", form);
    const url = new URL(window.location.href);
    url.searchParams.set("import", uploaded.id);
    if (uploadFixtureId) url.searchParams.set("fixtureId", uploadFixtureId);
    else url.searchParams.delete("fixtureId");
    window.history.replaceState(null, "", url);
    await load(uploaded.id);
    await extract(uploaded.id);
  }

  function changeSide(side: Side) {
    if (!review || side === review.side) return;
    changeReview(resolveReviewIdentities({
      ...review, side, teamName: review.opponentTeamName, opponentTeamName: review.teamName,
      rows: review.rows.map((row) => ({
        ...row, players: row.opponents, opponents: review.internal ? row.players : row.players.map((p) => ({ ...p, id: null, create: false })) as [Person, Person], reviewed: false, matchId: null,
        result: row.result === "win" ? "loss" : row.result === "loss" ? "win" : row.result,
      })),
    }, options?.players ?? []));
  }

  const duplicatePlayers = review ? findDuplicatePlayerAssignments(review) : [];

  if (draft?.status === "committed") return <div className="page-shell screen-desk import-workspace"><section className="desk-panel p-6"><CheckCircle2 className="size-8 text-primary" aria-hidden="true" /><h1 className="page-title">Results saved</h1><p className="mb-4 text-muted-foreground">The uploaded source has been discarded.</p><Button render={<Link href={draft.result?.fixtureId ? `/fixtures/${draft.result.fixtureId}` : "/fixtures"} />}>{draft.result?.fixtureId ? "Open fixture" : "Back to fixtures"}</Button></section></div>;

  return <div className="page-shell screen-desk import-workspace">
    <PageHeader title={preview ? "Everything in its right place." : review ? "A second look, before the save." : "From scorecard to season record."} eyebrow="Results / Import"
      description={preview ? "A final check of what this import will add or update. Only approved changes will be saved." : review ? "Check every pairing, resolve names and confirm the source before previewing." : "Read a PDF or photo, review every row, then save. Nothing is written to matches until you confirm."}
      actions={<Button variant="outline" render={<Link href="/fixtures" />}>Back to fixtures</Button>}
    />
    <ol className="desk-stepper" aria-label="Import progress">
      <li className="desk-step" aria-current={!review ? "step" : undefined}><span className="desk-step-number">{review ? "✓" : "1"}</span><span>Upload source</span></li>
      <li className="desk-step" aria-current={review && !preview ? "step" : undefined}><span className="desk-step-number">{preview ? "✓" : "2"}</span><span>Review every row</span></li>
      <li className="desk-step" aria-current={preview ? "step" : undefined}><span className="desk-step-number">3</span><span>Preview &amp; save</span></li>
    </ol>
    {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>}
    {duplicatePlayers.length > 0 && <section role="alert" className="space-y-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-destructive">
      <h2 className="font-semibold">Duplicate player assignments</h2>
      <p className="text-sm">Each occurrence is highlighted below, including confirmed rows. Change the incorrect player or uncheck Include row before continuing.</p>
      {duplicatePlayers.map((duplicate) => <div key={duplicate.identity} className="space-y-1">
        <p className="text-sm font-medium">{options?.players.find((player) => player.id === duplicate.playerId)?.name ?? duplicate.name}</p>
        <div className="flex flex-wrap gap-2">{duplicate.occurrences.map((location) => <Button key={personEditorId(location)} variant="outline" size="sm" disabled={Boolean(busy)} onClick={() => jumpToDuplicate(location)}>{duplicateLocationLabel(location)}</Button>)}</div>
      </div>)}
    </section>}
    {notice && <p role="status" className="data-note">{notice}</p>}
    {busy && <p role="status" className="data-note flex items-center gap-2"><LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden="true" />{busy}</p>}
    {!options ? <p role="status" className="desk-panel p-5 text-sm text-muted-foreground">{error ? "Import settings could not be loaded. Refresh this page to retry." : "Loading import settings…"}</p> : !review ? <div className="desk-two-column"><section className="desk-panel">
      <div className="desk-panel-header"><h2 className="flex items-center gap-2 font-semibold"><FileUp className="size-5 text-primary" aria-hidden="true" />Upload a results sheet</h2><p className="text-sm text-muted-foreground">Choose the source, then check every extracted row.</p></div>
      <div className="desk-stack">
      {!options.configured && <p className="data-note attention-note">Set OPENAI_API_KEY in .env.local and restart the app before importing.</p>}
      {!draft && <label className={labelClass}>Attach to fixture<select className={selectClass} value={uploadFixtureId} disabled={Boolean(busy)} onChange={(event) => setUploadFixtureId(event.target.value)}><option value="">Choose after extraction / create new</option>{options.fixtures.map((fixture) => <option key={fixture.id} value={fixture.id}>{fixture.date} · {fixture.opponentTeamName || fixture.clubName} · {fixture.homeAway}</option>)}</select></label>}
      <p className="text-sm">One PDF, JPEG or PNG; up to 20 MB and 5 PDF pages. Temporary review images are capped at 1 MB per page and deleted after saving, cancellation or expiry (24 hours).</p>
      {draft && <p>Import status: {draft.status}. {draft.data.extractionError}</p>}
      {draft?.status === "uploaded" || draft?.status === "extracting" ? <>
        <p>Extraction can be resumed after a refresh.</p>
        <label className="flex items-start gap-2"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />I agree to send these results pages, including player names, to OpenAI for extraction.</label>
        <Button disabled={!consent || Boolean(busy)} onClick={() => perform("Reading results with OpenAI...", () => extract(draft.id))}>Read uploaded slip</Button>
      </> : <>
        <div className="rounded-xl border-2 border-dashed border-input bg-muted/40 p-6 text-center sm:p-10" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (!busy) setFile(e.dataTransfer.files[0] ?? null); }}>
          <FileUp className="mx-auto mb-3 size-8 text-primary" aria-hidden="true" />
          <p className="mb-2 font-semibold">A scorecard, ready for review.</p>
          <p className="mb-5 text-xs text-muted-foreground">PDF, JPEG or PNG · Uploaded only when you choose Read results</p>
          <label className={labelClass}>Results PDF or photo<Input type="file" accept=".pdf,.jpg,.jpeg,.png" disabled={Boolean(busy)} onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
          <p className="mt-2 break-all text-sm" aria-live="polite">{file ? file.name : "Or drop a file here."}</p>
        </div>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          I agree to send these results pages, including player names, to OpenAI. API data is not used for training by default; provider retention policies still apply.</label>
        <Button disabled={!file || !consent || !options.configured || Boolean(busy)} onClick={() => perform("Preparing and reading results...", upload)}>Read results</Button>
      </>}
      </div>
    </section><aside className="desk-panel self-start"><div className="desk-panel-header"><h2 className="font-semibold">A deliberate import flow</h2></div><div className="desk-stack">
      <div><p className="text-sm font-medium">1 · Choose your scorecard</p><p className="text-xs text-muted-foreground">Connect it to the correct fixture. Files are held temporarily for review.</p></div>
      <div><p className="text-sm font-medium">2 · Check every pairing</p><p className="text-xs text-muted-foreground">Resolve player identities, compare the source and confirm results.</p></div>
      <div><p className="text-sm font-medium">3 · Preview the final record</p><p className="text-xs text-muted-foreground">Review additions and approve updates before saving.</p></div>
      <p className="desk-note desk-note-amber">Extraction uses OpenAI only with your explicit consent. Names and page images leave this app; check your club&apos;s permission before continuing.</p>
    </div></aside></div> : <>
      {draft?.repeated && <p className="data-note attention-note">This exact document was imported before. Review existing matches carefully to avoid duplicates.</p>}
      {draft?.data.extraction?.warnings.map((warning, index) => <p key={index} className="data-note attention-note">{warning}</p>)}
      {preview && <section className="desk-summary grid gap-6 sm:grid-cols-3" aria-label="Import summary">
        <div><p className="text-xs uppercase tracking-wider text-white/65">Import summary</p><p className="numeric mt-2 text-3xl font-semibold">{preview.rows.length} <span className="text-sm font-normal">pair matches</span></p><p className="mt-2 text-xs text-white/75">{review.date} · {review.venueName || "Venue not specified"}</p></div>
        <div><p className="text-xs uppercase tracking-wider text-white/65">Proposed changes</p><p className="numeric mt-2 text-3xl font-semibold">{preview.rows.filter((row) => row.operation === "add").length} <span className="text-sm font-normal">new</span></p><p className="mt-2 text-xs text-white/75">{preview.rows.filter((row) => row.operation === "update").length} updates · {preview.rows.filter((row) => row.operation === "unchanged").length} unchanged</p></div>
        <div><p className="text-xs uppercase tracking-wider text-white/65">Destination</p><p className="mt-2 text-xl font-semibold">{review.fixtureId ? `Fixture #${review.fixtureId}` : "New fixture"}</p><p className="mt-2 text-xs text-white/75">{review.teamName || "Our team"} vs {review.opponentTeamName || "Opponent"} · {review.homeAway}</p></div>
      </section>}
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <aside aria-label="Uploaded source preview" className="desk-panel sticky top-[4.5rem] z-20 flex min-w-0 max-h-[calc(100dvh-5.5rem)] flex-col gap-3 self-start p-3 lg:top-24 lg:max-h-[calc(100dvh-7rem)]">
          <h2 className="text-sm font-semibold">Source document</h2>
          <div className="flex flex-wrap items-end gap-2"><label className={labelClass}>Source page<select className={selectClass} value={page} onChange={(e) => setPage(Number(e.target.value))}>{Array.from({ length: draft?.data.pageCount ?? 0 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select></label><Button variant="outline" aria-pressed={zoom} onClick={() => setZoom(!zoom)}>{zoom ? "Fit page" : "Zoom"}</Button></div>
          <div className="max-h-[30dvh] min-h-0 max-w-full overflow-auto rounded-lg border bg-muted lg:max-h-[calc(100dvh-21rem)]" tabIndex={0} role="region" aria-label={`Results page ${page}, scroll to inspect`}>
            {/* Temporary sources are private and must not go through an image CDN. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${base}/${draft?.id}/pages/${page}`} alt={`Uploaded results page ${page}`} className={zoom ? "max-w-none w-[1100px]" : "w-full"} />
          </div>
          <p className="hidden shrink-0 text-xs text-muted-foreground lg:block">Check every visible row against the draft. A valid extraction can still miss a row. Sources are not retained after saving.</p>
        </aside>
        <div className="min-w-0 space-y-5">
          {!preview && <>
          <fieldset disabled={Boolean(busy) || Boolean(preview)} className="min-w-0 space-y-4 rounded-xl border bg-card p-4 sm:p-5">
            <legend className="px-1 font-semibold">Fixture and team perspective</legend>
            <label className={labelClass}>Our tracked side on the source<select className={selectClass} value={review.side} onChange={(e) => changeSide(e.target.value as Side)}><option value="left">Left team</option><option value="right">Right team</option></select></label>
            <label className={labelClass}>Existing fixture or create new<select className={selectClass} value={review.fixtureId ?? ""} onChange={(e) => {
              const fixture = options.fixtures.find((f) => f.id === Number(e.target.value));
              changeReview(fixture ? chooseFixture(review, fixture, options.players) : { ...review, fixtureId: null, rows: review.rows.map((r) => ({ ...r, matchId: null, reviewed: false })) });
            }}><option value="">Create a new fixture</option>{options.fixtures.map((f) => <option key={f.id} value={f.id}>{f.date} - {f.clubName} - {f.venueName}</option>)}</select></label>
            {draft?.data.extraction && <FixtureSuggestions extraction={draft.data.extraction} fixtures={options.fixtures} />}
            {!review.fixtureId && <>
              <label className={labelClass}>Opponent club (Kenya Air Force for internal team fixtures)<select className={selectClass} value={review.clubId ?? ""} onChange={(e) => changeReview({ ...review, clubId: Number(e.target.value) || null })}><option value="">Explicitly create a new club</option>{options.clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}</select></label>
              {!review.clubId && <label className={labelClass}>New club name (created on save)<Input value={review.newClubName} onChange={(e) => changeReview({ ...review, newClubName: e.target.value })} /></label>}
            </>}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={labelClass}>Date<Input type="date" value={review.date} onChange={(e) => changeReview({ ...review, date: e.target.value })} /></label>
              <label className={labelClass}>Home / away<select className={selectClass} value={review.homeAway} onChange={(e) => changeReview({ ...review, homeAway: e.target.value as Review["homeAway"] })}><option value="home">Home</option><option value="away">Away</option><option value="neutral">Neutral</option></select></label>
              <label className={labelClass}>Our team label<Input value={review.teamName} onChange={(e) => changeReview({ ...review, teamName: e.target.value })} /></label>
              <label className={labelClass}>Other team label<Input value={review.opponentTeamName} onChange={(e) => changeReview({ ...review, opponentTeamName: e.target.value })} /></label>
            </div>
            <label className={labelClass}>Actual venue<Input value={review.venueName} onChange={(e) => changeReview({ ...review, venueName: e.target.value })} /></label>
            <label className="flex gap-2 text-sm"><input type="checkbox" checked={review.internal} onChange={(e) => changeReview(resolveReviewIdentities({ ...review, internal: e.target.checked, rows: review.rows.map((row) => ({ ...row, reviewed: false, opponents: row.opponents.map((p) => ({ ...p, id: null, create: false, identitySource: undefined })) as [Person, Person] })) }, options.players))} />Internal teams: link players on both sides</label>
            <label className="flex gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />I checked the fixture, date, actual venue and tracked side against the source. Existing fixture details above will also be saved.</label>
          </fieldset>
          <section className="desk-panel">
            <div className="desk-panel-header"><h2 className="font-semibold">Review extracted rows</h2><span className="desk-status" data-tone="home">{review.rows.filter((row) => row.selected && row.reviewed).length} / {review.rows.filter((row) => row.selected).length} confirmed</span></div>
            <p className="text-sm">{review.rows.filter((row) => row.selected).length} selected / {review.rows.length} extracted rows. Unknown handicaps are allowed; never substitute a current handicap without checking it.</p>
            <p className="mt-2 text-xs text-muted-foreground">Strong identity matches are preselected. Unsure names are highlighted with ranked suggestions. Confirmed rows collapse; reopen one to make corrections.</p>
          </section>
          {review.rows.map((row, index) => <RowEditor key={row.key} row={row} index={index} source={draft?.data.extraction?.rows[index]} options={options} internal={review.internal} side={review.side} disabled={Boolean(busy) || Boolean(preview)} existing={(draft?.existingMatches ?? []).filter((match) => match.fixture_id === review.fixtureId)} duplicatePlayers={duplicatePlayers} onJumpToDuplicate={jumpToDuplicate} onChange={(patch) => changeRow(index, patch)} onView={() => setPage(row.page)} />)}
          {!preview && <Button variant="outline" disabled={Boolean(busy)} onClick={() => {
            const person: Person = { id: null, name: "", handicap: null, create: false };
            setReview({ ...review, rows: [...review.rows, { key: `manual-${crypto.randomUUID()}`, page, order: null, selected: true, reviewed: false, players: [{ ...person }, { ...person }], opponents: [{ ...person }, { ...person }], result: null, margin: null, notes: "", matchId: null }] });
          }}>Add a missed row</Button>}
          </>}
          {!preview ? <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{saved ? "Draft saved. Temporary files expire after 24 hours." : "Draft autosaves while editing."}</p>
            <Button disabled={!confirmed || duplicatePlayers.length > 0 || Boolean(busy)} onClick={() => perform("Checking additions and conflicts...", async () => {
              const prepared = await request<{ review: Review; preview: Preview }>(`${base}/${draft?.id}/review`, "POST", reviewRef.current);
              setReview(prepared.review); setPreview(prepared.preview); setApprovals([]);
              setDraft((current) => current ? { ...current, status: "prepared" } : current);
            })}>Preview changes</Button>
            {duplicatePlayers.length > 0 && <div className="text-sm text-red-700">
              <p>Resolve the highlighted duplicate player assignments before previewing changes.</p>
              <Button variant="outline" size="sm" onClick={() => jumpToDuplicate(duplicatePlayers[0].occurrences[0])}>Go to first duplicate</Button>
            </div>}
          </div> : <section className="desk-panel min-w-0 space-y-4 overflow-hidden">
            <div className="desk-panel-header"><h2 className="font-semibold">Ready for the fixture record</h2><p className="text-xs text-muted-foreground">Review each change. Existing match updates require individual approval.</p></div>
            <div className="space-y-4">
            <p className="text-sm">Fixture: {review.date}, {review.teamName} vs {review.opponentTeamName}, {review.venueName}. {review.fixtureId ? "Existing fixture details will be updated." : "A new fixture will be created."}</p>
            <Table><caption className="sr-only">Import scorecard preview</caption><TableHeader><TableRow><TableHead>Our pairing / opponents</TableHead><TableHead>Result</TableHead><TableHead>Score</TableHead><TableHead>Change</TableHead></TableRow></TableHeader><TableBody>{preview.rows.map((proposal) => {
              const row = review.rows.find((row) => row.key === proposal.key);
              const playerName = (person: Person) => options.players.find((player) => player.id === person.id)?.name ?? person.name;
              return <TableRow key={proposal.key}><TableCell className="min-w-48 whitespace-normal">{row ? <><span className="font-medium">{row.players.map(playerName).join(" / ")}</span><span className="mt-1 block text-xs text-muted-foreground">vs {row.opponents.map(playerName).join(" / ")}</span></> : "Row unavailable"}</TableCell><TableCell className="capitalize">{row?.result ?? "Unknown"}</TableCell><TableCell>{row?.margin || "—"}</TableCell><TableCell><span className="desk-status" data-tone={proposal.operation === "add" ? "home" : proposal.operation === "update" ? "away" : "neutral"}>{proposal.operation === "add" ? "Add" : proposal.operation === "update" ? "Update" : "Unchanged"}</span></TableCell></TableRow>;
            })}</TableBody></Table>
            {preview.rows.map((proposal, index) => {
              const row = review.rows.find((row) => row.key === proposal.key);
              const playerName = (person: Person) => options.players.find((player) => player.id === person.id)?.name ?? person.name;
              const action = { add: "Add new match", update: "Update existing match", unchanged: "No changes" }[proposal.operation];
              return <div key={proposal.key} className="rounded-lg border bg-muted/30 p-3 text-sm [overflow-wrap:anywhere]">
              <p className="font-medium">{row?.order != null ? `Foursome ${row.order}` : `Match ${index + 1}`}: {action}{proposal.matchId ? ` (#${proposal.matchId})` : ""}</p>
              {row && <p>{row.players.map(playerName).join(" / ")} vs {row.opponents.map(playerName).join(" / ")}</p>}
              {proposal.changes.length > 0 && <p>Changed: {proposal.changes.join(", ")}</p>}
              {proposal.before && <dl className="my-2 space-y-1">{proposal.changes.map((field) => <div key={field}><dt className="inline font-medium">{field}: </dt><dd className="inline">{String(proposal.before?.[field as keyof ExistingMatch] ?? "(unknown)")} {"->"} {String(proposal.after[field] ?? "(unknown)")}</dd></div>)}</dl>}
              {proposal.operation === "update" && <label className="flex gap-2"><input type="checkbox" checked={approvals.includes(proposal.key)} onChange={(e) => setApprovals(e.target.checked ? [...approvals, proposal.key] : approvals.filter((key) => key !== proposal.key))} />Approve this update (otherwise leave this match unchanged)</label>}
            </div>;
            })}
            <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={Boolean(busy)} onClick={() => perform("Returning to review...", async () => {
              await request(`${base}/${draft?.id}/edit`, "POST"); setPreview(null); setDraft((current) => current ? { ...current, status: "ready" } : current);
            })}>Back to editing</Button>
              <Button disabled={Boolean(busy)} onClick={() => perform("Saving confirmed results...", async () => {
                const result = await request<{ fixtureId: number; added: number; updated: number; unchanged: number; skipped: number; cleanupPending: boolean }>(`${base}/${draft?.id}/commit`, "POST", { version: preview.version, approvals });
                setNotice(`Saved: ${result.added} added, ${result.updated} updated, ${result.unchanged} unchanged, ${result.skipped} skipped.${result.cleanupPending ? " Source cleanup is pending and will retry." : " Uploaded sources discarded."}`);
                window.location.assign(`/fixtures/${result.fixtureId}`);
              })}>Save approved changes</Button></div>
            </div>
          </section>}
          <Button variant="destructive" disabled={Boolean(busy)} onClick={() => perform("Discarding import...", async () => {
            await request(`${base}/${draft?.id}`, "DELETE"); window.location.assign("/fixtures");
          })}>Cancel and discard source</Button>
        </div>
      </div>
    </>}
  </div>;
}

function FixtureSuggestions({ extraction, fixtures }: { extraction: Extraction; fixtures: FixtureOption[] }) {
  const candidates = fixtures.filter((f) => f.date === extraction.date || (extraction.venue && f.venueName?.toLowerCase().includes(extraction.venue.toLowerCase())));
  return <p className="text-xs text-muted-foreground">Source: {extraction.date ?? "date unreadable"}, {extraction.leftTeam ?? "?"} vs {extraction.rightTeam ?? "?"}, {extraction.venue ?? "venue unreadable"}. {candidates.length ? `Possible fixture IDs: ${candidates.map((f) => f.id).join(", ")}. Select and verify above.` : "No date/venue match suggested."}</p>;
}

function RowEditor({ row, index, source, options, internal, side, disabled, existing, duplicatePlayers, onJumpToDuplicate, onChange, onView }: {
  row: ReviewRow; index: number; source?: Extraction["rows"][number]; options: Options;
  internal: boolean; side: Side; disabled: boolean; existing: ExistingMatch[];
  duplicatePlayers: DuplicatePlayerAssignment[]; onJumpToDuplicate: (location: DuplicatePlayerOccurrence) => void;
  onChange: (patch: Partial<ReviewRow>) => void; onView: () => void;
}) {
  const [expanded, setExpanded] = useState(!row.reviewed);
  const normalized = source ? normalizeResult(source.leftResult, source.rightResult, side) : null;
  const extractionWarnings = [...(source?.warnings ?? []), ...(normalized?.warning ? [normalized.warning] : [])];
  const hasDuplicates = duplicatePlayers.some((duplicate) => duplicate.occurrences.some((location) => location.rowIndex === index));
  const otherOccurrences = (group: DuplicatePlayerOccurrence["group"], personIndex: number) => duplicatePlayers.flatMap((duplicate) => {
    const isCurrent = (location: DuplicatePlayerOccurrence) => location.rowIndex === index && location.group === group && location.personIndex === personIndex;
    return duplicate.occurrences.some(isCurrent) ? duplicate.occurrences.filter((location) => !isCurrent(location)) : [];
  });
  const confirmationIssues = [...rowConfirmationIssues(row, internal), ...(hasDuplicates ? ["Resolve the duplicate player assignments highlighted in this row."] : [])];
  const canConfirm = confirmationIssues.length === 0;
  const displayName = (person: Person) => options.players.find((player) => player.id === person.id)?.name ?? person.name;
  return <fieldset disabled={disabled} className={`min-w-0 space-y-4 rounded-xl border bg-card p-4 sm:p-5 ${hasDuplicates ? "border-destructive/60" : row.reviewed ? "border-primary/50" : row.selected && !canConfirm ? "border-away/60" : ""} ${row.selected ? "" : "opacity-60"}`}>
    <legend className="px-1 font-semibold">Row {index + 1} - source page {row.page}, foursome {row.order ?? "?"}</legend>
    {row.reviewed && !expanded && !hasDuplicates ? <div className="space-y-2">
      <p className="text-sm font-medium text-emerald-700">Confirmed</p>
      <p className="text-sm">{row.players.map(displayName).join(" / ")} vs {row.opponents.map((person) => internal ? displayName(person) : person.name).join(" / ")}</p>
      <p className="text-sm capitalize">{row.result}{row.margin ? ` (${row.margin})` : ""}</p>
      <div className="flex gap-2"><Button variant="outline" size="sm" onClick={onView}>View source</Button><Button variant="outline" size="sm" onClick={() => { setExpanded(true); onChange({ reviewed: false }); }}>Edit row</Button></div>
    </div> : <>
    <div className="flex flex-wrap items-center gap-3"><label className="flex gap-2 text-sm"><input type="checkbox" checked={row.selected} onChange={(e) => onChange({ selected: e.target.checked })} />Include row</label><Button variant="outline" size="sm" onClick={onView}>View source</Button></div>
    {source && <p className="text-xs">Raw results: left {source.leftResult || "(blank)"} / right {source.rightResult || "(blank)"}{source.tee ? `; tee ${source.tee}` : ""}</p>}
    {extractionWarnings.length > 0 && <div className="space-y-1">
      <p className="text-xs text-muted-foreground">Original extraction notes (before your corrections):</p>
      {extractionWarnings.map((warning, i) => <p key={i} className="text-sm text-amber-700">{warning}</p>)}
    </div>}
    {[...row.players, ...row.opponents].some((person) => person.handicap === null) && <p className="text-sm text-amber-700">Some handicaps are unknown. Existing values will be retained for matched players; otherwise these stay unknown.</p>}
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2"><h3 className="text-sm font-medium">Our pair</h3>{row.players.map((person, i) => <PersonEditor key={i} id={personEditorId({ rowIndex: index, group: "players", personIndex: i })} label={`Our player ${i + 1}`} person={person} linked players={options.players} duplicateOccurrences={otherOccurrences("players", i)} onJumpToDuplicate={onJumpToDuplicate} onChange={(next) => onChange({ players: row.players.map((p, j) => j === i ? next : p) as [Person, Person] })} />)}</div>
      <div className="space-y-2"><h3 className="text-sm font-medium">Other pair</h3>{row.opponents.map((person, i) => <PersonEditor key={i} id={personEditorId({ rowIndex: index, group: "opponents", personIndex: i })} label={`Opponent ${i + 1}`} person={person} linked={internal} players={options.players} duplicateOccurrences={otherOccurrences("opponents", i)} onJumpToDuplicate={onJumpToDuplicate} onChange={(next) => onChange({ opponents: row.opponents.map((p, j) => j === i ? next : p) as [Person, Person] })} />)}</div>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      <label className={labelClass}>Outcome (our side)<select className={selectClass} value={row.result ?? ""} onChange={(e) => onChange({ result: (e.target.value || null) as ReviewRow["result"] })}><option value="">Resolve result</option><option value="win">Win</option><option value="loss">Loss</option><option value="halved">Halved</option><option value="pending">Explicitly pending</option></select></label>
      <label className={labelClass}>Margin<Input value={row.margin ?? ""} placeholder="3&2 or 1UP" onChange={(e) => onChange({ margin: e.target.value.toUpperCase().replace(/\s/g, "").replace("/", "&") || null })} /></label>
      <label className={labelClass}>Foursome number<Input type="number" min={1} max={200} value={row.order ?? ""} onChange={(e) => onChange({ order: e.target.value === "" ? null : Number(e.target.value) })} /></label>
    </div>
    {existing.length > 0 && <label className={labelClass}>Existing row to update (only choose if the automatic pair match is wrong)<select className={selectClass} value={row.matchId ?? ""} onChange={(e) => onChange({ matchId: Number(e.target.value) || null })}><option value="">Automatically compare player pair</option>{existing.map((match) => <option key={match.id} value={match.id}>#{match.id}: foursome {match.match_order ?? "?"}, {options.players.find((p) => p.id === match.player1_id)?.name} / {options.players.find((p) => p.id === match.player2_id)?.name}</option>)}</select></label>}
    <label className={labelClass}>Notes<Input value={row.notes} onChange={(e) => onChange({ notes: e.target.value })} /></label>
    {!row.margin && <label className="flex gap-2 text-xs"><input type="checkbox" checked={row.clearMargin ?? false} onChange={(e) => onChange({ clearMargin: e.target.checked })} />Explicitly clear an existing margin rather than retain it</label>}
    {!row.notes && <label className="flex gap-2 text-xs"><input type="checkbox" checked={row.clearNotes ?? false} onChange={(e) => onChange({ clearNotes: e.target.checked })} />Explicitly clear existing notes rather than retain them</label>}
    <p className="text-xs text-muted-foreground">Confirm after checking the players, result, handicaps and warnings against the source.</p>
    <Button disabled={!canConfirm} onClick={() => { onChange({ reviewed: true }); setExpanded(false); }}>Confirm and collapse</Button>
    {row.selected && !canConfirm && <div role="status" className="text-sm text-amber-700">
      <p className="font-medium">Before confirming:</p>
      <ul className="list-inside list-disc">{confirmationIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
    </div>}
    </>}
  </fieldset>;
}

function PersonEditor({ id, label, person, linked, players, duplicateOccurrences, onJumpToDuplicate, onChange }: {
  id: string; label: string; person: Person; linked: boolean; players: PlayerOption[];
  duplicateOccurrences: DuplicatePlayerOccurrence[]; onJumpToDuplicate: (location: DuplicatePlayerOccurrence) => void;
  onChange: (person: Person) => void;
}) {
  const resolution = resolvePlayer(person.name, players);
  const suggestions = resolution.candidates;
  const remaining = players.filter((player) => !suggestions.some((suggestion) => suggestion.player.id === player.id));
  const unsure = linked && !person.id && !person.create;
  const missingName = !person.name.trim();
  const duplicate = duplicateOccurrences.length > 0;
  return <div id={id} className={`min-w-0 space-y-2 rounded-lg border p-3 ${duplicate ? "border-destructive/50 bg-destructive/5" : unsure || missingName ? "border-away/60 bg-away/5" : "bg-muted/25"}`}>
    <label className={labelClass}>{label} name as read<Input required aria-invalid={missingName || duplicate} aria-describedby={duplicate ? `${id}-duplicates` : undefined} value={person.name} onChange={(e) => {
      const next = { ...person, name: e.target.value, id: null, create: false, identitySource: undefined };
      onChange(linked ? resolvePersonIdentity(next, players) : next);
    }} /></label>
    {missingName && <p className="text-xs text-amber-700">{label} name is required.</p>}
    {linked && <label className={labelClass}>Player identity<select className={`${selectClass}${duplicate ? " border-red-500" : ""}`} aria-invalid={duplicate} aria-describedby={duplicate ? `${id}-duplicates` : undefined} value={person.id ?? (person.create ? "new" : "")} onChange={(e) => {
      const id = Number(e.target.value) || null;
      onChange({ ...person, id, create: e.target.value === "new", identitySource: "manual" });
    }}><option value="">Resolve identity</option>
      {suggestions.length > 0 && <optgroup label="Most likely matches">{suggestions.map(({ player, reason }) => <option key={player.id} value={player.id}>{player.name}{!player.active ? " (inactive)" : ""} - {reason}</option>)}</optgroup>}
      <optgroup label="Other players">{remaining.map((player) => <option key={player.id} value={player.id}>{player.name}{!player.active ? " (inactive)" : ""}</option>)}</optgroup>
      <option value="new">Explicitly create &quot;{person.name}&quot;</option></select></label>}
    {duplicate && <div id={`${id}-duplicates`} role="status" className="space-y-1 text-xs text-red-700">
      <p className="font-medium">Duplicate player assignment. Also used in:</p>
      <div className="flex flex-wrap gap-1">{duplicateOccurrences.map((location) => <Button key={personEditorId(location)} variant="outline" size="sm" onClick={() => onJumpToDuplicate(location)}>{duplicateLocationLabel(location)}</Button>)}</div>
    </div>}
    {linked && person.id && person.identitySource === "automatic" && <p className="text-xs text-emerald-700">Auto-matched to {players.find((player) => player.id === person.id)?.name}. You can change this selection.</p>}
    {unsure && <p className="text-xs text-amber-700">{suggestions.length ? "Unsure identity: check the suggested players against the source." : "No reliable match found. Select a player or explicitly create one."}</p>}
    {unsure && suggestions[0] && <Button variant="outline" size="sm" onClick={() => onChange({ ...person, id: suggestions[0].player.id, create: false, identitySource: "manual" })}>Use {suggestions[0].player.name}</Button>}
    {person.create && <p className="text-xs">A new player will be created on save. Their default handicap is {person.handicap ?? 18}; an unknown historical handicap still stays unknown.</p>}
    <label className={labelClass}>Recorded handicap (blank = unknown)<Input type="number" min={-8} max={54} step="0.1" value={person.handicap ?? ""} onChange={(e) => onChange({ ...person, handicap: e.target.value === "" ? null : Number(e.target.value) })} /></label>
    {person.handicap === null && <label className="flex gap-2 text-xs"><input type="checkbox" checked={person.clearHandicap ?? false} onChange={(e) => onChange({ ...person, clearHandicap: e.target.checked })} />Explicitly clear an existing recorded handicap</label>}
    {linked && person.id && person.handicap === null && <p className="text-xs text-muted-foreground">Current default is {players.find((p) => p.id === person.id)?.defaultHandicap}. It has not been applied to this historical match.</p>}
  </div>;
}
