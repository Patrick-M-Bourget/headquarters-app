import { test } from "node:test";
import assert from "node:assert/strict";
import { codeFixes, copyNeeds, formatFixes, limitProblems, pageKind } from "../runners/marketing/onpage-fixes.ts";
import { PageAudit } from "../packages/data-contracts/seo-geo.ts";

const checks = { title: "Nettoyer son Mac – Récupérez votre espace, payez une fois | CacheDrop", meta_description: "x".repeat(197), h1: ["H"], canonical: "https://cachedrop.io/fr/", canonical_is_self: true,
  json_ld_types: ["FAQPage"], internal_links: 3, word_count: 115, html_lang: "fr-CA", hreflang: [] };
const audit = (over: object = {}) => PageAudit.parse({ url: "https://cachedrop.io/fr/", query_id: "q01", query_text: "Quel nettoyeur Mac ?", audited_at: "2026-11-10T00:00:00Z", http_status: 200, error: null, checks,
  answer: { verdict: "no", quote: null, reason: "r", model: "m" }, ...over });
const comp = (types: string[]) => PageAudit.parse({ url: "https://x.fr/a", query_id: "q01", query_text: "q", audited_at: "2026-11-10T00:00:00Z", http_status: 200, error: null, checks: { ...checks, json_ld_types: types }, answer: null });

test("page kind from the path, French prefix ignored", () => {
  assert.equal(pageKind("https://cachedrop.io/fr/"), "home");
  assert.equal(pageKind("https://cachedrop.io/pricing/"), "pricing");
  assert.equal(pageKind("https://cachedrop.io/fr/cleanmymac-alternative/"), "compare");
  assert.equal(pageKind("https://cachedrop.io/fr/clear-system-data-mac/"), "guide");
});

test("code fixes: fr-CA on a France page points at the existing ticket; JSON-LD only from the allowed list", () => {
  const f = codeFixes(audit(), [comp(["BreadcrumbList", "Article"]), comp(["BreadcrumbList", "Article", "HowTo"]), comp(["HowTo"])], "fr-FR");
  const lang = f.find(x => x.field === "html_lang")!;
  assert.equal(lang.proposed, '<html lang="fr">'); assert.equal(lang.existing_ticket, "cachedrop-website #130");
  const ld = f.filter(x => x.field === "json_ld").map(x => x.proposed);
  assert.equal(ld.length, 1); assert.match(ld[0], /BreadcrumbList/); // no Article; no HowTo on the home page
  assert.deepEqual(codeFixes(audit({ checks: { ...checks, html_lang: "fr" } }), [], "fr-FR"), []);
  assert.equal(codeFixes(audit({ url: "https://cachedrop.io/", checks: { ...checks, html_lang: "en" } }), [], "en-US").length, 0);
});

test("copy needs: long title and meta; opening only when the judge said no or partial", () => {
  assert.deepEqual(copyNeeds(audit()), { title: true, meta_description: true, opening: "no" });
  const ok = audit({ checks: { ...checks, title: "Short | CacheDrop", meta_description: "y".repeat(150) }, answer: { verdict: "yes", quote: "q", model: "m" } });
  assert.deepEqual(copyNeeds(ok), { title: false, meta_description: false, opening: null });
});

test("limits are enforced in code", () => {
  assert.deepEqual(limitProblems("title", "Vider le cache Adobe sur Mac | CacheDrop"), []);
  assert.equal(limitProblems("title", "Vider le cache Adobe sur Mac").length, 1);
  assert.equal(limitProblems("meta_description", "z".repeat(156)).length, 1);
  assert.equal(limitProblems("opening", "trop court").length, 1);
  assert.deepEqual(limitProblems("opening", Array(50).fill("mot").join(" ")), []);
});

test("report marks ticketed and blocked fixes", () => {
  const base = { url: "https://cachedrop.io/fr/", locale: "fr-FR", query_id: "q01", current: null, why: "w", source: "code", review: null, review_notes: [], decision_bound: null } as const;
  const md = formatFixes([{ ...base, field: "html_lang", proposed: "p", existing_ticket: "cachedrop-website #130" }, { ...base, field: "opening", proposed: "o", source: "model", review: "block", existing_ticket: null }], "run");
  assert.match(md, /already cachedrop-website #130/); assert.match(md, /BLOCKED, not proposed/);
});

test("runs from before the lang check get no html_lang fix", () => {
  const { html_lang, hreflang, ...old } = checks;
  assert.equal(codeFixes(audit({ url: "https://cachedrop.io/", checks: old }), [], "en-US").length, 0);
});
