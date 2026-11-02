/**
 * Response compression, with a cache.
 *
 * Every release ships about 240 kB of JavaScript and 380 kB of CSS as plain
 * text. On a school Wi-Fi that is the difference between an app that opens and
 * an app that appears to hang, and it costs nothing but a few milliseconds of
 * CPU once per file per release.
 *
 * Brotli first (about 18–20% smaller than gzip on this code), gzip second
 * (every client since 1999), identity last. Files that are already compressed
 * (woff2, png, jpg, ico, pdf) are passed through: re-compressing them makes them
 * larger and wastes the CPU.
 *
 * Pure functions plus one small LRU-ish map, so the behaviour can be tested
 * without starting a server.
 */

import zlib from "node:zlib";

/** Types worth compressing. Everything else is already packed. */
const COMPRESSIBLE = new Set([
  ".html", ".htm", ".css", ".js", ".mjs", ".json", ".webmanifest",
  ".svg", ".txt", ".xml", ".md", ".map", ".csv",
]);

/** Below this, the encoding overhead is not worth the header. */
export const MIN_BYTES = 1024;

/** Never hold more than this much compressed output. 32 MB is plenty. */
const MAX_CACHE_BYTES = 32 * 1024 * 1024;

/**
 * Which encoding should this request get?
 *
 * Reads the Accept-Encoding header the way browsers send it — with weights —
 * and falls back to identity for anything it does not understand. A client that
 * sends `gzip;q=0` is saying no, and that is respected.
 *
 * @param {string} header the raw Accept-Encoding header
 * @returns {"br"|"gzip"|"identity"}
 */
export function pickEncoding(header = "") {
  const value = String(header || "").toLowerCase();
  if (!value) return "identity";
  const weights = new Map();
  for (const part of value.split(",")) {
    const [name, ...params] = part.trim().split(";");
    const token = name.trim();
    if (!token) continue;
    let quality = 1;
    for (const param of params) {
      const match = param.trim().match(/^q=([0-9.]+)$/);
      if (match) quality = Number(match[1]);
    }
    weights.set(token, Number.isFinite(quality) ? quality : 1);
  }
  // How much this client wants a given coding. An unlisted one gets the "*"
  // weight, or nothing at all — that is what "q=0" and "absent" both mean.
  const weightOf = (token) => {
    if (weights.has(token)) return weights.get(token);
    return weights.get("*") ?? 0;
  };
  const brotliWanted = typeof zlib.brotliCompressSync === "function" ? weightOf("br") : 0;
  const gzipWanted = Math.max(weightOf("gzip"), weightOf("x-gzip"));
  // "deflate" is served as gzip, which every client that says deflate accepts.
  const deflateWanted = weightOf("deflate");
  // Highest weight wins. On a tie brotli wins, because it is the smaller file.
  if (brotliWanted > 0 && brotliWanted >= gzipWanted && brotliWanted >= deflateWanted) return "br";
  if (gzipWanted > 0) return "gzip";
  if (deflateWanted > 0) return "gzip";
  return "identity";
}

/** True when this file is worth compressing at all. */
export function isCompressible(extension = "", size = 0) {
  return COMPRESSIBLE.has(String(extension).toLowerCase()) && size >= MIN_BYTES;
}

/**
 * Compress once. The options are chosen for a study app on a phone: brotli at
 * quality 9 is still fast for files this size, and gzip at level 9 costs single
 * digits of milliseconds.
 */
export function compress(buffer, encoding) {
  if (encoding === "br") {
    return zlib.brotliCompressSync(buffer, {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: 9,
        [zlib.constants.BROTLI_PARAM_SIZE_HINT]: buffer.length,
      },
    });
  }
  if (encoding === "gzip") return zlib.gzipSync(buffer, { level: 9 });
  return buffer;
}

/**
 * A tiny cache: one entry per (path, mtime, encoding). A release changes the
 * mtime, so a deploy invalidates itself without any manual flushing.
 */
export function createCompressionCache({ limit = MAX_CACHE_BYTES } = {}) {
  const entries = new Map();
  let held = 0;

  const key = (file, mtimeMs, encoding) => `${file}::${mtimeMs}::${encoding}`;

  return {
    /** @returns {Buffer|null} compressed bytes, or null when not cached yet. */
    get(file, mtimeMs, encoding) {
      const hit = entries.get(key(file, mtimeMs, encoding));
      if (!hit) return null;
      // Refresh insertion order so the sweeper removes cold entries first.
      entries.delete(key(file, mtimeMs, encoding));
      entries.set(key(file, mtimeMs, encoding), hit);
      return hit.buffer;
    },

    set(file, mtimeMs, encoding, buffer) {
      if (buffer.length > limit) return;
      const entryKey = key(file, mtimeMs, encoding);
      const existing = entries.get(entryKey);
      if (existing) held -= existing.buffer.length;
      entries.set(entryKey, { buffer, size: buffer.length });
      held += buffer.length;
      // Drop the oldest until we are back under the limit.
      while (held > limit && entries.size > 1) {
        const oldest = entries.keys().next().value;
        held -= entries.get(oldest).size;
        entries.delete(oldest);
      }
    },

    /** Bytes currently held, for the health endpoint and for tests. */
    get bytes() {
      return held;
    },

    get size() {
      return entries.size;
    },

    clear() {
      entries.clear();
      held = 0;
    },
  };
}
