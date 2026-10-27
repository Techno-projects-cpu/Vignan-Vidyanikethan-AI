import test from "node:test";
import assert from "node:assert/strict";
import { addDays, buildFlashcards, deckStats, dueCards, initialProgress, reviewCard } from "../js/flashcards.js";
import { chapterHits } from "./helpers.mjs";

test("buildFlashcards creates cited question/answer pairs", () => {
  const cards = buildFlashcards(chapterHits("photosynthesis", 8), 6);
  assert.ok(cards.length >= 4);
  assert.ok(cards.length <= 6);
  for (const card of cards) {
    assert.ok(card.front.length > 10);
    assert.ok(card.back.length > 20);
    assert.ok(card.source.page >= 1);
    assert.ok(card.source.title);
  }
  const fronts = cards.map((card) => card.front.toLowerCase());
  assert.equal(new Set(fronts).size, fronts.length, "flashcards should not repeat the same prompt");
});

test("Leitner review moves remembered cards forward and forgotten cards back", () => {
  const cardId = "card-1";
  let progress = { [cardId]: initialProgress() };
  progress = reviewCard(progress, cardId, true, "2026-10-27");
  assert.equal(progress[cardId].box, 1);
  assert.equal(progress[cardId].due, "2026-10-28");
  assert.equal(progress[cardId].correct, 1);
  progress = reviewCard(progress, cardId, false, "2026-10-28");
  assert.equal(progress[cardId].box, 0);
  assert.equal(progress[cardId].due, "2026-10-28");
  assert.equal(progress[cardId].reviews, 2);
});

test("dueCards and deckStats reflect the schedule", () => {
  const cards = [
    { id: "a" },
    { id: "b" },
    { id: "c" },
  ];
  const progress = {
    a: { box: 3, due: "2026-11-10", reviews: 4, correct: 3 },
    b: { box: 1, due: "2026-10-27", reviews: 2, correct: 1 },
  };
  const due = dueCards(cards, progress, "2026-10-27");
  assert.deepEqual(due.map((card) => card.id), ["b", "c"]);
  const stats = deckStats(cards, progress, "2026-10-27");
  assert.equal(stats.mastered, 1);
  assert.equal(stats.reviews, 6);
});

test("addDays uses local calendar days", () => {
  assert.equal(addDays("2026-10-27", 1), "2026-10-28");
  assert.equal(addDays("2026-10-31", 3), "2026-11-03");
});
