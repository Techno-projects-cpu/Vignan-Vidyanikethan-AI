/**
 * Viva: an examiner who asks, probes, and marks out of ten.
 *
 * A written quiz forgives vagueness: half a sentence can still match a keyword.
 * A viva does not, which is why competitive exams and school practicals use one.
 * This module is the examiner's rulebook, and it is deliberately simple and
 * deterministic so the same answer always earns the same mark and a student can
 * see exactly why.
 *
 * Everything here is pure. The questions come from the student's own pages, and
 * every line the examiner says points back at the page it came from.
 */

export const VIVA_MARKS = 10;

const BANDS = [
  { at: 9, name: "Distinction", note: "You can say this in your own words. That is what a viva rewards." },
  { at: 7, name: "Good", note: "Solid answers. The examiner would probe the weak one, so revise it before the next run." },
  { at: 5, name: "Pass", note: "You know the vocabulary but not yet the explanation. Say the same ideas as full sentences." },
  { at: 0, name: "Needs work", note: "Read the cited page out loud once, then take this viva again." },
];

const NOISE = new Set([
  "that", "this", "these", "those", "with", "from", "which", "their", "there", "then",
  "than", "when", "where", "what", "have", "has", "into", "because", "also", "such",
  "each", "other", "some", "more", "most", "very", "just", "only", "same", "used",
  "using", "called", "known", "made", "does", "can", "may", "will", "would", "should",
  "about", "between", "through", "being", "been", "were", "was", "are", "its", "for",
]);

/** The words that carry the meaning of a sentence, for fair keyword marking. */
export function keyTerms(sentence = "", limit = 7) {
  const words = String(sentence || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean);
  const seen = new Set();
  const terms = [];
  for (const word of words) {
    if (word.length <= 4 || NOISE.has(word) || seen.has(word)) continue;
    seen.add(word);
    terms.push(word);
    if (terms.length >= limit) break;
  }
  return terms;
}

/**
 * One viva question, built from a sentence the student's own page contains.
 *
 * A viva does not ask you to pick an option: it hands you a statement and asks
 * you to explain it. Marking therefore checks the meaning-bearing words of that
 * statement, which a student can verify by reading the page.
 */
export function vivaQuestionFrom({ sentence = "", source = {}, topic = "", index = 0 } = {}) {
  const text = String(sentence || "").replace(/\s+/g, " ").trim();
  if (!text) return null;
  const terms = keyTerms(text);
  return {
    id: `viva-${index}-${text.slice(0, 12).replace(/[^a-z0-9]/gi, "") || "q"}`,
    index,
    type: "short",
    prompt: `Explain this in your own words: "${text}"`,
    options: [],
    answer: "",
    reference: text,
    acceptable: terms,
    explanation: `From ${source.title || "your book"}, page ${source.page || 1}.`,
    source: { ...source, quote: text },
    topic: topic || source.section || "General",
    points: 1,
    viva: true,
  };
}

/** Turn retrieved sentences into a viva, one question per page where possible. */
export function vivaQuestionsFromSentences(rows = [], { count = 5 } = {}) {
  const wanted = Math.max(1, Number(count) || 5);
  const built = [];
  const seen = new Set();
  for (const row of rows || []) {
    if (built.length >= wanted) break;
    const key = String(row?.sentence || "").slice(0, 60).toLowerCase();
    if (!key || seen.has(key)) continue;
    const question = vivaQuestionFrom({ ...row, index: built.length });
    if (!question) continue;
    seen.add(key);
    built.push(question);
  }
  return built;
}

/** Questions a viva can ask: anything a student has to explain, not just pick. */
export function vivaQuestions(questions = [], count = 5) {
  const asked = (questions || [])
    .filter((question) => question && (question.type === "short" || question.type === "fill" || question.type === "mcq"))
    .slice(0, Math.max(1, Number(count) || 5));
  return asked.map((question, index) => ({ ...question, vivaIndex: index }));
}

/** What the examiner says before the student answers. */
export function examinerLine(question = {}) {
  const topic = String(question.topic || question.source?.section || "").trim();
  const name = topic && topic !== "General" ? ` on ${topic}` : "";
  return `Examiner${name}: ${String(question.prompt || "").trim()}`;
}

/**
 * The follow-up question, or null when the examiner is satisfied.
 *
 * One probe per question, not a loop: a viva that asks "are you sure" three
 * times teaches nothing except that the examiner is annoying.
 */
