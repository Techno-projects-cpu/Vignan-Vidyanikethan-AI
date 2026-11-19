/**
 * The guided tour — the eight sentences that explain the app.
 *
 * This exists because the old first-run card was a list of things the app no
 * longer had. It promised "five blocks: explain a concept, quiz me, my viva is
 * coming up…" on a screen whose goal blocks had been removed, and it offered
 * "six styles — Minimal, Soft, Editorial, Luxury, Terminal and Neo-brutalism"
 * when the app now ships a painted glass theme and two legacies. A tour that
 * describes a different application is worse than no tour: the first thing a
 * student (or a judge) reads is a promise nobody kept.
 *
 * So the steps live here, next to the assertions that check them, and every one
 * of them names a screen the app really has and a control that really exists.
 * Each step also *goes* to its screen, because "look at the Library" while the
 * screen shows something else is the other half of the same mistake.
 *
 * Two rules for editing this file:
 *
 *   1. No numbers that can drift. "thirty-three languages" reads like
 *      marketing and rots the moment a language is added; "every language" does
 *      not. The only numbers left are the step counter, which is computed.
 *   2. Every `target` is a selector that exists in `index.html` today. The test
 *      suite resolves each one against the real document, so a rename in the
 *      markup breaks the tour loudly instead of silently pointing at nothing.
 *
 * Pure data and pure functions: no DOM, no imports, no network.
 */

/**
 * @typedef {object} TourStep
 * @property {string} view    The screen this step is about (`data-panel` value).
 * @property {string} title   One line, sentence case.
 * @property {string} body    Two sentences at most: what it is, why it matters.
 * @property {string} [target] What to ring with the highlight in the app.
 */

/** @type {TourStep[]} */
export const TOUR_STEPS = [
  {
    view: "ask",
    title: "Ask in your own words",
    body: "Type a question, or paste a public link. Bolt answers from the pages on this device and names the page it used, so you can check it.",
    target: "#ask-form",
  },
  {
    view: "library",
    title: "Your books become pages",
    body: "Drop in a PDF, a text file or pasted notes. They are indexed here, never uploaded, and a starter shelf is already there so nothing is empty on day one.",
    target: "#dropzone",
  },
  {
    view: "quiz",
    title: "Quiz yourself from a chapter",
    body: "Pick the book, the topic and the length. Questions are made from your own pages, and a wrong answer becomes a revise list rather than a score.",
    target: "#quiz-setup",
  },
  {
    view: "exam",
    title: "Practice the real papers",
    body: "JEE, NEET and AP EAPCET practice with pacing, marks and coverage — modelled on the paper, not scraped from one.",
    target: "#exam-panel",
  },
  {
    view: "flashcards",
    title: "Cards that come back",
    body: "Generate a deck from a chapter and review it with spaced repetition. What you get wrong returns sooner; what you know fades into the background.",
    target: "#deck-create",
  },
  {
    view: "code",
    title: "Learn to code, line by line",
    body: "Python lessons with real output, then your own code explained statement by statement — and predict-the-output before you run it.",
    target: "#code-languages",
  },
  {
    view: "progress",
    title: "Progress you can show",
    body: "Streaks, topic mastery, recent results and the class leaderboard. It is kept on this device unless you sign in.",
    target: "#stat-grid",
  },
  {
    view: "settings",
    title: "Make it yours",
    body: "Choose a style in Look & language — the painted Glass theme is the default — and pick any of the languages. Everything here also works with the Wi-Fi off.",
    target: "#style-card",
  },
];

/** How many steps there are. Computed, so it cannot disagree with the list. */
export const TOUR_LENGTH = TOUR_STEPS.length;

/**
 * The step at an index, clamped.
 *
 * The card stores its own position in a `data-step` attribute and reads it back,
 * so a stale or hand-edited value must not be able to crash the tour or open it
 * on a step that does not exist.
 *
 * @param {TourStep[]} steps
 * @param {number} index
 * @returns {TourStep}
 */
export function tourStepAt(steps, index) {
  const list = Array.isArray(steps) && steps.length ? steps : TOUR_STEPS;
  const at = Number(index);
  const safe = Number.isFinite(at) ? Math.min(Math.max(Math.round(at), 0), list.length - 1) : 0;
  return list[safe];
}

/** "STEP 3 OF 8" — the line above the title. */
export function tourStepLabel(index, total = TOUR_LENGTH) {
  const count = Math.max(1, Number(total) || TOUR_LENGTH);
  const at = Math.min(Math.max(Math.round(Number(index) || 0), 0), count - 1);
  return `STEP ${at + 1} OF ${count}`;
}

/** The forward button says what it will do: keep going, or start studying. */
export function tourNextLabel(index, total = TOUR_LENGTH) {
  const count = Math.max(1, Number(total) || TOUR_LENGTH);
  return Number(index) >= count - 1 ? "Start studying" : "Next";
}

/** True on the first step, where there is nothing to go back to. */
export function tourAtStart(index) {
  return !(Number(index) > 0);
}

/**
 * What a keystroke means while the tour is open.
 *
 * Left and Right step, Escape closes, Enter belongs to the focused button and is
 * deliberately *not* handled here — the student may be typing in the very field
 * the step is pointing at, and stealing Enter would send their question.
 *
 * @param {{key?: string}} event
 * @returns {"next"|"back"|"close"|null}
 */
export function tourKey(event = {}) {
  switch (String(event.key || "")) {
    case "ArrowRight":
      return "next";
    case "ArrowLeft":
      return "back";
    case "Escape":
      return "close";
    default:
      return null;
  }
}
