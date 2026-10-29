import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { boundedBody, MAX_UPLOAD, prepareDocument } from "@/lib/results-import/documents";
import { extractResults } from "@/lib/results-import/extract";
import {
  boundedProcessing, cleanupDrafts, client, createDraft, deleteSources,
  draftData, getDraft, getPage, saveDraft,
} from "@/lib/results-import/store";
import { commitReview, prepareReview } from "@/lib/results-import/service";
import { draftReviewSchema } from "@/lib/results-import/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
type Context = { params: Promise<{ parts?: string[] }> };
const headers = { "Cache-Control": "no-store", "Cross-Origin-Resource-Policy": "same-origin" };

function assertLocalRequest(request: Request) {
  const url = new URL(request.url);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    throw new Error("Results import is local-only until authentication is configured.");
  }
  const origin = request.headers.get("origin");
  if ((origin && origin !== url.origin) || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new Error("Cross-origin import requests are not allowed.");
  }
}

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers });
}

async function body(request: Request) {
  return JSON.parse((await boundedBody(request, 2 * 1024 * 1024)).toString());
}

async function handle(request: Request, context: Context) {
  try {
    assertLocalRequest(request);
    await cleanupDrafts();
    const parts = (await context.params).parts ?? [];
    if (request.method === "GET" && !parts.length) {
      return json({
        configured: Boolean(process.env.OPENAI_API_KEY),
        players: client.prepare("SELECT id, name, default_handicap AS defaultHandicap, active FROM players ORDER BY name").all(),
        clubs: client.prepare("SELECT id, name FROM opponent_clubs ORDER BY name").all(),
        fixtures: client.prepare(`SELECT f.id, f.date, f.opponent_club_id AS opponentClubId, f.home_away AS homeAway,
          COALESCE(f.venue_name, CASE WHEN f.home_away = 'home' THEN 'Kenya Air Force Golf Club' ELSE c.name END) AS venueName,
          f.team_name AS teamName, f.opponent_team_name AS opponentTeamName, c.name AS clubName
          FROM fixtures f JOIN opponent_clubs c ON c.id = f.opponent_club_id ORDER BY f.date DESC`).all(),
      });
    }
    if (request.method === "POST" && !parts.length) {
      return await boundedProcessing(async () => {
        const bytes = await boundedBody(request, MAX_UPLOAD + 64 * 1024);
        const form = await new Request(request.url, { method: "POST", headers: { "Content-Type": request.headers.get("content-type") ?? "" }, body: bytes }).formData();
        const file = form.get("file");
        if (!(file instanceof File) || Array.from(form.values()).filter((value) => value instanceof File).length !== 1) throw new Error("Choose exactly one PDF or photo.");
        const original = Buffer.from(await file.arrayBuffer());
        const pages = await prepareDocument(original);
        const hash = createHash("sha256").update(original).digest("hex");
        const repeated = client.prepare("SELECT id FROM result_imports WHERE source_hash = ? AND status = 'committed' LIMIT 1").get(hash);
        const id = await createDraft(pages, hash);
        return json({ id, repeated: Boolean(repeated) });
      });
    }
    const [id, action, page] = parts;
    if (!id) return json({ error: "Not found." }, 404);
    const draft = getDraft(id);
    if (request.method === "GET" && action === "pages" && parts.length === 3) {
      return new Response(new Uint8Array(await getPage(id, Number(page))), { headers: { ...headers, "Content-Type": "image/jpeg", "X-Content-Type-Options": "nosniff" } });
    }
    if (request.method === "GET" && parts.length === 1) {
      return json({
        id, status: draft.status, data: draftData(draft), expiresAt: draft.expires_at,
        result: draft.commit_result ? JSON.parse(draft.commit_result) : null,
        existingMatches: client.prepare("SELECT * FROM matches ORDER BY fixture_id, match_order, id").all(),
        repeated: Boolean(client.prepare("SELECT id FROM result_imports WHERE source_hash = ? AND status = 'committed' AND id != ? LIMIT 1").get(draft.source_hash, id)),
      });
    }
    if (request.method === "DELETE" && parts.length === 1) {
      if (draft.status === "committed") throw new Error("Committed results cannot be cancelled.");
      if (draft.status === "extracting") throw new Error("Wait for extraction to finish before cancelling.");
      await deleteSources(id);
      client.prepare("DELETE FROM result_imports WHERE id = ?").run(id);
      return json({ cancelled: true });
    }
    if (request.method !== "POST" || parts.length !== 2) return json({ error: "Not found." }, 404);
    if (action === "extract") {
      const input = await body(request);
      if (input.consent !== true) throw new Error("Confirm sending this document to OpenAI first.");
      if (draft.status !== "uploaded" && draft.status !== "extracting") throw new Error("This import has already been extracted. Upload a new copy to try again.");
      return await boundedProcessing(async () => {
        const data = draftData(draft);
        saveDraft(id, "extracting", data);
        try {
          const pages = await Promise.all(Array.from({ length: data.pageCount }, (_, index) => getPage(id, index + 1)));
          const result = await extractResults(pages);
          saveDraft(id, "ready", { ...data, ...result });
          return json({ id });
        } catch (error) {
          saveDraft(id, "failed", { ...data, extractionError: error instanceof Error ? error.message : "Extraction failed." });
          await deleteSources(id);
          throw error;
        }
      });
    }
    if (action === "review") {
      if (!["ready", "prepared"].includes(draft.status)) throw new Error("Extract the document before reviewing it.");
      const prepared = prepareReview(client, await body(request));
      const data = draftData(draft);
      if (prepared.review.rows.some((row) => row.page > data.pageCount)) throw new Error("Invalid source page.");
      saveDraft(id, "prepared", { ...data, ...prepared });
      return json(prepared);
    }
    if (action === "draft") {
      if (draft.status !== "ready") throw new Error("Return to editing before saving draft changes.");
      const review = draftReviewSchema.parse(await body(request));
      const data = draftData(draft);
      client.prepare("UPDATE result_imports SET data = ? WHERE id = ? AND status = 'ready'")
        .run(JSON.stringify({ ...data, review, preview: undefined }), id);
      return json({ saved: true });
    }
    if (action === "edit") {
      if (draft.status !== "prepared") throw new Error("No prepared review to edit.");
      saveDraft(id, "ready", { ...draftData(draft), preview: undefined });
      return json({ saved: true });
    }
    if (action === "commit") {
      const input = await body(request);
      if (typeof input.version !== "string" || !Array.isArray(input.approvals) || input.approvals.some((key: unknown) => typeof key !== "string")) {
        throw new Error("Invalid confirmation.");
      }
      const result = commitReview(client, id, input.version, input.approvals);
      let cleanupPending = false;
      try { await deleteSources(id); } catch { cleanupPending = true; }
      for (const route of ["/", "/fixtures", `/fixtures/${result.fixtureId}`, "/players", "/analytics"]) revalidatePath(route, "layout");
      return json({ ...result, cleanupPending });
    }
    return json({ error: "Not found." }, 404);
  } catch (error) {
    const message = error instanceof ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : "Import failed.";
    return json({ error: message }, 400);
  }
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
