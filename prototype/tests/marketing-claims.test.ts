import { test } from "node:test";
import assert from "node:assert/strict";
import { ClaimsReview, Draft, verdictFor } from "../packages/data-contracts/marketing.ts";
import { codeChecks, headlines } from "../runners/marketing/claims-rules.ts";
import { formatReview, loadFacts } from "../runners/marketing/claims-review.ts";

const facts = loadFacts();
const N = " ";
const d = (text: string, extra: Partial<Draft> = {}): Draft => Draft.parse({ id: "t", locale: "en-US", page_kind: "guide", target_url: null, query_ids: [], text, ...extra });
const rules = (text: string, extra: Partial<Draft> = {}) => codeChecks(d(text, extra), facts).map(f => f.rule);

const CLEAN_EN = `# Get your Mac's space back.
See what's filling your Mac, clean it up safely, and remove apps and plug-ins completely.
[Download for Mac](button) [Buy · $29.99 once](button)
Try it before you buy · No card needed · macOS 14 or later
## Pay once. Use it on 3 Macs.
$29.99 once, now $19.99 for a limited time. Use it on up to 3 Macs. 30-day refunds, no questions asked.
Scanning is always free, and you can clean up to 2 GB before you buy.
Free up 20 GB of Xcode DerivedData with \`rm -rf ~/Library/Developer/Xcode/DerivedData\`! Caches that tools rebuild are deleted; your files go to the Trash.`.replace("`! Caches", "`. Caches");

const CLEAN_FR = `# Récupérez l’espace de votre Mac.
Voyez ce qui remplit votre Mac et faites le ménage en toute sécurité.
[Télécharger pour Mac](button)
## Payez une seule fois. Utilisez-le sur 3${N}Mac.
29,99${N}$ une seule fois, maintenant 19,99${N}$ pour un temps limité. Jusqu’à 3 Mac. Remboursement sous 30${N}jours.
Vider le cache de média Adobe libère souvent 50${N}Go et plus${N}: vos fichiers vont à la Corbeille.`;

test("clean copy passes the code checks in both languages", () => {
  assert.deepEqual(rules(CLEAN_EN), []);
  assert.deepEqual(rules(CLEAN_FR, { locale: "fr-FR" }), []);
});

test("pricing rules (Decision 47)", () => {
  assert.ok(rules("Get CacheDrop at the launch price of $19.99, normally $29.99, for a limited time.").includes("launch_wording"));
  assert.ok(rules("Prix de lancement : 19,99 $ au lieu de 29,99 $ pour un temps limité.", { locale: "fr-FR" }).includes("launch_wording"));
  assert.ok(rules("CacheDrop is $19.99 for a limited time.").includes("offer_without_regular"));
  assert.ok(rules("Was $29.99, now $19.99.").includes("offer_not_limited"));
  assert.ok(rules("A CacheDrop license is $24.99 once.").includes("wrong_price"));
  assert.ok(!rules("CleanMyMac is $39.95 every year.", { page_kind: "compare" }).includes("wrong_price"), "competitor prices are not ours");
});

test("free: never for uninstalling, never in a headline or button (Decisions 48, 51)", () => {
  assert.ok(rules("Uninstalling plug-ins is free with CacheDrop.").includes("free_uninstall"));
  assert.ok(!rules("Cleanup and uninstalls are free until they have freed 2 GB.").includes("free_uninstall"));
  assert.ok(rules("# The free Mac cleaner").includes("free_in_headline"));
  assert.ok(rules("[Download Free](button)").includes("free_in_headline"));
  assert.ok(!rules("# Free up space on your Mac").includes("free_in_headline"), "\"free up\" is a verb");
  assert.ok(rules("La désinstallation est gratuite.", { locale: "fr-FR" }).includes("free_uninstall"));
});

