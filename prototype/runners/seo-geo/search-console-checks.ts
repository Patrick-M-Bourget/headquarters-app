// Pure logic for the Search Console Reader (docs/seo-growth-plan.md, agent A). No network, no files.
// Public-repo rule (owner, 2026-11-10): query text never goes into a committed file. `summarize` returns counts and
// page paths only; `privateDetail` returns the query-level lists, which are written to a git-ignored folder.
import { Locale } from "../../packages/data-contracts/seo-geo.ts";
import { MARKETS } from "../../packages/data-contracts/markets.ts";

export type Row = { keys: string[]; clicks: number; impressions: number; ctr: number; position: number };

/** The site locale a cachedrop.io page belongs to, from its path prefix: /fr/… → fr-FR, /de/… → de-DE, anything else → en-US. */
export function localeOfPage(url: string): Locale {
  const seg = new URL(url).pathname.split("/")[1] ?? "";
  for (const l of Locale.options) if (l !== "en-US" && MARKETS[l].language === seg) return l;
  return "en-US";
}

/** Search Console's data is final after about 2 days; a 28-day window ending 3 days ago, and the 28 days before it. */
export function windows(now: Date): { current: { start: string; end: string }; previous: { start: string; end: string } } {
  const d = (offset: number) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offset)).toISOString().slice(0, 10);
  return { current: { start: d(30), end: d(3) }, previous: { start: d(58), end: d(31) } };
}

export type Totals = { clicks: number; impressions: number; ctr: number; position: number | null };
export type Bands = { top10: number; p11_20: number; p21_50: number; p51_plus: number };

/** Impression-weighted totals: Search Console's own average position is weighted the same way. */
export function totals(rows: Row[]): Totals {
  const clicks = rows.reduce((s, r) => s + r.clicks, 0), impressions = rows.reduce((s, r) => s + r.impressions, 0);
  return { clicks, impressions, ctr: impressions ? round(clicks / impressions, 4) : 0,
    position: impressions ? round(rows.reduce((s, r) => s + r.position * r.impressions, 0) / impressions, 1) : null };
}

const round = (n: number, p: number) => Number(n.toFixed(p));

/** Rows of query × page × country merged into one entry per (locale, query): weighted position, summed clicks and impressions, the page with most impressions. */
export function byQuery(rows: Row[]): Map<Locale, Map<string, { clicks: number; impressions: number; position: number; page: string }>> {
  const acc = new Map<Locale, Map<string, { clicks: number; impressions: number; wpos: number; pages: Map<string, number> }>>();
  for (const r of rows) {
    const [query, page] = r.keys;
    const l = localeOfPage(page);
    if (!acc.has(l)) acc.set(l, new Map());
    const m = acc.get(l)!;
    const e = m.get(query) ?? { clicks: 0, impressions: 0, wpos: 0, pages: new Map() };
    e.clicks += r.clicks; e.impressions += r.impressions; e.wpos += r.position * r.impressions;
    e.pages.set(page, (e.pages.get(page) ?? 0) + r.impressions);
    m.set(query, e);
  }
  const out = new Map<Locale, Map<string, { clicks: number; impressions: number; position: number; page: string }>>();
  for (const [l, m] of acc) out.set(l, new Map([...m].map(([q, e]) => [q, {
    clicks: e.clicks, impressions: e.impressions, position: round(e.impressions ? e.wpos / e.impressions : 0, 1),
    page: [...e.pages].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0][0],
  }])));
  return out;
}

export function bands(positions: number[]): Bands {
  const b: Bands = { top10: 0, p11_20: 0, p21_50: 0, p51_plus: 0 };
  for (const p of positions) p <= 10 ? b.top10++ : p <= 20 ? b.p11_20++ : p <= 50 ? b.p21_50++ : b.p51_plus++;
  return b;
}

/** Striking distance (plan agent A): positions 8–30, where a page change can still move a query onto page one. */
export const STRIKING = { min: 8, max: 30 };

