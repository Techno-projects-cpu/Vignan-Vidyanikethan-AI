/**
 * Cited study sheets: key terms, formulas and dates pulled out of the student's
 * own textbook pages.
 *
 * Nothing here writes new facts. It finds the sentences that already define a
 * term, state a formula or give a date, and groups them so revision is quicker
 * than re-reading a chapter. Every entry keeps its page and its exact sentence,
 * so the sheet can be checked against the book.
 *
 * Three small extractors run over the same passages:
 *   - terms    "Photosynthesis is the process by which …"  → term + definition
 *   - formulas "Force = mass × acceleration" / "v = u + at" → formula + meaning
 *   - dates    "The Sepoy Mutiny began in 1857 …"          → when + sentence
 */

const DEFINITION_VERBS = /\b(is|are|means|refers to|is called|are called|is defined as|can be defined as)\b/i;
const FORMULA_HINT = /(=|[÷×]|\bper\b|\bproportional to\b|\bratio\b|\bequals\b)/i;
const DATE_HINT = /\b(1[0-9]{3}|20[0-9]{2})\b|\b(BCE?|CE|AD)\b/;
const STOP_TERMS = new Set(
  "the a an this that these those it its they their there here we you he she i also however therefore because so and but or if when where which who what how why than then thus hence equation reaction process formula value result definition example figure table statement rule method way step case thing".split(
    /\s+/,
  ),
);

/** Split a definition sentence into the term and what follows it. */
function definitionOf(sentence) {
  const match = sentence.match(/^(.{2,70}?)\s+(is|are|means|refers to|is called|are called|is defined as|can be defined as)\s+(.{10,})$/i);
  if (!match) return null;
  const rawTerm = match[1].replace(/^(the|a|an)\s+/i, "").replace(/[.,;:]$/, "").trim();
  const term = rawTerm;
  if (!term || STOP_TERMS.has(term.toLowerCase()) || STOP_TERMS.has(term.toLowerCase().split(/\s+/).pop()) || term.split(/\s+/).length > 6) return null;
  // A definition should not be a question or a list of half-words.
  if (/[?]/.test(term)) return null;
  // "Photosynthesis — the process by which …" reads better than keeping the verb.
  const definition = match[3].replace(/\s+/g, " ").trim();
  if (definition.length < 12) return null;
  return { term, definition };
}

/** A formula line, kept verbatim so the symbols stay intact. */
function formulaOf(sentence) {
  if (!FORMULA_HINT.test(sentence)) return null;
  const trimmed = sentence.trim();
  if (trimmed.length < 8 || trimmed.length > 320) return null;
  // Prefer a real assignment ("F = m a") over prose that merely uses "is".
  // The left-hand side of a formula is short and has no verb in it.
  const parts = trimmed.split("=");
  if (parts.length === 2) {
    const left = parts[0].replace(/^(the|a|an)\s+(equation|formula|relation|expression)\s+(is|for)\s+/i, "").trim();
    const right = parts[1].replace(/[.;]$/, "").trim();
    if (left && left.length <= 32 && !/\b(is|are|was|were|means|explains)\b/i.test(left) && right.length <= 60) {
      return `${left} = ${right}`.replace(/\s+/g, " ").trim();
    }
  }
  if (/\bproportional to\b/i.test(trimmed) && trimmed.length <= 160) return trimmed;
  return null;
}

/** "1857" or "1947 CE" with a little context, for history revision. */
function dateOf(sentence) {
  const match = sentence.match(DATE_HINT);
  if (!match) return null;
  const year = match[0];
  // The sentence should be about something, not just a page number.
  if (sentence.replace(/[^A-Za-z\u0900-\u0DFF\u0B80-\u0BFF\u0C00-\u0C7F\u0980-\u09FF]/g, "").length < 12) return null;
  return { year, sentence: sentence.trim() };
}

function clean(text = "") {
  return String(text).replace(/\s+/g, " ").trim();
}

function pageOf(hit) {
  return hit?.page ?? hit?.pageNumber ?? null;
}

/**
 * Build a sheet from retrieved passages.
 *
 * `hits` is the same shape the Ask view already produces: `{ text, page, title,
 * section }`. Duplicates are removed by their leading words, so one definition
 * quoted in three overlapping passages appears once.
 */
