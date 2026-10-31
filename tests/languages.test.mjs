import test from "node:test";
import assert from "node:assert/strict";
import {
  LANGUAGE_CATALOGUE,
  LANGUAGE_CODES,
  isRtlLanguage,
  languageLabel,
  languageGroups,
  wikipediaLanguage,
} from "../js/languages.js";
import { CORE_STRINGS } from "../js/translations-core.js";
import { LANGUAGES, LANGUAGE_NAMES, setLanguage, t, applyLanguageDirection, languageName } from "../js/i18n.js";
import { normalizeSettings } from "../js/settings.js";
import { buildMessages, buildOutsideMessages } from "../js/llm.js";

const REQUIRED_INDIAN = ["hi", "bn", "mr", "te", "ta", "gu", "kn", "ml", "pa", "or", "as", "ur", "ne"];
const REQUIRED_WORLD = ["fr", "de", "es", "ru", "ar", "zh", "ja", "ko", "pt", "it", "tr", "id", "fa", "sw"];

test("the catalogue covers the major Indian languages, Urdu and the world languages students asked for", () => {
  for (const code of ["en", ...REQUIRED_INDIAN, ...REQUIRED_WORLD]) {
    assert.ok(LANGUAGE_CODES.includes(code), `${code} is offered`);
  }
  assert.equal(new Set(LANGUAGE_CODES).size, LANGUAGE_CODES.length, "no duplicate language codes");
  assert.ok(LANGUAGE_CODES.length >= 30, "at least thirty languages");
  const indian = LANGUAGE_CATALOGUE.filter((language) => language.group === "indian").map((language) => language.code);
  assert.ok(indian.includes("ur"), "Urdu is listed with the Indian languages");
  assert.ok(indian.includes("as") && indian.includes("or") && indian.includes("ne"));
  for (const language of LANGUAGE_CATALOGUE) {
    assert.match(language.code, /^[a-z]{2}$/);
    assert.ok(language.native && language.name, `${language.code} has names`);
  }
});

test("every language ships the same core strings, with English as a guaranteed fallback", () => {
  const core = Object.keys(CORE_STRINGS.en);
  assert.ok(core.length >= 45);
  for (const code of LANGUAGE_CODES) {
    const dictionary = CORE_STRINGS[code];
    assert.ok(dictionary, `${code} has a dictionary`);
    assert.deepEqual(Object.keys(dictionary).sort(), [...core].sort(), `${code} covers exactly the core keys`);
    for (const value of Object.values(dictionary)) assert.ok(String(value).trim().length > 0, `${code} has no blank labels`);
  }
  setLanguage("ta", { storage: null, root: null });
  assert.equal(t("nav.library"), "நூலகம்");
  assert.equal(t("settings.helpTitle"), "How this works", "untranslated long text falls back to English");
  setLanguage("hi", { storage: null, root: null });
  assert.equal(t("nav.library"), "पुस्तकालय");
  setLanguage("en", { storage: null, root: null });
});

test("right-to-left languages switch the document direction and keep names intact", () => {
  for (const code of ["ur", "ar", "fa"]) assert.equal(isRtlLanguage(code), true, code);
  for (const code of ["hi", "te", "fr", "zh", "sw"]) assert.equal(isRtlLanguage(code), false, code);
  const root = { documentElement: { lang: "", dir: "" } };
  setLanguage("ur", { storage: null, root });
  assert.equal(root.documentElement.lang, "ur");
  assert.equal(root.documentElement.dir, "rtl");
  assert.equal(LANGUAGE_NAMES.ur, "اردو");
  assert.equal(languageLabel("ur"), "\u2068اردو\u2069 — Urdu");
  assert.equal(languageLabel("ta"), "தமிழ் — Tamil");
  assert.equal(languageLabel("en"), "English");
  setLanguage("ja", { storage: null, root });
  assert.equal(root.documentElement.dir, "ltr");
  applyLanguageDirection(null);
  setLanguage("en", { storage: null, root });
});

test("the picker groups Indian and world languages and settings accept every code", () => {
  const groups = languageGroups();
  assert.equal(groups.length, 2);
  assert.ok(groups[0].languages.length >= 14);
  assert.ok(groups[1].languages.length >= 15);
  assert.equal(groups[0].languages[0].code, "en");
  for (const code of LANGUAGE_CODES) assert.equal(normalizeSettings({ language: code }).language, code, code);
  assert.equal(normalizeSettings({ language: "klingon" }).language, "en");
  assert.equal(normalizeSettings({ language: undefined }).language, "en");
});

test("web search follows the interface language where an edition exists", () => {
  assert.equal(wikipediaLanguage("hi"), "hi");
  assert.equal(wikipediaLanguage("te"), "te");
  assert.equal(wikipediaLanguage("ur"), "ur");
  assert.equal(wikipediaLanguage("sw"), "sw");
  assert.equal(wikipediaLanguage("xx"), "en");
  assert.equal(wikipediaLanguage(""), "en");
  assert.equal(languageName("bn"), "Bengali");
  assert.equal(languageName("bn", { native: true }), "বাংলা");
});

