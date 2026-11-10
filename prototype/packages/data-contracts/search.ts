// Search Console Reader contract (docs/seo-growth-plan.md, agent A). The committed summary holds counts and page paths
// only: no query text (public repo; owner, 2026-11-10). `.strict()` makes an added field a deliberate contract change.
import { z } from "zod";
import { Locale } from "./seo-geo.ts";

const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Window = z.object({ start: Day, end: Day }).strict();
const Totals = z.object({ clicks: z.number().int().nonnegative(), impressions: z.number().int().nonnegative(), ctr: z.number().min(0).max(1), position: z.number().positive().nullable() }).strict();
const Bands = z.object({ top10: z.number().int(), p11_20: z.number().int(), p21_50: z.number().int(), p51_plus: z.number().int() }).strict();
const Path = z.string().startsWith("/");

export const SearchConsoleLocale = z.object({
  locale: Locale, totals: Totals, previous_totals: Totals.nullable(), queries: z.number().int().nonnegative(), query_bands: Bands,
  previous_query_bands: Bands.nullable(), striking_queries: z.number().int().nonnegative(), pages_with_impressions: z.number().int().nonnegative(),
  pages_no_clicks: z.array(Path),
}).strict();

export const SearchConsoleSummary = z.object({
  run_id: z.string(), site: z.string(), window: Window, previous_window: Window,
  locales: z.array(SearchConsoleLocale),
  indexing: z.array(z.object({ locale: Locale, submitted: z.number().int(), indexed: z.number().int(),
    not_indexed: z.array(z.object({ path: Path, coverage: z.string().nullable() }).strict()) }).strict()).nullable(),
  bing: z.object({ clicks: z.number().int().nullable(), impressions: z.number().int().nullable(), queries: z.number().int().nullable(),
    pages_with_inbound_links: z.number().int().nullable(), inbound_links: z.number().int().nullable() }).strict(),
  inspection_errors: z.number().int().nonnegative(), cost_usd: z.number(), seconds: z.number(), finished_at: z.string(),
}).strict();
export type SearchConsoleSummary = z.infer<typeof SearchConsoleSummary>;
