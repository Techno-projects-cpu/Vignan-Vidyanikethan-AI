/**
 * Local model-paper assembler. It analyses readable past-paper pages and
 * reuses identifiable questions; it does not predict an exam or infer keys.
 */
import { normalizeAnswer, truncate } from "./util.js?v=26";
import { tokenize } from "./text.js?v=26";

const MAX_CHARS = 2_000_000;
const MAX_QUESTIONS = 1500;
const QUESTION_START = /^\s*(?:(?:q(?:uestion)?|प्रश्न|ప్రశ్న)\s*\.?\s*)?(?:\d{1,3}|[०-९౦-౯]{1,3})\s*[.):\-]\s*(.+)$/iu;
const Q_PREFIX = /^\s*(?:q(?:uestion)?|प्रश्न|ప్రశ్న)\s*\.?\s*(?:\d{1,3}|[०-९౦-౯]{1,3})\s+(.+)$/iu;
const ANSWER_KEY = /^\s*(?:answer\s*key|answers?|solutions?|correct\s+answer|उत्तर(?:माला)?|समाधान|జవాబులు|సమాధానాలు)\s*[:.\-]?\s*$/iu;
const ANSWER_LINE = /^\s*(?:answers?|solutions?|correct\s+answer|उत्तर|समाधान|జవాబు|సమాధానం)\s*[:.\-]/iu;
const SECTION = /^\s*(?:section|part|भाग|खंड|విభాగం|భాగం)\s*[-:–]?\s*[A-Z\d०-९౦-౯]+(?:\s*[:.\-–].*)?\s*$/iu;
const QUESTION_WORD = /\?|？|\b(?:what|why|how|when|where|which|who|define|explain|describe|state|name|list|write|calculate|find|compare|choose|identify|draw|prove|solve|give|discuss|differentiate|derive|complete|select|match|show)\b|(?:क्या|क्यों|कैसे|कौन|बताइए|समझाइए|लिखिए|परिभाषित|गणना|అంటే|ఏమిటి|ఎందుకు|ఎలా|వివరించండి|రాయండి|గణించండి)/iu;
const OPTIONS = /(?:^|\s)(?:\(?a\)|\(a\)|a\.)\s*\S+[\s\S]*(?:\(?b\)|\(b\)|b\.)/iu;

function cleanQuestion(value) {
  return String(value || "")
    // Omit clearly labelled inline solutions; do not manufacture an answer key.
    .replace(/(?:^|\n|\s+)(?:correct\s+answer|answer|solution|उत्तर|समाधान|జవాబు|సమాధానం)\s*[:.\-]\s*[^\n]*/giu, "")
    .replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function explicitMarks(text) {
  const match = String(text).match(/(?:\[|\()?\s*(\d{1,2})\s*(?:marks?|अंक|మార్కులు)\s*(?:\]|\))?/iu);
  return match ? Number(match[1]) : null;
}

/** Extract candidates from a single page without treating answer keys as questions. */
export function extractPageQuestions(page, book = {}) {
  const lines = String(page?.text || "").replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ")
    // Older imported PDFs may have lost line breaks. Split obvious numbered
    // questions and lettered options without treating decimals as questions.
    .replace(/([^\n]) (?=(?:(?:q(?:uestion)?|प्रश्न|ప్రశ్న) *\.? *)?(?:\d{1,3}|[०-९౦-౯]{1,3}) *[.):\-] +[\p{L}])/giu, "$1\n")
    .replace(/([^\n]) (?=\([a-d]\) )/giu, "$1\n")
    .split("\n");
  const found = [];
  let current = "";
  let inAnswers = false;
  const flush = () => {
    const text = cleanQuestion(current);
    current = "";
    if (text.length < 12 || text.length > 1200 || !QUESTION_WORD.test(text)) return;
    found.push({
      text,
      marks: explicitMarks(text),
      type: OPTIONS.test(text) ? "multiple-choice" : "written",
      source: {
        bookId: book.id || "", title: book.title || "Uploaded paper", page: page.page || 1,
        section: page.heading || "Past paper", sourceUrl: book.sourceUrl || "", sourceKind: book.type || "text",
        quote: truncate(text, 280),
      },
    });
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (ANSWER_KEY.test(line)) { flush(); inAnswers = true; continue; }
    if (inAnswers) continue;
    if (ANSWER_LINE.test(line)) { flush(); continue; }
    if (SECTION.test(line)) { flush(); continue; }
    const start = line.match(QUESTION_START) || line.match(Q_PREFIX);
    if (start) {
      flush();
      current = start[1];
    } else if (current) {
      // Preserve options and wrapped question lines, but keep the work bounded.
      if (current.length + line.length < 1200) current += `\n${line}`;
      else flush();
    } else if (QUESTION_WORD.test(line) && /[?？]\s*$/.test(line)) {
      current = line;
      flush();
    }
  }
  flush();
  return found;
}

