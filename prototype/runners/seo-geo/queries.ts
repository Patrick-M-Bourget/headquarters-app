// Deterministic checks and selection for generated buyer queries (no model calls here).
import { Audience, Intent, Query } from "../../packages/data-contracts/seo-geo.ts";

export type Candidate = { text: string; audience: string; intent: string; keywords: string[] };
export type Rejection = { text: string; reason: string };

// Words in any script; scripts written without spaces (Japanese, Chinese) are compared by character pairs.
const NO_SPACES = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]+/gu;
const tokens = (s: string) => {
  const t = s.normalize("NFKC").toLowerCase();
  const out = new Set(t.replace(NO_SPACES, " ").replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter(w => w.length > 2));
  for (const run of t.match(NO_SPACES) ?? []) for (let i = 0; i < run.length - 1; i++) out.add(run.slice(i, i + 2));
  return out;
};
export function similarity(a: string, b: string): number {
  const A = tokens(a), B = tokens(b);
  const inter = [...A].filter(x => B.has(x)).length;
  return inter / (A.size + B.size - inter || 1);
}

// Buyers who don't know CacheDrop can't ask about it; a query naming it would bias visibility upward.
const OWN_BRAND = /cache\s*drop|キャッシュ\s*ドロップ/i;
// Competitor names are only natural in comparison/alternative questions.
const COMPETITORS = /(cleanmymac|daisydisk|maccleaner|grandperspective|omnidisksweeper|appcleaner|pearcleaner|mole\b|hyperspace|sensei|onyx|buhocleaner)/i;

export function checkCandidate(c: Candidate): string | null {
  if (OWN_BRAND.test(c.text) || c.keywords.some(k => OWN_BRAND.test(k))) return "names CacheDrop (biased)";
  if (COMPETITORS.test(c.text) && !["comparison", "alternative"].includes(c.intent)) return "names a competitor outside a comparison/alternative question";
  if (!Audience.safeParse(c.audience).success) return `unknown audience ${c.audience}`;
  if (!Intent.safeParse(c.intent).success) return `unknown intent ${c.intent}`;
  if (c.text.length < 8 || c.text.length > 200) return "length out of range";
  if (c.keywords.length < 1 || c.keywords.length > 2) return "needs 1-2 keywords";
  return null;
}

/**
 * Keeps valid, non-duplicate candidates and balances audiences round-robin: `perAudience` each
 * (general may have its own quota), up to `total`. Returns numbered queries plus every rejection with its reason.
 */
export function selectQueries(cands: Candidate[], total = 25, perAudience = 6, dupThreshold = 0.7, quota: Record<string, number> = { general: 7 }) {
  const rejected: Rejection[] = [];
  const kept: Candidate[] = [];
  for (const c of cands) {
    const why = checkCandidate(c);
    if (why) { rejected.push({ text: c.text, reason: why }); continue; }
    const twin = kept.find(k => similarity(k.text, c.text) >= dupThreshold);
    if (twin) { rejected.push({ text: c.text, reason: `near-duplicate of "${twin.text}"` }); continue; }
    kept.push(c);
  }
  // Round-robin across audiences so no audience is crowded out by candidate order;
  // `quota` sets per-audience targets (general buyers are the largest group).
  const order = ["general", "producers", "developers", "video_editors"];
  const queues = new Map(order.map(a => [a, kept.filter(c => c.audience === a)]));
  const count: Record<string, number> = {};
  const chosen: Candidate[] = [];
  let progressed = true;
  while (chosen.length < total && progressed) {
    progressed = false;
    for (const a of order) {
      if (chosen.length >= total) break;
      if ((count[a] ?? 0) >= (quota[a] ?? perAudience)) continue;
      const next = queues.get(a)!.shift();
      if (!next) continue;
      count[a] = (count[a] ?? 0) + 1; chosen.push(next); progressed = true;
    }
  }
  for (const q of queues.values()) for (const c of q) rejected.push({ text: c.text, reason: `not selected (audience ${c.audience} at quota)` });
  const queries: Query[] = chosen.map((c, i) => Query.parse({ ...c, id: `q${String(i + 1).padStart(2, "0")}` }));
  return { queries, rejected, perAudience: count };
}
