import test from "node:test";
import assert from "node:assert/strict";
import { knowledgeAnswer, knowledgeFactAnswer, knowledgeTopicAnswer, QUICK_FACTS } from "../js/knowledge.js";
import { composeOutsideAnswer, composeWebAnswer } from "../js/external-answer.js";
import { setLanguage } from "../js/i18n.js";
import { composeGroundedAnswer } from "../js/answer.js";

const schoolQuestion = "tell me more about Vignan Vidyanikethan school";

test("questions about the school are answered instead of refused", () => {
  const answer = knowledgeTopicAnswer(schoolQuestion, "en");
  assert.ok(answer, "the school question is recognised");
  assert.match(answer.text, /English-medium school/i);
  assert.match(answer.text, /INSPIRE-MANAK/);
  assert.match(answer.text, /address|phone|fee/i, "unknown specifics are named, not invented");
  assert.match(answer.text, /not a textbook/i);
  assert.equal(answer.sources.length, 0);
  assert.equal(answer.grounded, false);
  assert.doesNotMatch(answer.text, /too complex|ask something easier/i);
});

test("the same school answer is written in Telugu and Hindi", () => {
  for (const [language, expected] of [["te", /విజ్ఞాన్ విద్యానికేతన్/], ["hi", /विद्यानिकेतन/]]) {
    const answer = knowledgeTopicAnswer(schoolQuestion, language);
    assert.match(answer.text, expected, language);
    assert.doesNotMatch(answer.text, /too complex/i);
  }
});

test("project, creator and how-to questions are answered from built-in knowledge", () => {
  const project = knowledgeTopicAnswer("what is Vignan AI and how does it work?", "en");
  assert.match(project.text, /orchestrator around existing AI/i);
  assert.match(project.text, /₹0|free/i);
  const howto = knowledgeTopicAnswer("how do I add a book?", "en");
  assert.match(howto.text, /Library/);
  assert.match(howto.text, /Flashcards/);
  assert.equal(knowledgeTopicAnswer("explain photosynthesis", "en"), null, "study topics go to the library first");
  assert.equal(knowledgeTopicAnswer("school of thought in philosophy", "en"), null);
});

test("evergreen quick facts are labelled, bounded and never claim to be a textbook", () => {
  const capital = knowledgeFactAnswer("what is the capital of india", "en");
  assert.match(capital.text, /New Delhi/);
  assert.match(capital.text, /not from your library/i);
  const boiling = knowledgeFactAnswer("what is the boiling point of water", "en");
  assert.match(boiling.text, /100 °C/);
  const multi = knowledgeFactAnswer("capital of india, capital of japan, capital of france", "en");
  assert.ok(multi.topics.length >= 1 && multi.topics.length <= 3, "a query quotes only its own facts");
  assert.ok(multi.text.split("\n").filter((line) => line.startsWith("- ")).length <= 3, "at most three facts are quoted");
  assert.equal(knowledgeFactAnswer("why is the sky blue", "en"), null);
  assert.ok(QUICK_FACTS.length >= 15);
  for (const fact of QUICK_FACTS) {
    assert.ok(fact.answer.length > 20, fact.keys.join("-"));
    assert.ok(fact.match instanceof RegExp);
  }
  assert.ok(knowledgeAnswer("what is dna", "en"));
});

test("inside-the-books answers still win over the quick-fact pack", () => {
  // composeGroundedAnswer is used when the library has a page; the app only
  // asks the fact pack after retrieval and web search both fail.
  const grounded = composeGroundedAnswer({
    query: "photosynthesis",
    hits: [{ bookId: "b", chunkId: "c", title: "Science", page: 12, text: "Green plants make food using sunlight in a process called photosynthesis." }],
    reason: "ok",
    confidence: 0.8,
  });
  assert.equal(grounded.grounded, true);
  assert.match(grounded.text, /Science, p\. 12/);
});

test("not-found messages stay honest, helpful and free of 'too complex' wording", () => {
  setLanguage("en", { storage: null, root: null });
  const english = composeGroundedAnswer({ query: "who won the 1994 world cup final", hits: [], reason: "not-in-books", webEnabled: false });
  assert.match(english.text, /could not find this in your textbooks/i);
  assert.match(english.text, /will not invent/i);
  assert.doesNotMatch(english.text, /too complex|ask something easier/i);
  setLanguage("hi", { storage: null, root: null });
  const hindi = composeGroundedAnswer({ query: "test", hits: [], reason: "not-in-books", webEnabled: true, language: "hi" });
  assert.match(hindi.text, /नहीं मिला/);
  setLanguage("en", { storage: null, root: null });
});

test("outside answers quote real source passages with W citations and a warning label", () => {
  const results = [{
    title: "Vignan Vidyanikethan English Medium High School",
    url: "https://example.org/school",
    domain: "example.org",
    snippet: "A short search snippet.",
    passage: "Vignan Vidyanikethan English Medium High School is an English-medium school. It runs science exhibitions for high-school students every year.",
    provider: "DuckDuckGo",
  }];
  const answer = composeOutsideAnswer({ query: "Vignan Vidyanikethan school", results, providers: ["DuckDuckGo"] });
  assert.match(answer.text, /outside your textbooks/i);
  assert.match(answer.text, /DuckDuckGo/);
  assert.match(answer.text, /English-medium school/);
  assert.match(answer.text, /\[W1\]/);
  assert.equal(answer.webSources.length, 1);
  assert.equal(answer.grounded, false);
  assert.equal(composeWebAnswer, composeOutsideAnswer);
  assert.equal(composeOutsideAnswer({ query: "what is photosynthesis", results: [{ title: "Maths", url: "https://example.org/m", snippet: "Addition and subtraction." }] }), null);
});
