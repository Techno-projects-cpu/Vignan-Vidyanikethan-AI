import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { composeGroundedAnswer, evidenceNote, notFoundMessage } from "../js/answer.js";
import {
  citationAudit,
  citationCoverage,
  citationSummary,
  citationWarning,
  citedMarkers,
  looksUncited,
  matchedTerms,
  missingTerms,
  queryTerms,
  ungroundedNumbers,
} from "../js/answer-quality.js";

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

test("a citation that points at a passage that was never open is caught", () => {
  const sources = [{ n: 1 }, { n: 2 }, { n: 3 }];
  const text = "Plants use light [1]. Chlorophyll absorbs it [2]. See [4] for more. Also [W1].";
  assert.deepEqual(citedMarkers(text), { library: [1, 2, 4], web: [1] });
  const audit = citationAudit(text, sources);
  assert.deepEqual(audit.unknown, [4], "four passages were never open");
  assert.deepEqual(audit.used, [1, 2]);
  assert.deepEqual(audit.unused, [3]);
  assert.match(citationWarning(audit), /cites \[4\], but only 3 passages were open/);
  assert.match(citationWarning(audit), /may not have come from your books|did not come from your books/);
  assert.equal(citationWarning(citationAudit("Only [1] and [2].", sources)), "", "nothing to warn about");
  assert.equal(citationSummary(audit), "2 of 3 pages cited");
  assert.equal(citationSummary(citationAudit("[1] [2] [3]", sources)), "all 3 pages cited");
  assert.equal(citationSummary(citationAudit("no citations at all", sources)), "");
});

test("a Markdown link is not a citation", () => {
  assert.deepEqual(citedMarkers("Read [2](https://example.org/page) first.").library, []);
  assert.deepEqual(citedMarkers("[1] and [2]").library, [1, 2]);
});

test("the closest page survives a refusal, as text and as a button", () => {
  // Retrieval empties `hits` when it refuses, so the page it considered has to
  // be carried separately or the refusal cannot name anything.
  const nearest = { n: 1, bookId: "b1", title: "Physics Notes", page: 4, text: "A lever balances when the moments are equal." };
  const answer = composeGroundedAnswer({
    query: "What is entropy?", hits: [], reason: "not-in-books", contextHits: [nearest],
  });
  assert.match(answer.text, /does not appear|do not appear in the pages that came closest/);
  assert.match(answer.text, /Physics Notes, p\. 4/);
  assert.match(app, /const contextHits = \(retrieval\.allHits\?\.length \? retrieval\.allHits : hits\)\.slice\(0, 3\)/);
  assert.match(app, /answer\.suggest = \{/);
  assert.match(app, /contextHits,/);
  assert.match(app, /class="message-suggest"|"message-suggest"/, "the page is offered as a button");
  assert.match(app, /addEventListener\("click", \(\) => openSource\(nearest\)\)/);
});

test("the audit reaches the answer and its meta line", () => {
  assert.match(app, /const audit = citationAudit\(model\.content, sourcesFromHits\(hits\)\)/);
  assert.match(app, /citationNote \? `\$\{citationNote\}\\n\\n` : ""/, "the warning leads the answer");
  assert.match(app, /citationAudit: audit,/);
  assert.match(app, /const cited = citationSummary\(message\.citationAudit\)/);
});

test("each cited page can say which of the student's words it repeats", () => {
  const page = "A lever balances when the moments on both sides are equal.";
  assert.deepEqual(matchedTerms("Why does a lever balance on moments?", page), ["lever", "balance", "moments"]);
  assert.deepEqual(matchedTerms("What is entropy?", page), [], "a page can arrive on its neighbours");
  assert.deepEqual(matchedTerms("Why does a lever balance?", "   "), []);
  // The panel shows it under the passage, and says so plainly when empty.
  assert.match(app, /const matched = matchedTerms\(query, /);
  assert.match(app, /t\("source\.matched", \{ terms: matched\.join\(", "\) \}\)/);
  assert.match(app, /t\("source\.noSharedWords"\)/);
  assert.match(app, /sourceCard\(source, answer\.query \|\| ""\)/);
});
