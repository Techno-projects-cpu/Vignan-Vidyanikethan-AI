/**
 * The starter shelf: the pages that make the app work on first open.
 *
 * Two rules matter here and are tested rather than trusted: the content is ours
 * (never a copy of a publisher's book), and it behaves exactly like a page the
 * student added, so citations, quizzes and exam practice all work from it.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { STARTER_NOTE, isStarterBookId, shelfBooks, shelfMarkdown, shelfSummary } from "../js/starter-shelf.js";
import { ingestText } from "../js/ingest.js";
import { retrieveChapter } from "../js/retrieval.js";
import { generateQuiz } from "../js/quiz.js";
import { EXAMS, syllabusCoverage } from "../js/exam-packs.js";
import { parsePages } from "../js/text.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8");

const books = shelfBooks();
const indexes = books.map((book) =>
  ingestText(shelfMarkdown(book), { id: book.id, title: book.title, subject: book.subject, grade: book.grade }),
);
const corpus = indexes.map((index) => index.book.pages.map((page) => page.text).join("\n")).join("\n");

test("the shelf covers four subjects without copying anyone's book", () => {
  assert.ok(books.length >= 4, "four subject books");
  assert.deepEqual(books.map((book) => book.subject), ["Physics", "Chemistry", "Biology", "Mathematics"]);
  for (const book of books) {
    assert.match(book.id, /^starter-/, "starter ids are recognisable");
    assert.ok(isStarterBookId(book.id));
    assert.ok(book.title.length > 10);
    assert.ok(book.pages.length >= 10, `${book.subject} has at least ten pages`);
  }
  assert.equal(isStarterBookId("student-upload"), false);

  const summary = shelfSummary();
  assert.equal(summary.books, books.length);
  assert.equal(summary.pages, books.reduce((total, book) => total + book.pages.length, 0));
  assert.ok(summary.pages >= 40, "enough pages to practise");
  assert.ok(summary.words >= 2500, "enough text for retrieval to have something to find");

  const source = read("js/starter-shelf.js");
  assert.ok(/^[\x00-\x7F]*$/.test(source), "the shelf stays ASCII for the bundled fonts");
  // Word boundaries matter: "uncertainty" contains the letters of a publisher
  // name, and a naive substring check would fail on a physics sentence.
  assert.doesNotMatch(source, /\b(?:NCERT|SCERT|CBSE)\b/, "no publisher or board text");
  assert.doesNotMatch(source, /https?:\/\//, "no content is fetched from anywhere");
  assert.match(STARTER_NOTE, /written for this project/i, "the honest label is shipped with the data");
});

test("every page is a real page: a heading, a paragraph and several sentences", () => {
  for (const book of books) {
    const headings = new Set();
    for (const page of book.pages) {
      assert.ok(page.heading.trim().length > 3, `${book.subject} heading`);
      assert.equal(headings.has(page.heading), false, `${page.heading} appears once per book`);
      headings.add(page.heading);
      const words = page.text.trim().split(/\s+/).length;
      assert.ok(words >= 55, `${page.heading} has enough text to be quoted (${words} words)`);
      const sentences = page.text.split(/[.!?]+\s/).filter((part) => part.trim().length > 12).length;
      assert.ok(sentences >= 4, `${page.heading} has several sentences (${sentences})`);
    }
  }
});

test("the shelf turns into ordinary library pages with page numbers", () => {
  for (const book of books) {
    const markdown = shelfMarkdown(book);
    assert.match(markdown, /^\[\[page:1\]\]/);
    const pages = parsePages(markdown);
    assert.equal(pages.length, book.pages.length, `${book.subject} keeps one page per chapter`);
    pages.forEach((page, index) => {
      assert.equal(page.page, index + 1, "page numbers count from one");
      assert.equal(page.heading, book.pages[index].heading, `${book.pages[index].heading} keeps its heading`);
      assert.ok(page.text.length > 200);
    });
  }
});

test("a starter page can answer, cite and quiz like any uploaded book", () => {
  const { hits } = retrieveChapter("laws of motion", indexes, { topK: 6 });
  assert.ok(hits.length >= 1, "the chapter is findable");
  const top = hits[0];
  assert.match(top.title, /Starter Physics/);
  assert.ok(Number(top.page) >= 1, "the citation carries a page number");
  assert.match(top.text, /laws of motion/i);

  const quiz = generateQuiz({ hits, topic: "laws of motion", count: 5, type: "mcq" });
  assert.ok(quiz.questions.length >= 3, "questions are written from the page");
  for (const question of quiz.questions) {
    assert.ok(question.source?.title, "every question is cited");
    assert.ok(Number(question.source.page) >= 1);
    assert.ok(question.options.length >= 2);
    assert.ok(question.options.includes(question.answer), "the answer is one of the options");
  }
});

test("the shelf alone makes exam practice meaningful, not empty", () => {
  const jee = EXAMS.find((exam) => exam.id === "jee-main");
  const neet = EXAMS.find((exam) => exam.id === "neet");
  for (const exam of [jee, neet]) {
    const coverage = syllabusCoverage(exam, corpus);
    assert.ok(coverage.covered >= 30, `${exam.id}: ${coverage.covered} chapters covered`);
    assert.ok(coverage.percent >= 40, `${exam.id}: ${coverage.percent}% of the syllabus`);
    // Every covered subject has something, or the coverage number would lie.
    assert.ok(coverage.present.some((entry) => entry.subjectId === "physics"));
    assert.ok(coverage.present.some((entry) => entry.subjectId === "chemistry"));
    assert.ok(coverage.present.some((entry) => entry.subjectId === "biology" || entry.subjectId === "maths"));
  }
});

test("the app installs the shelf on first open and lets the student remove it", () => {
  const html = read("index.html");
  const app = read("js/app.js");
  const sw = read("sw.js");

  assert.match(html, /id="starter-card"/);
  assert.match(html, /id="starter-add"/);
  assert.match(html, /id="starter-remove"/);
  assert.match(html, /id="starter-status"/);
  assert.match(html, /Start with pages we wrote ourselves/);

  assert.match(app, /from "\.\/starter-shelf\.js\?v=39"/);
  assert.match(app, /await ensureStarterShelf\(\);/, "first open never shows an empty workspace");
  assert.match(app, /async function installStarterShelf/, "the same path is used for the button");
  assert.match(app, /async function removeStarterShelf/);
  assert.match(app, /renderStarterCard\(\);/);
  assert.match(app, /Add the starter pages/, "the empty exam panel offers the shelf too");
  assert.match(sw, /"\.\/js\/starter-shelf\.js\?v=39"/, "the shelf ships offline");

  // A starter book must never be marked as the retired demo pack: reloadIndexes
  // deletes demo books, which would silently bring the empty workspace back.
  assert.doesNotMatch(read("js/starter-shelf.js"), /demo\s*:/);
});

test("a student's own book outranks the starter pages, and the shelf outranks the web", async () => {
  const { buildBookIndex, retrievePreferBooks } = await import("../js/retrieval.js");
  const shelfIndex = ingestText(shelfMarkdown(books[0]), { id: "starter-physics", title: books[0].title, subject: "Physics" });
  const ownIndex = buildBookIndex(
    { id: "my-physics-notes", title: "My Physics Notes", subject: "Physics" },
    [{ page: 7, text: "Newton's second law says force equals mass times acceleration, and a body keeps its state of rest unless a force acts on it." }],
  );
  const webIndex = buildBookIndex(
    { id: "web-import", title: "Some Web Page", subject: "Physics", sourceUrl: "https://example.org/physics" },
    [{ page: 1, text: "Newton's second law says force equals mass times acceleration, and a body keeps its state of rest unless a force acts on it." }],
  );
  const question = "What does Newton's second law say about force?";
  const withOwn = retrievePreferBooks(question, [shelfIndex, ownIndex, webIndex], { topK: 5 });
  assert.equal(withOwn.hits[0].title, "My Physics Notes", "the student's own book wins");
  const shelfOnly = retrievePreferBooks(question, [shelfIndex, webIndex], { topK: 5 });
  assert.match(shelfOnly.hits[0].title, /Starter Physics/, "the shelf is preferred to a web import");
  const webOnly = retrievePreferBooks(question, [webIndex], { topK: 5 });
  assert.equal(webOnly.hits[0].title, "Some Web Page", "a web import still answers when it is all there is");
});
