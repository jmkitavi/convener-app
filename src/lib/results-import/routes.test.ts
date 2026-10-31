import assert from "node:assert/strict";
import test, { mock } from "node:test";
import sharp from "sharp";
import { createTestDatabase } from "../../db/test-database";
import { sourceStorage, sourcePrefix, blobConfiguration } from "./blob";
import { initialReview } from "./normalize";
import { commitReview } from "./service";
import type { Extraction } from "./contracts";

test("direct upload/extract/review lifecycle, source deletion, expiry and failed extraction", async () => {
  const db = await createTestDatabase();
  process.env.OPENAI_API_KEY = "test-key-not-a-secret";
  process.env.PREVIEW_BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_teststore_abcdefghijklmnopqrstuvwxyz0123456789";
  process.env.PREVIEW_BLOB_STORE_ID = "store_test";
  const objects = new Map<string, Buffer>();
  const storageMocks = [
    mock.method(sourceStorage, "read", async (pathname: string) => {
      const bytes = objects.get(pathname);
      if (!bytes) throw new Error("Source file not found.");
      return bytes;
    }),
    mock.method(sourceStorage, "writePage", async (id: string, page: number, bytes: Buffer) => {
      const pathname = `${sourcePrefix(id)}${page}.jpg`;
      objects.set(pathname, bytes);
      return { url: `https://test.private.blob.vercel-storage.com/${pathname}`, pathname, contentType: "image/jpeg", contentDisposition: "", downloadUrl: "" };
    }),
    mock.method(sourceStorage, "deleteSources", async (id: string) => {
      for (const pathname of objects.keys()) if (pathname.startsWith(sourcePrefix(id))) objects.delete(pathname);
    }),
    mock.method(sourceStorage, "deleteFile", async (pathname: string) => { objects.delete(pathname); }),
    mock.method(sourceStorage, "list", async () => ({
      blobs: [...objects.entries()].map(([pathname, bytes]) => ({
        pathname, url: "", downloadUrl: "", etag: "", size: bytes.length, uploadedAt: new Date(0),
      })), hasMore: false,
    })),
  ];
  const originalFetch = globalThis.fetch;
  let applicationPool: (typeof import("pg"))["Pool"]["prototype"] | undefined;
  try {
    const routes = await import("../../app/api/results-imports/[[...parts]]/route");
    applicationPool = (await import("../../db")).pool;
    const context = (parts: string[]) => ({ params: Promise.resolve({ parts }) });
    const url = "http://127.0.0.1:3000/api/results-imports";
    const post = (parts: string[], input: unknown) => routes.POST(new Request(`${url}/${parts.join("/")}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
    }), context(parts));
    const image = await sharp({ create: { width: 800, height: 1100, channels: 3, background: "white" } }).png().toBuffer();
    const upload = async () => {
      const reserved = await (await post(["upload"], {})).json();
      assert.equal(typeof reserved.id, "string");
      const issued = await (await post([reserved.id, "token"], { extension: "png" })).json();
      assert.equal(issued.pathname, `${sourcePrefix(reserved.id)}original.png`);
      objects.set(issued.pathname, image);
      const response = await post([], { id: reserved.id });
      const result = await response.json();
      assert.equal(response.status, 200, JSON.stringify(result));
      assert.equal(objects.has(issued.pathname), false, "Original is discarded after normalization");
      return result.id as string;
    };
    const id = await upload();
    assert.equal((await post([id, "extract"], { consent: false })).status, 400);
    const extraction: Extraction = {
      date: "2026-06-14", venue: "Neutral Course", leftTeam: "Visitors", rightTeam: "Our Team", warnings: [],
      rows: [{ page: 1, order: 1, tee: null, warnings: [], leftResult: "LOST", rightResult: "1UP",
        left: [{ name: "Opponent A", handicap: null }, { name: "Opponent B", handicap: null }],
        right: [{ name: "Player A", handicap: null }, { name: "Player B", handicap: 0 }] }],
    };
    globalThis.fetch = async target => {
      assert.equal(target, "https://api.openai.com/v1/responses");
      return Response.json({ status: "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify(extraction) }] }] });
    };
    const review = initialReview(extraction, [], "right");
    review.newClubName = "Visitors";
    review.rows[0].reviewed = true;
    review.rows[0].players.forEach(person => { person.create = true; });
    assert.equal((await post([id, "extract"], { consent: true })).status, 200);
    assert.equal((await post([id, "review"], review)).status, 200);
    assert.equal((await post([id, "draft"], review)).status, 400, "Autosave cannot replace a prepared snapshot");
    assert.equal((await routes.GET(new Request(`${url}/${id}/pages/1`), context([id, "pages", "1"]))).status, 200);
    assert.equal((await routes.DELETE(new Request(`${url}/${id}`, { method: "DELETE" }), context([id]))).status, 200);
    assert.equal(objects.size, 0);
    assert.equal((await db.prepare("SELECT COUNT(*) count FROM matches").get()).count, 0);
    const successful = await upload();
    assert.equal((await post([successful, "extract"], { consent: true })).status, 200);
    const finalReview = await (await post([successful, "review"], review)).json();
    await commitReview(db, successful, finalReview.preview.version, []);
    await routes.GET(new Request(url), context([]));
    assert.equal(objects.size, 0);
    assert.equal((await routes.GET(new Request(`${url}/${successful}/pages/1`), context([successful, "pages", "1"]))).status, 400);
    const committed = await (await routes.GET(new Request(`${url}/${successful}`), context([successful]))).json();
    assert.equal(committed.status, "committed");
    assert.equal(committed.data.extraction, undefined);
    assert.equal(committed.data.review, undefined);
    const failed = await upload();
    globalThis.fetch = async () => Response.json({}, { status: 429 });
    assert.equal((await post([failed, "extract"], { consent: true })).status, 400);
    assert.equal(objects.size, 0);
    assert.equal((await db.prepare("SELECT status FROM result_imports WHERE id = ?").get(failed)).status, "failed");
    const expired = await upload();
    await db.prepare("UPDATE result_imports SET expires_at = '2000-01-01' WHERE id = ?").run(expired);
    await routes.GET(new Request(url), context([]));
    assert.equal(await db.prepare("SELECT id FROM result_imports WHERE id = ?").get(expired), undefined);
    assert.equal(objects.size, 0);
    objects.set("results-imports/00000000-0000-4000-8000-000000000000/original.png", image);
    await routes.GET(new Request(url), context([]));
    assert.equal(objects.size, 0, "An abandoned upload without draft metadata expires too");
    assert.equal((await post([], { id: "https://example.invalid/secret" })).status, 400);
    assert.equal((await routes.GET(new Request(url, { headers: { Origin: "https://example.invalid" } }), context([]))).status, 400);
    const { boundedProcessing } = await import("./store");
    let finish: (() => void) | undefined;
    let started: (() => void) | undefined;
    const ready = new Promise<void>(resolve => { started = resolve; });
    const active = boundedProcessing(() => new Promise<void>(resolve => { finish = resolve; started!(); }));
    await ready;
    await assert.rejects(() => boundedProcessing(async () => {}), /Another document/);
    finish!();
    await active;
    await boundedProcessing(async () => {});
  } finally {
    globalThis.fetch = originalFetch;
    storageMocks.forEach(item => item.mock.restore());
    await applicationPool?.end();
    await db.close();
  }
});

test("Preview storage never falls back to Production credentials", () => {
  const previous = { env: process.env.VERCEL_ENV, token: process.env.PREVIEW_BLOB_READ_WRITE_TOKEN };
  process.env.VERCEL_ENV = "preview";
  delete process.env.PREVIEW_BLOB_READ_WRITE_TOKEN;
  process.env.BLOB_READ_WRITE_TOKEN = "synthetic-production-token";
  try { assert.throws(blobConfiguration, /PREVIEW_BLOB/); }
  finally {
    if (previous.env === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = previous.env;
    if (previous.token === undefined) delete process.env.PREVIEW_BLOB_READ_WRITE_TOKEN; else process.env.PREVIEW_BLOB_READ_WRITE_TOKEN = previous.token;
    delete process.env.BLOB_READ_WRITE_TOKEN;
  }
});
