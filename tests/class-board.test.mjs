/**
 * The class board: the same friendships, in the order a class actually reads.
 *
 * The Friends tab answers "who is here"; this one answers "where am I in my
 * class this week", using only the streaks and points each classmate's own
 * device already reported. These tests hold the two promises that make it
 * safe to show: the student is placed in their own class, and nothing about
 * anybody's marks or books is on it.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (path) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), "utf8");
const friends = read("js/friends-ui.js");
const css = read("styles-social.css");

test("the class is a tab, not a hidden screen", () => {
  assert.match(friends, /const TABS = \["friends", "class", "requests", "find", "alerts"\]/);
  assert.match(friends, /if \(activeTab === "class"\) renderClassTab\(body, data\)/);
  assert.match(friends, /class: "Class",/, "the tab has a label");
});

test("the student is in their own class, and marked as themselves", () => {
  assert.match(friends, /\{ username: me\.username \|\| "You", streak: Number\(me\.streak\) \|\| 0/, "the signed-in student is a row");
  assert.match(friends, /class-row\$\{row\.self \? " is-me" : ""\}/, "their row is marked");
  assert.match(friends, /row\.self \? `\$\{row\.username\} \(you\)`/, "and labelled, not left ambiguous");
  assert.match(css, /\.class-row\.is-me \{/, "the mark is a surface, not a medal");
});

test("the order is the one that means something at the end of a week", () => {
  assert.match(friends, /\.sort\(\(a, b\) => b\.streak - a\.streak \|\| b\.xp - a\.xp/, "longest streak first, then points");
});

test("it adds a view, not a second game", () => {
  assert.match(friends, /button\("Challenge", "button ghost small", \(\) => openChat\(\{ friendId: row\.id, play: true \}\)/);
  // The duel the app already has: the same event Friends' Play button raises.
  assert.match(friends, /const openChat = \(detail\) => window\.dispatchEvent\(new CustomEvent\("vignan:open-chat", \{ detail \}\)\);/);
});

test("it shares streaks and points, and says what it does not share", () => {
  const hint = /Streaks are reported by each student's own device when they study\. Nothing about their marks is shared\./;
  assert.match(friends, hint);
  // No mark, answer or book title may reach this tab.
  const block = friends.slice(friends.indexOf("function renderClassTab"), friends.indexOf("function renderRequestsTab"));
  for (const forbidden of ["answers", "marks.", "bookTitle", "results", "quizScore"]) {
    assert.ok(!block.includes(forbidden), `the class board does not touch ${forbidden}`);
  }
});

test("the board is drawn with hairlines, not medals", () => {
  const block = css.slice(css.indexOf(".class-board {"));
  assert.ok(block.length > 200, "the board has real styles");
  assert.doesNotMatch(block, /border-radius:\s*(?!0)/, "no rounded corners");
  assert.doesNotMatch(block, /box-shadow:/, "no shadow");
  assert.doesNotMatch(block, /gradient|gold|silver|bronze|🥇|🏆/, "no medals, no gradients");
  assert.match(block, /border-bottom: 1px solid var\(--p-line\)/, "rows share the app's hairline");
});
