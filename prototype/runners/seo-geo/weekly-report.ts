// Weekly synthesis (plan step 6, Q15): reads the latest full GEO, keyword and on-page runs per locale, compares
// each with the run before it, and proposes 3–5 tickets. All code, no model: every number is a count from a run file.
// Proposals the owner already decided (ticketed, dropped, decision-bound) are listed in research/seo-geo/proposals-ledger.json
// and never proposed again. weekly.ts runs this inside the Paperclip routine; it also runs by hand.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Locale, QuerySet } from "../../packages/data-contracts/seo-geo.ts";
import { MARKETS, querySetPath } from "../../packages/data-contracts/markets.ts";
import { keywordsFrom } from "./keyword-checks.ts";
import { BRANDS } from "./labels.ts";
import { gapKey } from "./onpage-checks.ts";

export const LOCALES = Locale.options;
export const WEEKLY: Locale[] = ["en-US", "fr-FR"]; // plan Q22; the other four run in the first week of each month
export const SITE_LOCALES: Locale[] = ["en-US", "fr-FR"]; // locales with cachedrop.io pages (on-page audit, page proposals)
export type Kind = "geo" | "keywords" | "onpage";
const DIRS: Record<Kind, string> = { geo: "research/seo-geo/geo-runs", keywords: "research/seo-geo/keyword-runs", onpage: "research/seo-geo/onpage-runs" };

/** Monday (UTC) of the week a date falls in, as YYYY-MM-DD. */
export function weekOf(d: Date): string {
  const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  m.setUTCDate(m.getUTCDate() - ((m.getUTCDay() + 6) % 7));
  return m.toISOString().slice(0, 10);
}

/** Locales due in the week starting `week`: the weekly two, plus the monthly four when that Monday is in the month's first 7 days. */
export function dueLocales(week: string): Locale[] {
  return Number(week.slice(8, 10)) <= 7 ? [...LOCALES] : [...WEEKLY];
}

export type Task = { agent: "GEO Tracker" | "Keyword Tracker" | "On-page Auditor" | "On-page Optimizer" | "Funnel Analyst"; title: string; params: Record<string, string> };

/** Stage 1: the three trackers for each due locale (on-page only where the site has pages). */
export function stage1(locales: Locale[], week: string): Task[] {
  return locales.flatMap(l => [
    { agent: "GEO Tracker" as const, title: `GEO tracker · ${l} · week ${week}`, params: { locale: l } },
    { agent: "Keyword Tracker" as const, title: `Keyword tracker · ${l} · week ${week}`, params: { locale: l } },
    ...(SITE_LOCALES.includes(l) ? [{ agent: "On-page Auditor" as const, title: `On-page audit · ${l} · week ${week}`, params: { locale: l } }] : []),
  ]);
}

/** A run's gaps by stable key (no numbers, no model wording), so "1065 words vs median 3194" and "1060 words vs median 3188" are the same gap. */
export const gapSignature = (gaps: string[]) => [...new Set(gaps.map(gapKey))].sort();

/** Gaps about the page itself. Gaps relative to competitors ("JSON-LD types used by 2+ competitors", "words vs competitor median")
 * move whenever the search returns different competitor pages, which says nothing new about cachedrop.io (first manual run, 2026-11-10). */
export const ownGaps = (gaps: string[]) => gaps.filter(g => !/competitor/i.test(g));

/** Stage 2 (marketing agents): the on-page optimizer only when a page's gaps changed since the previous full audit; the funnel analyst only when the owner dropped this week's CSV. */
export function stage2(onpage: { locale: Locale; dir: string; gaps: string[]; previousGaps: string[] | null }[], week: string, funnelCsv: string | null): Task[] {
  const out: Task[] = [];
  for (const o of onpage) {
    const changed = !o.previousGaps || JSON.stringify(gapSignature(ownGaps(o.gaps))) !== JSON.stringify(gapSignature(ownGaps(o.previousGaps)));
    if (changed) out.push({ agent: "On-page Optimizer", title: `On-page fixes · ${o.locale} · week ${week}`, params: { run: o.dir } });
  }
  if (funnelCsv) out.push({ agent: "Funnel Analyst", title: `Funnel · week ${week}`, params: { csv: funnelCsv, week } });
  return out;
}

