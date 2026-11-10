// Weekly Report agent (plan step 6). The Paperclip routine opens one issue a week assigned to this process agent.
// Paperclip wakes the agent when the issue is assigned and again when ALL its subtasks are done or cancelled. On each wake:
//   no subtasks yet                 → open stage 1: GEO + keyword trackers per due locale, on-page audit for site locales
//   a subtask still open            → nothing (woken early)
//   stage 1 closed, stage 2 needed  → open stage 2: On-page Optimizer where gaps changed, Funnel Analyst if this week's CSV exists
//   everything closed               → write research/seo-geo/weeks/<week>/report.{md,json}; the issue goes to owner review
// While subtasks run, the issue is `blocked` by them (Paperclip's dependency wait). A failed subtask stays `blocked` and holds the report back: cancel it in Paperclip to release it (the report then marks
// that market's run as older). Approve or drop proposals in the review; Claude files the website tickets and updates the ledger.
//
//   By hand: node runners/seo-geo/weekly.ts [--week 2026-11-09] [--locales en-US,fr-FR]   (report only, from saved runs)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Locale } from "../../packages/data-contracts/seo-geo.ts";
import { createChild, getIssue, issueParams, listAgents, listChildren, patchIssue, reportToIssue } from "../../packages/paperclip-client/index.ts";
import { buildReport, dueLocales, loadRuns, localeFacts, renderReport, SITE_LOCALES, stage1, stage2, weekOf, type LedgerEntry, type Task } from "./weekly-report.ts";

const root = new URL("../../", import.meta.url).pathname;
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const ledger = (): LedgerEntry[] => JSON.parse(readFileSync(join(root, "research/seo-geo/proposals-ledger.json"), "utf8")).entries;
const TERMINAL = ["done", "cancelled"];
const BOARD_REVIEW = { stages: [{ type: "review", participants: [{ type: "user", userId: "local-board" }] }] };

function writeReport(week: string, locales: Locale[], issue: { id: string; identifier?: string } | null) {
  const report = { ...buildReport(root, week, locales, ledger()), issue: issue ? { id: issue.id, identifier: issue.identifier ?? null } : null };
  const md = renderReport(report);
  const dir = join(root, "research/seo-geo/weeks", week);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "report.json"), JSON.stringify(report, null, 2) + "\n");
  writeFileSync(join(dir, "report.md"), md);
  return { report, md, path: `research/seo-geo/weeks/${week}/report.md` };
}

/** Paperclip's way to wait (recovery treats an issue left in_progress as stuck): blocked by the open subtasks; it wakes us when they close. */
const waitOn = (parentId: string, ids: string[]) => patchIssue(parentId, { status: "blocked", blockedByIssueIds: ids });

async function openTasks(parent: { id: string; identifier?: string }, tasks: Task[], stage: number) {
  const agents = await listAgents();
  const ids: string[] = [];
  for (const t of tasks) {
    const a = agents.find(x => x.name === t.agent);
    if (!a) throw new Error(`no agent named "${t.agent}" in Paperclip`);
    const params = Object.entries(t.params).map(([k, v]) => `${k}: ${v}`).join("\n");
    ids.push((await createChild(parent.id, t.title, `${params}\nstage: ${stage}\n\nSubtask of the weekly report ${parent.identifier ?? parent.id}. Parameters are the \`key: value\` lines above.`, a.id)).id);
  }
  await waitOn(parent.id, ids);
}

async function main() {
  const { issue } = await issueParams();
  if (!issue) {
    const week = arg("--week") ?? weekOf(new Date());
    const locales = (arg("--locales")?.split(",") ?? Locale.options).map(l => Locale.parse(l));
    const { report, path } = writeReport(week, locales, null);
    console.log(`Weekly report ${week}: ${report.proposals.length} proposals, $${report.cost_usd} this week. ${path}`);
    return;
  }
  try {
    const parent = await getIssue(issue.id);
    const week = weekOf(new Date(parent.createdAt ?? Date.now()));
    const out = join(root, "research/seo-geo/weeks", week, "report.json");
    if (existsSync(out) && JSON.parse(readFileSync(out, "utf8")).issue?.id === issue.id) {
      console.log(`report for ${week} already written for this issue; nothing to do`); // e.g. a review round-trip woke us
      return;
    }
    const due = dueLocales(week);
    const children = await listChildren(issue.id);
    if (children.length === 0) {
      const tasks = stage1(due, week);
      await openTasks(issue, tasks, 1);
      console.log(`opened ${tasks.length} stage-1 subtasks for ${due.join(", ")}`);
      return;
    }
    const open = children.filter(c => !TERMINAL.includes(c.status));
    if (open.length) { await waitOn(issue.id, open.map(c => c.id)); console.log(`${open.length} subtask(s) still open; waiting`); return; }
    if (!children.some(c => /\bstage: 2\b/.test(c.description ?? ""))) {
      const runs = loadRuns(root);
      const onpage = SITE_LOCALES.filter(l => due.includes(l)).map(l => ({ locale: l, o: localeFacts(root, runs, l, week).onpage }))
        .filter(x => x.o && x.o.finished_at.slice(0, 10) >= week) // only audits from this week's subtasks
        .map(({ locale, o }) => ({ locale, dir: o!.dir, gaps: o!.gap_list, previousGaps: o!.previous_gap_list }));
      const csv = `research/marketing/funnel/${week}.csv`;
      const tasks = stage2(onpage, week, existsSync(join(root, csv)) ? csv : null);
      if (tasks.length) {
        await openTasks(issue, tasks, 2);
        console.log(`opened ${tasks.length} stage-2 subtasks`);
        return;
      }
    }
    const { report, md, path } = writeReport(week, due, issue);
    await patchIssue(issue.id, { executionPolicy: BOARD_REVIEW }).catch(e => console.error("could not add the owner review stage:", e.message));
    await reportToIssue(issue.id, `${md}\nFile: ${path}`, "done");
    console.log(`Weekly report ${week}: ${report.proposals.length} proposals. ${path}`);
  } catch (e) {
    await reportToIssue(issue.id, `Weekly report failed: ${(e as Error).message}`, "blocked").catch(() => {});
    throw e;
  }
}

if (import.meta.main) await main();
