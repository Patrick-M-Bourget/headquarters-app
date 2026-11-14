# How the website can assign visitors and record outcomes

Research for issue #6 (map: #1). Researched 2026-11-14 against the cachedrop-website repo (read-only, at its `main` of that day) and the vendors' own documentation. Anything not confirmed in a primary source or not tried on a deployment is marked **unverified**. Nothing here was built or run.

## Answer in short

- **Recommended:** assign in the browser on the static page, keep the assignment in `sessionStorage` (the mechanism the site already uses for campaign tags), send the variant with the signup into the site's own database, and attribute purchases there by joining licenses to signups. Count exposures as page views.
- **Fallback:** Vercel Routing Middleware that sets a cookie and rewrites to a prebuilt static variant page. Use it only for tests the browser approach can't carry (whole-page variants, no tolerance for flicker, or an assignment that must survive across visits). It needs a cookie, which the site's decisions and privacy policy currently rule out.
- **The deciding fact:** Vercel Web Analytics is anonymous and forgets a visitor after 24 hours, and a purchase is confirmed by a Stripe webhook outside the browser, often days after the visit. So no analytics tool on the site can tie a purchase to a variant. Only the site's own database can, because signups and licenses share an email address.

## What the site is today

From the website repo (file paths are in that repo):

| Fact | Source |
| --- | --- |
| Astro with `output: 'static'`, no adapter, trailing-slash directory pages. Static output is a binding decision. | `astro.config.mjs`; `docs/DECISIONS.md` Decision 11 |
| Server code is plain Vercel functions in a root `api/` folder, routed by `vercel.json` rewrites. There is no middleware file. | `api/`, `vercel.json` |
| Analytics is Vercel Web Analytics, cookieless, with no consent banner. A `beforeSend` hook redacts download tokens and keeps only `utm_*` query parameters. | Decision 16; `src/layouts/Base.astro` |
| Campaign tags: an inline script keeps the first `utm_*` set seen in a tab in `sessionStorage`; the signup form sends it to `POST /api/signup`; five `utm_*` columns on the signup row keep the first values (first touch wins); an unsubscribe wipes them. | `src/layouts/Base.astro`, `src/components/SignupForm.astro`, `src/server/gate.ts`, the signup-UTM migration |
| The privacy policy tells visitors the campaign tags are held "for that tab only, never in a cookie", and that page visits are counted "without cookies". | `src/pages/[...lang]/privacy/index.astro` |
| `/buy` is a function that answers a 302 to a Stripe Payment Link chosen by language. It forwards no other query parameter. | Decision 41; `src/server/buy.ts` |
| A purchase is recorded by a Supabase Edge Function on Stripe's `checkout.session.completed` webhook. The license row keeps the session ID, email and language. It does not read `client_reference_id` or any campaign tag. | Decision 40; `supabase/functions/license/handlers.ts`, the licenses migration |
| Pages exist in English, French and (core pages) German, with a canonical and `hreflang` alternates built per page. | Decisions 5 and 57; `src/layouts/Base.astro` |
| The plan of record is Vercel Hobby. Whether the project has moved to Pro since is **unverified** (the Vercel account was not inspected). | Decisions 17 and 35 |
| No flag, experiment or variant mechanism exists. | search of `src/`, `api/`, `supabase/`, `package.json` |

Consequences that shape every option:

1. A static page cannot choose a variant on the server. The choice happens either in the browser, or in something that runs before the static file is served (middleware), or before the visitor arrives (two different links).
2. The site has promised no cookies. Any option that sets one needs a new website decision and a privacy-policy change, and reopens the no-banner position of Decision 16.
3. A new stored field about a person (a variant on the signup or license row) is a schema change and a privacy-policy line (Decision 19 lists what is collected).

## What Vercel offers (verified in its docs)

