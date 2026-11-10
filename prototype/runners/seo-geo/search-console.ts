// Search Console Reader (docs/seo-growth-plan.md, agent A; P1). Code only, no model, $0.
// Weekly: Google Search Console for the last 28 days (ending 3 days ago) and the 28 before, per site locale; URL Inspection for
// every sitemap page; Bing Webmaster site totals and inbound links.
// Committed: research/search-console/runs/<run>/summary.json + report.md: counts and page paths only.
// Git-ignored: research/search-console/private/<run>/: raw rows and query-level lists (owner, 2026-11-10: query text stays local).
// Usage: node --env-file=.env runners/seo-geo/search-console.ts [--no-inspect]
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Locale } from "../../packages/data-contracts/seo-geo.ts";
import { SearchConsoleSummary } from "../../packages/data-contracts/search.ts";
import { bing, gsc, gscSiteUrl, gscToken } from "../../packages/search-access/index.ts";
import { issueParams, paperclipEnabled, reportCost, reportToIssue } from "../../packages/paperclip-client/index.ts";
import { indexing, localeOfPage, privateDetail, sitemapUrls, summarize, totals, windows, type Inspection, type Row } from "./search-console-checks.ts";
import { renderSearchConsole, renderSearchConsolePrivate } from "./search-console-report.ts";

const root = new URL("../../", import.meta.url).pathname;
const SITE = process.env.GSC_SITE ?? "sc-domain:cachedrop.io";
const ORIGIN = "https://cachedrop.io";
const runId = process.env.PAPERCLIP_RUN_ID ?? `local-${randomUUID().slice(0, 8)}`;
const t0 = Date.now();
let issue: { id: string; identifier?: string } | null = null;
let exitCode = 1;

async function allRows(token: string, body: Record<string, unknown>): Promise<Row[]> {
  const out: Row[] = [];
  for (let startRow = 0; ; startRow += 25000) {
    const r = await gsc<{ rows?: Row[] }>(token, `${gscSiteUrl(SITE)}/searchAnalytics/query`, { ...body, rowLimit: 25000, startRow, dataState: "final" });
    out.push(...(r.rows ?? []));
    if ((r.rows?.length ?? 0) < 25000) return out;
  }
}

async function inspect(token: string, url: string): Promise<Inspection> {
  try {
    const r = await gsc<any>(token, "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", { inspectionUrl: url, siteUrl: SITE });
    const s = r.inspectionResult?.indexStatusResult ?? {};
    return { url, verdict: s.verdict ?? null, coverage: s.coverageState ?? null, last_crawl: s.lastCrawlTime ?? null, error: null };
  } catch (e) { return { url, verdict: null, coverage: null, last_crawl: null, error: (e as Error).message.slice(0, 120) }; }
}

/** Bing: site-wide only (it has no per-language split worth having at this size). Each call is independent; a failure leaves its field null. */
async function bingFacts(start: string, end: string) {
  const tryOr = async <T>(f: () => Promise<T>): Promise<T | null> => { try { return await f(); } catch (e) { console.error("bing:", (e as Error).message); return null; } };
  const days = await tryOr(() => bing<{ Date: string; Clicks: number; Impressions: number }[]>("GetRankAndTrafficStats", { siteUrl: `${ORIGIN}/` }));
  const inWindow = days?.filter(d => { const t = new Date(Number(/\d+/.exec(d.Date)?.[0])).toISOString().slice(0, 10); return t >= start && t <= end; }) ?? null;
  const queries = await tryOr(() => bing<unknown[]>("GetQueryStats", { siteUrl: `${ORIGIN}/` }));
  const links = await tryOr(() => bing<{ Links: { Url: string; Count: number }[]; TotalPages: number }>("GetLinkCounts", { siteUrl: `${ORIGIN}/`, page: "0" }));
  return {
    clicks: inWindow ? inWindow.reduce((s, d) => s + d.Clicks, 0) : null,
    impressions: inWindow ? inWindow.reduce((s, d) => s + d.Impressions, 0) : null,
    queries: queries?.length ?? null,
    pages_with_inbound_links: links ? links.Links.length : null,
    inbound_links: links ? links.Links.reduce((s, l) => s + l.Count, 0) : null,
  };
}