// ---------------------------------------------------------------- runs

export type Run = { kind: Kind; run_id: string; locale: Locale; dir: string; finished_at: string; full: boolean; group: string; summary: any };

const readJson = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const setFor = (root: string, locale: Locale, v: number) => QuerySet.parse(readJson(join(root, querySetPath(locale, v))));
export const pagesFor = (root: string, locale: Locale): { query_set_version: number; pages: { url: string; query_id: string }[] } | null => {
  const p = join(root, locale === "en-US" ? "research/seo-geo/onpage-pages.json" : `research/seo-geo/onpage-pages.${locale}.json`);
  return existsSync(p) ? readJson(p) : null;
};

/** Every saved run. `full` = it covered the whole frozen set (not an --only trial). GEO relabels share a `group` with the answers they re-judged. */
export function loadRuns(root: string): Run[] {
  const out: Run[] = [];
  for (const kind of Object.keys(DIRS) as Kind[]) {
    const base = join(root, DIRS[kind]);
    if (!existsSync(base)) continue;
    for (const id of readdirSync(base)) {
      const sp = join(base, id, "summary.json");
      if (!existsSync(sp)) continue;
      const s = readJson(sp);
      const locale = Locale.parse(s.locale ?? "en-US"); // summaries before 5b have no locale: en-US
      const set = setFor(root, locale, s.query_set_version ?? 1);
      let full = false, group = s.run_id ?? id;
      if (kind === "geo") {
        full = s.answers === set.queries.length * (s.engines?.length ?? 2);
        const ap = join(base, id, "answers.json");
        if (existsSync(ap)) { const a: any[] = readJson(ap); group = a.map(x => x.asked_at).sort()[0] ?? group; } // relabels keep asked_at
      } else if (kind === "keywords") full = s.keywords === keywordsFrom(set).length;
      else full = s.pages === (pagesFor(root, locale)?.pages.length ?? -1);
      out.push({ kind, run_id: s.run_id ?? id, locale, dir: `${DIRS[kind]}/${id}`, finished_at: s.finished_at ?? "", full, group, summary: s });
    }
  }
  return out;
}

/** Latest full run of a kind and locale and the one before it. A relabel replaces the run it re-judged (same group), it is not a new week. */
export function pickRuns(runs: Run[], kind: Kind, locale: Locale): { current: Run | null; previous: Run | null } {
  const groups = new Map<string, Run>();
  for (const r of runs.filter(r => r.kind === kind && r.locale === locale && r.full)) {
    const g = groups.get(r.group);
    if (!g || r.finished_at > g.finished_at) groups.set(r.group, r);
  }
  const ordered = [...groups.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(e => e[1]);
  if (kind !== "geo") ordered.sort((a, b) => (a.finished_at < b.finished_at ? -1 : 1));
  return { current: ordered.at(-1) ?? null, previous: ordered.at(-2) ?? null };
}

// ---------------------------------------------------------------- per-locale facts

const topN = (o: Record<string, number> | undefined, n: number) => Object.entries(o ?? {}).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, n);
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return null; } };
const OWN = "cachedrop.io";
const VENDOR_DOMAINS = BRANDS.map(b => b.domain).filter(d => d && !d.includes("/")) as string[]; // github.com/<user> is a page, not a vendor site
/** A competitor's own site: a tracked vendor domain, or a domain carrying a tracked product's name (cleanmymac.jp, devcleaner.app). */
export const isVendorSite = (d: string) => d === OWN || VENDOR_DOMAINS.some(v => d === v || d.endsWith("." + v)) || BRANDS.some(b => b.id.length >= 5 && d.replace(/[-.]/g, "").includes(b.id.replace(/-/g, "")));

export type LocaleFacts = {
  locale: Locale; stale: Kind[]; missing: Kind[];
  geo: null | { run: string; previous: string | null; n: number; recommended: number; mentioned: number; cited: number; d_recommended: number | null; d_mentioned: number | null;
    competitors: [string, number, number | null][]; cited_domains: [string, number][]; cachedrop_mentions: { query_id: string; engine: string; evidence: string | null }[];
    gaps: { query_id: string; text: string; competitors: number }[]; cost_usd: number; finished_at: string };
  keywords: null | { run: string; previous: string | null; n: number; ranked: number; top3: number; d_ranked: number | null; domains: [string, number][]; brands: [string, number][]; credits: number; finished_at: string };
  onpage: null | { run: string; previous: string | null; pages: number; own: Record<string, number>; gaps: number; new_gaps: string[]; fixed_gaps: string[];
    no_answer: { url: string; query_id: string; query_text: string }[]; cost_usd: number; finished_at: string; dir: string; gap_list: string[]; previous_gap_list: string[] | null };
};

