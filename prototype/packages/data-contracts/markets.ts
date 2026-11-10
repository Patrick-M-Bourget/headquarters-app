// Market signals per locale (plan Q24): the one place a locale becomes search parameters.
// Every engine and search call reads its country/language from here, never from its own defaults.
import type { Locale } from "./seo-geo.ts";

export type Market = {
  name: string;           // for prompts and reports, e.g. "French, France"
  language: string;       // BCP 47 language the query set is written in
  country: string;        // ISO 3166-1 alpha-2, Claude web search user_location.country
  serper: { gl: string; hl: string };
  tavilyCountry: string;  // Tavily `country` (lower-case English name; boosts results from that country)
};

export const MARKETS: Record<Locale, Market> = {
  "en-US": { name: "English, United States", language: "en", country: "US", serper: { gl: "us", hl: "en" }, tavilyCountry: "united states" },
  "fr-FR": { name: "French, France", language: "fr", country: "FR", serper: { gl: "fr", hl: "fr" }, tavilyCountry: "france" },
  "de-DE": { name: "German, Germany", language: "de", country: "DE", serper: { gl: "de", hl: "de" }, tavilyCountry: "germany" },
  "es-ES": { name: "Spanish, Spain", language: "es", country: "ES", serper: { gl: "es", hl: "es" }, tavilyCountry: "spain" },
  "pt-BR": { name: "Portuguese, Brazil", language: "pt", country: "BR", serper: { gl: "br", hl: "pt-BR" }, tavilyCountry: "brazil" },
  "ja-JP": { name: "Japanese, Japan", language: "ja", country: "JP", serper: { gl: "jp", hl: "ja" }, tavilyCountry: "japan" },
};
// Gemini: none. retrievalConfig latLng/languageCode is accepted but ignored by Search grounding (tested 2026-11-09); the question's language is its only market signal.

/** Where a locale's frozen query set lives. en-US v1 predates locales and stays at its original path. */
export const querySetPath = (locale: Locale, version: number, draft = false) =>
  locale === "en-US" && version === 1
    ? `research/seo-geo/query-sets/v1${draft ? ".draft" : ""}.json`
    : `research/seo-geo/query-sets/${locale}/v${version}${draft ? ".draft" : ""}.json`;
