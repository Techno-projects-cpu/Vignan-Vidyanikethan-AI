/**
 * Optional, explicitly enabled web fallback.
 *
 * Textbook answers never silently mix with web content. If the local index has
 * no evidence, these results are shown with an "outside your textbooks" label.
 * The app ships with web fallback OFF and no third-party search provider.
 */

import { safeUrl, truncate } from "./util.js";

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
    results.push({
      title: truncate(title || new URL(url).hostname, 120),
      url,
      domain: new URL(url).hostname.replace(/^www\./, ""),
      snippet: truncate(snippet || "Open this source to read more.", 220),
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

export async function searchWeb(query, settings = {}, { signal } = {}) {
  if (!settings.webEnabled) return { results: [], enabled: false, message: "Web fallback is off." };
  const mode = settings.webMode || "server";
  if (mode === "server") {
    const response = await fetch("api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
      signal,
    });
    const data = await responseJson(response);
    if (!response.ok) throw new Error(data.error || `Search failed (${response.status})`);
    return { results: parseSearchResults(data.results || data), enabled: true, message: data.message || "" };
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
  return { results: parseSearchResults(data), enabled: true, message: "" };
}

export function externalSearchUrl(query, provider = "duckduckgo") {
  const encoded = encodeURIComponent(query);
  return provider === "google"
    ? `https://www.google.com/search?q=${encoded}`
    : `https://duckduckgo.com/?q=${encoded}`;
}