const isStale = (r: Run | null, week: string) => !!r && r.finished_at.slice(0, 10) < week;

export function localeFacts(root: string, runs: Run[], locale: Locale, week: string): LocaleFacts {
  const f: LocaleFacts = { locale, stale: [], missing: [], geo: null, keywords: null, onpage: null };
  const g = pickRuns(runs, "geo", locale);
  if (g.current) {
    const s = g.current.summary, p = g.previous?.summary;
    const set = setFor(root, locale, s.query_set_version ?? 1);
    const mentions: any[] = readJson(join(root, g.current.dir, "mentions.json"));
    const answers: any[] = readJson(join(root, g.current.dir, "answers.json"));
    const domains = new Map<string, number>();
    for (const a of answers) for (const h of new Set((a.cited_urls ?? []).map(host).filter(Boolean) as string[])) domains.set(h, (domains.get(h) ?? 0) + 1);
    const mapped = new Set(pagesFor(root, locale)?.pages.map(p => p.query_id) ?? []);
    const recBy = new Map<string, Set<string>>();
    for (const m of mentions) if (m.brand !== "cachedrop" && (m.stance === "top_pick" || m.stance === "suggested")) {
      if (!recBy.has(m.query_id)) recBy.set(m.query_id, new Set()); recBy.get(m.query_id)!.add(m.brand);
    }
    const ownRec = new Set(mentions.filter(m => m.brand === "cachedrop" && m.recommended).map(m => m.query_id));
    f.geo = {
      run: g.current.run_id, previous: g.previous?.run_id ?? null, n: s.answers - (s.failed ?? 0),
      recommended: s.cachedrop.recommended, mentioned: s.cachedrop.mentioned, cited: s.cachedrop.cited,
      d_recommended: p ? s.cachedrop.recommended - p.cachedrop.recommended : null, d_mentioned: p ? s.cachedrop.mentioned - p.cachedrop.mentioned : null,
      competitors: topN(s.competitors_recommended, 5).map(([b, n]) => [b, n, p ? n - (p.competitors_recommended?.[b] ?? 0) : null]),
      cited_domains: [...domains.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 8),
      cachedrop_mentions: mentions.filter(m => m.brand === "cachedrop" && m.mentioned).map(m => ({ query_id: m.query_id, engine: m.engine, evidence: m.evidence })),
      // Questions no site page is mapped to, where AI answers recommend competitors and not CacheDrop.
      gaps: SITE_LOCALES.includes(locale) ? set.queries.filter(q => !mapped.has(q.id) && !ownRec.has(q.id) && (recBy.get(q.id)?.size ?? 0) > 0)
        .map(q => ({ query_id: q.id, text: q.text, competitors: recBy.get(q.id)!.size })).sort((a, b) => b.competitors - a.competitors || (a.query_id < b.query_id ? -1 : 1)) : [],
      cost_usd: s.cost_usd ?? 0, finished_at: g.current.finished_at,
    };
    if (isStale(g.current, week)) f.stale.push("geo");
  } else f.missing.push("geo");

  const k = pickRuns(runs, "keywords", locale);
  if (k.current) {
    const s = k.current.summary, p = k.previous?.summary;
    f.keywords = { run: k.current.run_id, previous: k.previous?.run_id ?? null, n: s.keywords - (s.failed ?? 0), ranked: s.own.ranked, top3: s.own.top3,
      d_ranked: p ? s.own.ranked - p.own.ranked : null, domains: topN(s.domains_in_top10, 5), brands: topN(s.brands_in_top10, 5), credits: s.serper_credits ?? 0, finished_at: k.current.finished_at };
    if (isStale(k.current, week)) f.stale.push("keywords");
  } else f.missing.push("keywords");

  if (SITE_LOCALES.includes(locale)) {
    const o = pickRuns(runs, "onpage", locale);
    if (o.current) {
      const s = o.current.summary;
      const audits = readJson(join(root, o.current.dir, "audits.json"));
      const gapList: string[] = audits.pages.flatMap((p: any) => p.gaps.map((x: string) => `${new URL(p.page.url).pathname}: ${x}`));
      const prevList: string[] | null = o.previous ? readJson(join(root, o.previous.dir, "audits.json")).pages.flatMap((p: any) => p.gaps.map((x: string) => `${new URL(p.page.url).pathname}: ${x}`)) : null;
      const cur = new Set(gapSignature(gapList)), prev = new Set(prevList ? gapSignature(prevList) : []);
      f.onpage = { run: o.current.run_id, previous: o.previous?.run_id ?? null, pages: s.pages, own: s.own_answers_near_top ?? {}, gaps: s.gaps,
        new_gaps: prevList ? [...cur].filter(x => !prev.has(x)) : [], fixed_gaps: prevList ? [...prev].filter(x => !cur.has(x)) : [],
        no_answer: audits.pages.filter((p: any) => p.page.answer?.verdict === "no").map((p: any) => ({ url: p.page.url, query_id: p.page.query_id, query_text: p.page.query_text })),
        cost_usd: s.cost_usd ?? 0, finished_at: o.current.finished_at, dir: o.current.dir, gap_list: gapList, previous_gap_list: prevList };
      if (isStale(o.current, week)) f.stale.push("onpage");
    } else f.missing.push("onpage");
  }
  return f;
}

