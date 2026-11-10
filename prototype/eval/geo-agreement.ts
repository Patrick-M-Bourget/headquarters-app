// Usage: node eval/geo-agreement.ts <run dir> <labels.json>
// Compares the tracker's labels with independent (blind) labels for the same answers.
// Unit = (answer, product) in the union of both lists. Agree = both list it AND agree on "recommended".
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BRANDS, productId } from "../runners/seo-geo/labels.ts";

type Human = { id: string; cachedrop_mentioned: boolean; products: { name: string; recommended: boolean }[] };
const [runDir, labelsPath] = process.argv.slice(2);
const mentions: any[] = JSON.parse(readFileSync(join(runDir, "mentions.json"), "utf8"));
const human: Human[] = JSON.parse(readFileSync(labelsPath, "utf8"));
const idFor = (name: string) => BRANDS.find(b => b.pattern.test(name))?.id ?? productId(name);

let units = 0, agree = 0, onlyTracker = 0, onlyHuman = 0, recDisagree = 0, cdAgree = 0;
const issues: string[] = [];
for (const h of human) {
  const [q, engine] = h.id.split("/");
  const t = new Map(mentions.filter(m => m.query_id === q && m.engine === engine && m.mentioned && m.brand !== "cachedrop").map(m => [m.brand, m.recommended]));
  const hm = new Map(h.products.map(p => [idFor(p.name), p.recommended]));
  for (const k of new Set([...t.keys(), ...hm.keys()])) {
    units++;
    if (!t.has(k)) { onlyHuman++; issues.push(`${h.id} ${k}: reviewer lists it, tracker missed it`); continue; }
    if (!hm.has(k)) { onlyTracker++; issues.push(`${h.id} ${k}: tracker lists it, reviewer doesn't`); continue; }
    if (t.get(k) === hm.get(k)) agree++;
    else { recDisagree++; issues.push(`${h.id} ${k}: recommended tracker=${t.get(k)} reviewer=${hm.get(k)}`); }
  }
  const tcd = mentions.some(m => m.query_id === q && m.engine === engine && m.brand === "cachedrop" && m.mentioned);
  if (tcd === h.cachedrop_mentioned) cdAgree++; else issues.push(`${h.id}: CacheDrop mentioned tracker=${tcd} reviewer=${h.cachedrop_mentioned}`);
}
const pct = (a: number, b: number) => `${((100 * a) / b).toFixed(1)}%`;
console.log(`answers ${human.length} | product units ${units} | agreement ${pct(agree, units)} (${agree}/${units})`);
console.log(`  missed by tracker ${onlyHuman} | extra in tracker ${onlyTracker} | recommended disagreements ${recDisagree}`);
console.log(`  CacheDrop mention agreement ${pct(cdAgree, human.length)}`);
console.log(`  of products both list, "recommended" agrees ${pct(agree, agree + recDisagree)}`);
for (const i of issues) console.log("  - " + i);
process.exit(agree / units >= 0.9 && cdAgree === human.length ? 0 : 1);
