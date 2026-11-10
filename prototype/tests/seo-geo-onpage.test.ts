import { test } from "node:test";
import assert from "node:assert/strict";
import { findGaps, opening, pageChecks, robotsAllows, robotsReport } from "../runners/seo-geo/onpage-checks.ts";

const html = `<!doctype html><html><head>
<title>Uninstall audio plug-ins on Mac | CacheDrop</title>
<meta name="description" content="Remove VST, AU and AAX plug-ins and their leftovers.">
<link rel="canonical" href="/uninstall-audio-plugins-mac/">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Article","author":{"@type":"Organization"}},{"@type":["HowTo","Thing"]}]}</script>
<script type="application/ld+json">{ broken</script>
</head><body><h1>Uninstall audio plug-ins</h1>
<a href="/">Home</a><a href="/pricing/">Pricing</a><a href="/pricing">Pricing again</a><a href="https://www.cachedrop.io/">Home www</a>
<a href="https://example.com/">Elsewhere</a><a href="#top">Self</a><a href="/uninstall-audio-plugins-mac/">Self</a>
</body></html>`;
const url = "https://cachedrop.io/uninstall-audio-plugins-mac/";

test("page checks read title, meta, H1, canonical, JSON-LD types and internal links", () => {
  const c = pageChecks(html, url, "one two  three");
  assert.equal(c.title, "Uninstall audio plug-ins on Mac | CacheDrop");
  assert.equal(c.meta_description, "Remove VST, AU and AAX plug-ins and their leftovers.");
  assert.deepEqual(c.h1, ["Uninstall audio plug-ins"]);
  assert.equal(c.canonical, url);
  assert.equal(c.canonical_is_self, true);
  assert.deepEqual(c.json_ld_types, ["(invalid JSON-LD)", "Article", "HowTo", "Organization", "Thing"]);
  assert.equal(c.internal_links, 2, "home and pricing, deduped; self links and other sites excluded");
  assert.equal(c.word_count, 3);
});

test("opening takes the first n words", () => {
  assert.equal(opening("a  b\nc d", 3), "a b c");
});

test("robots.txt: specific group wins, longest rule wins, Allow wins ties", () => {
  const r = "User-agent: *\nDisallow: /\n\nUser-agent: GPTBot\nUser-agent: ClaudeBot\nAllow: /\n";
  assert.equal(robotsAllows(r, "GPTBot"), true);
  assert.equal(robotsAllows(r, "claudebot"), true, "agent match is case-insensitive");
  assert.equal(robotsAllows(r, "PerplexityBot"), false, "falls back to *");
  assert.equal(robotsAllows("User-agent: *\nDisallow:\n", "GPTBot"), true, "empty Disallow allows all");
  assert.equal(robotsAllows("User-agent: GPTBot\nDisallow: /\nAllow: /blog\n", "GPTBot", "/blog/x"), true);
  assert.equal(robotsAllows("User-agent: GPTBot\nDisallow: /\nAllow: /blog\n", "GPTBot", "/"), false);
  assert.equal(robotsAllows("# nothing\n", "GPTBot"), true);
  assert.deepEqual(robotsReport(null), { GPTBot: true, ClaudeBot: true, PerplexityBot: true, "Google-Extended": true }, "no robots.txt = allowed");
});

const audit = (u: string, checks: any, answer: any = null) => ({ url: u, query_id: "q06", query_text: "how do I remove old audio plug-ins from my mac", audited_at: "2026-11-09T00:00:00Z", http_status: 200, error: null, checks, answer });
const good = { title: "Short title", meta_description: "Fine.", h1: ["H"], canonical: url, canonical_is_self: true, json_ld_types: ["Article"], internal_links: 5, word_count: 900 };

test("gaps: own-page problems and differences from competitors", () => {
  const own = audit(url, { ...good, title: "x".repeat(70), meta_description: null, h1: [], word_count: 300 }, { verdict: "partial", quote: "q", model: "m" });
  const comps = [
    audit("https://www.a.com/p", { ...good, json_ld_types: ["FAQPage", "HowTo", "WebPage"], word_count: 1200 }, { verdict: "yes", quote: "q", model: "m" }),
    audit("https://b.com/p", { ...good, json_ld_types: ["FAQPage", "WebPage"], word_count: 800 }, { verdict: "no", quote: null, model: "m" }),
    { ...audit("https://c.com/p", null), http_status: 403, error: "HTTP 403" },
  ];
  const g = findGaps(own as any, comps as any);
  assert.ok(g.some(x => x.startsWith("title is 70 chars")));
  assert.ok(g.includes("no meta description"));
  assert.ok(g.includes("0 H1 elements (expected 1)"));
  assert.ok(g.includes("JSON-LD types used by 2+ competitors but not here: FAQPage"), "HowTo is on only one competitor; WebPage is boilerplate");
  assert.ok(g.includes("300 words vs competitor median 800"), "failed competitor is ignored");
  assert.ok(g.some(x => x.includes("(partial); these do: a.com")));
  assert.deepEqual(findGaps(audit(url, good, { verdict: "yes", quote: "q", model: "m" }) as any, []), []);
});

test("mainText drops site chrome and prefers the main element", async () => {
  const { mainText } = await import("../runners/seo-geo/onpage-checks.ts");
  const body = Array.from({ length: 120 }, (_, i) => `w${i}`).join(" ");
  const page = `<html><body><header>Logo Menu</header><nav>Home Pricing</nav><script>gtm()</script>
<div>Promo banner</div><main><h1>Title</h1><p>${body}</p></main><footer>Copyright</footer></body></html>`;
  const t = mainText(page);
  assert.ok(t.startsWith("Title w0 w1"));
  assert.ok(!/Logo|Home Pricing|gtm|Promo|Copyright/.test(t));
  assert.equal(mainText(`<html><body><nav>Menu</nav><main>short</main><p>Body text</p></body></html>`), "short Body text", "a near-empty main falls back to the body");
});
