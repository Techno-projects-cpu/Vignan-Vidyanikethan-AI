import test from "node:test";
import assert from "node:assert/strict";
import { composeGroundedAnswer, confidenceLabel, notFoundMessage, sourcesFromHits } from "../js/answer.js";
import { demoIndex } from "./helpers.mjs";
import { buildBookIndex, retrieve, retrievePreferBooks } from "../js/retrieval.js";

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

test("the offline answer is shaped like a teacher's answer, not a quote dump", () => {
  const index = buildBookIndex({ id: "b1", title: "Science", subject: "Science" }, [
    { page: 12, text: "Photosynthesis is the process by which green plants use sunlight to make food. Chlorophyll is the green pigment that absorbs light." },
    { page: 13, text: "The equation for photosynthesis is 6CO2 + 6H2O = C6H12O6 + 6O2. Stomata are the small pores through which gases enter and leave the leaf." },
  ]);
  const hits = retrievePreferBooks("Explain photosynthesis", [index], { topK: 5 }).hits;
  const answer = composeGroundedAnswer({ query: "Explain photosynthesis", hits, mode: "answer", confidence: 0.6 });
  // The definition of what was asked leads, with its page and citation.
  assert.match(answer.text, /^\*\*From your library — Explain photosynthesis\*\*\n\n\*\*Photosynthesis\*\* — the process by which/);
  assert.match(answer.text, /\(Science, p\. 12\)_ \[1\]/);
  // The formula from the pages is kept verbatim.
  assert.match(answer.text, /\*\*Formula:\*\* `6CO2 \+ 6H2O = C6H12O6 \+ 6O2`/);
  assert.match(answer.text, /Every line is taken from the cited pages/);
});

test("a question that only matches one definition is not padded with other facts", () => {
  const index = buildBookIndex({ id: "b1", title: "Science", subject: "Science" }, [
    { page: 12, text: "Photosynthesis is the process by which green plants use sunlight to make food." },
    { page: 13, text: "The equation for photosynthesis is 6CO2 + 6H2O = C6H12O6 + 6O2. Stomata are the small pores through which gases enter and leave the leaf." },
  ]);
  const hits = retrievePreferBooks("What are stomata?", [index], { topK: 5 }).hits;
  const answer = composeGroundedAnswer({ query: "What are stomata?", hits, mode: "answer", confidence: 0.5 });
  assert.match(answer.text, /\*\*Stomata\*\* — the small pores/);
  assert.doesNotMatch(answer.text, /6CO2/, "an unrelated equation is not attached to this answer");
  assert.doesNotMatch(answer.text, /Chlorophyll/);
});

test("web imports stay labelled on every line of the shaped answer", () => {
  const answer = composeGroundedAnswer({
    query: "How does it work",
    hits: [{
      title: "Online article", page: 1, section: "Growth", bookId: "web1",
      sourceUrl: "https://example.com/x", sourceKind: "article",
      text: "Photosynthesis is a process in which green plants use sunlight to make food from carbon dioxide and water. It releases oxygen.",
    }],
    mode: "answer",
    confidence: 0.4,
  });
  assert.match(answer.text, /Web import: Online article/);
  assert.match(answer.text, /verify it independently/);
});
