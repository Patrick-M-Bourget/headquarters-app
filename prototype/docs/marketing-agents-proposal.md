# Proposal: CacheDrop marketing and funnel agents (DRAFT, needs owner decisions)

Owner request (2026-11-09, late): build a full suite of marketing and funnel optimization agents ("SEO content creator", etc.) for cachedrop.io **before** testing scheduling (step 6).

Status: nothing is built. Creating agents with write access, data access and spend is an architecture decision (L3) plus data access (L2). The questions at the bottom need answers first.

## What the agents work from

The trackers built so far already produce the inputs:

- **GEO (en-US, fr-FR):** CacheDrop is named in 0/50 answers in both locales. Engines pick AppCleaner, CleanMyMac, Pearcleaner, DaisyDisk and OnyX, and cite Reddit, Macworld, mac4ever, 01net, etc.
- **On-page (en):** 8/8 pages only partly answer their question near the top; meta descriptions too long on 6; pricing page thin.
- **Keywords:** cachedrop.io ranks for 0/48 (en) and 0/41 (fr). Reddit is in nearly every SERP (47/48 en, 40/41 fr), YouTube in most.
- **Site facts** (cachedrop-website): Vercel Web Analytics (cookieless), UTM capture on signup (#93), email-gated download, Stripe checkout, Resend for license and download emails, EN+FR shipped together (Decision 34), claims follow the shipped build (Decision 48).

## Proposed roster

Every agent drafts only. Nothing is published, sent or posted without your approval in Paperclip. After approval, Claude files the ticket on cachedrop-website (the step 6 flow), and the website's own rules and reviews apply.

| # | Agent | Does | Built as (ADR 0001) | Wave |
|---|---|---|---|---|
| 1 | **Claims & brand reviewer** | Gate on every draft: features must be shipped (update feed), pricing rules ($29.99 regular, $19.99 "limited time", never "launch"), no competitor names outside the compare page, "uninstalling is never called free", French glossary. Blocks or annotates. | Mastra pipeline + code checks; eval with planted violations ≥ 90% | 1 |
| 2 | **SEO content creator** | Briefs and full drafts, EN + native FR, for gaps the trackers find: questions where competitors win, keywords with no matching page, "no" on-page verdicts. Each draft names the query IDs it targets, so the next tracker run measures it. | Claude Code agent (open-ended writing), locked to its workspace | 1 |
| 3 | **On-page optimizer** | Turns on-page findings into exact fixes: titles, meta descriptions, FAQ/JSON-LD, answer-first openings, hreflang. | Mastra pipeline (mechanical) | 1 |
| 4 | **Funnel analyst** | Weekly: visits → signups (by language, filling choice, UTM) → downloads → purchases. Finds the biggest drop-off and proposes one experiment. Aggregate numbers only, no personal data. | Pipeline + Sonnet summary | 1 (needs data access) |
| 5 | **Citation / GEO strategist** | From cited URLs: which articles and threads AI engines rely on, which listicles to pitch, what llms.txt and the compare page should say. Pitch drafts only, never sends. | Claude Code agent | 2 |
| 6 | **Conversion copywriter** | Landing-page and form variants plus experiment specs from #4's findings, within the design rules (no major UI changes; Claude is head of design). | Claude Code agent | 2 |
| 7 | **Lifecycle email writer** | Drafts for onboarding, trial nearing 2 GB, trial end, and license follow-up. Sending stays in the website code; consent rules unchanged (Decision 3). | Mastra pipeline | 2 |
| 8 | **Community (Reddit) drafter** | Finds relevant threads and drafts disclosed replies; you post by hand. Risky: self-promotion rules and reputation. | Claude Code agent | defer |
| 9 | **Paid ads (Meta) brief writer** | Ad copy and creative briefs with UTM hygiene. The first campaign is blocked by #59. | Mastra pipeline | defer |

Each agent gets the same treatment as the trackers: a contract in `packages/data-contracts`, tests, an eval gate before its output counts, cost reported to Paperclip, and a probation check recorded.

## Cost estimate (I'm not sure; to be measured)

- Build and evals for wave 1: about $5–10 of API credits.
- Running it: a content draft with Sonnet costs about $0.10–0.30; the reviewer, optimizer and analyst cost cents per week.
- Spent so far: about $8 of the $100 hard limit (about $0.95 this session: fr-FR GEO $0.88, generator $0.003, test calls $0.04).

## Owner decisions needed

1. **Roster:** start with wave 1 (#1–4)? Add or drop any agents?
2. **How far agents go:** draft → your approval in Paperclip → Claude files a cachedrop-website ticket (recommended). Or should an agent open PRs on cachedrop-website directly? That means a write-scoped agent on a public repo: L3.
3. **Funnel data access (#4):** read-only access to Vercel Web Analytics, the signups/downloads table, and Stripe (restricted read key). You create the keys; L3 security. Aggregates only, and nothing personal leaves the machine. Or start with a CSV export you drop in by hand.
4. **Budget:** does the suite count against the $100 prototype limit, or does it get its own?
5. **5b order:** fr-FR GEO + keywords are done and the French judge passed. Remaining: fr-FR on-page (step 4), then de-DE/es-ES/pt-BR/ja-JP. Recommended: finish fr-FR on-page, build wave 1, then the other four locales; content agents only need EN + FR.
