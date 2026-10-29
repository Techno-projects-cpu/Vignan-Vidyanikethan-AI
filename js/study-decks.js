/** Saved, device-local revision decks. No accounts or network are required. */

import { dueCards, reviewCard } from "./flashcards.js?v=30";
import { localDay, truncate, uid } from "./util.js?v=30";

export const STUDY_DECKS_KEY = "study-decks-v1";

export function emptyDeckCollection() {
  return { version: 1, activeDeckId: "", decks: [] };
}

export function normalizeDeckCollection(value) {
  const decks = Array.isArray(value?.decks)
    ? value.decks.filter((deck) => deck && typeof deck.id === "string" && Array.isArray(deck.cards)).map((deck) => ({
        ...deck,
        title: String(deck.title || "Untitled deck"),
        cards: deck.cards.filter((card) => card && typeof card.id === "string" && typeof card.front === "string" && typeof card.back === "string"),
        progress: deck.progress && typeof deck.progress === "object" && !Array.isArray(deck.progress) ? deck.progress : {},
      }))
    : [];
  const activeDeckId = decks.some((deck) => deck.id === value?.activeDeckId) ? value.activeDeckId : decks[0]?.id || "";
  return { version: 1, activeDeckId, decks };
}

export function makeStudyDeck({ cards = [], topic = "", title = "", bookIds = [], originResultId = "" } = {}, now = new Date()) {
  const valid = cards.filter((card) => card && typeof card.front === "string" && card.front.trim() && typeof card.back === "string" && card.back.trim());
  if (!valid.length) throw new Error("There are no cards to save.");
  return {
    id: uid("deck"),
    title: truncate(String(title || topic || "General practice").trim(), 80),
    topic: truncate(String(topic || "").trim(), 120),
    bookIds: [...new Set(bookIds.filter(Boolean).map(String))],
    originResultId: String(originResultId || ""),
    createdAt: now.toISOString(),
    cards: valid.map((card) => ({ ...card, id: card.id || uid("card") })),
    progress: {},
  };
}

export function addDeck(collection, deck) {
  const current = normalizeDeckCollection(collection);
  return { ...current, activeDeckId: deck.id, decks: [deck, ...current.decks.filter((item) => item.id !== deck.id)] };
}

export function selectDeck(collection, deckId) {
  const current = normalizeDeckCollection(collection);
  return current.decks.some((deck) => deck.id === deckId) ? { ...current, activeDeckId: deckId } : current;
}

export function removeDeck(collection, deckId) {
  const current = normalizeDeckCollection(collection);
  const decks = current.decks.filter((deck) => deck.id !== deckId);
  return { ...current, decks, activeDeckId: current.activeDeckId === deckId ? decks[0]?.id || "" : current.activeDeckId };
}

export function activeDeck(collection) {
  const current = normalizeDeckCollection(collection);
  return current.decks.find((deck) => deck.id === current.activeDeckId) || null;
}

export function reviewDeck(collection, deckId, cardId, remembered, today = localDay()) {
  const current = normalizeDeckCollection(collection);
  return {
    ...current,
    decks: current.decks.map((deck) =>
      deck.id === deckId && deck.cards.some((card) => card.id === cardId)
        ? { ...deck, progress: reviewCard(deck.progress, cardId, remembered, today) }
        : deck,
    ),
  };
}

/** Keep the next due card in order when a remembered card leaves the queue. */
export function nextReviewIndex(before, currentId, after) {
  if (!after.length) return 0;
  const stillDue = after.findIndex((card) => card.id === currentId);
  if (stillDue >= 0) return (stillDue + 1) % after.length;
  const oldIndex = Math.max(0, before.findIndex((card) => card.id === currentId));
  return oldIndex % after.length;
}

function mistakeItems(result = {}) {
  return (Array.isArray(result.perQuestion) ? result.perQuestion : []).filter(
    (item) => item?.question?.prompt && Number(item.awarded || 0) < 1,
  );
}

/** Convert incorrect or partially correct quiz answers into cited revision cards. */
export function cardsFromMistakes(result = {}) {
  return mistakeItems(result).map((item) => {
      const question = item.question;
      const source = question.source || {};
      return {
        id: uid("card"),
        front: String(question.prompt || "").trim(),
        back: String(item.correctText || question.answer || question.reference || "See the cited page.").trim(),
        topic: question.topic || result.topic || "Revision",
        source: { ...source, title: source.title || "Textbook", page: source.page || 1 },
      };
    })
    .filter((card) => card.front && card.back);
}

/** A small, honest next step based only on work already on this device. */
export function nextStudyStep(collection, results = [], today = localDay()) {
  const current = normalizeDeckCollection(collection);
  const due = current.decks.map((deck) => ({ deck, count: dueCards(deck.cards, deck.progress, today).length })).filter((item) => item.count > 0);
  if (due.length) return { kind: "due", deckId: due[0].deck.id, count: due.reduce((sum, item) => sum + item.count, 0) };
  const result = (Array.isArray(results) ? results : []).find((item) =>
    item?.id && mistakeItems(item).length && !current.decks.some((deck) => deck.originResultId === item.id),
  );
  if (result) return { kind: "mistakes", resultId: result.id, count: mistakeItems(result).length };
  return { kind: "quiz" };
}
