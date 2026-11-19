/**
 * The guided tour.
 *
 * Two things can be wrong with a tour and both have happened here. It can point
 * at an element that no longer exists, and it can describe a version of the app
 * that no longer exists — the previous card promised "five blocks" on a screen
 * whose blocks had been deleted and named six themes the picker had dropped.
 * Neither failure is visible in a unit test of the tour's own code, so these
 * tests read the real `index.html` and the real controller.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  TOUR_LENGTH,
  TOUR_STEPS,
  tourAtStart,
  tourKey,
  tourNextLabel,
  tourStepAt,
  tourStepLabel,
} from "../js/tour.js";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const html = read("index.html");
const app = read("js/app.js");

/** The screens the document actually has. */
const panels = new Set([...html.matchAll(/data-panel="([a-z]+)"/g)].map((match) => match[1]));

test("every step names a screen the document has, and points at something in it", () => {
  assert.ok(TOUR_LENGTH >= 6, "a tour of this app cannot be three sentences");
  assert.equal(TOUR_LENGTH, TOUR_STEPS.length);

  for (const [index, step] of TOUR_STEPS.entries()) {
    assert.ok(panels.has(step.view), `step ${index + 1} names a real screen (${step.view})`);
    assert.ok(step.title && step.body, `step ${index + 1} has words`);
    // Two sentences at most: this is a card in the corner, not a manual.
    assert.ok(step.body.split(/(?<=[.!?])\s+/).length <= 2, `step ${index + 1} is short`);

    if (!step.target) continue;
    // A selector this simple can be resolved against the markup without a DOM.
    const id = /^#([A-Za-z0-9_-]+)$/.exec(step.target);
    const cls = /^\.([A-Za-z0-9_-]+)$/.exec(step.target);
    assert.ok(id || cls, `step ${index + 1} uses a plain selector (${step.target})`);
    if (id) assert.ok(html.includes(`id="${id[1]}"`), `${step.target} exists`);
    if (cls) assert.ok(html.includes(`class="${cls[1]}`) || html.includes(` ${cls[1]}"`), `${step.target} exists`);
  }

  // Every screen is visited once, in the order a person would show them.
  const views = TOUR_STEPS.map((step) => step.view);
  assert.equal(new Set(views).size, views.length, "no screen is shown twice");
  assert.equal(views[0], "start", "it starts where the student lands");
  assert.equal(views.at(-1), "settings", "and ends with what they can change");
});

test("the tour does not describe a product that no longer exists", () => {
  const words = TOUR_STEPS.map((step) => `${step.title} ${step.body}`).join(" ");
  // The goal blocks were removed from the Ask screen; the six old theme names
  // were replaced by the painted themes. Promising either is a lie on screen.
  for (const ghost of ["goal blocks", "five blocks", "Neo-brutalism", "Luxury", "Terminal", "Editorial"]) {
    assert.ok(!words.includes(ghost), `the tour no longer mentions "${ghost}"`);
  }
  // No hard-coded counts that will drift the moment a language or a style is added.
  assert.doesNotMatch(words, /\b(thirty|thirty-three|33)\b/i, "no language count in the copy");
  assert.doesNotMatch(words, /\b(six|seven|eight) styles\b/i, "no style count in the copy");
});

test("stepping the tour is arithmetic, and it clamps", () => {
  assert.equal(tourStepLabel(0), `STEP 1 OF ${TOUR_LENGTH}`);
  assert.equal(tourStepLabel(TOUR_LENGTH - 1), `STEP ${TOUR_LENGTH} OF ${TOUR_LENGTH}`);
  assert.equal(tourNextLabel(0), "Next");
  assert.equal(tourNextLabel(TOUR_LENGTH - 1), "Start studying");
  assert.equal(tourAtStart(0), true);
  assert.equal(tourAtStart(1), false);

  // A stale `data-step` cannot open a step that does not exist or crash the card.
  assert.equal(tourStepAt(TOUR_STEPS, -5), TOUR_STEPS[0]);
  assert.equal(tourStepAt(TOUR_STEPS, 999), TOUR_STEPS[TOUR_STEPS.length - 1]);
  assert.equal(tourStepAt(TOUR_STEPS, Number.NaN), TOUR_STEPS[0]);
  assert.equal(tourStepAt(TOUR_STEPS, "2"), TOUR_STEPS[2]);
  assert.equal(tourStepAt([], 0), TOUR_STEPS[0], "an empty list falls back to the real one");

  // Arrow keys walk it, Escape closes it, and Enter is left to the focused
  // button — the step may be pointing at the question box.
  assert.equal(tourKey({ key: "ArrowRight" }), "next");
  assert.equal(tourKey({ key: "ArrowLeft" }), "back");
  assert.equal(tourKey({ key: "Escape" }), "close");
  assert.equal(tourKey({ key: "Enter" }), null);
  assert.equal(tourKey({}), null);
});

