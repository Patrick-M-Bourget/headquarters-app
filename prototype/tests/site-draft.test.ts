import { test } from "node:test";
import assert from "node:assert/strict";
import { asMarkdown, findBlocks, insertLang, shapeProblem, skeleton, strings } from "../runners/marketing/copy-blocks.ts";
import { pageFindings, UNITS, valueProblems } from "../runners/marketing/site-draft.ts";

const ASTRO = `---
// A page's copy: it's here. "Quotes" and en: in a comment are not keys.
import { guides } from '../guides';
const copy = {
  en: {
    ...guides.creator.en,
    headline: 'Clear the cache',
    faq: [['Is it safe?', 'Yes, it’s <span class="ic">safe</span>.']] as Array<[string, string]>,
    title: \`Pricing – \${pricingCopy.en.was} once\`,
    cta: 'Download for Mac',
  },
  fr: {
    ...guides.creator.fr,
    headline: 'Vider le cache',
    faq: [['Est-ce sûr ?', 'Oui.']] as Array<[string, string]>,
    title: \`Tarifs – \${pricingCopy.fr.was} une fois\`,
    cta: 'Télécharger pour Mac',
  },
};
const label = { en: 'Label', fr: 'Étiquette' }[lang];
---
<p>en: not code</p>`;

const DE = `{
    ...guides.creator.de,
    headline: 'Cache leeren',
    faq: [['Ist das sicher?', 'Ja, es ist <span class="ic">sicher</span>.']] as Array<[string, string]>,
    title: \`Preise – \${pricingCopy.de.was} einmalig\`,
    cta: 'Für Mac herunterladen',
  }`;

test("findBlocks pairs each en value with its fr value, in code only", () => {
  const bs = findBlocks(ASTRO, "x.astro");
  assert.equal(bs.length, 2);
  assert.match(bs[0].en.text, /^\{[\s\S]*Download for Mac',\n  \}$/);
  assert.equal(bs[1].en.text, "'Label'");
  assert.equal(bs[1].fr.text, "'Étiquette'");
  assert.equal(bs[0].key, "copy");
});

test("shape: strings and language names may change, code may not", () => {
  const [b] = findBlocks(ASTRO, "x.astro");
  assert.equal(shapeProblem(b.en.text, b.fr.text), null);
  assert.equal(shapeProblem(b.en.text, DE), null);
  assert.ok(shapeProblem(b.en.text, DE.replace("cta:", "button:")), "renamed key");
  assert.ok(shapeProblem(b.en.text, DE.replace("[['Ist das sicher?', 'Ja, es ist <span class=\"ic\">sicher</span>.']]", "[]")), "array length");
  assert.ok(shapeProblem(b.en.text, DE.replace("pricingCopy.de.was", "pricingCopy.de.now")), "interpolation");
  assert.equal(skeleton("'a', // note\n'b'"), skeleton("'x','y'"));
});

test("insertLang adds de after fr and the result parses again", () => {
  const bs = findBlocks(ASTRO, "x.astro");
  const out = insertLang(ASTRO, bs, [DE, "'Beschriftung'"]);
  assert.match(out, /fr: 'Étiquette', de: 'Beschriftung' \}\[lang\]/);
  assert.match(out, /une fois`,\n    cta: 'Télécharger pour Mac',\n  \},\n  de: \{\n    \.\.\.guides\.creator\.de/);
  assert.equal(findBlocks(out, "x.astro").length, 2, "de values don't count as blocks");
});

test("strings: visible text, keys, known interpolations; asMarkdown marks headings and buttons", () => {
  const ss = strings(DE, { "pricingCopy.L.was": "29,99 $" });
  assert.deepEqual(ss.map(s => s.key), ["headline", "", "", "title", "cta"]);
  assert.equal(ss[2].text, "Ja, es ist sicher.");
  assert.equal(ss[3].text, "Preise – 29,99 $ einmalig");
  assert.deepEqual(strings("'/clear-mac/', '#feedback', 'https://x.io/a', 'once'").map(s => s.text), ["once"]);
  assert.equal(strings("'a\\u00a0b'")[0].text, "a b");
  assert.equal(asMarkdown(ss), "# Cache leeren\nIst das sicher?\nJa, es ist sicher.\n# Preise – 29,99 $ einmalig\n[Für Mac herunterladen](button)");
});

test("valueProblems: missing values, wrong shape, leftover en/fr in code", () => {
  const bs = findBlocks(ASTRO, "x.astro");
  assert.deepEqual(valueProblems(bs, { values: [{ index: 0, de: DE }, { index: 1, de: "'B'" }], verify: [] }), []);
  assert.match(valueProblems(bs, { values: [{ index: 0, de: DE }], verify: [] })[0], /value 1: missing/);
  const left = valueProblems(bs, { values: [{ index: 0, de: DE.replace("guides.creator.de", "guides.creator.en") }, { index: 1, de: "'B'" }], verify: [] });
  assert.ok(left.some(p => /still names en or fr/.test(p)));
  assert.deepEqual(valueProblems(bs, { values: [{ index: 0, de: DE.replace("Cache leeren", "Cache für en. leeren") }, { index: 1, de: "'B'" }], verify: [] }), [], "en inside a string is copy");
});

test("pageFindings: a page passes the app-language rule through a shared file it renders", () => {
  const guide = UNITS.find(u => u.kind === "guide")!;
  const own = [DE];
  assert.equal(pageFindings(guide, own, [["{ trial: 'Vor dem Kauf testen · App auf Englisch' }"]]).length, 0);
  assert.equal(pageFindings(guide, own, [["{ trial: 'Vor dem Kauf testen' }"]])[0].rule, "app_language");
  assert.equal(pageFindings(UNITS.find(u => u.path.endsWith("Nav.astro"))!, own, []).length, 0, "shared files are not pages");
});

test("units: shared files come before the pages that render them", () => {
  for (const [i, u] of UNITS.entries()) for (const r of u.renders)
    assert.ok(UNITS.findIndex(x => x.path === r) < i, `${u.path} renders ${r}`);
  assert.equal(UNITS.filter(u => ["home", "pricing", "guide"].includes(u.kind) || u.path.includes("cleanmymac")).length, 8, "plan Q26: 8 core pages");
});

test("fluency sample: sentences of 4+ words, split before a capital, fixed sample", async () => {
  const { sentencesOf, sample, CANARIES } = await import("../eval/de-fluency.ts");
  assert.deepEqual(sentencesOf(["Kurz. Der Scan ist immer kostenlos. Danach: Sie prüfen alles vorher.", "Der Scan ist immer kostenlos."]),
    ["Der Scan ist immer kostenlos.", "Danach: Sie prüfen alles vorher."]);
  assert.deepEqual(sample(["a", "b", "c"], 2), sample(["c", "b", "a"], 2));
  assert.equal(CANARIES.length, 6);
});
