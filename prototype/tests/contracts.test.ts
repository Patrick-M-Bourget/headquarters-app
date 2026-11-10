import { test } from "node:test";
import assert from "node:assert/strict";
import { Observation } from "../packages/data-contracts/index.ts";

test("verified observation requires source and evidence", () => {
  assert.equal(Observation.safeParse({ competitor_id: "a", field: "pricing_model", value: "free", status: "verified", source_id: null, evidence: null }).success, false);
  assert.equal(Observation.safeParse({ competitor_id: "a", field: "pricing_model", value: "free", status: "verified", source_id: "s1", evidence: "Free download" }).success, true);
  assert.equal(Observation.safeParse({ competitor_id: "a", field: "pricing_model", value: null, status: "unknown", source_id: null, evidence: null }).success, true);
});

const base = { competitor_id: "a", status: "unknown", source_id: null, evidence: null } as const;

test("channel accepts known values and null, rejects others", () => {
  for (const channel of ["direct", "mac_app_store", "setapp", null])
    assert.equal(Observation.safeParse({ ...base, field: "price_one_time_usd", value: 10, channel }).success, true);
  for (const channel of ["steam", "", "Direct"])
    assert.equal(Observation.safeParse({ ...base, field: "price_one_time_usd", value: 10, channel }).success, false);
});

test("observation without channel is still valid", () => {
  assert.equal(Observation.safeParse({ ...base, field: "price_one_time_usd", value: 10 }).success, true);
});

test("distribution accepts open_source_and_app_store", () => {
  assert.equal(Observation.safeParse({ ...base, field: "distribution", value: "open_source_and_app_store" }).success, true);
});

test("unknown fields are rejected", () => {
  assert.equal(Observation.safeParse({ competitor_id: "a", field: "made_up", value: 1, status: "unknown", source_id: null, evidence: null }).success, false);
});
