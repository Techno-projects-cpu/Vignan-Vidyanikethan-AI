/**
 * "Pick up where you left off", and how today is going.
 *
 * The rules are the feature: a row that repeats itself, or offers "hi" as a
 * question to continue, is worse than no row at all. Everything here is pure so
 * those rules can be stated as tests instead of remembered.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { CONTINUE_LIMIT, chipLabel, recentQuestions, sameDay, todaySummary, whenText } from "../js/ask-recent.js";

const read = (path) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), "utf8");

const at = (iso) => ({ createdAt: iso });
const day = (offset = 0) => new Date(Date.now() + offset * 86400000).toISOString();

const conversation = [
  { id: "a", role: "assistant", content: "Welcome.", ...at(day(-3)) },
  { id: "b", role: "user", content: "What is photosynthesis and where is it defined?", ...at(day(-3)) },
  { id: "c", role: "assistant", content: "It is how a plant makes food.", ...at(day(-3)) },
  { id: "d", role: "user", content: "Why does a leaf need sunlight to make sugar?", ...at(day(-2)) },
  { id: "e", role: "user", content: "hi", ...at(day(-2)) },
  { id: "f", role: "user", content: "What is photosynthesis and where is it defined?", ...at(day(-1)) },
];

test("only the student's own questions, newest first, without repeats", () => {
  const recent = recentQuestions(conversation);
  // `f` repeats `b`, so the newer one wins and the older is dropped; `c` is an
  // answer rather than a question; `e` is a greeting.
  assert.deepEqual(recent.map((row) => row.id), ["f", "d"], "newest first, the repeat collapsed, the reply dropped");
  assert.equal(recent.length, 2);
});

test("a one-word message is not something to continue", () => {
  const recent = recentQuestions(conversation);
  assert.ok(!recent.some((row) => /^hi$/i.test(row.text)), "a greeting is not a question");
});

test("the question already in the composer is not offered back", () => {
  const recent = recentQuestions(conversation, { skip: "Why does a leaf need sunlight to make sugar?" });
  assert.ok(!recent.some((row) => /leaf need sunlight/i.test(row.text)));
  assert.equal(recent[0].id, "f");
});

test("the row is short by design, and says so", () => {
  assert.equal(CONTINUE_LIMIT, 3);
  const many = Array.from({ length: 10 }, (_, index) => ({
    role: "user",
    content: `Question number ${index} about the chapter on cells`,
    ...at(day(-1)),
  }));
  assert.equal(recentQuestions(many).length, 3);
  assert.equal(recentQuestions(many, { limit: 5 }).length, 5);
  assert.deepEqual(recentQuestions([]), []);
});

test("a chip is one short line", () => {
  assert.equal(chipLabel("What is photosynthesis?"), "What is photosynthesis?");
  const long = chipLabel("Explain in the simplest words you can the whole of chapter four including every worked example");
  assert.ok(long.length <= 46);
  assert.match(long, /…$/);
  assert.equal(chipLabel("**bold** question about cells"), "bold question about cells", "no markup in a chip");
});

test("time is described in words a student uses", () => {
  const now = Date.parse("2026-11-17T10:00:00.000Z");
  assert.equal(whenText("2026-11-17T09:59:30.000Z", now), "just now");
  assert.equal(whenText("2026-11-17T09:30:00.000Z", now), "30 minutes ago");
  assert.equal(whenText("2026-11-17T09:00:00.000Z", now), "an hour ago");
  assert.equal(whenText("2026-11-17T04:00:00.000Z", now), "6 hours ago");
  assert.equal(whenText("2026-11-16T09:00:00.000Z", now), "yesterday");
  assert.equal(whenText("2026-11-13T09:00:00.000Z", now), "4 days ago");
  assert.equal(whenText("2026-10-20T09:00:00.000Z", now), "4 weeks ago");
  assert.equal(whenText("", now), "", "no date, no claim");
});

test("today counts questions asked today, and nothing else", () => {
  const messages = [
    { role: "user", content: "one", createdAt: new Date().toISOString() },
    { role: "assistant", content: "reply", createdAt: new Date().toISOString() },
    { role: "user", content: "two", createdAt: new Date().toISOString() },
    { role: "user", content: "old", createdAt: day(-4) },
  ];
  const summary = todaySummary({ messages, streak: 6 });
  assert.equal(summary.asked, 2);
  assert.equal(summary.text, "6 day streak · 2 questions today");
  assert.equal(summary.empty, false);
});

test("the strip stays quiet when there is nothing to say", () => {
  const summary = todaySummary({ messages: [], streak: 0 });
  assert.equal(summary.text, "");
  assert.equal(summary.empty, true, "an empty strip is hidden, not printed as a zero");
  assert.equal(todaySummary({ messages: [], streak: 1 }).text, "1 day streak");
  assert.equal(todaySummary({ messages: [{ role: "user", content: "x", createdAt: new Date().toISOString() }] }).text, "1 question today");
});

test("same day means the student's day, not UTC's", () => {
  const morning = new Date(2026, 10, 17, 0, 30);
  const evening = new Date(2026, 10, 17, 23, 30);
  assert.equal(sameDay(morning, evening), true);
  assert.equal(sameDay(morning, new Date(2026, 10, 18, 0, 5)), false);
});

test("the app shows the row, and hides it when it is empty", () => {
  const app = read("js/app.js");
  const html = read("index.html");
  assert.match(app, /from "\.\/ask-recent\.js\?v=\d+"/);
  assert.match(html, /id="ask-continue"/);
  assert.match(html, /id="ask-today"/);
  assert.match(app, /if \(!recent\.length\) \{\s*wrap\.hidden = true;/, "no empty row");
  assert.match(app, /today\.hidden = summary\.empty/, "no empty strip");
  // Tapping a chip fills the box and asks it, the same path a starting sentence takes.
  assert.match(app, /input\.value = item\.text;/);
  assert.match(app, /\$\("#ask-form"\)\?\.requestSubmit\(\)/);
});
