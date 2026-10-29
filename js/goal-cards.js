/**
 * The sentences a student can start from, instead of an empty box.
 *
 * Why this file exists: an empty composer is a dead end. The free tutors we read
 * before building this (credited in OPEN_SOURCE_CREDITS.md) open with a question —
 * "where are you stuck?" — and a short list of sentences, each of which already
 * knows what it wants. No code, text or prompt was copied; the idea is theirs and
 * the words and rules below are ours.
 *
 * Two rules keep these cards honest:
 *   1. Every card either asks something answerable from a cited page, or opens a
 *      study tool that already exists in this app. Nothing here promises a feature
 *      that is not built.
 *   2. A card is just a sentence. The student can edit it, send it, or ignore it.
 */

/** Query-string key that lets a card be shared as a link, e.g. `?ask=…`. */
export const ASK_PARAM = "ask";

/** Longest question accepted from a link, so a hostile URL cannot stuff the box. */
export const MAX_LINKED_QUESTION = 300;

/**
 * Five starting sentences, in the order a student is most likely to need them.
 * `action` cards open an existing view; `prompt` cards fill the composer.
 */
export const GOAL_CARDS = [
  {
    id: "stuck",
    icon: "i-book",
    title: "I'm stuck on a question",
    note: "Explained step by step, with the page it came from",
    prompt: "I'm stuck on a question. Explain it step by step and tell me which page of my book it comes from.",
    needsBook: true,
  },
  {
    id: "quiz",
    icon: "i-quiz",
    title: "Quiz me on a chapter",
    note: "Questions from one chapter, marked the moment you answer",
    action: "quiz",
    needsBook: true,
  },
  {
    id: "viva",
    icon: "i-mic",
    title: "My viva is coming up",
    note: "Answer out loud, marked out of ten, from your own pages",
    action: "viva",
    needsBook: true,
  },
  {
    id: "mark",
    icon: "i-spark",
    title: "Mark my answer",
    note: "See what the page expects and what you missed",
    prompt: "Mark my answer out of 10 against my book. Tell me what the page expects and what I missed.",
    needsBook: true,
  },
  {
    id: "revise",
    icon: "i-target",
    title: "Revise in ten minutes",
    note: "A short plan: hardest topic first",
    prompt: "Make me a revision plan for the next ten minutes from my books. Start with the topic I am weakest at.",
    needsBook: true,
  },
];

/**
 * The cards to show, adjusted for an empty library.
 *
 * With no books at all, the cards still appear — an empty screen is the failure we
 * are fixing — but the note says where the pages will come from, so nobody taps a
 * card expecting their own book and finds nothing.
 */
export function goalCards({ hasBooks = true, starterReady = false } = {}) {
  return GOAL_CARDS.map((card) => {
    if (hasBooks || !card.needsBook) return { ...card };
    const note = starterReady
      ? "Your shelf is empty — the starter pages are one tap away in Library"
      : "Add your book in Library first; the answer needs a page to point at";
    return { ...card, note, empty: true };
  });
}

/** How many cards carry a ready-made sentence (the rest open a view). */
export function promptCards(cards = GOAL_CARDS) {
  return cards.filter((card) => typeof card.prompt === "string" && card.prompt.trim());
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
