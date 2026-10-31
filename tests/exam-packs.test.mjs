/**
 * Competitive-exam practice packs.
 *
 * The packs may ship only two things: the published *shape* of each exam, and
 * arithmetic that a student can check by hand. These tests hold both lines.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  OFFICIAL, EXAMS, MODES, getExam, examByIdOrFirst, examQuestions,
  paceSeconds, paceLabel, blueprint, scoreExam, chapterTokens,
  syllabusCoverage, nextUp, examAdvice, pacingLine,
} from "../js/exam-packs.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8");

test("every pack is complete and points at its official page", () => {
  assert.ok(EXAMS.length >= 5, "several exams, not one generic quiz");
  const ids = new Set();
  for (const exam of EXAMS) {
    assert.ok(exam.id && !ids.has(exam.id), `unique id: ${exam.id}`);
    ids.add(exam.id);
    assert.ok(exam.name, `${exam.id} name`);
    assert.ok(exam.minutes >= 30, `${exam.id} minutes`);
    assert.ok(exam.subjects.length >= 2, `${exam.id} subjects`);
    assert.ok(OFFICIAL[exam.id]?.startsWith("https://"), `${exam.id} official link`);
    assert.ok(exam.check && exam.check.length > 10, `${exam.id} tells students to check the official syllabus`);
    for (const subject of exam.subjects) {
      assert.ok(subject.id && subject.name, `${exam.id} subject id/name`);
      assert.ok(subject.questions >= 1, `${exam.id}/${subject.id} question count`);
      assert.ok(Array.isArray(subject.chapters) && subject.chapters.length >= 3, `${exam.id}/${subject.id} chapters`);
    }
    assert.equal(examQuestions(exam), exam.questions, `${exam.id} totals agree`);
  }
});

test("the published patterns are the ones students actually sit", () => {
  const jeeMain = getExam("jee-main");
  assert.equal(jeeMain.questions, 75);
  assert.equal(jeeMain.minutes, 180);
  assert.deepEqual(jeeMain.marking, { correct: 4, wrong: -1, unattempted: 0 });

  const neet = getExam("neet");
  assert.equal(neet.questions, 180);
  assert.equal(neet.minutes, 180);
  assert.deepEqual(neet.marking, { correct: 4, wrong: -1, unattempted: 0 });
  const biology = neet.subjects.find((subject) => subject.id === "biology");
  assert.equal(biology.questions, 90, "Biology is half the paper");

  const eapcet = getExam("ap-eapcet");
  assert.equal(eapcet.questions, 160);
  assert.equal(eapcet.marking.wrong, 0, "AP EAPCET has no negative marking");

  const advanced = getExam("jee-advanced");
  assert.equal(advanced.variable, true, "JEE Advanced marking changes every year");
});

test("no prep material is bundled, only shapes", () => {
  const source = read("js/exam-packs.js");
  assert.ok(!/<script|https?:\/\/[^"']*\.pdf/i.test(source), "no embedded papers or PDFs");
  assert.ok(!/past paper|previous year paper|question paper/i.test(source), "no previous-year papers");
  // Server-rendered and bundled fonts are latin-only: keep this file ASCII.
  assert.ok(/^[\x00-\x7F]*$/.test(source), "exam-packs.js stays ASCII");
  assert.equal(getExam("neet").official, undefined, "links live in OFFICIAL, not duplicated");
  for (const mode of MODES) assert.ok(mode.id && mode.name && mode.line, `mode ${mode.id}`);
  assert.deepEqual(MODES.map((mode) => mode.id), ["mock", "drill", "viva", "coverage"]);
});

test("blueprint splits any short set and always sums to what was asked", () => {
  for (const exam of EXAMS) {
    for (const count of [1, 2, 3, 5, 7, 10, 25, 50]) {
      const rows = blueprint(exam, count);
      const sum = rows.reduce((total, row) => total + row.count, 0);
      assert.equal(sum, count, `${exam.id} at ${count}: ${sum}`);
      for (const row of rows) assert.ok(row.count >= 1, `${exam.id} at ${count} keeps every subject in`);
      if (count >= exam.subjects.length) assert.equal(rows.length, exam.subjects.length);
    }
  }
});

test("NEET blueprint gives Biology twice the room", () => {
  const rows = blueprint(getExam("neet"), 20);
  const biology = rows.find((row) => row.subjectId === "biology").count;
  const physics = rows.find((row) => row.subjectId === "physics").count;
  assert.ok(biology >= physics * 1.8, `biology ${biology} against physics ${physics}`);
});

test("scoring uses each exam's own marking, including below zero", () => {
  const jee = getExam("jee-main");
  const blank = scoreExam(jee, []);
  assert.equal(blank.questions, 0);
  assert.equal(blank.marks, 0);
  assert.equal(blank.percent, 0);
  assert.equal(blank.accuracy, 0);

  const failed = scoreExam(jee, [
    { subjectId: "physics", status: "wrong" },
    { subjectId: "physics", status: "wrong" },
    { subjectId: "chemistry", status: "skipped" },
    { subjectId: "mathematics", status: "correct" },
  ]);
  assert.equal(failed.questions, 4);
  assert.equal(failed.correct, 1);
  assert.equal(failed.wrong, 2);
  assert.equal(failed.skipped, 1);
  assert.equal(failed.attempted, 3);
  assert.equal(failed.marks, 4 - 1 - 1 + 0, "negative marking applied: 2 of 16");
  assert.equal(failed.maxMarks, 16);
  assert.equal(failed.negativeMarking, true);
  assert.equal(failed.accuracy, 33, "accuracy is out of what was attempted");

  const deep = scoreExam(jee, [
    { subjectId: "physics", status: "wrong" },
    { subjectId: "chemistry", status: "wrong" },
    { subjectId: "mathematics", status: "wrong" },
    { subjectId: "physics", status: "skipped" },
  ]);
  assert.equal(deep.marks, -3, "a negative total is reported, not floored");
  assert.equal(deep.percent, 0, "the percentage shown never goes below zero");

  const noPenalty = scoreExam(getExam("ap-eapcet"), [
    { subjectId: "mathematics", status: "correct" },
    { subjectId: "physics", status: "wrong" },
  ]);
  assert.equal(noPenalty.marks, 1);
  assert.equal(noPenalty.maxMarks, 2);
  assert.equal(noPenalty.negativeMarking, false);

  const unknown = scoreExam(jee, [{ status: "correct" }]);
  assert.equal(unknown.subjects[0].name, "General", "unknown subject does not crash");
});

test("pacing comes from the real paper, never from a guess", () => {
  const jee = getExam("jee-main");
  // 75 questions in 180 minutes is 144 seconds each.
  assert.equal(paceSeconds(jee, 1), 144);
  assert.equal(paceLabel(jee), "2 min 24 s a question");
  assert.equal(paceSeconds(jee, 10), 1440);
  assert.match(pacingLine(jee, 10), /10 questions at exam pace: about 24 minutes/);
  assert.equal(paceSeconds(null, 5), 60, "no exam, no crash");
  assert.ok(paceSeconds(getExam("neet"), 1) >= 20, "floor applied");
});

test("coverage needs a real corpus before claiming a chapter is covered", () => {
  const exam = examByIdOrFirst("jee-main");
  assert.equal(exam.id, "jee-main");
  assert.equal(examByIdOrFirst("nope").id, "jee-main", "unknown id falls back, never null");

  const empty = syllabusCoverage(exam, "");
  assert.equal(empty.percent, 0);
  assert.equal(empty.covered, 0);
  assert.ok(empty.total > 20, "a full syllabus outline is listed");
  assert.equal(empty.missing.length, empty.total);

  const tokens = chapterTokens("Laws of Motion");
  assert.deepEqual(tokens, ["laws", "motion"], "stopwords dropped, short words dropped");
  assert.deepEqual(chapterTokens(""), []);

  const corpus = [...new Set(exam.subjects.flatMap((subject) => subject.chapters))].join(" ");
  const full = syllabusCoverage(exam, corpus);
  assert.equal(full.percent, 100, "a chapter listed word-for-word counts as covered");
  assert.ok(full.bySubject.every((row) => row.percent === 100));

  const partial = syllabusCoverage(exam, "Newton laws motion force acceleration");
  assert.ok(partial.covered >= 1 && partial.covered < partial.total, "some, not all");
});

test("next up puts a failed chapter above an untouched one", () => {
  const exam = getExam("jee-main");
  const coverage = syllabusCoverage(exam, "electric charges fields current electricity newton laws motion");
  const mastery = [{ topic: "laws of motion", accuracy: 12 }];
  const rows = nextUp({ exam, coverage, mastery, limit: 3 });
  assert.equal(rows.length, 3);
  assert.equal(rows[0].chapter, "Laws of Motion", "a chapter the student failed comes first");
  assert.match(rows[0].reason, /accuracy 12%/);
  const unseen = rows.find((row) => row.accuracy === null);
  if (unseen) assert.match(unseen.reason, /not practised yet/);
  assert.deepEqual(nextUp({}), [], "no exam, nothing to suggest");

  const missing = nextUp({ exam, coverage: syllabusCoverage(exam, ""), limit: 1 });
  assert.match(missing[0].reason, /not in your library yet/);
});

test("advice is honest about what the score means", () => {
  const jee = getExam("jee-main");
  assert.match(examAdvice(jee, {}), /Answer a few questions/);
  assert.match(examAdvice(jee, { questions: 5, correct: 0, wrong: 0, skipped: 5 }), /Nothing scored yet/);
  assert.match(
    examAdvice(jee, { questions: 10, correct: 2, wrong: 6, skipped: 2, negativeMarking: true, accuracy: 25, percent: 5 }),
    /More wrong than right/,
  );
  // All wrong is not the same as all blank: with negative marking it costs marks.
  assert.match(
    examAdvice(jee, { questions: 5, correct: 0, wrong: 5, skipped: 0, attempted: 5, marks: -5, accuracy: 0, percent: 0 }),
    /5 attempted, none right, and 5 marks lost/,
  );
  assert.match(
    examAdvice(jee, { questions: 10, correct: 7, wrong: 0, skipped: 3, accuracy: 100, percent: 70 }),
    /left blank/,
  );
  assert.match(
    examAdvice(jee, { questions: 10, correct: 8, wrong: 2, skipped: 0, accuracy: 80, percent: 72 }),
    /Hold this pace/,
  );
  assert.match(
    examAdvice(jee, { questions: 10, correct: 5, wrong: 5, skipped: 0, accuracy: 50, percent: 50 }),
    /gap is breadth/,
  );
  assert.match(
    examAdvice(getExam("ap-eapcet"), { questions: 10, correct: 2, wrong: 4, skipped: 4, accuracy: 33, percent: 20 }),
    /chapter by chapter/i,
  );
});

test("the exam practice page is reachable and uses the existing quiz pipeline", () => {
  const html = read("index.html");
  const app = read("js/app.js");
  const quiz = read("js/quiz.js");
  const styles = read("styles.css");

  assert.match(html, /<section class="view" id="view-exam" data-panel="exam">/, "the exam view exists");
  assert.match(html, /id="exam-panel"/);
  for (const nav of ["nav-item", "mobile-nav-item"]) {
    assert.match(html, new RegExp(`class="${nav}" data-view="exam"`), `${nav} reaches the exam view`);
  }
  assert.match(html, /class="command-item" data-view="exam"/, "the command menu lists it");
  assert.match(html, /<symbol id="i-target"/, "the nav icon exists");
  assert.match(app, /from "\.\/exam-packs\.js\?v=41"/, "the app imports the packs");
  assert.match(app, /if \(view === "exam"\) renderExamView\(\);/, "opening the view renders it");
  assert.match(app, /scoreExam\(exam, items\)/, "exam sessions are marked with the exam's own marking");
  assert.match(app, /result\.exam = \{/, "the result carries the exam readout");
  assert.match(quiz, /question\.subjectId \? \{ subjectId/, "subject tags survive quiz preparation");
  assert.match(styles, /\.exam-panel/);
  assert.ok(!/exam-exam/.test(html));
});

test("a paper built like the app builds one keeps its subject tags all the way to marking", async () => {
  const { makeQuiz, prepareQuestions } = await import("../js/quiz.js");
  const exam = getExam("jee-main");
  const questions = [
    { subjectId: "physics", chapter: "Laws of Motion", prompt: "Force equals mass times what?", type: "mcq", options: ["acceleration", "speed"], answer: "acceleration" },
    { subjectId: "chemistry", chapter: "Equilibrium", prompt: "A catalyst changes the what?", type: "mcq", options: ["rate", "position"], answer: "rate" },
    { subjectId: "mathematics", chapter: "Integrals", prompt: "The integral of 1 is?", type: "mcq", options: ["x", "1"], answer: "x" },
  ].map((question) => ({ ...question, examId: exam.id }));

  const prepared = prepareQuestions(questions);
  assert.equal(prepared[0].subjectId, "physics");
  assert.equal(prepared[0].examId, "jee-main");
  assert.equal(prepared[0].chapter, "Laws of Motion");

  const quiz = makeQuiz({ questions, topic: exam.name, type: "mcq" });
  quiz.examId = exam.id;
  assert.ok(quiz.questions.every((question) => question.subjectId), "the paper knows its subjects");
  assert.ok(quiz.questions.every((question) => question.examId === "jee-main"));

  // The three outcomes a student can produce: right, wrong, and left blank.
  const statuses = ["correct", "wrong", "skipped"];
  const score = scoreExam(exam, quiz.questions.map((question, index) => ({ subjectId: question.subjectId, status: statuses[index] })));
  assert.equal(score.marks, 4 - 1);
  assert.equal(score.maxMarks, 12);
  assert.equal(score.percent, 25);
  assert.equal(score.subjects.length, 3, "one row per subject, in the exam's own terms");
  assert.deepEqual(score.subjects.map((row) => row.subjectId), ["physics", "chemistry", "mathematics"]);
});
