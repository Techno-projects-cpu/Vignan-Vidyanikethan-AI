/**
 * The two things that make a long screen comfortable — reading position and the
 * way back up — plus the keyboard map.
 *
 * The arithmetic is tested without a browser, because this is exactly the kind
 * of "obvious" code that ships with an off-by-one and a button that appears at
 * the top of the page.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  SHORTCUTS,
  fitComposerHeight,
  focusableWithin,
  isComposingEnter,
  isTypingTarget,
  nextFocusTarget,
  shouldSendOnEnter,
  prefersReducedMotion,
  readingState,
  shortcutForKey,
  shouldShowToTop,
  windowScrollState,
} from "../js/viewport.js";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const html = read("index.html");
const css = read("styles-next.css");
const app = read("js/app.js");

test("progress is a fraction of what can actually scroll", () => {
  const top = readingState({ scrollTop: 0, scrollHeight: 3000, clientHeight: 1000 });
  assert.equal(top.fraction, 0);
  assert.equal(top.percent, 0);
  assert.equal(top.scrollable, true);

  const middle = readingState({ scrollTop: 1000, scrollHeight: 3000, clientHeight: 1000 });
  assert.equal(middle.fraction, 0.5);
  assert.equal(middle.percent, 50);

  const end = readingState({ scrollTop: 2000, scrollHeight: 3000, clientHeight: 1000 });
  assert.equal(end.fraction, 1);
  assert.equal(end.remaining, 0);

  // Overshoot from rubber-band scrolling must not read as 140%.
  assert.equal(readingState({ scrollTop: 2600, scrollHeight: 3000, clientHeight: 1000 }).fraction, 1);
  assert.equal(readingState({ scrollTop: -80, scrollHeight: 3000, clientHeight: 1000 }).fraction, 0);
});

test("a page that fits on one screen has no progress to show", () => {
  const short = readingState({ scrollTop: 0, scrollHeight: 800, clientHeight: 800 });
  assert.equal(short.scrollable, false);
  assert.equal(short.fraction, 0);
  assert.equal(readingState({ scrollHeight: 0, clientHeight: 0 }).fraction, 0);
  assert.equal(readingState().fraction, 0);
});

test("the back-to-top button appears only when it would help", () => {
  const at = (scrollTop, scrollHeight = 4000, clientHeight = 800) =>
    shouldShowToTop({ scrollTop, scrollHeight, clientHeight });

  assert.equal(at(0), false, "not at the top");
  assert.equal(at(200), false, "not after a small nudge");
  assert.equal(at(600, 4000, 800), true, "after a real scroll with a lot left below");
  assert.equal(at(2900, 4000, 800), false, "not when the end is in sight");
  assert.equal(at(2400, 4000, 800), true, "still useful with 800px left to read");
  // A screen that cannot scroll never shows it, whatever the number says.
  assert.equal(shouldShowToTop({ scrollTop: 900, scrollHeight: 700, clientHeight: 800 }), false);
});

test("the window's numbers are read from the right places", () => {
  const fake = {
    scrollY: 640,
    innerHeight: 900,
    document: { documentElement: { scrollHeight: 3200, clientHeight: 900 }, body: { scrollHeight: 3100 } },
  };
  const state = windowScrollState(fake);
  assert.deepEqual(state, { scrollTop: 640, scrollHeight: 3200, clientHeight: 900 });
  // A browser without scrollY (very old, or a test double) falls back to the element.
  const fallback = windowScrollState({ document: { documentElement: { scrollTop: 12, scrollHeight: 2000, clientHeight: 1000 } } });
  assert.equal(fallback.scrollTop, 12);
});

test("reduced motion is respected before anything animates", () => {
  assert.equal(prefersReducedMotion({ matchMedia: () => ({ matches: true }) }), true);
  assert.equal(prefersReducedMotion({ matchMedia: () => ({ matches: false }) }), false);
  assert.equal(prefersReducedMotion({}), false);
  assert.equal(prefersReducedMotion({ matchMedia: () => { throw new Error("nope"); } }), false);
});

test("typing in a field is never a shortcut", () => {
  const field = (tagName, extra = {}) => ({ tagName, closest: () => null, ...extra });
  assert.equal(isTypingTarget(field("INPUT")), true);
  assert.equal(isTypingTarget(field("textarea")), true);
  assert.equal(isTypingTarget(field("SELECT")), true);
  assert.equal(isTypingTarget({ tagName: "DIV", isContentEditable: true }), true);
  assert.equal(isTypingTarget({ tagName: "DIV", closest: () => ({}) }), true, "inside a dialog");
  assert.equal(isTypingTarget({ tagName: "DIV", closest: () => null }), false);
  assert.equal(isTypingTarget(null), false);
});

test("the keys map to the four actions that exist", () => {
  const key = (value, extra = {}) => shortcutForKey({ key: value, target: { tagName: "BODY" }, ...extra });

  assert.equal(key("/"), "focus-ask");
  assert.equal(key("?"), "help");
  assert.equal(key("Escape"), "escape");
  assert.equal(key("k", { metaKey: true }), "menu");
  assert.equal(key("k", { ctrlKey: true }), "menu");
  assert.equal(key("a"), null, "letters alone are left alone");
  assert.equal(key("k"), null, "k without a modifier is just a letter");
  assert.equal(key("/", { altKey: true }), null);

  // In a text box, only Escape passes through.
  const typed = (value) => shortcutForKey({ key: value, target: { tagName: "TEXTAREA" } });
  assert.equal(typed("/"), null);
  assert.equal(typed("?"), null);
  assert.equal(typed("Escape"), "escape");
});

test("every shortcut the sheet shows is one the code handles", () => {
  assert.ok(SHORTCUTS.length >= 4);
  const ids = SHORTCUTS.map((entry) => entry.id);
  for (const id of ["menu", "focus-ask", "help", "escape"]) {
    assert.ok(ids.includes(id), `${id} is listed`);
  }
  // Each listed key has a branch in initShortcuts.
  for (const action of ["escape", "help", "focus-ask", "menu"]) {
    assert.ok(app.includes(`action === "${action}"`), `${action} is handled`);
  }
});

test("the tools are on the page and wired to real events", () => {
  assert.match(html, /id="read-progress"[\s\S]{0,80}id="read-progress-bar"/);
  assert.match(html, /<button[^>]*id="to-top"[^>]*hidden/);
  assert.match(html, /id="shortcuts-overlay"[\s\S]{0,200}role="dialog"/);
  assert.match(html, /id="shortcuts-list"/);

  // One throttled listener; the transform is written, not the width.
  assert.match(app, /window\.addEventListener\("scroll", queueScrollPaint, \{ passive: true \}\)/);
  assert.match(app, /bar\.style\.transform = `scaleX\(\$\{state\.fraction\}\)`/);
  assert.match(app, /scrollFrame = requestAnimationFrame\(paintScrollTools\)/);
  // The sheet is built from the same list the tests read.
  assert.match(app, /for \(const shortcut of SHORTCUTS\)/);
  // Escape closes the sheet before anything else.
  assert.match(app, /if \(closeShortcuts\(\)\) \{ event\.preventDefault\(\); return; \}/);
});

test("the progress hairline costs nothing while you scroll", () => {
  const block = css.slice(css.indexOf(".read-progress {"), css.indexOf(".to-top {"));
  assert.match(block, /transform: scaleX\(0\)/);
  assert.match(block, /will-change: transform/, "composited, so scrolling does not repaint the page");
  assert.match(block, /pointer-events: none/, "it never eats a tap");
  assert.match(css, /\.read-progress\.on\s*\{[^}]*opacity: 1/);
});

test("both tools stay out of the way on a phone", () => {
  const mobile = css.slice(css.indexOf("@media (max-width: 860px)", css.indexOf(".shortcuts-panel")));
  assert.match(mobile, /\.to-top\s*\{[\s\S]{0,160}bottom: calc\(72px \+ env\(safe-area-inset-bottom\)\)/, "above the tab bar");
  assert.match(mobile, /width: 44px/, "a thumb-sized square, label dropped");
});

test("the question box fits what has been typed into it", () => {
  const at = (scrollHeight, lineHeight = 24, border = 0) => fitComposerHeight({ scrollHeight, lineHeight, border });

  // Empty or one line: never smaller than the two rows it starts at.
  assert.deepEqual(at(0), { height: 48, rows: 2, capped: false });
  assert.deepEqual(at(24), { height: 48, rows: 2, capped: false });
  // Three lines of text: three rows.
  assert.equal(at(72).rows, 3);
  // A pasted paragraph stops at the ceiling and scrolls instead.
  assert.deepEqual(at(1000), { height: 192, rows: 8, capped: true });
  // A border is counted once on each side, and never makes the box shorter.
  assert.equal(at(72, 24, 1).height, 74);
  assert.equal(at(0, 24, 1).height, 50);
  // Nonsense measurements fall back to two rows rather than a zero-height box.
  assert.equal(at(Number.NaN).rows, 2);
  assert.equal(fitComposerHeight({ scrollHeight: 96, lineHeight: 0 }, { minRows: 1, maxRows: 4 }).rows, 4);
});

test("the box is measured, clamped and capped in the app", () => {
  const ask = html.match(/<textarea id="ask-input"[^>]*>/)[0];
  assert.match(ask, /rows="2"/, "two rows before anything is typed");
  assert.match(app, /addEventListener\("input", queueComposerFit\)/);
  assert.match(app, /addEventListener\("paste", queueComposerFit\)/);
  assert.match(app, /input\.style\.height = "auto"/, "reset first, or it can only ever grow");
  assert.match(app, /classList\.toggle\("composer-capped", capped\)/);
  // Coming back to the Ask screen re-measures what is already in the box.
  assert.match(app, /if \(view === "ask"\) queueComposerFit\(\)/);
  // Sending empties the box, so it returns to two rows.
  assert.match(app, /input\.value = "";\s*\n\s*queueComposerFit\(\)/);
});

test("long answers can be read on a phone", () => {
  assert.match(css, /\.composer-input-row textarea \{[^}]*max-height: 210px/, "eight rows on a desktop");
  assert.match(css, /\.message-body pre,\s*\n\.message-body table \{[^}]*overflow-x: auto/, "tables and code scroll, not the page");
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*max-height: 150px/, "a lower ceiling on a small screen");
  assert.match(css, /\.to-top:focus-visible/, "the keyboard can see where it is");
});

test("Enter sends, unless a keyboard is still composing a word", () => {
  // The plain case.
  assert.equal(shouldSendOnEnter({ key: "Enter" }), true);
  assert.equal(shouldSendOnEnter({ key: "Enter", shiftKey: true }), false, "Shift+Enter is a new line");
  assert.equal(shouldSendOnEnter({ key: "a" }), false);

  // Hindi, Telugu, Japanese, Korean: the confirm key belongs to the IME.
  assert.equal(isComposingEnter({ isComposing: true }), true);
  assert.equal(shouldSendOnEnter({ key: "Enter", isComposing: true }), false);
  // Older Safari and some Android keyboards send 229 instead of isComposing.
  assert.equal(shouldSendOnEnter({ key: "Enter", keyCode: 229 }), false);
  assert.equal(shouldSendOnEnter({ key: "Enter", which: 229 }), false);
  assert.equal(shouldSendOnEnter({ key: "Process" }), false);
  assert.equal(isComposingEnter({}), false);

  // And the composer asks that function, instead of testing the key itself.
  assert.match(app, /if \(shouldSendOnEnter\(event\)\)/);
  assert.doesNotMatch(app, /event\.key === "Enter" && !event\.shiftKey/, "the old unguarded check is gone");
});

test("Tab cannot walk out of the shortcuts sheet", () => {
  const items = ["close", "first", "last"];
  assert.equal(nextFocusTarget({ items, active: "close", shift: false }), null, "let the browser move");
  assert.equal(nextFocusTarget({ items, active: "last", shift: false }), "close", "wrap forward");
  assert.equal(nextFocusTarget({ items, active: "close", shift: true }), "last", "wrap backward");
  assert.equal(nextFocusTarget({ items, active: null, shift: false }), "close");
  assert.equal(nextFocusTarget({ items, active: null, shift: true }), "last");
  assert.equal(nextFocusTarget({ items: [] }), null);

  // Only things a keyboard can actually land on are collected.
  const fake = (list) => ({ querySelectorAll: () => list });
  assert.deepEqual(
    focusableWithin(fake([{ hidden: false, getAttribute: () => null }, { hidden: true, getAttribute: () => null }])).length,
    1,
  );
  assert.deepEqual(focusableWithin({}), []);
  assert.deepEqual(focusableWithin(null), []);

  assert.match(app, /focusableWithin\(panel\)/);
  assert.match(app, /if \(!\$\("#shortcuts-overlay"\)\?\.hidden\) trapShortcutsFocus\(event\)/);
});

test("closing the sheet gives focus back where it came from", () => {
  assert.match(app, /shortcutReturnFocus = active && active !== document\.body/);
  assert.doesNotMatch(app, /instanceof HTMLElement/, "no constructor that may not exist");
  assert.match(app, /if \(target\?\.isConnected\) target\.focus\(\{ preventScroll: true \}\)/);
  // And there is a sensible place to land if the old target is gone.
  assert.match(app, /else \$\("#ask-input"\)\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(css, /\.shortcut-row \{[^}]*min-height: 44px/);
});
