/**
 * Offline quiz writer and honest grader.
 *
 * Questions are generated from retrieved textbook sentences. Every question
 * stores the source page and the exact sentence it came from, so the evaluation
 * can show the student what to revise instead of just a score.
 */

import { questionCopy } from "./question-copy.js?v=26";
import { hashFeature } from "./vector.js?v=26";
import { splitSentences, tokenize } from "./text.js?v=26";
import {
  clamp,
  levenshtein,
  localDay,
  normalizeAnswer,
  truncate,
  uid,
  unique,
  wordOverlap,
} from "./util.js?v=26";

const FILLER = new Set(
  `about above after again against because before being below between could during each every first following from have into itself more most other second should some such than that their these those through where which while would your textbook chapter page section notes`.split(
    /\s+/,
  ),
);

const TYPE_CYCLE = {
  mcq: ["mcq"],
  fill: ["fill"],
  short: ["short"],
  mix: ["mcq", "mcq", "fill", "short"],
};

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function seededShuffle(items, seedText) {
  const seed = hashFeature(seedText) || 1;
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const output = [...items];
  for (let i = output.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [output[i], output[j]] = [output[j], output[i]];
  }
  return output;
}

function wordsWithCase(sentence) {
  return sentence.match(/[\p{L}\p{M}][\p{L}\p{M}-]{2,}/gu) || [];
}

/** Pick a meaningful term or short phrase from a sentence to blank out. */
export function pickBlankPhrase(sentence, difficulty = "medium") {
  const words = wordsWithCase(sentence).filter((word) => {
    const lower = word.toLowerCase();
    return !FILLER.has(lower) && lower.length >= 4 && tokenize(lower).length > 0;
  });
  if (!words.length) return "";
  const sorted = unique(words).sort((a, b) => b.length - a.length);
  let candidate = sorted[0] || "";
  if (difficulty === "hard") {
    const phraseMatch = sentence.match(/\b([A-Za-z][A-Za-z-]{3,}\s+[A-Za-z][A-Za-z-]{3,})\b/);
    if (phraseMatch && phraseMatch[1].split(/\s+/).every((word) => !FILLER.has(word.toLowerCase()))) {
      candidate = phraseMatch[1];
    }
  }
  if (difficulty === "easy" && sorted.length > 1) candidate = sorted[Math.min(1, sorted.length - 1)];
  return candidate.replace(/[.,;:]$/, "");
}

function candidateSentences(hits, topic) {
  const topicWords = new Set(tokenize(topic || ""));
  const candidates = [];
  hits.forEach((hit, hitIndex) => {
    splitSentences(hit.text).forEach((rawSentence, sentenceIndex) => {
      const sentence = rawSentence.replace(/\s+/g, " ").trim();
      const indic = /[\u0900-\u097f\u0c00-\u0c7f]/u.test(sentence);
      if (sentence.length < (indic ? 35 : 55) || sentence.length > 260) return;
      const words = sentence.split(/\s+/).filter(Boolean);
      if (words.length < (indic ? 5 : 9)) return;
      const tokens = tokenize(sentence);
      if (tokens.length < (indic ? 3 : 4)) return;
      const overlap = tokens.filter((word) => topicWords.has(word)).length;
      const definition = /\b(is|are|means|refers|called|defined|because|therefore|consists|formed|contains|equals)\b/i.test(
        sentence,
      );
      const number = /\d/.test(sentence) ? 0.4 : 0;
      const score = overlap * 1.2 + (definition ? 1 : 0) + number - hitIndex * 0.05 - sentenceIndex * 0.02;
      candidates.push({ sentence, hit, score, tokens });
    });
  });
  return candidates.sort((a, b) => b.score - a.score);
}

function allDistractorTerms(candidates) {
  const terms = [];
  for (const candidate of candidates) {
    for (const word of unique(wordsWithCase(candidate.sentence))) {
      const lower = word.toLowerCase();
      if (word.length >= 4 && !FILLER.has(lower)) terms.push(word.replace(/[.,;:]$/, ""));
    }
  }
  return unique(terms);
}

function makeSource(hit, sentence) {
  return {
    bookId: hit.bookId,
    chunkId: hit.chunkId,
    title: hit.title,
    sourceUrl: hit.sourceUrl || "",
    sourceKind: hit.sourceKind || "",
    page: hit.page,
    section: hit.section,
    quote: truncate(sentence || hit.text, 280),
  };
}

