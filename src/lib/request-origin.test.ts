import assert from "node:assert/strict";
import test from "node:test";
import { assertAppRequest } from "./request-origin";

test("allows actual project deployment origins and rejects unrelated Vercel or cross-origin hosts", () => {
  const previous = process.env.VERCEL_URL;
  process.env.VERCEL_URL = "convener-specific.vercel.app";
  try {
    assert.doesNotThrow(() => assertAppRequest("convener-specific.vercel.app", new Headers({ origin: "https://convener-specific.vercel.app" })));
    assert.throws(() => assertAppRequest("unrelated.vercel.app", new Headers()), /not configured/);
    assert.throws(() => assertAppRequest("convener-specific.vercel.app", new Headers({ origin: "https://unrelated.vercel.app" })), /Cross-origin/);
    assert.throws(() => assertAppRequest("convener-specific.vercel.app", new Headers({ "sec-fetch-site": "cross-site" })), /Cross-origin/);
  } finally {
    if (previous === undefined) delete process.env.VERCEL_URL; else process.env.VERCEL_URL = previous;
  }
});
