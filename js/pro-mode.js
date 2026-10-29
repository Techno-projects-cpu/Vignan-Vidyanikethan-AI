/**
 * Pro Mode — a JARVIS-style easter egg that runs on the same cited engine.
 *
 * Everything here is deterministic and local, so the activation sequence, the
 * briefing and the status report all work with no network at all. The persona
 * never changes what an answer claims: the normal pipeline still retrieves the
 * pages and attaches the citations. Pro Mode only changes the voice, the
 * chrome and the extra readouts a demo audience enjoys.
 */

export const PRO_TRIGGER = "Hi, I am Nezaad, from Nezaad Industries";

export const PRO_ACRONYM = [
  ["V", "Virtual"],
  ["I", "Intelligent"],
  ["G", "Guidance"],
  ["N", "Navigation"],
  ["A", "Assistance"],
  ["N", "Network"],
];

export const PRO_NAME = `${PRO_ACRONYM.map(([letter]) => letter).join(".")}.`;

/** Lowercase, strip punctuation, collapse spaces: the phrase survives typos in punctuation. */
export function normalizeProQuery(text = "") {
  return ` ${String(text || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
}

/**
 * The easter egg phrase, tolerant of punctuation, case and a missing greeting:
 * "Hi, I am Nezaad, from Nezaad Industries" / "hey i'm nezaad from nezaad
 * industries" / "I am Nezaad from Nezaad Industries."
 */
export function matchesActivation(text = "") {
  const line = normalizeProQuery(text);
  if (line.length > 120) return false;
  const hasName = /\bnezaad\b/.test(line);
  const hasCompany = /\bnezaad industries\b/.test(line);
  if (!hasName || !hasCompany) return false;
  // The name has to be introduced ("I am", "I'm", "this is") or greeted, so a
  // question *about* Nezaad Industries is still answered normally.
  const introducing = /\b(i am|im|this is|its|my name is)\b/.test(line);
  const greeting = /\b(hi|hii|hello|hey|namaste|yo|good morning|good afternoon|good evening)\b/.test(line);
  return introducing || greeting;
}

export function matchesPowerDown(text = "") {
  const line = normalizeProQuery(text);
  if (line.trim().length > 48) return false;
  // A command, not a question that happens to contain the words.
  return /^ (?:please |can you |could you )?(?:power down|deactivate|shut down|shutdown|exit pro mode|stand down|pro mode off)\b/.test(line);
}

export function matchesStatusQuery(text = "") {
  const line = normalizeProQuery(text);
  if (line.trim().length > 48) return false;
  return /^ (?:please |can you |could you )?(?:run )?(?:status report|diagnostics|diagnostic check|system status|systems check|status check)\b/.test(line);
}

/** "Good evening, Nezaad." in the student's own time zone. */
export function proGreeting(date = new Date(), name = "Nezaad") {
  const hour = date.getHours();
  const part = hour < 5 ? "Working late" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : hour < 21 ? "Good evening" : "Good evening";
  return `${part}, ${name}.`;
}

function plural(count, one, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * Boot lines for the activation animation. Real numbers, so the sequence is a
 * genuine readout and not decoration.
 */
export function proBootLines({ books = 0, pages = 0, dueCards = 0, decks = 0, streaks = 0, offline = false, model = "local engine" } = {}) {
  return [
    `> voiceprint recognised · NEZAAD`,
    `> ${PRO_NAME} · ${PRO_ACRONYM.map(([, word]) => word).join(" ")}`,
    `> library: ${plural(books, "book")} · ${plural(pages, "page")}`,
    `> revision: ${plural(decks, "deck")} · ${plural(dueCards, "card")} due`,
    `> answer route: ${offline ? "offline engine (no network needed)" : model}`,
    `> streak: ${plural(streaks, "day")}`,
    `> citations: enforced`,
    `> PRO MODE`,
  ];
}

/** The first message after activation: greeting, readout, and what it can do. */
export function proBriefing(status = {}, { date = new Date() } = {}) {
  const name = status.name || "Nezaad";
  const lines = [
    `${proGreeting(date, name)} **Pro Mode engaged.**`,
    "",
    `I am **${PRO_NAME}** — ${PRO_ACRONYM.map(([letter, word]) => `**${letter}**${word.slice(1)}`).join(" ")} — the same cited engine you were already using, with the lights on.`,
    "",
    "## Systems",
    `- Library: ${plural(status.books || 0, "book")}, ${plural(status.pages || 0, "page")} searchable`,
    `- Revision: ${plural(status.decks || 0, "deck")}, ${plural(status.dueCards || 0, "card")} due today`,
    `- Answer route: ${status.offline ? "offline engine — this works with no internet" : status.model || "local engine"}`,
    `- Streak: ${plural(status.streaks || 0, "day")}${status.accuracy ? ` · quiz accuracy ${status.accuracy}%` : ""}`,
    "",
    "## Standing orders",
    "- Ask me anything from your own books and I will answer with page citations.",
    "- Say **status report** for a fresh readout, **power down** to return to normal.",
    "- Nothing is invented: if the pages do not contain it, I say so.",
    "",
    "_A school project, not a film prop. Pro Mode is an easter egg built on the same textbook engine._",
  ];
  return lines.join("\n");
}

/** A short readout for "status report" / "run diagnostics". */
export function proStatusReport(status = {}) {
  const lines = [
    "## Status report",
    `- Books indexed: **${status.books || 0}** (${plural(status.pages || 0, "page")})`,
    `- Revision decks: **${status.decks || 0}** · due today: **${status.dueCards || 0}**`,
    `- Quizzes finished: **${status.quizzes || 0}** · accuracy: **${status.accuracy || 0}%**`,
    `- Streak: **${plural(status.streaks || 0, "day")}**`,
    `- Answer route: **${status.offline ? "offline engine" : status.model || "local engine"}**`,
    `- Network: **${status.offline ? "not required" : "available"}**`,
    "",
    status.books
      ? "All systems nominal. Ask a question whenever you are ready."
      : "One thing is missing: add a chapter in Library and my answers get their citations.",
  ];
  return lines.join("\n");
}

/** Label used in the message metadata so the persona is visible in the log. */
export const PRO_META = "VIGNAN PRIME · pro mode";

/** The typing line while Pro Mode is on. */
export const PRO_TYPING = "Compiling from your pages…";
