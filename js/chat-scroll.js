/**
 * Keeping the answer on screen.
 *
 * The Ask screen is a conversation, so it should behave like one: the newest
 * answer appears where you are looking, without hunting for it. The arithmetic
 * lives here rather than inside the renderer so it can be tested without a
 * browser — the repository has no browser to test with, and "scroll to the
 * bottom" was, for a long time, a single line nobody could check.
 *
 * The old behaviour was `log.scrollTop = log.scrollHeight`. Two things were
 * wrong with it:
 *
 * 1. It happens once, immediately after the messages are appended. The answer
 *    is often longer than the visible area and its layout is not final yet, so
 *    the scroll lands short and the student is left above the answer.
 * 2. When it does work, it lands on the *end* of a long answer — the last
 *    paragraph and the source chips — so the first thing a student reads is the
 *    conclusion, and the beginning has to be scrolled back to.
 *
 * So: an answer is pinned to the *top* of the reading area, a reader who has
 * deliberately scrolled up is never yanked back, and a "jump to the latest"
 * affordance appears whenever the newest answer is out of view.
 */

/** How close to the bottom still counts as "following the conversation". */
export const FOLLOWING_GAP = 140;

/** The breathing room above a pinned answer, in pixels. */
export const ANSWER_GUTTER = 14;

const clamp = (value, low, high) => Math.min(Math.max(value, low), Math.max(low, high));

const finite = (...values) => values.every((value) => Number.isFinite(value));

/**
 * Is the reader at (or near) the bottom of the conversation?
 *
 * A conversation that fits without scrolling is always "followed": there is
 * nothing to be surprised by.
 *
 * @param {{scrollTop?: number, scrollHeight?: number, clientHeight?: number, gap?: number}} box
 * @returns {boolean}
 */
export function isFollowing({ scrollTop = 0, scrollHeight = 0, clientHeight = 0, gap = FOLLOWING_GAP } = {}) {
  if (!finite(scrollTop, scrollHeight, clientHeight)) return true;
  if (scrollHeight <= clientHeight) return true;
  return scrollHeight - (scrollTop + clientHeight) <= gap;
}

/**
 * The scroll position that puts the top of the newest answer at the top of the
 * reading area.
 *
 * `contentTop` is the offset of the scrolling content's own origin, which is
 * what a negative scrollTop plus a bounding box gives you. Passing it in rather
 * than reaching for the DOM keeps this testable.
 *
 * @param {{answerTop: number, contentTop?: number, scrollHeight: number, clientHeight: number, gutter?: number}} box
 * @returns {number} a scrollTop that is always inside the scrollable range
 */
export function scrollForAnswer({ answerTop, contentTop = 0, scrollHeight, clientHeight, gutter = ANSWER_GUTTER }) {
  if (!finite(answerTop, contentTop, scrollHeight, clientHeight)) return 0;
  const offset = answerTop - contentTop - gutter;
  return clamp(Math.round(offset), 0, scrollHeight - clientHeight);
}

/**
 * The scroll position that shows the bottom of the conversation — used while
 * the typing indicator is on screen, where the interesting thing is the last
 * line, not the first.
 *
 * @param {{scrollHeight: number, clientHeight: number}} box
 * @returns {number}
 */
export function scrollForLatest({ scrollHeight = 0, clientHeight = 0 } = {}) {
  if (!finite(scrollHeight, clientHeight)) return 0;
  return Math.max(0, Math.round(scrollHeight - clientHeight));
}

/**
 * Has the newest answer drifted out of view?
 *
 * True when the reader has scrolled past the start of it (reading the middle of
 * a long answer) or when it somehow never arrived on screen at all. Either way
 * the "jump to the latest" control earns its place.
 *
 * @param {{answerTop: number, answerHeight?: number, contentTop?: number, scrollTop?: number, clientHeight?: number}} box
 * @returns {boolean}
 */
export function answerOutOfView({ answerTop, answerHeight = 0, contentTop = 0, scrollTop = 0, clientHeight = 0 } = {}) {
  if (!finite(answerTop, answerHeight, contentTop, scrollTop, clientHeight)) return false;
  if (clientHeight <= 0) return false;
  const start = answerTop - contentTop;
  const end = start + Math.max(0, answerHeight);
  const viewTop = scrollTop;
  const viewBottom = scrollTop + clientHeight;
  // A sliver of the answer counts as visible: an answer whose first line is
  // just above the fold is one the reader can already read.
  const sliver = 24;
  return start < viewTop - sliver || end < viewTop + sliver || start > viewBottom - sliver;
}

/**
 * Read the numbers this module needs from the DOM.
 *
 * Returns null when there is no layout yet — an element that is hidden, a test
 * environment, or the first frame before paint. A caller that gets null should
 * do nothing rather than scroll to a guess.
 *
 * @param {HTMLElement | null} log the scrolling element
 * @param {Element | null} answer the newest answer, if there is one
 * @returns {{answerTop: number, answerHeight: number, contentTop: number, scrollTop: number, scrollHeight: number, clientHeight: number} | null}
 */
export function readChatBox(log, answer) {
  if (!log || !answer) return null;
  const clientHeight = log.clientHeight || 0;
  if (!clientHeight) return null;
  const logRect = log.getBoundingClientRect();
  const answerRect = answer.getBoundingClientRect();
  // The content origin: where the top of the scrolled content currently sits,
  // in viewport coordinates. Both rects are in viewport coordinates too, so one
  // subtraction puts the answer in content space.
  const contentTop = logRect.top - log.scrollTop;
  return {
    answerTop: answerRect.top,
    answerHeight: answerRect.height,
    contentTop,
    scrollTop: log.scrollTop,
    scrollHeight: log.scrollHeight,
    clientHeight,
  };
}