try {
  issue = (await issueParams()).issue;
  const token = await gscToken();
  const w = windows(new Date());
  const sitemap = sitemapUrls(await (await fetch(`${ORIGIN}/sitemap.xml`, { signal: AbortSignal.timeout(30000) })).text());
  if (!sitemap.length) throw new Error("sitemap.xml has no <loc> entries");
  const locales = Locale.options.filter(l => sitemap.some(u => localeOfPage(u) === l)); // the site's locales follow its sitemap (de-DE appears when it ships)

  const siteTotals = async (win: { start: string; end: string }) => totals(await allRows(token, { startDate: win.start, endDate: win.end }));
  const [site_totals, previous_site_totals] = await Promise.all([siteTotals(w.current), siteTotals(w.previous)]);
  const [pageRows, queryRows, prevPageRows, prevQueryRows] = await Promise.all([
    allRows(token, { startDate: w.current.start, endDate: w.current.end, dimensions: ["page"] }),
    allRows(token, { startDate: w.current.start, endDate: w.current.end, dimensions: ["query", "page", "country"] }),
    allRows(token, { startDate: w.previous.start, endDate: w.previous.end, dimensions: ["page"] }),
    allRows(token, { startDate: w.previous.start, endDate: w.previous.end, dimensions: ["query", "page", "country"] }),
  ]);
  const inspections: Inspection[] = [];
  if (!process.argv.includes("--no-inspect")) for (const u of sitemap) inspections.push(await inspect(token, u)); // sequential: quota is per minute

  const summary = SearchConsoleSummary.parse({
    run_id: runId, site: SITE, window: w.current, previous_window: w.previous, site_totals, previous_site_totals, locales: summarize(locales, pageRows, queryRows, prevPageRows, prevQueryRows),
    indexing: inspections.length ? indexing(locales, inspections) : null, bing: await bingFacts(w.current.start, w.current.end),
    inspection_errors: inspections.filter(i => i.error).length, cost_usd: 0, seconds: Math.round((Date.now() - t0) / 1000), finished_at: new Date().toISOString(),
  });
  const detail = privateDetail(locales, queryRows, prevQueryRows);

  const out = join(root, "research/search-console/runs", runId), priv = join(root, "research/search-console/private", runId);
  mkdirSync(out, { recursive: true }); mkdirSync(priv, { recursive: true });
  writeFileSync(join(out, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
  const md = renderSearchConsole(summary);
  writeFileSync(join(out, "report.md"), `# Search Console run ${runId}\n\n${md}`);
  writeFileSync(join(priv, "rows.json"), JSON.stringify({ pageRows, queryRows, prevPageRows, prevQueryRows, inspections }, null, 1) + "\n");
  writeFileSync(join(priv, "detail.json"), JSON.stringify(detail, null, 2) + "\n");
  const privMd = renderSearchConsolePrivate(detail);
  writeFileSync(join(priv, "report.md"), privMd);
  console.log(md);

  if (paperclipEnabled()) await reportCost(issue?.id ?? null, "search-console", { input_tokens: 0, output_tokens: 0 }, 0).catch(e => console.error("cost report failed:", e.message));
  // The Paperclip issue is local (127.0.0.1), so it may carry the query-level lists; the committed files never do.
  if (issue) await reportToIssue(issue.id, `${md}\n${privMd}\nCommitted: research/search-console/runs/${runId}/ · local only: research/search-console/private/${runId}/`, "done");
  exitCode = 0;
} catch (e) {
  console.error("Search Console run FAILED:", (e as Error).message);
  if (issue) await reportToIssue(issue.id, `Search Console run failed: ${(e as Error).message}`, "blocked").catch(() => {});
}
process.exit(exitCode);
