/**
 * The answer benchmark.
 *
 * Judges do not ask the questions the shelf was written for. They ask the ones
 * they remember from school, in their own words, and they can tell in one second
 * whether the answer is about the thing they asked. This file is that test: a
 * list of ordinary questions, a word the right page must contain, and a rule
 * that a refusal is better than an answer about something else.
 *
 * It caught two real defects when it was written:
 *   1. "What is photosynthesis and why does it matter?" was answered from a
 *      chemistry page about matter, because the word "matter" scored well and
 *      "photosynthesis" did not.
 *   2. "How does a transformer work?" was answered from Work, Energy and Power,
 *      because of the word "work".
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { composeGroundedAnswer } from "../js/answer.js";
import { buildBookIndex, cleanStudyQuery, distinctiveTerms, retrievePreferBooks, tokenize } from "../js/retrieval.js";
import { shelfBooks, shelfMarkdown, shelfSummary } from "../js/starter-shelf.js";

const indexes = shelfBooks().map((book) => buildBookIndex(book, shelfMarkdown(book)));

const ask = (question) => {
  const result = retrievePreferBooks(question, indexes, { topK: 4 });
  const answer = composeGroundedAnswer({
    query: question,
    hits: result.hits || [],
    confidence: result.confidence,
    reason: result.reason,
  });
  return { result, answer, hits: result.hits || [] };
};

const citedText = (hits) => hits.map((hit) => `${hit.text} ${hit.section}`.toLowerCase()).join(" ");

/**
 * question, a word the cited page must contain, and (optionally) the subject it
 * must come from. "water" alone is not enough: a page about photosynthesis also
 * contains it.
 */
const GOLDEN = [
  ["What is photosynthesis and why does it matter?", ["photosynthes"], "Biology"],
  ["Explain photosynthesis in simple words", ["photosynthes"], "Biology"],
  ["What is the role of chlorophyll?", ["chlorophyll"], "Biology"],
  ["What is the difference between covalent and ionic bonds?", ["covalent"], "Chemistry"],
  ["How do I solve a quadratic equation?", ["quadratic"], "Mathematics"],
  ["State Newton's second law of motion", ["second law"], "Physics"],
  ["What is the third law of motion?", ["third law"], "Physics"],
  ["Why does a body float in water?", ["buoyan"], "Physics"],
  ["What is Archimedes principle?", ["archimede"], "Physics"],
  ["What happens during electrolysis of water?", ["electrolysi"], "Chemistry"],
  ["What is pH and what does the pH scale mean?", ["ph scale"], "Chemistry"],
  ["Explain reflection of light", ["reflection"], "Physics"],
  ["What is refraction?", ["refraction"], "Physics"],
  ["What is Ohm's law?", ["ohm"], "Physics"],
  ["Explain the human digestive system", ["digest"], "Biology"],
  ["What is mitosis?", ["mitosis"], "Biology"],
  ["What is the difference between mitosis and meiosis?", ["meiosis"], "Biology"],
  ["What is gravitation?", ["gravitation"], "Physics"],
  ["What is an ecosystem?", ["ecosystem"], "Biology"],
  ["Explain the water cycle", ["water cycle"], "Biology"],
  ["What are the laws of thermodynamics?", ["thermodynamic"], "Physics"],
  ["What is electromagnetic induction?", ["induction"], "Physics"],
  ["What is a magnetic field?", ["magnetic field"], "Physics"],
  ["How does a transformer work?", ["transformer"], "Physics"],
  ["What is probability?", ["probability"], "Mathematics"],
  ["What is the structure of an atom?", ["atom"], "Chemistry"],
  ["What is equilibrium in chemistry?", ["equilibrium"], "Chemistry"],
  ["What is respiration?", ["respiration"], "Biology"],
  ["How does a lens form an image?", ["lens"], "Physics"],
  ["What is osmosis?", ["osmosis"], "Biology"],
  ["What is a mole in chemistry?", ["mole"], "Chemistry"],
];

test("every ordinary question is answered from a page about that question", () => {
  const failures = [];
  for (const [question, words, subject] of GOLDEN) {
    const { hits } = ask(question);
    if (!hits.length) {
      failures.push(`${question} — refused`);
      continue;
    }
    const text = citedText(hits);
    if (!words.some((word) => text.includes(word))) {
      failures.push(`${question} — cited ${hits.map((hit) => `${hit.subject} p${hit.page}`).join(", ")}`);
    }
    if (subject && !hits.some((hit) => hit.subject === subject)) {
      failures.push(`${question} — expected a ${subject} page, got ${hits.map((hit) => hit.subject).join(", ")}`);
    }
  }
  assert.deepEqual(failures, [], `questions answered from the wrong page:\n  ${failures.join("\n  ")}`);
});

