/**
 * Reading position, as arithmetic.
 *
 * Two small things make a long screen easier to read: a hairline that shows how
 * far through it you are, and a way back to the top that appears only when it
 * would be useful. Both are one division and one comparison, so they live here,
 * away from the DOM, and are tested directly.
 *
 * The browser's own `scrollY`, `scrollHeight` and `innerHeight` are all it needs.
 */

/**
 * How far through the page are we?
 *
 * Returns 0 at the top and 1 at the bottom, clamped, and 0 when the page is too
 * short to scroll — a progress bar on a page that fits on one screen is noise.
 *
 * @param {{scrollTop?: number, scrollHeight?: number, clientHeight?: number}} input
 * @returns {{fraction: number, percent: number, scrollable: boolean, remaining: number}}
 */
export function readingState({ scrollTop = 0, scrollHeight = 0, clientHeight = 0 } = {}) {
  const travel = Math.max(0, Number(scrollHeight) - Number(clientHeight));
  const top = Math.max(0, Number(scrollTop) || 0);
  const fraction = travel > 1 ? Math.min(1, Math.max(0, top / travel)) : 0;
  return {
    fraction,
    percent: Math.round(fraction * 100),
    scrollable: travel > 1,
    remaining: Math.max(0, travel - top),
  };
}

/**
 * Should the "back to top" button be on screen?
 *
 * Two conditions, because either alone is wrong on a phone: you have to have
 * scrolled a real distance (so a small nudge does not summon a button) and there
 * has to be enough left below you to be worth returning from (so it does not sit
 * uselessly at the end of a page you have already finished).
 */
export function shouldShowToTop(
  { scrollTop = 0, scrollHeight = 0, clientHeight = 0 } = {},
  { minPixels = 480, minRemaining = 320 } = {},
) {
  const state = readingState({ scrollTop, scrollHeight, clientHeight });
  if (!state.scrollable) return false;
  if (Number(scrollTop) < minPixels) return false;
  return state.remaining >= minRemaining;
}

/** The window's own numbers, in the shape the helpers above expect. */
export function windowScrollState(target = globalThis) {
  const doc = target.document;
  const element = doc?.documentElement;
  return {
    scrollTop: target.scrollY || element?.scrollTop || 0,
    scrollHeight: Math.max(element?.scrollHeight || 0, doc?.body?.scrollHeight || 0),
    clientHeight: target.innerHeight || element?.clientHeight || 0,
  };
}

/** Respect the student's motion preference before asking for a smooth scroll. */
export function prefersReducedMotion(target = globalThis) {
  try {
    return Boolean(target.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
  } catch {
    return false;
  }
}

/**
 * The keyboard map, in one place, so the help sheet cannot drift from the code.
 *
 * Every entry is a key that really does something in this app. A shortcut sheet
 * that lists keys nobody implemented is worse than no sheet.
 */
export const SHORTCUTS = [
  { keys: ["⌘", "K"], label: "Open the menu — every screen and action", id: "menu" },
  { keys: ["/"], label: "Jump to the question box", id: "focus-ask" },
  { keys: ["?"], label: "Show this list", id: "help" },
  { keys: ["Esc"], label: "Close a menu, dialog or the sources drawer", id: "escape" },
  { keys: ["Enter"], label: "Send the question (Shift + Enter for a new line)", id: "send" },
];

/**
 * Is this keystroke a shortcut, or is the student typing?
 *
 * The single most common bug in a shortcut implementation is that "/" opens a
 * panel while someone is writing an answer. Anything typed into a field, or any
 * keystroke with a modifier held, belongs to the field or the browser.
 */
export function isTypingTarget(element) {
  if (!element) return false;
  const tag = String(element.tagName || "").toUpperCase();
  if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return true;
  if (element.isContentEditable) return true;
  // Anything inside a dialog or a menu is a control surface, not the page.
  return Boolean(element.closest?.('[role="dialog"], .command-overlay, .shortcuts-overlay, [contenteditable="true"]'));
}

/**
 * Decide what a keydown means, without touching the page.
 *
 * @returns {"menu"|"focus-ask"|"help"|"escape"|null}
 */
export function shortcutForKey(event = {}) {
  const key = String(event.key || "");
  if (event.ctrlKey || event.metaKey) {
    if (key.toLowerCase() === "k") return "menu";
    return null;
  }
  if (event.altKey) return null;
  if (isTypingTarget(event.target)) {
    // Escape still has to close things while the cursor is in a box.
    return key === "Escape" ? "escape" : null;
  }
  if (key === "/") return "focus-ask";
  if (key === "?") return "help";
  if (key === "Escape") return "escape";
  return null;
}

/**
 * How tall the question box should be for what is in it.
 *
 * A two-row box hides the second half of a long question, and a student cannot
 * proofread what they cannot see. The box grows to fit, stops at a comfortable
 * ceiling, and then scrolls — so one pasted paragraph never pushes Send off the
 * screen. Given in rows rather than pixels, because the line height belongs to
 * the stylesheet, not to this file.
 *
 * @param {{scrollHeight?: number, lineHeight?: number, border?: number}} measured
 * @param {{minRows?: number, maxRows?: number}} limits
 * @returns {{height: number, rows: number, capped: boolean}}
 */
export function fitComposerHeight(
  { scrollHeight = 0, lineHeight = 24, border = 0 } = {},
  { minRows = 2, maxRows = 8 } = {},
) {
  const line = Math.max(1, Number(lineHeight) || 24);
  const edge = Math.max(0, Number(border) || 0) * 2;
  const needed = Math.max(0, Number(scrollHeight) || 0) - edge;
  const rows = Math.min(maxRows, Math.max(minRows, Math.ceil(needed / line)));
  return { height: rows * line + edge, rows, capped: Math.ceil(needed / line) > maxRows };
}
