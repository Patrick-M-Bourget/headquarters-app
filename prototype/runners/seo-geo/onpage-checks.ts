// On-page checks done in code (plan Q13): HTML facts, robots.txt access for AI crawlers, and gaps vs competitors.
import { parseHTML } from "linkedom";
import { AI_CRAWLERS, type PageAudit, type PageChecks } from "../../packages/data-contracts/seo-geo.ts";

const collapse = (s: string) => s.replace(/\s+/g, " ").trim();
/** Comparison key for a URL: no scheme, no "www.", no query/fragment, no trailing slash. */
const noSlash = (u: string) => u.replace(/^https?:\/\/(www\.)?/i, "").replace(/[?#].*$/, "").replace(/\/$/, "");

/** Collects every @type in a JSON-LD value, walking @graph and nested objects. */
function ldTypes(v: unknown, out: Set<string>) {
  if (Array.isArray(v)) { v.forEach(x => ldTypes(x, out)); return; }
  if (!v || typeof v !== "object") return;
  const o = v as Record<string, unknown>;
  const t = o["@type"];
  if (typeof t === "string") out.add(t); else if (Array.isArray(t)) t.forEach(x => typeof x === "string" && out.add(x));
  for (const [k, val] of Object.entries(o)) if (k !== "@type" && k !== "@context") ldTypes(val, out);
}

/** HTML facts for one page. `url` is the final (post-redirect) URL; `text` is the readable text used for word count. */
export function pageChecks(html: string, url: string, text: string): PageChecks {
  const { document } = parseHTML(html);
  const host = new URL(url).hostname.replace(/^www\./, "");
  const title = collapse(document.querySelector("title")?.textContent ?? "") || null;
  const meta = collapse(document.querySelector('meta[name="description" i], meta[name="Description"]')?.getAttribute("content") ?? "") || null;
  const canonicalHref = document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? null;
  let canonical: string | null = null;
  try { canonical = canonicalHref ? new URL(canonicalHref, url).toString() : null; } catch { canonical = canonicalHref; }
  const types = new Set<string>();
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
    try { ldTypes(JSON.parse(s.textContent ?? ""), types); } catch { types.add("(invalid JSON-LD)"); }
  }
  const internal = new Set<string>();
  for (const a of document.querySelectorAll("a[href]")) {
    try {
      const h = new URL(a.getAttribute("href")!, url);
      if (h.protocol.startsWith("http") && h.hostname.replace(/^www\./, "") === host && noSlash(h.toString()) !== noSlash(url)) internal.add(noSlash(h.toString()));
    } catch { /* ignore bad hrefs */ }
  }
  return {
    title, meta_description: meta,
    h1: [...document.querySelectorAll("h1")].map(h => collapse(h.textContent ?? "")).filter(Boolean),
    canonical, canonical_is_self: !!canonical && noSlash(canonical) === noSlash(url),
    json_ld_types: [...types].sort(),
    internal_links: internal.size,
    word_count: collapse(text).split(" ").filter(Boolean).length,
    html_lang: document.documentElement?.getAttribute("lang") || null,
    hreflang: [...document.querySelectorAll('link[rel="alternate"][hreflang]')].flatMap(l => {
      try { return [{ lang: l.getAttribute("hreflang")!, href: new URL(l.getAttribute("href") ?? "", url).toString() }]; } catch { return []; }
    }),
  };
}

const CHROME = "script, style, noscript, template, svg, nav, header, footer, aside, form, dialog, [role=navigation], [role=banner], [role=contentinfo], [aria-hidden=true]";
/**
 * The page's main content as text: site chrome (nav, header, footer, asides, scripts) removed, and
 * <main>/<article> preferred when they hold real content. Used for word count and "near the top".
 */
export function mainText(html: string): string {
  const { document } = parseHTML(html);
  for (const el of [...document.querySelectorAll(CHROME)]) el.remove();
  // textContent runs blocks together ("<h1>Title</h1><p>Text" -> "TitleText"); separate them.
  for (const el of [...document.querySelectorAll("p, div, section, main, article, li, a, button, label, h1, h2, h3, h4, h5, h6, td, th, tr, dt, dd, br, blockquote, pre, figcaption")]) el.append(document.createTextNode(" "));
  const words = (el: any) => collapse(el?.textContent ?? "").split(" ").filter(Boolean).length;
  const main = [...document.querySelectorAll("main, [role=main], article")].sort((a, b) => words(b) - words(a))[0];
  return collapse((main && words(main) >= 100 ? main : document.body)?.textContent ?? "");
}

/** The first `n` words of the readable text: what "near the top" means for the model check. */
export const opening = (text: string, n = 150) => collapse(text).split(" ").slice(0, n).join(" ");

/**
 * May `agent` fetch `path`? Standard robots.txt rules: the most specific matching user-agent group wins
 * (falling back to `*`), then the longest matching Allow/Disallow rule; Allow wins ties. No group = allowed.
 */
export function robotsAllows(robots: string, agent: string, path = "/"): boolean {
  type Group = { agents: string[]; rules: { allow: boolean; path: string }[] };
  const groups: Group[] = [];
  let cur: Group | null = null, lastWasAgent = false;
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const [key, value] = [m[1].toLowerCase(), m[2].trim()];
    if (key === "user-agent") {
      if (!cur || !lastWasAgent) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(value.toLowerCase()); lastWasAgent = true;
    } else if ((key === "allow" || key === "disallow") && cur) {
      lastWasAgent = false;
      if (key === "disallow" && value === "") continue; // empty Disallow = allow everything
      cur.rules.push({ allow: key === "allow", path: value });
    } else lastWasAgent = false;
  }
  const a = agent.toLowerCase();
  const group = groups.find(g => g.agents.includes(a)) ?? groups.find(g => g.agents.includes("*"));
  if (!group) return true;
  const toRe = (p: string) => new RegExp("^" + p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$"));
  const hits = group.rules.filter(r => toRe(r.path).test(path)).sort((x, y) => y.path.length - x.path.length || +y.allow - +x.allow);
  return hits.length ? hits[0].allow : true;
}

export const robotsReport = (robots: string | null) =>
  Object.fromEntries(AI_CRAWLERS.map(c => [c, robots === null ? true : robotsAllows(robots, c)])) as Record<(typeof AI_CRAWLERS)[number], boolean>;

// Types every CMS emits (Yoast, Rank Math, ...): having them or not says nothing about the page.
const BOILERPLATE_LD = new Set(["WebPage", "WebSite", "ImageObject", "Organization", "Person", "SearchAction", "EntryPoint", "ListItem", "ReadAction", "PropertyValueSpecification", "Thing", "(invalid JSON-LD)"]);

/**
 * The stable part of a gap message, for run-to-run diffs: drops the model's Why/Quote and the competitor list,
 * and masks numbers (a page going from 138 to 141 words is the same gap, not a new one).
 */
export const gapKey = (g: string) => g.split(/ (?:Why|Quote|These answer it):/)[0].replace(/\d+/g, "#").trim();

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : 0; };

