/**
 * Conversation context — the part that remembers what you were just talking
 * about.
 *
 * Before this, every question was answered as if it were the first one. A
 * student who asked "what is photosynthesis?" and then "why does it need
 * sunlight?" got an answer about sunlight in general, because the second
 * question never mentioned the first. Two things fix that, and both live here so
 * they can be tested without a browser:
 *
 *   1. `resolveQuery` recognises a question that leans on the previous one
 *      ("why?", "and the second one", "explain that again") and carries the
 *      earlier topic forward into the search — and says that it did.
 *   2. `conversationBrief` writes a few lines describing the last exchanges, so
 *      a connected model receives the conversation as text even when the
 *      provider only sees one message.
 *
 * The rules are deliberately conservative. Guessing context on a question that
 * does not need it is worse than having none: "what is 2 + 2" must not inherit
 * a topic from ten minutes ago.
 */

/** Words that mean "the thing we were just discussing". */
const REFERRING_WORDS = /\b(?:it|its|itself|this|that|these|those|they|them|their|theirs|he|him|his|she|her|hers|such)\b/i;

/** Openers that are a follow-up with no topic of their own. */
const BARE_FOLLOW_UPS = [
  /^(?:and|so|but|then|also|ok|okay|now)\b[\s,?.!]*$/i,
  /^(?:and\s+)?(?:why|how|when|where|who|which)\s*[?.!]*$/i,
  /^(?:tell|explain|say|show|give)\s+(?:me\s+)?(?:some\s+)?more\b/i,
  /^(?:more|continue|go on|next|again|repeat)\s*[?.!]*$/i,
  /^(?:explain|say|tell)\s+(?:that|it|this)\s+(?:again|once more|in (?:simple|easy) words|simply)\b/i,
  /^(?:in (?:simple|easy|short) words|simpler|elaborate|expand|detail(?:s)?|summar(?:y|ise|ize)(?:\s+(?:that|it|this))?)\s*[?.!]*$/i,
  /^(?:give|show)\s+me\s+(?:an?\s+)?(?:more\s+)?(?:example|examples|another)\b/i,
  /^(?:the\s+)?(?:first|second|third|last|next|previous)\s+(?:one|part|point|step|line)\b/i,
  /^(?:what|how)\s+about\s+(?:the\s+)?(?:second|third|last|next|previous|other)\b/i,
  /^(?:what\s+does|what\s+do)\s+(?:that|it|this)\s+mean\b/i,
];

/** The same idea in the languages the interface ships, because a student types
 *  their question in the language they are taught in. */
const MULTILINGUAL_FOLLOW_UPS = [
  /(?:^|\s)(?:इस|इसे|इसके|इसका|इसकी|उस|उसे|उसके|उसका|उसी|वही)(?=\s|$|[,.?!])/u,
  /(?:दोबारा|फिर\s+से|और\s+बताओ|आगे\s+बताओ|उदाहरण\s+दो|सरल\s+शब्दों)/u,
  /(?:దీని|దాని|దీనిపై|దానిపై|ఈ\s*అంశం|ఆ\s*అంశం|మళ్లీ|ఇంకా)/u,
  /(?:இதை|அதை|மீண்டும்|இன்னும்)/u,
  /(?:এটা|ওটা|আবার|আরো)/u,
  /(?:ಇದನ್ನು|ಅದನ್ನು|ಮತ್ತೆ|ಇನ್ನಷ್ಟು)/u,
  /(?:এটি|সেটি)/u,
];

/** "the second one", "step 3" — a pointer, not a new topic. */
const ORDINAL_POINTER = /\b(?:first|second|third|fourth|fifth|last|next|previous|other)\s+(?:one|part|point|step|line|option|reason|example|sentence|paragraph)s?\b|\bstep\s+\d+\b|\bpoint\s+\d+\b|\b(?:number|no\.?)\s*\d+\b/i;

/**
 * Does this question need the previous one to make sense?
 *
 * Returns a small object rather than a boolean so the interface can say *why*
 * it is carrying a topic over. A question that names its own subject is never a
 * follow-up, even if it contains the word "it".
 *
 * @param {string} query
 * @returns {{follows: boolean, reason: string}}
 */
