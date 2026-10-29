/**
 * Pro Mode — a JARVIS-style easter egg that runs on the same cited engine.
 *
 * Everything here is deterministic and local, so the activation sequence, the
 * briefing and the status report all work with no network at all. The persona
 * never changes what an answer claims: the normal pipeline still retrieves the
 * pages and attaches the citations. Pro Mode only changes the voice, the
 * chrome and the extra readouts a demo audience enjoys.
 */

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
 * ANY sentence in which the student says they are Nezaad activates Pro Mode:
 * "I am Nezaad", "I'm Nezaad from Nezaad Industries", "this is Nezaad",
 * "my name is Nezaad", "Nezaad here", "you're talking to Nezaad",
 * "main Nezaad hoon", "nenu Nezaad". Punctuation, case and polite filler do
 * not matter.
 *
 * A question *about* Nezaad Industries is still answered normally: naming
 * yourself and asking about a subject are different acts, and only the first
 * boots the easter egg.
 */
export const PRO_TRIGGER = "I am Nezaad";

/** The name, tolerant of the usual misspellings: Nezaad, Nezad, Nezaaaad. */
const NAME = "neza+d";

/**
 * An introduction, as one pattern: a self-identifying cue, at most a couple of
 * filler words, then the name. Written this way so "I am preparing for the
 * Nezaad Industries quiz" cannot slip through on proximity alone.
 */
const INTRODUCTION = new RegExp(
  "(?:\\bi am|\\bim|\\biam|\\bi m|" +
  "\\b(?:my )?names? (?:is|are)|\\bname is|" +
  "\\b(?:you can )?call me|\\brefer to me as|" +
  "\\bthis is|\\bits|\\bit is|\\bmyself|\\bits me|" +
  "\\byou are talking to|\\byoure talking to|\\byou are speaking to|\\byoure speaking to|" +
  "\\btalking to|\\bspeaking to|\\bspeaking with|\\bdealing with|" +
  "\\blogged in as|\\bsigned in as|\\blogin as|\\bsign in as|\\bsigning in as|" +
  "\\bauthorise|\\bauthorize|\\bunlock for|" +
  "\\bmain|\\bmein|\\bmera naam|\\bmera nam|" +
  "\\bnenu|\\bnene|\\bnaa peru|\\bna peru)" +
  "\\s+(?:the |a |an |one and only |real |actual |me |this |here )*" +
  `\\b${NAME}\\b`,
);

/** "Nezaad here", "Nezaad speaking", "Nezaad reporting for duty". */
const SELF_LABEL = new RegExp(
  `\\b${NAME}\\s+(?:here|speaking|reporting|calling|on the line|at your service|in the house)\\b`,
);

/** A greeting plus the full name and company, e.g. "hey, Nezaad from Nezaad Industries". */
const GREETING = /\b(?:hi|hii|hello|hey|namaste|yo|good morning|good afternoon|good evening)\b/;
const COMPANY = new RegExp(`\\b${NAME} industries\\b`);

export function matchesActivation(text = "") {
  const raw = String(text || "");
  // Long enough for a full introduction, short enough that an essay cannot
  // trip the easter egg by accident.
  if (raw.length > 400) return false;
  const line = normalizeProQuery(raw);
  if (!line.trim() || line.length > 260) return false;

  const name = new RegExp(`\\b${NAME}\\b`);
  if (!name.test(line)) return false;

  if (INTRODUCTION.test(line) || SELF_LABEL.test(line)) return true;

  // "hey nezaad from nezaad industries" — a greeting plus the full identity is
  // an introduction even without "I am"; a greeting alone is not.
  return GREETING.test(line) && COMPANY.test(line);
}

/**
 * Split an activation into the introduction and whatever else was asked.
 *
 * "I am Nezaad, explain photosynthesis" should boot the easter egg *and* still
 * answer the question, rather than swallowing it. A remainder only counts as a
 * question when it reads like one, so "I am Nezaad, nice to meet you" stays a
 * pure greeting.
 */
export function splitActivation(text = "") {
  const raw = String(text || "");
  if (!matchesActivation(raw)) return { activated: false, question: "" };

  let rest = raw;
  rest = rest.replace(/^\s*(?:hi|hii|hello|hey|namaste|yo|good\s+(?:morning|afternoon|evening))[\s,!.]*/i, "");
  rest = rest.replace(
    /\b(?:i am|im|iam|i m|my name is|my names|call me|this is|its|it is|myself|you are talking to|youre talking to|talking to|speaking to|main|mein|nenu|nene)\b[^,.;:!?]*?\bneza+d\b/i,
    " ",
  );
  rest = rest.replace(/\bneza+d\s+(?:here|speaking|reporting|calling)\b/i, " ");
  rest = rest.replace(/\b(?:from|of|at)\s+neza+d(?:\s+industries)?\b/i, " ");
  rest = rest.replace(/^[\s,.;:!?-]+/, "").replace(/^(?:and|so|now|then|please|ok|okay|also)\b[\s,]*/i, "").trim();

  if (!rest) return { activated: true, question: "" };
  const asks = /\?\s*$/.test(raw) ||
    /^(?:what|who|where|when|why|how|which|explain|define|describe|list|tell|give|show|find|summar|compare|solve|calculate|write|draw|derive|prove|state|name|why|is|are|can|could|should|would|do|does)\b/i.test(rest);
  return { activated: true, question: asks ? rest : "" };
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