export function probeFor({ question = {}, answer = "", awarded = 0, probes = 0 } = {}) {
  if (Number(probes) >= 1) return null;
  const said = String(answer || "").trim();
  if (!said) {
    return { kind: "silent", line: "Examiner: I did not hear an answer. One sentence is enough, even if you are unsure." };
  }
  const words = said.split(/\s+/).filter(Boolean).length;
  if (Number(awarded) >= 1) return null;
  if (Number(awarded) >= 0.5) {
    return { kind: "expand", line: "Examiner: part of that is right. Add one more sentence: what does it do, or why does it happen?" };
  }
  if (words <= 3) {
    return { kind: "expand", line: "Examiner: that is a word, not an answer. Say a full sentence in your own words." };
  }
  const page = question.source?.page ? `page ${question.source.page}` : "the cited page";
  const title = question.source?.title || "your book";
  return { kind: "reread", line: `Examiner: that is not what the page says. Open ${title}, ${page}, read the quoted sentence, and say it in your own words.` };
}

/**
 * Why the answer was wrong, named precisely.
 *
 * "Wrong" teaches nothing. Naming the exact confusion — a word from the same
 * sentence, a missing step, an answer that never arrived — is the part a viva
 * is for.
 */
export function nameMisconception({ question = {}, submitted = "", awarded = 0 } = {}) {
  const said = String(submitted || "").trim();
  const page = question.source?.page ? `page ${question.source.page}` : "the cited page";
  const title = question.source?.title || "your book";
  const quote = String(question.source?.quote || question.reference || "").replace(/\s+/g, " ").trim();
  const correct = String(question.answer || "").trim();
  if (Number(awarded) >= 1) return "";
  if (!said) {
    return `No answer was given. The page says${correct ? ` "${correct}"` : ""}${quote ? `: "${quote.slice(0, 180)}"` : "."} (${title}, ${page})`;
  }
  if (question.type === "mcq" && Array.isArray(question.options) && question.options.includes(said)) {
    return `You chose "${said}", which does appear on this page, but not as the answer to this question. The page says "${correct}". Read the sentence again and check which word the blank is asking for. (${title}, ${page})`;
  }
  if (correct && said.toLowerCase().includes(correct.toLowerCase())) {
    return `Your answer contains "${correct}" but not in a sentence that explains it. Write it as a full statement of what happens and why. (${title}, ${page})`;
  }
  return `Your answer was "${said.slice(0, 120)}". The page says${correct ? ` "${correct}"` : ""}${quote ? `: "${quote.slice(0, 180)}"` : "."} (${title}, ${page})`;
}

function bandFor(percent) {
  const marks = Math.round((Number(percent) || 0) / 10);
  return BANDS.find((band) => marks >= band.at) || BANDS[BANDS.length - 1];
}

/**
 * The report card.
 *
 * `rows` is one entry per question: `{ question, submitted, awarded }`.
 * The honesty line is not decoration: a viva marked by a program is practice,
 * and saying so is the difference between a study tool and a false promise.
 */
export function vivaReport(rows = []) {
  const list = (rows || []).filter(Boolean);
  const total = list.length;
  const earned = list.reduce((sum, row) => sum + Math.min(1, Math.max(0, Number(row.awarded) || 0)), 0);
  const percent = total ? Math.round((earned / total) * 100) : 0;
  const marks = total ? Math.round((earned / total) * VIVA_MARKS) : 0;
  const band = bandFor(percent);
  const strengths = [];
  const weaknesses = [];
  const misconceptions = [];
  for (const row of list) {
    const topic = String(row.question?.topic || row.question?.source?.section || "General").trim();
    const awarded = Number(row.awarded) || 0;
    if (awarded >= 1) {
      if (!strengths.includes(topic)) strengths.push(topic);
    } else {
      if (!weaknesses.includes(topic)) weaknesses.push(topic);
      const line = nameMisconception({ question: row.question, submitted: row.submitted, awarded });
      if (line) misconceptions.push({ topic, line });
    }
  }
  const weakest = misconceptions[0];
  const nextStep = !total
    ? "Answer at least one question and the examiner can mark it."
    : marks >= 8
      ? "Take a full mock in this subject, then come back to the viva for the chapter you scored lowest."
      : weakest
        ? `Read ${weakest.topic} out loud once, then take this viva again.`
        : "Revise the chapters the examiner questioned, then take this viva again.";
  return {
    total,
    earned: Math.round(earned * 100) / 100,
    marks,
    outOf: VIVA_MARKS,
    percent,
    band: band.name,
    bandNote: band.note,
    strengths,
    weaknesses,
    misconception: weakest ? weakest.line : "",
    misconceptionTopic: weakest ? weakest.topic : "",
    nextStep,
    honesty: "Practice marking from your own pages, by rules a student can read. It is not an exam result, and a teacher may ask for more.",
  };
}