test("banned words and competitors (Decisions 48, 51, 54)", () => {
  assert.ok(rules("Clear out the junk.").includes("banned_word"));
  assert.ok(rules("Find unused plug-ins fast.").includes("banned_word"));
  assert.ok(rules("Supprimez les fichiers inutiles.", { locale: "fr-FR" }).includes("banned_word"));
  assert.ok(rules("Unlike CleanMyMac, you pay once.").includes("competitor_named"));
  assert.ok(!rules("Unlike CleanMyMac, you pay once.", { page_kind: "compare" }).includes("competitor_named"));
  assert.ok(rules("MacKeeper is bloat.", { page_kind: "compare" }).includes("bloat_with_competitor"));
  assert.ok(!rules("Manage sounds in Native Access or Waves Central.").includes("competitor_named"), "vendors' own managers are allowed");
});

test("fact sheet, proof, Trash, puns (Decisions 23, 51)", () => {
  assert.ok(rules("Use it on up to 5 Macs.").includes("fact_sheet"));
  assert.ok(rules("14-day refunds.").includes("fact_sheet"));
  assert.ok(rules("Runs on macOS 13 Ventura or later.").includes("fact_sheet"));
  assert.ok(rules("Lifetime updates included.").includes("fact_sheet"));
  assert.ok(rules("Trusted by 10,000 producers.").includes("invented_proof"));
  assert.ok(rules("Rated 4.9 stars.").includes("invented_proof"));
  assert.ok(rules("Everything you clean goes to the Trash.").includes("trash_claim"));
  assert.ok(rules("Drop the weight from your Mac.").includes("drop_pun"));
});

test("French conventions: vous, units, typography; Quebec terms are notes on fr-FR", () => {
  const fr = (t: string) => codeChecks(d(t, { locale: "fr-FR" }), facts);
  assert.ok(fr("Nettoie ton Mac en une analyse.").some(f => f.rule === "fr_tutoiement"));
  const u = fr("Libérez 20 GB.").find(f => f.rule === "fr_units")!;
  assert.equal(u.fix, `20${N}Go`);
  assert.equal(fr("Attention: vos fichiers.").find(f => f.rule === "fr_typography")!.fix, `n${N}:`);
  assert.ok(fr("Il n'y a rien à faire.").some(f => f.rule === "fr_typography"));
  const q = fr("Entrez votre courriel.").find(f => f.rule === "fr_regional")!;
  assert.equal(q.severity, "note");
  assert.ok(!fr("Ouvrez https://cachedrop.io/fr/ maintenant.").some(f => f.rule === "fr_typography"), "URLs are not colons in prose");
});

test("commands and code are not copy; exclamation marks get a fix", () => {
  assert.deepEqual(rules("Run `brew cleanup` to free space."), []);
  const e = codeChecks(d("Your Mac is clean!"), facts).find(f => f.rule === "exclamation")!;
  assert.equal(e.severity, "fix"); assert.equal(e.fix, "Your Mac is clean.");
  assert.deepEqual(headlines("# A\n[B](button) [C](/download/) [D](https://x.com)"), ["A", "B", "C"]);
});

test("review verdict follows findings; formatter lists blocks first", () => {
  const block = { rule: "junk", severity: "block", source: "code", quote: "junk", message: "m", fix: null };
  const note = { ...block, rule: "fr_regional", severity: "note" };
  assert.equal(verdictFor([]), "pass");
  const r = ClaimsReview.parse({ draft_id: "x", reviewed_at: "2026-11-10T00:00:00Z", verdict: "block", findings: [note, { ...block, rule: "banned_word" }], model: null, facts_version: facts.as_of, cost_usd: 0 });
  assert.ok(!ClaimsReview.safeParse({ ...r, verdict: "pass" }).success);
  assert.match(formatReview(r).split("\n")[1], /\[block\]/);
});

test("exact fixes apply in code and leave nothing for the code checks", async () => {
  const { applyFixes } = await import("../runners/marketing/claims-rules.ts");
  const draft = d("Attention: libérez 20 GB maintenant!", { locale: "fr-FR" });
  const { text, applied } = applyFixes(draft.text, codeChecks(draft, facts));
  assert.ok(applied >= 2);
  assert.deepEqual(codeChecks({ ...draft, text }, facts).filter(f => f.severity === "fix"), []);
});
