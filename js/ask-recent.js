/**
 * The two things a student needs before they have typed anything: what they were
 * doing last, and how this week is going.
 *
 * Neither is new data. The questions are already in the message log and the
 * streak is already in progress; what was missing was a place that puts them in
 * front of the student instead of behind a menu. Both functions here are pure so
 * the rules can be tested without a browser: what counts as "recent", what is
 * de-duplicated, and what is deliberately not shown.
 */

/** How many questions the Continue row offers. Three is a choice, six is a list. */
export const CONTINUE_LIMIT = 3;

const clean = (value) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

/** A question as it should read in a chip: one line, short, no markdown. */
export function chipLabel(question = "", limit = 46) {
  const text = clean(question).replace(/[*_`#]/g, "");
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1).trimEnd()}…`;
}

/**
 * The last few questions, newest first, without repeats.
 *
 * Rules, each of which exists because of a way this row could be useless:
 *   1. Only the student's own messages. An assistant reply is not a question.
 *   2. No duplicates — asking the same thing twice yesterday should not fill the
 *      row with one question.
 *   3. Never the question that is already in the composer.
 *   4. One-word questions are dropped: "hi" is not something to continue.
 *   5. The greeting is not a question, even though it is a message.
 */
export function recentQuestions(messages = [], { limit = CONTINUE_LIMIT, skip = "" } = {}) {
  const skipText = clean(skip).toLowerCase();
  const seen = new Set();
  const questions = [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || message.role !== "user") continue;
    const text = clean(message.content);
    if (text.length < 8) continue;
    const key = text.toLowerCase();
    if (seen.has(key) || (skipText && key === skipText)) continue;
    seen.add(key);
    questions.push({ id: message.id || key, text, at: message.createdAt || "" });
    if (questions.length >= Math.max(0, limit)) break;
  }
  return questions;
}

/** "just now", "2 hours ago", "yesterday", "4 days ago" — short and honest. */
export function whenText(iso = "", now = Date.now()) {
  const at = Date.parse(iso || "");
  if (!at) return "";
  const minutes = Math.floor((now - at) / 60000);
  if (minutes < 2) return "just now";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "an hour ago" : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

/** True when the two dates fall on the same local day. */
export function sameDay(a, b) {
  const one = new Date(a);
  const two = new Date(b);
  if (Number.isNaN(one.getTime()) || Number.isNaN(two.getTime())) return false;
  return one.getFullYear() === two.getFullYear() && one.getMonth() === two.getMonth() && one.getDate() === two.getDate();
}

/**
 * The strip above the composer: a streak, and how many questions were asked
 * today. Both are counted from what this device already stores, so it is honest
 * with the network off, and it says nothing at all rather than "0 questions"
 * when there is nothing to say.
 */
export function todaySummary({ messages = [], streak = 0, now = Date.now() } = {}) {
  const asked = messages.filter((message) => message?.role === "user" && sameDay(message.createdAt, now)).length;
  const bits = [];
  if (streak > 0) bits.push(`${streak} day streak`);
  if (asked > 0) bits.push(`${asked} question${asked === 1 ? "" : "s"} today`);
  return { asked, streak: Math.max(0, Number(streak) || 0), text: bits.join(" · "), empty: bits.length === 0 };
}
