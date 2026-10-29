/**
 * Pro Mode, answer depth and citation honesty.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  PRO_TRIGGER, matchesActivation, matchesPowerDown, matchesStatusQuery,
  proBootLines, proBriefing, proStatusReport, splitActivation,
} from "../js/pro-mode.js";
import {
  citationCoverage, depthDirective, followUpsFor, looksUncited, normalizeDepth,
} from "../js/answer-quality.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8");

test("the easter egg phrase activates, with punctuation or not", () => {
  for (const line of [
    PRO_TRIGGER,
    "hi, i am nezaad, from nezaad industries",
    "Hi I'm Nezaad from Nezaad Industries!",
    "  HELLO, THIS IS NEZAAD FROM NEZAAD INDUSTRIES.  ",
    "hey nezaad from nezaad industries",
  ]) {
    assert.equal(matchesActivation(line), true, line);
  }
});

test("asking about the company is not activation", () => {
  for (const line of [
    "What is Nezaad Industries?",
    "Tell me about Nezaad Industries and who founded it",
    "Is Nezaad Industries a company from Guntur?",
    "key terms of nezaad industries",
    "",
  ]) {
    assert.equal(matchesActivation(line), false, line);
  }
});

test("power down and status report are recognised only in Pro Mode wording", () => {
  assert.equal(matchesPowerDown("power down"), true);
  assert.equal(matchesPowerDown("Power down, please."), true);
  assert.equal(matchesStatusQuery("status report"), true);
  assert.equal(matchesStatusQuery("run diagnostics"), true);
  assert.equal(matchesPowerDown("how do I power down a phone battery?"), false);
});

test("the boot sequence and briefing report real numbers", () => {
  const status = { books: 2, pages: 140, dueCards: 6, decks: 3, streaks: 4, offline: true, model: "local engine" };
  const lines = proBootLines(status);
  assert.ok(lines.length >= 6);
  assert.ok(lines.some((line) => line.includes("2 books")));
  assert.ok(lines.some((line) => line.includes("140 pages")));
  assert.ok(lines.some((line) => line.includes("6 cards due")));
  assert.ok(lines.some((line) => line.includes("offline engine")));
  assert.equal(lines.at(-1), "> PRO MODE");

  const brief = proBriefing(status);
  assert.match(brief, /Pro Mode engaged/);
  assert.match(brief, /Library: 2 books, 140 pages searchable/);
  assert.match(brief, /V\*\*irtual/);
  assert.match(brief, /status report/);
  assert.match(brief, /power down/);
  assert.match(brief, /school project, not a film prop/);

  const report = proStatusReport({ ...status, quizzes: 5, accuracy: 80 });
  assert.match(report, /Books indexed: \*\*2\*\*/);
  assert.match(report, /accuracy: \*\*80%\*\*/);
  assert.match(report, /All systems nominal/);
  // With no books it asks for one instead of pretending.
  assert.match(proStatusReport({ books: 0 }), /add a chapter in Library/);
});

test("answer length maps to a prompt directive and never to a stray value", () => {
  assert.equal(normalizeDepth("exam"), "exam");
  assert.equal(normalizeDepth("nonsense"), "balanced");
  assert.equal(normalizeDepth(undefined), "balanced");
  assert.match(depthDirective("brief"), /80 words/);
  assert.match(depthDirective("balanced"), /110-180 words/);
  const exam = depthDirective("exam");
  for (const part of ["Definition", "Key points", "Examiner note", "Do not add facts"]) {
    assert.match(exam, new RegExp(part));
  }
});

test("citation coverage spots an answer that stopped citing pages", () => {
  const good = "Plants use light [1]. Chlorophyll absorbs it [1]. The equation is shown on the page [2]. Glucose is stored as starch [2].";
  const bad = "Plants use light to make food. The green pigment absorbs the light. Sugar is stored in the plant. This happens in the leaf.";
  assert.equal(citationCoverage(good).ratio, 1);
  assert.equal(citationCoverage(bad).ratio, 0);
  assert.equal(looksUncited(good), false);
  assert.equal(looksUncited(bad), true);
  assert.equal(looksUncited(bad, { minimumSentences: 10 }), false, "short answers are exempt");
});

test("follow-up chips only offer things the app can do", () => {
  const chips = followUpsFor({ query: "Explain photosynthesis", hits: [{ page: 12 }] });
  assert.deepEqual(chips.map((chip) => chip.id), ["explain", "exam", "sheet"]);
  assert.equal(chips[0].prompt, "Explain step by step: photosynthesis");

  const withSheet = followUpsFor({ query: "photosynthesis", hits: [{ page: 1 }], hasSheet: true });
  assert.ok(!withSheet.some((chip) => chip.id === "sheet"));

  const ungrounded = followUpsFor({ query: "photosynthesis", hits: [] });
  assert.ok(!ungrounded.some((chip) => chip.id === "quiz"), "no quiz without pages to cite");

  const exam = followUpsFor({ query: "photosynthesis", hits: [{ page: 1 }], depth: "exam" });
  assert.ok(!exam.some((chip) => chip.id === "explain"), "already an exam answer");
});

