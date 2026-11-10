// Usage: node eval/score.ts agent-workspace/runs/<run-id> [eval/answer-key.json]
// Compares a run's observations to the answer key. Prints accuracy, coverage, and disagreements to re-check.
import { readFileSync } from "node:fs";
import { join } from "node:path";

type Obs = { competitor_id: string; field: string; value: string | number | null; status: string; source_id: string | null; evidence: string | null };
export type Result = { competitor: string; field: string; expected: unknown[]; got: unknown; status: string; outcome: "match" | "mismatch" | "agent_unknown" | "missing" };

const norm = (v: unknown) => (typeof v === "string" ? v.trim().toLowerCase() : v);
export function matches(expected: unknown[], got: unknown): boolean {
  return expected.some(e => {
    if (e === null) return got === null || got === "" || norm(got) === "null";
    if (typeof e === "number") { const n = typeof got === "number" ? got : Number(String(got).replace(/[$,]/g, "")); return Number.isFinite(n) && Math.abs(n - e) <= 0.5; }
    const g = String(norm(got) ?? "");
    return g === norm(e) || (String(e) === "yes" && g.startsWith("yes"));
  });
}

export function score(observations: Obs[], key: Record<string, any>): Result[] {
  const out: Result[] = [];
  for (const [comp, fields] of Object.entries(key)) {
    if (comp.startsWith("_")) continue;
    for (const [field, expected] of Object.entries(fields as Record<string, unknown[]>)) {
      const o = observations.find(x => x.competitor_id === comp && x.field === field);
      if (!o) { out.push({ competitor: comp, field, expected, got: undefined, status: "-", outcome: "missing" }); continue; }
      const outcome = o.status === "unknown" ? "agent_unknown" : matches(expected, o.value) ? "match" : "mismatch";
      out.push({ competitor: comp, field, expected, got: o.value, status: o.status, outcome });
    }
  }
  return out;
}

if (import.meta.main) {
  const [dir, keyPath = "eval/answer-key.json"] = process.argv.slice(2);
  const obs: Obs[] = JSON.parse(readFileSync(join(dir, "observations.json"), "utf8"));
  const res = score(obs, JSON.parse(readFileSync(keyPath, "utf8")));
  const c = (k: Result["outcome"]) => res.filter(r => r.outcome === k).length;
  const decided = c("match") + c("mismatch");
  console.log(`scored fields: ${res.length} | match ${c("match")} | mismatch ${c("mismatch")} | agent unknown ${c("agent_unknown")} | missing ${c("missing")}`);
  console.log(`accuracy (match / decided): ${decided ? ((100 * c("match")) / decided).toFixed(1) : "n/a"}% | coverage (decided / scored): ${((100 * decided) / res.length).toFixed(1)}%`);
  for (const r of res.filter(r => r.outcome !== "match"))
    console.log(`  ${r.outcome.padEnd(13)} ${r.competitor}.${r.field}: got ${JSON.stringify(r.got)} (${r.status}), key ${JSON.stringify(r.expected)}`);
  const verified = obs.filter(o => o.status === "verified").length;
  console.log(`all observations: ${obs.length} | verified ${verified} | unknown ${obs.filter(o => o.status === "unknown").length}`);
}
