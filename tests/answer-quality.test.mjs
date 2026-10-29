import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { composeGroundedAnswer, evidenceNote, notFoundMessage } from "../js/answer.js";
import { citationCoverage, looksUncited, missingTerms, queryTerms, ungroundedNumbers } from "../js/answer-quality.js";

const root = new URL("../", import.meta.url);
const app = readFileSync(fileURLToPath(new URL("js/app.js", root)), "utf8");

const hit = (text, extra = {}) => ({
  n: 1, bookId: "b1", title: "Physics Notes", page: 4, text, ...extra,
});

test("the words that matter are the words a refusal names back", () => {
  assert.deepEqual(queryTerms("What is the entropy of a Carnot engine?"), ["entropy", "carnot", "engine"]);
  assert.deepEqual(queryTerms("Explain photosynthesis in plants, please"), ["explain", "photosynthesis", "plants"].filter((w) => w !== "explain"));
  assert.deepEqual(queryTerms("Why?"), []);
  assert.deepEqual(queryTerms("a bb ccc dddd eeeee"), ["dddd", "eeeee"].slice(0, 0).concat(["dddd", "eeeee"]));
});

test("missing terms are the student's words that the retrieved pages lack", () => {
  const hits = [hit("A lever balances when the moments on both sides are equal.")];
  assert.deepEqual(missingTerms("What is entropy in a lever?", hits), ["entropy"]);
  assert.deepEqual(missingTerms("How does a lever balance?", hits), []);
  assert.deepEqual(missingTerms("What is entropy?", []), ["entropy"], "with nothing read, nothing is present");
});

test("a figure no cited page contains is reported instead of implied", () => {
  const sources = [hit("Acceleration due to gravity near the surface is 9.8 m/s^2.")];
  assert.deepEqual(ungroundedNumbers("Gravity is 9.8 m/s^2.", sources), []);
  assert.deepEqual(ungroundedNumbers("The answer is 6.022 x 10^23 particles.", sources), ["6.022x10^23"]);
  // Counts and question numbers are about the lesson, not the physics.
  assert.deepEqual(ungroundedNumbers("Give 3 examples in 2 marks.", sources), []);
  assert.deepEqual(ungroundedNumbers("", sources), []);
});

test("a refusal names the missing words and the closest page, then stops", () => {
  const hits = [hit("A lever balances when the moments on both sides are equal.")];
  const note = evidenceNote({ query: "What is entropy in a Carnot engine?", hits });
  assert.match(note, /“entropy”, “carnot”, “engine”/);
  assert.match(note, /Physics Notes, p\. 4/);
  assert.match(note, /have not written one/);
  assert.equal(evidenceNote({ query: "Anything", hits: [] }), "", "nothing read, nothing to explain");
});

test("the diagnostic appears in English only, and never replaces the refusal", () => {
  const hits = [hit("A lever balances when the moments on both sides are equal.")];
  const english = notFoundMessage("not-in-books", [], false, "en", { query: "What is entropy?", hits });
  assert.match(english, /I could not find this in your textbooks/);
  assert.match(english, /“entropy”/);
  // A half-translated diagnostic would be worse than none, so Telugu keeps the
  // honest headline alone.
  const telugu = notFoundMessage("not-in-books", [], false, "te", { query: "What is entropy?", hits });
  assert.doesNotMatch(telugu, /“entropy”/);
  assert.ok(telugu.length > 0);
});

test("a partial match says so in the answer body, not only in a tag", () => {
  const hits = [hit("A lever balances when the moments on both sides are equal.")];
  const partial = composeGroundedAnswer({ query: "Why does a lever balance?", hits, confidence: 0.4, partial: true });
  assert.match(partial.text, /Only part of your question is covered by these pages/);
  assert.match(partial.text, /have not filled the gap from memory/);
  const strong = composeGroundedAnswer({ query: "Why does a lever balance?", hits, confidence: 0.8 });
  assert.doesNotMatch(strong.text, /Only part of your question/);
});

test("citation coverage is measured, and short answers are exempt", () => {
  const good = "Matter is made of particles. [1] They move faster when heated. [2] Temperature measures that motion. [1]";
  const bad = "Matter is made of very small particles. They move faster when they are heated. Temperature measures the motion of those particles. This is why a solid becomes a liquid when warmed.";
  assert.equal(citationCoverage(good).ratio, 1);
  assert.equal(looksUncited(good), false);
  assert.equal(looksUncited(bad), true);
  assert.equal(looksUncited("One short sentence with no citation at all.", { minimumSentences: 4 }), false);
});

test("the app uses all three checks where the text is written", () => {
  assert.match(app, /ungroundedNumbers\(model\.content, sourcesFromHits\(hits\)\)/);
  assert.match(app, /These figures do not appear on the cited pages/);
  assert.match(app, /partial: retrieval\.confidence > 0 && retrieval\.confidence < 0\.62/);
});
