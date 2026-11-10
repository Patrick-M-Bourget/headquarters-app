import { test } from "node:test";
import assert from "node:assert/strict";
import { brandFor, cleanUrl, diffRuns, keywordsFrom, parseSerp, summarize } from "../runners/seo-geo/keyword-checks.ts";

const q = (id: string, keywords: string[]) => ({ id, text: `question number ${id} about mac cleaning`, audience: "general", intent: "recommendation", keywords });

test("keywords are unique case-insensitively and remember every source query", () => {
  const set: any = { queries: [q("q01", ["Mac cleaner", "no subscription"]), q("q02", ["mac  cleaner"]), q("q03", ["uninstall vst mac"])] };
  assert.deepEqual(keywordsFrom(set), [
    { keyword: "mac cleaner", query_ids: ["q01", "q02"] },
    { keyword: "no subscription", query_ids: ["q01"] },
    { keyword: "uninstall vst mac", query_ids: ["q03"] },
  ]);
});

test("tracking params and fragments are stripped; real params kept", () => {
  assert.equal(cleanUrl("https://www.widebluesound.com/audio-plugin-uninstaller/?srsltid=AYC&utm_source=x#top"), "https://www.widebluesound.com/audio-plugin-uninstaller/");
  assert.equal(cleanUrl("https://www.kvraudio.com/forum/viewtopic.php?t=617193"), "https://www.kvraudio.com/forum/viewtopic.php?t=617193");
});

test("brands match their own sites only", () => {
  assert.equal(brandFor("https://cachedrop.io/uninstall-audio-plugins-mac/"), "cachedrop");
  assert.equal(brandFor("https://www.cleanmymac.com/blog/x"), "cleanmymac");
  assert.equal(brandFor("https://macpaw.com/cleanmymac"), "cleanmymac");
  assert.equal(brandFor("https://github.com/alienator88/Pearcleaner"), "pearcleaner");
  assert.equal(brandFor("https://github.com/someone/else"), null, "path-scoped domains need the path");
  assert.equal(brandFor("https://www.reddit.com/r/mac/"), null);
  assert.equal(brandFor("https://notcachedrop.io/"), null, "suffix must be a real subdomain");
});

const serp = {
  organic: [
    { position: 1, link: "https://www.reddit.com/r/ableton/x", title: "Reddit thread" },
    { position: 2, link: "https://cachedrop.io/uninstall-audio-plugins-mac/?srsltid=abc", title: "CacheDrop guide" },
    { position: 3, link: "https://www.widebluesound.com/audio-plugin-uninstaller/", title: "APU" },
    { position: 4, link: "https://cachedrop.io/", title: "CacheDrop home" },
  ],
  relatedSearches: [{ query: "remove plugins mac ableton" }],
};
const kw = { keyword: "uninstall vst mac", query_ids: ["q02"] };

test("parseSerp: best own position, brands, clean URLs, related searches", () => {
  const r = parseSerp(serp, kw, "us", "en", "2026-11-09T00:00:00Z");
  assert.equal(r.own_position, 2);
  assert.equal(r.results[1].url, "https://cachedrop.io/uninstall-audio-plugins-mac/");
  assert.deepEqual(r.results.map(x => x.brand), [null, "cachedrop", "audio-plugin-uninstaller", "cachedrop"]);
  assert.deepEqual(r.related_searches, ["remove plugins mac ableton"]);
  assert.equal(parseSerp({ organic: [] }, kw, "us", "en").own_position, null);
});

test("summary counts each domain once per keyword; diff reports own moves and brand entries/exits", () => {
  const a = parseSerp(serp, kw, "us", "en", "2026-11-09T00:00:00Z");
  const b = parseSerp({ organic: [serp.organic[0], { link: "https://www.cleanmymac.com/x", title: "CMM" }, serp.organic[3]] }, kw, "us", "en", "2026-11-16T00:00:00Z");
  const s = summarize([a]);
  assert.equal(s.own.ranked, 1);
  assert.equal(s.own.top3, 1);
  assert.equal(s.domains_in_top10["cachedrop.io"], 1, "two cachedrop rows on one keyword count once");
  assert.deepEqual(s.brands_in_top10, { cachedrop: 1, "audio-plugin-uninstaller": 1 });
  assert.deepEqual(diffRuns([a], [b]).map(d => d.change), ["cachedrop.io 2 → 3", "cleanmymac entered the top 10", "audio-plugin-uninstaller left the top 10"]);
});
