/**
 * Keyless outside-the-books search.
 *
 * Wikipedia is only one of the sources now. A question first goes to the
 * Wikipedia edition for the interface language, then to the DuckDuckGo Instant
 * Answer API (abstracts, definitions and related pages), with a Simple English
 * Wikipedia pass when the English edition has nothing. Results from all
 * providers are merged, de-duplicated and clearly labelled as outside sources.
 * Every endpoint is fixed and allowlisted; nothing is scraped from arbitrary
 * URLs here.
 */

import { parseSearchResults } from "../js/web.js?v=18";
import { wikipediaLanguage } from "../js/languages.js?v=18";

const MAX_SEARCH_BYTES = 1024 * 1024;
const USER_AGENT =
  "VignanVidyanikethanAI/2.0.0 (+https://github.com/Techno-projects-cpu/Vignan-Vidyanikethan-AI/issues)";

export function wikipediaSearchUrl(query, language = "en", { host = null, limit = 4, chars = 1800 } = {}) {
  const edition = host || wikipediaLanguage(language);
  const url = new URL(`https://${edition}.wikipedia.org/w/api.php`);
  for (const [key, value] of Object.entries({
    action: "query", generator: "search", gsrsearch: String(query || "").trim().slice(0, 300),
    gsrlimit: String(limit), gsrnamespace: "0", prop: "extracts|info", exintro: "1", explaintext: "1",
    exchars: String(chars), exlimit: "max", inprop: "url", format: "json", formatversion: "2",
  })) url.searchParams.set(key, value);
  return url.href;
}

export function parseWikipediaResults(data, language = "en", { host = null } = {}) {
  const hostLanguage = host || wikipediaLanguage(language);
  const pages = Array.isArray(data?.query?.pages) ? data.query.pages : [];
  const entries = pages
    .filter((page) => page && !page.missing && typeof page.title === "string")
    .sort((left, right) => (left.index ?? 999) - (right.index ?? 999))
    .map((page) => {
      // Build article links ourselves instead of trusting URLs in a response.
      const title = page.title.trim();
      return {
        title,
        url: `https://${hostLanguage}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`,
        snippet: String(page.extract || "").trim(),
        provider: "Wikipedia",
      };
    });
  return parseSearchResults(entries);
}

export function duckDuckGoUrl(query) {
  const url = new URL("https://api.duckduckgo.com/");
  url.searchParams.set("q", String(query || "").trim().slice(0, 300));
  url.searchParams.set("format", "json");
  url.searchParams.set("no_html", "1");
  url.searchParams.set("skip_disambig", "1");
  url.searchParams.set("t", "vignanvidyanikethanai");
  return url.href;
}

/** DDG returns an abstract plus a tree of related topics; flatten it safely. */
export function parseDuckDuckGo(data = {}) {
  const entries = [];
  const abstract = String(data.AbstractText || "").trim();
  const heading = String(data.Heading || "").trim();
  if (abstract && data.AbstractURL) {
    entries.push({
      title: heading || "DuckDuckGo summary",
      url: data.AbstractURL,
      snippet: abstract,
      provider: "DuckDuckGo",
    });
  }
  const collect = (topics = []) => {
    for (const topic of Array.isArray(topics) ? topics : []) {
      if (topic?.Topics) { collect(topic.Topics); continue; }
      const text = String(topic?.Text || "").trim();
      const url = String(topic?.FirstURL || "").trim();
      if (!text || !url) continue;
      const [label] = text.split(" - ");
      entries.push({ title: label || text.slice(0, 80), url, snippet: text, provider: "DuckDuckGo" });
      if (entries.length >= 6) return;
    }
  };
  collect(data.RelatedTopics);
  return parseSearchResults(entries);
}

/** Merge provider lists, keeping the first (best) copy of each URL. */
export function mergeSearchResults(lists = [], limit = 6) {
  const merged = [];
  const seen = new Set();
  for (const list of lists) {
    for (const result of Array.isArray(list) ? list : []) {
      const url = String(result?.url || "").trim();
      if (!url || seen.has(url.split("#")[0])) continue;
      seen.add(url.split("#")[0]);
      merged.push(result);
      if (merged.length >= limit) return merged;
    }
  }
  return merged;
}

