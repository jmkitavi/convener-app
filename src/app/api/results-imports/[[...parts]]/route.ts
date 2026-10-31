import { createHash } from "node:crypto";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { first, rows, transaction } from "@/db/connection";
import { assertAppRequest } from "@/lib/request-origin";
import { boundedBody, MAX_UPLOAD, prepareDocument } from "@/lib/results-import/documents";
import { blobConfiguration, sourceStorage, sourcePrefix } from "@/lib/results-import/blob";
import { extractResults } from "@/lib/results-import/extract";
import {
  boundedProcessing, cleanupDrafts, client, createDraft, deleteSources,
  draftData, getDraft, getPage, reserveUpload, saveDraft,
} from "@/lib/results-import/store";
import { commitReview, prepareReview } from "@/lib/results-import/service";
import { draftReviewSchema } from "@/lib/results-import/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
type Context = { params: Promise<{ parts?: string[] }> };
const headers = { "Cache-Control": "no-store", "Cross-Origin-Resource-Policy": "same-origin" };
function json(data: unknown, status = 200) { return Response.json(data, { status, headers }); }
async function body(request: Request) { return JSON.parse((await boundedBody(request, 2 * 1024 * 1024)).toString()); }

async function handle(request: Request, context: Context) {
  try {
    const url = new URL(request.url);
    assertAppRequest(url.host, request.headers, url.protocol);
    await cleanupDrafts();
    const parts = (await context.params).parts ?? [];
    if (request.method === "GET" && !parts.length) {
      return json({
        configured: Boolean(process.env.OPENAI_API_KEY),
        players: await rows(client, 'SELECT id, name, default_handicap AS "defaultHandicap", active FROM players ORDER BY name'),
        clubs: await rows(client, "SELECT id, name FROM opponent_clubs ORDER BY name"),
        fixtures: await rows(client, `SELECT f.id, f.date, f.opponent_club_id AS "opponentClubId", f.home_away AS "homeAway",
          COALESCE(f.venue_name, CASE WHEN f.home_away = 'home' THEN 'Kenya Air Force Golf Club' ELSE c.name END) AS "venueName",
          f.team_name AS "teamName", f.opponent_team_name AS "opponentTeamName", c.name AS "clubName"
          FROM fixtures f JOIN opponent_clubs c ON c.id = f.opponent_club_id ORDER BY f.date DESC`),
      });
    }
    if (request.method === "POST" && parts[0] === "upload" && parts.length === 1) {
      blobConfiguration();
      return json({ id: await reserveUpload() });
    }
    if (request.method === "POST" && !parts.length) {
      const input = await body(request);
      if (typeof input.id !== "string") throw new Error("Choose exactly one PDF or photo.");
      return await boundedProcessing(async () => {
        const draft = await getDraft(input.id);
        if (draft.status === "uploaded") return json({ id: draft.id, repeated: false });
        if (draft.status !== "uploading") throw new Error("This upload has already been processed.");
        const pathname = draftData(draft).originalPath;
        if (!pathname || !pathname.startsWith(sourcePrefix(draft.id))) throw new Error("No uploaded source found.");
        const original = await sourceStorage.read(pathname, MAX_UPLOAD);
        const pages = await prepareDocument(original);
        const hash = createHash("sha256").update(original).digest("hex");
        const repeated = await first(client, "SELECT id FROM result_imports WHERE source_hash = $1 AND status = 'committed' LIMIT 1", [hash]);
        await createDraft(pages, hash, draft.id);
        await sourceStorage.deleteFile(pathname);
        return json({ id: draft.id, repeated: Boolean(repeated) });
      });
    }
    const [id, action, page] = parts;
    if (!id) return json({ error: "Not found." }, 404);
    const draft = await getDraft(id);
    if (request.method === "GET" && action === "pages" && parts.length === 3) {
      return new Response(new Uint8Array(await getPage(id, Number(page))), { headers: { ...headers, "Content-Type": "image/jpeg", "X-Content-Type-Options": "nosniff" } });
    }
    if (request.method === "GET" && parts.length === 1) {
      return json({
        id, status: draft.status, data: draftData(draft), expiresAt: draft.expires_at,
        result: draft.commit_result ? JSON.parse(draft.commit_result) : null,
        existingMatches: await rows(client, "SELECT * FROM matches ORDER BY fixture_id, match_order NULLS FIRST, id"),
        repeated: Boolean(await first(client, "SELECT id FROM result_imports WHERE source_hash = $1 AND status = 'committed' AND id != $2 LIMIT 1", [draft.source_hash, id])),
      });
    }
    if (request.method === "DELETE" && parts.length === 1) {
      const cancelled = await client.query("UPDATE result_imports SET status = 'cancelled' WHERE id = $1 AND status NOT IN ('committed', 'extracting') RETURNING id", [id]);
      if (!cancelled.rowCount) throw new Error("Committed or extracting results cannot be cancelled.");
      await deleteSources(id);
      await client.query("DELETE FROM result_imports WHERE id = $1 AND status = 'cancelled'", [id]);
      return json({ cancelled: true });
    }
    if (request.method !== "POST" || parts.length !== 2) return json({ error: "Not found." }, 404);
    if (action === "token") {
      const input = await body(request);
      const types: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" };
      if (draft.status !== "uploading" || typeof input.extension !== "string" || !types[input.extension]) throw new Error("Choose a PDF, JPEG or PNG.");
      const pathname = `${sourcePrefix(id)}original.${input.extension}`;
      await saveDraft(id, "uploading", { ...draftData(draft), originalPath: pathname }, "uploading");
      const token = await generateClientTokenFromReadWriteToken({
        token: blobConfiguration().token, pathname, maximumSizeInBytes: MAX_UPLOAD,
        allowedContentTypes: [types[input.extension]], validUntil: Date.now() + 10 * 60 * 1000,
        addRandomSuffix: false, allowOverwrite: false,
      });
      return json({ token, pathname, contentType: types[input.extension] });
    }
    if (action === "extract") {
      const input = await body(request);
      if (input.consent !== true) throw new Error("Confirm sending this document to OpenAI first.");
      return await boundedProcessing(async () => {
        const fresh = await getDraft(id);
        if (!["uploaded", "extracting"].includes(fresh.status)) throw new Error("This import has already been extracted. Upload a new copy to try again.");
        const data = draftData(fresh);
        await saveDraft(id, "extracting", data, fresh.status);
        try {
          const pages = await Promise.all(Array.from({ length: data.pageCount }, (_, index) => getPage(id, index + 1)));
          const result = await extractResults(pages);
          await saveDraft(id, "ready", { ...data, ...result }, "extracting");
          return json({ id });
        } catch (error) {
          await saveDraft(id, "failed", { ...data, extractionError: error instanceof Error ? error.message : "Extraction failed." }, "extracting");
          await deleteSources(id);
          throw error;
        }
      });
    }
    if (action === "review") {
      if (!["ready", "prepared"].includes(draft.status)) throw new Error("Extract the document before reviewing it.");
      const input = await body(request);
      const prepared = await transaction(client, async connection => {
        await connection.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
        return prepareReview(connection, input);
      });
      const data = draftData(draft);
      if (prepared.review.rows.some(row => row.page > data.pageCount)) throw new Error("Invalid source page.");
      await saveDraft(id, "prepared", { ...data, ...prepared }, draft.status);
      return json(prepared);
    }
    if (action === "draft") {
      if (draft.status !== "ready") throw new Error("Return to editing before saving draft changes.");
      const review = draftReviewSchema.parse(await body(request));
      await saveDraft(id, "ready", { ...draftData(draft), review, preview: undefined }, "ready");
      return json({ saved: true });
    }
    if (action === "edit") {
      if (draft.status !== "prepared") throw new Error("No prepared review to edit.");
      await saveDraft(id, "ready", { ...draftData(draft), preview: undefined }, "prepared");
      return json({ saved: true });
    }
    if (action === "commit") {
      const input = await body(request);
      if (typeof input.version !== "string" || !Array.isArray(input.approvals) || input.approvals.some((key: unknown) => typeof key !== "string")) throw new Error("Invalid confirmation.");
      const result = await commitReview(client, id, input.version, input.approvals);
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
