import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  ASK_PARAM,
  GOAL_CARDS,
  MAX_LINKED_QUESTION,
  askFromUrl,
  askLink,
  goalCards,
  promptCards,
} from "../js/goal-cards.js";
import { languageGlyph, LANGUAGE_CATALOGUE } from "../js/languages.js";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(fileURLToPath(new URL(path, root)), "utf8");
const html = read("index.html");
const css = read("styles.css");
const app = read("js/app.js");
const i18n = read("js/i18n.js");

test("five starting sentences, each with a real destination", () => {
  assert.equal(GOAL_CARDS.length, 5);
  const ids = GOAL_CARDS.map((card) => card.id);
  assert.equal(new Set(ids).size, ids.length, "every card id is unique");
  for (const card of GOAL_CARDS) {
    assert.ok(card.icon.startsWith("i-"), `${card.id} points at an icon symbol`);
    assert.ok(card.title.length > 8, `${card.id} has a full sentence as its title`);
    assert.ok(card.note.length > 12, `${card.id} says what happens next`);
    const hasPrompt = typeof card.prompt === "string" && card.prompt.length > 20;
    const hasAction = typeof card.action === "string";
    assert.ok(hasPrompt !== hasAction, `${card.id} either asks or opens a tool, never both and never neither`);
  }
  // A card may only open a view that exists in this app.
  const actions = GOAL_CARDS.filter((card) => card.action).map((card) => card.action);
  assert.deepEqual(actions.sort(), ["quiz", "viva"]);
});

test("every written question can be answered from a cited page", () => {
  for (const card of promptCards()) {
    assert.match(card.prompt, /\bbook|page|chapter\b/i, `${card.id} asks for something grounded`);
  }
});

test("an empty library is explained, not hidden", () => {
  const full = goalCards({ hasBooks: true });
  assert.equal(full.length, 5);
  assert.ok(full.every((card) => !card.empty), "a stocked library needs no warning");

  const empty = goalCards({ hasBooks: false, starterReady: true });
  assert.equal(empty.length, 5, "the cards stay visible so the screen is never a dead end");
  assert.ok(empty.every((card) => card.empty));
  assert.match(empty[0].note, /starter pages/i);
  assert.match(goalCards({ hasBooks: false, starterReady: false })[0].note, /Library/);
});

test("a shared link fills the box, and only the box", () => {
  const question = "Mark my answer out of 10, please.";
  assert.equal(askFromUrl(`?${ASK_PARAM}=${encodeURIComponent(question)}`), question);
  assert.equal(askFromUrl(`?view=ask&${ASK_PARAM}=%20%20spaced%20%20out%20%20`), "spaced out");
  assert.equal(askFromUrl(""), "");
  assert.equal(askFromUrl("?view=quiz"), "");
  assert.equal(askFromUrl("?ask="), "");
  assert.equal(askFromUrl(`?ask=${"x".repeat(5000)}`).length, MAX_LINKED_QUESTION);
  // Control characters from an untrusted URL never reach the composer.
  assert.equal(askFromUrl("?ask=hello%00there%07now"), "hello there now");
});

test("a card can be shared as a link and read back unchanged", () => {
  for (const card of promptCards()) {
    const link = askLink(card, "https://example.org/app/?v=28");
    assert.ok(link.startsWith("https://example.org/app/?" + ASK_PARAM + "="), "query strings are not stacked");
    assert.equal(askFromUrl(link.slice(link.indexOf("?"))), card.prompt);
  }
  assert.equal(askLink({ action: "quiz" }), "", "a card with no sentence has nothing to share");
});

test("language tiles use the language's own script", () => {
  assert.equal(languageGlyph("English"), "E");
  assert.equal(languageGlyph("తెలుగు"), "త");
  assert.equal(languageGlyph("اردو"), "ا");
  assert.equal(languageGlyph("हिन्दी"), "ह");
  assert.equal(languageGlyph("   "), "•");
  assert.equal(languageGlyph(undefined), "•");
  // Every shipped language gets one visible character.
  for (const language of LANGUAGE_CATALOGUE) {
    const glyph = languageGlyph(language.native);
    assert.ok(glyph.length > 0 && glyph !== "•", `${language.code} has a glyph`);
    assert.equal([...glyph].length, 1, `${language.code} shows a single character, not half of one`);
  }
});

test("the page keeps the three parts the cards need", () => {
  const ask = html.slice(html.indexOf('id="view-ask"'), html.indexOf('id="view-library"'));
  const goals = ask.indexOf('id="goal-grid"');
  assert.ok(goals > 0, "the empty Ask screen has a place for the sentences");
  assert.ok(goals < ask.indexOf('id="ask-form"'), "the sentences sit above the composer");
  assert.match(ask, /id="goal-heading"/);

  assert.match(html, /<div class="language-grid" id="language-grid" role="radiogroup"/);
  assert.match(html, /<label class="language-select-row sr-only">[\s\S]*?<select id="settings-language">/);

  const soon = html.match(/<section class="card soon-card"[\s\S]*?<\/section>/);
  assert.ok(soon, "library has a coming-soon slot");
  assert.match(soon[0], /soon-badge/);
  assert.match(soon[0], /<button[^>]*disabled/, "the slot cannot be clicked, because it is not built");
  assert.match(soon[0], /publisher/i);
});

test("every card points at something that exists", () => {
  for (const card of GOAL_CARDS) {
    assert.ok(html.includes(`id="${card.icon}"`), `${card.id} uses a real icon symbol (${card.icon})`);
  }
  // The two cards that open a tool must land on a screen that is actually there.
  assert.match(html, /id="quiz-topic"/, "the quiz card has a field to focus");
  assert.match(html, /id="exam-panel"/, "the viva card has a panel to open");
  assert.ok(app.includes('function renderExamView('), "the viva card opens a view that renders");
});

test("the wiring, the styles and the words exist", () => {
  assert.match(app, /function renderGoalCards\(/);
  assert.match(app, /function openGoal\(/);
  assert.match(app, /function applyLinkedQuestion\(/);
  assert.match(app, /function renderLanguageGrid\(/);
  assert.match(app, /applyLinkedQuestion\(\);/, "a shared link is applied on boot");
  assert.match(app, /languageGlyph\(meta\.native\)/);
  for (const rule of [".goal-card {", ".language-tile {", ".soon-badge {", "#view-ask.has-conversation .goal-cards"]) {
    assert.ok(css.includes(rule), `${rule} is styled`);
  }
  assert.match(css, /@media \(max-width: 560px\)[\s\S]*\.goal-grid \{ grid-template-columns: 1fr; \}/);
  for (const key of ["goal.heading", "goal.lead", "soon.badge", "soon.title", "soon.button"]) {
    assert.ok(i18n.includes(`"${key}"`), `${key} is translatable`);
  }
});
