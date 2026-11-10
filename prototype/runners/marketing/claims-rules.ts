// Claims reviewer, code half: the website's copy rules that a regex can decide. No model, no side effects.
// Each rule cites the cachedrop-website decision it enforces (docs/DECISIONS.md there).
import { Finding, type Draft, type ProductFacts } from "../../packages/data-contracts/marketing.ts";
import { BRANDS } from "../seo-geo/labels.ts";

type F = Finding;
const NBSP = " ", NNBSP = " ";

/** Sentences and lines, with fenced code and inline code removed (commands and paths are not copy). */
export function prose(text: string): string {
  return text.replace(/```[\s\S]*?```/g, " ").replace(/`[^`\n]*`/g, " ");
}
export const sentences = (text: string) =>
  prose(text).split(/(?<=[.!?…])\s+|\n+/).map(s => s.trim()).filter(Boolean);
/** Headings (# lines) and button labels ([label](button) or links to /download/ and /buy). */
export function headlines(text: string): string[] {
  const t = prose(text);
  const heads = [...t.matchAll(/^#{1,6}\s+(.+)$/gm)].map(m => m[1].trim());
  const buttons = [...t.matchAll(/\[([^\]]+)\]\((button|[^)]*\/(download|buy)\b[^)]*)\)/g)].map(m => m[1].trim());
  return [...heads, ...buttons];
}

export type Competitor = { id: string; pattern: RegExp };
export const competitors = (facts: ProductFacts): Competitor[] => [
  ...BRANDS.filter(b => b.id !== "cachedrop").map(b => ({ id: b.id, pattern: b.pattern })),
  ...facts.extra_competitors.map(c => ({ id: c.id, pattern: new RegExp(c.pattern, "i") })),
];

const PRICE_WORDS = /(\$|€|£|\bprice\b|\bpricing\b|\bdiscount|\boffer\b|\bdeal\b|\bprix\b|\btarif|\boffre\b|\bremise\b|\bréduction\b|\bpromo|\d+[.,]99)/i;
const LIMITED = /limited[- ]time|for a limited time|temps limité|durée limitée/i;
const amount = (n: string) => n.replace(",", ".");

export function codeChecks(d: Draft, facts: ProductFacts): F[] {
  const out: F[] = [];
  const add = (rule: F["rule"], severity: F["severity"], quote: string, message: string, fix: string | null = null) =>
    out.push({ rule, severity, source: "code", quote: quote.slice(0, 400), message, fix });
  const fr = d.locale === "fr-FR";
  const sents = sentences(d.text);
  const body = prose(d.text);
  const comps = competitors(facts);

  // D47: price wording.
  for (const s of sents) if (/\blaunch|\blancement\b/i.test(s) && PRICE_WORDS.test(s))
    add("launch_wording", "block", s, "The offer is limited-time, never a launch price or discount (Decision 47).");
  const re = (n: string) => new RegExp(`(?<![\\d.,])${n.replace(".", "[.,]")}(?![\\d])`);
  const hasOffer = re(facts.price.offer).test(body), hasRegular = re(facts.price.regular).test(body);
  if (hasOffer && !hasRegular)
    add("offer_without_regular", "block", body.match(re(facts.price.offer))![0], `${facts.price.offer} never appears without ${facts.price.regular} beside it (Decision 47).`);
  if (hasOffer && !LIMITED.test(body))
    add("offer_not_limited", "block", body.match(re(facts.price.offer))![0], fr ? "Dire « pour un temps limité » avec l’offre (Decision 47)." : "Call the offer limited-time (Decision 47).");
  for (const s of sents) {
    if (comps.some(c => c.pattern.test(s))) continue; // competitor prices belong to the compare table
    if (!/cachedrop|licen[cs]e|\bbuy\b|\bacheter\b|one-time|une seule fois|\bonce\b/i.test(s)) continue;
    for (const m of s.matchAll(/(?:[$€£]\s?(\d+(?:[.,]\d{2})?))|(?:(\d+(?:[.,]\d{2})?)\s?[  ]?(?:\$|€|£|USD|EUR))/g)) {
      const n = amount(m[1] ?? m[2]);
      if (![facts.price.regular, facts.price.offer].includes(n)) add("wrong_price", "block", m[0], `CacheDrop costs ${facts.price.regular}, now ${facts.price.offer} for a limited time (Decision 47).`);
    }
  }

  // D48: uninstalling is never free. "Free until 2 GB" is the allowed trial wording.
  const FREE = /\bfree\b(?!\s+(up|your|some|space|disk|\d))|\bfor free\b|\bgratuit\w*/i;
  for (const s of sents) {
    if (/2\s?[  ]?(GB|Go)|until|jusqu/i.test(s)) continue;
    if (/uninstall|désinstall/i.test(s) && FREE.test(s) && !comps.some(c => c.pattern.test(s)))
      add("free_uninstall", "block", s, "Never say uninstalling is free: uninstalls count toward the 2 GB trial (Decision 48).");
  }
  // D51: never "free" in a headline or button.
  for (const h of headlines(d.text)) if (FREE.test(h))
    add("free_in_headline", "block", h, "No \"free\" in a headline or button (Decision 51). The trial line goes under the primary button.");

  // D51 / D48: banned words.
  const banned: [RegExp, string][] = fr
    ? [[/\bbêta\b|\bbeta\b/i, "bêta"], [/fichiers? inutiles?|\bdéchets?\b/i, "« fichiers inutiles » (junk)"], [/reconstructible/i, "« reconstructible »"],
       [/plug-?ins? (inutilisés?|en double)|doublons?/i, "plug-ins « inutilisés » ou « en double »"]]
    : [[/\bbeta\b/i, "beta"], [/\bjunk\b/i, "junk"], [/\brebuildable\b/i, "rebuildable"], [/\b(unused|duplicate)\s+plug-?ins?\b/i, "unused or duplicate plug-ins"]];
  for (const [rx, label] of banned) { const m = body.match(rx); if (m) add("banned_word", "block", m[0], `Banned in copy: ${label} (Decisions 48, 51).`); }

  // D48/D54: competitors only on the compare page; never "bloat" beside a competitor.
  if (d.page_kind !== "compare") for (const c of comps) {
    const m = body.match(c.pattern);
    if (m) add("competitor_named", "block", m[0], `Competitors are named only on the compare page (Decisions 48, 54): ${c.id}.`);
  }
  for (const s of sents) if (/\bbloat|gonflé|alourdi/i.test(s) && comps.some(c => c.pattern.test(s)))
    add("bloat_with_competitor", "block", s, "\"Bloat\" never shares a sentence with a competitor's name (Decision 54).");

  // D51 fact sheet.
  for (const m of body.matchAll(fr ? /(?:jusqu[’']à|sur|pour)\s+(\d+)\s+Mac\b/gi : /(?:up to|on|for)\s+(\d+)\s+Macs?\b/gi))
    if (m[1] !== "3") add("fact_sheet", "block", m[0], "A license covers up to 3 Macs.");
  for (const m of body.matchAll(/(\d+)[-\s ]?(?:day|jours?)\b[^.\n]{0,40}(?:refund|money[- ]back|rembours)|(?:refund|rembours)\w*[^.\n]{0,40}?(\d+)[\s ]?(?:days|jours)/gi))
    if ((m[1] ?? m[2]) !== "30") add("fact_sheet", "block", m[0], "Refunds are 30 days, no questions asked.");
  for (const m of body.matchAll(/macOS\s+(\d+)(?:\s+[A-Z][a-z]+)?\s+(?:or later|and later|ou (?:version )?ultérieure|et (?:versions )?ultérieures)/gi))
    if (m[1] !== "14") add("fact_sheet", "block", m[0], "CacheDrop runs on macOS 14 or later.");
  { const m = body.match(/lifetime updates|free updates forever|updates for life|mises à jour (à vie|gratuites pour toujours)/i);
    if (m) add("fact_sheet", "block", m[0], "The promise is every update through version 1, not lifetime updates (Decision 51)."); }

  // D51: invented proof (the model catches the subtler ones).
  const proof: RegExp[] = [
    /\b\d[\d,.   ]*\+?\s*(?:k\s*)?(?:happy\s+)?(?:users|customers|downloads|producers|developers|creators|Macs cleaned|utilisateurs|clients|téléchargements)\b/i,
    /★|\b\d(?:[.,]\d)?\s*(?:\/\s*5|out of 5|stars?|étoiles?)\b/i,
    /\b(?:award[- ]winning|certified|certifié|approved by Apple|recommended by Apple|recommandé par Apple|trusted by|plébiscité|#1\b|n°\s?1\b)/i,
  ];
  for (const rx of proof) { const m = body.match(rx); if (m) add("invented_proof", "block", m[0], "No invented numbers, reviews, ratings or certifications (Decision 51)."); }

  // D23: regenerable items are deleted, not trashed.
  for (const s of sents) if (/\b(everything|all (?:items|files)|every (?:item|file)|cleaned items|tout ce que|tous les (?:éléments|fichiers))\b[^.]{0,50}\b(?:go(?:es)? to|moved? to|va dans|vont dans|à la|dans la) (?:the )?(?:Trash|Corbeille)/i.test(s))
    add("trash_claim", "block", s, "Caches and build files that tools rebuild are deleted; your files go to the Trash (Decision 23).");

  // D51: no puns on "drop".
  { const m = body.match(/\b(?:drop (?:it|the|that|those|everything|the weight|\d+\s?GB)|mic drop|drop by drop|drop[- ]dead|goutte à goutte)\b/i);
    if (m) add("drop_pun", "block", m[0], "No puns on \"drop\" (Decision 51)."); }

  // Brand voice.
  for (const s of sents) if (/!(\s|$)/.test(s + " ") && !/^\s*!\[/.test(s))
    add("exclamation", "fix", s, fr ? "Pas de point d’exclamation." : "No exclamation marks.", s.replace(/\s*!+/g, "."));

  if (fr) {
    { const m = body.match(/(?<!\p{L})(?:tu|toi|ton|tes)\s+\p{L}+/iu) ; if (m) add("fr_tutoiement", "block", m[0], "Le site vouvoie le lecteur (« vous »)."); }
    for (const m of body.matchAll(/(?<![\d.,])(\d+(?:[.,]\d+)?)[ \u00a0\u202f]?(GB|MB|TB|Go|Mo|To)\b/g)) {
      const unit = ({ GB: "Go", MB: "Mo", TB: "To" } as Record<string, string>)[m[2]] ?? m[2];
      if (m[0] !== `${m[1]}${NBSP}${unit}`) add("fr_units", "fix", m[0], "Unités en Go/Mo/To, avec une espace insécable après le nombre.", `${m[1]}${NBSP}${unit}`);
    }
    for (const m of body.matchAll(/(\S)( ?):(?=\s)/g)) {
      if (/\d/.test(m[1]) || m[1] === NBSP || m[1] === NNBSP || /https?$/.test(m[1])) continue;
      add("fr_typography", "fix", m[0], "Espace insécable avant le deux-points.", `${m[1]}${NBSP}:`);
    }
    for (const m of body.matchAll(/«(?![  ])\s?|\s?(?<![  ])»/g))
      add("fr_typography", "fix", m[0], "Guillemets « » avec espaces insécables à l’intérieur.", m[0].includes("«") ? `«${NBSP}` : `${NBSP}»`);
    { const m = body.match(/\p{L}'\p{L}/u); if (m) add("fr_typography", "fix", m[0], "Apostrophe typographique ’.", m[0].replace("'", "’")); }
    if (d.locale === "fr-FR") {
      const qc: [RegExp, string][] = [[/\bcourriels?\b/i, "e-mail"], [/\binfolettres?\b/i, "newsletter"], [/\bpourriels?\b/i, "spam / courrier indésirable"],
        [/\bmagasiner\b/i, "faire ses achats"], [/\btémoins\b/i, "cookies"], [/\bbogues?\b/i, "bug"], [/\bbris(?:er|e|é)\b/i, "casser"], [/\bfin de semaine\b/i, "week-end"]];
      for (const [rx, fix] of qc) { const m = body.match(rx); if (m) add("fr_regional", "note", m[0], "Terme québécois sur une page pour la France (choix du propriétaire en attente, cachedrop-website #130).", fix); }
    }
  }
  return dedupe(out);
}

/** One finding per rule and quote. */
export function dedupe(fs: F[]): F[] {
  const seen = new Set<string>();
  return fs.filter(f => { const k = `${f.rule}|${f.quote.toLowerCase()}`; if (seen.has(k)) return false; seen.add(k); return true; });
}