test("no question is answered from a page that only shares its filler words", () => {
  // Each pair is a real question and a page it used to be answered from.
  const wrong = [
    ["What is photosynthesis and why does it matter?", "Chemistry p1"],
    ["How does a transformer work?", "Physics p4"],
  ];
  for (const [question, wrongPage] of wrong) {
    const { hits } = ask(question);
    const label = hits.map((hit) => `${hit.subject} p${hit.page}`);
    assert.ok(!label.includes(wrongPage), `${question} must not cite ${wrongPage} (cited ${label.join(", ")})`);
  }
});

test("the answer cites the page whose wording differs from the question", () => {
  // "digestive" and "digestion" are different tokens to the stemmer. The page is
  // still the right one, and the answer has to say so rather than refuse.
  const { hits, answer } = ask("Explain the human digestive system");
  assert.equal(hits.length > 0, true, "a page about digestion exists");
  assert.match(citedText(hits), /digest/);
  assert.match(answer.text, /Digestion|digestive/i);
});

test("a pronoun tail is not treated as the topic", () => {
  // "why does it matter" has no "it" to point at. The words of that tail must
  // not decide which page answers.
  assert.equal(cleanStudyQuery("What is photosynthesis and why does it matter?").includes("matter"), false);
  assert.equal(cleanStudyQuery("What is pH and why is it important?").includes("important"), false);
  assert.ok(cleanStudyQuery("What is photosynthesis and why does it matter?").includes("photosynthesis"));
  // The subject really being discussed is still kept: "matter" is a topic here.
  assert.ok(cleanStudyQuery("What is matter?").includes("matter"));
});

test("topic words are the ones that identify a subject, not a school exercise", () => {
  const terms = distinctiveTerms("Explain the difference in simple words with examples", indexes);
  assert.deepEqual(terms, [], "a question with no topic has no topic words");
  const real = distinctiveTerms("What is photosynthesis", indexes);
  assert.deepEqual(real, ["photosynthesi"]);
  // A subject name scopes the search, it does not name the thing asked about.
  assert.deepEqual(distinctiveTerms("What is equilibrium in chemistry", indexes), ["equilibrium"]);
});

test("a question whose topic is nowhere in the library is refused, not guessed", () => {
  const { hits, answer } = ask("What is the Pauli exclusion principle in quantum field theory?");
  assert.equal(hits.length, 0, "nothing in the shelf covers this");
  assert.match(answer.text, /could not find|not in your|add the chapter/i);
});

test("the starter shelf is still ours, and still usable", () => {
  const summary = shelfSummary();
  assert.ok(summary.pages >= 49, `the shelf holds at least 49 pages (${summary.pages})`);
  assert.ok(summary.words >= 4000, `the shelf holds real prose (${summary.words} words)`);
  const headings = new Set();
  for (const book of shelfBooks()) {
    for (const page of book.pages) {
      assert.ok(!headings.has(page.heading), `no page is shipped twice: ${page.heading}`);
      headings.add(page.heading);
      assert.match(page.text, /^[\x20-\x7E]+$/, `${page.heading} is plain ASCII`);
      assert.ok(page.text.split(/\s+/).filter(Boolean).length >= 45, `${page.heading} is more than a definition`);
      assert.doesNotMatch(page.text, /\bNCERT\b|\bSCERT\b|\bCBSE\b|Telangana State Council/, `${page.heading} claims no publisher`);
    }
  }
});

test("the benchmark covers every subject in the shelf", () => {
  const subjects = new Set(indexes.map((index) => index.book.subject));
  for (const [, , subject] of GOLDEN) {
    if (subject) assert.ok(subjects.has(subject), `${subject} exists in the shelf`);
  }
  const covered = new Set(GOLDEN.map((row) => row[2]).filter(Boolean));
  assert.deepEqual([...covered].sort(), [...subjects].sort(), "every shelf subject has questions in the benchmark");
});

test("the shelf the app loads is the shelf that was tested", () => {
  // A test that runs on a copy of the content proves nothing about the app.
  const source = readFileSync(new URL("../js/starter-shelf.js", import.meta.url), "utf8");
  const shipped = (source.match(/heading: "/g) || []).length;
  const inMemory = shelfBooks().reduce((sum, book) => sum + book.pages.length, 0);
  assert.equal(shipped, inMemory, "the number of pages in the file matches the number loaded");
  assert.ok(inMemory >= 49);
});

test("tokenising the shelf is fast enough to run on a phone", () => {
  const started = Date.now();
  for (const question of ["What is photosynthesis?", "explain the water cycle", "what is pH"]) {
    retrievePreferBooks(question, indexes, { topK: 4 });
  }
  const elapsed = Date.now() - started;
  assert.ok(elapsed < 2000, `three searches under two seconds (${elapsed} ms)`);
  assert.ok(tokenize("photosynthesis").length === 1);
});