| Capability | Finding | Source |
| --- | --- | --- |
| Web Analytics custom events (`track()`) | **Pro and Enterprise only.** Pro allows 2 properties per event (8 with the Web Analytics Plus add-on, $10/month). Pro is billed $0.03 per 1,000 events; Hobby includes 50,000 events a month, a one-month reporting window, and no custom events. | [Custom events](https://vercel.com/docs/analytics/custom-events), [Pricing for Web Analytics](https://vercel.com/docs/analytics/limits-and-pricing) |
| Visitor identity in Web Analytics | Visitors are identified by "a hash created from the incoming request", and the session "is automatically discarded after 24 hours". Data points are anonymous. | [Privacy and Compliance](https://vercel.com/docs/analytics/privacy-policy) |
| Flag values on page views | Web Analytics reads flag values from the DOM (a `<script type="application/json" data-flag-values>` tag, which any framework or plain HTML can render) and annotates page views and client-side events with them. "Available in Beta on all plans." | [Integrate flags with Web Analytics](https://vercel.com/docs/flags/observability/web-analytics), [Flags Explorer reference](https://vercel.com/docs/flags/flags-explorer/reference) |
| Reading results by program | The Web Analytics API returns page views and events grouped by `flags/<name>` or `eventData/<property>`, with a Vercel access token. Aggregates are limited to the plan's reporting window. | [Query Web Analytics with the API](https://vercel.com/docs/analytics/web-analytics-api) |
| Flags SDK | "A framework-native library for Next.js and SvelteKit." No Astro support. | [Flags](https://vercel.com/docs/flags) |
| Vercel Flags (the provider) | Flags, splits and targeting in the dashboard and CLI. Outside Next.js and SvelteKit it is evaluated with `@vercel/flags-core` or OpenFeature, in server code. Hobby: 10,000 flag requests a month, 100 flags. Pro: $0.03 per 1,000 flag requests. | [Quickstart](https://vercel.com/docs/flags/vercel-flags/quickstart), [Limits and pricing](https://vercel.com/docs/flags/vercel-flags/limits-and-pricing) |
| Routing Middleware | Available on all plans. Runs before the cache, so it can vary statically generated pages; Vercel names "assigning visitors to an A/B test" as a use. Runs on every request unless a matcher narrows it. Billed as fluid compute (Hobby includes 1 million invocations and 4 hours of active CPU a month; Pro is on demand). | [Routing Middleware](https://vercel.com/docs/routing-middleware), [Fluid compute pricing](https://vercel.com/docs/functions/usage-and-pricing) |
| Routing Middleware with Astro | The `vercel.json` `proxy` property can't be used with Astro. A `middleware.ts` at the project root is the documented route; Astro's own `src/middleware.ts` is a different thing. | [Routing Middleware](https://vercel.com/docs/routing-middleware), [Astro on Vercel](https://vercel.com/docs/frameworks/frontend/astro) |
| Astro's own middleware on Vercel | Needs the `@astrojs/vercel` adapter, and "static assets and prerendered pages are served from Vercel's filesystem and do not invoke your middleware". So it cannot vary this site's pages. | [Astro Vercel adapter](https://docs.astro.build/en/guides/integrations-guide/vercel/) |

## What Stripe offers (verified in its docs)

A Payment Link URL accepts `client_reference_id` (letters, digits, dashes, underscores, up to 200 characters; invalid values are dropped silently). It is attached to the Checkout Session and "sent in the `checkout.session.completed` webhook". The link also accepts the five `utm_*` parameters, but those only come back on the post-payment redirect URL, not in the webhook. Source: [Track a payment link](https://docs.stripe.com/payment-links/url-parameters).

## What Google says about tests and search (verified)

Source: [Minimize A/B testing impact in Google Search](https://developers.google.com/search/docs/crawling-indexing/website-testing).

- Varying content on one URL with JavaScript is an accepted way to test.
- Googlebot generally doesn't keep cookies, so it sees what a visitor without cookies sees.
- Variant pages on their own URLs carry `rel="canonical"` to the original (preferred over `noindex`); test redirects are 302, never 301.
- Showing Googlebot something different from visitors is cloaking.
- Run a test only as long as needed and remove it promptly.

For this site that means: a variant on its own URL must keep the original's canonical, stay out of the sitemap, and stay out of every `hreflang` set, or the three-language alternates break. A variant on the same URL changes none of that.

## Options

### 1. Browser assignment on the static page, outcomes in the site's own database (recommended)

- **Assign:** a small inline script in the page head picks a variant at random on first view and sets an attribute on `<html>`. Both variants are in the static HTML; CSS shows one. Running in the head before first paint avoids a visible swap.
- **Keep:** `sessionStorage`, beside the existing campaign tags. The assignment holds across pages in the tab. It does not hold across visits or devices; a returning visitor is drawn again. `localStorage` would hold across visits on one device, at the price of persistent storage on the device and a different privacy statement.
- **Record signups:** the signup form already posts a tag object read from `sessionStorage`. Add the experiment name and variant to that request and a column on the signup row.
- **Record purchases:** join licenses to signups by email in the database. This works whenever the buyer signed up first, including purchases made days later from the app. For buyers who never signed up, `/buy` forwards the variant as the Payment Link's `client_reference_id` and the license function stores it.
- **Record exposures:** page views per variant. Either a `data-flag-values` tag written by the same script, so Web Analytics splits page views by variant (all plans), or a small counting endpoint in the site's own database.
- **Needs added to the site:** the inline script and per-test markup; one field on `POST /api/signup`; a column on signups (and on licenses for the direct-purchase path); a forwarded parameter in `/buy`; a privacy-policy line; a website Decision.
- **Cost and plan:** none. Works on Hobby. No new dependency, provider or function invocation per page view.
- **Constraints:** stays static (Decision 11) and cookieless (Decision 16). Same URL, so canonical, `hreflang` and sitemap are untouched. It still stores a value in the browser, as the campaign tags do, and it stores a new field with a person's signup.
- **Limits:** only suits changes that both variants can carry in one HTML page (headline, call to action, section order, form placement). The hidden variant's text is in the HTML that crawlers read. Assignment is per tab, so a visitor who returns may see the other variant; the signup records the variant on screen when the form was sent.
- **Unverified:** that Web Analytics picks up a `data-flag-values` tag inserted by script before it sends the page view on this static site. If it doesn't, exposures come from the counting endpoint.

### 2. Routing Middleware with a cookie, rewriting to prebuilt static variants (fallback)

- **Assign and keep:** a root `middleware.ts`, matched only to the pages under test, reads a cookie or draws a variant, sets the cookie, and rewrites the request to a prebuilt static variant page. No flicker, and the assignment survives across visits on the device.
- **Record:** as in option 1 (the variant reaches the signup form through the page itself, exposures through a static `data-flag-values` tag in each variant page).
- **Needs added:** `middleware.ts` and the `@vercel/functions` package (a new dependency); a variant page per language under test, each with the original's canonical, excluded from the sitemap and `hreflang`; a cookie.
- **Cost and plan:** all plans. Every matched page request becomes a function invocation, counted against Hobby's monthly allowance or billed on Pro.
- **Constraints:** a cookie contradicts Decision 16's cookieless, no-banner position and the privacy policy's wording, so it needs a new website Decision and a policy change before any test. Googlebot gets a fresh draw on each request.
- **Unverified:** that a root `middleware.ts` runs in front of this project's static Astro output with no adapter. Vercel's docs describe it; it was not tried.

### 3. Split at the link, recorded through the existing campaign tags

- **Assign:** outside the site. Two ads or two email links point at two URLs, or at one URL with different `utm_content`.
- **Keep and record signups:** already built. The tags ride `sessionStorage` to the signup row.
- **Needs added:** nothing for a copy test in the ad itself; a second static page for a landing-page test (with the canonical and `hreflang` care above). Purchases by join, as in option 1.
- **Cost and plan:** none.
- **Limits:** covers only visitors who arrive through a tagged link, so it can't test organic traffic. The split is whatever the ad platform delivers, not a controlled random one. First touch wins, so a person who signed up before keeps their old tags.

### 4. Vercel Web Analytics custom events for signups and purchases

- **Needs:** Vercel Pro. `track('signup', { experiment, variant })` from the form.
- **Limits:** counts are anonymous and can't be joined to a person, a license or a later purchase. The purchase is confirmed in a Supabase function on Stripe's webhook, not in the browser and not on Vercel; whether `@vercel/analytics/server` can send from outside a Vercel deployment is **unverified**. Decision 16 already keeps download counts out of analytics and in the site's own table; outcomes per variant fit the same rule.
- **Verdict:** at most a second view of signups, never the record of purchases.

### 5. Vercel Flags or the Flags SDK

- The Flags SDK doesn't support Astro. Vercel Flags can be evaluated with `@vercel/flags-core`, but only in server code, which on this site means inside the middleware of option 2. It would add a dashboard for the split and a metered flag request per evaluation, on top of option 2's cookie and invocations.
- **Verdict:** nothing here that option 2 lacks, except changing the split without a deploy. In HeadQuarters a test starts and stops by a pull request the owner merges, so that is not needed.

### 6. Global Config (formerly Edge Config) for the split

- A key-value store middleware can read, to turn a test on or off without a deploy. Same verdict as option 5. Pricing was not checked (**unverified**).

### 7. A third-party experiment tool (PostHog, GrowthBook, Statsig and similar)

- Each brings its own assignment, storage and statistics. Each adds a provider that receives visitor data, so the privacy policy and the impact assessment change (Decisions 19 and 20), and most keep an identifier in a cookie or `localStorage`. None can see the Stripe webhook without the same database work as option 1. Current pricing and storage behaviour were not checked (**unverified**).

## Recommendation

**Option 1.** It is the only option that fits the site's static, cookieless decisions as they stand, costs nothing on any plan, adds no provider, and puts signups and purchases per variant in the one place where both can be tied to a variant. It reuses a pattern the site already has in production for campaign tags.

**Fallback: option 2**, for a test option 1 can't carry. It should be chosen knowingly, because it needs the cookie decision reversed first.

Option 3 is available today with no change, for tests on paid or emailed traffic only.

## What this means for the map

- **Outcomes live in the website's database, not in an analytics product.** HeadQuarters reads results from there (a read path into Supabase), plus page views per variant from the Web Analytics API or a counter. Each is a credential on the M6.
- **A test is a pull request.** Variant markup, the experiment's name, and its removal are code changes the coding agent proposes and the owner merges. No dashboard is involved.
- **The website needs its own decision first**, in its own repo: the stored variant field, the privacy-policy line, and the `/api/signup` and `/buy` changes. HeadQuarters can't run a test before that lands.
- **Low traffic is the binding limit**, not tooling. Per-tab assignment and email-joined purchases add noise; the experiment loop rules (traffic needed before a test may run) should assume purchases per variant are sparse and that signups are the practical primary outcome.

## Unverified, and open questions for the owner

- Whether the Vercel project is still on Hobby. On Hobby, Web Analytics keeps one month of data and has no custom events.
- Whether Web Analytics annotates page views from a script-inserted `data-flag-values` tag on a static page, and whether a root `middleware.ts` works with this project's static Astro build. Both need a preview deployment to confirm.
- Legal position, not legal advice. France's CNIL lists A/B testing among the purposes that can be exempt from consent for audience-measurement trackers, on conditions that include not cross-checking the data with other processing such as customer files ([CNIL, sheet 16](https://www.cnil.fr/en/sheet-ndeg16-use-analytics-your-websites-and-applications)). Storing the variant with a signup is such a cross-check, so that exemption may not cover option 1 as described. The site's `/de/` pages bring German rules into play as well. Whether `sessionStorage` is treated like a cookie under EU rules was not confirmed in a primary source here. The site already takes this position for campaign tags; the owner decides whether an experiment field follows it.
- Third-party tool pricing, Global Config pricing, the current Pro plan price, and Vercel's wording on commercial use of Hobby (the site's Decision 17 states Hobby is non-commercial; Vercel's page was not confirmed).