// ---------------------------------------------------------------- proposals

export type LedgerEntry = { key: string; status: "ticketed" | "dropped" | "decision"; ref: string; note?: string; date: string };
export type Proposal = { key: string; kind: "regression" | "opening" | "new_page" | "citation_source"; target: "cachedrop-website" | "owner"; title: string; why: string; next: string };

/**
 * Priority: regressions, own pages that don't answer their question, the best page gap per site locale, the one source
 * AI engines cite most, then more page gaps to fill. Keys in the ledger are skipped. Returns at most `max`.
 */
export function proposals(facts: LocaleFacts[], ledger: LedgerEntry[], max = 5): Proposal[] {
  const done = new Set(ledger.map(l => l.key));
  const c: Proposal[] = [];
  for (const f of facts) {
    const name = MARKETS[f.locale].name;
    if (f.geo && f.geo.d_recommended !== null && f.geo.d_recommended < 0)
      c.push({ key: `regression:${f.locale}:geo:${f.geo.run}`, kind: "regression", target: "owner", title: `AI answers recommend CacheDrop less in ${name}`,
        why: `${f.geo.recommended}/${f.geo.n} answers recommend it, ${-f.geo.d_recommended} fewer than ${f.geo.previous}.`, next: "Claude compares the two runs' answers question by question." });
    if (f.keywords && f.keywords.d_ranked !== null && f.keywords.d_ranked < 0)
      c.push({ key: `regression:${f.locale}:keywords:${f.keywords.run}`, kind: "regression", target: "owner", title: `cachedrop.io lost Google top-10 positions in ${name}`,
        why: `In the top 10 for ${f.keywords.ranked}/${f.keywords.n} keywords, ${-f.keywords.d_ranked} fewer than ${f.keywords.previous}.`, next: "Claude lists the keywords lost and the pages that replaced it." });
  }
  for (const f of facts) for (const p of f.onpage?.no_answer ?? [])
    c.push({ key: `opening:${p.url}`, kind: "opening", target: "cachedrop-website", title: `Answer the question in the opening of ${new URL(p.url).pathname}`,
      why: `The page is mapped to ${p.query_id} "${p.query_text}" and its opening does not answer it (on-page run ${f.onpage!.run}).`, next: "The On-page Optimizer drafts the opening; the claims reviewer checks it; Claude files it." });
  const gaps = facts.flatMap(f => (f.geo?.gaps ?? []).map(g => ({ f, g }))).sort((a, b) => b.g.competitors - a.g.competitors || (a.f.locale < b.f.locale ? -1 : 1));
  for (const { f, g } of gaps)
    c.push({ key: `page:${f.locale}:${g.query_id}`, kind: "new_page", target: "cachedrop-website", title: `New ${f.locale} page for ${g.query_id}: "${g.text}"`,
      why: `No cachedrop.io page is mapped to it; AI answers recommend ${g.competitors} other product(s) and not CacheDrop (GEO run ${f.geo!.run}).`, next: "Claude first checks whether an existing page could answer it instead; otherwise the Content Writer drafts it, the claims reviewer checks it, and Claude files it." });
  const dom = new Map<string, { n: number; markets: Set<string> }>();
  for (const f of facts) for (const [d, n] of f.geo?.cited_domains ?? []) {
    if (isVendorSite(d)) continue;
    const e = dom.get(d) ?? { n: 0, markets: new Set<string>() }; e.n += n; e.markets.add(f.locale); dom.set(d, e);
  }
  const src = [...dom.entries()].filter(([d, e]) => e.markets.size >= 2 && !done.has(`cite:${d}`)).sort((a, b) => b[1].n - a[1].n || (a[0] < b[0] ? -1 : 1))[0];
  if (src) c.push({ key: `cite:${src[0]}`, kind: "citation_source", target: "owner", title: `AI engines cite ${src[0]} most: decide whether CacheDrop should be there`,
    why: `Cited in ${src[1].n} answers across ${src[1].markets.size} market(s) (${[...src[1].markets].join(", ")}).`, next: "Owner decision (not a website ticket): an honest developer post, a listing request, or nothing." });
  const open = c.filter(p => !done.has(p.key));
  const firstPages = SITE_LOCALES.map(l => open.find(p => p.kind === "new_page" && p.key.startsWith(`page:${l}:`))).filter(Boolean) as Proposal[];
  const ordered = [...open.filter(p => p.kind === "regression" || p.kind === "opening"), ...firstPages, ...open.filter(p => p.kind === "citation_source"),
    ...open.filter(p => p.kind === "new_page" && !firstPages.includes(p))];
  return ordered.slice(0, max);
}

