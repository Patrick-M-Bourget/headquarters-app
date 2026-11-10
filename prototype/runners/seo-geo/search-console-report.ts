// Markdown for the Search Console Reader: `renderSearchConsole` (counts, committed; also the weekly report's section)
// and `renderSearchConsolePrivate` (query lists, local only: Paperclip issue and research/search-console/private/).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SearchConsoleSummary } from "../../packages/data-contracts/search.ts";
import type { PrivateDetail } from "./search-console-checks.ts";

const d = (a: number, b: number | null | undefined) => (b === null || b === undefined ? "" : a === b ? " (±0)" : a > b ? ` (+${a - b})` : ` (${a - b})`);
const pct = (x: number) => `${(100 * x).toFixed(1)}%`;

export function renderSearchConsole(s: SearchConsoleSummary): string {
  const L = [`**Google Search Console** ${s.window.start} → ${s.window.end} vs the 28 days before (data ends 3 days back).`, "",
    "| Market | Clicks | Impressions | CTR | Avg position | Queries | Top 10 | 11–20 | 21–50 | 51+ | Striking (8–30) |", "|---|---|---|---|---|---|---|---|---|---|---|"];
  for (const l of s.locales) {
    const t = l.totals, p = l.previous_totals, b = l.query_bands, pb = l.previous_query_bands;
    L.push(`| ${l.locale} | ${t.clicks}${d(t.clicks, p?.clicks)} | ${t.impressions}${d(t.impressions, p?.impressions)} | ${pct(t.ctr)} | ${t.position ?? "–"}${p?.position ? ` (was ${p.position})` : ""} | ${l.queries} | ${b.top10}${d(b.top10, pb?.top10)} | ${b.p11_20}${d(b.p11_20, pb?.p11_20)} | ${b.p21_50}${d(b.p21_50, pb?.p21_50)} | ${b.p51_plus}${d(b.p51_plus, pb?.p51_plus)} | ${l.striking_queries} |`);
  }
  L.push("", "Totals come from the page view (they include anonymized queries); query counts and bands only cover queries the API names.");
  for (const l of s.locales) if (l.pages_no_clicks.length) L.push(`- ${l.locale} pages with impressions and no clicks: ${l.pages_no_clicks.join(", ")}`);
  if (s.indexing) for (const i of s.indexing)
    L.push(`- ${i.locale} indexing: ${i.indexed}/${i.submitted} sitemap pages indexed${i.not_indexed.length ? `; not indexed: ${i.not_indexed.map(n => `${n.path} (${n.coverage ?? "unknown"})`).join(", ")}` : ""}.`);
  if (s.inspection_errors) L.push(`- URL Inspection failed for ${s.inspection_errors} page(s).`);
  const b = s.bing;
  L.push(`- **Bing** (site-wide, same window): ${b.clicks ?? "?"} clicks, ${b.impressions ?? "?"} impressions, ${b.queries ?? "?"} queries; inbound links ${b.inbound_links ?? "?"} to ${b.pages_with_inbound_links ?? "?"} page(s).`);
  return L.join("\n") + "\n";
}

export function renderSearchConsolePrivate(detail: PrivateDetail[]): string {
  const L = ["**Search Console queries (local only, never committed)**", ""];
  for (const x of detail) {
    L.push(`${x.locale}: ${x.striking.length} striking-distance queries${x.striking.length ? ":" : "."}`);
    for (const s of x.striking.slice(0, 15)) L.push(`- “${s.query}” → ${s.page} · position ${s.position}, ${s.impressions} impressions, ${s.clicks} clicks`);
    if (x.new_queries.length || x.lost_queries.length) L.push(`- New queries: ${x.new_queries.length}; lost: ${x.lost_queries.length}.`);
  }
  return L.join("\n") + "\n";
}

/** Latest Search Console summary written on or after `week` (Monday), or null. Used by the weekly report. */
export function latestSearchConsole(root: string, week: string): { summary: SearchConsoleSummary; privateMd: string | null } | null {
  const dir = join(root, "research/search-console/runs");
  if (!existsSync(dir)) return null;
  const runs = readdirSync(dir).filter(id => existsSync(join(dir, id, "summary.json")))
    .map(id => SearchConsoleSummary.parse(JSON.parse(readFileSync(join(dir, id, "summary.json"), "utf8"))))
    .filter(s => s.finished_at.slice(0, 10) >= week).sort((a, b) => (a.finished_at < b.finished_at ? 1 : -1));
  if (!runs.length) return null;
  const p = join(root, "research/search-console/private", runs[0].run_id, "report.md");
  return { summary: runs[0], privateMd: existsSync(p) ? readFileSync(p, "utf8") : null };
}