test("the card, the menu and the T key all reach the same tour", () => {
  // The card: a step counter with one square per step, and a Back that starts
  // disabled. `aria-modal="false"` and no scrim — it explains, it never blocks.
  assert.match(html, /id="first-run"[\s\S]{0,200}aria-modal="false"/);
  assert.match(html, /id="first-run-step"/);
  assert.match(html, /id="first-run-dots"/);
  assert.match(html, /id="first-run-back"[^>]*disabled/, "there is nothing behind step one");
  assert.match(html, /id="first-run-next"/);
  assert.match(html, /id="first-run-skip"/);

  // The controller: one binding pass, and the replay path shares it.
  assert.match(app, /import \{[\s\S]{0,200}\} from "\.\/tour\.js\?v=\d+"/, "the steps are data, not prose in the controller");
  assert.match(app, /function initTour\(\)/);
  assert.match(app, /initTour\(\);/);
  // …and it starts after the view has been set, so step one cannot be
  // contradicted by the `?view=` in the address bar.
  assert.match(app, /setView\(VIEW_META\[requestedView\][\s\S]{0,200}initTour\(\)/);
  assert.match(app, /if \(localStorage\.getItem\(FIRST_RUN_KEY\)\) return;/, "it is not shown twice");
  assert.match(app, /localStorage\.setItem\(FIRST_RUN_KEY, "done"\)/);
  // Replaying must not depend on the first-run flag, and must still have buttons.
  const initTour = /function initTour\(\) \{([\s\S]*?)\n\}/.exec(app)?.[1] || "";
  assert.match(initTour, /first-run-back/, "the listeners are bound every time, not only on the first run");
  assert.match(initTour, /first-run-next/);
  assert.match(initTour, /tourKey\(event\)/, "and the arrow keys work on a replay");
  // Finishing puts the student back at the question box; skipping leaves them
  // where they were, because they chose to stop there.
  assert.match(app, /endFirstRun\(\{ returnToStart: true \}\)/);
  assert.match(app, /if \(returnToStart && state\.currentView !== "start"\) setView\("start"\)/);

  // The menu row and the action behind it.
  assert.match(html, /data-action="tour"/);
  assert.match(app, /case "tour":[\s\S]{0,60}startTour\(\);/, "the menu row is wired");
  assert.match(app, /action === "tour"[\s\S]{0,40}startTour\(\)/, "and so is the key");

  // "T" is listed in the sheet the app builds its own help from.
  const viewport = read("js/viewport.js");
  assert.match(viewport, /\{ keys: \["T"\], label: [^}]+, id: "tour" \}/);
  assert.match(viewport, /if \(key === "t" \|\| key === "T"\) return "tour";/);
});

test("the tour is styled by the house, not by another product", () => {
  const glass = read("styles-glass.css");
  const tour = glass.slice(glass.indexOf("§16"));
  assert.match(tour, /\.first-run \{[\s\S]{0,400}background-color: var\(--tg-tint-strong\)/, "the card is a tile");
  assert.match(tour, /\.first-run \{[\s\S]{0,600}box-shadow: var\(--tg-rim\)/, "with the same rim as a pane");
  assert.match(tour, /border-radius: var\(--tg-r-slab\)/, "and the house corner, which is none");
  assert.match(tour, /\.tour-target \{[\s\S]{0,160}outline-color: var\(--tg-accent\)/, "the target is ringed in the accent");
  // Motion is optional, as everywhere else in this theme.
  assert.match(tour, /prefers-reduced-motion: no-preference/);
  // The card is honest about its own scale on a phone.
  assert.match(tour, /max-width: 480px/);
});
