import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { insideFrame, microphoneProblem } from "../js/voice.js";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(fileURLToPath(new URL(path, root)), "utf8");
const html = read("index.html");
const css = read("styles.css");
const app = read("js/app.js");

test("a blocked frame is named as a blocked frame, with a way out", () => {
  const problem = microphoneProblem({ error: "not-allowed", framed: true });
  assert.equal(problem.code, "framed");
  assert.equal(problem.openTab, true, "the notice must offer the action that works");
  assert.match(problem.message, /preview window/i);
  assert.match(problem.message, /own tab/i);
  assert.match(problem.message, /typing/i, "typing still works and the student is told so");
});

test("a refused permission says which lock to open", () => {
  const problem = microphoneProblem({ error: "not-allowed", framed: false });
  assert.equal(problem.code, "denied");
  assert.equal(problem.openTab, false, "a new tab would not help here");
  assert.match(problem.message, /padlock/i);
  assert.match(problem.message, /allow the microphone/i);
});

test("each failure gets its own sentence, and none of them is the generic one", () => {
  const cases = {
    "audio-capture": "no-device",
    network: "network",
    "no-speech": "no-speech",
    timeout: "timeout",
    unsupported: "unsupported",
  };
  const seen = new Set();
  for (const [error, code] of Object.entries(cases)) {
    const problem = microphoneProblem({ error, framed: false });
    assert.equal(problem.code, code);
    assert.ok(problem.message.length > 25, `${error} explains itself`);
    assert.doesNotMatch(problem.message, /did not work\. Type/, `${error} is not the generic sentence`);
    seen.add(problem.message);
  }
  assert.equal(seen.size, Object.keys(cases).length, "no two failures share a sentence");
});

test("the Permissions API answer wins over a stale error code", () => {
  // Chrome can report not-allowed for both a blocked frame and a refusal; once the
  // frame is ruled out, a denied permission is the better explanation.
  assert.equal(microphoneProblem({ error: "service-not-allowed", framed: false, permission: "denied" }).code, "denied");
  // ...but a frame is still the first thing to rule out.
  assert.equal(microphoneProblem({ error: "not-allowed", framed: true, permission: "denied" }).code, "framed");
});

test("frame detection is safe when the parent is cross-origin", () => {
  assert.equal(insideFrame({ self: 1, top: 1 }), false, "a normal page is not framed");
  assert.equal(insideFrame({ self: 1, top: 2 }), true, "a framed page is framed");
  const hostile = {
    self: 1,
    get top() {
      throw new Error("Blocked a frame from accessing a cross-origin frame.");
    },
  };
  assert.equal(insideFrame(hostile), true, "an unreadable parent means we are inside one");
  assert.equal(insideFrame({}), false, "no window means no frame");
});

test("the notice exists, is wired, and cannot be mistaken for a toast", () => {
  assert.match(html, /<p class="voice-help hidden" id="voice-help" role="status" aria-live="polite"><\/p>/);
  const composerStart = html.indexOf("id=\"ask-form\"");
  const notice = html.indexOf('id="voice-help"');
  assert.ok(notice > composerStart, "the notice sits inside the composer, under the buttons");
  assert.match(app, /function showVoiceHelp\(/);
  assert.match(app, /function hideVoiceHelp\(/);
  assert.match(app, /async function voiceProblem\(/);
  assert.match(app, /insideFrame\(\)/, "the frame check is used, not just written");
  assert.match(app, /navigator\.permissions\?\.query\?\.\(\{ name: "microphone" \}\)/);
  assert.equal((app.match(/showVoiceHelp\(await voiceProblem/g) || []).length, 2, "both the question and the answer microphones use it");
  assert.doesNotMatch(app, /showToast\(listenMessage\(/, "the generic toast is gone from the microphone paths");
  assert.match(css, /\.voice-help \{/);
  assert.match(css, /\.voice-help-link \{/);
  assert.match(css, /\.voice-help-close \{/);
});

test("first open belongs to the blocks, so nothing is squeezed", () => {
  assert.match(css, /#view-ask:not\(\.has-conversation\) \.chat-log \{ display: none; \}/);
  assert.match(css, /#view-ask:not\(\.has-conversation\) \.composer \.response-modes \{ display: none; \}/);
  assert.match(css, /#view-ask:not\(\.has-conversation\) \.goal-cards \{ flex: 1 1 auto; \}/);
  assert.match(css, /@media \(max-height: 780px\)[\s\S]*?\.goal-card \{ min-height: 72px; padding: 11px 18px; \}/);
  // Five rows plus the head must fit a normal laptop column without scrolling.
  const row = Number((css.match(/\.goal-card \{[\s\S]*?min-height: (\d+)px/) || [])[1]);
  assert.ok(row >= 60 && row <= 100, `rows are sized to fill the panel (${row}px)`);
});
