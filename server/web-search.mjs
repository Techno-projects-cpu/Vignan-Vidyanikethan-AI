/** Keyless Wikipedia fallback. Search results are outside the student's books. */
import { parseSearchResults } from "../js/web.js?v=14";

const WIKI_LANGUAGES = new Set(["en", "te", "hi"]);
const wikiLanguage = (value) => WIKI_LANGUAGES.has(value) ? value : "en";
const MAX_SEARCH_BYTES = 1024 * 1024;
const USER_AGENT = "VignanVidyanikethanAI/1.9.0 (+https://github.com/Techno-projects-cpu/Vignan-Vidyanikethan-AI/issues)";

export function wikipediaSearchUrl(query, language = "en") {
  const url = new URL(`https://${wikiLanguage(language)}.wikipedia.org/w/api.php`);
  for (const [key, value] of Object.entries({
    action: "query", generator: "search", gsrsearch: String(query || "").trim().slice(0, 300),
    gsrlimit: "4", gsrnamespace: "0", prop: "extracts|info", exintro: "1", explaintext: "1",
    exchars: "1000", exlimit: "max", inprop: "url", format: "json", formatversion: "2",
  })) url.searchParams.set(key, value);
  return url.href;
}

export function parseWikipediaResults(data, language = "en") {
  const hostLanguage = wikiLanguage(language);
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
      };
    });
  return parseSearchResults(entries);
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

export async function searchWikipedia(query, { fetchImpl = fetch, signal = AbortSignal.timeout(10_000), language = "en" } = {}) {
  const response = await fetchImpl(wikipediaSearchUrl(query, language), {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal,
    redirect: "error",
  });
  if (!response.ok) throw new Error(`Wikipedia returned HTTP ${response.status}`);
  const text = await limitedText(response);
  const data = JSON.parse(text);
  if (data.error) throw new Error("Wikipedia search was unavailable");
  return parseWikipediaResults(data, language);
}

export { limitedText };
