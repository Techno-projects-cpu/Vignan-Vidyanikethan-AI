import test from "node:test";
import assert from "node:assert/strict";
import {
  generateQuiz,
  gradeQuiz,
  makeQuiz,
  prepareQuestions,
  recomputeResult,
} from "../js/quiz.js";
import { chapterHits } from "./helpers.mjs";

function buildQuiz(overrides = {}) {
  return generateQuiz({
    hits: chapterHits("photosynthesis", 10),
    topic: "photosynthesis",
    count: 5,
    type: "mix",
    difficulty: "medium",
    ...overrides,
  });
}

test("generateQuiz returns the requested number of page-cited questions", () => {
  const quiz = buildQuiz();
  assert.equal(quiz.questions.length, 5);
  assert.equal(quiz.topic, "photosynthesis");
  assert.equal(quiz.generatedBy, "offline");
  for (const question of quiz.questions) {
    assert.ok(["mcq", "fill", "short"].includes(question.type));
    assert.ok(question.prompt.length > 20);
    assert.ok(question.source.page >= 1);
    assert.ok(question.source.quote.length > 20);
    assert.ok(question.explanation.includes(String(question.source.page)));
  }
});

test("MCQ options contain exactly one correct answer", () => {
  const quiz = buildQuiz({ type: "mcq", count: 5 });
  for (const question of quiz.questions) {
    assert.equal(question.type, "mcq");
    assert.equal(question.options.length, 4);
    assert.equal(question.options.filter((option) => option === question.answer).length, 1);
  }
  const answers = quiz.questions.map((question) => question.answer.toLowerCase());
  assert.ok(new Set(answers).size >= 3, "a quiz should not repeat one blank five times");
});

test("hard difficulty can blank a two-word phrase", () => {
  const quiz = buildQuiz({ type: "fill", difficulty: "hard", count: 4 });
  assert.ok(quiz.questions.some((question) => question.answer.includes(" ")));
});

test("gradeQuiz awards full marks for correct responses", () => {
  const quiz = buildQuiz();
  const responses = {};
  for (const question of quiz.questions) {
    if (question.type === "short") responses[question.id] = question.reference;
    else responses[question.id] = question.answer;
  }
  const result = gradeQuiz(quiz, responses);
  assert.equal(result.percent, 100);
  assert.equal(result.correctCount, quiz.questions.length);
  assert.equal(result.reviseList.length, 0);
  assert.ok(result.topicBreakdown.length >= 1);
  assert.ok(result.xp > 0);
});

test("gradeQuiz builds a revise list from wrong answers", () => {
  const quiz = buildQuiz({ type: "mcq", count: 4 });
  const result = gradeQuiz(quiz, { [quiz.questions[0].id]: "definitely wrong" });
  assert.ok(result.percent < 100);
  assert.ok(result.wrongCount >= 3);
  assert.ok(result.reviseList.length >= 3);
  assert.ok(result.reviseList[0].page >= 1);
  assert.ok(result.perQuestion[0].feedback.length > 5);
});

test("short answers get partial credit for keyword overlap", () => {
  const question = prepareQuestions([
    {
      type: "short",
      prompt: "Explain respiration.",
      reference: "Respiration releases energy from glucose and uses oxygen in cells.",
      acceptable: ["respiration", "energy", "glucose", "oxygen", "cells"],
      source: { title: "Demo", page: 4, quote: "Respiration releases energy from glucose." },
    },
  ])[0];
  const quiz = makeQuiz({ questions: [question], topic: "respiration" });
  const full = gradeQuiz(quiz, { [question.id]: "Respiration releases energy from glucose and uses oxygen in cells." });
  const partial = gradeQuiz(quiz, { [question.id]: "Energy and glucose are involved." });
  assert.equal(full.percent, 100);
  assert.ok(partial.percent >= 25 && partial.percent <= 75);
});

test("recomputeResult recalculates totals after AI grading overrides", () => {
  const quiz = buildQuiz({ type: "short", count: 3 });
  const result = gradeQuiz(quiz, {});
  assert.equal(result.percent, 0);
  result.perQuestion.forEach((item) => {
    item.awarded = 0.5;
  });
  const recomputed = recomputeResult(result);
  assert.equal(recomputed.percent, 50);
  assert.equal(recomputed.partialCount, 3);
  assert.equal(recomputed.correctCount, 0);
  assert.equal(recomputed.reviseList.length, 3);
});
