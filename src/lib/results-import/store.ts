import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/db";
import type { DraftData } from "./contracts";

export const client = db.$client;
const root = path.resolve(process.env.RESULTS_IMPORT_DIR || ".results-imports");
const lifetime = 24 * 60 * 60 * 1000;
const idPattern = /^[0-9a-f]{8}-[0-9a-f-]{27}$/;
export type Draft = {
  id: string; status: string; data: string; source_hash: string;
  expires_at: string; created_at: string; commit_result: string | null;
};

function directory(id: string) {
  if (!idPattern.test(id)) throw new Error("Invalid import ID.");
  return path.join(root, id);
}

export function getDraft(id: string): Draft {
  directory(id);
  const draft = client.prepare("SELECT * FROM result_imports WHERE id = ?").get(id) as Draft | undefined;
  if (!draft) throw new Error("Import not found or expired.");
  if (draft.status !== "committed" && draft.expires_at <= new Date().toISOString()) throw new Error("Import expired. Upload the slip again.");
  return draft;
}

export function draftData(draft: Draft): DraftData {
  return JSON.parse(draft.data);
}

export async function deleteSources(id: string) {
  await rm(directory(id), { recursive: true, force: true });
}

export async function cleanupDrafts() {
  await mkdir(root, { recursive: true, mode: 0o700 });
  const drafts = client.prepare("SELECT id, status, expires_at FROM result_imports").all() as Pick<Draft, "id" | "status" | "expires_at">[];
  for (const draft of drafts) {
    if (draft.status === "committed" || draft.expires_at <= new Date().toISOString()) {
      try {
        await deleteSources(draft.id);
        if (draft.status !== "committed") client.prepare("DELETE FROM result_imports WHERE id = ?").run(draft.id);
      } catch {
        // Keep metadata so a later request retries cleanup without repeating the commit.
      }
    }
  }
  const known = new Set(drafts.map((draft) => draft.id));
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.isDirectory() && idPattern.test(entry.name) && !known.has(entry.name)) {
      const info = await stat(directory(entry.name));
      if (Date.now() - info.mtimeMs > lifetime) await deleteSources(entry.name);
    }
  }
}

export async function createDraft(pages: Buffer[], hash: string) {
  const id = randomUUID();
  await mkdir(directory(id), { recursive: true, mode: 0o700 });
  try {
    await Promise.all(pages.map((page, index) => writeFile(path.join(directory(id), `${index + 1}.jpg`), page, { mode: 0o600 })));
    const data: DraftData = { pageCount: pages.length, extractionVersion: 1 };
    client.prepare("INSERT INTO result_imports (id, status, data, source_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(id, "uploaded", JSON.stringify(data), hash, new Date(Date.now() + lifetime).toISOString(), new Date().toISOString());
    return id;
  } catch (error) {
    await deleteSources(id);
    throw error;
  }
}

export async function getPage(id: string, page: number) {
  const draft = getDraft(id);
  if (draft.status === "committed") throw new Error("Source files were discarded after saving.");
  if (!Number.isInteger(page) || page < 1 || page > draftData(draft).pageCount) throw new Error("Page not found.");
  return readFile(path.join(directory(id), `${page}.jpg`));
}

export function saveDraft(id: string, status: string, data: DraftData) {
  client.prepare("UPDATE result_imports SET status = ?, data = ? WHERE id = ? AND status != 'committed'")
    .run(status, JSON.stringify(data), id);
}

const state = globalThis as typeof globalThis & { resultsImportBusy?: boolean };
export async function boundedProcessing<T>(operation: () => Promise<T>): Promise<T> {
  if (state.resultsImportBusy) throw new Error("Another document is processing. Try again shortly.");
  state.resultsImportBusy = true;
  try { return await operation(); } finally { state.resultsImportBusy = false; }
}
