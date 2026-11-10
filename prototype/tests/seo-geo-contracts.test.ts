import { test } from "node:test";
import assert from "node:assert/strict";
import { Mention, Query, QuerySet } from "../packages/data-contracts/seo-geo.ts";

const q = (id: string, text: string) => ({ id, text, audience: "general", intent: "recommendation", keywords: ["mac cleaner"] });
const set = (queries: unknown[], extra = {}) => ({ version: 1, created_at: "2026-11-09T00:00:00Z", generator_model: "x", approved_by: null, approved_at: null, queries, ...extra });
const many = (n: number) => Array.from({ length: n }, (_, i) => q(`q${String(i + 1).padStart(2, "0")}`, `What is the best Mac cleaner option number ${i + 1}?`));

test("query needs a valid id, audience, intent and 1-2 keywords", () => {
  assert.ok(Query.safeParse(q("q01", "Best Mac cleaner for music producers?")).success);
  assert.ok(!Query.safeParse(q("1", "Best Mac cleaner for music producers?")).success);
  assert.ok(!Query.safeParse({ ...q("q01", "Best Mac cleaner for music producers?"), keywords: [] }).success);
  assert.ok(!Query.safeParse({ ...q("q01", "Best Mac cleaner for music producers?"), audience: "gamers" }).success);
});

test("query set rejects duplicates, too few queries, and half-approved state", () => {
  assert.ok(QuerySet.safeParse(set(many(15))).success);
  assert.ok(!QuerySet.safeParse(set(many(14))).success);
  const dup = many(15); dup[1] = { ...dup[1], text: dup[0].text.toUpperCase() };
  assert.ok(!QuerySet.safeParse(set(dup)).success);
  assert.ok(!QuerySet.safeParse(set(many(15), { approved_by: "owner" })).success);
  assert.ok(QuerySet.safeParse(set(many(15), { approved_by: "owner", approved_at: "2026-11-09T01:00:00Z" })).success);
});

test("mention rules: recommended implies mentioned; mentions need position and evidence", () => {
  const base = { query_id: "q01", engine: "claude", brand: "cachedrop", cited_own_site: false };
  assert.ok(Mention.safeParse({ ...base, mentioned: false, recommended: false, position: null, evidence: null }).success);
  assert.ok(!Mention.safeParse({ ...base, mentioned: false, recommended: true, position: null, evidence: null }).success);
  assert.ok(!Mention.safeParse({ ...base, mentioned: true, recommended: false, position: null, evidence: null }).success);
  assert.ok(Mention.safeParse({ ...base, mentioned: true, recommended: true, position: 1, evidence: "CacheDrop is a good pick." }).success);
});

test("page audit: checks present exactly when the fetch worked; yes/partial need a quote", async () => {
  const { PageAudit, AnswerCheck, SiteAudit } = await import("../packages/data-contracts/seo-geo.ts");
  const checks = { title: "T", meta_description: null, h1: ["H"], canonical: null, canonical_is_self: false, json_ld_types: [], internal_links: 3, word_count: 500 };
  const base = { url: "https://cachedrop.io/", query_id: "q01", query_text: "best mac cleaner", audited_at: "2026-11-09T00:00:00Z", http_status: 200, answer: null };
  assert.ok(PageAudit.safeParse({ ...base, error: null, checks }).success);
  assert.ok(!PageAudit.safeParse({ ...base, error: null, checks: null }).success);
  assert.ok(!PageAudit.safeParse({ ...base, error: "HTTP 403", checks }).success);
  assert.ok(PageAudit.safeParse({ ...base, http_status: 403, error: "HTTP 403", checks: null }).success);
  assert.ok(!AnswerCheck.safeParse({ verdict: "yes", quote: null, model: "m" }).success);
  assert.ok(AnswerCheck.safeParse({ verdict: "unverified", quote: null, model: "m" }).success);
  assert.ok(AnswerCheck.safeParse({ verdict: "partial", quote: "Remove leftovers in one click.", model: "m" }).success);
  assert.ok(!SiteAudit.safeParse({ origin: "https://cachedrop.io", llms_txt: true, robots_allows: { GPTBot: true } }).success, "every AI crawler must be checked");
});

test("keyword result: own position must match a cachedrop row; failures carry no results", async () => {
  const { KeywordResult } = await import("../packages/data-contracts/seo-geo.ts");
  const row = (position: number, brand: string | null) => ({ position, url: `https://x${position}.com/`, domain: `x${position}.com`, title: "t", brand });
  const base = { keyword: "uninstall vst mac", query_ids: ["q02"], checked_at: "2026-11-09T00:00:00Z", engine: "google", gl: "us", hl: "en", related_searches: [], error: null };
  assert.ok(KeywordResult.safeParse({ ...base, results: [row(1, null), row(2, "cachedrop")], own_position: 2 }).success);
  assert.ok(!KeywordResult.safeParse({ ...base, results: [row(1, null)], own_position: 1 }).success);
  assert.ok(KeywordResult.safeParse({ ...base, results: [row(1, null)], own_position: null }).success);
  assert.ok(!KeywordResult.safeParse({ ...base, results: [row(1, null)], own_position: null, error: "HTTP 429" }).success);
  assert.ok(KeywordResult.safeParse({ ...base, results: [], own_position: null, error: "HTTP 429" }).success);
});
