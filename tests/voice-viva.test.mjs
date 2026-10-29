/**
 * Voice and the viva examiner.
 *
 * Both features are optional conveniences wrapped around the same grounded
 * questions, so the rules that matter are: a browser without speech still gets
 * a working lesson, what is read aloud is actually speakable, and a viva mark
 * can be checked by hand from the page it cites.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  availableVoices, listenMessage, listenOnce, plainSpeech, selectVoice, speakText,
  speechLanguage, stopSpeaking, voiceSupport,
} from "../js/voice.js";
import {
  VIVA_MARKS, examinerLine, nameMisconception, probeFor, vivaQuestions, vivaReport,
} from "../js/viva.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8");

const question = {
  type: "short",
  prompt: "Explain what the second law of motion says about force and acceleration.",
  topic: "Laws of Motion",
  answer: "force equals mass times acceleration",
  source: {
    title: "Starter Physics",
    page: 3,
    quote: "The second law states that force equals the rate of change of momentum, which for constant mass becomes force equals mass times acceleration.",
  },
};

test("what is read aloud is speakable, not markdown", () => {
  const answer = "**From your library** — see _(Starter Physics, p. 3)_ [1]\n\n- `F = ma` with [2] citations";
  const spoken = plainSpeech(answer);
  assert.doesNotMatch(spoken, /\*\*|\[1\]|\[2\]|`/);
  assert.match(spoken, /From your library/);
  assert.match(spoken, /page 3/, "a page reference is spoken as words");
  assert.equal(plainSpeech(""), "");
  assert.equal(plainSpeech("   "), "");
  assert.match(plainSpeech("## Heading\ntext"), /^Heading/);
  assert.match(plainSpeech("a  b"), /^a b$/, "double spaces collapse");
});

test("a voice is chosen for the language being read, and any voice beats none", () => {
  const voices = [
    { name: "English", lang: "en-US" },
    { name: "Hindi", lang: "hi-IN" },
    { name: "Telugu", lang: "te_IN" },
    { name: "Default", lang: "fr-FR", default: true },
  ];
  assert.equal(selectVoice(voices, "hi-IN").name, "Hindi");
  assert.equal(selectVoice(voices, "te-IN").name, "Telugu", "an underscore tag still matches");
  assert.equal(selectVoice(voices, "en-GB").name, "English", "the language matches even when the region does not");
  assert.equal(selectVoice(voices, "xx-XX").name, "Default");
  assert.equal(selectVoice([], "en-IN"), null);
  assert.equal(selectVoice(null, "en-IN"), null);

  assert.equal(speechLanguage("hi"), "hi-IN");
  assert.equal(speechLanguage("ur"), "ur-PK");
  assert.equal(speechLanguage("en"), "en-IN", "Indian English by default");
  assert.equal(speechLanguage("unknown"), "un", "an unknown code degrades, never throws");
});

test("a browser without speech still gets the whole lesson", () => {
  const none = voiceSupport({ online: true });
  assert.equal(none.speak, false);
  assert.equal(none.listen, false);
  assert.match(none.reason, /type|typing/i);
  assert.equal(speakText("hello", { synth: null }).ok, false);

  const speaking = voiceSupport({ speechSynthesis: { speak() {}, cancel() {}, getVoices: () => [] }, online: true });
  assert.equal(speaking.speak, true);
  assert.equal(speaking.listen, false);
  assert.match(speaking.reason, /type/i);

  const offline = voiceSupport({ speechSynthesis: { speak() {}, cancel() {}, getVoices: () => [] }, SpeechRecognition: function R() {}, online: false });
  assert.equal(offline.listen, true);
  assert.match(offline.reason, /connection/i, "listening offline is explained, not hidden");
  assert.deepEqual(availableVoices({ getVoices: () => [{ lang: "en-IN" }] }), [{ lang: "en-IN" }]);
  assert.deepEqual(availableVoices({ getVoices: () => { throw new Error("nope"); } }), []);
  stopSpeaking(null);
});

test("speaking uses the chosen voice and cancels the previous sentence", () => {
  const spoken = [];
  let cancelled = 0;
  const synth = { speak: (utterance) => spoken.push(utterance), cancel: () => { cancelled += 1; }, getVoices: () => [] };
  globalThis.SpeechSynthesisUtterance = function SpeechSynthesisUtterance(text) { this.text = text; };
  const result = speakText("**Page** p. 3 says hello", { synth, voices: [{ name: "Hindi", lang: "hi-IN" }], language: "hi-IN" });
  assert.equal(result.ok, true);
  assert.equal(cancelled, 1, "the previous answer stops before a new one starts");
  assert.equal(spoken[0].text, "Page page 3 says hello");
  assert.equal(spoken[0].lang, "hi-IN");
  assert.equal(result.spoken, "Page page 3 says hello");
  assert.equal(speakText("   ", { synth }).ok, false, "nothing to say is not an error");
  delete globalThis.SpeechSynthesisUtterance;
  assert.equal(speakText("hello", { synth }).ok, false, "no utterance constructor, no crash");
});

test("listening resolves with the words, or with a reason a student can act on", async () => {
  const makeRecognition = (behaviour) => function Recognition() {
    this.start = () => behaviour(this);
    this.stop = () => {};
  };
  globalThis.SpeechSynthesisUtterance = globalThis.SpeechSynthesisUtterance || function () {};

  const good = await listenOnce({
    recognition: new (makeRecognition((self) => {
      self.onresult({ results: [{ isFinal: true, 0: { transcript: "force equals mass times acceleration" } }] });
    }))(),
  });
  assert.equal(good.text, "force equals mass times acceleration");
  assert.equal(good.error, "");

  const denied = await listenOnce({
    recognition: new (makeRecognition((self) => self.onerror({ error: "not-allowed" })))(),
  });
  assert.equal(denied.text, "");
  assert.equal(denied.error, "not-allowed");
  assert.match(listenMessage("denied"), /refused/i);

  const silent = await listenOnce({ recognition: new (makeRecognition((self) => self.onend()))() });
  assert.equal(silent.error, "no-speech");
  assert.match(listenMessage("no-speech"), /did not hear/i);

  const missing = await listenOnce({ recognition: null });
  assert.equal(missing.error, "unsupported");
  assert.match(listenMessage("timeout"), /too long/i);
  assert.match(listenMessage("network"), /connection/i);
  assert.match(listenMessage("nonsense"), /type the answer/i);
});

test("the examiner asks about a chapter, in words that come from the page", () => {
  const planned = vivaQuestions([question, { ...question, prompt: "Second" }, { ...question, prompt: "Third" }], 2);
  assert.equal(planned.length, 2);
  assert.equal(planned[0].vivaIndex, 0);
  assert.match(examinerLine(question), /^Examiner on Laws of Motion: /);
  assert.match(examinerLine(question), /second law of motion/);
  assert.match(examinerLine({ prompt: "What is a cell?" }), /^Examiner: /);
  assert.deepEqual(vivaQuestions([], 5), []);
});

test("the examiner probes once, and only when the answer is thin", () => {
  assert.equal(probeFor({ question, answer: "force equals mass times acceleration", awarded: 1 }), null);
  assert.equal(probeFor({ question, answer: "something", awarded: 0.2, probes: 1 }), null, "one probe per question");
  assert.equal(probeFor({ question, answer: "", awarded: 0 }).kind, "silent");
  assert.equal(probeFor({ question, answer: "force", awarded: 0 }).kind, "expand");
  assert.equal(probeFor({ question, answer: "a long but partly right answer about momentum", awarded: 0.5 }).kind, "expand");
  const wrong = probeFor({ question, answer: "gravity pushes things down", awarded: 0 });
  assert.equal(wrong.kind, "reread");
  assert.match(wrong.line, /Starter Physics, page 3/, "the examiner sends the student back to the cited page");
});

test("a wrong answer is named, not just marked", () => {
  const mcq = {
    type: "mcq",
    options: ["external", "movement", "opposes"],
    answer: "movement",
    source: question.source,
    prompt: "Laws of motion describe how forces change the ____ of a body.",
  };
  const chosen = nameMisconception({ question: mcq, submitted: "external", awarded: 0 });
  assert.match(chosen, /You chose "external"/);
  assert.match(chosen, /does appear on this page, but not as the answer/);
  assert.match(chosen, /Starter Physics, page 3/);

  assert.match(nameMisconception({ question: mcq, submitted: "", awarded: 0 }), /No answer was given/);
  assert.match(
    nameMisconception({ question, submitted: "force equals mass times acceleration, I think", awarded: 0.5 }),
    /full statement/,
  );
  assert.equal(nameMisconception({ question, submitted: "force equals mass times acceleration", awarded: 1 }), "");
});

test("the report card adds up, and says what it is", () => {
  const rows = [
    { question, submitted: "force equals mass times acceleration", awarded: 1 },
    { question: { ...question, topic: "Thermodynamics" }, submitted: "heat and work", awarded: 0 },
    { question: { ...question, topic: "Waves" }, submitted: "waves carry energy", awarded: 0.5 },
  ];
  const report = vivaReport(rows);
  assert.equal(report.total, 3);
  assert.equal(report.outOf, VIVA_MARKS);
  assert.equal(report.marks, 5, "1.5 of 3 is half marks");
  assert.equal(report.percent, 50);
  assert.equal(report.band, "Pass");
  assert.deepEqual(report.strengths, ["Laws of Motion"]);
  assert.deepEqual(report.weaknesses, ["Thermodynamics", "Waves"]);
  assert.equal(report.misconceptionTopic, "Thermodynamics");
  assert.ok(report.misconception.length > 20);
  assert.match(report.nextStep, /Thermodynamics/);
  assert.match(report.honesty, /not an exam result/);

  const perfect = vivaReport([{ question, submitted: "right", awarded: 1 }, { question, submitted: "right", awarded: 1 }]);
  assert.equal(perfect.marks, 10);
  assert.equal(perfect.band, "Distinction");
  assert.match(perfect.nextStep, /mock/i);

  const empty = vivaReport([]);
  assert.equal(empty.marks, 0);
  assert.equal(empty.total, 0);
  assert.equal(empty.misconception, "");
  assert.match(empty.nextStep, /at least one question/);

  const low = vivaReport([{ question, submitted: "", awarded: 0 }]);
  assert.equal(low.band, "Needs work");
});

test("voice and viva are wired into the app, not shipped as dead files", () => {
  const app = read("js/app.js");
  const html = read("index.html");
  const sw = read("sw.js");
  const css = read("styles.css");

  assert.match(html, /id="ask-mic"/);
  assert.match(html, /<symbol id="i-mic"/);
  assert.match(html, /<symbol id="i-speaker"/);
  assert.match(app, /from "\.\/voice\.js\?v=34"/);
  assert.match(app, /from "\.\/viva\.js\?v=34"/);
  assert.match(app, /function speakCurrentQuestion/);
  assert.match(app, /async function dictateAnswer/);
  assert.match(app, /async function dictateQuestion/);
  assert.match(app, /"Read aloud"/, "an answer can be heard as well as copied");
  assert.match(app, /renderExamViva/, "the viva is a mode in the exam view");
  assert.match(app, /quiz\.viva = true/);
  assert.match(app, /result\.viva = vivaReport/);
  assert.match(app, /vivaCard\(/, "the report card is rendered");
  assert.match(app, /question-voice-button/, "each question can be read or answered aloud");
  assert.match(css, /\.viva-card/);
  assert.match(css, /\.question-voice-button/);
  assert.match(sw, /"\.\/js\/voice\.js\?v=34"/, "voice ships offline");
  assert.match(sw, /"\.\/js\/viva\.js\?v=34"/);
});

test("a viva question is a sentence from the student's page, marked on its own words", async () => {
  const { vivaQuestionFrom, vivaQuestionsFromSentences, keyTerms } = await import("../js/viva.js");
  const { gradeQuiz, makeQuiz } = await import("../js/quiz.js");
  const sentence = "Photosynthesis is the process in which green plants use light energy to make food from carbon dioxide and water.";
  const source = { title: "Starter Biology", page: 3, quote: sentence };

  assert.deepEqual(keyTerms(sentence).slice(0, 3), ["photosynthesis", "process", "green"]);
  assert.deepEqual(keyTerms("the of and"), [], "nothing meaningful, nothing asked");

  const built = vivaQuestionFrom({ sentence, source, topic: "Photosynthesis" });
  assert.equal(built.type, "short");
  assert.match(built.prompt, /^Explain this in your own words: "Photosynthesis/);
  assert.equal(built.source.page, 3);
  assert.ok(built.acceptable.includes("photosynthesis"));
  assert.equal(vivaQuestionFrom({ sentence: "" }), null);

  const asked = vivaQuestionsFromSentences([
    { sentence, source, topic: "Photosynthesis" },
    { sentence, source, topic: "Photosynthesis" },
    { sentence: "Respiration releases energy from glucose in the mitochondria of a cell.", source, topic: "Respiration" },
  ], { count: 5 });
  assert.equal(asked.length, 2, "a repeated sentence is not asked twice");

  // The mark has to be defensible: a real explanation scores, a shrug does not.
  const quiz = makeQuiz({ questions: [built], topic: "Photosynthesis", type: "short" });
  const good = gradeQuiz(quiz, { [quiz.questions[0].id]: "Photosynthesis is the process where green plants use light energy to make food from carbon dioxide and water" });
  const shrug = gradeQuiz(quiz, { [quiz.questions[0].id]: "it is something plants do" });
  assert.equal(good.perQuestion[0].awarded, 1, "an explanation using the page's own ideas is marked right");
  assert.ok(shrug.perQuestion[0].awarded < 1, "a vague answer is not");
});
