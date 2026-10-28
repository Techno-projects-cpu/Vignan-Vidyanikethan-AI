/** Clearly labelled, extractive answers from outside the student's books. */
import { retrieve } from "./retrieval.js?v=15";
import { linkTopic, searchTopic } from "./conversation.js?v=15";
import { salientSentences, splitSentences, tokenize } from "./text.js?v=15";
import { truncate } from "./util.js?v=15";

function quoteFrom(text, query, { opening = false } = {}) {
  const raw = opening ? splitSentences(text).slice(0, 2) : salientSentences(text, query, 2);
  const quote = (raw.length ? raw : [text]).join(" ").replace(/\s+/g, " ").trim();
  return truncate(quote, 600);
}

/** Results without any topic overlap remain links, not asserted answers. */
export function composeWebAnswer({ query = "", results = [], provider = "Web search" } = {}) {
  const words = new Set(tokenize(searchTopic(query)));
  const relevant = results.filter((result) => {
    if (!result?.url || !result.snippet || result.snippet === "Open this source to read more.") return false;
    const textWords = new Set(tokenize(`${result.title} ${result.snippet}`));
    return words.size && [...words].some((word) => textWords.has(word));
  }).slice(0, 2);
  if (!relevant.length) return null;
  const lines = relevant.map((result, index) => `- “${quoteFrom(result.snippet, query)}” — **${result.title}** [W${index + 1}]`);
  return {
    text: [
      "**I could not find this in your textbooks.**",
      `**Outside your textbooks · ${provider === "Wikipedia" ? "Wikipedia" : "web search"}**`,
      "Here are short source excerpts, not independently verified answers:",
      ...lines,
      "_Open the linked sources and verify them before relying on them._",
    ].join("\n\n"),
    sources: [], webSources: relevant, flashcards: [], grounded: false, confidence: 0,
    meta: "Bolt · outside-source excerpts", verification: { enabled: false },
  };
}

/**
 * A supplied link is searched separately from the library. A PDF retains its
 * real page numbers; webpages do not get made-up page citations.
 */
export function composeLinkAnswer({ query = "", resource, index } = {}) {
  if (!resource?.pages?.length || !resource.url) throw new Error("That link has no readable text.");
  const topic = linkTopic(query);
  const hasTopic = tokenize(topic).length > 0;
  const found = hasTopic && index ? retrieve(topic, [index], { topK: 2 }) : null;
  const matched = Boolean(found?.grounded && found.hits.length);
  const firstPage = resource.pages.find((page) => String(page.text || "").trim());
  if (!firstPage) throw new Error("That link has no readable text.");
  const snippets = matched ? found.hits : [{ text: firstPage.text, page: firstPage.page || 1 }];
  const isPdf = resource.inspected?.kind === "pdf";
  const results = snippets.map((hit) => {
    const url = new URL(resource.url);
    if (isPdf) url.hash = `page=${hit.page}`;
    const snippet = quoteFrom(hit.text, topic, { opening: !matched });
    return { title: resource.title || url.hostname, url: url.href, domain: url.hostname.replace(/^www\./, ""), snippet, ...(isPdf ? { page: hit.page } : {}) };
  });
  const note = matched
    ? "Here are passages matching your question:"
    : hasTopic
      ? "I could not find that topic confidently in this link. Here is an opening excerpt instead:"
      : "Here is an opening excerpt, not a full summary:";
  const lines = results.map((source, index) => `- “${source.snippet}”${source.page ? ` · PDF page ${source.page}` : ""} [W${index + 1}]`);
  return {
    text: ["**Outside your textbooks · link supplied by you**", note, ...lines, "_This source may be inaccurate. Open it and verify the information._"].join("\n\n"),
    sources: [], webSources: results, flashcards: [], grounded: false, confidence: 0,
    meta: "Bolt · linked-source excerpts", verification: { enabled: false },
  };
}
