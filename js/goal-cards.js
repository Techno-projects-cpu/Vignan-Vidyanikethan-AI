/**
 * The sentences a student can start from, instead of an empty box.
 *
 * Why this file exists: an empty composer is a dead end. The free tutors we read
 * before building this (credited in OPEN_SOURCE_CREDITS.md) open with a question —
 * "where are you stuck?" — and a short list of sentences. No code, text or prompt
 * was copied; the idea is theirs and the rules below are ours.
 *
 * Three rules keep these blocks honest:
 *   1. Every block either asks something answerable from a cited page, or opens a
 *      study tool that already exists in this app. Nothing promises a feature that
 *      is not built.
 *   2. A written question must stand on its own: it is sent the moment it is
 *      tapped, so it cannot leave a blank for the student to fill in afterwards.
 *   3. The third sentence of every question asks for a page. A block that cannot
 *      be answered from a book does not belong here.
 */

/** Query-string key that lets a block be shared as a link, e.g. `?ask=…`. */
export const ASK_PARAM = "ask";

/** Longest question accepted from a link, so a hostile URL cannot stuff the box. */
export const MAX_LINKED_QUESTION = 300;

/**
 * Five starting blocks, in the order a student is most likely to need them.
 * `action` opens an existing view; `prompt` is sent as a complete question.
 */
export const GOAL_CARDS = [
  {
    id: "explain",
    icon: "i-book",
    title: "Explain a concept, step by step",
    note: "Simplest words first, then one worked example and the marks students lose",
    prompt:
      "Explain photosynthesis step by step in the simplest words you can. Give the page of my book for each step, show one worked example, and list the three mistakes students lose marks on.",
    mode: "explain",
  },
  {
    id: "quiz",
    icon: "i-quiz",
    title: "Quiz me on a chapter",
    note: "Questions from one chapter, marked the moment you answer",
    action: "quiz",
  },
  {
    id: "viva",
    icon: "i-mic",
    title: "My viva is coming up",
    note: "Answer out loud, marked out of ten, from your own pages",
    action: "viva",
  },
  {
    id: "revise",
    icon: "i-target",
    title: "Revise in ten minutes",
    note: "The three weakest ideas, one question each, and the page to re-read",
    prompt:
      "Build me a ten-minute revision plan from my books: the three ideas I am weakest at, one question for each idea, and the page I should re-read for each one.",
    mode: "answer",
  },
  {
    id: "exam-answer",
    icon: "i-spark",
    title: "Write a five-mark exam answer",
    note: "The points an examiner looks for, with the page for each one",
    prompt:
      "Write a five-mark exam answer to a question a teacher would ask from my book. Give the page for every point, and list the keywords an examiner looks for.",
    mode: "answer",
  },
];

/**
 * The blocks to show, adjusted for an empty library.
 *
 * With no books at all the blocks still appear — an empty screen is the failure we
 * are fixing — but the note says where the pages will come from, so nobody taps one
 * expecting their own book and finds nothing.
 */
export function goalCards({ hasBooks = true, starterReady = false } = {}) {
  return GOAL_CARDS.map((card) => {
    if (hasBooks) return { ...card };
    const note = starterReady
      ? "No books yet — the starter pages are one tap away in Library"
      : "Add your book in Library first; the answer needs a page to point at";
    return { ...card, note, empty: true };
  });
}

/** How many blocks carry a ready-made question (the rest open a view). */
export function promptCards(cards = GOAL_CARDS) {
  return cards.filter((card) => typeof card.prompt === "string" && card.prompt.trim());
}

/** The `01 / 05` label on each block, so the list reads like a set. */
export function cardIndex(index, total = GOAL_CARDS.length) {
  return `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
}

/**
 * Read a shared question out of a page URL.
 *
 * Returns "" for anything unusable. The question is trimmed, collapsed to single
 * spaces and cut at MAX_LINKED_QUESTION characters, so a long or malformed link
 * cannot fill the composer with junk. Control characters are stripped because a
 * link is untrusted input.
 */
export function askFromUrl(search) {
  let value = "";
  try {
    value = new URLSearchParams(String(search || "")).get(ASK_PARAM) || "";
  } catch {
    return "";
  }
  return String(value)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_LINKED_QUESTION);
}

/** A shareable link that opens this app with the question already typed in. */
export function askLink(card, base = "") {
  const prompt = typeof card?.prompt === "string" ? card.prompt.trim() : "";
  if (!prompt) return "";
  const prefix = String(base || "").replace(/[?#].*$/, "");
  return `${prefix}?${ASK_PARAM}=${encodeURIComponent(prompt)}`;
}
