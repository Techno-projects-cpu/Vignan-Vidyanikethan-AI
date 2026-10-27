import test from "node:test";
import assert from "node:assert/strict";
import { buildBookIndex, indexFromStored, retrieve, retrieveChapter } from "../js/retrieval.js";
import { demoIndex, demoText } from "./helpers.mjs";

test("buildBookIndex caches vectors, stats and page provenance", () => {
  const index = demoIndex();
  assert.equal(index.book.pageCount, 14);
  assert.ok(index.book.chunkCount >= 14);
  assert.equal(index.chunks.length, index.book.chunkCount);
  assert.equal(index.book.stats.dim, 512);
  for (const chunk of index.chunks) {
    assert.equal(chunk.vector.length, 512);
    assert.ok(chunk.page >= 1 && chunk.page <= 14);
    assert.ok(chunk.text.length > 20);
    assert.equal(chunk.bookId, "demo-test");
  }
});

test("retrieve finds the correct page for different subjects", () => {
  const index = demoIndex();
  const cases = [
    ["Why do leaves look green?", 3],
    ["State Newton's second law of motion", 6],
    ["solve 3x + 7 = 22", 11],
    ["What is friction?", 8],
    ["Explain active and passive voice", 13],
  ];
  for (const [question, expectedPage] of cases) {
    const result = retrieve(question, [index], { topK: 3 });
    assert.equal(result.grounded, true, `expected grounding for: ${question}`);
    assert.ok(result.hits.length > 0);
    assert.equal(result.hits[0].page, expectedPage, `wrong page for: ${question}`);
    assert.ok(result.confidence > 0.2);
  }
});

test("retrieve refuses nonsense instead of inventing an answer", () => {
  const result = retrieve("What is zzzblorp glorpnik?", [demoIndex()], { topK: 3 });
  assert.equal(result.grounded, false);
  assert.equal(result.reason, "not-in-books");
  assert.deepEqual(result.hits, []);
});

test("retrieve reports an empty library and vague queries", () => {
  assert.equal(retrieve("anything", [], {}).reason, "empty-library");
  assert.equal(retrieve("what is it?", [demoIndex()], {}).reason, "too-vague");
});

test("retrieve respects book scope", () => {
  const first = demoIndex();
  const second = buildBookIndex({ id: "other", title: "Other Book" }, "[[page:1]]\n# Shadows\nA shadow is a dark region formed when an object blocks light.");
  const combined = [first, { ...second, book: { ...second.book, id: "other" }, chunks: second.chunks.map((c) => ({ ...c, bookId: "other", id: c.id.replace("other", "other") })) }];
  const result = retrieve("What is a shadow?", combined, { topK: 4, threshold: 0.05, bookIds: ["other"] });
  assert.equal(result.grounded, true);
  assert.ok(result.hits.every((hit) => hit.bookId === "other"));
});

test("retrieveChapter returns broad context for a topic", () => {
  const hits = retrieveChapter("photosynthesis", [demoIndex()], { topK: 8 }).hits;
  assert.equal(hits.length, 8);
  assert.ok(hits.some((hit) => hit.page === 2));
  assert.ok(hits.every((hit) => typeof hit.text === "string" && hit.page));
});

test("indexFromStored reconstructs a searchable index", () => {
  const original = demoIndex();
  const rebuilt = indexFromStored(original.book, original.chunks);
  const result = retrieve("What is chlorophyll?", [rebuilt], { topK: 2 });
  assert.equal(result.grounded, true);
  assert.equal(result.hits[0].page, 3);
});
