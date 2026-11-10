import { test } from "node:test";
import assert from "node:assert/strict";
import { bands, indexing, localeOfPage, privateDetail, sitemapUrls, summarize, totals, windows, type Row } from "../runners/seo-geo/search-console-checks.ts";
import { SearchConsoleSummary } from "../packages/data-contracts/search.ts";
import { renderSearchConsole } from "../runners/seo-geo/search-console-report.ts";

const S = "https://cachedrop.io";
const row = (keys: string[], clicks: number, impressions: number, position: number): Row => ({ keys, clicks, impressions, ctr: impressions ? clicks / impressions : 0, position });

test("locale comes from the page path prefix", () => {
  assert.equal(localeOfPage(`${S}/`), "en-US");
  assert.equal(localeOfPage(`${S}/pricing/`), "en-US");
  assert.equal(localeOfPage(`${S}/fr/`), "fr-FR");
  assert.equal(localeOfPage(`${S}/fr/uninstall-apps-mac/`), "fr-FR");
  assert.equal(localeOfPage(`${S}/de/uninstall-apps-mac/`), "de-DE");
  assert.equal(localeOfPage(`${S}/france-guide/`), "en-US"); // a prefix must be a whole segment
});

test("windows: 28 days ending 3 days back, and the 28 before", () => {
  const w = windows(new Date("2026-11-10T14:00:00Z"));
  assert.deepEqual(w.current, { start: "2026-10-11", end: "2026-11-07" });
  assert.deepEqual(w.previous, { start: "2026-09-13", end: "2026-10-10" });
});

test("totals weight position by impressions", () => {
  const t = totals([row(["a"], 1, 10, 5), row(["b"], 0, 30, 25)]);
  assert.equal(t.clicks, 1); assert.equal(t.impressions, 40); assert.equal(t.position, 20); assert.equal(t.ctr, 0.025);
  assert.equal(totals([]).position, null);
});

test("bands", () => assert.deepEqual(bands([1, 10, 10.5, 20, 21, 50, 51]), { top10: 2, p11_20: 2, p21_50: 2, p51_plus: 1 }));

const queryRows = [
  row(["mac cleaner", `${S}/`, "usa"], 1, 20, 12),
  row(["mac cleaner", `${S}/`, "can"], 0, 20, 8), // same query, other country: merged, weighted position 10
  row(["vider cache adobe", `${S}/fr/clear-adobe-media-cache-mac/`, "fra"], 0, 5, 40),
  row(["secret query", `${S}/pricing/`, "usa"], 0, 3, 70),
];
const pageRows = [row([`${S}/`], 1, 50, 10), row([`${S}/pricing/`], 0, 3, 70), row([`${S}/fr/clear-adobe-media-cache-mac/`], 0, 6, 40)];

test("summarize: counts per locale, no query text", () => {
  const [en, fr] = summarize(["en-US", "fr-FR"], pageRows, queryRows, null, null);
  assert.equal(en.queries, 2); // "mac cleaner" merged across countries
  assert.deepEqual(en.query_bands, { top10: 1, p11_20: 0, p21_50: 0, p51_plus: 1 });
  assert.equal(en.striking_queries, 1);
  assert.equal(en.totals.impressions, 53);
  assert.deepEqual(en.pages_no_clicks, ["/pricing/"]);
  assert.equal(fr.queries, 1); assert.equal(fr.striking_queries, 0);
  assert.equal(en.previous_totals, null);
  assert.ok(!JSON.stringify([en, fr]).includes("secret query"), "query text must never reach the committed summary");
});

test("privateDetail lists striking queries and new/lost against the previous window", () => {
  const [en] = privateDetail(["en-US"], queryRows, [row(["old query", `${S}/`, "usa"], 0, 4, 30)]);
  assert.deepEqual(en.striking.map(s => s.query), ["mac cleaner"]);
  assert.equal(en.striking[0].position, 10);
  assert.deepEqual(en.new_queries, ["mac cleaner", "secret query"]);
  assert.deepEqual(en.lost_queries, ["old query"]);
});

test("sitemap and indexing", () => {
  assert.deepEqual(sitemapUrls(`<urlset><url><loc>${S}/</loc><xhtml:link href="${S}/fr/"/></url><url><loc> ${S}/fr/ </loc></url></urlset>`), [`${S}/`, `${S}/fr/`]);
  const [en, fr] = indexing(["en-US", "fr-FR"], [
    { url: `${S}/`, verdict: "PASS", coverage: "Submitted and indexed", last_crawl: null, error: null },
    { url: `${S}/fr/`, verdict: "NEUTRAL", coverage: "Discovered - currently not indexed", last_crawl: null, error: null },
    { url: `${S}/fr/pricing/`, verdict: null, coverage: null, last_crawl: null, error: "HTTP 429" },
  ]);
  assert.deepEqual([en.indexed, en.submitted], [1, 1]);
  assert.deepEqual(fr.not_indexed, [{ path: "/fr/", coverage: "Discovered - currently not indexed" }, { path: "/fr/pricing/", coverage: "error: HTTP 429" }]);
});

test("the summary contract rejects extra fields (e.g. query lists) and the report renders", () => {
  const base = { run_id: "r", site: "sc-domain:cachedrop.io", window: { start: "2026-10-11", end: "2026-11-07" }, previous_window: { start: "2026-09-13", end: "2026-10-10" },
    site_totals: totals(pageRows.slice(0, 1)), previous_site_totals: totals([]),
    locales: summarize(["en-US"], pageRows, queryRows, pageRows, []), indexing: null,
    bing: { clicks: 0, impressions: 0, queries: 0, pages_with_inbound_links: 0, inbound_links: 0 }, inspection_errors: 0, cost_usd: 0, seconds: 1, finished_at: "2026-11-10T00:00:00Z" };
  const s = SearchConsoleSummary.parse(base);
  assert.equal(SearchConsoleSummary.safeParse({ ...base, striking: [{ query: "x" }] }).success, false);
  const md = renderSearchConsole(s);
  assert.match(md, /\| en-US \| 1 \(±0\) \| 53 \(±0\) \|/);
  assert.match(md, /Whole site \(matches the Search Console UI\): 1 \(\+1\) clicks, 50 \(\+50\) impressions/);
  assert.ok(!md.includes("secret query"));
});
