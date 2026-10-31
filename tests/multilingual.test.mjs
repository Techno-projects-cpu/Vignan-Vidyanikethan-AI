import test from "node:test";
import assert from "node:assert/strict";
import { tokenize, splitSentences } from "../js/text.js";
import { normalizeAnswer } from "../js/util.js";
import { buildBookIndex, retrieve, retrieveChapter } from "../js/retrieval.js";
import { generateQuiz, gradeQuiz } from "../js/quiz.js";
import { buildFlashcards } from "../js/flashcards.js";
import { normalizeSettings } from "../js/settings.js";
import { setLanguage, t } from "../js/i18n.js";
import { buildMessages } from "../js/llm.js";
import { parseWikipediaResults, wikipediaSearchUrl, searchWikipedia } from "../server/web-search.mjs";

const examples = [
  {
    language: "te", topic: "కిరణజన్య సంయోగక్రియ",
    text: "కిరణజన్య సంయోగక్రియ ద్వారా ఆకుపచ్చ మొక్కలు సూర్యకాంతి మరియు నీటిని ఉపయోగించి ఆహారాన్ని తయారు చేస్తాయి. ఈ ప్రక్రియలో కార్బన్ డయాక్సైడ్ ఉపయోగించి ఆక్సిజన్ గాలిలో విడుదల అవుతుంది.",
  },
  {
    language: "hi", topic: "प्रकाश संश्लेषण",
    text: "प्रकाश संश्लेषण की प्रक्रिया में हरे पौधे सूर्य के प्रकाश और पानी का उपयोग करके अपना भोजन बनाते हैं। इस प्रक्रिया से वातावरण में ऑक्सीजन भी मुक्त होती है।",
  },
];

test("Indic combining marks survive retrieval, sentence splitting, questions and grading", () => {
  for (const { language, topic, text } of examples) {
    assert.deepEqual(tokenize(topic), topic.split(" "));
    assert.equal(normalizeAnswer(topic), topic);
    assert.equal(splitSentences(text).length, 2);
    const index = buildBookIndex({ id: language, title: language }, [{ page: 7, text, heading: topic }]);
    assert.equal(index.book.indexVersion, 2);
    const found = retrieve(topic, [index]);
    assert.equal(found.grounded, true, language);
    assert.equal(found.hits[0].page, 7);
    const quiz = generateQuiz({ hits: found.hits, topic, count: 3, language });
    assert.ok(quiz.questions.length >= 1, language);
    assert.equal(quiz.questions[0].source.page, 7);
    const responses = Object.fromEntries(quiz.questions.map((question) => [question.id, question.answer]));
    assert.equal(gradeQuiz(quiz, responses).percent, 100);
    const cards = buildFlashcards(found.hits, 3, { language });
    assert.ok(cards.length >= 1, language);
    assert.match(cards[0].front, /________/);
    assert.equal(cards[0].source.page, 7);
  }
});

test("numbered chapter requests select only matching headings and never unrelated chapters", () => {
  const index = buildBookIndex({ id: "chapters", title: "Science" }, [
    { page: 1, heading: "Chapter 4: Plants", text: examples[0].text },
    { page: 2, heading: "Chapter 5: Forces", text: "Force can change the movement of an object and is measured in units called newtons." },
  ]);
  const found = retrieveChapter("chapter 4", [index]);
  assert.equal(found.hits.length, 1);
  assert.equal(found.hits[0].page, 1);
  assert.equal(retrieveChapter("chapter 6", [index]).hits.length, 0);
  assert.equal(retrieveChapter("chapter 4 dinosaurs", [index]).hits.length, 0);
});

test("language settings have a safe default, translated core labels and connected-model instructions", () => {
  assert.equal(normalizeSettings({ language: "hi" }).language, "hi");
  assert.equal(normalizeSettings({ language: "te" }).language, "te");
  assert.equal(normalizeSettings({ language: "xx" }).language, "en");
  for (const [language, expected] of [["hi", "पुस्तकालय"], ["te", "గ్రంథాలయం"]]) {
    setLanguage(language, { storage: null, root: null });
    assert.equal(t("nav.library"), expected);
    assert.match(t("settings.languageNote"), /Bolt/);
    const prompt = buildMessages({ query: "test", hits: [], language }).at(-1).content;
    assert.match(prompt, language === "hi" ? /Respond in Hindi/ : /Respond in Telugu/);
    assert.match(prompt, /cite \[n\]/);
  }
  setLanguage("en", { storage: null, root: null });
});

test("keyless Wikipedia search uses only allowlisted language hosts", async () => {
  assert.equal(new URL(wikipediaSearchUrl("प्रकाश", "hi")).hostname, "hi.wikipedia.org");
  assert.equal(new URL(wikipediaSearchUrl("ప్రకాశం", "te")).hostname, "te.wikipedia.org");
  assert.equal(new URL(wikipediaSearchUrl("x", "evil.example")).hostname, "en.wikipedia.org");
  const data = { query: { pages: [{ title: "परीक्षण", extract: "This is a sufficiently long public article excerpt for a test." }] } };
  assert.match(parseWikipediaResults(data, "hi")[0].url, /^https:\/\/hi\.wikipedia\.org\/wiki\//);
  let url = "";
  await searchWikipedia("test", { language: "te", fetchImpl: async (target) => {
    url = target;
    return new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
  } });
  assert.match(url, /^https:\/\/te\.wikipedia\.org\/w\/api\.php/);
});
