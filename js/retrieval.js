/**
 * Build and query the local textbook index.
 *
 * The index is hybrid: BM25 over exact stemmed terms + cosine similarity over
 * cached hashed vectors + a phrase bonus. A diverse set of passages is chosen
 * with a light MMR pass so the model sees more than one page of context.
 */

import { bigrams, chunkPages, parsePages, tokenize } from "./text.js";
import { clamp } from "./util.js";
import { computeStats, cosine, queryVector, vectorize } from "./vector.js";

const K1 = 1.5;
const B = 0.75;
export const GROUNDING_THRESHOLD = 0.155;

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
    type: meta.type || "text",
    demo: Boolean(meta.demo),
    createdAt: meta.createdAt || new Date().toISOString(),
    pageCount: pages.length,
    chunkCount: chunks.length,
    stats,
    pages,
    fileBlob: meta.fileBlob || null,
    indexVersion: 1,
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
  const queryWords = tokenize(query);
  if (!queryWords.length) {
    return { hits: [], confidence: 0, grounded: false, reason: "too-vague", bestScore: 0 };
  }

  const candidates = active
    .flatMap((index) => scoreBook(index, query, { topK }))
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
  const hits = diverseSelection(candidates, topK);

  return {
    hits: grounded ? hits : [],
    allHits: hits,
    confidence: grounded ? confidence : 0,
    grounded,
    reason: grounded ? "ok" : "not-in-books",
    bestScore: best.score,
  };
}

/** Retrieve broad context for a whole chapter/quiz even without a precise question. */
export function retrieveChapter(topic, indexes, { topK = 10, bookIds = [] } = {}) {
  const result = retrieve(topic || "important definitions and key ideas", indexes, {
    topK,
    threshold: 0.06,
    bookIds,
  });
  if (result.hits.length) return result;
  const active = indexes.filter(
    (index) => index?.chunks?.length && (!bookIds.length || bookIds.includes(index.book.id)),
  );
  const chunks = active.flatMap((index) =>
    index.chunks
      .filter((_, order) => order % Math.max(1, Math.floor(index.chunks.length / topK)) === 0)
      .slice(0, topK)
      .map((chunk) => ({ ...indexToHit(index, chunk), score: 0.1, overlap: 0 })),
  );
  return {
    hits: chunks.slice(0, topK),
    allHits: chunks,
    confidence: 0.35,
    grounded: chunks.length > 0,
    reason: chunks.length ? "ok" : "empty-library",
    bestScore: 0.1,
  };
}

export { tokenize };
