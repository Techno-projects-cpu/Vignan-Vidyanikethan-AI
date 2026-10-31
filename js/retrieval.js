/**
 * Build and query the local textbook index.
 *
 * The index is hybrid: BM25 over exact stemmed terms + cosine similarity over
 * cached hashed vectors + a phrase bonus. A diverse set of passages is chosen
 * with a light MMR pass so the model sees more than one page of context.
 */

import { isStarterBookId } from "./starter-shelf.js?v=39";
import { bigrams, chapterReference, chunkPages, parsePages, tokenize } from "./text.js?v=39";
import { clamp } from "./util.js?v=39";
import { computeStats, cosine, queryVector, vectorize } from "./vector.js?v=39";

const K1 = 1.5;
const B = 0.75;
export const GROUNDING_THRESHOLD = 0.155;

/** Remove common instructions, not subject terms, before matching passages. */
export function cleanStudyQuery(query) {
  return String(query || "")
    .replace(/\b(?:with|using|give|provide|include)\s+(?:(?:some|a few|few|simple|easy|real[- ]life|everyday)\s+)*examples?\b/gi, " ")
    .replace(/\b(?:in|using|with)\s+(?:(?:very|really)\s+)?(?:simple|easy|plain|everyday)\s+(?:words?|language|terms?)\b/gi, " ")
    .replace(/\b(?:for|to)\s+(?:my|our|the)\s+class\b/gi, " ")
    .replace(/\bstep[- ]by[- ]step\b/gi, " ")
    // A pronoun has no referent here. "Why does it matter?" asks about the
    // topic in the first half of the sentence, so the words of the tail must not
    // be matched as if they were the topic. "Matter" used to win these
    // questions and pull a chemistry page about matter into an answer about
    // photosynthesis.
    .replace(/\b(?:and\s+)?why\s+(?:does|do|did)\s+(?:it|they|this|that|we)\s+(?:so\s+)?(?:matter|matters|mattered|important|useful|necessary)\b/gi, " ")
    .replace(/\b(?:and\s+)?why\s+(?:is|are|was|were)\s+(?:it|they|this|that)\s+(?:so\s+)?(?:important|useful|necessary|needed)\b/gi, " ")
    .replace(/\b(?:what\s+(?:is|are)\s+)?(?:its|their)\s+(?:importance|significance|use|uses)\b/gi, " ")
    .replace(/\b(?:state|give|list)\s+(?:its|their)\s+(?:importance|significance)\b/gi, " ")
    .replace(/\b(?:in|with)\s+(?:points|detail|short)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {object} meta book metadata (at least id, title, subject, grade)
 * @param {string|Array} raw either raw text with page markers or parsed pages
 * @returns {{book: object, chunks: Array, pages: Array}}
 */
export function buildBookIndex(meta, raw) {
  const pages = Array.isArray(raw) ? raw : parsePages(raw);
  const baseChunks = chunkPages(pages, meta.id);
  const stats = computeStats(baseChunks);
  const chunks = baseChunks.map((chunk) => {
    const { tf, vector, length } = vectorize(chunk.text, stats);
    return { ...chunk, tf, vector, length };
  });
  const book = {
    id: meta.id,
    title: meta.title || "Untitled book",
    subject: meta.subject || "General",
    grade: meta.grade || "",
    board: meta.board || "",
    language: meta.language || "English",
    fileName: meta.fileName || "",
    sourceUrl: meta.sourceUrl || "",
    type: meta.type || "text",
    demo: Boolean(meta.demo),
    createdAt: meta.createdAt || new Date().toISOString(),
    pageCount: pages.length,
    chunkCount: chunks.length,
    stats,
    pages,
    fileBlob: meta.fileBlob || null,
    // Version 2 preserves Indic combining marks in tokens. Older indexes are
    // rebuilt in memory from their stored pages when the app opens.
    indexVersion: 2,
  };
  return { book, chunks, pages };
}

/** Recreate a searchable in-memory index from a stored book and its chunks. */
export function indexFromStored(book, chunks) {
  return { book, chunks: chunks || [], pages: book.pages || [] };
}

function bm25Score(chunk, queryWords, stats) {
  let score = 0;
  let ideal = 0;
  for (const word of new Set(queryWords)) {
    const idf = stats.idf[`w:${word}`] ?? 0;
    if (!idf) continue;
    ideal += idf;
    const tf = chunk.tf?.[word] || 0;
    if (!tf) continue;
    const denominator = tf + K1 * (1 - B + (B * (chunk.length || 1)) / (stats.avgdl || 1));
    score += idf * ((tf * (K1 + 1)) / denominator);
  }
  return ideal ? clamp(score / (ideal * 1.12)) : 0;
}

function phraseScore(chunk, queryPairs) {
  if (!queryPairs.length) return 0;
  const text = chunk.text.toLowerCase();
  let found = 0;
  for (const pair of queryPairs) {
    const [left, right] = pair.split("|");
    if (text.includes(left) && text.includes(right)) found += 1;
  }
  return found / queryPairs.length;
}

function scoreBook(index, query, options) {
  const stats = index.book.stats;
  if (!stats || !index.chunks.length) return [];
  const queryWords = tokenize(query);
  if (!queryWords.length) return [];
  const queryPairs = bigrams(queryWords);
  const qVector = queryVector(query, stats);
  const querySet = new Set(queryWords);

  return index.chunks.map((chunk) => {
    const bm25 = bm25Score(chunk, queryWords, stats);
    const vectorScore = cosine(qVector, chunk.vector);
    const phrase = phraseScore(chunk, queryPairs);
    const sectionTokens = new Set(tokenize(chunk.section || ""));
    const sectionBoost = [...querySet].some((word) => sectionTokens.has(word)) ? 0.035 : 0;
    const raw = 0.55 * bm25 + 0.33 * vectorScore + 0.12 * phrase + sectionBoost;
    const words = new Set(tokenize(chunk.text));
    const overlap = [...querySet].filter((word) => words.has(word)).length / querySet.size;
    return {
      ...indexToHit(index, chunk),
      score: raw,
      bm25,
      vectorScore,
      overlap,
      vector: chunk.vector,
      chunkOrder: chunk.order,
    };
  });
}

function indexToHit(index, chunk) {
  return {
    chunkId: chunk.id,
    bookId: index.book.id,
    title: index.book.title,
    subject: index.book.subject,
    grade: index.book.grade,
    board: index.book.board,
    sourceUrl: index.book.sourceUrl || "",
    sourceKind: index.book.type || "text",
    page: chunk.page,
    section: chunk.section || "Notes",
    text: chunk.text,
    demo: Boolean(index.book.demo),
  };
}

function diverseSelection(candidates, topK) {
  const pool = candidates.slice(0, Math.min(28, candidates.length));
  const selected = [];
  while (pool.length && selected.length < topK) {
    let bestIndex = 0;
    let bestValue = -Infinity;
    pool.forEach((candidate, index) => {
      const redundancy = selected.reduce((max, chosen) => {
        let penalty = 0;
        if (chosen.chunkId === candidate.chunkId || chosen.page === candidate.page) penalty += 0.12;
        penalty += 0.32 * cosine(chosen.vector, candidate.vector);
        return Math.max(max, penalty);
      }, 0);
      const value = candidate.score - 0.28 * redundancy;
      if (value > bestValue) {
        bestValue = value;
        bestIndex = index;
      }
    });
    selected.push(pool.splice(bestIndex, 1)[0]);
  }
  return selected.map(({ vector, chunkOrder, topicCovers: _covers, topicShare: _share, ...hit }) => hit);
}

/**
 * Terms that describe a school exercise rather than a topic. They must never
 * decide which page answers a question, or "in detail" would outrank the subject.
 */
const GENERIC_QUERY_TERMS = new Set(
  (
    "matter matters important importance use uses used useful example examples differ difference " +
    "mean meaning explain definition define state work works working happen happens happened " +
    "type types kind kinds point points detail details brief briefly short simple simply word words " +
    "real life daily class chapter topic book note notes question questions answer answers " +
    "need needs help helps process processes principle principles basic basics main " +
    // A subject name narrows where to look; it is not the thing being asked about.
    "physic physics chemistry biology mathematic mathematics math maths science subject subjects " +
    "syllabus exam exams board ncert scert cbse icse " +
    "structure structures function functions role roles reason reasons"
  ).split(" "),
);

/**
 * Does a page talk about this term? The stemmer keeps "digest" apart from
 * "digestive" and "photograph" apart from "photography", so a shared five letter
 * beginning counts as the same word. Below five letters the prefix is too short
 * to mean anything ("form" and "force" must stay apart).
 */
function pageCovers(words, term) {
  if (words.has(term)) return true;
  if (term.length < 5) return false;
  const stem = term.slice(0, 5);
  for (const word of words) {
    if (word.length >= 5 && word.slice(0, 5) === stem) return true;
  }
  return false;
}

/**
 * The words that make a question about one thing rather than another.
 *
 * Tokenised and stemmed, a question about "photosynthesis, and why it matters"
 * is two terms, and a chemistry page about matter matches one of them. A term
 * only counts as a topic if it is rare in this library: a word that appears on
 * most pages tells us nothing about which page to read.
 *
 * @param {string} query
 * @param {Array} indexes the same indexes that will be searched
 * @param {{share?: number}} options share is the largest fraction of pages a term may appear on
 * @returns {string[]} stemmed topic terms, possibly empty
 */
let lastWeights = new Map();

export function distinctiveTerms(query, indexes = [], { share = 0.34 } = {}) {
  const words = [...new Set(tokenize(cleanStudyQuery(query)))];
  if (!words.length) return [];
  const total = indexes.reduce((sum, index) => sum + (index?.chunks?.length || 0), 0);
  if (!total) return [];
  const seen = new Map();
  for (const index of indexes) {
    for (const chunk of index?.chunks || []) {
      const present = new Set(tokenize(chunk.text));
      for (const word of words) if (pageCovers(present, word)) seen.set(word, (seen.get(word) || 0) + 1);
    }
  }
  // How much each topic word is worth. A word on one page of forty-eight
  // ("digestive") says far more about the right page than a word on nine.
  lastWeights = new Map(
    [...seen.entries()].map(([word, count]) => [word, Math.log(1 + total / Math.max(1, count))]),
  );
  return words.filter((word) => {
    if (word.length < 4 || GENERIC_QUERY_TERMS.has(word)) return false;
    const count = seen.get(word) || 0;
    return count > 0 && count / total <= share;
  });
}

/**
 * Search across book indexes.
 * @returns {{hits: Array, confidence: number, grounded: boolean, reason: string, bestScore: number}}
 */
export function retrieve(query, indexes, { topK = 5, threshold = GROUNDING_THRESHOLD, bookIds = [] } = {}) {
  const active = indexes.filter(
    (index) => index?.book && index.chunks?.length && (!bookIds.length || bookIds.includes(index.book.id)),
  );
  if (!active.length) {
    return { hits: [], confidence: 0, grounded: false, reason: "empty-library", bestScore: 0 };
  }
  const cleanedQuery = cleanStudyQuery(query);
  const queryWords = tokenize(cleanedQuery);
  if (!queryWords.length) {
    return { hits: [], confidence: 0, grounded: false, reason: "too-vague", bestScore: 0 };
  }

  const candidates = active
    .flatMap((index) => scoreBook(index, cleanedQuery, { topK }))
    .sort((a, b) => b.score - a.score);
  if (!candidates.length) {
    return { hits: [], confidence: 0, grounded: false, reason: "not-in-books", bestScore: 0 };
  }

  // When the question names a topic that exists somewhere in the library, the
  // answer has to come from a page about that topic. Pages that merely share the
  // question's filler words are set aside before ranking, not after: "How does a
  // transformer work?" used to land on Work, Energy and Power because of the one
  // word "work".
  const topic = distinctiveTerms(cleanedQuery, active);
  let pool = candidates;
  let topicCovers = 0;
  let topicShare = 0;
  if (topic.length) {
    const totalWeight = topic.reduce((sum, word) => sum + (lastWeights.get(word) || 1), 0);
    const scored = candidates.map((candidate) => {
      const words = new Set(tokenize(candidate.text));
      const covered = topic.filter((word) => pageCovers(words, word));
      const weight = covered.reduce((sum, word) => sum + (lastWeights.get(word) || 1), 0);
      return { candidate, covers: covered.length, share: totalWeight ? weight / totalWeight : 0 };
    });
    const onTopic = scored.filter((row) => row.covers > 0);
    if (onTopic.length) {
      // A page that covers the rarest word in the question outranks a page that
      // covers the common one, whatever their raw scores were.
      onTopic.sort((a, b) => b.share - a.share || b.candidate.score - a.candidate.score);
      pool = onTopic.map((row) => ({ ...row.candidate, topicCovers: row.covers, topicShare: row.share }));
    }
    // A two word topic ("water cycle", "pH scale") is only answered when the page
    // covers both words. Longer questions use words a page may phrase
    // differently, so there the page has to be about at least one of them.
    const needed = topic.length === 2 ? 2 : 1;
    const first = pool[0];
    if (!first || (first.topicCovers || 0) < needed) {
      return {
        hits: [],
        allHits: diverseSelection(candidates.filter((candidate) => candidate.score >= Math.max(0.045, candidates[0].score * 0.22)), topK),
        confidence: 0,
        grounded: false,
        reason: "not-in-books",
        bestScore: candidates[0].score,
      };
    }
    topicCovers = first.topicCovers || 0;
    topicShare = first.topicShare || 0;
    // The stemmer keeps "digest" and "digestive" apart, so the right page can
    // score almost nothing on exact terms. Naming most of the question is
    // evidence in its own right: lift that page to the grounding floor, or the
    // score filters below would throw away the only page that is about the topic.
    if (topicCovers > 0 && topicShare >= Math.max(0.4, 1 / Math.max(1, topic.length))) {
      // Above every rival, because the ranking that put it first was the topic,
      // not the raw score. The other pages keep their own scores.
      pool[0] = { ...first, score: Math.max(first.score, candidates[0].score + 0.02) };
    }
  }

  const best = pool[0];
  const runnerUp = pool.find((candidate) => candidate.page !== best.page) || pool[1] || best;
  const margin = Math.max(0, best.score - runnerUp.score);
  const score = best.score;
  const confidence = clamp(score * 0.88 + margin * 0.5);
  const overlapOkay = best.overlap >= 0.25 || best.bm25 >= 0.22 || topicCovers > 0;
  const grounded = score >= threshold && overlapOkay;
  // Do not pad a good match with unrelated zero-score pages. Those pages used
  // to leak into cited answers and topic-specific quizzes as if they matched.
  const scoreFloor = Math.max(0.045, best.score * 0.22);
  const overlapFloor = Math.min(best.overlap, Math.max(0.25, best.overlap * 0.55));
  // With a named topic, pages that cover far less of it are padding, however
  // high they score on filler words: a question about digestion must not be
  // answered with three pages that only contain the word "system".
  const shareFloor = topicShare > 0 ? topicShare * 0.9 : 0;
  const relevant = pool.filter(
    (candidate) =>
      candidate.score >= scoreFloor &&
      candidate.overlap >= overlapFloor &&
      (candidate.topicShare || 0) >= shareFloor,
  );
  const hits = diverseSelection(relevant, topK);

  return {
    hits: grounded ? hits : [],
    allHits: hits,
    confidence: grounded ? confidence : 0,
    grounded,
    reason: grounded ? "ok" : "not-in-books",
    bestScore: best.score,
  };
}

/** Prefer uploaded books/notes to public-web imports when both contain a match. */
export function retrievePreferBooks(query, indexes, options = {}) {
  const bookIds = options.bookIds || [];
  const active = indexes.filter((index) => index?.book && (!bookIds.length || bookIds.includes(index.book.id)));
  // A student's own book outranks the starter pages, and both outrank a web
  // import. The shelf exists so nothing is ever empty, not so it wins.
  const local = active.filter((index) => !index.book.sourceUrl && !isStarterBookId(index.book.id));
  const starter = active.filter((index) => !index.book.sourceUrl && isStarterBookId(index.book.id));
  const imported = active.filter((index) => Boolean(index.book.sourceUrl));
  // retrieve() already refuses a page that is not about the question's topic,
  // so the old overlap ratio rule is gone: it refused correct answers such as
  // "explain the human digestive system" because the page did not repeat the
  // word "human".
  const match = (indexGroup) => retrieve(query, indexGroup, { ...options, bookIds: [] });
  const first = match(local);
  if (first.grounded) return first;
  const shelf = starter.length ? match(starter) : null;
  if (shelf?.grounded) return shelf;
  const second = match(imported);
  if (second.grounded) return second;
  if (first.reason === "empty-library") return shelf || second;
  return first;
}

/** Search a named topic; only an intentionally blank topic samples general material. */
export function retrieveChapter(topic, indexes, { topK = 10, bookIds = [] } = {}) {
  const requested = String(topic || "").trim();
  if (requested) {
    const chapter = chapterReference(requested);
    let searchIndexes = indexes;
    if (chapter) {
      searchIndexes = indexes
        .filter((index) => index?.book && (!bookIds.length || bookIds.includes(index.book.id)))
        .map((index) => ({
          ...index,
          chunks: (index.chunks || []).filter((chunk) => {
            const heading = chapterReference(chunk.section);
            const title = chapterReference(index.book.title);
            return heading ? heading.number === chapter.number : title?.number === chapter.number;
          }),
        }))
        .filter((index) => index.chunks.length);
      if (!searchIndexes.length) return { hits: [], allHits: [], grounded: false, confidence: 0, reason: "not-in-books", bestScore: 0 };
      // A chapter number by itself is a request for that section, not a
      // keyword query (numbers are intentionally omitted from the word index).
      const remaining = requested.replace(chapter.text, " ").trim();
      if (!tokenize(remaining).length) {
        const hits = searchIndexes.flatMap((index) => index.chunks.map((chunk) => ({ ...indexToHit(index, chunk), score: 1, overlap: 1 }))).slice(0, topK);
        return { hits, allHits: hits, grounded: Boolean(hits.length), confidence: 1, reason: "chapter-heading", bestScore: 1 };
      }
    }
    const result = retrieve(requested, searchIndexes, { topK, threshold: 0.06, bookIds: chapter ? [] : bookIds });
    // A shared generic word alone should not turn an unrelated topic into a
    // confident-looking quiz. Ask the student to narrow the wording instead.
    if (result.hits.length && new Set(tokenize(cleanStudyQuery(requested))).size > 1 && result.hits[0].overlap < 0.6) {
      return { ...result, hits: [], grounded: false, confidence: 0, reason: "partial-topic" };
    }
    return result;
  }

  const active = indexes.filter(
    (index) => index?.chunks?.length && (!bookIds.length || bookIds.includes(index.book.id)),
  );
  const chunks = active.flatMap((index) =>
    index.chunks
      .filter((_, order) => order % Math.max(1, Math.floor(index.chunks.length / topK)) === 0)
      .slice(0, topK)
      .map((chunk) => ({ ...indexToHit(index, chunk), score: 0, overlap: 0 })),
  );
  return {
    hits: chunks.slice(0, topK),
    allHits: chunks,
    confidence: 0,
    grounded: chunks.length > 0,
    reason: chunks.length ? "general-practice" : "empty-library",
    bestScore: 0,
  };
}

export { tokenize };