export function followUpSignal(query = "") {
  const text = String(query ?? "").trim();
  if (!text) return { follows: false, reason: "empty" };
  if (/https?:\/\//i.test(text)) return { follows: false, reason: "link" };
  const words = text.split(/\s+/).filter(Boolean);
  // A long question almost always carries its own subject; treating it as a
  // follow-up would drag an old topic into a new question.
  if (words.length > 22) return { follows: false, reason: "long" };
  if (BARE_FOLLOW_UPS.some((pattern) => pattern.test(text))) return { follows: true, reason: "bare" };
  if (MULTILINGUAL_FOLLOW_UPS.some((pattern) => pattern.test(text))) return { follows: true, reason: "language" };
  if (ORDINAL_POINTER.test(text)) return { follows: true, reason: "pointer" };
  // A short question whose only subject is a pronoun: "why is it green?"
  if (REFERRING_WORDS.test(text) && words.length <= 8) return { follows: true, reason: "pronoun" };
  return { follows: false, reason: "standalone" };
}

/**
 * The most recent question that carried its own topic.
 *
 * Assistant text is never a topic, and neither is a greeting, an identity
 * question, a link or another follow-up. That keeps the carried topic the one a
 * person would name if you asked them what we were talking about.
 *
 * @param {Array<{role?: string, content?: string}>} messages
 * @returns {{text: string, index: number}}
 */
export function lastTopic(messages = []) {
  const list = Array.isArray(messages) ? messages : [];
  for (let index = list.length - 1; index >= 0; index -= 1) {
    const message = list[index];
    if (!message || message.role !== "user") continue;
    const text = String(message.content || "").trim();
    if (!text) continue;
    if (/https?:\/\//i.test(text)) continue;
    if (followUpSignal(text).follows) continue;
    if (isSmallTalk(text)) continue;
    return { text: text.slice(0, 300), index };
  }
  return { text: "", index: -1 };
}

/** Greetings and thanks are not topics, however often they are repeated. */
export function isSmallTalk(text = "") {
  const value = String(text ?? "").trim().toLowerCase();
  if (!value) return true;
  if (value.length <= 24 && /^(?:hi|hello|hey|hola|namaste|namaskar|hii+|yo|ok|okay|thanks?|thank you|thx|good (?:morning|evening|afternoon)|bye|goodbye|yes|no|sure|nice|cool|great)\b/.test(value)) {
    return true;
  }
  return /^(?:who (?:made|built|created) (?:you|this)|who are you|your name|what can you do)\b/.test(value);
}

/**
 * Resolve a new question against the conversation.
 *
 * The returned `query` is what goes to retrieval: the student's own words, plus
 * the earlier topic when the question leaned on it. Nothing is invented: the
 * topic is a previous question, quoted, not a summary.
 *
 * @param {string} query
 * @param {Array<{role?: string, content?: string}>} messages
 * @param {{maxContextChars?: number}} options
 * @returns {{query: string, usedContext: boolean, topic: string, reason: string}}
 */
export function resolveQuery(query = "", messages = [], { maxContextChars = 320 } = {}) {
  const current = String(query ?? "").trim().slice(0, 600);
  if (!current) return { query: "", usedContext: false, topic: "", reason: "empty" };
  // "ok" and "thanks" are not follow-ups: carrying a topic into them would make
  // the app answer a question the student did not ask.
  if (isSmallTalk(current)) return { query: current, usedContext: false, topic: "", reason: "small-talk" };
  const signal = followUpSignal(current);
  if (!signal.follows) return { query: current, usedContext: false, topic: "", reason: signal.reason };
  // The previous question is the one before this one, so drop the current turn
  // if the caller already appended it.
  const history = Array.isArray(messages) ? messages : [];
  const trimmed = history.length && String(history[history.length - 1]?.content || "").trim() === current
    ? history.slice(0, -1)
    : history;
  const topic = lastTopic(trimmed).text;
  if (!topic) return { query: current, usedContext: false, topic: "", reason: "no-topic" };
  // Repeating the topic inside the question is what lets a keyword search find
  // the same passages the earlier answer cited.
  const carried = topic.slice(0, maxContextChars);
  return {
    query: `${current} ${carried}`.slice(0, 900),
    usedContext: true,
    topic: carried,
    reason: signal.reason,
  };
}

/**
 * A few lines describing the conversation so far.
 *
 * Compact on purpose: the last turns, the student's question shortened, the
 * answer shortened, and nothing else. Tables, citations and markdown are left
 * alone because the model reads them fine and stripping them would lose the
 * page numbers that make the answer checkable.
 *
 * @param {Array<{role?: string, content?: string, meta?: string}>} messages
 * @param {{turns?: number, questionChars?: number, answerChars?: number, maxChars?: number}} options
 * @returns {{brief: string, turns: Array<{question: string, answer: string}>, topics: string[], count: number}}
 */
export function conversationBrief(messages = [], {
  turns = 3,
  questionChars = 180,
  answerChars = 260,
  maxChars = 1400,
} = {}) {
  const list = Array.isArray(messages) ? messages : [];
  const pairs = [];
  let pending = null;
  for (const message of list) {
    if (!message) continue;
    const content = String(message.content || "").trim();
    if (!content) continue;
    if (message.role === "user") {
      pending = content;
      continue;
    }
    if (message.role === "assistant" && pending) {
      // Chat pleasantries are not study context and would only dilute it.
      if (!["Bolt · conversation", "Bolt · casual"].includes(message.meta || "")) {
        pairs.push({ question: pending, answer: content });
      }
      pending = null;
    }
  }
  const recent = pairs.slice(-Math.max(1, turns));
  const topics = [];
  for (const pair of recent) {
    const topic = lastTopic([{ role: "user", content: pair.question }]).text;
    if (topic && !topics.includes(topic)) topics.push(topic.slice(0, 120));
  }
  if (!recent.length) return { brief: "", turns: [], topics: [], count: 0 };

  const shorten = (text, limit) => {
    const flat = String(text).replace(/\s+\n/g, "\n").replace(/[ \t]+/g, " ").trim();
    return flat.length > limit ? `${flat.slice(0, Math.max(1, limit - 1)).trimEnd()}…` : flat;
  };
  const lines = recent.map((pair, index) => {
    const question = shorten(pair.question, questionChars);
    const answer = shorten(pair.answer, answerChars);
    return `${index + 1}. Student asked: ${question}\n   You answered: ${answer}`;
  });
  let brief = `CONVERSATION SO FAR (the student can see all of it; use it to understand the new question, do not repeat it back):
${lines.join("\n")}`;
  if (brief.length > maxChars) brief = `${brief.slice(0, maxChars - 1).trimEnd()}…`;
  return { brief, turns: recent, topics, count: recent.length };
}

/**
 * The one-line label the composer shows while a follow-up is being typed.
 *
 * A student should be able to see that the app knows what "it" means, otherwise
 * carrying context over looks like the app answering a different question.
 *
 * @param {string} draft
 * @param {Array<{role?: string, content?: string}>} messages
 * @returns {string}
 */
export function contextChipLabel(draft = "", messages = []) {
  const text = String(draft ?? "").trim();
  if (!text) return "";
  const signal = followUpSignal(text);
  if (!signal.follows) return "";
  const topic = lastTopic(messages).text;
  if (!topic) return "";
  const short = topic.length > 42 ? `${topic.slice(0, 41).trimEnd()}…` : topic;
  return `Continuing: ${short}`;
}

/**
 * The pages the last answer was built from.
 *
 * When a follow-up lands on no new passage — "why?" after an answer about
 * leaves — continuing from the same pages is what a teacher does. Returning the
 * sources (never the prose) keeps every claim tied to a page the student can
 * open.
 *
 * @param {Array<{title?: string, page?: number, text?: string}>} hits
 * @returns {Array<{title: string, page: number, text: string}>}
 */
export function carryOverHits(hits = []) {
  return (Array.isArray(hits) ? hits : [])
    .filter((hit) => hit && (hit.text || hit.snippet))
    .slice(0, 4)
    .map((hit) => ({
      title: String(hit.title || "Earlier answer"),
      page: Number(hit.page) || 1,
      text: String(hit.text || hit.snippet || "").slice(0, 900),
      section: hit.section || "",
      bookId: hit.bookId || "",
    }));
}
