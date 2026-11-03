/**
 * Conversation context.
 *
 * The app answered every question as if it were the first one. "What is
 * photosynthesis?" followed by "why does it need sunlight?" produced an answer
 * about sunlight in general, because the second question never mentioned the
 * first. These tests hold the fix, and — just as importantly — hold the line
 * where context must *not* be invented: a new question that names its own
 * subject must never inherit an old topic.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  carryOverHits,
  contextChipLabel,
  conversationBrief,
  followUpSignal,
  isSmallTalk,
  lastTopic,
  resolveQuery,
} from "../js/memory.js";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const app = read("js/app.js");
const llm = read("js/llm.js");
const html = read("index.html");
const css = read("styles-next.css");

const HISTORY = [
  { role: "user", content: "What is photosynthesis?" },
  { role: "assistant", content: "Photosynthesis is how plants make food from sunlight [1]." },
  { role: "user", content: "Which chapter is that from?" },
  { role: "assistant", content: "It is in the chapter on plant nutrition [2]." },
];

test("a follow-up question carries the topic it is following", () => {
  const cases = [
    "why is it important?",
    "explain that again",
    "and the second one",
    "give me another example",
    "in simple words",
    "why?",
    "इसे और आसान करो",
  ];
  for (const query of cases) {
    const result = resolveQuery(query, HISTORY);
    assert.equal(result.usedContext, true, `${query} leans on the conversation`);
    assert.match(result.query, /photosynthesis/i, `${query} carries the topic forward`);
    assert.equal(result.topic, "What is photosynthesis?");
  }
});

test("a question that names its own subject never inherits the old one", () => {
  for (const query of [
    "What is 2 + 2?",
    "Explain the causes of the First World War",
    "How do I balance a chemical equation?",
    "What about chlorophyll?",
    "List the parts of a flower",
    "Explain photosynthesis in the sea",
  ]) {
    const result = resolveQuery(query, HISTORY);
    assert.equal(result.usedContext, false, `${query} is its own question`);
    assert.equal(result.query, query, `${query} is passed through unchanged`);
  }
});

test("greetings are not follow-ups, whatever came before them", () => {
  for (const query of ["hi", "thanks", "ok", "thank you", "good morning"]) {
    assert.equal(isSmallTalk(query), true, `${query} is small talk`);
    assert.equal(resolveQuery(query, HISTORY).usedContext, false, `${query} does not carry a topic`);
  }
  assert.equal(resolveQuery("ok", HISTORY).reason, "small-talk");
});

test("assistant text and greetings are never treated as the topic", () => {
  const onlyAssistant = [{ role: "assistant", content: "Photosynthesis is how plants make food." }];
  assert.equal(lastTopic(onlyAssistant).text, "");

  const greetingThenQuestion = [
    { role: "user", content: "hello" },
    { role: "user", content: "What is a cell?" },
  ];
  assert.equal(lastTopic(greetingThenQuestion).text, "What is a cell?");

  const link = [{ role: "user", content: "https://example.org/article" }];
  assert.equal(lastTopic(link).text, "", "a pasted link is not a topic");
});

test("the current question is not used as its own context", () => {
  // The chat appends the message before answering; the resolver must look past it.
  const withCurrent = [...HISTORY, { role: "user", content: "why is it important?" }];
  const result = resolveQuery("why is it important?", withCurrent);
  assert.equal(result.topic, "What is photosynthesis?");
  assert.doesNotMatch(result.query.split("What is photosynthesis?")[1] || "", /why is it important\?/);
});

test("the brief is short, ordered, and keeps the citation numbers", () => {
  const brief = conversationBrief(HISTORY);
  assert.equal(brief.count, 2);
  assert.match(brief.brief, /CONVERSATION SO FAR/);
  assert.match(brief.brief, /What is photosynthesis\?/);
  assert.match(brief.brief, /\[1\]/, "the citation survives, so the model does not invent a new page");
  // The second question ("which chapter is that from?") is itself a follow-up,
  // so the only topic in the brief is the question that had one of its own.
  assert.deepEqual(brief.topics, ["What is photosynthesis?"]);
  assert.match(brief.brief, /Which chapter is that from/, "the exchange is still in the brief");
  assert.ok(brief.brief.length < 1400, "the brief stays inside its budget");

  // A long answer is shortened, not dropped.
  const long = [
    { role: "user", content: "What is osmosis?" },
    { role: "assistant", content: "x".repeat(4000) },
  ];
  const shortened = conversationBrief(long);
  assert.ok(shortened.brief.length < 900);
  assert.match(shortened.brief, /What is osmosis\?/);

  assert.equal(conversationBrief([]).brief, "");
  assert.equal(conversationBrief([{ role: "user", content: "hi" }]).brief, "", "an unanswered question is not a turn");
});

test("chat pleasantries are kept out of the context block", () => {
  const messages = [
    { role: "user", content: "hello" },
    { role: "assistant", content: "Hello! What are we studying?", meta: "Bolt · conversation" },
    { role: "user", content: "What is a nucleus?" },
    { role: "assistant", content: "The nucleus controls the cell [1]." },
  ];
  const brief = conversationBrief(messages);
  assert.equal(brief.count, 1);
  assert.match(brief.brief, /nucleus/);
  assert.doesNotMatch(brief.brief, /What are we studying/);
});

test("the composer says which topic a follow-up will be read against", () => {
  assert.equal(contextChipLabel("why is that so?", HISTORY), "Continuing: What is photosynthesis?");
  assert.equal(contextChipLabel("What is 2 + 2?", HISTORY), "", "a new question shows no chip");
  assert.equal(contextChipLabel("", HISTORY), "");
  assert.equal(contextChipLabel("and why?", []), "", "nothing to continue from");
  // A very long topic is shortened rather than pushing the box off the screen.
  const long = [{ role: "user", content: "Explain the difference between aerobic and anaerobic respiration in detail please" }];
  assert.ok(contextChipLabel("why?", long).length < 60);
});

test("carried-over pages keep their title and page number", () => {
  const hits = [
    { title: "Biology", page: 42, text: "Chlorophyll absorbs light." },
    { title: "Biology", page: 43, text: "" },
    { text: "x".repeat(2000) },
  ];
  const carried = carryOverHits(hits);
  assert.equal(carried.length, 2, "a hit with no text is not carried");
  assert.equal(carried[0].page, 42);
  assert.equal(carried[0].title, "Biology");
  assert.ok(carried[1].text.length <= 900, "carried text is bounded");
  assert.deepEqual(carryOverHits(null), []);
});

test("the app and the model call both use it", () => {
  // The chat resolves through the new rules rather than the old helper.
  assert.match(app, /import \{ carryOverHits, contextChipLabel, conversationBrief, resolveQuery \} from "\.\/memory\.js\?v=\d+";/);
  assert.match(app, /const resolved = resolveQuery\(query, history\);/);
  assert.match(app, /const effectiveQuery = resolved\.query;/);
  assert.match(app, /memory: conversationBrief\(history\)\.brief/);
  // A follow-up that finds nothing new continues from the pages just cited.
  assert.match(app, /hits = carryOverHits\(state\.lastHits\);/);
  assert.match(app, /state\.lastHits = answer\.sources\?\.length/);
  // The model is told what the conversation was, in one block.
  assert.match(llm, /memory = "" \}\) \{/);
  assert.match(llm, /const brief = memory \? `\$\{truncate\(memory, 1400\)\}/);
  assert.match(llm, /leans on the conversation/);
  // The chip exists, is announced politely, and is hidden until it has something to say.
  assert.match(html, /<p class="composer-context" id="composer-context" hidden aria-live="polite"><\/p>/);
  assert.match(app, /chip\.textContent = label;\s*\n\s*chip\.hidden = !label;/);
  assert.match(css, /\.composer-context \{[^}]*text-overflow: ellipsis;/);
});
