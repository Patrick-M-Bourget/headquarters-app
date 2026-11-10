import { test } from "node:test";
import assert from "node:assert/strict";
import { Observation } from "../packages/data-contracts/index.ts";

test("verified observation requires source and evidence", () => {
  assert.equal(Observation.safeParse({ competitor_id: "a", field: "pricing_model", value: "free", status: "verified", source_id: null, evidence: null }).success, false);
  assert.equal(Observation.safeParse({ competitor_id: "a", field: "pricing_model", value: "free", status: "verified", source_id: "s1", evidence: "Free download" }).success, true);
  assert.equal(Observation.safeParse({ competitor_id: "a", field: "pricing_model", value: null, status: "unknown", source_id: null, evidence: null }).success, true);
});

test("unknown fields are rejected", () => {
  assert.equal(Observation.safeParse({ competitor_id: "a", field: "made_up", value: 1, status: "unknown", source_id: null, evidence: null }).success, false);
});
