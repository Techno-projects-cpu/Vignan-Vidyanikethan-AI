/**
 * Study sheet + revision plan: both must be cited and honest, never invented.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  asksForStudySheet,
  buildStudySheet,
  studySheetMarkdown,
  studySheetTopic,
} from "../js/study-sheet.js";
import { buildRevisionPlan, revisionPlanText } from "../js/revision-plan.js";

const SCIENCE = {
  text: "Photosynthesis is the process by which green plants use sunlight to make food. Chlorophyll is the green pigment that absorbs light. The equation is 6CO2 + 6H2O = C6H12O6 + 6O2. Force = mass × acceleration. The Sepoy Mutiny began in 1857.",
  page: 12,
  title: "Science",
  section: "Nutrition in Plants",
};

test("a study sheet extracts definitions, formulas and dates with page citations", () => {
  const sheet = buildStudySheet([SCIENCE], { topic: "Nutrition" });
  assert.equal(sheet.empty, false);
  assert.deepEqual(sheet.terms.map((row) => row.term), ["Photosynthesis", "Chlorophyll"]);
  assert.match(sheet.terms[0].definition, /^the process by which/);
  assert.equal(sheet.terms[0].page, 12);
  assert.deepEqual(sheet.formulas.map((row) => row.formula), ["6CO2 + 6H2O = C6H12O6 + 6O2", "Force = mass × acceleration"]);
  assert.equal(sheet.dates[0].year, "1857");
  assert.deepEqual(sheet.pages, [12]);

  const markdown = studySheetMarkdown(sheet);
  assert.match(markdown, /# Study sheet: Nutrition/);
  assert.match(markdown, /\*\*Photosynthesis\*\*/);
  assert.match(markdown, /`Force = mass × acceleration`/);
  assert.match(markdown, /page 12/);
  assert.match(markdown, /quoted or derived from your own book pages/);
});

test("a sheet never invents content when the pages have none", () => {
  const sheet = buildStudySheet([{ text: "Look at the picture on this page carefully.", page: 3 }], {});
  assert.equal(sheet.empty, true);
  assert.equal(sheet.terms.length, 0);
  assert.match(studySheetMarkdown(sheet), /No definitions, formulas or dates were found/);
});

test("generic words never become 'key terms'", () => {
  const sheet = buildStudySheet([
    { text: "The equation is simple here. This example is useful. A definition is given below.", page: 4 },
  ], {});
  assert.equal(sheet.terms.length, 0, "equation/example/definition are not terms");
});

test("only revision requests trigger a sheet", () => {
  assert.equal(asksForStudySheet("give me the key terms of chapter 3"), true);
  assert.equal(asksForStudySheet("make a formula sheet for motion"), true);
  assert.equal(asksForStudySheet("important dates in Indian history"), true);
  assert.equal(asksForStudySheet("quick revision notes on light"), true);
  assert.equal(asksForStudySheet("what is the chemical formula of water"), false);
  assert.equal(asksForStudySheet("explain photosynthesis"), false);
  assert.equal(asksForStudySheet(""), false);
  assert.equal(studySheetTopic("make a study sheet for light and reflection"), "light and reflection");
});

test("duplicate definitions are quoted once", () => {
  const twice = [SCIENCE, { ...SCIENCE, page: 13 }];
  const sheet = buildStudySheet(twice, {});
  assert.equal(sheet.terms.filter((row) => row.term === "Photosynthesis").length, 1);
});

test("the revision plan starts with due cards, then the weakest topic", () => {
  const plan = buildRevisionPlan({
    mastery: [
      { topic: "Nutrition", percent: 40, total: 5 },
      { topic: "Light", percent: 95, total: 4 },
    ],
    dueCards: 6,
    totalCards: 9,
    history: [],
    today: "2026-10-29",
  });
  assert.deepEqual(plan.steps.map((step) => step.action), ["review-cards", "quiz-topic", "quiz-topic"]);
  assert.match(plan.steps[1].title, /Nutrition/);
  assert.match(plan.steps[1].detail, /40%/);
  assert.ok(plan.minutes >= 15 && plan.minutes <= 45, "a realistic total");
  assert.equal(plan.steps.length, 3, "never more than three steps");
});

test("a strong student is not given busywork", () => {
  const plan = buildRevisionPlan({
    mastery: [{ topic: "Light", percent: 96, total: 10 }],
    dueCards: 0,
    totalCards: 10,
    history: [{ day: "2026-10-29", percent: 90 }],
    today: "2026-10-29",
  });
  assert.equal(plan.doneToday, true);
  assert.ok(plan.steps.length <= 1, "no weak topic and nothing due");
  assert.match(plan.headline, /already finished/);
});

test("a brand-new student gets one clear first step", () => {
  const plan = buildRevisionPlan({ mastery: [], dueCards: 0, totalCards: 0, history: [], today: "2026-10-29" });
  assert.equal(plan.steps.length, 1);
  assert.equal(plan.steps[0].action, "open-library");
  assert.match(revisionPlanText(plan), /Today's revision/);
  assert.match(revisionPlanText(plan), /minutes in total/);
});

test("the app wires both features into real screens, not just modules", async () => {
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const root = fileURLToPath(new URL("..", import.meta.url));
  const app = readFileSync(`${root}/js/app.js`, "utf8");
  const page = readFileSync(`${root}/index.html`, "utf8");
  const sw = readFileSync(`${root}/sw.js`, "utf8");

  // Ask flow: a sheet is built before any model or web call can replace it.
  assert.match(app, /asksForStudySheet\(effectiveQuery\)/);
  assert.ok(app.indexOf("buildStudySheet(hits") < app.indexOf("answerWithModel({"), "sheet is built before the model runs");
  assert.match(app, /if \(!answer && hits\.length && connected\)/);
  // Progress screen: the plan has a host, a total and a copy button.
  assert.match(app, /function renderRevisionPlan\(\)/);
  assert.match(app, /renderRevisionPlan\(\);/);
  for (const id of ["revision-plan", "revision-plan-total", "revision-plan-copy"]) {
    assert.match(page, new RegExp(`id="${id}"`));
  }
  // Sheet headings must render as headings, never as literal "#" marks.
  const uiSource = readFileSync(`${root}/js/ui.js`, "utf8");
  assert.match(uiSource, /rich-heading/);
  // The sheet survives onto the saved message and can leave the app as a file.
  assert.match(app, /studySheet: answer\.studySheet/);
  assert.match(app, /studySheet: message\.studySheet && !message\.studySheet\.empty/);
  assert.match(app, /"Save sheet"/);
  assert.match(app, /studySheetMarkdown\(message\.studySheet\)/);
  // Both modules are available offline.
  assert.match(sw, /\.\/js\/study-sheet\.js\?v=21/);
  assert.match(sw, /\.\/js\/revision-plan\.js\?v=21/);
});

test("the sheet keeps the subject wording, not loose request words", () => {
  const cases = {
    "key terms of nutrition in plants": "nutrition in plants",
    "make a study sheet for photosynthesis": "photosynthesis",
    "important dates in Indian history": "Indian history",
    "give me the formulas for Motion": "Motion",
    "cheat sheet on Light and Reflection": "Light and Reflection",
  };
  for (const [query, expected] of Object.entries(cases)) {
    assert.equal(studySheetTopic(query), expected, query);
  }
});
