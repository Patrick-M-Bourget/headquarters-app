import { test } from "node:test";
import assert from "node:assert/strict";
import { allowedNumbers, analyzeWeek, formatFunnel, parseFunnelCsv, strayNumbers } from "../runners/marketing/funnel.ts";
import { FunnelReport } from "../packages/data-contracts/marketing.ts";

// Synthetic numbers for the tests only.
const CSV = `week,step,dim,value,count
2026-11-09,visitors,all,all,2000
2026-11-09,signups,all,all,120
2026-11-09,download_starts,all,all,100
2026-11-09,first_launch,all,all,40
2026-11-09,purchases,all,all,6
2026-11-09,signups,lang,en,90
2026-11-09,signups,lang,fr,30
2026-11-09,purchases,lang,en,5
2026-11-09,purchases,lang,fr,1
2026-11-09,signups,filling,music-audio,50
2026-11-02,signups,all,all,10`;

test("loader refuses personal columns and malformed rows", () => {
  assert.throws(() => parseFunnelCsv("email,count\na@b.c,1"), /personal columns: email/);
  assert.throws(() => parseFunnelCsv("week,step,dim,value,count\n2026-11-09,signups,utm_source,someone@example.com,1"), /personal/);
  assert.throws(() => parseFunnelCsv("week,step,dim,value,count\n2026-11-09,signups,all,en,1"), /dim all/);
  assert.equal(parseFunnelCsv(CSV).length, 11);
});

test("week analysis: step rates, biggest drop, segments, low sample", () => {
  const a = analyzeWeek(parseFunnelCsv(CSV), "2026-11-09");
  assert.deepEqual(a.steps.map(s => [s.step, s.count, s.from_previous]), [["visitors", 2000, null], ["signups", 120, 6], ["download_starts", 100, 83.3], ["first_launch", 40, 40], ["purchases", 6, 15]]);
  assert.deepEqual(a.biggest_drop, { from: "visitors", to: "signups", rate: 6 });
  assert.deepEqual(a.segments.find(s => s.value === "fr"), { dim: "lang", value: "fr", signups: 30, purchases: 1, rate: 3.3 });
  assert.equal(a.segments.find(s => s.value === "music-audio")!.purchases, null);
  assert.equal(a.low_sample, false);
  assert.equal(analyzeWeek(parseFunnelCsv(CSV), "2026-11-02").low_sample, true);
});

test("model text may only use the table's numbers", () => {
  const a = analyzeWeek(parseFunnelCsv(CSV), "2026-11-09");
  const ok = allowedNumbers(a);
  assert.deepEqual(strayNumbers("Of 2,000 visitors, 120 signed up (6%); 83.3% started a download. Run it 2 weeks.", ok), []);
  assert.deepEqual(strayNumbers("Signups grew 45% to 120.", ok), ["45"]);
  const md = formatFunnel(FunnelReport.parse({ ...a, summary: null, experiment: null, model: null, cost_usd: 0 }));
  assert.match(md, /Biggest drop: visitors → signups \(6%\)/);
});

test("the week's date and the fixed prices are allowed numbers", () => {
  const ok = allowedNumbers(analyzeWeek(parseFunnelCsv(CSV), "2026-11-09"));
  assert.deepEqual(strayNumbers("Week of 2026-11-09; price $29.99, now $19.99.", ok), []);
});
