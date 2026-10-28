import test from "node:test";
import assert from "node:assert/strict";
import { buildModelPaper, extractPageQuestions, modelPaperText } from "../js/model-paper.js";

const science2022 = { book: { id: "old-1", title: "Science 2022", subject: "Science", type: "pdf", pages: [
  { page: 3, text: `SECTION A\n1. What is photosynthesis? [2 marks]\n2. Choose the correct unit of force.\n(a) Newton\n(b) Joule\n(c) Watt\n(d) Ampere\nSECTION B\n3. Explain the process of respiration in plants.\nAnswer key\n1. Plants make food using light.\n2. Correct answer: Newton` },
] } };
const science2023 = { book: { id: "old-2", title: "Science 2023", subject: "Science", type: "pdf", pages: [
  { page: 7, text: `1. What is photosynthesis? [2 marks]\n2. Define electricity and describe an electric circuit.\n3. How do plants absorb water through their roots?` },
] } };

test("past papers produce a balanced, cited practice paper and omit answer keys", () => {
  const paper = buildModelPaper([science2022, science2023], { count: 5 });
  assert.equal(paper.questions.length, 5);
  assert.equal(paper.analysis.extracted, 6);
  assert.equal(paper.analysis.duplicates, 1);
  assert.deepEqual(paper.questions.slice(0, 2).map((question) => question.source.bookId), ["old-1", "old-2"]);
  assert.equal(paper.questions[0].source.page, 3);
  assert.equal(paper.questions[1].source.page, 7);
  assert.equal(paper.questions[0].marks, 2);
  const mcq = paper.questions.find((question) => question.type === "multiple-choice");
  assert.match(mcq.text, /\(a\) Newton[\s\S]*\(d\) Ampere/);
  const output = modelPaperText(paper);
  assert.match(output, /does not predict the real exam/i);
  assert.match(output, /No answer key has been inferred/i);
  assert.match(output, /Science 2022, page 3/);
  assert.doesNotMatch(output, /Plants make food using light|Correct answer: Newton/);
});

test("topic filter refuses unrelated questions; no readable questions produces no paper", () => {
  const physics = buildModelPaper([science2022, science2023], { topic: "electricity", count: 10 });
  assert.equal(physics.questions.length, 1);
  assert.match(physics.questions[0].text, /electricity/);
  assert.equal(buildModelPaper([science2022], { topic: "dinosaurs" }).questions.length, 0);
  assert.equal(buildModelPaper([science2022], { topic: "and the" }).questions.length, 0, "a vague named topic must not silently become general practice");
  assert.equal(buildModelPaper([{ book: { id: "scan", pages: [{ page: 1, text: "" }] } }]).questions.length, 0);
  assert.equal(buildModelPaper([{ book: { id: "notes", pages: [{ page: 1, text: "Plants make food. Sunlight is important." }] } }]).questions.length, 0);
});

test("previously imported flattened PDF pages still split obvious numbered questions", () => {
  const page = { page: 2, text: "Science SECTION A 1. What is voltage? [2 marks] 2. Choose the unit of force. (a) Newton (b) Joule (c) Watt 3. Explain how a circuit works." };
  const questions = extractPageQuestions(page, { id: "old-pdf", title: "Old PDF" });
  assert.equal(questions.length, 3);
  assert.match(questions[1].text, /\(a\) Newton\n\(b\) Joule/);
  assert.equal(questions[1].type, "multiple-choice");
  assert.equal(questions[2].source.page, 2);
  const inline = extractPageQuestions({ page: 3, text: "1. What is voltage? Answer: a secret answer" }, { id: "old-pdf" });
  assert.equal(inline[0].text, "What is voltage?");
});

test("question numbers and source scripts can be Hindi or Telugu", () => {
  const page = { page: 4, text: "१. प्रकाश संश्लेषण क्या है?\n२. पौधों में भोजन कैसे बनता है?\n३. మొక్కలకు నీరు ఎందుకు అవసరం?" };
  const questions = extractPageQuestions(page, { id: "indic", title: "भाषा प्रश्नपत्र" });
  assert.equal(questions.length, 3);
  assert.equal(questions[0].source.page, 4);
  assert.match(questions[2].text, /మొక్కలకు/);
});

test("analysis work and requested size are bounded", () => {
  const paper = buildModelPaper([{ book: { id: "large", title: "Large", pages: [{ page: 1, text: "x".repeat(2_100_000) }] } }], { count: 10000 });
  assert.equal(paper.questions.length, 0);
  assert.equal(paper.analysis.requested, 30);
  assert.equal(paper.analysis.truncated, true);
});
