/**
 * Code practice.
 *
 * A lesson is content, so these tests are not about wording: they are about the
 * things that would make the mode dishonest or useless. Every lesson must be
 * complete, the explainer must never invent, the prediction check must refuse
 * when the answer is not certain, and code pasted into the chat must be
 * recognised without hijacking a genuine question about a textbook chapter.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  LANGUAGES,
  LESSONS,
  checkPrediction,
  codeExplanationMarkdown,
  explainCode,
  extractCode,
  guessLanguage,
  lessonById,
  lessonCount,
  lessonMarkdown,
  lessonsFor,
  looksLikeCode,
  predictOutput,
  requestedCodeLesson,
  unpredictableReason,
} from "../js/code-mode.js";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const html = read("index.html");
const app = read("js/app.js");
const css = read("styles-next.css");
const sw = read("sw.js");

test("three languages, twelve lessons, every one of them complete", () => {
  assert.equal(LANGUAGES.length, 3);
  assert.equal(lessonCount(), 12);
  const ids = new Set();
  for (const [language, lessons] of Object.entries(LESSONS)) {
    assert.ok(lessons.length >= 4, `${language} has lessons`);
    for (const lesson of lessons) {
      assert.ok(!ids.has(lesson.id), `${lesson.id} is only shipped once`);
      ids.add(lesson.id);
      assert.ok(lesson.title && lesson.goal, `${lesson.id} says what it teaches`);
      assert.ok(Array.isArray(lesson.idea) && lesson.idea.length, `${lesson.id} explains the idea`);
      assert.ok(lesson.code.includes("\n"), `${lesson.id} has a real example, not a fragment`);
      assert.ok(lesson.tryIt && lesson.check, `${lesson.id} has something to try and something to expect`);
      assert.ok(lesson.mistake, `${lesson.id} names the mistake beginners make`);
    }
  }
  assert.equal(lessonsFor("cobol").length, 0, "an unknown language is empty, not a crash");
  assert.equal(lessonById("py-for").language, "python");
  assert.equal(lessonById("nope"), null);
});

test("every lesson example is explained without a single unknown line", () => {
  // A lesson whose own example cannot be read back is worse than no lesson.
  for (const [language, lessons] of Object.entries(LESSONS)) {
    for (const lesson of lessons) {
      const result = explainCode(lesson.code, language);
      const unknown = result.lines.filter((line) => line.kind === "unknown" || line.kind === "text");
      assert.deepEqual(unknown.map((line) => line.text.trim()), [], `${lesson.id} has unexplained lines`);
      assert.ok(result.summary.length > 20, `${lesson.id} summarises the program`);
      assert.ok(result.lines.every((line) => line.explain || line.kind === "blank"), `${lesson.id} explains every non-blank line`);
    }
  }
});

test("the explainer reads a beginner's Python program the way a teacher would", () => {
  const result = explainCode(
    ["# area of a circle", "radius = 7", "area = 3.14 * radius * radius", "print(\"Area:\", area)"].join("\n"),
    "python",
  );
  assert.match(result.lines[0].explain, /comment/i);
  assert.match(result.lines[1].explain, /7/);
  assert.match(result.lines[1].explain, /box named radius/i);
  assert.match(result.lines[2].explain, /3\.14 \* radius \* radius/);
  assert.match(result.lines[3].explain, /on screen/i);
  assert.equal(result.recognised, 4);
});

test("the explainer describes decisions, loops and functions in plain words", () => {
  const python = explainCode("if marks >= 90:\n    print(\"A\")\nfor i in range(3):\n    print(i)\ndef area(r):\n    return 3.14 * r * r", "python");
  const text = python.lines.map((line) => line.explain).join(" ");
  assert.match(text, /is greater than or equal to 90/);
  assert.match(text, /counting from 0 up to but not including 3/);
  assert.match(text, /reusable block of instructions called area/);
  assert.match(text, /hands .* back/i);

  const js = explainCode("const marks = [72, 65];\nfor (const mark of marks) {\n  console.log(mark);\n}", "javascript");
  const jsText = js.lines.map((line) => line.explain).join(" ");
  assert.match(jsText, /cannot be pointed at a different value later/);
  assert.match(jsText, /one item at a time/);
  assert.match(jsText, /console/);
});

test("the explainer names the mistakes instead of guessing at them", () => {
  const missingColon = explainCode("if marks > 90\n    print(\"A\")", "python");
  assert.ok(missingColon.notes.some((note) => /colon/i.test(note)), "a missing colon is named");

  const singleEquals = explainCode("if marks = 90:\n    print(\"A\")", "python");
  assert.ok(singleEquals.notes.some((note) => /==/.test(note)), "= inside a condition is named");

  const braces = explainCode("if (x > 1) {\n  console.log(x);", "javascript");
  assert.ok(braces.notes.some((note) => /braces/i.test(note)), "an unclosed brace is named");

  const tags = explainCode("<div>\n<p>hi\n</div>", "html");
  assert.ok(tags.notes.some((note) => /<p>/.test(note)), "an unclosed tag is named");

  // A line outside the rules is marked, never invented.
  const odd = explainCode("mystery_thing ??? 42", "python");
  assert.equal(odd.lines[0].kind, "unknown");
  assert.match(odd.lines[0].explain, /will not guess/i);
});

test("HTML and CSS are read as markup, including a rule written on one line", () => {
  const result = explainCode("<style>\n  h1 { color: #111; }\n</style>\n<h1>Water</h1>", "html");
  assert.match(result.lines[0].explain, /block of CSS/);
  assert.match(result.lines[1].explain, /every <h1> element/);
  assert.match(result.lines[1].explain, /text colour to #111/);
  assert.match(result.lines[2].explain, /Ends the CSS block/);
  assert.match(result.lines[3].explain, /biggest heading.*Water/);
  assert.match(result.summary, /markup, not a program/);
});

test("predicting the output is exact — or honestly refused", () => {
  const simple = predictOutput("a = 5\nb = 3\nprint(a * b + 2)\nprint(\"Done\")", "python");
  assert.deepEqual(simple, { ok: true, output: "17\nDone", lines: ["17", "Done"] });

  const text = predictOutput('name = "Ananya"\nprint("Hello, " + name)', "python");
  assert.equal(text.output, "Hello, Ananya");

  // Multiplication binds first: 2 + 3 * 4 is 14, not 20.
  const js = predictOutput("const total = 2 + 3 * 4;\nconsole.log(total);\nconsole.log(\"ok\");", "javascript");
  assert.equal(js.output, "14\nok");

  // The three cases where an answer would be a guess.
  assert.equal(predictOutput("for i in range(3):\n    print(i)", "python").reason, "control");
  assert.equal(predictOutput('name = input("Name?")\nprint(name)', "python").reason, "input");
  assert.equal(predictOutput("<h1>hi</h1>", "html").reason, "html");
  assert.equal(predictOutput("x = 1\nprint(y)", "python").reason, "name");
  assert.match(unpredictableReason("control"), /decision or repeats/);
  assert.match(unpredictableReason("input"), /changes every time/);
  assert.match(unpredictableReason("no-output"), /prints nothing/);
});

test("a prediction is marked with the line that differs, not just 'wrong'", () => {
  const code = "a = 2\nb = 4\nprint(a + b)\nprint(a * b)";
  assert.equal(checkPrediction(code, "6\n8", "python").correct, true);
  // Trailing spaces and a stray blank line at the end are forgiven.
  assert.equal(checkPrediction(code, "6 \n8\n", "python").correct, true);

  const partial = checkPrediction(code, "6", "python");
  assert.equal(partial.correct, false);
  assert.match(partial.hint, /Line 2/);
  assert.equal(partial.expected, "6\n8");

  const wrongFirst = checkPrediction(code, "5\n8", "python");
  assert.match(wrongFirst.hint, /Line 1/);

  const unchecked = checkPrediction("for i in range(2):\n    print(i)", "0", "python");
  assert.equal(unchecked.checkable, false);
  assert.ok(unchecked.reason.length > 20);
});

test("pasted code is recognised in the chat without hijacking a real question", () => {
  assert.equal(looksLikeCode("print('hello')\nprint('bye')"), true);
  assert.equal(looksLikeCode("```python\nprint(1)\n```"), true);
  assert.equal(looksLikeCode("for i in range(3):\n    print(i)"), true);
  assert.equal(looksLikeCode("What is photosynthesis?"), false);
  assert.equal(looksLikeCode("Explain the functions of the heart"), false);
  assert.equal(looksLikeCode("What was the result of the Second World War?"), false);

  assert.equal(extractCode("```python\nprint(1)\n```"), "print(1)");
  assert.equal(extractCode("print(2)"), "print(2)");
  assert.equal(guessLanguage("<h1>x</h1>"), "html");
  assert.equal(guessLanguage("console.log(1);"), "javascript");
  assert.equal(guessLanguage("print(1)"), "python");
});

test("a request for a lesson picks the right one, and a school question picks none", () => {
  assert.equal(requestedCodeLesson("teach me loops in python")?.id, "py-for");
  assert.equal(requestedCodeLesson("what is a function in javascript")?.id, "js-functions");
  assert.equal(requestedCodeLesson("how do I make a link in html")?.id, "html-links");
  assert.equal(requestedCodeLesson("teach me css")?.id, "css-style");
  assert.equal(requestedCodeLesson("explain lists in python")?.id, "py-lists");
  assert.equal(requestedCodeLesson("explain photosynthesis"), null);
  assert.equal(requestedCodeLesson("what are the functions of the heart"), null);
  assert.equal(requestedCodeLesson("list the parts of a flower"), null);
  assert.match(lessonMarkdown(lessonById("py-for")), /Code lesson · Python/);
  assert.match(lessonMarkdown(lessonById("py-for")), /Written for this project/);
  assert.equal(lessonMarkdown(null), "");
});

test("the code reader speaks markdown the chat can render, with no raw HTML", () => {
  const markdown = codeExplanationMarkdown(explainCode("print(1)", "python"));
  assert.match(markdown, /^\*\*Code, line by line\*\*/);
  assert.match(markdown, /\*\*1\.\*\* `print\(1\)`/);
  assert.doesNotMatch(markdown, /<(?:div|span|br)\b/);
});

