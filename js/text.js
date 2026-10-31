/**
 * Text ingestion: page markers, headings, sentence splitting and chunking.
 * Page provenance is deliberately preserved all the way to the UI so every
 * answer, quiz question and flashcard can be verified against a real page.
 */

import { normalizeText, truncate, unique } from "./util.js?v=41";

export const STOPWORDS = new Set(
  `a about above after again against all am an and any are arent as at be because been before being below between both but by can cannot could couldnt did didnt do does doesnt doing dont down during each few for from further had hadnt has hasnt have havent having he hed hell hes her here heres hers herself him himself his how hows i id ill im ive if in into is isnt it its itself lets me more most mustnt my myself no nor not of off on once only or other ought our ours ourselves out over own same shant she shed shell shes should shouldnt so some such than that thats the their theirs them themselves then there theres these they theyd theyll theyre theyve this those through to too under until up very was wasnt we wed well were weve were werent what whats when whens where wheres which while who whos whom why whys with wont would wouldnt you youd youll youre youve your yours yourself yourselves explain describe define give tell write short long answer question please textbook book page chapter notes summary summarize summarise summaryof according using use meaning means term called name state list`.split(
    /\s+/,
  ),
);

// Frequent question words in Hindi and Telugu; preserve Indic vowel signs in
// actual content words instead of treating their combining marks as punctuation.
for (const word of `का के की है हैं था थे थी में और या से को पर तक यह वह क्या क्यों कैसे कब कौन आप तुम मुझे इसके उसके बारे एक इस उस अध्याय सारांश समझाइए समझाओ ఇది అది అంటే ఏమిటి ఏమి ఎలా ఎందుకు మరియు ఒక లో కి ను యొక్క పై గురించి మీరు నేను నాకు దాని ఇవి అవి ఉన్న ఉంది అధ్యాయం పాఠం సారాంశం వివరించండి వివరించు`.split(/\s+/)) STOPWORDS.add(word.normalize("NFKC"));

/** A numbered chapter reference, retaining its language and normalising digits. */
export function chapterReference(text = "") {
  const match = String(text).match(/(?:\b(?:chapter|ch\.?)\s*|(?:अध्याय|అధ్యాయం|పాఠం)\s*)([0-9०-९౦-౯]{1,3})(?![0-9०-९౦-౯])/iu);
  if (!match) return null;
  const digits = match[1].replace(/[०-९౦-౯]/g, (digit) => {
    const code = digit.codePointAt(0);
    return String(code >= 0x0c66 ? code - 0x0c66 : code - 0x0966);
  });
  return { number: Number(digits), text: match[0].trim() };
}