/** Gaps between an own page and the competitors that loaded, phrased as findings. Code only. */
/**
 * Language targeting of an own page (plan Q23). `market` is the locale the page should serve, e.g. "fr-FR".
 * `back` maps each translation href to the hrefs that translation lists (fetched by the runner), for the pair check.
 */
export function langGaps(url: string, c: PageChecks, market: string, back: Record<string, string[]>): string[] {
  const gaps: string[] = [];
  const [lang, country] = market.split("-");
  const tag = c.html_lang ?? null;
  if (!tag) gaps.push("no <html lang>");
  else {
    const [l, region] = tag.split("-");
    if (l.toLowerCase() !== lang) gaps.push(`<html lang="${tag}"> but the page serves ${market}`);
    else if (region && region.toUpperCase() !== country) gaps.push(`<html lang="${tag}"> targets ${region.toUpperCase()}; the market is ${country} (use "${lang}" or "${market}")`);
  }
  const alts = c.hreflang ?? [];
  if (!alts.length) return [...gaps, "no hreflang alternates"];
  if (!alts.some(a => noSlash(a.href) === noSlash(url))) gaps.push("hreflang does not list the page itself");
  if (!alts.some(a => a.lang.toLowerCase() === "x-default")) gaps.push("no hreflang x-default");
  const translations = alts.filter(a => a.lang.toLowerCase() !== "x-default" && noSlash(a.href) !== noSlash(url));
  if (!translations.length) gaps.push("hreflang lists no translation");
  for (const t of translations) {
    const listed = back[t.href];
    if (listed && !listed.some(h => noSlash(h) === noSlash(url))) gaps.push(`hreflang pair broken: ${t.href} (${t.lang}) does not link back`);
  }
  return gaps;
}

export function findGaps(own: PageAudit, competitors: PageAudit[]): string[] {
  const c = own.checks;
  if (!c) return [`page failed to load: ${own.error}`];
  const gaps: string[] = [];
  if (!c.title) gaps.push("no <title>");
  else if (c.title.length > 60) gaps.push(`title is ${c.title.length} chars (search results cut at about 60)`);
  if (!c.meta_description) gaps.push("no meta description");
  else if (c.meta_description.length > 160) gaps.push(`meta description is ${c.meta_description.length} chars (cut at about 160)`);
  if (c.h1.length !== 1) gaps.push(`${c.h1.length} H1 elements (expected 1)`);
  if (!c.canonical) gaps.push("no canonical link");
  else if (!c.canonical_is_self) gaps.push(`canonical points elsewhere: ${c.canonical}`);
  if (c.json_ld_types.includes("(invalid JSON-LD)")) gaps.push("a JSON-LD block does not parse");
  const ok = competitors.filter(p => p.checks);
  if (ok.length) {
    const counts = new Map<string, number>();
    for (const p of ok) for (const t of new Set(p.checks!.json_ld_types.filter(t => !BOILERPLATE_LD.has(t)))) counts.set(t, (counts.get(t) ?? 0) + 1);
    const missing = [...counts].filter(([t, n]) => n >= 2 && !c.json_ld_types.includes(t)).map(([t]) => t);
    if (missing.length) gaps.push(`JSON-LD types used by 2+ competitors but not here: ${missing.join(", ")}`);
    const mw = median(ok.map(p => p.checks!.word_count));
    if (mw > 0 && c.word_count < mw / 2) gaps.push(`${c.word_count} words vs competitor median ${mw}`);
  }
  // Eval (eval/onpage-agreement.ts): "answers at all vs no" agrees with blind labels >= 90%; "yes vs partial"
  // does not (the judge is stricter). So only "no" is a confirmed gap; partial/unverified need the owner's check.
  if (own.answer && own.answer.verdict !== "yes") {
    const better = competitors.filter(p => p.answer?.verdict === "yes").map(p => new URL(p.url).hostname.replace(/^www\./, ""));
    const why = own.answer.reason ? ` Why: ${own.answer.reason}` : "";
    const quote = own.answer.quote ? ` Quote: "${own.answer.quote}"` : "";
    const also = better.length ? ` These answer it: ${better.join(", ")}.` : "";
    gaps.push(own.answer.verdict === "no"
      ? `does not answer "${own.query_text}" near the top.${why}${also}`
      : `needs check: answers "${own.query_text}" only partly near the top (${own.answer.verdict}).${why}${quote}${also}`);
  }
  return gaps;
}
