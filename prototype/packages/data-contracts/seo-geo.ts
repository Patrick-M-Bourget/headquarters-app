// Contracts for the SEO/GEO tracker (docs/seo-geo-plan.md). Framework-independent, like index.ts.
import { z } from "zod";

export const Audience = z.enum(["producers", "developers", "video_editors", "general"]);
export const Intent = z.enum(["recommendation", "how_to", "comparison", "alternative"]);
export const Engine = z.enum(["claude", "gemini", "chatgpt"]);

export const Query = z.object({
  id: z.string().regex(/^q\d{2,3}$/),        // q01, q02, ...
  text: z.string().min(12).max(200),         // what a buyer would type or ask
  audience: Audience,
  intent: Intent,
  keywords: z.array(z.string().min(2).max(60)).min(1).max(2), // short search keywords for the keyword tracker
});
export type Query = z.infer<typeof Query>;

/** A versioned query set. Frozen once approved: weekly results are only comparable within one version. */
export const QuerySet = z.object({
  version: z.number().int().positive(),
  created_at: z.iso.datetime(),
  generator_model: z.string(),
  approved_by: z.string().nullable(),       // null = draft
  approved_at: z.iso.datetime().nullable(),
  queries: z.array(Query).min(15).max(40),
}).superRefine((s, ctx) => {
  const ids = new Set<string>(), texts = new Set<string>();
  for (const q of s.queries) {
    if (ids.has(q.id)) ctx.addIssue({ code: "custom", message: `duplicate id ${q.id}` });
    const t = q.text.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
    if (texts.has(t)) ctx.addIssue({ code: "custom", message: `duplicate text ${q.id}` });
    ids.add(q.id); texts.add(t);
  }
  if ((s.approved_by === null) !== (s.approved_at === null)) ctx.addIssue({ code: "custom", message: "approved_by and approved_at go together" });
});
export type QuerySet = z.infer<typeof QuerySet>;

/** One engine's answer to one query, stored verbatim so labels can be re-checked. */
export const EngineAnswer = z.object({
  query_id: z.string(),
  query_set_version: z.number().int().positive(),
  engine: Engine,
  model: z.string(),
  asked_at: z.iso.datetime(),
  answer_text: z.string(),
  cited_urls: z.array(z.string()),
  error: z.string().nullable(),
});

/** Visibility of one brand in one answer. */
export const Mention = z.object({
  query_id: z.string(),
  engine: Engine,
  brand: z.string(),                         // "cachedrop" or a competitor id
  mentioned: z.boolean(),
  recommended: z.boolean(),                  // stance is top_pick or suggested
  stance: z.enum(["top_pick", "suggested", "mentioned"]).nullable().optional(), // null/absent when not mentioned (older runs: absent)
  position: z.number().int().positive().nullable(), // order of first mention among named products
  cited_own_site: z.boolean(),               // the brand's own domain is among cited URLs
  evidence: z.string().max(400).nullable(),  // verbatim sentence from the answer (checked in code)
}).refine(m => !m.recommended || m.mentioned, { message: "recommended implies mentioned" })
  .refine(m => m.stance == null || (m.mentioned && m.recommended === (m.stance !== "mentioned")), { message: "stance must agree with mentioned/recommended" })
  .refine(m => !m.mentioned || (m.position !== null && !!m.evidence), { message: "a mention needs position and evidence" });

// ---- On-page auditor (plan Q13) ----

/** Facts read from a page's HTML in code. No model involved. */
export const PageChecks = z.object({
  title: z.string().nullable(),
  meta_description: z.string().nullable(),
  h1: z.array(z.string()),                   // every H1 on the page (more than one is itself a finding)
  canonical: z.string().nullable(),
  canonical_is_self: z.boolean(),            // canonical points at the fetched URL (ignoring trailing slash)
  json_ld_types: z.array(z.string()),        // @type values from all JSON-LD blocks, @graph included
  internal_links: z.number().int().nonnegative(),
  word_count: z.number().int().nonnegative(), // readable text
});
export type PageChecks = z.infer<typeof PageChecks>;

/** Model judgment: does the page answer its question near the top? The quote is checked in code. */
export const AnswerCheck = z.object({
  verdict: z.enum(["yes", "partial", "no", "unverified"]), // "unverified" = the model said yes/partial but its quote is not in the opening
  quote: z.string().max(400).nullable(),
  model: z.string(),
}).refine(a => a.verdict === "no" || a.verdict === "unverified" || !!a.quote, { message: "yes/partial needs a verified quote" });
export type AnswerCheck = z.infer<typeof AnswerCheck>;

/** One page audited against one question from the frozen query set. */
export const PageAudit = z.object({
  url: z.string().url(),
  query_id: z.string(),
  query_text: z.string(),
  audited_at: z.iso.datetime(),
  http_status: z.number().int(),
  error: z.string().nullable(),
  checks: PageChecks.nullable(),             // null when the fetch failed
  answer: AnswerCheck.nullable(),            // null when the fetch failed or the model step was skipped
}).refine(p => (p.error === null) === (p.checks !== null), { message: "checks are present exactly when the fetch succeeded" });
export type PageAudit = z.infer<typeof PageAudit>;

export const AI_CRAWLERS = ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"] as const;

/** Site-wide checks for AI answer engines. */
export const SiteAudit = z.object({
  origin: z.string().url(),
  llms_txt: z.boolean(),                     // /llms.txt returns 200 with content
  robots_allows: z.record(z.enum(AI_CRAWLERS), z.boolean()), // may the crawler fetch "/"
});
export type SiteAudit = z.infer<typeof SiteAudit>;

/** One own page next to the top competing pages for the same question, with the gaps found in code. */
export const PageComparison = z.object({
  page: PageAudit,
  competitors: z.array(PageAudit).max(5),
  gaps: z.array(z.string()),
});
export type PageComparison = z.infer<typeof PageComparison>;