export function buildStudySheet(hits = [], { topic = "", limit = 12 } = {}) {
  const terms = [];
  const formulas = [];
  const dates = [];
  const seen = new Set();
  const seenFormula = new Set();
  const seenDate = new Set();

  const sentences = [];
  for (const hit of hits) {
    for (const sentence of String(hit?.text || "").split(/(?<=[.!?۔।])\s+/)) {
      const text = clean(sentence);
      if (text.length < 25) continue;
      sentences.push({ text, page: pageOf(hit), title: clean(hit?.title || ""), section: clean(hit?.section || "") });
    }
  }

  for (const entry of sentences) {
    if (terms.length < limit) {
      const found = definitionOf(entry.text);
      if (found) {
        const key = found.term.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          terms.push({ term: found.term, definition: found.definition, quote: entry.text, page: entry.page, section: entry.section, title: entry.title });
        }
      }
    }
    if (formulas.length < limit) {
      const found = formulaOf(entry.text);
      if (found) {
        const key = found.toLowerCase().replace(/\s+/g, "");
        if (!seenFormula.has(key)) {
          seenFormula.add(key);
          formulas.push({ formula: found, quote: entry.text, page: entry.page, section: entry.section, title: entry.title });
        }
      }
    }
    if (dates.length < limit) {
      const found = dateOf(entry.text);
      if (found) {
        const key = `${found.year}:${entry.text.slice(0, 40)}`;
        if (!seenDate.has(key)) {
          seenDate.add(key);
          dates.push({ year: found.year, quote: found.sentence, page: entry.page, section: entry.section, title: entry.title });
        }
      }
    }
  }

  const pageList = [...new Set(sentences.map((entry) => entry.page).filter((page) => page !== null && page !== undefined))];
  return {
    topic,
    terms: terms.slice(0, limit),
    formulas: formulas.slice(0, limit),
    dates: dates.slice(0, limit),
    pages: pageList,
    empty: !terms.length && !formulas.length && !dates.length,
  };
}

const cite = (page) => (page === null || page === undefined ? "book passage" : `page ${page}`);

/** A printable, copy-pasteable sheet. Markdown so it survives WhatsApp too. */
export function studySheetMarkdown(sheet = {}) {
  const lines = [`# Study sheet${sheet.topic ? `: ${sheet.topic}` : ""}`, ""];
  if (sheet.empty) {
    lines.push("No definitions, formulas or dates were found in the matched passages. Try naming the chapter, or open the chapter in Library first.");
    return lines.join("\n");
  }
  if (sheet.terms?.length) {
    lines.push("## Key terms");
    for (const entry of sheet.terms) {
      lines.push(`- **${entry.term}** — ${clean(entry.definition).replace(/[.。]$/, "")}. _(${cite(entry.page)})_`);
    }
    lines.push("");
  }
  if (sheet.formulas?.length) {
    lines.push("## Formulas and relations");
    for (const entry of sheet.formulas) lines.push(`- \`${entry.formula}\` _(${cite(entry.page)})_`);
    lines.push("");
  }
  if (sheet.dates?.length) {
    lines.push("## Dates to remember");
    for (const entry of sheet.dates) lines.push(`- **${entry.year}** — ${clean(entry.quote)} _(${cite(entry.page)})_`);
    lines.push("");
  }
  lines.push("_Every line above is quoted or derived from your own book pages. Check the page before you memorise it._");
  return lines.join("\n");
}

/** Does this question ask for a revision sheet rather than an explanation? */
export function asksForStudySheet(query = "") {
  const text = String(query || "").toLowerCase();
  if (!text.trim()) return false;
  const sheet = /\b(key ?terms|keywords|glossary|definitions?|define all|formula(e)?|formulae|important (dates?|years|points)|revision notes?|study sheet|cheat sheet|summary sheet|quick revision)\b/.test(text);
  if (!sheet) return false;
  // "What is the chemical formula of water?" is a question about one thing, not
  // a request for a chapter sheet.
  const single = /^(what|which|why|how)\b.*\b(is|are|was|were|does|do)\b.*\bformula\b/.test(text) && !/all|list|sheet|notes|terms/.test(text);
  return !single;
}

/**
 * Strip the request wording but keep the subject intact — "key terms of
 * nutrition in plants" must stay "nutrition in plants", not "nutrition plants".
 * Only whole words at the edges are removed.
 */
export function studySheetTopic(query = "") {
  let text = clean(String(query || ""));
  const drop = (pattern) => { text = clean(text.replace(pattern, " ")); };
  drop(/^(?:please\s+)?(?:can you\s+|could you\s+)?(?:give|make|create|show|prepare|list|write|build|generate|do)\s+/i);
  drop(/^(?:a|an|the|all|my)\s+/i);
  drop(/\b(?:key ?terms?|keywords?|glossary|definitions?|define|formula(?:e)?s?|important (?:dates?|years?|points?)|dates?|years?|revision notes?|study sheet|cheat sheet|summary sheet|quick revision|notes?)\b/gi);
  // "give me the formulas for Motion" leaves loose connectors behind; peel the
  // edges until nothing more comes off.
  for (let pass = 0; pass < 4; pass += 1) {
    const before = text;
    drop(/^(?:the|a|an|all|my|me|us|please|of|for|from|on|in|about|with)\s+/i);
    drop(/\s+(?:of|for|from|on|in|about|with|please)$/i);
    if (text === before) break;
  }
  return truncateTopic(text);
}

function truncateTopic(text) {
  const value = clean(text);
  if (value.length <= 80) return value;
  return `${value.slice(0, 77).trimEnd()}…`;
}
