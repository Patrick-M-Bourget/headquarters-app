# Workflow engine for HeadQuarters, and whether to fork Paperclip

Research note for issue #16 (map: issue #1). Checked on 2026-11-14 against vendor docs, official repositories, licence files, release notes and the npm registry. Nothing here was installed or run. Every memory figure is either the vendor's documented number or marked as unpublished; the only measured figure is the prototype's own Paperclip measurement from ADR 0001.

## Short answer

- **Adopt: Inngest, self-hosted** (`inngest start`). It is one binary with no Docker, stores to a SQLite file, bundles a run-history dashboard, and its TypeScript SDK expresses every requirement in the ticket: cron triggers, retries with a failure handler, durable sleeps and event waits, and a concurrency limit that can be shared across functions and counts only steps that are executing. Mastra ships a first-party runner for it (`@mastra/inngest`).
- **Fallback: DBOS Transact with a local Postgres.** It has the strongest documented guarantees (every step is checkpointed in Postgres, missed schedules can be backfilled automatically, queues take a concurrency of 1), and it is a library inside the app's own process. It loses to Inngest on one requirement: it has no free self-hosted run-history UI.
- **Paperclip: replace. Do not fork.** The licence allows a fork, but five of the seven recorded faults sit in core scheduling and recovery code that upstream rewrites at roughly a thousand commits a week, and none of the seven is fixed in a stable release.
- **Not chosen, and why:** Mastra's built-in engine needs nothing new but has no concurrency limit and does not replay missed schedules. Temporal's only single-binary mode is documented as not for production. Restate's documented memory pools are large for this machine and it has no built-in cron. Trigger.dev, Hatchet and Windmill need Docker for a lasting install.
- **Four things only a trial on the M6 can settle** (see [Unverified](#unverified)): Inngest's memory use, whether a hard kill loses waiting runs, what happens to a cron tick missed while the server was down, and whether the self-hosted server enforces a concurrency key shared across functions.

## What the operation asks of an engine

From the ticket, in the order used in the tables below:

1. Runs on one Mac mini, started at boot, small beside a model that takes 18 to 20 GB of 32.
2. TypeScript, with setup defined in the repo.
3. Schedules, retries, and detection of a missed or failed run.
4. Waits that last days and survive a restart.
5. A step that waits for the owner's approval.
6. A concurrency limit (one large local model at a time).
7. Run history the owner can read.

## Comparison

### What each candidate needs running

| Candidate | Version checked | Needs running | Docker needed | Memory (published) | Licence |
|---|---|---|---|---|---|
| Mastra built-in workflows | `@mastra/core` 1.83.0 (2026-11-12) | Nothing beyond the app's own Node process; snapshots go to the configured storage, libSQL by default | No | Not published | Apache-2.0, except `ee/` directories |
| Inngest self-hosted | server v1.53.0 (2026-11-12); SDK `inngest` 4.26.2 | One binary (`inngest start`): API, queue, executor, state store and dashboard. SQLite file plus an in-memory Redis whose snapshots are saved to SQLite | No | Not published | Server: SSPL with a delayed Apache-2.0 grant. SDK: Apache-2.0 |
| DBOS Transact | `@dbos-inc/dbos-sdk` 5.5.0 (2026-11-10) | A library in the app's process, plus a Postgres server | No | Not published | MIT. Self-hosted Conductor (the UI) is proprietary |
| Temporal | server v1.32.2; TS SDK v1.25.0; CLI v1.10.1 | Production: a server binary and a UI binary plus a database. Development: one binary (`temporal server start-dev`) with a bundled UI | No | Not published | MIT |
| Restate | server v1.8.1 (2026-10-21); TS SDK v1.18.3 | One binary (`restate-server`) with an embedded store and a bundled UI | No | Default pools add up to 4.75 GiB before overhead; a documented minimal configuration is about 1.5 GiB plus a 1.5 GiB invoker pool unless lowered | BSL 1.1 (own use permitted; Apache-2.0 four years after each release) |
| Trigger.dev | v4.8.5 (2026-11-12) | Compose stack: webapp, Postgres, Redis, ClickHouse, object storage, registry, supervisor; tasks run as containers | **Yes** | Webapp machine 3+ vCPU and 6+ GB; worker machine 4+ vCPU and 8+ GB | Apache-2.0 |
| Hatchet | v0.114.2 (2026-10-26) | `hatchet-lite` image plus Postgres | **Yes** for `hatchet-lite`; the Docker-free embedded mode is described for local development and CI | Not published | MIT |
| Windmill | v1.875.0 (2026-11-14) | Server, workers and Postgres via Docker Compose | **Yes** (no Docker-free server install is documented) | Rule of thumb 1 to 2 GB per worker | AGPLv3 with proprietary enterprise parts |
| Paperclip as is | `paperclipai` 2026.1106.0 | Node server with embedded Postgres | No | Measured in the prototype: about 560 MB for Node and 55 MB for Postgres (ADR 0001) | MIT |

Sources: [Mastra licence](https://github.com/mastra-ai/mastra/blob/main/LICENSE.md), [Mastra snapshots](https://mastra.ai/docs/workflows/snapshots), [Inngest self-hosting](https://www.inngest.com/docs/self-hosting), [Inngest licence](https://github.com/inngest/inngest/blob/main/LICENSE.md), [DBOS configuration](https://docs.dbos.dev/typescript/reference/configuration), [DBOS self-hosted Conductor](https://docs.dbos.dev/conductor/self-hosting/hosting-conductor), [Temporal deployment](https://docs.temporal.io/self-hosted-guide/deployment), [Temporal CLI server](https://docs.temporal.io/cli/server), [Restate installation](https://docs.restate.dev/installation), [Restate memory](https://docs.restate.dev/server/memory), [Restate licence](https://github.com/restatedev/restate/blob/main/LICENSE), [Trigger.dev Docker guide](https://trigger.dev/docs/self-hosting/docker), [Hatchet Lite](https://docs.hatchet.run/self-hosting/hatchet-lite), [Hatchet running locally](https://docs.hatchet.run/v1/running-locally), [Windmill self-host](https://www.windmill.dev/docs/advanced/self_host), [Windmill licence](https://github.com/windmill-labs/windmill/blob/main/LICENSE). Versions and licences of packages come from the GitHub API and the npm registry on the check date.

### Dropped

- **Trigger.dev.** Self-hosting is Docker Compose or Kubernetes only, tasks run as containers, and the stated minimum is two machines' worth of memory (6 GB and 8 GB). That does not fit beside the model.
- **Hatchet.** The lasting single-machine install (`hatchet-lite`) says "This deployment requires Docker installed locally to work." The embedded mode needs no Docker but is presented as "the fastest path for local development and end-to-end tests in CI"; whether it keeps data or shows the dashboard is not stated.
- **Windmill.** Docker Compose is the only documented single-machine install, and the concurrency limit is "a Cloud plans and Self-Hosted Enterprise Edition feature" ([Windmill concurrency limits](https://www.windmill.dev/docs/flows/concurrency_limit)).

### How the five remaining candidates express each requirement

| Requirement | Mastra built-in | Inngest | DBOS | Temporal | Restate |
|---|---|---|---|---|---|
| Schedules | `schedule: { cron, timezone, inputData }` on `createWorkflow`; a poll loop in the app process | `triggers: [cron("TZ=Europe/Paris 0 9 * * 1")]` | `DBOS.createSchedule({ scheduleName, workflowFn, schedule })` or `DBOS.applySchedules([...])` | `client.schedule.create({ spec, action, policies })` | None built in: "Restate doesn't have built-in cron functionality"; the guide builds one from a virtual object and delayed calls |
| Missed run | Not replayed: after a restart the next fire is computed from the current time. Delivery is described as best-effort | Not documented | `automaticBackfill: true` backfills on start; `DBOS.backfillSchedule(name, start, end)` by hand | Catch-up window, one year by default; overlap policy defaults to Skip | Own code |
| Retries and failure | `retryConfig: { attempts, delay }` per workflow, `retries` per step; `onError` callback (not durable) | `retries` (0 to 20, default four retries per step, backoff with jitter); `onFailure` handler; `inngest/function.failed` event for all functions | Steps may be retried; workflow resumes "from the last completed step". Step retry options were not read | Activity retry policies (not read in detail) | Retry policy in service configuration (not read in detail) |
| Wait for days | `.sleep()`, `.sleepUntil()`, or `suspend()` with a snapshot in storage; `restartAllActiveWorkflowRuns()` runs on boot | `step.sleep`, `step.sleepUntil`, `step.waitForEvent(id, { event, timeout, match })` | `DBOS.sleep()` ("DBOS saves the wakeup time in the database"; the example sleeps 30 days); `DBOS.recv(topic, { timeoutSeconds, suspend: true })` | `sleep('1 day')`, `condition()` | `ctx.sleep`, awakeables, workflow promises |
| Owner approval | `suspend()` in the step, then `run.resume({ step, resumeData })` from any process, by run ID | `step.waitForEvent` returns the event, or `null` on timeout; the approval is an event sent to the server | `DBOS.recv` in the workflow; `DBOS.send(workflowID, message, topic)` from outside through the DBOS Client | `defineSignal` + `setHandler` + `condition()`; `handle.signal(...)` from a client | `ctx.awakeable()`, resolved by `curl localhost:8080/restate/awakeables/<id>/resolve` |
| Concurrency limit | None documented for the built-in engine | `concurrency: { scope: "account", key: '"large-model"', limit: 1 }`, the same on every function that shares it. "A limit counts steps executing code, not all function runs in progress"; sleeps and event waits hold no slot | `DBOS.registerQueue("large_model", { globalConcurrency: 1 })` or `workerConcurrency: 1` | `maxConcurrentActivityTaskExecutions: 1` on a worker dedicated to one task queue (option documented; the dedicated-queue pattern is not spelled out in the page read) | One virtual object key runs one call at a time (not read in detail) |
| Run history UI | Studio (`mastra studio`, pointed at the running server): workflow graph, traces, schedule list with trigger history. A list of past runs in the UI is not described | Dashboard on port 8288, bundled in the binary | No free self-hosted UI. `npx dbos workflow list` and `steps` on the command line; the web console needs Conductor, which self-hosted "is released under a proprietary license" and needs a paid licence for production | Web UI on port 8233 in the development server; a separate UI binary in production | UI on port 9070, bundled |

Sources: Mastra [scheduled workflows](https://mastra.ai/docs/workflows/scheduled-workflows), [error handling](https://mastra.ai/docs/workflows/error-handling), [suspend and resume](https://mastra.ai/docs/workflows/suspend-and-resume), [overview](https://mastra.ai/docs/workflows/overview), [workers](https://mastra.ai/docs/deployment/workers), [workflow reference](https://mastra.ai/reference/workflows/workflow), [CLI](https://mastra.ai/reference/cli/mastra). Inngest [scheduled functions](https://www.inngest.com/docs/guides/scheduled-functions), [retries](https://www.inngest.com/docs/features/inngest-functions/error-retries/retries), [handling failures](https://www.inngest.com/docs/reference/typescript/functions/handling-failures), [wait for event](https://www.inngest.com/docs/features/inngest-functions/steps-workflows/wait-for-event), [concurrency](https://www.inngest.com/docs/guides/concurrency). DBOS [scheduled workflows](https://docs.dbos.dev/typescript/tutorials/scheduled-workflows), [workflows](https://docs.dbos.dev/typescript/tutorials/workflow-tutorial), [communication](https://docs.dbos.dev/typescript/tutorials/workflow-communication), [queues](https://docs.dbos.dev/typescript/tutorials/queue-tutorial), [workflow management](https://docs.dbos.dev/typescript/tutorials/workflow-management). Temporal [schedules (TypeScript)](https://docs.temporal.io/develop/typescript/schedules), [schedule concept](https://docs.temporal.io/schedule), [message passing](https://docs.temporal.io/develop/typescript/message-passing), [WorkerOptions](https://typescript.temporal.io/api/interfaces/worker.WorkerOptions). Restate [cron guide](https://docs.restate.dev/guides/cron), [external events](https://docs.restate.dev/develop/ts/external-events).

### Always-on on macOS without Docker

No candidate documents a macOS service of its own except Paperclip (`paperclipai service install` writes a launchd plist; upstream issue [#16435](https://github.com/paperclipai/paperclip/issues/16435) reports that it rewrites the plist and drops custom environment variables). For every other candidate the install is a launchd job whose plist is kept in the repo. This is general macOS practice, not something a vendor page states.

| Candidate | What launchd would start | How it is installed |
|---|---|---|
| Mastra built-in | The app: `mastra start` after `mastra build`. Schedules need a long-lived process, and with a custom server `mastra.startWorkers()` must be called or they never fire | npm, already a dependency |
| Inngest | `inngest start` with a signing key, an event key and `--sqlite-dir`; and the app's worker, either an HTTP endpoint (`serve`) or an outbound connection (`connect()`, gateway on port 8289) | `npm install -g inngest-cli`, the install script, or the release binary |
| DBOS | Postgres, and the app | Postgres by any macOS route; the SDK from npm |
| Temporal | `temporal server start-dev --db-filename <file>` (documented as "not intended for production use"), or the server and UI binaries plus a database; and the worker | Temporal CLI binary |
| Restate | `restate-server`, and the app's service endpoint | `brew install restatedev/tap/restate-server` or `npm install --global @restatedev/restate-server` |

### Notes per candidate

**Mastra built-in.** It is already in the repo and adds no process. Two requirements are not met by the engine itself. The workflow reference lists no concurrency or queue option. The scheduler states that an occurrence that elapsed while the process was down is not replayed, that delivery is best-effort, and that "Evented workflows don't deduplicate". Both gaps can be closed in the project's own code (a lock around the one shared model call; a start-up check for this week's run), but then the project is writing the parts an engine exists to provide. Mastra also moves fast: eight minor releases of `@mastra/core` between 2026-10-11 and 2026-11-12 (npm registry).

**Inngest.** `inngest start` is described in its own help text as "[Beta] Run Inngest as a single-node service", although the page also says "Self-hosting support for Inngest is supported as of the 1.0 release." State durability is the open point: "Queue and state store snapshots are periodically saved to the SQLite database, including prior to shutdown." The interval is not stated, and the page says nothing about a crash between snapshots. An external Redis (`--redis-uri`) and Postgres (`--postgres-uri`) are supported if the trial shows the default loses state. The server licence (SSPL) restricts offering Inngest as a service to others; running it for one's own operation is not that. The licence also names a delayed Apache-2.0 grant; its terms were not read in full. Mastra's Inngest guide accepts `concurrency`, `rateLimit`, `throttle`, `debounce`, `priority`, `retries` and `cron` on `createWorkflow`, and documents only the local dev server as a target, not a self-hosted production server ([Mastra Inngest guide](https://mastra.ai/guides/deployment/inngest)). `@mastra/inngest` 1.11.2 requires `@mastra/core` 1.83 or later; the repo is on 1.82.

**DBOS.** The system database is Postgres only in the configuration reference ("A connection string to a Postgres database"). The run-history gap is real: the hosted Conductor exchanges "workflow metadata and commands" with DBOS's service, which sits badly with a local-first operation, and its plan terms for a self-hosted app were not found. Self-hosted Conductor ships as container images and needs a licence key.

**Temporal.** The functional fit is complete and the licence is MIT. The cost is operational: the documented production routes are Docker Compose, two Go binaries with a database, or Helm. The single-binary development server keeps state in a file with `--db-filename`, but the docs warn that it "skips certain HTTP security checks". TypeScript workflows also run in a deterministic sandbox, which is more ceremony than the other SDKs (general knowledge, not checked here).

**Restate.** A single binary with a bundled UI and Homebrew and npm installs. Its memory page says the defaults "are sized for production workloads" and sum to 4.75 GiB of pools; the minimal example lowers three of the four pools. No built-in cron means the schedule requirement is own code.

**Found but not better: Vercel Workflow SDK** (`workflow` 5.5.0, Apache-2.0). It has a Local world "for development and testing" and a Postgres world for self-hosting. Its deployment page does not say whether a plain Node process is enough off Vercel, and the only run inspection off Vercel is a CLI (`npx workflow inspect runs`) ([deploying](https://workflow-sdk.dev/docs/deploying)).

## The Paperclip fork question

### Facts

- **Licence.** MIT ([LICENSE](https://github.com/paperclipai/paperclip/blob/master/LICENSE); npm `paperclipai` reports MIT). Forking and modifying are permitted.
- **Source.** [github.com/paperclipai/paperclip](https://github.com/paperclipai/paperclip), default branch `master`, a pnpm monorepo (`server`, `ui`, `cli`, `packages`).
- **Size** (GitHub API, tree of `master` on the check date). 166.5 MB of TypeScript in 12,347 files. `server/src` alone is 82.6 MB in 4,403 files; `ui/src` is 28.3 MB. Single files: `server/src/services/recovery/service.ts` 268 KB, `server/src/services/heartbeat.ts` 226 KB, `server/src/services/heartbeat/recovery.ts` 149 KB, `server/src/services/routines.ts` 142 KB. More than 150 non-test source files have "recovery" in their path.
- **Pace** (GitHub API and npm). 8,030 commits since the repository was created on 2026-03-02. Weekly commit counts for the last twelve weeks: 192, 216, 180, 104, 104, 178, 227, 352, 292, 447, 898, 1,035. Stable releases roughly every one to two weeks, with one four-week gap (25 between 2026-04-27 and 2026-11-06), plus nightly and canary builds. The 2026.1106.0 release notes count 515 commits and migrations `0334` to `0374`; the 2026.1110.0 beta adds migrations `0375` to `0451`. 3,766 open issues and 2,895 open pull requests.
- **Direction.** The 2026.1106.0 notes remove "the Pipelines experiment" as a breaking change and make the Paperclip Runner the default for coding-agent harnesses. The `process` adapter that every HeadQuarters job uses is one 4.7 KB file with a 1.4 KB doc page.

### Where each recorded fault sits

| Fault (journal, anti-patterns, ADR 0001) | Where in the source | Core or edge | Upstream state on 2026-11-14 |
|---|---|---|---|
| Recovery hold that could not be retried (HEA-7) | `server/src/services/issue-recovery-actions.ts`, `execution-recovery-resolution.ts`, `recovery/service.ts` | Core | **Not confirmed fixed.** The 2026.1106.0 notes claim "one reliable task-level Retry" for held tasks, yet the jam was recorded on that same version. The 2026.1110.0 beta lists further Retry fixes ([#19666](https://github.com/paperclipai/paperclip/pull/19666), [#19384](https://github.com/paperclipai/paperclip/pull/19384)). A related report is open: [#20980](https://github.com/paperclipai/paperclip/issues/20980), "a process_lost run permanently blocks its issue" for external adapters |
| Approval that silently did not take (`holdDrifted` path) | `server/src/services/issue-execution-policy.ts` (48 KB) | Core | **No upstream report found.** `holdDrifted` appears only in that file. 2026.1106.0 adds a `422 unexecuted_review_stage` for a different case |
| A comment wakes and re-runs a `process` agent | `server/src/modules/wake-queue/`, `issue-assignment-wakeup.ts` | Core, and by design: a comment on an assigned issue is a wake reason | **Open.** [#6328](https://github.com/paperclipai/paperclip/pull/6328) ("keep blocked comment wakes from reviving execution") has been open since 2026-05-18 |
| "Disposition repair" re-wakes a waiting parent | `server/src/services/recovery/disposition-repair.ts` and the successful-run reconciler | Core | **Open, several reports:** [#17150](https://github.com/paperclipai/paperclip/issues/17150) (repeated runs "consume substantial model quota without advancing tasks"), [#15882](https://github.com/paperclipai/paperclip/issues/15882) (re-blocks deliberate `in_progress` waits), [#15776](https://github.com/paperclipai/paperclip/issues/15776), [#16816](https://github.com/paperclipai/paperclip/issues/16816) |
| `process` adapter passes no issue id; exit code is the only signal | `server/src/adapters/process/execute.ts` | Edge. On `master` the child still receives only `PAPERCLIP_AGENT_ID`, `PAPERCLIP_COMPANY_ID`, `PAPERCLIP_API_URL`, `PAPERCLIP_RUN_ID` and `PAPERCLIP_API_KEY`, while `claude_local` sets `PAPERCLIP_TASK_ID` | **Open since June:** issues [#7899](https://github.com/paperclipai/paperclip/issues/7899) and [#7975](https://github.com/paperclipai/paperclip/issues/7975); fixes [#9940](https://github.com/paperclipai/paperclip/pull/9940) (2026-07-21) and [#14555](https://github.com/paperclipai/paperclip/pull/14555) (2026-09-29) are unmerged |
| Unpriced-usage budget stop | `server/src/services/budgets.ts` (`unpricedUsageBlocks`; a new policy defaults to `"block"`) | Core | **Open:** issue [#19885](https://github.com/paperclipai/paperclip/issues/19885) describes exactly this for `process` and `http` runs; fix [#19895](https://github.com/paperclipai/paperclip/pull/19895) is unmerged |
| `claude_local` unsafe by default | `packages/adapters/claude-local/src/server/execute.ts`: `asBoolean(config.dangerouslySkipPermissions, true)` | Edge, and deliberate: the adapter docs give the default as `true`, set by merged PRs [#388](https://github.com/paperclipai/paperclip/pull/388) and [#2939](https://github.com/paperclipai/paperclip/pull/2939) | **Unchanged by intent** |

### Verdict: replace

- **Fork: no.** The two edge faults are an afternoon's patch. The five core faults are in the wake queue, recovery and budget code, which is the part upstream changes fastest. A fork would have to re-apply its patches across about a thousand upstream commits a week and forty or more migrations per release, or freeze and give up upstream's fixes. One person cannot hold that.
- **Keep as is: only until the M6 arrives.** The workarounds in the anti-patterns file hold today, but none of the seven faults is fixed in a stable release, two of them cost money when they trigger (re-runs on a comment, disposition-repair re-wakes), and the product's direction is coding-agent harnesses and chat connectors, not headless process jobs.
- **Replace: yes.** HeadQuarters uses Paperclip as a scheduler, a dependency wait, a parameter channel and a review screen. The first three are what a workflow engine provides directly. What is lost is the review screen and per-agent budgets; the map already routes review through pull requests on the website, and the budget rule is out of scope on the map.

## Recommendation

**Adopt Inngest self-hosted.** Reasons, against the ticket's list:

1. One binary and one SQLite file, no Docker, no database server. Memory is unpublished and must be measured.
2. Functions, triggers, retries and limits are TypeScript in the repo; server settings are flags, environment variables or a config file that can be committed without the keys.
3. Cron triggers with a time zone; four retries per step by default; `onFailure` and the `inngest/function.failed` event give one place to raise a failed run.
4. `step.sleepUntil` and `step.waitForEvent` hold a run without holding a concurrency slot.
5. Approval is `step.waitForEvent` with a timeout that returns `null`, so "nobody answered" is handled explicitly.
6. One shared concurrency key with `limit: 1` on every function that needs the large model serializes exactly those steps and nothing else.
7. The dashboard is in the binary.

**Fallback: DBOS Transact with Postgres.** Switch to it if the M6 trial shows that Inngest loses a waiting run on a hard kill, or silently skips a cron tick it was down for, and the fix (external Redis and Postgres) costs more than Postgres alone. DBOS documents both behaviours. The price is building the owner's read view on top of `DBOS.listWorkflows` or the `dbos workflow` commands.

Write each job as a plain exported function and keep the engine at the edge (one file of function definitions that call the jobs). That keeps the fallback cheap, and it matches the map's decision to keep Mastra behind one shared call. Whether to define workflows through `@mastra/inngest` or directly with the Inngest SDK is a small follow-on choice: the first keeps `createWorkflow` syntax but ties the engine to Mastra's release train.

### What would be rewritten

| File (under `prototype/`) | Change |
|---|---|
| `packages/paperclip-client/index.ts` | Removed. Issue lookup, `parseParams`, cost reporting and subtask calls have no counterpart; parameters arrive as typed event data |
| `runners/seo-geo/weekly.ts` | Rewritten as one workflow function: fan out stage 1, await it, decide stage 2, write the report, wait for the owner's approval event. The wake-by-wake state machine, `waitOn` and the `blocked` trick disappear. `weekly-report.ts` (`stage1`, `stage2`, `buildReport`, `renderReport`) stays; its wording that points the owner to Paperclip changes |
| `runners/seo-geo/run-geo.ts`, `keywords.ts`, `onpage.ts`, `search-console.ts`, `generate-queries.ts`; `runners/marketing/claims-review.ts`, `content-writer.ts`, `funnel.ts`, `onpage-fixes.ts`, `site-draft.ts`; `runners/mastra/run.ts` | Each drops its `paperclipEnabled()` / `findIssue()` / `reportCost()` calls and its `PAPERCLIP_RUN_ID` run id. Each also runs on import today (recorded in anti-patterns), so each needs an exported entry function, or the engine step must start it as a child process with flags |
| `packages/data-contracts/index.ts` | The `paperclip: { issue_id, run_id }` field of the run record becomes an engine run reference. This is a contract change and needs the owner's review |
| `tests/seo-geo-weekly.test.ts` | Rewritten for the new orchestration |
| `package.json`, `package-lock.json` | `paperclipai` removed; the engine SDK added |
| `ENGINEER.md`, `engineer.settings.json`, `docs/*.md` | The `claude_local` agent setup and the Paperclip instructions go; ADR 0001 stays as history |
| new | One file of engine function definitions, a committed launchd plist per process, and a setup script |
| `runners/mastra/workflow.ts` | Unchanged. The Mastra pipeline runs inside one engine step |

## Unverified

- **Memory of every engine except Restate.** No vendor publishes a resident-memory figure for Inngest, DBOS plus Postgres, Temporal or Mastra. Restate's figures are configured pool sizes, not measurements.
- **Inngest on a hard kill.** The snapshot interval of the in-memory queue and state store is not documented, nor is what a crash between snapshots loses.
- **Inngest and a missed cron tick.** The scheduled-functions page does not say what happens to a tick that fell while the server was down.
- **Inngest limits on self-hosted.** The maximum `waitForEvent` timeout and sleep length are referred to "current platform limits" without numbers; whether `scope: "account"` concurrency keys behave the same on a self-hosted server was not found. The `env` scope example was not shown in the page read.
- **`inngest start` maturity.** The CLI help labels it Beta; the self-hosting page says it is supported since 1.0. Both statements are on the same page.
- **Inngest licence detail.** The delayed Apache-2.0 terms in the licence file were not read in full.
- **`@mastra/inngest` against a self-hosted server.** Mastra's guide shows only the dev server and Inngest Cloud.
- **Mastra built-in engine.** How a run that was in `.sleep()` behaves after a restart, whether Studio lists past runs, and whether any concurrency control exists outside the pages read.
- **DBOS.** Step retry options, the plan terms of the hosted Conductor for a self-hosted app, and whether SQLite is supported anywhere (the configuration reference names Postgres only).
- **Temporal.** The exact pattern for a concurrency of one was not confirmed in a how-to page; only the worker option is documented in the API reference.
- **Paperclip.** Whether the 2026.1110.0 beta fixes the recovery-hold jam for `process` agents; the search for an upstream report of the silent approval was by keyword and may have missed one. Issue and pull-request counts are from the GitHub search API on the check date.
- **launchd.** No vendor page describes a launchd setup for Inngest, DBOS, Temporal or Restate; whether the Restate Homebrew formula defines a service was not checked.