test("the chrome exists and both modules are offline", () => {
  const html = read("/index.html");
  for (const id of ["pro-overlay", "pro-console", "pro-title", "pro-skip", "pro-chip", "depth-row"]) {
    assert.match(html, new RegExp(`id="${id}"`), id);
  }
  const app = read("/js/app.js");
  assert.match(app, /matchesActivation\(query\)/);
  assert.match(app, /engageProMode/);
  assert.match(app, /disengageProMode/);
  assert.match(app, /setProChrome\(Boolean\(state\.settings\.pro\)\)/);
  assert.match(app, /depth: settings\?\.answerDepth|answerDepth/);
  assert.match(app, /looksUncited\(model\.content\)/);
  const sw = read("/sw.js");
  for (const module of ["pro-mode.js", "pro-ui.js", "answer-quality.js"]) {
    assert.match(sw, new RegExp(`\\./js/${module.replace(".", "\\.")}\\?v=32`), module);
  }
  assert.match(sw, /\.\/styles-pro\.css\?v=32/);
});

test("the depth directive actually reaches the model prompt", async () => {
  const { buildMessages } = await import("../js/llm.js");
  const hits = [{ title: "Science", page: 12, text: "Photosynthesis is the process by which plants make food." }];
  const exam = buildMessages({ query: "photosynthesis", hits, depth: "exam" }).at(-1).content;
  assert.match(exam, /Examiner note/);
  assert.match(exam, /180-260 words/);
  const brief = buildMessages({ query: "photosynthesis", hits, depth: "brief" }).at(-1).content;
  assert.match(brief, /80 words/);
  const fallback = buildMessages({ query: "photosynthesis", hits, depth: "nonsense" }).at(-1).content;
  assert.match(fallback, /110-180 words/, "an unknown depth falls back to balanced");
  // The citation contract survives the new instructions.
  assert.match(exam, /cite \[n\]/i);
  assert.match(exam, /LIBRARY PASSAGES/);
});

test("the system prompt keeps the honesty rules", async () => {
  const { SYSTEM_PROMPT } = await import("../js/context.js");
  assert.match(SYSTEM_PROMPT, /only part of the question/);
  assert.match(SYSTEM_PROMPT, /never reply that a question is "too complex"/);
  assert.match(SYSTEM_PROMPT, /never invent a page number/i);
});

test("follow-up topics shed the request wording", () => {
  const chips = followUpsFor({ query: "key terms of nutrition in plants", hits: [{ page: 1 }], hasSheet: true });
  assert.equal(chips[0].prompt, "Explain step by step: nutrition in plants");
});

test("any way of saying I am Nezaad activates, not just one sentence", () => {
  for (const line of [
    "I am Nezaad",
    "i am nezaad",
    "I'm Nezaad",
    "this is Nezaad",
    "my name is Nezaad",
    "Nezaad here",
    "Nezaad speaking",
    "you are talking to Nezaad",
    "it's me, Nezaad",
    "call me Nezaad",
    "I am Nezaad and I built this",
    "hello everyone, I am Nezaad, good to meet you",
    "main Nezaad hoon",
    "mera naam Nezaad hai",
    "nenu Nezaad",
    "I am Nezad",
    "I AM NEZAAD!!!",
  ]) {
    assert.equal(matchesActivation(line), true, line);
  }
});

test("a question about the name or the company is still just a question", () => {
  for (const line of [
    "What is Nezaad Industries?",
    "Tell me about Nezaad Industries and who founded it",
    "Is Nezaad Industries a company from Guntur?",
    "key terms of nezaad industries",
    "who is nezaad",
    "I am preparing for the Nezaad Industries quiz",
    "search nezaad industries",
    "hi",
    "",
  ]) {
    assert.equal(matchesActivation(line), false, line);
  }
});

test("an introduction plus a question does both", () => {
  assert.deepEqual(splitActivation("I am Nezaad").question, "");
  assert.deepEqual(splitActivation("Hi, I am Nezaad, nice to meet you").question, "");
  assert.equal(splitActivation("I am Nezaad, explain photosynthesis").question, "explain photosynthesis");
  assert.equal(
    splitActivation("Hello, this is Nezaad from Nezaad Industries. What is osmosis?").question,
    "What is osmosis?",
  );
  assert.equal(splitActivation("I am Nezaad").activated, true);
  assert.equal(splitActivation("What is Nezaad Industries?").activated, false);
});

test("the activation sequence has four beats and stays skippable", () => {
  const html = read("/index.html");
  for (const id of ["pro-kicker", "pro-meter", "pro-console", "pro-title", "pro-skip"]) {
    assert.match(html, new RegExp(`id="${id}"`), id);
  }
  for (const part of ["pro-reticle", "pro-wedge", "pro-needle", "pro-bracket", "pro-scanline", "pro-flash"]) {
    assert.match(html, new RegExp(`class="[^"]*${part}`), part);
  }
  const ui = read("/js/pro-ui.js");
  assert.match(ui, /pro-locked/, "the lock-on beat should be a state, not a guess");
  assert.match(ui, /pro-letter/, "the title should assemble from letters");
  assert.match(ui, /phaseLabel/, "each line should drive a phase label");
  assert.match(ui, /clearInterval/, "typing timers must be cancellable");
  assert.match(ui, /reducedMotion/, "reduced motion must be honoured");
  assert.match(ui, /return done;/, "the sequence must resolve a promise");
});

test("the animation is CSS-only, grayscale-safe, and calms down for reduced motion", () => {
  const css = read("/styles-pro.css");
  assert.match(css, /@keyframes pro-letter-in/);
  assert.match(css, /@keyframes pro-flash/);
  assert.match(css, /@keyframes pro-scan/);
  assert.match(css, /@keyframes pro-aurora/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  const reduced = css.slice(css.indexOf("prefers-reduced-motion"));
  for (const part of ["pro-wedge", "pro-scanline", "pro-flash", "pro-letter"]) {
    assert.match(reduced, new RegExp(part), `${part} should be stilled`);
  }
});
