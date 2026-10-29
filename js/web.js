/**
 * Optional, explicitly enabled web fallback.
 *
 * Textbook answers never silently mix with web content. If the local index has
 * no evidence, these results are shown with an "outside your textbooks" label.
 * The built-in server fallback searches Wikipedia without an API key. Students
 * can turn it off; configured JSON search providers remain optional.
 */

import { safeUrl, truncate } from "./util.js?v=34";
import { LANGUAGE_CODES } from "./languages.js?v=34";

function firstArray(data) {
  if (Array.isArray(data)) return data;
  const candidates = [
    data?.results,
    data?.items,
    data?.organic,
    data?.webPages?.value,
    data?.data,
    data?.RelatedTopics,
    data?.topics,
  ];
  return candidates.find(Array.isArray) || [];
}

export function parseSearchResults(data, limit = 5) {
  const results = [];
  for (const entry of firstArray(data)) {
    const rawUrl = entry?.url || entry?.link || entry?.href || entry?.FirstURL;
    const url = safeUrl(rawUrl);
    if (!url) continue;
    const title = String(entry?.title || entry?.name || entry?.Text || new URL(url).hostname).trim();
    const snippet = String(entry?.snippet || entry?.description || entry?.content || entry?.Text || "").trim();
    if (results.some((result) => result.url === url)) continue;
    const entryPassage = typeof entry?.passage === "string" ? entry.passage.trim() : "";
    results.push({
      title: truncate(title || new URL(url).hostname, 120),
      url,
      domain: new URL(url).hostname.replace(/^www\./, ""),
      snippet: truncate(snippet || "Open this source to read more.", 1000),
      ...(entryPassage.length > 200 ? { passage: truncate(entryPassage, 3200) } : {}),
      ...(entry?.provider ? { provider: String(entry.provider).slice(0, 40) } : {}),
    });
    if (results.length >= limit) break;
  }
  return results;
}

async function responseJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error("The search endpoint did not return JSON. Configure a JSON search API in Settings.");
  }
}

export async function searchWeb(query, settings = {}, { signal, natural = "" } = {}) {
  if (!settings.webEnabled) return { results: [], enabled: false, message: "Web fallback is off." };
  const mode = settings.webMode || "server";
  if (mode === "server") {
    const response = await fetch("api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        natural: String(natural || "").slice(0, 300),
        language: LANGUAGE_CODES.includes(settings.language) ? settings.language : "en",
        read: true,
      }),
      signal,
    });
    const data = await responseJson(response);
    if (!response.ok) throw new Error(data.error || `Search failed (${response.status})`);
    const providers = Array.isArray(data.providers) && data.providers.length
      ? data.providers.map(String).slice(0, 4)
      : data.provider ? [String(data.provider)] : [];
    return {
      results: parseSearchResults(data.results || data),
      enabled: true,
      provider: data.provider || "Web search",
      providers,
      message: data.message || "",
    };
  }

  const endpoint = String(settings.searchEndpoint || "").trim();
  if (!endpoint) {
    return { results: [], enabled: true, message: "Add a search endpoint in Settings to enable web fallback." };
  }
  const url = endpoint.includes("{q}")
    ? endpoint.replace("{q}", encodeURIComponent(query))
    : `${endpoint}${endpoint.includes("?") ? "&" : "?"}q=${encodeURIComponent(query)}`;
  if (!safeUrl(url)) throw new Error("The search endpoint must be an http(s) URL.");
  const headers = settings.searchToken ? { Authorization: `Bearer ${settings.searchToken}` } : {};
  const response = await fetch(url, { headers, signal });
  const data = await responseJson(response);
  if (!response.ok) throw new Error(data.error?.message || `Search failed (${response.status})`);
  return { results: parseSearchResults(data), enabled: true, provider: "Web search", message: "" };
}

export function externalSearchUrl(query, provider = "duckduckgo") {
  const encoded = encodeURIComponent(query);
  return provider === "google"
    ? `https://www.google.com/search?q=${encoded}`
    : `https://duckduckgo.com/?q=${encoded}`;
}
