import { test } from "node:test";
import assert from "node:assert/strict";
import { matches, score } from "../eval/score.ts";

test("matches numbers within 50 cents and string forms", () => {
  assert.ok(matches([39.95], 40));
  assert.ok(matches([39.95], "$39.95"));
  assert.ok(!matches([39.95], 49.95));
  assert.ok(matches(["yes"], "Yes"));
  assert.ok(matches(["free", "donation"], "donation"));
  assert.ok(matches([null], null));
  assert.ok(!matches([null], 9.99));
});

test("score classifies match, mismatch, unknown, missing", () => {
  const key = { a: { pricing_model: ["one_time"], price_one_time_usd: [10], feature_cleanup: ["yes"], distribution: ["direct"] } };
  const obs = [
    { competitor_id: "a", field: "pricing_model", value: "one_time", status: "verified", source_id: "s", evidence: "x" },
    { competitor_id: "a", field: "price_one_time_usd", value: 20, status: "verified", source_id: "s", evidence: "x" },
    { competitor_id: "a", field: "feature_cleanup", value: null, status: "unknown", source_id: null, evidence: null },
  ];
  const outcomes = Object.fromEntries(score(obs, key).map(r => [r.field, r.outcome]));
  assert.deepEqual(outcomes, { pricing_model: "match", price_one_time_usd: "mismatch", feature_cleanup: "agent_unknown", distribution: "missing" });
});
