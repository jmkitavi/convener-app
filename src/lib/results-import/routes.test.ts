import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import sharp from "sharp";
import { migrateDatabase } from "../../db/migration-helper";
import { initialReview } from "./normalize";
import { commitReview } from "./service";
import type { Extraction } from "./contracts";

test("isolated upload/extract/review lifecycle, source deletion, expiry and failed extraction", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "convener-import-"));
  const filename = path.join(directory, "test.db");
  process.env.CONVENER_DB_PATH = filename;
  process.env.RESULTS_IMPORT_DIR = path.join(directory, "sources");
  process.env.OPENAI_API_KEY = "test-key-not-a-secret";
  const db = new Database(filename);
  migrateDatabase(db);
  const originalFetch = globalThis.fetch;
  try {
    const routes = await import("../../app/api/results-imports/[[...parts]]/route");
    const context = (parts: string[]) => ({ params: Promise.resolve({ parts }) });
    const url = "http://127.0.0.1:3000/api/results-imports";
    const post = (parts: string[], input: unknown) => routes.POST(new Request(`${url}/${parts.join("/")}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
    }), context(parts));
    const image = await sharp({ create: { width: 800, height: 1100, channels: 3, background: "white" } }).png().toBuffer();
    const upload = async () => {
      const form = new FormData();
      form.set("file", new File([new Uint8Array(image)], "synthetic.png", { type: "image/png" }));
      const response = await routes.POST(new Request(url, { method: "POST", body: form }), context([]));
      const result = await response.json();
      assert.equal(response.status, 200, JSON.stringify(result));
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
    globalThis.fetch = async (target) => {
      assert.equal(target, "https://api.openai.com/v1/responses");
      return Response.json({ status: "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify(extraction) }] }] });
    };
    assert.equal((await post([id, "extract"], { consent: true })).status, 200);
    const review = initialReview(extraction, [], "right");
    review.newClubName = "Visitors";
    review.rows[0].reviewed = true;
    review.rows[0].players.forEach((person) => { person.create = true; });
    const prepared = await post([id, "review"], review);
    assert.equal(prepared.status, 200, JSON.stringify(await prepared.clone().json()));
    assert.equal((await post([id, "draft"], review)).status, 400, "autosave must not overwrite a prepared snapshot");
    assert.equal((await routes.GET(new Request(`${url}/${id}/pages/1`), context([id, "pages", "1"]))).status, 200);
    assert.equal((await routes.DELETE(new Request(`${url}/${id}`, { method: "DELETE" }), context([id]))).status, 200);
    assert.equal((await readdir(process.env.RESULTS_IMPORT_DIR)).length, 0);
    assert.equal((db.prepare("SELECT COUNT(*) count FROM matches").get() as { count: number }).count, 0);

    const successful = await upload();
    assert.equal((await post([successful, "extract"], { consent: true })).status, 200);
    const finalReview = await (await post([successful, "review"], review)).json();
    commitReview(db, successful, finalReview.preview.version, []);
    await routes.GET(new Request(url), context([]));
    assert.equal((await readdir(process.env.RESULTS_IMPORT_DIR)).length, 0, "committed source files must be purged");
    assert.equal((await routes.GET(new Request(`${url}/${successful}/pages/1`), context([successful, "pages", "1"]))).status, 400);
    const committed = await (await routes.GET(new Request(`${url}/${successful}`), context([successful]))).json();
    assert.equal(committed.status, "committed");
    assert.equal(committed.data.extraction, undefined);
    assert.equal(committed.data.review, undefined);

    const failed = await upload();
    globalThis.fetch = async () => Response.json({}, { status: 429 });
    assert.equal((await post([failed, "extract"], { consent: true })).status, 400);
    assert.equal((await readdir(process.env.RESULTS_IMPORT_DIR)).length, 0);
    assert.equal((db.prepare("SELECT status FROM result_imports WHERE id = ?").get(failed) as { status: string }).status, "failed");
    const expired = await upload();
    db.prepare("UPDATE result_imports SET expires_at = '2000-01-01' WHERE id = ?").run(expired);
    await routes.GET(new Request(url), context([]));
    assert.equal(db.prepare("SELECT id FROM result_imports WHERE id = ?").get(expired), undefined);
    assert.equal((await readdir(process.env.RESULTS_IMPORT_DIR)).length, 0);
    const denied = await routes.GET(new Request(url, { headers: { Origin: "https://example.invalid" } }), context([]));
    assert.equal(denied.status, 400);
  } finally {
    globalThis.fetch = originalFetch;
    db.close();
    // Close the application connection before removing this test's named directory.
    const { client } = await import("./store");
    client.close();
    await rm(directory, { recursive: true, force: true });
  }
});
