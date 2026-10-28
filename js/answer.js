/**
 * Grounded, extractive answer composer (the default offline engine).
 *
 * It does not pretend to be a generative model: it selects the most relevant
 * sentences from retrieved pages and attaches a citation to each one. If the
 * evidence is weak it refuses to answer. Optional web results are always
 * labelled as being outside the textbooks.
 */

import { salientSentences, splitSentences } from "./text.js?v=13";
import { truncate } from "./util.js?v=13";
import { buildFlashcards } from "./flashcards.js?v=13";

export function sourcesFromHits(hits = []) {
  return hits.map((hit, index) => ({
    n: index + 1,
    bookId: hit.bookId,
    chunkId: hit.chunkId,
    title: hit.title,
    subject: hit.subject,
    page: hit.page,
    section: hit.section,
    text: hit.text,
    quote: truncate(hit.text, 300),
    score: hit.score,
  }));
}

function cleanSentence(sentence) {
  return String(sentence || "")
    .replace(/\s+/g, " ")
    .replace(/^["“]|["”]$/g, "")
    .trim();
}

function citation(n) {
  return `[${n}]`;
}

function intro(query, mode) {
  const topic = truncate(query.replace(/[?.!]+$/, ""), 90);
  if (mode === "summarize") return `**Revision summary — ${topic}**`;
  if (mode === "explain") return `**Step-by-step from your books — ${topic}**`;
  if (mode === "practice") return `**Practice questions — ${topic}**`;
  if (mode === "flashcards") return `**Flashcards — ${topic}**`;
  return `**From your textbooks — ${topic}**`;
}

function webBlock(webResults = []) {
  if (!webResults.length) return "";
  const lines = webResults.slice(0, 4).map(
    (result, index) => `- [W${index + 1}] **${result.title}** — ${truncate(result.snippet || "No preview available.", 160)}`,
  );
  return [
    "",
    "_The following links are **outside your textbooks** and are not verified answers. Check them independently._",
    ...lines,
  ].join("\n");
}

export function notFoundMessage(reason, webResults = [], webEnabled = false) {
  let headline;
  if (reason === "empty-library") {
    headline =
      "Your library is empty. Add a class PDF, paste notes, or load the demo study pack in **Library** first — then I can answer with page citations.";
  } else if (reason === "too-vague") {
    headline = "Please name a topic or concept in your question — for example, “Why do leaves look green?”";
  } else {
    headline =
      "**I could not find this in your textbooks.** I will not invent an answer. Try a different wording, upload the relevant chapter, or check the page list in Library.";
  }
  if (webEnabled && !webResults.length) {
    headline +=
      "\n\nWeb fallback is on, but no outside results were returned. Check the search endpoint in **Settings**.";
  }
  return `${headline}${webBlock(webResults)}`;
}

function extractiveLines(query, sources, mode) {
  const lines = [];
  const perSource = mode === "summarize" ? 2 : 2;
  sources.slice(0, 4).forEach((source) => {
    const sentences = salientSentences(source.text, query, perSource).map(cleanSentence);
    if (!sentences.length) return;
    const marker = citation(source.n);
    const heading = source.section && source.section !== "Notes" ? `**${source.section}** · ` : "";
    sentences.forEach((sentence) => {
      lines.push(`${heading}“${truncate(sentence, 320)}” — ${source.title}, p. ${source.page}. ${marker}`);
    });
  });
  return lines;
}

function practiceQuestions(query, sources) {
  const questions = [];
  sources.slice(0, 4).forEach((source) => {
    const sentence = cleanSentence(salientSentences(source.text, query, 1)[0] || "");
    if (!sentence) return;
    const words = sentence.split(/\s+/).filter(Boolean);
    const key = words.find((word) => word.replace(/[^A-Za-z]/g, "").length > 5) || "this idea";
    questions.push(`- **${key.replace(/[^A-Za-z]/g, "")}:** ${truncate(sentence, 180)} What does this tell you? ${citation(source.n)}`);
  });
  return questions;
}

/**
 * Compose an offline answer from retrieved passages.
 * @returns {{text:string, sources:Array, webSources:Array, flashcards:Array, grounded:boolean}}
 */
export function composeGroundedAnswer({
  query,
  hits = [],
  mode = "answer",
  reason = "ok",
  confidence = 0,
  webResults = [],
  webEnabled = false,
} = {}) {
  const sources = sourcesFromHits(hits);
  if (!sources.length) {
    return {
      text: notFoundMessage(reason, webResults, webEnabled),
      sources: [],
      webSources: webResults,
      flashcards: [],
      grounded: false,
      confidence: 0,
    };
  }

  const parts = [intro(query, mode), ""];
  if (mode === "practice") {
    parts.push(...practiceQuestions(query, sources));
    parts.push("", "_Write your answers first, then generate a quiz in the Quiz tab to check them._");
  } else if (mode === "flashcards") {
    const flashcards = buildFlashcards(hits, 6);
    flashcards.forEach((card, index) => {
      parts.push(`**${index + 1}. ${card.front}**`);
      parts.push(`${card.back} ${citation(card.source.n)}`);
      parts.push("");
    });
    parts.push("_Tip: open **Flashcards** to review these with spaced repetition._");
    return {
      text: parts.join("\n").trim(),
      sources,
      webSources: [],
      flashcards,
      grounded: true,
      confidence,
    };
  } else if (mode === "explain") {
    const lines = extractiveLines(query, sources.slice(0, 3), mode);
    lines.forEach((line, index) => parts.push(`**${index + 1}.** ${line}`));
    parts.push("", "_Each step is taken from a cited passage; open the source to read the full page._");
  } else {
    parts.push(...extractiveLines(query, sources, mode).map((line) => `- ${line}`));
    if (mode === "summarize") {
      parts.push("", `_Quick check: ${cleanSentence(splitSentences(sources[0].text)[0] || "")}`);
    }
  }

  return {
    text: parts.join("\n").trim(),
    sources,
    webSources: [],
    flashcards: [],
    grounded: true,
    confidence,
  };
}

/** Used by the UI to decide whether to show the "low confidence" hint. */
export function confidenceLabel(confidence) {
  if (confidence >= 0.62) return "Strong match in your books";
  if (confidence >= 0.34) return "Partial match — verify the pages";
  return "Weak match — check the cited pages";
}
