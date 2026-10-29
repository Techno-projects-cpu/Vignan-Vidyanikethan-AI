/**
 * Build and query the local textbook index.
 *
 * The index is hybrid: BM25 over exact stemmed terms + cosine similarity over
 * cached hashed vectors + a phrase bonus. A diverse set of passages is chosen
 * with a light MMR pass so the model sees more than one page of context.
 */

import { isStarterBookId } from "./starter-shelf.js?v=25";
import { bigrams, chapterReference, chunkPages, parsePages, tokenize } from "./text.js?v=25";
import { clamp } from "./util.js?v=25";
import { computeStats, cosine, queryVector, vectorize } from "./vector.js?v=25";

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
  return selected.map(({ vector, chunkOrder, ...hit }) => hit);
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

  const best = candidates[0];
  const runnerUp = candidates.find((candidate) => candidate.page !== best.page) || candidates[1] || best;
  const margin = Math.max(0, best.score - runnerUp.score);
  const confidence = clamp(best.score * 0.88 + margin * 0.5);
  const overlapOkay = best.overlap >= 0.25 || best.bm25 >= 0.22;
  const grounded = best.score >= threshold && overlapOkay;
  // Do not pad a good match with unrelated zero-score pages. Those pages used
  // to leak into cited answers and topic-specific quizzes as if they matched.
  const scoreFloor = Math.max(0.045, best.score * 0.22);
  const overlapFloor = Math.min(best.overlap, Math.max(0.25, best.overlap * 0.55));
  const relevant = candidates.filter((candidate) => candidate.score >= scoreFloor && candidate.overlap >= overlapFloor);
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
  const match = (indexGroup) => {
    const result = retrieve(query, indexGroup, { ...options, bookIds: [] });
    // A single common word in a longer question must not masquerade as an
    // answer to a different named topic. Let the labelled web fallback try.
    if (result.grounded && new Set(tokenize(cleanStudyQuery(query))).size >= 3 && result.hits[0]?.overlap < 0.5) {
      return { ...result, hits: [], grounded: false, confidence: 0, reason: "not-in-books" };
    }
    return result;
  };
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
