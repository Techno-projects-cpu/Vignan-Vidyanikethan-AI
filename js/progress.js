/**
 * Study streak, XP, topic mastery and an opt-in, on-device leaderboard.
 * No accounts and no server: profiles are just names typed on this device.
 */

import { localDay, truncate } from "./util.js";

const PROGRESS_KEY = "vignan-study-ai.progress.v1";

export function defaultProgress() {
  return {
    current: 0,
    best: 0,
    lastDay: null,
    xp: 0,
    totalQuizzes: 0,
    totalCorrect: 0,
    totalQuestions: 0,
    history: [],
    updatedAt: null,
  };
}

export function readProgress(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem(PROGRESS_KEY) || "null");
    return parsed ? { ...defaultProgress(), ...parsed, history: parsed.history || [] } : defaultProgress();
  } catch {
    return defaultProgress();
  }
}

export function writeProgress(state, storage = globalThis.localStorage) {
  try {
    storage?.setItem(PROGRESS_KEY, JSON.stringify(state));
  } catch {
    // Storage may be disabled; keep the in-memory state for this session.
  }
  return state;
}

export function dayDifference(a, b) {
  const first = new Date(`${a}T12:00:00`);
  const second = new Date(`${b}T12:00:00`);
  return Math.round((first - second) / 86400000);
}

/** Record one finished quiz. Returns a new state object (no mutation). */
export function recordResult(state = defaultProgress(), result = {}, { day = localDay(), profile = "Student" } = {}) {
  const previous = { ...defaultProgress(), ...state };
  const difference = previous.lastDay ? dayDifference(day, previous.lastDay) : Infinity;
  let current = previous.current;
  if (!previous.lastDay || difference <= 0) current = Math.max(1, previous.current || 0);
  else if (difference === 1) current = (previous.current || 0) + 1;
  else current = 1;

  const entry = {
    id: result.id,
    day,
    date: result.date || new Date().toISOString(),
    topic: truncate(result.topic || "Chapter quiz", 60),
    percent: Number(result.percent) || 0,
    score: Number(result.score) || 0,
    total: Number(result.total) || 0,
    xp: Number(result.xp) || 0,
    profile: String(profile || "Student").slice(0, 32),
  };

  return {
    ...previous,
    current,
    best: Math.max(previous.best || 0, current),
    lastDay: previous.lastDay && difference <= 0 ? previous.lastDay : day,
    xp: (previous.xp || 0) + entry.xp,
    totalQuizzes: (previous.totalQuizzes || 0) + 1,
    totalCorrect: (previous.totalCorrect || 0) + entry.score,
    totalQuestions: (previous.totalQuestions || 0) + entry.total,
    history: [entry, ...(previous.history || [])].slice(0, 60),
    updatedAt: new Date().toISOString(),
  };
}

export function accuracy(state = defaultProgress()) {
  return state.totalQuestions ? Math.round((state.totalCorrect / state.totalQuestions) * 100) : 0;
}

export function streakMessage(state = defaultProgress()) {
  if (!state.current) return "Finish a quiz to start your streak.";
  if (state.current === 1) return "Day 1 — come back tomorrow to keep it going.";
  if (state.current >= 7) return `${state.current}-day streak. That is exam-week energy!`;
  return `${state.current}-day streak. Keep it alive tomorrow.`;
}

/** Aggregate per-topic percentages from saved quiz results. */
export function topicMastery(results = []) {
  const map = new Map();
  for (const result of results) {
    for (const topic of result.topicBreakdown || []) {
      const entry = map.get(topic.topic) || { topic: topic.topic, correct: 0, total: 0 };
      entry.correct += topic.correct || 0;
      entry.total += topic.total || 0;
      map.set(topic.topic, entry);
    }
  }
  return [...map.values()]
    .map((entry) => ({ ...entry, percent: entry.total ? Math.round((entry.correct / entry.total) * 100) : 0 }))
    .sort((a, b) => a.percent - b.percent || b.total - a.total)
    .slice(0, 8);
}

/** A local leaderboard built only from results saved on this device. */
export function leaderboard(results = [], { limit = 8 } = {}) {
  const map = new Map();
  for (const result of results) {
    const name = String(result.profile || "Student").slice(0, 32);
    const entry = map.get(name) || { name, quizzes: 0, xp: 0, best: 0, totalPercent: 0 };
    entry.quizzes += 1;
    entry.xp += Number(result.xp) || 0;
    entry.best = Math.max(entry.best, Number(result.percent) || 0);
    entry.totalPercent += Number(result.percent) || 0;
    map.set(name, entry);
  }
  return [...map.values()]
    .map((entry) => ({ ...entry, average: Math.round(entry.totalPercent / Math.max(1, entry.quizzes)) }))
    .sort((a, b) => b.best - a.best || b.xp - a.xp)
    .slice(0, limit);
}

export function resetProgress(storage = globalThis.localStorage) {
  const fresh = defaultProgress();
  writeProgress(fresh, storage);
  return fresh;
}