function blankOut(sentence, phrase) {
  const regex = new RegExp(`\\b${escapeRegExp(phrase)}\\b`, "i");
  const blanked = sentence.replace(regex, "______");
  return blanked === sentence ? sentence.replace(new RegExp(escapeRegExp(phrase), "i"), "______") : blanked;
}

function buildQuestion({ candidate, type, difficulty, distractorPool, index, phrase: providedPhrase, language = "en" }) {
  const { sentence, hit } = candidate;
  const phrase = providedPhrase || pickBlankPhrase(sentence, difficulty);
  if (!phrase) return null;
  const source = makeSource(hit, sentence);
  const explanation = `From ${source.title}, page ${source.page}: “${truncate(sentence, 210)}”`;
  const base = {
    id: uid("q"),
    index,
    topic: hit.section || hit.title,
    source,
    explanation,
    reference: sentence,
    points: 1,
  };

  const copy = questionCopy(language);
  if (type === "short") {
    const keyword = phrase.split(/\s+/)[0];
    return {
      ...base,
      type: "short",
      prompt: language === "te" ? `“${keyword}” గురించి మీ పుస్తకం ఏమి చెబుతుందో మీ మాటల్లో వివరించండి.`
        : language === "hi" ? `“${keyword}” के बारे में अपनी किताब की बात अपने शब्दों में समझाएँ।`
          : `${copy.whatIs.replace("{subject}", keyword)} — ${copy.complete}`,
      options: [],
      answer: "",
      acceptable: tokenize(sentence).slice(0, 8),
    };
  }

  const blanked = blankOut(sentence, phrase);
  const correct = phrase;
  if (type === "fill") {
    return {
      ...base,
      type: "fill",
      prompt: `${copy.fill}: “${truncate(blanked, 220)}”`,
      options: [],
      answer: correct,
      acceptable: [correct, tokenize(correct)[0] || correct],
    };
  }

  const distractors = seededShuffle(
    distractorPool.filter(
      (term) =>
        normalizeAnswer(term) !== normalizeAnswer(correct) &&
        !normalizeAnswer(term).includes(normalizeAnswer(correct)) &&
        !normalizeAnswer(correct).includes(normalizeAnswer(term)) &&
        term.length >= 3,
    ),
    `${sentence}-${index}`,
  )
    .filter((term, position, list) => list.findIndex((other) => normalizeAnswer(other) === normalizeAnswer(term)) === position)
    .slice(0, 3);
  const fallback = language === "te" ? ["శక్తి", "పదార్థం", "చలనం", "పోషకం", "వ్యవస్థ", "ప్రక్రియ"]
    : language === "hi" ? ["ऊर्जा", "पदार्थ", "गति", "पोषक", "प्रक्रिया", "तंत्र"] : ["energy", "matter", "motion", "nutrient", "process", "system"];
  for (const option of fallback) {
    if (distractors.length >= 3) break;
    if (normalizeAnswer(option) !== normalizeAnswer(correct) && !distractors.some((value) => normalizeAnswer(value) === normalizeAnswer(option))) distractors.push(option);
  }
  const options = seededShuffle([correct, ...distractors], `${sentence}-options-${index}`);
  return {
    ...base,
    type: "mcq",
    prompt: `${copy.choose}: “${truncate(blanked, 220)}”`,
    options,
    answer: correct,
    acceptable: [correct],
  };
}

export function prepareQuestions(questions = []) {
  return questions.map((question, index) => ({
    id: question.id || uid("q"),
    index,
    // Exam practice tags survive preparation: marking needs to know which
    // subject a question belongs to, not just which chapter it came from.
    ...(question.examId ? { examId: String(question.examId) } : {}),
    ...(question.subjectId ? { subjectId: String(question.subjectId) } : {}),
    ...(question.chapter ? { chapter: String(question.chapter) } : {}),
    type: ["mcq", "fill", "short"].includes(question.type) ? question.type : "mcq",
    prompt: String(question.prompt || "").trim(),
    options: Array.isArray(question.options) ? question.options.map(String) : [],
    answer: String(question.answer || ""),
    reference: String(question.reference || question.explanation || ""),
    acceptable: Array.isArray(question.acceptable) ? question.acceptable.map(String) : [],
    explanation: String(question.explanation || "Check the cited textbook page."),
    source: question.source || { title: "Unknown", page: 1, quote: "" },
    topic: question.topic || question.source?.section || "General",
    points: Number(question.points) || 1,
  }));
}

