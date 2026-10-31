import { randomUUID } from "node:crypto";
import { pool } from "@/db";
import { first, rows } from "@/db/connection";
import type { DraftData } from "./contracts";
import { sourceStorage, sourcePrefix } from "./blob";
import { MAX_PAGE } from "./documents";

export const client = pool;
const lifetime = 24 * 60 * 60 * 1000;
export type Draft = {
  id: string; status: string; data: string; source_hash: string;
  expires_at: string; created_at: string; commit_result: string | null;
};

export async function getDraft(id: string): Promise<Draft> {
  sourcePrefix(id);
  const draft = await first<Draft>(client, "SELECT * FROM result_imports WHERE id = $1", [id]);
  if (!draft) throw new Error("Import not found or expired.");
  if (draft.status !== "committed" && draft.expires_at <= new Date().toISOString()) throw new Error("Import expired. Upload the slip again.");
  return draft;
}

export function draftData(draft: Draft): DraftData { return JSON.parse(draft.data); }

export async function deleteSources(id: string) {
  await sourceStorage.deleteSources(id);
  await client.query(`UPDATE result_imports SET data = (data::jsonb || '{"sourcesDeleted":true}'::jsonb)::text WHERE id = $1 AND status = 'committed'`, [id]);
}

export async function cleanupDrafts() {
  const drafts = await rows<Pick<Draft, "id" | "status">>(client,
    `SELECT id, status FROM result_imports WHERE (status = 'committed' AND data::jsonb->>'sourcesDeleted' IS DISTINCT FROM 'true') OR status = 'cancelled' OR expires_at <= $1 AND status != 'committed'`, [new Date().toISOString()]);
  for (const draft of drafts) {
    try {
      await deleteSources(draft.id);
      if (draft.status !== "committed") await client.query("DELETE FROM result_imports WHERE id = $1 AND (status = 'cancelled' OR status != 'committed' AND expires_at <= $2)", [draft.id, new Date().toISOString()]);
    } catch {
      // Retain metadata so a later request can retry source cleanup.
    }
  }
  let cursor: string | undefined;
  do {
    const batch = await sourceStorage.list(cursor);
    const ids = [...new Set(batch.blobs.map(blob => blob.pathname.split("/")[1]).filter(id => /^[0-9a-f]{8}-[0-9a-f-]{27}$/.test(id)))];
    const known = await rows<Pick<Draft, "id" | "status" | "expires_at">>(client, "SELECT id, status, expires_at FROM result_imports WHERE id = ANY($1::text[])", [ids]);
    const records = new Map(known.map(draft => [draft.id, draft]));
    for (const blob of batch.blobs) {
      const id = blob.pathname.split("/")[1];
      if (!ids.includes(id)) continue;
      const record = records.get(id);
      if (record ? ["committed", "cancelled"].includes(record.status) || record.expires_at <= new Date().toISOString()
        : Date.now() - blob.uploadedAt.getTime() > lifetime) {
        await sourceStorage.deleteFile(blob.pathname);
      }
    }
    cursor = batch.hasMore ? batch.cursor : undefined;
  } while (cursor);
}

export async function reserveUpload() {
  const id = randomUUID();
  const data: DraftData = { pageCount: 0, extractionVersion: 1 };
  await client.query("INSERT INTO result_imports (id, status, data, source_hash, expires_at, created_at) VALUES ($1, 'uploading', $2, '', $3, $4)",
    [id, JSON.stringify(data), new Date(Date.now() + lifetime).toISOString(), new Date().toISOString()]);
  return id;
}

export async function createDraft(pages: Buffer[], hash: string, id: string) {
  try {
    await Promise.all(pages.map((page, index) => sourceStorage.writePage(id, index + 1, page)));
    await saveDraft(id, "uploaded", { pageCount: pages.length, extractionVersion: 1 }, "uploading", hash);
    return id;
  } catch (error) {
    await deleteSources(id);
    throw error;
  }
}

export async function getPage(id: string, page: number) {
  const draft = await getDraft(id);
  if (draft.status === "committed") throw new Error("Source files were discarded after saving.");
  if (!Number.isInteger(page) || page < 1 || page > draftData(draft).pageCount) throw new Error("Page not found.");
  return sourceStorage.read(`${sourcePrefix(id)}${page}.jpg`, MAX_PAGE);
}

export async function saveDraft(id: string, status: string, data: DraftData, expectedStatus: string, hash?: string) {
  const result = await client.query("UPDATE result_imports SET status = $1, data = $2, source_hash = COALESCE($5, source_hash) WHERE id = $3 AND status = $4 AND expires_at > $6",
    [status, JSON.stringify(data), id, expectedStatus, hash ?? null, new Date().toISOString()]);
  if (!result.rowCount) throw new Error("Import changed or expired. Reload it before continuing.");
}

export async function boundedProcessing<T>(operation: () => Promise<T>): Promise<T> {
  const owner = randomUUID();
  const result = await client.query(`INSERT INTO import_processing_leases (name, owner, expires_at)
    VALUES ('document', $1, NOW() + INTERVAL '4 minutes')
    ON CONFLICT (name) DO UPDATE SET owner = EXCLUDED.owner, expires_at = EXCLUDED.expires_at
      WHERE import_processing_leases.expires_at < NOW() RETURNING owner`, [owner]);
  if (!result.rowCount) throw new Error("Another document is processing. Try again shortly.");
  try { return await operation(); }
  finally { await client.query("DELETE FROM import_processing_leases WHERE name = 'document' AND owner = $1", [owner]); }
}
