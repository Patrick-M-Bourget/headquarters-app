// Contracts for the marketing agents (docs/marketing-agents-proposal.md, wave 1).
// Every agent drafts only: a draft goes through the claims reviewer, then the owner in Paperclip,
// then Claude files a cachedrop-website ticket. Framework-independent, like seo-geo.ts.
import { z } from "zod";
import { Locale } from "./seo-geo.ts";

/** Which page a draft is for. Competitor names are allowed only on "compare" (website Decision 48/54). */
export const PageKind = z.enum(["home", "pricing", "guide", "compare", "email", "ad", "other"]);
export type PageKind = z.infer<typeof PageKind>;

/** Copy to review. Markdown: lines starting with # are headings, [label](button) marks a button. */
export const Draft = z.object({
  id: z.string().min(1).max(80),
  locale: z.enum(["en-US", "fr-FR"]),       // content agents write EN and FR only (owner, wave 1)
  page_kind: PageKind,
  target_url: z.string().nullable(),         // the cachedrop.io page it changes, null for a new page
  query_ids: z.array(z.string()),            // frozen tracker questions it targets, so the next run measures it
  text: z.string().min(1).max(40000),
});
export type Draft = z.infer<typeof Draft>;

/**
 * block: the owner never sees it until fixed (a website decision says no).
 * fix: a mechanical convention (French typography, units); the reviewer gives the exact fix.
 * ahead_of_app: a product claim the shipped build lacks. Not an error (Decision 51: copy leads the product);
 *   listed for the owner and becomes a mac-cleaner ticket.
 * note: worth a look, never blocks (e.g. Quebec vs France wording while that choice is open).
 */
export const Severity = z.enum(["block", "fix", "ahead_of_app", "note"]);

export const RULES = [
  "launch_wording",      // D47: never "launch price/discount"
  "offer_without_regular", // D47: 19.99 never without 29.99
  "offer_not_limited",   // D47: the offer is always "limited time"
  "wrong_price",         // D47: only 29.99 / 19.99 for CacheDrop
  "free_uninstall",      // D48: uninstalling is never called free
  "free_in_headline",    // D51: never "free" in a headline or button
  "banned_word",         // D51/D48: beta, junk, rebuildable, unused/duplicate plug-in
  "competitor_named",    // D48/D54: competitor names only on the compare page
  "bloat_with_competitor", // D54
  "fact_sheet",          // D51: 3 Macs, 30-day refunds, macOS 14, version 1 updates
  "invented_proof",      // D51: no invented numbers, reviews, ratings, certifications
  "trash_claim",         // D23: regenerable items are deleted, not moved to the Trash
  "drop_pun",            // D51
  "exclamation",         // brand voice
  "fr_tutoiement",       // glossary: « vous »
  "fr_units",            // glossary: Go/Mo with a non-breaking space
  "fr_typography",       // glossary: nbsp before colon, « » with nbsp
  "fr_regional",         // Quebec-only term on a France page (owner choice open, see cachedrop-website #130)
  "ahead_of_app",        // D51: claim the shipped build lacks
  "contradicts_product", // D54 "Left out on purpose": RAM boosting, antivirus, ... (never_claim)
] as const;
export const Rule = z.enum(RULES);

export const Finding = z.object({
  rule: Rule,
  severity: Severity,
  source: z.enum(["code", "model"]),
  quote: z.string().min(1).max(400),         // verbatim from the draft (model quotes are checked in code)
  message: z.string().max(300),
  fix: z.string().max(400).nullable(),       // exact replacement text when there is one
});
export type Finding = z.infer<typeof Finding>;

export const ClaimsReview = z.object({
  draft_id: z.string(),
  reviewed_at: z.iso.datetime(),
  verdict: z.enum(["block", "pass_with_notes", "pass"]),
  findings: z.array(Finding),
  model: z.string().nullable(),              // null when only code checks ran
  facts_version: z.string(),                 // product-facts.json `as_of`, so a review can be re-checked
  cost_usd: z.number().nonnegative(),
}).refine(r => r.verdict === (r.findings.some(f => f.severity === "block") ? "block" : r.findings.length ? "pass_with_notes" : "pass"),
  { message: "verdict must follow from the findings" });
export type ClaimsReview = z.infer<typeof ClaimsReview>;

export const verdictFor = (findings: Finding[]): ClaimsReview["verdict"] =>
  findings.some(f => f.severity === "block") ? "block" : findings.length ? "pass_with_notes" : "pass";

/** What the reviewer checks against. Curated from the website decisions and the shipped release notes. */
export const ProductFacts = z.object({
  as_of: z.string(),                         // date + latest shipped version, e.g. "2026-11-10 / 1.0.4"
  sources: z.array(z.string()).min(1),
  price: z.object({ regular: z.string(), offer: z.string() }),
  fact_sheet: z.array(z.string()).min(1),
  shipped_features: z.array(z.object({ feature: z.string(), since: z.string() })).min(5),
  never_claim: z.array(z.string()),          // things the app deliberately doesn't do (D54 "Left out on purpose")
  vendor_tools_allowed: z.array(z.string()), // vendors' own managers may be named anywhere (D48)
  extra_competitors: z.array(z.object({ id: z.string(), pattern: z.string() })), // beyond the tracker's BRANDS
});
export type ProductFacts = z.infer<typeof ProductFacts>;

// ---- On-page optimizer (wave 1, agent #3) ----

export const FixField = z.enum(["title", "meta_description", "opening", "html_lang", "hreflang", "json_ld"]);

/** One exact change to one cachedrop.io page, from one on-page run. Text fixes carry their claims review. */
export const OnpageFix = z.object({
  url: z.string().url(),
  locale: Locale,
  query_id: z.string(),
  field: FixField,
  current: z.string().nullable(),
  proposed: z.string().min(1).max(600),
  why: z.string().max(400),
  source: z.enum(["code", "model"]),
  review: z.enum(["block", "pass_with_notes", "pass"]).nullable(), // null for code fixes (no copy)
  review_notes: z.array(z.string()),
  existing_ticket: z.string().nullable(),    // e.g. "cachedrop-website #130" when already filed
  decision_bound: z.string().nullable(),     // the website decision that fixes this field today, if any: needs an amendment
});
export type OnpageFix = z.infer<typeof OnpageFix>;
