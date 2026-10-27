import test from "node:test";
import assert from "node:assert/strict";
import { composeGroundedAnswer, confidenceLabel, notFoundMessage, sourcesFromHits } from "../js/answer.js";
import { demoIndex } from "./helpers.mjs";
import { retrieve } from "../js/retrieval.js";

function hitsFor(question) {
  return retrieve(question, [demoIndex()], { topK: 3 }).hits;
}

test("sourcesFromHits adds numbered page citations", () => {
  const hits = hitsFor("Why do leaves look green?");
  const sources = sourcesFromHits(hits);
  assert.equal(sources.length, hits.length);
  assert.equal(sources[0].n, 1);
  assert.equal(sources[0].page, hits[0].page);
  assert.ok(sources[0].quote.length > 20);
});

test("offline answer quotes the book and includes citations", () => {
  const hits = hitsFor("What is friction?");
  const answer = composeGroundedAnswer({ query: "What is friction?", hits, confidence: 0.8, mode: "answer" });
  assert.equal(answer.grounded, true);
  assert.match(answer.text, /\[1\]/);
  assert.match(answer.text, /page|p\./i);
  assert.match(answer.text, /friction/i);
  assert.equal(answer.sources.length, hits.length);
});

test("explain mode produces numbered steps", () => {
  const hits = hitsFor("Explain photosynthesis step by step");
  const answer = composeGroundedAnswer({ query: "Explain photosynthesis step by step", hits, confidence: 0.6, mode: "explain" });
  assert.match(answer.text, /\*\*1\.\*\*/);
});

test("flashcards mode returns cards with page citations", () => {
  const hits = retrieve("photosynthesis", [demoIndex()], { topK: 4 }).hits;
  const answer = composeGroundedAnswer({ query: "photosynthesis", hits, mode: "flashcards", confidence: 0.6 });
  assert.ok(answer.flashcards.length > 0);
  assert.ok(answer.flashcards[0].source.page);
  assert.match(answer.text, /\[1\]|\[2\]/);
});

test("no-grounding answers refuse to guess and label web results", () => {
  const answer = composeGroundedAnswer({
    query: "What is zzzblorp?",
    hits: [],
    reason: "not-in-books",
    webEnabled: true,
    webResults: [{ title: "Outside page", url: "https://example.com/a", domain: "example.com", snippet: "Not a textbook." }],
  });
  assert.equal(answer.grounded, false);
  assert.match(answer.text, /could not find this in your textbooks/i);
  assert.match(answer.text, /outside your textbooks/i);
  assert.match(answer.text, /\[W1\]/);
  assert.equal(answer.webSources.length, 1);
});

test("notFoundMessage explains empty library and vague questions", () => {
  assert.match(notFoundMessage("empty-library"), /library is empty/i);
  assert.match(notFoundMessage("too-vague"), /name a topic/i);
  assert.match(notFoundMessage("not-in-books", [], true), /no outside results/i);
});

test("confidenceLabel maps numeric confidence to human labels", () => {
  assert.match(confidenceLabel(0.8), /Strong/i);
  assert.match(confidenceLabel(0.4), /Partial/i);
  assert.match(confidenceLabel(0.1), /Weak/i);
});
