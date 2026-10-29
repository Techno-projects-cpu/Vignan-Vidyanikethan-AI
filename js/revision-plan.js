/**
 * "Revise today": one small, honest plan built from what the student already has.
 *
 * No new data and no guessing. Three inputs, in this order of urgency:
 *   1. flashcards that are due (spaced repetition already knows the schedule),
 *   2. topics the last quizzes were weakest on,
 *   3. a first step when there is no history at all.
 *
 * The plan is deliberately short — at most three steps — because a long list is
 * the reason revision plans get ignored. It also names the reason for each step,
 * so a student can see why it is being suggested.
 */

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Minutes, rounded to something a student can plan around. */
function estimate(minutes) {
  return clamp(Math.round(minutes / 5) * 5, 5, 45);
}

/**
 * @param {object} input
 * @param {Array<{topic:string, percent:number, total:number}>} input.mastery weakest-first
 * @param {number} input.dueCards
 * @param {number} input.totalCards
 * @param {Array<object>} input.history recent quiz results, newest first
 * @param {number} input.streak
 * @param {string} input.today ISO day
 */
export function buildRevisionPlan({
  mastery = [],
  dueCards = 0,
  totalCards = 0,
  history = [],
  streak = 0,
  today = new Date().toISOString().slice(0, 10),
} = {}) {
  const steps = [];
  const questionsToday = history.filter((result) => String(result.day || result.createdAt || "").slice(0, 10) === today).length;

  if (dueCards > 0) {
    steps.push({
      id: "cards",
      kind: "flashcards",
      title: `Review ${dueCards} flashcard${dueCards === 1 ? "" : "s"}`,
      detail: dueCards >= totalCards && totalCards ? "The whole deck is due — start with the oldest cards." : "Spaced repetition says these are ready to come back to.",
      minutes: estimate(Math.max(4, dueCards * 1.2)),
      action: "review-cards",
    });
  }

  const weakest = mastery.filter((row) => row.total >= 1).sort((a, b) => a.percent - b.percent)[0];
  if (weakest && weakest.percent < 80) {
    steps.push({
      id: "weak",
      kind: "quiz",
      title: `Practise “${weakest.topic}”`,
      detail: `You scored ${weakest.percent}% on ${weakest.total} question${weakest.total === 1 ? "" : "s"} here. A short quiz on the same chapter will show if it stuck.`,
      minutes: 10,
      topic: weakest.topic,
      action: "quiz-topic",
    });
  }

  const nextTopic = mastery.find((row) => row.percent >= 80 && row.total >= 2);
  if (nextTopic && steps.length < 3 && questionsToday === 0) {
    steps.push({
      id: "keep",
      kind: "quiz",
      title: `Keep “${nextTopic.topic}” warm`,
      detail: `You are at ${nextTopic.percent}% — five quick questions stop it slipping before the exam.`,
      minutes: 5,
      topic: nextTopic.topic,
      action: "quiz-topic",
    });
  }

  if (!steps.length) {
    steps.push(history.length
      ? {
          id: "fresh",
          kind: "quiz",
          title: "Try a mixed quiz",
          detail: "Nothing is due and no topic is weak. A short mixed quiz finds the next gap.",
          minutes: 10,
          action: "quiz-mixed",
        }
      : {
          id: "start",
          kind: "quiz",
          title: "Start with one chapter",
          detail: "Add a chapter in Library, then ask a question or take a five-question quiz to build your revision list.",
          minutes: 15,
          action: "open-library",
        });
  }

  const minutes = steps.reduce((total, step) => total + step.minutes, 0);
  const headline = questionsToday > 0
    ? `You have already finished ${questionsToday} quiz${questionsToday === 1 ? "" : "zes"} today.`
    : dueCards > 0
      ? `${dueCards} card${dueCards === 1 ? "" : "s"} are due today.`
      : mastery.length
        ? "A short session today keeps the streak and the memory."
        : "One chapter is enough to begin.";

  return {
    today,
    steps: steps.slice(0, 3),
    minutes,
    headline,
    streak,
    doneToday: questionsToday > 0,
  };
}

/** Plain text for copying into a planner or a class notebook. */
export function revisionPlanText(plan = {}) {
  const lines = [`Today's revision${plan.today ? ` (${plan.today})` : ""}`, plan.headline || ""];
  for (const step of plan.steps || []) {
    lines.push(`- [${step.minutes} min] ${step.title} — ${step.detail}`);
  }
  if (plan.minutes) lines.push("", `About ${plan.minutes} minutes in total.`);
  return lines.filter(Boolean).join("\n");
}
