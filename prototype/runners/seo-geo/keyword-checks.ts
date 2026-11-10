// Keyword tracker logic in code (plan Q14): keyword list from the frozen query set, SERP parsing,
// brand matching, summary and run-to-run diff. No network here.
import { KeywordResult, SerpResult, type QuerySet } from "../../packages/data-contracts/seo-geo.ts";
import { BRANDS } from "./labels.ts";

/** Unique keywords (case-insensitive) with the queries they came from, in query-set order. */
export function keywordsFrom(set: QuerySet): { keyword: string; query_ids: string[] }[] {
  const m = new Map<string, { keyword: string; query_ids: string[] }>();
  for (const q of set.queries) for (const k of q.keywords) {
    const key = k.toLowerCase().replace(/\s+/g, " ").trim();
    const e = m.get(key) ?? { keyword: key, query_ids: [] };
    if (!e.query_ids.includes(q.id)) e.query_ids.push(q.id);
    m.set(key, e);
  }
  return [...m.values()];
}

const TRACKING = /^(srsltid|utm_[a-z]+|fbclid|gclid|msclkid|ref)$/i;
export function cleanUrl(u: string): string {
  const url = new URL(u);
  for (const k of [...url.searchParams.keys()]) if (TRACKING.test(k)) url.searchParams.delete(k);
  url.hash = "";
  return url.toString();
}

// Product sites the GEO brand list doesn't name (labels.ts stays as the GEO tracker uses it).
const EXTRA_DOMAINS: Record<string, string[]> = { cleanmymac: ["cleanmymac.com"] };

/** Brand id when the URL is on a tracked product's own site (domain or domain/path prefix), else null.
 * A vendor with several tracked products on one domain (nektony.com) is credited to the first listed. */
export function brandFor(u: string): string | null {
  const url = new URL(u);
  const hostPath = url.hostname.replace(/^www\./, "") + url.pathname;
  for (const b of BRANDS) {
    const domains = [...(b.domain ? [b.domain] : []), ...(EXTRA_DOMAINS[b.id] ?? [])];
    if (domains.some(d => d.includes("/") ? hostPath.toLowerCase().startsWith(d.toLowerCase()) : url.hostname.replace(/^www\./, "") === d || url.hostname.endsWith("." + d))) return b.id;
  }
  return null;
}

type SerperOrganic = { position?: number; link: string; title?: string };
/** Turns a Serper search response into a KeywordResult. Positions are renumbered 1..n in the order given. */
export function parseSerp(json: { organic?: SerperOrganic[]; relatedSearches?: { query: string }[] }, kw: { keyword: string; query_ids: string[] }, gl: string, hl: string, checkedAt = new Date().toISOString()): KeywordResult {
  const results: SerpResult[] = (json.organic ?? []).slice(0, 10).map((o, i) => {
    const url = cleanUrl(o.link);
    return { position: i + 1, url, domain: new URL(url).hostname.replace(/^www\./, ""), title: (o.title ?? "").slice(0, 200), brand: brandFor(url) };
  });
  const own = results.find(r => r.brand === "cachedrop");
  return KeywordResult.parse({
    keyword: kw.keyword, query_ids: kw.query_ids, checked_at: checkedAt, engine: "google", gl, hl, results,
    own_position: own?.position ?? null, related_searches: (json.relatedSearches ?? []).map(r => r.query).slice(0, 10), error: null,
  });
}

/** Headline numbers for one run. */
export function summarize(results: KeywordResult[]) {
  const ok = results.filter(r => !r.error);
  const ranked = ok.filter(r => r.own_position !== null);
  const count = (f: (r: SerpResult) => string | null) => {
    const m: Record<string, number> = {};
    for (const k of ok) for (const d of new Set(k.results.map(f).filter((x): x is string => !!x))) m[d] = (m[d] ?? 0) + 1;
    return Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]));
  };
  return {
    keywords: results.length, failed: results.length - ok.length,
    own: { ranked: ranked.length, top3: ranked.filter(r => r.own_position! <= 3).length, positions: Object.fromEntries(ranked.map(r => [r.keyword, r.own_position])) },
    brands_in_top10: count(r => r.brand),               // keywords where each tracked product's own site ranks
    domains_in_top10: Object.fromEntries(Object.entries(count(r => r.domain)).slice(0, 15)),
  };
}

export type KeywordDelta = { keyword: string; change: string };
/** Own-position moves and tracked brands entering or leaving the top 10, keyword by keyword. */
export function diffRuns(prev: KeywordResult[], now: KeywordResult[]): KeywordDelta[] {
  const out: KeywordDelta[] = [];
  for (const n of now) {
    const p = prev.find(x => x.keyword === n.keyword);
    if (!p || p.error || n.error) continue;
    if (p.own_position !== n.own_position) out.push({ keyword: n.keyword, change: `cachedrop.io ${p.own_position ?? "unranked"} → ${n.own_position ?? "unranked"}` });
    const pb = new Set(p.results.map(r => r.brand).filter(Boolean)), nb = new Set(n.results.map(r => r.brand).filter(Boolean));
    for (const b of nb) if (b !== "cachedrop" && !pb.has(b)) out.push({ keyword: n.keyword, change: `${b} entered the top 10` });
    for (const b of pb) if (b !== "cachedrop" && !nb.has(b)) out.push({ keyword: n.keyword, change: `${b} left the top 10` });
  }
  return out;
}