async function limitedText(response, maxBytes = MAX_SEARCH_BYTES) {
  const length = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(length) && length > maxBytes) throw new Error("Search response too large");
  if (!response.body?.getReader) {
    const text = await response.text();
    if (new TextEncoder().encode(text).length > maxBytes) throw new Error("Search response too large");
    return text;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) { await reader.cancel(); throw new Error("Search response too large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder().decode(bytes);
}

async function getJson(url, { fetchImpl = fetch, signal = AbortSignal.timeout(10_000), accept = "application/json" } = {}) {
  const response = await fetchImpl(url, {
    headers: { "User-Agent": USER_AGENT, Accept: accept },
    signal,
    redirect: "error",
  });
  if (!response.ok) throw new Error(`Search source returned HTTP ${response.status}`);
  const text = await limitedText(response);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Search source did not return JSON");
  }
}

export async function searchWikipedia(query, { fetchImpl = fetch, signal = AbortSignal.timeout(10_000), language = "en", host = null } = {}) {
  const data = await getJson(wikipediaSearchUrl(query, language, { host }), { fetchImpl, signal });
  if (data.error) throw new Error("Wikipedia search was unavailable");
  return parseWikipediaResults(data, language, { host });
}

export async function searchDuckDuckGo(query, { fetchImpl = fetch, signal = AbortSignal.timeout(9_000) } = {}) {
  const data = await getJson(duckDuckGoUrl(query), { fetchImpl, signal });
  return parseDuckDuckGo(data);
}

/**
 * Run the keyless providers in parallel and keep whatever answers came back.
 * One provider failing never hides the others, and a total failure is reported
 * to the caller instead of inventing results.
 */
export async function searchOutside(query, { natural = "", language = "en", fetchImpl = fetch, timeoutMs = 12_000, includeSimpleEnglish = true } = {}) {
  const trimmed = String(query || "").trim().slice(0, 300);
  if (!trimmed) return { results: [], providers: [], errors: ["empty-query"] };
  const signal = AbortSignal.timeout(timeoutMs);
  const edition = wikipediaLanguage(language);
  // Wikipedia ranks keywords better; an instant-answer API understands the full
  // question. Send each provider the query shape it works best with.
  const spoken = String(natural || trimmed).trim().slice(0, 300) || trimmed;
  const tasks = [
    ["Wikipedia", searchWikipedia(trimmed, { fetchImpl, signal, language })],
    ["DuckDuckGo", searchDuckDuckGo(spoken, { fetchImpl, signal })],
  ];
  if (edition !== "en" && includeSimpleEnglish) {
    // A non-English question benefits from an English encyclopedic article too.
    tasks.push(["Wikipedia (English)", searchWikipedia(trimmed, { fetchImpl, signal, language: "en" })]);
  }
  const settled = await Promise.allSettled(tasks.map(([, promise]) => promise));
  const lists = [];
  const providers = [];
  const errors = [];
  settled.forEach((outcome, index) => {
    const [label] = tasks[index];
    if (outcome.status === "fulfilled" && outcome.value.length) {
      lists.push(outcome.value.filter((result) => result.provider !== "DuckDuckGo"));
      lists.push(outcome.value.filter((result) => result.provider === "DuckDuckGo"));
      if (!providers.includes(label.split(" (")[0])) providers.push(label.split(" (")[0]);
    } else if (outcome.status === "rejected") {
      errors.push(`${label}: ${outcome.reason?.message || "unavailable"}`);
    }
  });
  let results = mergeSearchResults(lists, 6);
  if (!results.length && includeSimpleEnglish && edition !== "simple") {
    try {
      const simple = await searchWikipedia(trimmed, { fetchImpl, signal, host: "simple" });
      if (simple.length) {
        results = simple;
        providers.push("Simple English Wikipedia");
      }
    } catch (error) {
      errors.push(`Simple English Wikipedia: ${error.message}`);
    }
  }
  return { results, providers, errors };
}

export { limitedText, MAX_SEARCH_BYTES, USER_AGENT };
