import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReport, dueLocales, gapSignature, isVendorSite, pickRuns, proposals, renderReport, stage1, stage2, weekOf, type LocaleFacts, type Run } from "../runners/seo-geo/weekly-report.ts";
import { parseParams } from "../packages/paperclip-client/index.ts";

const root = new URL("../", import.meta.url).pathname;

test("week starts on Monday (UTC); the monthly markets run in the month's first week only", () => {
  assert.equal(weekOf(new Date("2026-11-10T20:00:00Z")), "2026-11-09");
  assert.equal(weekOf(new Date("2026-11-09T00:00:00Z")), "2026-11-09");
  assert.equal(weekOf(new Date("2026-11-15T23:59:00Z")), "2026-11-09");
  assert.deepEqual(dueLocales("2026-11-09"), ["en-US", "fr-FR"]);
  assert.equal(dueLocales("2026-12-07").length, 6);
  assert.deepEqual(dueLocales("2026-12-14"), ["en-US", "fr-FR"]);
});

test("stage 1: Search Console once, GEO and keywords per locale, on-page only where the site has pages", () => {
  const t = stage1(["en-US", "de-DE"], "2026-11-09");
  assert.deepEqual(t.map(x => `${x.agent}/${x.params.locale}`), ["Search Console Reader/undefined", "GEO Tracker/en-US", "Keyword Tracker/en-US", "On-page Auditor/en-US", "GEO Tracker/de-DE", "Keyword Tracker/de-DE"]);
});

test("stage 2: optimizer only when gaps changed beyond numbers; funnel only with a CSV", () => {
  const prev = ["/: 1060 words vs competitor median 3188", "/pricing/: title is 70 chars"];
  const noise = ["/: 1065 words vs competitor median 3194", "/pricing/: title is 70 chars"];
  assert.deepEqual(gapSignature(prev), gapSignature(noise));
  assert.equal(stage2([{ locale: "en-US", dir: "d", gaps: noise, previousGaps: prev }], "2026-11-09", null).length, 0);
  const changed = stage2([{ locale: "en-US", dir: "research/x", gaps: [...noise, "/pricing/: meta description is 200 chars"], previousGaps: prev }], "2026-11-09", "research/marketing/funnel/2026-11-09.csv");
  assert.deepEqual(changed.map(t => t.agent), ["On-page Optimizer", "Funnel Analyst"]);
  assert.equal(changed[0].params.run, "research/x");
  assert.equal(stage2([{ locale: "fr-FR", dir: "d", gaps: prev, previousGaps: null }], "w", null).length, 1); // first audit
  const churn = ["/: JSON-LD types used by 2+ competitors but not here: Article", "/pricing/: title is 70 chars"];
  const before = ["/: JSON-LD types used by 2+ competitors but not here: BreadcrumbList, BlogPosting", "/pricing/: title is 70 chars"];
  assert.equal(stage2([{ locale: "en-US", dir: "d", gaps: churn, previousGaps: before }], "w", null).length, 0); // competitor churn only
});

test("issue parameters: key: value lines, backticks and list bullets allowed, prose ignored", () => {
  const p = parseParams("GEO tracker · fr-FR\nlocale: fr-FR\n- `run`: `research/seo-geo/onpage-runs/abc`\nstage: 1\n\nSubtask of the weekly report HEA-20. Parameters are the lines above.\nlocale: de-DE");
  assert.deepEqual(p, { locale: "fr-FR", run: "research/seo-geo/onpage-runs/abc", stage: "1" });
});

const run = (o: Partial<Run>): Run => ({ kind: "geo", run_id: "x", locale: "en-US", dir: "d", finished_at: "2026-11-10T00:00:00Z", full: true, group: "g", summary: {}, ...o });

test("a relabel replaces the run it re-judged; partial runs never count", () => {
  const runs = [
    run({ run_id: "w1", group: "2026-11-02", finished_at: "2026-11-02T10:00:00Z" }),
    run({ run_id: "w2", group: "2026-11-09", finished_at: "2026-11-09T10:00:00Z" }),
    run({ run_id: "w2-relabel", group: "2026-11-09", finished_at: "2026-11-10T10:00:00Z" }),
    run({ run_id: "trial", group: "2026-11-11", finished_at: "2026-11-11T10:00:00Z", full: false }),
    run({ run_id: "fr", locale: "fr-FR", group: "2026-11-12" }),
  ];
  const p = pickRuns(runs, "geo", "en-US");
  assert.equal(p.current?.run_id, "w2-relabel");
  assert.equal(p.previous?.run_id, "w1");
});

