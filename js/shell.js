/**
 * The small amount of arithmetic behind the simple shell.
 *
 * The menu, the sheets and the "+" beside the question box are DOM wiring, but
 * a few decisions in them are worth testing on their own: what the history list
 * shows, when a badge is worth printing, and when a finger dragged in from the
 * edge of the screen was asking for the menu rather than scrolling. They are
 * all pure, so they live here.
 */

/**
 * History, newest first.
 *
 * Only the student's own questions — an answer list would be a different
 * feature and would read like a conversation list the app does not have.
 *
 * @param {Array<{role?: string, content?: string, createdAt?: string}>} messages
 * @param {{limit?: number, maxLength?: number}} options
 * @returns {Array<{text: string, full: string, when: string}>}
 */
export function historyItems(messages = [], { limit = 40, maxLength = 120 } = {}) {
  const asked = (Array.isArray(messages) ? messages : [])
    .filter((message) => message && message.role === "user" && String(message.content || "").trim())
    .reverse();
  return asked.slice(0, Math.max(0, limit)).map((message) => {
    const full = String(message.content || "").trim();
    const text = full.length > maxLength ? `${full.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…` : full;
    return { text, full, when: timestampLabel(message.createdAt) };
  });
}

/** A date a student can read, or an empty string when the date is nonsense. */
export function timestampLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

/**
 * What a badge should say. "0", blank and missing all mean "nothing to show",
 * so a menu item never carries a lonely zero next to it.
 */
export function badgeText(value) {
  const text = String(value ?? "").trim();
  return text === "" || text === "0" ? "" : text;
}

/** The suggestion chips: the first few goal cards, and only while the chat is empty. */
export function chatStarters(cards = [], { hasConversation = false, limit = 4 } = {}) {
  if (hasConversation) return [];
  return (Array.isArray(cards) ? cards : []).slice(0, Math.max(0, limit));
}

/** True when the conversation has anything the student asked. */
export function hasConversation(messages = []) {
  return (Array.isArray(messages) ? messages : []).some((message) => message?.role === "user");
}

/**
 * Was that drag a swipe, and which way?
 *
 * A left-to-right drag that starts within a finger's width of the left edge
 * opens the drawer; a drag back towards that edge closes it. Anything more
 * vertical than horizontal is a scroll and must be left alone, or the app
 * would steal the gesture a student uses to read a long answer.
 *
 * Returns "open", "close" or null. Right-to-left pages mirror every direction.
 *
 * @param {{startX?: number, startY?: number, x?: number, y?: number, width?: number,
 *          rtl?: boolean, open?: boolean, edgeZone?: number, threshold?: number}} input
 * @returns {"open"|"close"|null}
 */
export function edgeSwipeIntent({
  startX,
  startY,
  x,
  y,
  width,
  rtl = false,
  open = false,
  edgeZone = 28,
  threshold = 48,
} = {}) {
  if (![startX, startY, x, y, width].every((value) => Number.isFinite(value))) return null;
  if (width <= 0) return null;
  const fromEdge = rtl ? startX >= width - edgeZone : startX <= edgeZone;
  // An open drawer can be swiped shut from anywhere on it; a closed one can
  // only be pulled open from the edge, so a horizontal flick mid-page keeps
  // doing whatever it was doing.
  if (!open && !fromEdge) return null;
  const dx = x - startX;
  const dy = y - startY;
  if (Math.abs(dy) >= Math.abs(dx)) return null;
  if (open) return (rtl ? dx >= threshold : dx <= -threshold) ? "close" : null;
  return (rtl ? dx <= -threshold : dx >= threshold) ? "open" : null;
}

/**
 * Wire that decision to real touch events.
 *
 * Kept here rather than inline in the app so it can be driven by ordinary
 * objects in a test: anything with `addEventListener` works, and the four
 * listeners are the whole surface. Returns a function that unbinds them.
 *
 * @param {{addEventListener: Function, removeEventListener?: Function}} target
 * @param {{onOpen?: Function, onClose?: Function, isOpen?: Function, rtl?: Function,
 *          zone?: number, threshold?: number, width?: Function}} options
 * @returns {() => void}
 */
export function bindEdgeSwipe(target, {
  onOpen,
  onClose,
  isOpen = () => false,
  rtl = () => false,
  zone = 28,
  threshold = 48,
  width = () => 1024,
} = {}) {
  if (!target || typeof target.addEventListener !== "function") return () => {};
  let start = null;
  const end = () => { start = null; };
  const onStart = (event) => {
    const touches = event?.touches;
    if (!touches || touches.length !== 1) { end(); return; }
    const touch = touches[0];
    if (!Number.isFinite(touch?.clientX) || !Number.isFinite(touch?.clientY)) { end(); return; }
    start = {
      startX: touch.clientX,
      startY: touch.clientY,
      open: Boolean(isOpen()),
      rtl: Boolean(rtl()),
    };
  };
  const onMove = (event) => {
    if (!start) return;
    const touch = event?.touches?.[0];
    if (!touch) return;
    const intent = edgeSwipeIntent({
      ...start,
      x: touch.clientX,
      y: touch.clientY,
      width: width(),
      edgeZone: zone,
      threshold,
    });
    if (!intent) return;
    end();
    if (intent === "open") { if (typeof onOpen === "function") onOpen(); }
    else if (typeof onClose === "function") onClose();
  };
  const options = { passive: true };
  target.addEventListener("touchstart", onStart, options);
  target.addEventListener("touchmove", onMove, options);
  target.addEventListener("touchend", end, options);
  target.addEventListener("touchcancel", end, options);
  return () => {
    if (typeof target.removeEventListener !== "function") return;
    target.removeEventListener("touchstart", onStart);
    target.removeEventListener("touchmove", onMove);
    target.removeEventListener("touchend", end);
    target.removeEventListener("touchcancel", end);
  };
}

/**
 * How tall is the part of the window a student can actually see?
 *
 * On a phone with the keyboard open, `visualViewport` reports the slice above
 * the keyboard, and `offsetTop` says where that slice starts. A conversation
 * pinned with `position: fixed; inset: 0` uses the *window*, so the question
 * box ends up behind the keyboard exactly while someone is typing. This turns
 * the two numbers into the box the chat layer should occupy.
 *
 * Anything that is not a usable measurement — a missing API, a zero, a value
 * from the middle of a pinch — falls back to the window.
 *
 * @param {{viewportHeight?: number, viewportOffset?: number, innerHeight?: number}} input
 * @returns {{height: string, top: string, keyboard: number}}
 */
export function viewportBox({ viewportHeight, viewportOffset, innerHeight } = {}) {
  const window_ = Number.isFinite(innerHeight) && innerHeight > 0 ? Math.round(innerHeight) : 0;
  const visible = Number.isFinite(viewportHeight) && viewportHeight > 120 ? Math.round(viewportHeight) : 0;
  if (!visible) return { height: window_ ? `${window_}px` : "100dvh", top: "0px", keyboard: 0 };
  const offset = Number.isFinite(viewportOffset) && viewportOffset > 0 ? Math.round(viewportOffset) : 0;
  const height = window_ ? Math.min(visible, window_) : visible;
  return { height: `${height}px`, top: `${offset}px`, keyboard: Math.max(0, window_ - height) };
}