/** Analyse only the supplied local books and balance chosen questions by source. */
export function buildModelPaper(indexes = [], { count = 10, topic = "" } = {}) {
  const wanted = Math.max(1, Math.min(30, Number(count) || 10));
  const queryTokens = [...new Set(tokenize(topic))];
  if (String(topic || "").trim() && !queryTokens.length) {
    return { title: `Practice model paper — ${truncate(String(topic), 80)}`, topic: String(topic).trim(), questions: [], analysis: { extracted: 0, unique: 0, duplicates: 0, types: {}, truncated: false, requested: wanted } };
  }
  const seen = new Set();
  const groups = [];
  let scannedCharacters = 0;
  let extracted = 0;
  let duplicates = 0;
  let truncated = false;
  for (const index of indexes) {
    const book = index?.book || index;
    const pages = Array.isArray(book?.pages) ? book.pages : [];
    const candidates = [];
    const titleTokens = new Set(tokenize(`${book?.title || ""} ${book?.subject || ""}`));
    const titleMatches = queryTokens.length && queryTokens.every((token) => titleTokens.has(token));
    for (const page of pages) {
      if (scannedCharacters >= MAX_CHARS || extracted >= MAX_QUESTIONS) { truncated = true; break; }
      const text = String(page?.text || "");
      const remaining = MAX_CHARS - scannedCharacters;
      scannedCharacters += Math.min(text.length, remaining);
      if (text.length > remaining) truncated = true;
      const items = extractPageQuestions({ ...page, text: text.slice(0, remaining) }, book);
      for (const item of items) {
        if (extracted >= MAX_QUESTIONS) { truncated = true; break; }
        extracted += 1;
        const key = normalizeAnswer(item.text).slice(0, 500);
        if (!key) continue;
        if (seen.has(key)) { duplicates += 1; continue; }
        seen.add(key);
        if (queryTokens.length && !titleMatches) {
          const words = new Set(tokenize(item.text));
          const coverage = queryTokens.filter((word) => words.has(word)).length / queryTokens.length;
          if (coverage < 0.6) continue;
        }
        candidates.push(item);
      }
    }
    if (candidates.length) groups.push(candidates);
  }
  const selected = [];
  while (selected.length < wanted && groups.some((group) => group.length)) {
    for (const group of groups) {
      if (selected.length >= wanted) break;
      if (group.length) selected.push(group.shift());
    }
  }
  const types = selected.reduce((acc, item) => { acc[item.type] = (acc[item.type] || 0) + 1; return acc; }, {});
  return {
    title: topic ? `Practice model paper — ${truncate(topic, 80)}` : "Practice model paper",
    topic: String(topic || "").trim(), questions: selected,
    analysis: { extracted, unique: seen.size, duplicates, types, truncated, requested: wanted },
  };
}

export function modelPaperText(paper = {}) {
  const lines = [
    paper.title || "Practice model paper", "",
    "Practice only: assembled from uploaded past-paper questions. Questions may be reused; this does not predict the real exam.",
    "No answer key has been inferred. Check questions, marks and source pages with a teacher.", "",
  ];
  (paper.questions || []).forEach((item, index) => {
    lines.push(`${index + 1}. ${item.text}`);
    lines.push(`   [Source: ${item.source?.sourceUrl ? "Web import: " : ""}${item.source?.title || "Uploaded paper"}, page ${item.source?.page || "?"}]`, "");
  });
  return lines.join("\n").trim() + "\n";
}