// ---------------------------------------------------------------- report

const sign = (n: number | null) => (n === null ? "" : n === 0 ? " (±0)" : n > 0 ? ` (+${n})` : ` (${n})`);
const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : "n/a");

export type WeeklyReport = { week: string; generated_at: string; locales: LocaleFacts[]; proposals: Proposal[]; cost_usd: number; serper_credits: number; skipped: { key: string; ref: string }[] };

export function buildReport(root: string, week: string, locales: Locale[] = [...LOCALES], ledger: LedgerEntry[] = [], now = new Date()): WeeklyReport {
  const runs = loadRuns(root);
  const facts = locales.map(l => localeFacts(root, runs, l, week));
  const fresh = (iso: string | undefined) => !!iso && iso.slice(0, 10) >= week;
  const cost = facts.reduce((s, f) => s + (fresh(f.geo?.finished_at) ? f.geo!.cost_usd : 0) + (fresh(f.onpage?.finished_at) ? f.onpage!.cost_usd : 0), 0);
  const credits = facts.reduce((s, f) => s + (fresh(f.keywords?.finished_at) ? f.keywords!.credits : 0), 0);
  return { week, generated_at: now.toISOString(), locales: facts, proposals: proposals(facts, ledger), cost_usd: Number(cost.toFixed(4)), serper_credits: credits,
    skipped: ledger.map(l => ({ key: l.key, ref: `${l.status} ${l.ref}` })) };
}

