/**
 * The small amount of arithmetic behind the simple shell.
 *
 * The menu, the sheets and the "+" beside the question box are DOM wiring, but
 * two decisions in them are worth testing on their own: what the history list
 * shows, and when a badge is worth printing. Both are pure, so they live here.
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
