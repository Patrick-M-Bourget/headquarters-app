import { test } from "node:test";
import assert from "node:assert/strict";
import { checkCandidate, selectQueries, similarity } from "../runners/seo-geo/queries.ts";

const c = (text: string, audience = "general", intent = "recommendation", keywords = ["mac cleaner"]) => ({ text, audience, intent, keywords });

test("own brand is rejected; competitors only allowed in comparison/alternative", () => {
  assert.match(checkCandidate(c("Is CacheDrop a good Mac cleaner?"))!, /CacheDrop/);
  assert.match(checkCandidate(c("Is Cache Drop worth it for producers?"))!, /CacheDrop/);
  assert.match(checkCandidate(c("Is CleanMyMac good for developers?"))!, /competitor/);
  assert.equal(checkCandidate(c("Best alternative to CleanMyMac without a subscription", "general", "alternative")), null);
  assert.match(checkCandidate(c("Best cleaner for gamers on Mac", "gamers"))!, /audience/);
});

test("near-duplicates are dropped", () => {
  assert.ok(similarity("best mac cleaner for music producers", "best mac cleaner for music producers 2026") >= 0.7);
  const { queries, rejected } = selectQueries([c("best mac cleaner for music producers"), c("best mac cleaner for music producers 2026"), c("how do I clear System Data on my Mac", "general", "how_to")]);
  assert.equal(queries.length, 2);
  assert.match(rejected[0].reason, /near-duplicate/);
});

test("audiences are capped and ids are sequential", () => {
  const many = Array.from({ length: 10 }, (_, i) => c(`unique developer question number ${i} about xcode derived data ${"x".repeat(i)}`, "developers", "how_to", ["xcode cache"]));
  const distinct = many.map((m, i) => ({ ...m, text: ["clear xcode", "delete node_modules", "docker disk space", "simulator cache", "homebrew cleanup", "derived data size", "swift package cache", "npm cache clean", "pip cache mac", "gradle cache"][i] + " on a Mac safely?" }));
  const { queries, perAudience } = selectQueries(distinct, 25, 7, 0.7);
  assert.equal(perAudience.developers, 7);
  assert.deepEqual(queries.map(q => q.id).slice(0, 3), ["q01", "q02", "q03"]);
});

test("round-robin keeps audiences balanced regardless of candidate order", () => {
  const mk = (aud: string, words: string[]) => words.map(w => c(`${w} question for a ${aud} user on Mac`, aud, "how_to", ["kw"]));
  const cands = [
    ...mk("producers", ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel"]),
    ...mk("developers", ["india", "juliet", "kilo", "lima", "mike", "november", "oscar", "papa"]),
    ...mk("video_editors", ["quebec", "romeo", "sierra", "tango", "uniform", "victor", "whiskey", "xray"]),
    ...mk("general", ["yankee", "zulu", "amber", "basil", "cedar", "dune", "ember", "fern"]),
  ];
  const { queries, perAudience } = selectQueries(cands, 25, 6, 0.95);
  assert.equal(queries.length, 25);
  assert.deepEqual(perAudience, { general: 7, producers: 6, developers: 6, video_editors: 6 });
});
