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
  recommended: z.boolean(),                  // presented as a pick, not just listed or warned against
  position: z.number().int().positive().nullable(), // order of first mention among named products
  cited_own_site: z.boolean(),               // the brand's own domain is among cited URLs
  evidence: z.string().max(400).nullable(),  // verbatim sentence from the answer (checked in code)
}).refine(m => !m.recommended || m.mentioned, { message: "recommended implies mentioned" })
  .refine(m => !m.mentioned || (m.position !== null && !!m.evidence), { message: "a mention needs position and evidence" });
