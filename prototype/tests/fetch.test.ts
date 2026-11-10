import { test } from "node:test";
import assert from "node:assert/strict";
import { evidenceOnPage, candidatePages } from "../runners/mastra/fetch.ts";

const page = "DaisyDisk license is a one-time purchase, and not a subscription! Buy $9.99. It’s “simple” to use.";

test("evidence must appear on the page (modulo case, whitespace, curly quotes)", () => {
  assert.ok(evidenceOnPage("one-time purchase, and not a subscription", page));
  assert.ok(evidenceOnPage("BUY   $9.99", page));
  assert.ok(evidenceOnPage(`It's "simple"`, page));
  assert.ok(!evidenceOnPage("Buy $19.99", page));
  assert.ok(!evidenceOnPage("a subscription for $9.99/year", page));
  assert.ok(!evidenceOnPage("$9", page), "too short to count as evidence");
});

test("ellipsis-joined quotes need every part on the page", () => {
  assert.ok(evidenceOnPage("DaisyDisk license ... not a subscription", page));
  assert.ok(!evidenceOnPage("DaisyDisk license ... monthly plan", page));
});

test("candidate pages prefer pricing, skip downloads and duplicates", () => {
  const home: any = { url: "https://x.com/", links: [
    "https://x.com/download/App.zip", "https://x.com/features", "https://x.com/pricing", "https://x.com/pricing/", "https://x.com/blog", "https://x.com/support/faq",
  ] };
  assert.deepEqual(candidatePages(home), ["https://x.com/pricing", "https://x.com/features", "https://x.com/support/faq"]);
});
