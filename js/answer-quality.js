/**
 * Answer-quality helpers: how long an answer should be, whether it kept its
 * citations, and what the student should do next.
 *
 * Pure functions only, so the behaviour is unit-tested without a browser and
 * works offline. None of this changes a fact — it changes shape and honesty.
 */

export const DEPTHS = [
  { id: "brief", label: "Brief", hint: "One short answer, about 80 words." },
  { id: "balanced", label: "Balanced", hint: "A clear answer with the key steps." },
  { id: "exam", label: "Exam", hint: "A model exam answer with labelled points." },
];

export const DEFAULT_DEPTH = "balanced";

export function normalizeDepth(value) {
  return DEPTHS.some((depth) => depth.id === value) ? value : DEFAULT_DEPTH;
}

/** Appended to the model prompt so length and shape are deliberate. */
export function depthDirective(depth = DEFAULT_DEPTH) {
  switch (normalizeDepth(depth)) {
    case "brief":
      return "LENGTH: brief. Answer in at most 80 words, one short paragraph or three bullet points, with citations. No preamble.";
    case "exam":
      return [
        "LENGTH: model exam answer, 180-260 words, in this shape:",
        "1. **Definition** — a one-sentence definition with a citation.",
        "2. **Key points** — 3 to 5 numbered points, each cited.",
        "3. **Formula or example** — include it only if a passage contains one.",
        "4. **Examiner note** — one closing line naming the detail students usually miss.",
        "Do not add facts that are not in the passages.",
      ].join("\n");
    default:
      return "LENGTH: balanced. 110-180 words. Lead with the answer, then the reasoning in short steps, each with a citation. Use a list only when the passage is itself a list.";
  }
}

/**
 * How much of a written answer actually points at a page.
 * Returns sentence counts plus a 0-1 ratio; a short answer with one citation
 * is not penalised for being short.
 */
export function citationCoverage(text = "") {
  const lines = String(text || "")
    .replace(/```[\s\S]*?```/g, " ")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  // This app writes the marker after the full stop — "... p. 4. [1]". A bare
  // marker on its own line belongs to the sentence above it; without this it
  // was thrown away and a fully cited answer measured as uncited.
  const sentences = [];
  const marker = "(?:\\[\\d+\\]|\\[W\\d+\\])";
  for (const line of lines) {
    // A marker may sit at the end of a sentence ("... p. 4. [1]") or at the
    // start of the next one after a full stop; both cite the sentence before.
    const leading = line.match(new RegExp(`^(?:${marker}\\s*)+`));
    if (leading && sentences.length) {
      sentences[sentences.length - 1] += ` ${leading[0].trim()}`;
      const rest = line.slice(leading[0].length).trim();
      if (rest) sentences.push(rest);
      continue;
    }
    if (new RegExp(`^(?:${marker})+$`).test(line) && sentences.length) {
      sentences[sentences.length - 1] += ` ${line}`;
      continue;
    }
    sentences.push(line);
  }
  const counted = sentences.filter((line) => line.length > 24 && !/^\|/.test(line) && !/^[-*]\s*$/.test(line));
  if (!counted.length) return { sentences: 0, cited: 0, ratio: 0 };
  const cited = counted.filter((line) => /\[\d+\]|\[W\d+\]/.test(line)).length;
  return { sentences: counted.length, cited, ratio: cited / counted.length };
}

/**
 * True when a written answer leans on too many uncited claims to present as a
 * grounded answer. Short answers are exempt: one sentence cannot be "mostly
 * uncited" in any meaningful way.
 */
export function looksUncited(text = "", { minimumSentences = 4, threshold = 0.5 } = {}) {
  const coverage = citationCoverage(text);
  if (coverage.sentences < minimumSentences) return false;
  return coverage.ratio < threshold;
}

/**
 * The next sensible moves after an answer. Each one is something this app can
 * actually do, which is why they are prompts and actions rather than moods.
 */
export function followUpsFor({ query = "", mode = "answer", hits = [], hasSheet = false, depth = DEFAULT_DEPTH } = {}) {
  const topic = cleanTopic(query);
  const grounded = hits.length > 0;
  const chips = [];

  if (grounded && mode !== "explain" && depth !== "exam") {
    chips.push({ id: "explain", label: "Explain step by step", prompt: `Explain step by step: ${topic}`, mode: "explain" });
  }
  if (depth !== "exam") {
    chips.push({ id: "exam", label: "Model exam answer", prompt: `Write a model exam answer: ${topic}`, mode: "answer", depth: "exam" });
  }
  if (!hasSheet) {
    chips.push({ id: "sheet", label: "Key terms sheet", prompt: `Key terms of ${topic}`, mode: "answer" });
  }
  if (grounded) {
    chips.push({ id: "quiz", label: "Quiz me on this", action: "quiz" });
  }
  return chips.slice(0, 3);
}

