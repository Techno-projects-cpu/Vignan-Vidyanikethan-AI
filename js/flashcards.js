/**
 * Flashcard generation and a tiny Leitner spaced-repetition scheduler.
 * Cards are derived from retrieved passages and always carry a page citation.
 */

import { questionCopy } from "./question-copy.js?v=17";
import { localDay, truncate, uid } from "./util.js?v=17";
import { splitSentences, tokenize } from "./text.js?v=17";

const PROGRESS_KEY = "vignan-study-ai.flashcards.v1";
const INTERVALS = [0, 1, 3, 7, 16, 35];
const GENERIC = new Set(
  "because through before after while where there these those their which would should could about every other first second third important following example means called".split(
    /\s+/,
  ),
);

function findKeyTerm(sentence) {
  const candidates = sentence.match(/[\p{L}\p{M}][\p{L}\p{M}-]{4,}/gu) || [];
  const meaningful = candidates.filter((word) => {
    const lower = word.toLowerCase();
    return !GENERIC.has(lower) && tokenize(lower).length && !/^(the|and|for|with|from|that|this)$/i.test(lower);
  });
  if (meaningful.length) return meaningful.sort((a, b) => b.length - a.length)[0];
  const words = sentence.split(/\s+/).filter((word) => word.replace(/[^A-Za-z]/g, "").length > 5);
  return words[0]?.replace(/[^A-Za-z-]/g, "") || "";
}

function definitionCard(sentence, language = "en") {
  const match = sentence.match(/^(.{3,80}?)\s+(is|are|means|refers to|is called|are called)\s+(.{8,220})$/i);
  if (!match) return null;
  const subject = match[1].replace(/^(the|a|an)\s+/i, "").trim();
  const verb = /means|refers/i.test(match[2]) ? "mean" : "is/are";
  const copy = questionCopy(language);
  return {
    front: language === "te" ? `“${subject}” అంటే ఏమిటి?` : language === "hi" ? `“${subject}” क्या है?`
      : language !== "en" ? copy.whatIs.replace("{subject}", subject)
        : verb === "mean" ? `What does “${subject}” mean?` : `What ${verb.includes("is") ? "is" : "are"} ${subject}?`,
    back: sentence,
  };
}

function clozeCard(sentence, language = "en") {
  const term = findKeyTerm(sentence);
  if (!term || sentence.length < 35) return null;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let blanked = sentence.replace(new RegExp(`\\b${escaped}\\b`, "i"), "________");
  // JavaScript's \\b is ASCII-oriented; retain words in Telugu/Hindi scripts.
  if (blanked === sentence) blanked = sentence.replace(new RegExp(escaped, "iu"), "________");
  if (blanked === sentence) return null;
  return {
    front: `${questionCopy(language).complete}: “${truncate(blanked, 190)}”`,
    back: `**${term}** — ${sentence}`,
  };
}

/** Build up to `count` cards from ranked passages. */
export function buildFlashcards(hits = [], count = 6, { language = "en" } = {}) {
  const cards = [];
  const seen = new Set();
  hits.forEach((hit, index) => {
    const source = {
      n: index + 1,
      bookId: hit.bookId,
      chunkId: hit.chunkId,
      title: hit.title,
      sourceUrl: hit.sourceUrl || "",
      sourceKind: hit.sourceKind || "",
      page: hit.page,
      section: hit.section,
      quote: truncate(hit.text, 260),
    };
    for (const rawSentence of splitSentences(hit.text)) {
      if (cards.length >= count) break;
      const sentence = rawSentence.replace(/\s+/g, " ").trim();
      if (sentence.length < 35 || sentence.length > 280) continue;
      const card = definitionCard(sentence, language) || clozeCard(sentence, language);
      if (!card) continue;
      const key = card.front.toLowerCase().replace(/\s+/g, " ").slice(0, 80);
      if (seen.has(key)) continue;
      seen.add(key);
      cards.push({
        id: uid("card"),
        front: card.front,
        back: card.back,
        source,
        topic: hit.section || "Notes",
      });
    }
  });
  return cards.slice(0, count);
}

export function initialProgress() {
  return { box: 0, due: localDay(), reviews: 0, correct: 0 };
}

export function addDays(day, days) {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() + days);
  return localDay(date);
}

export function reviewCard(progress, cardId, remembered, today = localDay()) {
  const current = progress[cardId] || initialProgress();
  const box = remembered ? Math.min(INTERVALS.length - 1, (current.box || 0) + 1) : 0;
  const next = {
    ...current,
    box,
    due: addDays(today, INTERVALS[box]),
    reviews: (current.reviews || 0) + 1,
    correct: (current.correct || 0) + (remembered ? 1 : 0),
  };
  return { ...progress, [cardId]: next };
}

export function dueCards(cards, progress, today = localDay()) {
  return cards.filter((card) => {
    const state = progress[card.id];
    return !state || !state.due || state.due <= today;
  });
}

export function deckStats(cards, progress, today = localDay()) {
  const stats = { due: 0, learning: 0, mastered: 0, reviews: 0 };
  for (const card of cards) {
    const state = progress[card.id];
    if (!state || !state.due || state.due <= today) stats.due += 1;
    if (!state || state.box <= 1) stats.learning += 1;
    else stats.mastered += 1;
    stats.reviews += state?.reviews || 0;
  }
  return stats;
}

export function readProgress(storage) {
  try {
    const target = storage === undefined ? globalThis.localStorage : storage;
    return JSON.parse(target?.getItem(PROGRESS_KEY) || "{}");
  } catch {
    return {};
  }
}

export function writeProgress(progress, storage) {
  try {
    const target = storage === undefined ? globalThis.localStorage : storage;
    target?.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // Storage may be disabled; the in-memory copy still works for this session.
  }
}