export function renderReport(r: WeeklyReport): string {
  const L: string[] = [`# SEO/GEO week of ${r.week}`, "", `Generated ${r.generated_at.slice(0, 16).replace("T", " ")} UTC from saved runs. Counts only; quotes are verbatim from the engines.`, ""];
  L.push("## Headline", "", "| Market | AI answers recommending CacheDrop | Mentioning | Citing cachedrop.io | cachedrop.io in Google top 10 | Own pages answering near the top |", "|---|---|---|---|---|---|");
  for (const f of r.locales) {
    const g = f.geo, k = f.keywords, o = f.onpage;
    const ownYes = o ? `${(o.own.yes ?? 0)} yes, ${(o.own.partial ?? 0)} partial, ${(o.own.no ?? 0)} no` : "no site pages";
    L.push(`| ${f.locale} | ${g ? `${g.recommended}/${g.n} (${pct(g.recommended, g.n)})${sign(g.d_recommended)}` : "no run"} | ${g ? `${g.mentioned}${sign(g.d_mentioned)}` : "–"} | ${g ? g.cited : "–"} | ${k ? `${k.ranked}/${k.n}${sign(k.d_ranked)}` : "no run"} | ${ownYes} |`);
  }
  const stale = r.locales.filter(f => f.stale.length || f.missing.length);
  if (stale.length) L.push("", "Not from this week: " + stale.map(f => `${f.locale} ${[...f.stale.map(k => `${k} (older run)`), ...f.missing.map(k => `${k} (no run)`)].join(", ")}`).join("; ") + ".");
  const all = new Map<string, number>();
  for (const f of r.locales) for (const [b, n] of f.geo?.competitors ?? []) all.set(b, (all.get(b) ?? 0) + n);
  L.push("", "Competitors AI answers recommend most, summed over each market's top 5: " + [...all.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([b, n]) => `${b} ${n}`).join(", ") + ".", "");

  L.push("## Proposals for the owner", "", r.proposals.length ? "Approve, drop or edit each in the Paperclip review of this issue. Claude files the approved website tickets." : "Nothing new to propose: every candidate is already ticketed or decided (ledger).", "");
  r.proposals.forEach((p, i) => L.push(`${i + 1}. **${p.title}** (${p.target === "owner" ? "owner action" : "website ticket"}). ${p.why} Next: ${p.next} \`${p.key}\``));
  L.push("");

  for (const f of r.locales) {
    L.push(`## ${f.locale} · ${MARKETS[f.locale].name}`, "");
    if (f.geo) {
      const g = f.geo;
      L.push(`**GEO** ${g.run}${g.previous ? ` vs ${g.previous}` : " (first run)"}: CacheDrop recommended in ${g.recommended}/${g.n}${sign(g.d_recommended)}, mentioned in ${g.mentioned}${sign(g.d_mentioned)}, cachedrop.io cited in ${g.cited}.`);
      L.push(`- Recommended most: ${g.competitors.map(([b, n, d]) => `${b} ${n}${sign(d)}`).join(", ")}.`);
      L.push(`- Sources the engines cite most: ${g.cited_domains.map(([d, n]) => `${d} ${n}`).join(", ") || "none"}.`);
      for (const m of g.cachedrop_mentions) L.push(`- CacheDrop named (${m.query_id}, ${m.engine}): “${(m.evidence ?? "").slice(0, 240)}”`);
      if (g.gaps.length) L.push(`- Questions with no site page where competitors are recommended: ${g.gaps.slice(0, 6).map(x => `${x.query_id} (${x.competitors})`).join(", ")}${g.gaps.length > 6 ? `, and ${g.gaps.length - 6} more` : ""}.`);
    }
    if (f.keywords) {
      const k = f.keywords;
      L.push(`**Keywords** ${k.run}${k.previous ? ` vs ${k.previous}` : " (first run)"}: cachedrop.io in the top 10 for ${k.ranked}/${k.n}${sign(k.d_ranked)} (top 3: ${k.top3}). Domains: ${k.domains.map(([d, n]) => `${d} ${n}`).join(", ")}. Tracked products ranking: ${k.brands.map(([b, n]) => `${b} ${n}`).join(", ") || "none"}.`);
    }
    if (f.onpage) {
      const o = f.onpage;
      L.push(`**On-page** ${o.run}${o.previous ? ` vs ${o.previous}` : ""}: ${o.pages} pages, ${o.gaps} gaps. ${o.previous ? `New: ${o.new_gaps.length ? o.new_gaps.join("; ") : "none"}. Fixed: ${o.fixed_gaps.length ? o.fixed_gaps.join("; ") : "none"}.` : "First run."}`);
    }
    L.push("");
  }
  L.push("## Cost", "", `This week's fresh runs: $${r.cost_usd.toFixed(2)} model and search cost, ${r.serper_credits} Serper credits. Marketing agents report their own cost on their issues.`);
  if (r.skipped.length) L.push("", `${r.skipped.length} proposals already decided are not repeated (research/seo-geo/proposals-ledger.json).`);
  return L.join("\n") + "\n";
}
