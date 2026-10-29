import assert from "node:assert/strict";
import test from "node:test";
import { extractResults } from "./extract";

test("extracts a schema-validated proposal without enabling response storage", async () => {
  const originalFetch = globalThis.fetch;
  const key = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key-not-a-secret";
  const extraction = {
    date: null, leftTeam: "Team A", rightTeam: "Team B", venue: null, warnings: [],
    rows: [{
      page: 1, order: 1, tee: null, leftResult: null, rightResult: "A/S", warnings: [],
      left: [{ name: "A", handicap: null }, { name: "B", handicap: 0 }],
      right: [{ name: "C", handicap: 10 }, { name: "D", handicap: null }],
    }],
  };
  try {
    globalThis.fetch = async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.store, false);
      assert.equal(body.text.format.strict, true);
      assert.equal(body.input[0].content[1].type, "input_image");
      assert.equal(body.text.format.schema.properties.rows.items.properties.left.items.type, "object");
      return Response.json({ status: "completed", output: [{ content: [{ type: "output_text", text: JSON.stringify(extraction) }] }] });
    };
    assert.deepEqual((await extractResults([Buffer.from("synthetic image")])).extraction, extraction);
    globalThis.fetch = async () => Response.json({ status: "incomplete" });
    await assert.rejects(extractResults([Buffer.from("synthetic")]), /incomplete/);
    globalThis.fetch = async () => Response.json({}, { status: 429 });
    await assert.rejects(extractResults([Buffer.from("synthetic")]), /quota/);
    globalThis.fetch = async () => Response.json({ status: "completed", output: [{ content: [{ type: "output_text", text: "{}" }] }] });
    await assert.rejects(extractResults([Buffer.from("synthetic")]));
  } finally {
    globalThis.fetch = originalFetch;
    if (key === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = key;
  }
});
