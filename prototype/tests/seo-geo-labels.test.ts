import { test } from "node:test";
import assert from "node:assert/strict";
import { detectBrands, sentenceAround } from "../runners/seo-geo/labels.ts";

test("brands are detected in order of first mention, with own-site citation", () => {
  const a = "For plug-ins, try CacheDrop. CleanMyMac also works, and AppCleaner is free.";
  const d = detectBrands(a, ["https://cachedrop.io/uninstall-audio-plugins-mac/"]);
  assert.deepEqual(d.map(x => [x.brand, x.position]), [["cachedrop", 1], ["cleanmymac", 2], ["appcleaner", 3]]);
  assert.equal(d[0].cited_own_site, true);
  assert.equal(d[1].cited_own_site, false);
});

test("name variants and false friends", () => {
  assert.deepEqual(detectBrands("Clean My Mac X and Cache Drop", []).map(x => x.brand), ["cleanmymac", "cachedrop"]);
  assert.deepEqual(detectBrands("Nektony's App Cleaner & Uninstaller removes leftovers", []).map(x => x.brand), ["app-cleaner-uninstaller"]);
  assert.deepEqual(detectBrands("a mole in your garden", []), [], "mole only counts near software words");
  assert.deepEqual(detectBrands("Mole is a free CLI cleaner for Mac", []).map(x => x.brand), ["mole"]);
});

test("sentenceAround returns the sentence containing the mention", () => {
  assert.equal(sentenceAround("Intro text. Try CacheDrop for plug-ins. Done.", /cachedrop/i), "Try CacheDrop for plug-ins.");
});

test("stripMd lets plain quotes match markdown answers", async () => {
  const { stripMd } = await import("../runners/seo-geo/labels.ts");
  const { evidenceOnPage } = await import("../runners/mastra/fetch.ts");
  const answer = "A free combo works best: **OnyX** for maintenance and `npx npkill` for node_modules.\n**Alternative: npkill**";
  assert.ok(!evidenceOnPage("OnyX for maintenance", answer));
  assert.ok(evidenceOnPage(stripMd("OnyX for maintenance"), stripMd(answer)));
  assert.ok(evidenceOnPage(stripMd("Alternative: npkill"), stripMd(answer)));
});

test("product ids work in every script (ja-JP) and fold accents", async () => {
  const { productId } = await import("../runners/seo-geo/labels.ts");
  assert.equal(productId("Mac Cleaner by Foo Inc"), "mac-cleaner");
  assert.equal(productId("Désinstalleur Pro"), "desinstalleur-pro");
  assert.equal(productId("キャッシュクリーナー"), "キャッシュクリーナー");
  assert.equal(productId("ＭａｃＣｌｅａｎｅｒ　プロ"), "maccleaner-プロ");
});
