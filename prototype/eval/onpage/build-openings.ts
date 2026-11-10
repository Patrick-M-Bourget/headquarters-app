// Usage: node eval/onpage/build-openings.ts <on-page run dir>
// Re-fetches every page in an on-page run and saves the opening the judge sees (first 150 words of main text)
// to eval/onpage/openings.local.json (git-ignored: it holds competitor text, and the repo is public).
// The split is fixed by a hash of the URL: 12 test items, never used for tuning; the rest are dev.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fetchPage } from "../../runners/mastra/fetch.ts";
import { mainText, opening } from "../../runners/seo-geo/onpage-checks.ts";

const runDir = process.argv[2];
const { pages } = JSON.parse(readFileSync(join(runDir, "audits.json"), "utf8"));
const audits = pages.flatMap((c: any) => [c.page, ...c.competitors]);
const items = [];
for (const a of audits) {
  const p = await fetchPage(a.url);
  if (!p.ok) { console.error(`skip ${a.url}: ${p.error}`); continue; }
  items.push({ id: createHash("sha256").update(a.url).digest("hex").slice(0, 8), url: a.url, query_id: a.query_id, question: a.query_text, opening: opening(mainText(p.html)) });
}
items.sort((x, y) => (x.id < y.id ? -1 : 1));
const out = items.map((x, i) => ({ ...x, split: i < 12 ? "test" : "dev" }));
writeFileSync(new URL("./openings.local.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");
console.log(`${out.length} openings: ${out.filter(x => x.split === "dev").length} dev, ${out.filter(x => x.split === "test").length} test`);
