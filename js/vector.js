/**
 * Frugal hybrid retrieval vectors.
 *
 * We do not ship a neural embedding model. Instead each passage gets a cached,
 * hashed TF-IDF vector made of word unigrams, word bigrams and character
 * trigrams. This is tiny, fast on a laptop CPU, works offline, handles typos
 * reasonably well, and is deterministic (important for verifiable answers).
 */

import { bigrams, tokenize } from "./text.js?v=39";

export const VECTOR_DIM = 512;

export function hashFeature(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

function addFeature(vector, feature, weight) {
  if (!weight) return;
  const hash = hashFeature(feature);
  const index = hash % VECTOR_DIM;
  const sign = hash & 0x80000000 ? -1 : 1;
  vector[index] += weight * sign;
}

function counts(items) {
  const map = Object.create(null);
  for (const item of items) map[item] = (map[item] || 0) + 1;
  return map;
}

function l2Normalize(vector) {
  let sum = 0;
  for (let i = 0; i < vector.length; i += 1) sum += vector[i] * vector[i];
  const norm = Math.sqrt(sum);
  if (norm > 0) for (let i = 0; i < vector.length; i += 1) vector[i] /= norm;
  return vector;
}

/** Compute document-frequency statistics for one book's chunks. */
export function computeStats(chunks) {
  const wordDf = Object.create(null);
  const bigramDf = Object.create(null);
  let totalLength = 0;
  for (const chunk of chunks) {
    const words = tokenize(chunk.text);
    totalLength += words.length;
    for (const word of new Set(words)) wordDf[word] = (wordDf[word] || 0) + 1;
    for (const pair of new Set(bigrams(words))) bigramDf[pair] = (bigramDf[pair] || 0) + 1;
  }
  const n = Math.max(1, chunks.length);
  const idf = Object.create(null);
  for (const [term, df] of Object.entries(wordDf)) {
    idf[`w:${term}`] = Math.log(1 + (n - df + 0.5) / (df + 0.5));
  }
  for (const [term, df] of Object.entries(bigramDf)) {
    idf[`b:${term}`] = Math.log(1 + (n - df + 0.5) / (df + 0.5));
  }
  const values = Object.values(idf);
  return {
    n,
    avgdl: totalLength / n,
    idf,
    maxIdf: values.length ? values.reduce((max, value) => Math.max(max, value), 0) : 1,
    dim: VECTOR_DIM,
  };
}

/** Build the sparse term frequencies and dense hashed vector for a passage. */
export function vectorize(text, stats) {
  const words = tokenize(text);
  const tf = counts(words);
  const bf = counts(bigrams(words));
  const vector = new Float32Array(VECTOR_DIM);

  for (const [word, count] of Object.entries(tf)) {
    const idf = stats.idf[`w:${word}`] ?? stats.maxIdf * 1.25;
    addFeature(vector, `w:${word}`, (1 + Math.log(count)) * idf);
  }
  for (const [pair, count] of Object.entries(bf)) {
    const idf = stats.idf[`b:${pair}`] ?? stats.maxIdf * 1.1;
    addFeature(vector, `b:${pair}`, 0.65 * (1 + Math.log(count)) * idf);
  }
  // Character trigrams provide typo tolerance and partial Telugu support.
  const joined = words.join(" ");
  for (let i = 0; i < joined.length - 2; i += 1) {
    addFeature(vector, `c:${joined.slice(i, i + 3)}`, 0.06);
  }
  return { tf, vector: l2Normalize(vector), length: words.length };
}

/** Build a query vector using the book's cached IDF table. */
export function queryVector(query, stats) {
  return vectorize(query, stats).vector;
}

export function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i += 1) dot += a[i] * b[i];
  return Math.max(0, Math.min(1, dot));
}
