import test from "node:test";
import assert from "node:assert/strict";
import {
  chunkPages,
  detectHeading,
  parsePages,
  splitSentences,
  stem,
  tokenize,
} from "../js/text.js";
import { demoText } from "./helpers.mjs";

test("a long explicitly numbered page keeps its citation number", () => {
  const text = `[[page:12]]\n${"Important science fact. ".repeat(70)}`;
  const pages = parsePages(text, { wordsPerPage: 20 });
  assert.equal(pages.length, 1);
  assert.equal(pages[0].page, 12);
});

test("parsePages keeps explicit page markers", () => {
  const pages = parsePages("[[page:1]]\n# Intro\nHello world.\n\n--- Page 7 ---\nMore text.");
  assert.equal(pages.length, 2);
  assert.equal(pages[0].page, 1);
  assert.equal(pages[0].heading, "Intro");
  assert.equal(pages[1].page, 7);
  assert.match(pages[1].text, /More text/);
});

test("parsePages estimates pages for marker-free text", () => {
  const longText = Array.from({ length: 900 }, (_, index) => `word${index}`).join(" ");
  const pages = parsePages(longText, { wordsPerPage: 300 });
  assert.equal(pages.length, 3);
  assert.deepEqual(pages.map((page) => page.page), [1, 2, 3]);
});

test("demo pack parses into 14 pages with headings", () => {
  const pages = parsePages(demoText());
  assert.equal(pages.length, 14);
  assert.ok(pages.some((page) => /Chlorophyll and Stomata/.test(page.heading)));
});

test("chunkPages never crosses a page boundary", () => {
  const pages = [
    { page: 3, heading: "A", text: "Alpha sentence one. Alpha sentence two. ".repeat(30) },
    { page: 4, heading: "B", text: "Beta sentence one. Beta sentence two. ".repeat(30) },
  ];
  const chunks = chunkPages(pages, "book-1", { targetWords: 40, overlapWords: 8, minWords: 10 });
  assert.ok(chunks.length > 2);
  for (const chunk of chunks) {
    assert.equal(chunk.bookId, "book-1");
    if (chunk.text.includes("Alpha")) assert.equal(chunk.page, 3);
    if (chunk.text.includes("Beta")) assert.equal(chunk.page, 4);
  }
});

test("chunkPages removes markdown heading lines from passage text", () => {
  const chunks = chunkPages([{ page: 1, heading: "Chapter", text: "# Chapter One\nA useful sentence about plants and sunlight." }], "b", { targetWords: 30, minWords: 3 });
  assert.ok(!chunks[0].text.includes("# Chapter"));
  assert.equal(chunks[0].section, "Chapter");
});

test("splitSentences protects decimals and abbreviations", () => {
  const sentences = splitSentences("Use 3.14 for pi. Dr. Rao explained it. Then we solved it. Plants make food.");
  assert.ok(sentences.length >= 3);
  assert.ok(sentences.some((sentence) => sentence.includes("3.14")));
  assert.ok(sentences.some((sentence) => sentence.includes("Dr. Rao")));
});

test("stem is consistent and handles common irregulars", () => {
  assert.equal(stem("leaves"), "leaf");
  assert.equal(stem("forces"), stem("force"));
  assert.equal(stem("respiration"), stem("respirations"));
  assert.ok(tokenize("What is photosynthesis?").includes(stem("photosynthesis")));
});

test("detectHeading recognises markdown and all-caps headings", () => {
  assert.equal(detectHeading("## Newton's Laws"), "Newton's Laws");
  assert.equal(detectHeading("FORCE AND ENERGY"), "FORCE AND ENERGY");
  assert.equal(detectHeading("A normal sentence."), "");
});
