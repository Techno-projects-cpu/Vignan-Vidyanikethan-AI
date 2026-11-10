import test from "node:test";
import assert from "node:assert/strict";
import { dueCards } from "../js/flashcards.js";
import {
  activeDeck, addDeck, cardsFromMistakes, emptyDeckCollection, makeStudyDeck, nextReviewIndex,
  nextStudyStep, normalizeDeckCollection, removeDeck, reviewDeck, selectDeck,
} from "../js/study-decks.js";

const cards = [
  { id: "a", front: "What is A?", back: "A fact.", source: { bookId: "b1", title: "Science", page: 12 } },
  { id: "b", front: "What is B?", back: "B fact.", source: { bookId: "b1", title: "Science", page: 14 } },
  { id: "c", front: "What is C?", back: "C fact.", source: { bookId: "b1", title: "Science", page: 19 } },
];
const result = {
  id: "result-1", topic: "Science", perQuestion: [
    { awarded: 0, correctText: "Chlorophyll", question: { prompt: "What makes leaves green?", topic: "Plants", source: { bookId: "b1", title: "Science", page: 12, quote: "Chlorophyll reflects green light." } } },
    { awarded: 0.5, correctText: "Energy", question: { prompt: "What does respiration release?", source: { bookId: "b1", title: "Science", page: 14 } } },
    { awarded: 1, correctText: "Correct", question: { prompt: "Already learned", source: { page: 1 } } },
  ],
};

test("decks preserve cards, sources and schedules through serialization", () => {
  const deck = makeStudyDeck({ cards, topic: "Science", bookIds: ["b1"] }, new Date("2026-10-28T10:00:00Z"));
  let collection = addDeck(emptyDeckCollection(), deck);
  collection = reviewDeck(collection, deck.id, "a", true, "2026-10-28");
  const restored = normalizeDeckCollection(JSON.parse(JSON.stringify(collection)));
  assert.equal(activeDeck(restored).cards[0].source.page, 12);
  assert.equal(activeDeck(restored).progress.a.due, "2026-10-29");
  assert.deepEqual(dueCards(activeDeck(restored).cards, activeDeck(restored).progress, "2026-10-28").map((card) => card.id), ["b", "c"]);
  assert.throws(() => makeStudyDeck({ cards: [] }), /no cards/i);
});

test("decks can be switched and deleted without affecting others", () => {
  const first = makeStudyDeck({ cards: [cards[0]], title: "First" });
  const second = makeStudyDeck({ cards: [cards[1]], title: "Second" });
  let collection = addDeck(addDeck(emptyDeckCollection(), first), second);
  assert.equal(activeDeck(collection).id, second.id);
  collection = selectDeck(collection, first.id);
  assert.equal(activeDeck(collection).id, first.id);
  collection = removeDeck(collection, first.id);
  assert.equal(activeDeck(collection).id, second.id);
  assert.equal(collection.decks.length, 1);
});

test("review queue does not skip a card after a remembered answer", () => {
  assert.equal(nextReviewIndex(cards, "a", [cards[1], cards[2]]), 0);
  assert.equal(nextReviewIndex(cards, "b", [cards[0], cards[2]]), 1);
  assert.equal(nextReviewIndex(cards, "c", [cards[0], cards[1]]), 0);
  assert.equal(nextReviewIndex(cards, "a", cards), 1, "forgotten cards stay due and move to the back");
  assert.equal(nextReviewIndex(cards, "a", []), 0);
});

test("mistakes become cited cards and next steps avoid duplicating a saved review deck", () => {
  const revision = cardsFromMistakes(result);
  assert.equal(revision.length, 2);
  assert.equal(revision[0].source.bookId, "b1");
  assert.equal(revision[0].source.page, 12);
  assert.equal(revision[0].back, "Chlorophyll");
  let collection = emptyDeckCollection();
  assert.deepEqual(nextStudyStep(collection, [result], "2026-10-28"), { kind: "mistakes", resultId: "result-1", count: 2 });
  const deck = makeStudyDeck({ cards: revision, originResultId: result.id });
  collection = addDeck(collection, deck);
  assert.equal(nextStudyStep(collection, [result], "2026-10-28").kind, "due");
  for (const card of deck.cards) collection = reviewDeck(collection, deck.id, card.id, true, "2026-10-28");
  assert.deepEqual(nextStudyStep(collection, [result], "2026-10-28"), { kind: "quiz" });
  assert.equal(nextStudyStep(collection, [result], "2026-10-29").kind, "due");
});

test("local data export includes decks and their schedules", async () => {
  const db = await import("../js/db.js");
  await db.clearAllData();
  const deck = makeStudyDeck({ cards: [cards[0]], topic: "Science" });
  let collection = addDeck(emptyDeckCollection(), deck);
  collection = reviewDeck(collection, deck.id, "a", true, "2026-10-28");
  await db.setSetting("study-decks-v1", collection);
  const exported = await db.exportData();
  const stored = exported.settings.find((entry) => entry.key === "study-decks-v1").value;
  assert.equal(stored.decks[0].cards[0].source.page, 12);
  assert.equal(stored.decks[0].progress.a.due, "2026-10-29");
  await db.clearAllData();
  assert.equal(await db.getSetting("study-decks-v1", null), null);
});