const PAGE_MARKER =
  /^\s*(?:\[\[\s*page\s*[:#=-]?\s*(\d+)\s*\]\]|[-=*_]{2,}\s*page\s+(\d+)\s*[-=*_]*|page\s+(\d+)\s*[:.-]?)\s*$/i;
const HEADING_MD = /^#{1,4}\s+(.+?)\s*#*\s*$/;
const HEADING_CAPS = /^([A-Z][A-Z0-9 ,:&'’./()-]{5,70})$/;

export function cleanPageText(text) {
  return String(text ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/(\w)-\n(\w)/g, "$1$2")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function detectHeading(line) {
  const trimmed = String(line ?? "").trim();
  const markdown = trimmed.match(HEADING_MD);
  if (markdown) return markdown[1].trim();
  if (trimmed.length <= 100 && /^(?:chapter|ch\.?|अध्याय|అధ్యాయం|పాఠం)\s*[0-9०-९౦-౯]{1,3}(?:\s|[.:\-–]|$)/iu.test(trimmed)) return trimmed;
  if (HEADING_CAPS.test(trimmed) && /[A-Za-z]/.test(trimmed)) return trimmed;
  return "";
}

/**
 * Convert raw TXT/Markdown/demo content into page records.
 * Supported page markers (on their own line):
 *   [[page:12]]   --- Page 12 ---   Page 12:
 * If there are no markers, long documents are split into approximate pages.
 */
export function parsePages(raw, { wordsPerPage = 420 } = {}) {
  const source = String(raw ?? "").replace(/\r\n?/g, "\n");
  const lines = source.split("\n");
  const pages = [];
  let pageNumber = 1;
  let buffer = [];
  let heading = "";
  let lastHeading = "";
  let hasExplicitPageMarker = false;

  const flush = () => {
    const text = cleanPageText(buffer.join("\n"));
    buffer = [];
    if (!text) return;
    pages.push({
      page: pageNumber,
      text,
      heading: heading || lastHeading || "Notes",
    });
    if (heading) lastHeading = heading;
    heading = "";
  };

  for (const line of lines) {
    const marker = line.match(PAGE_MARKER);
    if (marker) {
      hasExplicitPageMarker = true;
      flush();
      pageNumber = Number(marker[1] || marker[2] || marker[3]) || pageNumber + 1;
      continue;
    }
    const foundHeading = detectHeading(line);
    if (foundHeading) heading = foundHeading;
    buffer.push(line);
  }
  flush();

  const wordCount = pages.reduce((total, page) => total + page.text.split(/\s+/).length, 0);
  if (!hasExplicitPageMarker && pages.length <= 1 && wordCount > wordsPerPage * 1.25) {
    return splitIntoApproximatePages(pages[0]?.text || "", wordsPerPage);
  }

  return pages.map((page, index) => ({
    ...page,
    heading: page.heading || pages.slice(0, index + 1).reverse().find((p) => p.heading)?.heading || "Notes",
  }));
}

function splitIntoApproximatePages(text, wordsPerPage) {
  const words = text.split(/\s+/);
  const pages = [];
  let heading = "Notes";
  for (let start = 0; start < words.length; start += wordsPerPage) {
    const slice = words.slice(start, start + wordsPerPage).join(" ");
    const firstLine = slice.split("\n")[0];
    heading = detectHeading(firstLine) || heading;
    pages.push({ page: pages.length + 1, text: slice.trim(), heading });
  }
  return pages;
}

/** Sentence splitting that keeps decimals and common abbreviations intact. */
export function splitSentences(text) {
  const clean = String(text ?? "")
    .replace(/\s+/g, " ")
    .replace(/\b(e\.g|i\.e|vs|Mr|Mrs|Dr|Fig|No)\./gi, (match) => match.replace(/\./g, "§"))
    .replace(/(\d)\.(\d)/g, "$1§$2")
    .trim();
  if (!clean) return [];
  return clean
    .split(/(?<=[.!?।])\s+(?=[\p{L}\p{N}"'“‘(])/u)
    .map((sentence) => sentence.replace(/§/g, ".").trim())
    .filter((sentence) => sentence.length > 12);
}

export function tokenize(text) {
  return normalizeText(text)
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 1 && !STOPWORDS.has(word) && !/^\d+$/.test(word))
    .map(stem);
}

const IRREGULAR_STEMS = {
  leaves: "leaf",
  leav: "leaf",
  children: "child",
  mice: "mouse",
  men: "man",
  women: "woman",
  feet: "foot",
  teeth: "tooth",
};

/** A deliberately small stemmer; it is applied to queries and passages alike. */
export function stem(word) {
  if (!/^[a-z]+$/.test(word) || word.length < 4) return word;
  if (IRREGULAR_STEMS[word]) return IRREGULAR_STEMS[word];
  let output = word;

  // 1) Remove a plural/verb ending first, so "respirations" and "respiration"
  //    can still share the same derivational stem in step 2.
  if (output.endsWith("ies") && output.length > 5) output = `${output.slice(0, -3)}y`;
  else if (output.endsWith("sses")) output = output.slice(0, -2);
  else if (/(s|x|z|ch|sh)es$/.test(output) && output.length > 5) output = output.slice(0, -2);
  else if (output.endsWith("s") && !output.endsWith("ss") && output.length > 4) output = output.slice(0, -1);

  // 2) Remove common derivational endings.
  if (output.endsWith("ational")) output = `${output.slice(0, -7)}ate`;
  else if (output.endsWith("tion")) output = `${output.slice(0, -4)}t`;
  else if (output.endsWith("sion")) output = `${output.slice(0, -4)}s`;
  else if (output.endsWith("ment")) output = output.slice(0, -4);
  else if (output.endsWith("ness")) output = output.slice(0, -4);
  else if (output.endsWith("ingly")) output = output.slice(0, -5);
  else if (output.endsWith("edly")) output = output.slice(0, -4);
  else if (output.endsWith("ing") && output.length > 6) output = output.slice(0, -3);
  else if (output.endsWith("ed") && output.length > 5) output = output.slice(0, -2);

  return IRREGULAR_STEMS[output] || output;
}

export function bigrams(words) {
  const pairs = [];
  for (let i = 0; i < words.length - 1; i += 1) pairs.push(`${words[i]}|${words[i + 1]}`);
  return pairs;
}

export function wordCount(text) {
  return String(text ?? "").trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Build overlapping chunks. Chunks never cross a page boundary: a citation
 * must always point at exactly one page.
 */
export function chunkPages(pages, bookId, { targetWords = 165, overlapWords = 32, minWords = 18 } = {}) {
  const chunks = [];
  let order = 0;
  for (const page of pages) {
    // Headings are kept as section metadata; they should not become quiz blanks.
    const body = cleanPageText(page.text)
      .split("\n")
      .filter((line) => !/^\s*#{1,4}\s+/.test(line))
      .join(" ");
    const words = body.replace(/\s+/g, " ").split(/\s+/).filter(Boolean);
    if (words.length < 4) continue;
    const step = Math.max(1, targetWords - overlapWords);
    let start = 0;
    while (start < words.length) {
      const end = Math.min(words.length, start + targetWords);
      const slice = words.slice(start, end).join(" ").trim();
      if (slice.split(/\s+/).length >= minWords || chunks.length === 0 || start === 0) {
        chunks.push({
          id: `${bookId}:${order}`,
          bookId,
          page: Number(page.page) || 1,
          order,
          section: page.heading || "Notes",
          text: slice,
        });
        order += 1;
      }
      if (end === words.length) break;
      start += step;
      // Avoid a tiny final fragment when the remainder is very short.
      if (words.length - start < minWords) {
        const remaining = words.slice(start).join(" ").trim();
        if (remaining) {
          chunks.push({
            id: `${bookId}:${order}`,
            bookId,
            page: Number(page.page) || 1,
            order,
            section: page.heading || "Notes",
            text: remaining,
          });
          order += 1;
        }
        break;
      }
    }
  }
  return chunks;
}

/** Pick the most query-relevant sentences from a passage. */
export function salientSentences(text, query, limit = 3) {
  const q = new Set(tokenize(query));
  const sentences = splitSentences(text);
  if (!sentences.length) return [truncate(text, 240)];
  return sentences
    .map((sentence, index) => {
      const words = tokenize(sentence);
      const overlap = words.filter((word) => q.has(word)).length;
      const keywordBonus = /\b(is|are|means|refers|called|defined|because|therefore|so|by|through|formula|equals)\b/i.test(
        sentence,
      )
        ? 0.7
        : 0;
      const lengthPenalty = Math.abs(sentence.length - 150) / 500;
      const score = overlap * 1.6 + keywordBonus + (index === 0 ? 0.5 : 0) - lengthPenalty;
      return { sentence, score, index };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.sentence.trim());
}

export function keyPhrases(text, count = 8) {
  const words = tokenize(text);
  const frequency = new Map();
  for (const word of words) frequency.set(word, (frequency.get(word) || 0) + 1);
  const phrases = [...frequency.entries()]
    .filter(([word]) => word.length > 3)
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, count)
    .map(([word]) => word);
  return unique(phrases);
}

export function inferTopic(hits) {
  const sections = hits.map((hit) => hit.section).filter((section) => section && section !== "Notes");
  if (sections.length) return sections[0];
  return "this chapter";
}
