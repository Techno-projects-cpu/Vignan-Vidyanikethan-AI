/**
 * The answer has to be on screen.
 *
 * The complaint that started this: "we have to scroll down to see the answer".
 * It was one line, `log.scrollTop = log.scrollHeight`, and it was wrong in two
 * ways at once — it ran once before the answer had been laid out, so it landed
 * short on a long answer, and when it did land it landed on the *end* of the
 * answer, so a student read the last paragraph first.
 *
 * The arithmetic now lives in js/chat-scroll.js so it can be checked without a
 * browser. This file tests the arithmetic, then the wiring, then the layout
 * rules that give the conversation its room back.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ANSWER_GUTTER,
  FOLLOWING_GAP,
  answerOutOfView,
  isFollowing,
  readChatBox,
  scrollForAnswer,
  scrollForLatest,
} from "../js/chat-scroll.js";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const app = read("js/app.js");
const css = read("styles-next.css");
const html = read("index.html");
const worker = read("sw.js");

test("a conversation that fits counts as followed", () => {
  assert.equal(isFollowing({ scrollTop: 0, scrollHeight: 400, clientHeight: 600 }), true);
  assert.equal(isFollowing({ scrollTop: 0, scrollHeight: 600, clientHeight: 600 }), true);
});

test("following stops when the reader scrolls up to re-read", () => {
  const box = { scrollHeight: 3000, clientHeight: 600 };
  assert.equal(isFollowing({ ...box, scrollTop: 2400 }), true, "at the bottom");
  assert.equal(isFollowing({ ...box, scrollTop: 2400 - FOLLOWING_GAP + 10 }), true, "inside the tolerance");
  assert.equal(isFollowing({ ...box, scrollTop: 1200 }), false, "half way up");
  assert.equal(isFollowing({ ...box, scrollTop: 0 }), false, "at the top");
});

test("missing measurements never move anybody", () => {
  assert.equal(isFollowing({}), true, "no layout means nothing to follow");
  assert.equal(scrollForAnswer({ answerTop: Number.NaN, scrollHeight: 1000, clientHeight: 400 }), 0);
  assert.equal(scrollForLatest({}), 0);
  assert.equal(answerOutOfView({}), false);
});

test("the newest answer is pinned to the top of the reading area", () => {
  // A 2000px answer in a 600px window, starting 1200px down the conversation.
  const top = scrollForAnswer({ answerTop: 1200, contentTop: 0, scrollHeight: 3200, clientHeight: 600 });
  assert.equal(top, 1200 - ANSWER_GUTTER);
  // Which means the answer's first line is at the top of what the student sees,
  // not its last paragraph.
  assert.ok(top < 3200 - 600, "and it is not the bottom of the conversation");
});

test("the pin is clamped to the real scroll range", () => {
  // An answer near the end of a short conversation can only go as far as the
  // range allows: 40px down, 14px of gutter, but only 20px of scroll exists.
  assert.equal(scrollForAnswer({ answerTop: 40, contentTop: 0, scrollHeight: 620, clientHeight: 600 }), 20);
  // An answer at the very end of a long conversation cannot overscroll.
  assert.equal(scrollForAnswer({ answerTop: 5000, contentTop: 0, scrollHeight: 5200, clientHeight: 600 }), 4600);
  // Negative scroll positions are never produced.
  assert.equal(scrollForAnswer({ answerTop: -300, contentTop: 0, scrollHeight: 2000, clientHeight: 600 }), 0);
});

test("the content origin is subtracted, so a scrolled log still lands right", () => {
  // The log has been scrolled 800px, so the answer's rect top is 400 in the
  // viewport while the content origin sits at -400.
  const top = scrollForAnswer({ answerTop: 400, contentTop: -400, scrollHeight: 4000, clientHeight: 700 });
  assert.equal(top, 800 - ANSWER_GUTTER);
});

test("while the answer is being written the bottom is what matters", () => {
  assert.equal(scrollForLatest({ scrollHeight: 2400, clientHeight: 600 }), 1800);
  assert.equal(scrollForLatest({ scrollHeight: 400, clientHeight: 600 }), 0);
});

test("the jump control appears exactly when the answer has drifted away", () => {
  const view = { contentTop: 0, clientHeight: 600 };
  // Answer starts at the top: visible, no pill.
  assert.equal(answerOutOfView({ ...view, answerTop: 0, answerHeight: 400, scrollTop: 0 }), false);
  // Reader has scrolled to the end of a long answer: the start is gone, pill.
  assert.equal(answerOutOfView({ ...view, answerTop: 0, answerHeight: 3000, scrollTop: 2500 }), true);
  // Reader is above the answer entirely (it arrived below the fold): pill.
  assert.equal(answerOutOfView({ ...view, answerTop: 1400, answerHeight: 300, scrollTop: 0 }), true);
  // A sliver still counts as visible: no pill for sixteen pixels.
  assert.equal(answerOutOfView({ ...view, answerTop: 0, answerHeight: 900, scrollTop: 6 }), false);
});

test("no layout is read from a hidden log", () => {
  const nothing = { clientHeight: 0, getBoundingClientRect: () => ({ top: 0, height: 0 }), scrollTop: 0, scrollHeight: 0 };
  assert.equal(readChatBox(nothing, nothing), null, "a log that is not on screen is not measured");
  assert.equal(readChatBox(null, null), null);
});

test("readChatBox turns rects into content coordinates", () => {
  const log = { clientHeight: 600, scrollHeight: 3000, scrollTop: 900, getBoundingClientRect: () => ({ top: 100, height: 600 }) };
  const answer = { getBoundingClientRect: () => ({ top: 250, height: 420 }) };
  const box = readChatBox(log, answer);
  assert.deepEqual(box, {
    answerTop: 250,
    answerHeight: 420,
    contentTop: 100 - 900,
    scrollTop: 900,
    scrollHeight: 3000,
    clientHeight: 600,
  });
  // The answer sits 1050px down the content, and the pin puts it 14px lower.
  assert.equal(scrollForAnswer(box), 1050 - ANSWER_GUTTER);
});

test("the renderer no longer jumps blindly to the bottom", () => {
  assert.doesNotMatch(app, /log\.scrollTop = log\.scrollHeight/, "the old line is gone");
  assert.match(app, /pinChat\(\{ mode: "#typing"|pinChat\(\{ mode: \$\("#typing"\)/, "the pin knows whether an answer is being written");
  // The answer is pinned when the typing hint goes away, which is the moment the
  // answer is complete.
  assert.match(app, /function showTyping\(visible\)[\s\S]*?pinChat\(\{ mode: "answer" \}\)/, "the answer is pinned on arrival");
  // And again after the layout settles, which is where the old code fell short.
  assert.match(app, /requestAnimationFrame\(\(\) => \{\s*settle\(\);[\s\S]*?requestAnimationFrame\(settle\)/, "two frames later, the pin is repeated");
  assert.match(app, /new ResizeObserver\(/, "and late layout re-pins the answer");
  assert.match(app, /initChatScroll\(\)/, "the scroll region is wired at boot");
  assert.match(app, /if \(!box\) return;/, "a missing measurement is never guessed at");
});

test("a reader who scrolled up is never yanked back", () => {
  assert.match(app, /if \(mode === "answer" && !force && !chatPinned\)/, "the pin is skipped while the reader is re-reading");
  assert.match(app, /chatPinned = box \? isFollowing\(box\) : true;/, "following is measured, not assumed");
  // Sending a question is a deliberate act, so it resumes following.
  assert.match(app, /chatPinned = true;\s*pinChat\(\{ mode: "latest", force: true \}\)/, "a new question resumes the follow");
});

test("there is a way back to the newest answer", () => {
  assert.match(html, /<button type="button" class="chat-jump" id="chat-jump" hidden aria-label="Jump to the newest answer"/);
  assert.match(css, /\.chat-jump \{[\s\S]*?position: absolute;[\s\S]*?top: -46px;/);
  assert.match(css, /\.chat-jump\[hidden\] \{ display: none; \}/);
  assert.match(app, /\$\("#chat-jump"\)\?\.addEventListener\("click"/, "the pill does something");
  // The pill is hidden whenever it would be a lie.
  assert.match(app, /jump\.hidden = !stray;/);
});

test("the conversation gets the room, not the furniture around it", () => {
  // The top padding is there for the logo only. It used to be 72px.
  assert.match(css, /body\.premium-ui #view-ask \.chat-log \{[\s\S]*?padding: 58px 0/, "58px for the logo, not 72");
  // A smooth scroll can be cancelled mid-flight; a pinned answer must land.
  assert.match(css, /body\.premium-ui #view-ask \.chat-log \{[\s\S]*?scroll-behavior: auto;/, "the pin is instant");
  // On a phone, the chips and rows around the answer give way first.
  assert.match(css, /#view-ask\.has-conversation \.chat-starters,[\s\S]*?display: none;/, "starter chips stand down");
  assert.match(css, /#view-ask\.has-conversation \.composer-meta details,[\s\S]*?display: none;/, "the style row stands down");
  // And the empty-screen greeting is a greeting, not a page.
  assert.match(css, /#view-ask \.premium-hero h2 \{ font-size: clamp\(30px, 8\.4vw, 40px\); \}/);
  assert.match(css, /#view-ask \.premium-project-line,\s*body\.premium-ui #view-ask \.premium-hero-meta \{ display: none; \}/);
});

test("the new module ships in the offline cache, like every other import", () => {
  const version = (html.match(/js\/boot\.js\?v=(\d+)/) || [])[1];
  assert.ok(version, "the page names its release");
  assert.ok(worker.includes(`./js/chat-scroll.js?v=${version}`), "chat-scroll.js is precached");
  assert.match(app, new RegExp(`from "\\./chat-scroll\\.js\\?v=${version}"`), "and imported at that release");
});
