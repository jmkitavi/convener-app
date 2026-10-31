import assert from "node:assert/strict";
import test from "node:test";
import { fixtureStatus } from "../app/fixtures/fixture-status";

test("only empty fixtures on or after today are scheduled; pending-only still has no results", () => {
  const fixture = { date: "2026-10-29", total: 0, wins: 0, losses: 0, halved: 0, pending: 0 };
  assert.equal(fixtureStatus(fixture, "2026-10-29"), "scheduled");
  assert.equal(fixtureStatus({ ...fixture, date: "2026-11-01" }, "2026-10-29"), "scheduled");
  assert.equal(fixtureStatus({ ...fixture, date: "2026-10-28" }, "2026-10-29"), "noresults");
  assert.equal(fixtureStatus({ ...fixture, total: 2, pending: 2 }, "2026-10-29"), "noresults");
  assert.equal(fixtureStatus({ ...fixture, total: 2, pending: 1, halved: 1 }, "2026-10-29"), "partial");
  assert.equal(fixtureStatus({ ...fixture, total: 1, halved: 1 }, "2026-10-29"), "recorded");
});
