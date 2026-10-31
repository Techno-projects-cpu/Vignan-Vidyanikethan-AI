/**
 * "Will this work on the school Wi-Fi that just died?"
 *
 * The check compares the list of files this release needs (precache.json) with
 * what the service worker actually stored. It runs entirely against the cache,
 * so the report is available offline — which is the whole point.
 *
 * `summarize` is pure: give it two lists and it tells you whether the app is
 * ready. The browser half only reads the Cache Storage API.
 */

export const CACHE_PREFIX = "vignan-vidyanikethan-ai-v";

/** Normalise "./index.html?v=40" and "index.html" so lists can be compared. */
export function normalizeUrl(url = "") {
  return String(url || "")
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "")
    .replace(/\?.*$/, "")
    .trim();
}

/**
 * @param {object} input
 * @param {string[]} input.expected files the release needs
 * @param {string[]} input.cached files the worker stored
 * @param {string[]} input.critical a small set that must be present, default the page shell
 */
export function summarize({ expected = [], cached = [], critical = [] } = {}) {
  const have = new Set(cached.map(normalizeUrl));
  const required = [...new Set(expected.map(normalizeUrl))].filter(Boolean);
  const missing = required.filter((url) => !have.has(url));
  const missingCritical = [...new Set(critical.map(normalizeUrl))].filter((url) => url && !have.has(url));
  const total = required.length;
  const cachedCount = total - missing.length;
  const ratio = total ? cachedCount / total : 0;
  const ready = total > 0 && missingCritical.length === 0 && ratio >= 0.98;
  return {
    ready,
    total,
    cached: cachedCount,
    missing: missing.slice(0, 12),
    missingCount: missing.length,
    missingCritical,
    ratio,
    summary: total === 0
      ? "Nothing is cached yet. Open the app once while online."
      : ready
        ? `Ready offline: ${cachedCount} of ${total} files cached.`
        : `${missing.length} of ${total} files are missing from the offline cache.`,
  };
}

/** Which cache belongs to this release, newest first. */
export function pickCacheName(names = [], version = "") {
  const mine = names.filter((name) => String(name).startsWith(CACHE_PREFIX));
  if (version) {
    const exact = mine.find((name) => name === `${CACHE_PREFIX}${version}`);
    if (exact) return exact;
  }
  return mine.sort().at(-1) || "";
}

/**
 * Read Cache Storage and report. Never throws: a browser without caches, or a
 * page that is not controlled yet, gets a plain "not installed" answer.
 */
export async function runOfflineCheck({ cachesRef = globalThis.caches, version = "", critical = [] } = {}) {
  if (!cachesRef?.keys) {
    return { ...summarize({ expected: [], cached: [], critical }), installed: false, reason: "no-cache-api" };
  }
  try {
    const names = await cachesRef.keys();
    const cacheName = pickCacheName(names, version);
    if (!cacheName) {
      return { ...summarize({ expected: [], cached: [], critical }), installed: false, cacheName: "", reason: "not-installed" };
    }
    const cache = await cachesRef.open(cacheName);
    const requests = await cache.keys();
    const cached = requests.map((request) => (typeof request === "string" ? request : request.url));
    const manifest = await readManifest(cache, cachesRef);
    const report = summarize({ expected: manifest, cached, critical });
    return { ...report, installed: true, cacheName, reason: report.ready ? "" : "incomplete" };
  } catch (error) {
    return { ...summarize({ expected: [], cached: [], critical }), installed: false, reason: error?.message || "error" };
  }
}

/** precache.json is itself cached, so the expected list is available offline. */
async function readManifest(cache, cachesRef) {
  try {
    const hit = await cache.match("./precache.json") || await cache.match("precache.json");
    if (hit) {
      const data = await hit.json();
      return Array.isArray(data?.urls) ? data.urls : [];
    }
  } catch {
    // fall through to the network copy
  }
  try {
    const response = await globalThis.fetch?.("./precache.json", { cache: "no-store" });
    if (response?.ok) {
      const data = await response.json();
      return Array.isArray(data?.urls) ? data.urls : [];
    }
  } catch {
    // offline and not cached: nothing to compare
  }
  return [];
}

/** The files that make the app usable even with an empty library. */
export const CRITICAL_FILES = [
  "./",
  "./index.html",
  "./js/app.js",
  "./js/boot.js",
  "./js/ui.js",
  "./sw.js",
  "./styles.css",
];
