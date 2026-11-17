/**
 * The study card: a cited answer that can leave the app.
 *
 * The point of these tests is that the card is honest and it fits. An answer
 * that travels to a classmate has to carry its own citation, has to say so when
 * there is no citation, and has to survive the 500-character limit of the chat
 * it is pasted into without losing the part that makes it trustworthy.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { CARD_LIMIT, buildStudyCard, cardTitle, citationLine, questionLink, trimTo } from "../js/study-card.js";
import { askFromUrl } from "../js/goal-cards.js";

const read = (path) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), "utf8");
const app = read("js/app.js");
const chat = read("js/chat-ui.js");

const sources = [
  { n: 1, title: "Class 8 Science", page: 42, bookId: "b1" },
  { n: 2, title: "Class 8 Science", page: 44, bookId: "b1" },
];

test("a card carries the question, the answer and the page", () => {
  const card = buildStudyCard({
    question: "What is photosynthesis?",
    answer: "The way a green plant makes its own food.",
    sources,
    base: "https://example.test/",
  });
  assert.match(card, /What is photosynthesis\?/);
  assert.match(card, /makes its own food/);
  assert.match(card, /\[1\] Class 8 Science, page 42/);
  assert.match(card, /\[2\] Class 8 Science, page 44/);
  assert.match(card, /ask=What%20is%20photosynthesis/);
});

test("a card without a citation says so instead of inventing one", () => {
  const card = buildStudyCard({ question: "What is a noun?", answer: "A naming word.", sources: [], base: "https://example.test/" });
  assert.match(card, /No page was cited/);
  assert.doesNotMatch(card, /page \d+/);
  assert.equal(citationLine([]), "No page was cited for this answer. Treat it as unverified.");
});

test("the card fits the chat it is pasted into", () => {
  const long = `${"A sentence that goes on. ".repeat(80)}`;
  const card = buildStudyCard({ question: "Explain the whole chapter.", answer: long, sources, base: "https://example.test/" });
  assert.ok(card.length <= CARD_LIMIT, `card is ${card.length} characters, the limit is ${CARD_LIMIT}`);
  // The part that can be trimmed is the answer. The citation and the link are
  // the reason the card exists, so they survive every trim.
  assert.match(card, /\[1\] Class 8 Science, page 42/);
  assert.match(card, /https:\/\/example\.test\/\?ask=/);
  assert.match(card, /…/, "a cut answer is marked as cut");
});

test("a cut never ends in half a word", () => {
  const cut = trimTo("alpha bravo charlie delta", 18);
  assert.ok(cut.length <= 18);
  assert.doesNotMatch(cut, /char$/);
  assert.ok(cut.startsWith("alpha "));
});

test("the link reopens the same question in the app", () => {
  const link = questionLink("What is photosynthesis?", "https://example.test/index.html?view=ask");
  const query = link.slice(link.indexOf("?"));
  assert.equal(askFromUrl(query), "What is photosynthesis?", "the existing ?ask= reader understands the card's link");
  // A card built with no base has no link at all, rather than a dead one.
  assert.equal(questionLink("What is photosynthesis?", ""), "?ask=What%20is%20photosynthesis%3F");
  const noBase = buildStudyCard({ question: "Q", answer: "A", sources });
  assert.doesNotMatch(noBase, /https?:\/\//);
});

test("the card is plain text: no markup travels with it", () => {
  const card = buildStudyCard({
    question: "What is **osmosis**?",
    answer: "**Osmosis** is _water_ moving across a #membrane`.",
    sources,
    base: "https://example.test/",
  });
  assert.doesNotMatch(card, /\*\*|__|`|^#/m, "no emphasis markers survive into the card");
  assert.match(card, /What is osmosis\?/);
});

test("the toast names the question, shortened", () => {
  assert.equal(cardTitle("What is photosynthesis?"), "What is photosynthesis?");
  const long = cardTitle("Explain in the simplest words you can the whole of chapter four including every worked example");
  assert.ok(long.length <= 48);
  assert.match(long, /…$/);
  assert.equal(cardTitle(""), "This answer");
});

test("the app offers the card, and the chat accepts it as a draft", () => {
  assert.match(app, /from "\.\/study-card\.js\?v=\d+"/, "the app imports the card builder");
  assert.match(app, /"message-action", "Hand this on"/, "the answer row offers it");
  assert.match(app, /function handOnAnswer\(/, "one handler, not two copies of the logic");
  // It never sends on its own: it copies, and at most opens the Hall with a draft.
  assert.match(chat, /openThread\(\{ threadId = "", friendId = "", draft = "" \}/);
  assert.match(chat, /input\.value = draft;/, "the draft lands in the box, unsent");
  assert.match(app, /vignan:open-chat", \{ detail: \{ threadId: hallId, draft: card \} \}/);
  // A guest still gets the card; only the Study Hall route needs an account.
  assert.match(app, /if \(!social_\.signedIn \|\| !hallId\)/);
});