export function makeQuiz({
  questions,
  topic = "",
  bookIds = [],
  type = "mcq",
  difficulty = "medium",
  timed = false,
  secondsPerQuestion = 45,
  generatedBy = "offline",
  hits = [],
} = {}) {
  return {
    id: uid("quiz"),
    createdAt: new Date().toISOString(),
    title: topic ? `Quiz: ${truncate(topic, 60)}` : "Chapter quiz",
    topic,
    bookIds: bookIds.length ? bookIds : unique(hits.map((hit) => hit.bookId)),
    type,
    difficulty,
    timed,
    secondsPerQuestion,
    generatedBy,
    questions: prepareQuestions(questions),
  };
}

export function generateQuiz({
  hits = [],
  topic = "",
  count = 5,
  type = "mcq",
  difficulty = "medium",
  timed = false,
  secondsPerQuestion = 45,
  bookIds = [],
  language = "en",
} = {}) {
  const candidates = candidateSentences(hits, topic);
  if (!candidates.length) return makeQuiz({ questions: [], topic, type, difficulty, timed, secondsPerQuestion, bookIds });
  const distractorPool = allDistractorTerms(candidates);
  const cycle = TYPE_CYCLE[type] || TYPE_CYCLE.mix;
  const questions = [];
  const used = new Set();
  const usedAnswers = new Set();

  for (let index = 0; index < count && candidates.length; index += 1) {
    const requestedType = cycle[index % cycle.length];
    let candidateIndex = -1;
    let selectedPhrase = "";
    // Prefer a fresh sentence AND a fresh answer so a quiz does not repeat the
    // same blank five times.
    for (let position = 0; position < candidates.length; position += 1) {
      const candidate = candidates[position];
      const key = normalizeAnswer(candidate.sentence).slice(0, 90);
      const phrase = pickBlankPhrase(candidate.sentence, difficulty);
      if (!used.has(key) && phrase && !usedAnswers.has(normalizeAnswer(phrase))) {
        candidateIndex = position;
        selectedPhrase = phrase;
        break;
      }
    }
    if (candidateIndex < 0) {
      candidateIndex = candidates.findIndex((candidate) => {
        const key = normalizeAnswer(candidate.sentence).slice(0, 90);
        return !used.has(key) && pickBlankPhrase(candidate.sentence, difficulty);
      });
      if (candidateIndex >= 0) selectedPhrase = pickBlankPhrase(candidates[candidateIndex].sentence, difficulty);
    }
    if (candidateIndex < 0) break;
    const candidate = candidates.splice(candidateIndex, 1)[0];
    used.add(normalizeAnswer(candidate.sentence).slice(0, 90));
    usedAnswers.add(normalizeAnswer(selectedPhrase));
    const question = buildQuestion({
      candidate,
      type: requestedType,
      difficulty,
      distractorPool,
      index,
      phrase: selectedPhrase,
      language,
    });
    if (question) questions.push(question);
  }

  return makeQuiz({
    questions,
    topic,
    type,
    difficulty,
    timed,
    secondsPerQuestion,
    generatedBy: "offline",
    hits,
    bookIds,
  });
}

function gradeMcq(question, submitted) {
  const expected = normalizeAnswer(question.answer);
  const given = normalizeAnswer(submitted);
  if (!given) return 0;
  const matchedOption = question.options.find((option) => normalizeAnswer(option) === given);
  if (matchedOption && normalizeAnswer(matchedOption) === expected) return 1;
  return given === expected ? 1 : 0;
}

function gradeFill(question, submitted) {
  const given = normalizeAnswer(submitted);
  const expected = normalizeAnswer(question.answer);
  if (!given || !expected) return 0;
  if (given === expected) return 1;
  const distance = levenshtein(given, expected) / Math.max(expected.length, 1);
  if (distance <= 0.16) return 1;
  const acceptable = (question.acceptable || []).some((value) => normalizeAnswer(value) === given);
  if (acceptable) return 1;
  return wordOverlap(given, expected) >= 0.72 ? 0.5 : 0;
}

function gradeShort(question, submitted) {
  const given = normalizeAnswer(submitted);
  if (given.split(/\s+/).filter(Boolean).length < 3) return 0;
  const reference = question.reference || question.source?.quote || "";
  const overlap = wordOverlap(given, reference);
  const keywords = (question.acceptable || []).filter((word) => given.includes(normalizeAnswer(word)));
  const keywordRatio = question.acceptable?.length ? keywords.length / question.acceptable.length : 0;
  const score = Math.max(overlap, keywordRatio * 0.9);
  if (score >= 0.52) return 1;
  if (score >= 0.27) return 0.5;
  return 0;
}

