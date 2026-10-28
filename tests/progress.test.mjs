import test from "node:test";
import assert from "node:assert/strict";
import {
  accuracy,
  currentStreak,
  defaultProgress,
  leaderboard,
  readProgress,
  recordResult,
  resetProgress,
  streakMessage,
  topicMastery,
  writeProgress,
} from "../js/progress.js";

function result(overrides = {}) {
  return {
    id: "r1",
    date: "2026-10-27T10:00:00.000Z",
    day: "2026-10-27",
    topic: "Photosynthesis",
    percent: 80,
    score: 4,
    total: 5,
    xp: 50,
    topicBreakdown: [{ topic: "Photosynthesis", correct: 4, total: 5, percent: 80 }],
    ...overrides,
  };
}

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key),
  };
}

test("recordResult starts a streak and accumulates XP", () => {
  let progress = defaultProgress();
  progress = recordResult(progress, result(), { day: "2026-10-27", profile: "Ananya" });
  assert.equal(progress.current, 1);
  assert.equal(progress.best, 1);
  assert.equal(progress.xp, 50);
  assert.equal(progress.totalQuizzes, 1);
  assert.equal(progress.history[0].profile, "Ananya");
  assert.equal(accuracy(progress), 80);
  assert.match(streakMessage(progress, "2026-10-27"), /1-day streak/);
});

test("streak increments on consecutive days and resets after a gap", () => {
  let progress = recordResult(defaultProgress(), result(), { day: "2026-10-27" });
  progress = recordResult(progress, result({ id: "r2" }), { day: "2026-10-28" });
  assert.equal(progress.current, 2);
  assert.equal(progress.best, 2);
  progress = recordResult(progress, result({ id: "r3" }), { day: "2026-10-28" });
  assert.equal(progress.current, 2, "same day does not double-count");
  progress = recordResult(progress, result({ id: "r4" }), { day: "2026-11-02" });
  assert.equal(progress.current, 1);
  assert.equal(progress.best, 2);
});

test("displayed streak expires after a missed day without waiting for another quiz", () => {
  const progress = recordResult(defaultProgress(), result(), { day: "2026-10-27" });
  assert.equal(currentStreak(progress, "2026-10-27"), 1);
  assert.equal(currentStreak(progress, "2026-10-28"), 1);
  assert.match(streakMessage(progress, "2026-10-28"), /today/i);
  assert.equal(currentStreak(progress, "2026-10-29"), 0);
  assert.match(streakMessage(progress, "2026-10-29"), /ended/i);
});

test("progress persists to an injected storage", () => {
  const storage = memoryStorage();
  const progress = recordResult(defaultProgress(), result(), { day: "2026-10-27" });
  writeProgress(progress, storage);
  assert.equal(readProgress(storage).xp, 50);
  assert.equal(resetProgress(storage).xp, 0);
});

test("topicMastery aggregates weak topics first", () => {
  const results = [
    result({ topicBreakdown: [{ topic: "Forces", correct: 1, total: 5, percent: 20 }] }),
    result({ id: "r2", topicBreakdown: [{ topic: "Forces", correct: 0, total: 5, percent: 0 }] }),
    result({ id: "r3", topicBreakdown: [{ topic: "Algebra", correct: 5, total: 5, percent: 100 }] }),
  ];
  const mastery = topicMastery(results);
  assert.equal(mastery[0].topic, "Forces");
  assert.equal(mastery[0].percent, 10);
  assert.equal(mastery[1].topic, "Algebra");
});

test("leaderboard ranks local profiles without a server", () => {
  const results = [
    result({ profile: "Ananya", percent: 80, xp: 50 }),
    result({ id: "r2", profile: "Ananya", percent: 90, xp: 60 }),
    result({ id: "r3", profile: "Kiran", percent: 70, xp: 40 }),
  ];
  const board = leaderboard(results);
  assert.equal(board[0].name, "Ananya");
  assert.equal(board[0].best, 90);
  assert.equal(board[0].quizzes, 2);
  assert.equal(board[0].average, 85);
  assert.equal(board[1].name, "Kiran");
});

test("progress works in memory when the browser blocks localStorage access", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("blocked"); } });
  try {
    assert.equal(readProgress().xp, 0);
    assert.equal(writeProgress({ xp: 12 }).xp, 12);
    assert.equal(resetProgress().xp, 0);
    const flash = await import("../js/flashcards.js");
    assert.deepEqual(flash.readProgress(), {});
    assert.doesNotThrow(() => flash.writeProgress({}));
    const i18n = await import("../js/i18n.js");
    assert.equal(i18n.setLanguage("en", { root: null }), "en");
    assert.equal(i18n.initLanguage({ root: null }), "en");
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor);
    else delete globalThis.localStorage;
  }
});
