// Usage: node tools/validate.ts runs/<run-id>
// Validates a run folder against the shared contract. Exit 0 = valid.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { RunOutput } from "../../packages/data-contracts/index.ts";

const dir = process.argv[2];
if (!dir || !dir.startsWith("runs/")) { console.error("usage: node tools/validate.ts runs/<run-id>"); process.exit(2); }
const files = ["run", "competitors", "sources", "observations", "recommendations"];
const data: Record<string, unknown> = {};
const problems: string[] = [];
for (const f of files) {
  const p = join(dir, `${f}.json`);
  if (!existsSync(p)) { problems.push(`missing ${f}.json`); continue; }
  try { data[f] = JSON.parse(readFileSync(p, "utf8")); } catch (e) { problems.push(`${f}.json is not valid JSON: ${(e as Error).message}`); }
}
if (!existsSync(join(dir, "report.md"))) problems.push("missing report.md");
if (problems.length === 0) {
  const r = RunOutput.safeParse(data);
  if (!r.success) problems.push(...r.error.issues.slice(0, 30).map(i => `${i.path.join(".")}: ${i.message}`));
  else {
    const srcIds = new Set(r.data.sources.map(s => s.id));
    for (const o of r.data.observations)
      if (o.source_id && !srcIds.has(o.source_id)) problems.push(`observation ${o.competitor_id}.${o.field} cites unknown source ${o.source_id}`);
  }
}
if (problems.length) { console.error("INVALID\n" + problems.join("\n")); process.exit(1); }
console.log("VALID");
