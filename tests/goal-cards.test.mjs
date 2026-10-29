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
  cardIndex,
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

test("a question is complete before it is tapped", () => {
  // The block is sent the moment it is clicked, so there can be no blank left for
  // the student to fill in afterwards, and no placeholder text.
  for (const card of promptCards()) {
    assert.ok(card.prompt.trim().split(/\s+/).length >= 18, `${card.id} is a detailed question, not a stub`);
    assert.doesNotMatch(card.prompt, /<[^>]+>|\byour answer\b|\.\.\.|…/, `${card.id} carries no blank to fill`);
    assert.ok(["answer", "explain", "summarize", "practice", "flashcards"].includes(card.mode), `${card.id} picks a real answer mode`);
  }
});

test("the blocks are numbered like a set", () => {
  assert.equal(cardIndex(0, 5), "01 / 05");
  assert.equal(cardIndex(4, 5), "05 / 05");
  assert.equal(cardIndex(8, 12), "09 / 12");
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
    const link = askLink(card, "https://example.org/app/?v=37");
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
  const goals = ask.indexOf('id="goal-stack"');
  assert.ok(goals > 0, "the empty Ask screen has a place for the sentences");
  assert.ok(goals < ask.indexOf('id="ask-form"'), "the sentences sit above the composer");
  assert.match(ask, /id="goal-heading"/);

  assert.match(html, /<div class="language-grid" id="language-grid" role="group"/);
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
  assert.match(app, /languageGlyphFor\(language\.code\)/, "the tile uses the board-unique glyph");
  assert.match(app, /language-glyph\$\{\[\.\.\.glyph\]\.length > 1 \? " wide" : ""\}/, "wider glyphs are marked so they fit");
  for (const rule of [".goal-card {", ".language-tile {", ".soon-badge {", "#view-ask.has-conversation .goal-cards"]) {
    assert.ok(css.includes(rule), `${rule} is styled`);
  }
  assert.match(css, /@media \(max-width: 560px\)[\s\S]*\.goal-card \{ min-height: 78px/);
  for (const key of ["goal.heading", "goal.lead", "soon.badge", "soon.title", "soon.button"]) {
    assert.ok(i18n.includes(`"${key}"`), `${key} is translatable`);
  }
});

test("tapping a block asks the question, and the tap is visible", () => {
  const openGoal = app.slice(app.indexOf("function openGoal("), app.indexOf("function applyLinkedQuestion("));
  assert.match(openGoal, /requestSubmit\(\)/, "a written question is sent, not parked in the box");
  assert.match(openGoal, /setMode\(card\.mode/, "the answer mode is set before sending");
  assert.match(openGoal, /goal-card-launching/, "the tapped block changes colour");
  assert.match(openGoal, /prefers-reduced-motion/, "and not for people who asked for less motion");
  assert.match(css, /@keyframes goal-launch/, "the colour change is defined");
  assert.match(openGoal, /setView\("quiz"\)/);
  assert.match(openGoal, /mode = "viva"/, "the viva block opens the viva, not the mock");
});

test("the blocks look like one object: square, joined, full width", () => {
  const block = css.slice(css.indexOf(".goal-cards {"), css.indexOf(".language-grid {"));
  assert.match(block, /border-radius: 0/, "sharp corners, not rounded cards");
  assert.match(block, /border-top: 1px solid var\(--line\); border-radius: 0/, "each row shares one 1px border");
  assert.match(block, /\.goal-card:first-child \{ border-top: 0; \}/, "the first row does not double the container border");
  assert.match(block, /min-height: 92px/, "the rows are big blocks: 92px before they stretch to fill the column");
  assert.match(block, /flex: 1 1 auto/, "each row stretches, so five rows always fill the panel");
  assert.match(block, /goal-card::after[\s\S]*?attr\(data-num\)/, "each row carries a large, faint number");
  assert.match(block, /grid-template-columns: 1fr auto/, "each row spans the column");
  assert.match(block, /\.goal-card:hover \{ background: var\(--brand-soft\)/, "hover changes colour");
  assert.match(block, /#view-ask:not\(\.has-conversation\) \.chat-suggestions \{ display: none; \}/, "the old chips never appear beside the blocks");
});