const facts = (o: Partial<LocaleFacts> & { locale: LocaleFacts["locale"] }): LocaleFacts => ({ stale: [], missing: [], geo: null, keywords: null, onpage: null, ...o });
const geo = (o: Partial<NonNullable<LocaleFacts["geo"]>>): NonNullable<LocaleFacts["geo"]> => ({ run: "r", previous: null, n: 50, recommended: 0, mentioned: 0, cited: 0, d_recommended: null, d_mentioned: null,
  competitors: [], cited_domains: [], cachedrop_mentions: [], gaps: [], cost_usd: 0, finished_at: "2026-11-10", ...o });

test("proposals: regressions and openings first, one page gap per site locale, then the most-cited outside source; ledger keys skipped", () => {
  const f = [
    facts({ locale: "en-US", geo: geo({ run: "g2", previous: "g1", recommended: 1, d_recommended: -2, gaps: [{ query_id: "q19", text: "a", competitors: 9 }, { query_id: "q16", text: "b", competitors: 5 }],
      cited_domains: [["reddit.com", 4], ["cleanmymac.com", 9], ["github.com", 3], ["cachedrop.io", 9]] }),
      onpage: { run: "o", previous: null, pages: 1, own: {}, gaps: 0, new_gaps: [], fixed_gaps: [], no_answer: [{ url: "https://cachedrop.io/pricing/", query_id: "q21", query_text: "t" }, { url: "https://cachedrop.io/", query_id: "q01", query_text: "t" }], cost_usd: 0, finished_at: "", dir: "", gap_list: [], previous_gap_list: null } }),
    facts({ locale: "fr-FR", geo: geo({ gaps: [{ query_id: "q25", text: "c", competitors: 3 }], cited_domains: [["reddit.com", 2], ["github.com", 1]] }) }),
    facts({ locale: "de-DE", geo: geo({ cited_domains: [["macuser.de", 50]] }) }), // one market only: not proposed
  ];
  const ledger = [{ key: "opening:https://cachedrop.io/", status: "decision" as const, ref: "D51", date: "2026-11-10" }];
  const p = proposals(f, ledger);
  assert.deepEqual(p.map(x => x.key), ["regression:en-US:geo:g2", "opening:https://cachedrop.io/pricing/", "page:en-US:q19", "page:fr-FR:q25", "cite:reddit.com"]);
  assert.match(p[0].why, /1\/50 .*2 fewer than g1/);
  assert.equal(proposals(f, [...ledger, ...p.map(x => ({ key: x.key, status: "ticketed" as const, ref: "#1", date: "" }))])[0].key, "page:en-US:q16");
});

test("vendor sites: tracked domains and product names in the domain; GitHub stays a source", () => {
  assert.ok(isVendorSite("macpaw.com"));
  assert.ok(isVendorSite("cleanmymac.jp"));
  assert.ok(isVendorSite("devcleaner.app"));
  assert.ok(isVendorSite("cachedrop.io"));
  assert.ok(!isVendorSite("github.com"));
  assert.ok(!isVendorSite("reddit.com"));
});

test("report from the saved baselines: six markets, counts match the run summaries", () => {
  const r = buildReport(root, "2026-11-09", undefined, [], new Date("2026-11-10T12:00:00Z"));
  assert.equal(r.locales.length, 6);
  const ja = r.locales.find(l => l.locale === "ja-JP")!;
  assert.equal(ja.geo?.n, 50);
  assert.equal(ja.geo?.mentioned, 1);
  assert.equal(ja.onpage, null);
  assert.ok(r.locales.find(l => l.locale === "en-US")!.onpage);
  assert.ok(r.proposals.length >= 3 && r.proposals.length <= 5);
  const md = renderReport(r);
  assert.match(md, /\| ja-JP \| 0\/50 \(0%\) \| 1 \|/);
});