/** Recalculate totals after an external AI grader adjusts short-answer awards. */
export function recomputeResult(result) {
  const perQuestion = result.perQuestion || [];
  const score = perQuestion.reduce((total, item) => total + clamp(Number(item.awarded) || 0, 0, 1), 0);
  const total = perQuestion.length;
  const percent = total ? Math.round((score / total) * 100) : 0;
  const breakdown = new Map();
  for (const item of perQuestion) {
    const topic = item.question?.topic || "General";
    const entry = breakdown.get(topic) || { topic, correct: 0, total: 0 };
    entry.correct += Number(item.awarded) || 0;
    entry.total += 1;
    breakdown.set(topic, entry);
  }
  const topicBreakdown = [...breakdown.values()]
    .map((entry) => ({ ...entry, percent: entry.total ? Math.round((entry.correct / entry.total) * 100) : 0 }))
    .sort((a, b) => a.percent - b.percent);
  const perQuestionWithStatus = perQuestion.map((item) => ({
    ...item,
    status: item.awarded >= 1 ? "correct" : item.awarded >= 0.5 ? "partial" : "wrong",
  }));
  const reviseList = perQuestionWithStatus
    .filter((item) => item.status !== "correct")
    .map((item) => ({
      prompt: item.question.prompt,
      topic: item.question.topic,
      title: item.question.source?.title || "Textbook",
      page: item.question.source?.page || 1,
      quote: item.question.source?.quote || "",
      answer: item.correctText,
    }));
  return {
    ...result,
    score,
    total,
    percent,
    perQuestion: perQuestionWithStatus,
    topicBreakdown,
    reviseList,
    correctCount: perQuestionWithStatus.filter((item) => item.status === "correct").length,
    partialCount: perQuestionWithStatus.filter((item) => item.status === "partial").length,
    wrongCount: perQuestionWithStatus.filter((item) => item.status === "wrong").length,
    xp: Math.round(percent * 0.8 + total * 4),
  };
}

export function gradeQuiz(quiz, responses = {}) {
  const questions = quiz?.questions || [];
  const perQuestion = questions.map((question) => {
    const submitted = String(responses[question.id] ?? "");
    let awarded = 0;
    if (question.type === "mcq") awarded = gradeMcq(question, submitted);
    else if (question.type === "fill") awarded = gradeFill(question, submitted);
    else awarded = gradeShort(question, submitted);
    awarded = clamp(awarded, 0, 1);
    const status = awarded >= 1 ? "correct" : awarded >= 0.5 ? "partial" : "wrong";
    const correctText = question.answer || question.reference || "See the cited passage.";
    const feedback =
      status === "correct"
        ? "Correct."
        : status === "partial"
          ? "Partly right — compare your wording with the textbook sentence."
          : "Not yet — revise this page.";
    return {
      question,
      submitted,
      awarded,
      status,
      correctText: truncate(correctText, 180),
      feedback,
    };
  });

  const score = perQuestion.reduce((total, item) => total + item.awarded, 0);
  const total = questions.length;
  const percent = total ? Math.round((score / total) * 100) : 0;
  const breakdown = new Map();
  for (const item of perQuestion) {
    const topic = item.question.topic || "General";
    const entry = breakdown.get(topic) || { topic, correct: 0, total: 0 };
    entry.correct += item.awarded;
    entry.total += 1;
    breakdown.set(topic, entry);
  }
  const topicBreakdown = [...breakdown.values()]
    .map((entry) => ({ ...entry, percent: entry.total ? Math.round((entry.correct / entry.total) * 100) : 0 }))
    .sort((a, b) => a.percent - b.percent);
  const reviseList = perQuestion
    .filter((item) => item.status !== "correct")
    .map((item) => ({
      prompt: item.question.prompt,
      topic: item.question.topic,
      title: item.question.source?.title || "Textbook",
      page: item.question.source?.page || 1,
      quote: item.question.source?.quote || "",
      answer: item.correctText,
    }));

  return {
    id: uid("result"),
    quizId: quiz?.id || "",
    date: new Date().toISOString(),
    day: localDay(),
    topic: quiz?.topic || "Chapter quiz",
    score,
    total,
    percent,
    perQuestion,
    topicBreakdown,
    reviseList,
    correctCount: perQuestion.filter((item) => item.status === "correct").length,
    partialCount: perQuestion.filter((item) => item.status === "partial").length,
    wrongCount: perQuestion.filter((item) => item.status === "wrong").length,
    xp: Math.round(percent * 0.8 + total * 4),
  };
}
