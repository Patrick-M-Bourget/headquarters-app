// Market signals per locale (plan Q24): the one place a locale becomes search parameters.
// Every engine and search call reads its country/language from here, never from its own defaults.
import type { Locale } from "./seo-geo.ts";

export type Market = {
  language: string;       // BCP 47 language the query set is written in
  country: string;        // ISO 3166-1 alpha-2, Claude web search user_location.country
  serper: { gl: string; hl: string };
  tavilyCountry: string;  // Tavily `country` (lower-case English name; boosts results from that country)
};

export const MARKETS: Record<Locale, Market> = {
  "en-US": { language: "en", country: "US", serper: { gl: "us", hl: "en" }, tavilyCountry: "united states" },
  "fr-FR": { language: "fr", country: "FR", serper: { gl: "fr", hl: "fr" }, tavilyCountry: "france" },
  "de-DE": { language: "de", country: "DE", serper: { gl: "de", hl: "de" }, tavilyCountry: "germany" },
  "es-ES": { language: "es", country: "ES", serper: { gl: "es", hl: "es" }, tavilyCountry: "spain" },
  "pt-BR": { language: "pt", country: "BR", serper: { gl: "br", hl: "pt-BR" }, tavilyCountry: "brazil" },
  "ja-JP": { language: "ja", country: "JP", serper: { gl: "jp", hl: "ja" }, tavilyCountry: "japan" },
};
// Gemini: not set yet. Whether google_search grounding takes a region/language is unverified; checked in 5b step 3.

/** Where a locale's frozen query set lives. en-US v1 predates locales and stays at its original path. */
export const querySetPath = (locale: Locale, version: number, draft = false) =>
  locale === "en-US" && version === 1
    ? `research/seo-geo/query-sets/v1${draft ? ".draft" : ""}.json`
    : `research/seo-geo/query-sets/${locale}/v${version}${draft ? ".draft" : ""}.json`;