test("connected models are told to answer in the chosen language, including long-tail languages", () => {
  const instruction = (code) => buildMessages({ query: "test", hits: [], language: code }).at(-1).content;
  assert.match(instruction("hi"), /Respond in Hindi \(हिन्दी\)/);
  assert.match(instruction("te"), /Respond in Telugu/);
  assert.match(instruction("bn"), /Respond in Bengali \(বাংলা\)/);
  assert.match(instruction("ur"), /Respond in Urdu \(اردو\)/);
  assert.match(instruction("fr"), /Respond in French/);
  assert.match(instruction("zh"), /Respond in Chinese/);
  assert.match(instruction("en"), /Respond in English/);
  const outside = buildOutsideMessages({
    query: "what is this place",
    results: [{ title: "Source", url: "https://example.org", domain: "example.org", passage: "Some readable passage about the place." }],
    language: "ta",
  });
  assert.match(outside.at(-1).content, /Respond in Tamil/);
  assert.match(outside[0].content, /too complex/, "the outside prompt forbids dismissing questions");
  assert.match(outside.at(-1).content, /\[W1\]/);
  assert.ok(Object.keys(LANGUAGES).length >= 30);
});

test("short conversational replies and the safety message exist in every language", async () => {
  const { LOCALE_REPLIES } = await import("../js/replies.js");
  const { conversationReply, safetyReply, casualReply, creatorAnswer } = await import("../js/conversation.js");
  for (const code of LANGUAGE_CODES) {
    const entry = LOCALE_REPLIES[code];
    assert.ok(entry, `${code} has local replies`);
    for (const key of ["greeting", "thanks", "identity", "safety", "mood"]) {
      // CJK and Thai lines are short but complete.
      assert.ok(entry[key] && entry[key].trim().length >= 6, `${code}.${key}`);
    }
    const greeting = conversationReply("hello", code);
    assert.ok(greeting && greeting !== conversationReply("hello", "en") || code === "en", `${code} greeting is localised`);
    const safety = safetyReply("I want to die", code);
    // Urdu uses ۔, Thai has no full stop; every other script ends with a stop.
    if (code === "th") assert.ok(safety.length > 60);
    else assert.match(safety, /[.!?।؟۔。]$/, `${code} safety message is a sentence`);
    assert.ok(safety.length > 60, `${code} safety message is complete`);
    assert.ok(casualReply("I feel lonely", code, 0).length > 20, `${code} supportive reply`);
    assert.ok(conversationReply("who are you", code).includes(creatorAnswer(code).slice(0, 20)) || code !== "en", `${code} identity reply`);
  }
  assert.notEqual(safetyReply("I want to die", "ja"), safetyReply("I want to die", "en"));
  assert.notEqual(conversationReply("hello", "fr"), conversationReply("hello", "en"));
  assert.equal(safetyReply("what is photosynthesis", "ja"), "", "non-safety questions are untouched");
});

test("quiz and flashcard question copy follows the chosen language", async () => {
  const { questionCopy, QUESTION_COPY } = await import("../js/question-copy.js");
  const { generateQuiz } = await import("../js/quiz.js");
  const { buildFlashcards } = await import("../js/flashcards.js");
  for (const code of LANGUAGE_CODES) {
    const copy = questionCopy(code);
    for (const key of ["fill", "choose", "whatIs", "complete"]) assert.ok(copy[key] && copy[key].length > 1, `${code}.${key}`);
    assert.ok(QUESTION_COPY[code], `${code} has its own copy`);
  }
  const hits = [{ text: "Photosynthesis is the process by which green plants make food using sunlight and chlorophyll.", title: "Plants", section: "Nutrition in Plants", page: 12, score: 1 }];
  for (const code of ["ja", "ta", "ur", "de"]) {
    const quiz = generateQuiz({ hits, count: 2, language: code }).questions;
    for (const question of quiz) assert.ok(question.prompt && !question.prompt.startsWith("undefined"), `${code} prompt`);
    const cards = buildFlashcards(hits, 2, { language: code });
    for (const card of cards) assert.ok(card.front && !card.front.startsWith("undefined"), `${code} card`);
  }
  assert.match(generateQuiz({ hits, count: 2, language: "ja" }).questions[0].prompt, /[\u3040-\u30ff]/);
});

test("no question scaffolding falls back to English by accident", async () => {
  const { questionCopy } = await import("../js/question-copy.js");
  const english = questionCopy("en");
  for (const code of LANGUAGE_CODES.filter((value) => value !== "en")) {
    const copy = questionCopy(code);
    assert.notDeepEqual(copy, english, `${code} is translated`);
  }
});
