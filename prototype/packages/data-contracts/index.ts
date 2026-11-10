import { z } from "zod";

// Fields every competitor profile is scored on. Keep in sync with eval/answer-key.json.
export const FIELDS = [
  "pricing_model",        // one_time | subscription | both | free | freemium | donation
  "price_one_time_usd",   // number or null
  "price_annual_usd",     // number or null
  "free_trial",           // "yes: <terms>" | "no"
  "distribution",         // direct | mac_app_store | both | open_source
  "feature_cleanup",      // yes | no
  "feature_uninstall",    // yes | no
  "feature_disk_map",     // yes | no
  "feature_duplicates",   // yes | no
  "feature_developer_cleanup", // yes | no
  "feature_plugin_management", // yes | no (audio plug-ins, e.g. VST/AU)
  "positioning_headline", // short quote of the main promise on the homepage
] as const;

export const Status = z.enum(["verified", "unknown", "hypothesis"]);

export const Source = z.object({
  id: z.string(),
  url: z.url(),
  retrieved_at: z.iso.datetime(),
  title: z.string().optional(),
});

export const Observation = z.object({
  competitor_id: z.string(),
  field: z.enum(FIELDS),
  value: z.union([z.string(), z.number(), z.null()]),
  status: Status,
  source_id: z.string().nullable(),       // required when status = verified
  evidence: z.string().max(400).nullable(), // short verbatim quote from the source
}).refine(o => o.status !== "verified" || (o.source_id && o.evidence), {
  message: "verified observations need source_id and evidence",
});

export const Competitor = z.object({
  id: z.string(),            // kebab-case, e.g. "cleanmymac"
  name: z.string(),
  website: z.url(),
});

export const Recommendation = z.object({
  title: z.string(),
  rationale: z.string(),
  observation_refs: z.array(z.object({ competitor_id: z.string(), field: z.enum(FIELDS) })).min(1),
  status: z.literal("hypothesis"),
});

export const ResearchRun = z.object({
  run_id: z.string(),
  runner: z.enum(["claude-agent", "mastra"]),
  model: z.string(),
  started_at: z.iso.datetime(),
  finished_at: z.iso.datetime(),
  status: z.enum(["succeeded", "partial", "failed"]),
  paperclip: z.object({ issue_id: z.string().nullable(), run_id: z.string().nullable() }),
  errors: z.array(z.string()),
  usage: z.object({ input_tokens: z.number(), output_tokens: z.number(), cost_usd: z.number() }).partial().optional(),
});

export const RunOutput = z.object({
  run: ResearchRun,
  competitors: z.array(Competitor),
  sources: z.array(Source),
  observations: z.array(Observation),
  recommendations: z.array(Recommendation),
});
export type RunOutput = z.infer<typeof RunOutput>;