export type LocaleSummary = {
  locale: Locale;
  totals: Totals;                 // from the page dimension: includes anonymized queries, closest to the Search Console UI
  previous_totals: Totals | null; // same, the 28 days before
  queries: number;                // distinct queries with impressions (anonymized queries are not in the API)
  query_bands: Bands;
  previous_query_bands: Bands | null;
  striking_queries: number;
  pages_with_impressions: number;
  pages_no_clicks: string[];      // paths only
};

/** Counts per locale: safe to commit. */
export function summarize(locales: Locale[], pageRows: Row[], queryRows: Row[], prevPageRows: Row[] | null, prevQueryRows: Row[] | null): LocaleSummary[] {
  const pageBy = (rows: Row[], l: Locale) => rows.filter(r => localeOfPage(r.keys[0]) === l);
  const q = byQuery(queryRows), pq = prevQueryRows ? byQuery(prevQueryRows) : null;
  return locales.map(l => {
    const pages = pageBy(pageRows, l), qs = [...(q.get(l)?.values() ?? [])];
    return {
      locale: l, totals: totals(pages), previous_totals: prevPageRows ? totals(pageBy(prevPageRows, l)) : null,
      queries: qs.length, query_bands: bands(qs.map(x => x.position)),
      previous_query_bands: pq ? bands([...(pq.get(l)?.values() ?? [])].map(x => x.position)) : null,
      striking_queries: qs.filter(x => x.position >= STRIKING.min && x.position <= STRIKING.max).length,
      pages_with_impressions: pages.filter(r => r.impressions > 0).length,
      pages_no_clicks: pages.filter(r => r.impressions > 0 && r.clicks === 0).map(r => new URL(r.keys[0]).pathname).sort(),
    };
  });
}

export type PrivateDetail = { locale: Locale; striking: { query: string; page: string; position: number; impressions: number; clicks: number }[];
  top_queries: { query: string; page: string; position: number; impressions: number; clicks: number }[];
  new_queries: string[]; lost_queries: string[] };

/** Query-level lists: NEVER commit (owner, 2026-11-10). Written to research/search-console/private/. */
export function privateDetail(locales: Locale[], queryRows: Row[], prevQueryRows: Row[] | null): PrivateDetail[] {
  const q = byQuery(queryRows), pq = prevQueryRows ? byQuery(prevQueryRows) : null;
  return locales.map(l => {
    const m = q.get(l) ?? new Map(), pm = pq?.get(l) ?? new Map();
    const list = [...m].map(([query, e]) => ({ query, page: new URL(e.page).pathname, position: e.position, impressions: e.impressions, clicks: e.clicks }));
    const byImp = (a: { impressions: number; query: string }, b: { impressions: number; query: string }) => b.impressions - a.impressions || (a.query < b.query ? -1 : 1);
    return { locale: l,
      striking: list.filter(x => x.position >= STRIKING.min && x.position <= STRIKING.max).sort(byImp),
      top_queries: [...list].sort(byImp).slice(0, 25),
      new_queries: pq ? [...m.keys()].filter(k => !pm.has(k)).sort() : [],
      lost_queries: pq ? [...pm.keys()].filter(k => !m.has(k)).sort() : [] };
  });
}

/** <loc> values of a sitemap (urlset). */
export const sitemapUrls = (xml: string) => [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m => m[1]);

export type Inspection = { url: string; verdict: string | null; coverage: string | null; last_crawl: string | null; error: string | null };

/** Indexed vs submitted per locale, and the paths not indexed (page paths are public, safe to commit). */
export function indexing(locales: Locale[], inspections: Inspection[]) {
  return locales.map(l => {
    const mine = inspections.filter(i => localeOfPage(i.url) === l);
    return { locale: l, submitted: mine.length, indexed: mine.filter(i => i.verdict === "PASS").length,
      not_indexed: mine.filter(i => i.verdict !== "PASS").map(i => ({ path: new URL(i.url).pathname, coverage: i.error ? `error: ${i.error}` : i.coverage })) };
  });
}