test("the screen exists, is reachable, and is cached for offline use", () => {
  const section = html.slice(html.indexOf('id="view-code"'), html.indexOf('id="view-settings"'));
  for (const id of ["code-languages", "code-lesson-list", "code-lesson-body", "code-input", "code-explain", "code-explanation", "code-prediction", "code-check", "code-verdict"]) {
    assert.match(section, new RegExp(`id="${id}"`), `${id} is on the screen`);
  }
  // Reachable from the drawer and the command palette, not only from the URL.
  assert.match(html, /data-menu-view="code"/);
  assert.match(html, /data-view="code" data-keywords="[^"]*python/);
  assert.match(app, /code: \{ kicker: "view\.code\.kicker"/);
  assert.match(app, /if \(view === "code"\) renderCode\(\);/);
  // Offline: both modules are in the service worker's core list.
  assert.match(sw, /\.\/js\/code-mode\.js\?v=\d+/);
  assert.match(sw, /\.\/js\/memory\.js\?v=\d+/);
  // Sharp corners, hairline borders, a monospaced block.
  assert.match(css, /\.code-block \{[^}]*border: var\(--vn-hairline\) solid var\(--vn-rule\);[^}]*font-family: var\(--vn-font-mono\);/);
  assert.doesNotMatch(css, /\.code-block \{[^}]*border-radius: (?!0)[1-9]/);
});