/** Keep a quoted topic short and free of the request wording. */
function cleanTopic(query = "") {
  const text = String(query || "")
    .replace(/^(please\s+)?(can you\s+)?(key ?terms?|keywords?|study sheet|cheat sheet|formula sheet|revision notes?|glossary)\s+(of|for|on|in)\s+/i, "")
    .replace(/^(please\s+)?(can you\s+)?(explain|tell me|what is|what are|how does|why is|why do|write a model exam answer( for| on)?)\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const trimmed = text || String(query || "").trim();
  return trimmed.length > 90 ? `${trimmed.slice(0, 87).trimEnd()}…` : trimmed;
}

/**
 * Which words of the question a cited passage actually repeats.
 *
 * Shown under a source card so "why is this page here?" has an answer the
 * student can check themselves. An empty list is information too: the page came
 * back for its neighbours, not for its words.
 */
export function matchedTerms(query = "", text = "", limit = 4) {
  const haystack = String(text || "").toLowerCase();
  if (!haystack.trim()) return [];
  return queryTerms(query, 8).filter((term) => haystack.includes(term)).slice(0, limit);
}

/* ------------------------------------------------------------------------- */
/* Do the citations point at anything?                                      */
/* ------------------------------------------------------------------------- */

/**
 * Every `[n]` and `[Wn]` marker in a written answer.
 *
 * `[n](url)` is a Markdown link, not a citation, so it is skipped. Anything the
 * model writes that is not a marker is ignored: this counts pointers, it does
 * not judge prose.
 */
export function citedMarkers(text = "") {
  const body = String(text || "").replace(/```[\s\S]*?```/g, " ");
  const library = [...new Set([...body.matchAll(/\[(\d+)\](?!\()/g)].map((m) => Number(m[1])))]
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  const web = [...new Set([...body.matchAll(/\[W(\d+)\]/gi)].map((m) => Number(m[1])))]
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  return { library, web };
}

/**
 * Compare the citations an answer uses with the passages that were open.
 *
 * A connected model is told to cite by number. If it writes `[4]` when four
 * passages were not supplied, that line is not backed by anything the student
 * owns — and a student cannot see that by looking at the page. The panel can.
 */
export function citationAudit(text = "", sources = []) {
  const { library, web } = citedMarkers(text);
  const available = sources
    .map((source) => Number(source?.n))
    .filter((n) => Number.isFinite(n) && n > 0);
  return {
    library,
    web,
    available,
    unknown: library.filter((n) => !available.includes(n)),
    used: available.filter((n) => library.includes(n)),
    unused: available.filter((n) => !library.includes(n)),
  };
}

/** One plain sentence for a citation that points at nothing. Empty when fine. */
export function citationWarning(audit) {
  if (!audit?.unknown?.length) return "";
  const marks = audit.unknown.map((n) => `[${n}]`).join(", ");
  const open = audit.available.length;
  const noun = open === 1 ? "passage was" : "passages were";
  return `_This answer cites ${marks}, but only ${open} ${noun} open. Treat those lines as unchecked — they did not come from your books._`;
}

/** "2 of 3 pages cited" for the meta line, or "" when there is nothing to say. */
export function citationSummary(audit) {
  if (!audit?.available?.length || !audit.used.length) return "";
  if (!audit.unused.length) return `all ${audit.available.length} pages cited`;
  return `${audit.used.length} of ${audit.available.length} pages cited`;
}

/* ------------------------------------------------------------------------- */
/* Naming what is missing, and checking what a model added                      */
/* ------------------------------------------------------------------------- */

const STOP = new Set((
  "the a an and or but of in on at to for from with without into onto about as is are was were be been being do does did " +
  "can could should would will shall may might must i you he she it we they me my your our their this that these those " +
  "what why how when where which who whom whose please explain describe tell show give make write list define compare " +
  "difference between step steps work works mean means example examples question answer book books page pages chapter " +
  "class subject topic notes note help need want know understand using use used also more most very much many any some"
).split(/\s+/));

/**
 * The words a student actually typed that mean something.
 *
 * These are the words a refusal should name back to them: "I could not find
 * entropy in your books" is actionable; "I could not find this" is not.
 */
export function queryTerms(query = "", limit = 4) {
  const words = String(query || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  const seen = new Set();
  const terms = [];
  for (const word of words) {
    if (word.length < 4 || STOP.has(word) || seen.has(word)) continue;
    seen.add(word);
    terms.push(word);
    if (terms.length >= limit) break;
  }
  return terms;
}

/**
 * Which of the student's words never appear in what was retrieved.
 *
 * Used only when retrieval already decided it could not answer, so this is an
 * explanation of a refusal that has happened, never a reason to refuse.
 */
export function missingTerms(query = "", hits = []) {
  const terms = queryTerms(query);
  if (!terms.length) return [];
  const haystack = hits
    .map((hit) => `${hit?.text || hit?.quote || ""} ${hit?.section || ""} ${hit?.title || ""}`)
    .join(" ")
    .toLowerCase();
  if (!haystack.trim()) return terms;
  return terms.filter((term) => !haystack.includes(term));
}

/**
 * Numbers a written answer states that no cited page contains.
 *
 * The offline engine only quotes, so it cannot invent "9.8 m/s²". A connected
 * model can, and that is exactly the failure a citation is supposed to prevent.
 * This returns the offending numbers so the UI can say so plainly instead of
 * implying every figure came from the student's book.
 *
 * Years, small counts and mark values ("Question 3", "5 marks") are ignored:
 * they are about the lesson, not about the physics.
 */
export function ungroundedNumbers(text = "", sources = []) {
  const clean = String(text || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[\d+\]|\[W\d+\]/g, " ");
  const found = clean.match(/-?\d+(?:\.\d+)?(?:\s?[×x]\s?10\s?\^?\s?-?\d+)?/g) || [];
  const pageText = sources
    .map((source) => `${source?.text || ""} ${source?.quote || ""}`)
    .join(" ")
    .replace(/\s+/g, " ");
  const seen = new Set();
  const missing = [];
  for (const raw of found) {
    const value = raw.replace(/\s+/g, "");
    if (seen.has(value)) continue;
    seen.add(value);
    const bare = value.replace(/[×x]10\^?-?\d+$/, "");
    const number = Number(bare);
    // Small integers are almost always counts ("two examples", "Question 3").
    if (Number.isFinite(number) && Math.abs(number) < 100 && Number.isInteger(number)) continue;
    if (pageText.includes(bare) || pageText.includes(value)) continue;
    missing.push(value);
    if (missing.length >= 5) break;
  }
  return missing;
}
