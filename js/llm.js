/**
 * Vignan Vidyanikethan AI's orchestration layer.
 *
 * There is no model training here. Retrieved textbook passages are sent to
 * existing AI providers through the task router; the deterministic offline
 * composer is used when a task is routed to "offline" or every provider fails.
 */

import {
  FLASHCARD_SCHEMA,
  MODE_INSTRUCTION,
  OUTSIDE_SYSTEM_PROMPT,
  QUIZ_SCHEMA,
  SYSTEM_PROMPT,
  extractJson,
  formatContext,
  formatOutsideContext,
} from "./context.js?v=17";
import { languageName } from "./i18n.js?v=17";
import {
  callProvider,
  callRoutedModel,
  gradeShortWithModel,
  testProvider,
  verifyAnswer,
} from "./model-router.js?v=17";
import { truncate, uid } from "./util.js?v=17";

export {
  FLASHCARD_SCHEMA,
  MODE_INSTRUCTION,
  QUIZ_SCHEMA,
  SYSTEM_PROMPT,
  extractJson,
  formatContext,
  callProvider,
  callRoutedModel,
  gradeShortWithModel,
  verifyAnswer,
};

/**
 * Every catalogue language gets a prompt line, so a connected model answers in
 * the language the student chose instead of defaulting to English.
 */
function languageInstruction(language = "en") {
  const name = languageName(language);
  if (!name || name === "English") return "Respond in English.";
  return `Respond in ${name} (${languageName(language, { native: true })}). Write the whole answer, including headings, in ${name}. Keep source names, URLs and citation numbers as written; faithfully translate only what the passages support.`;
}



export function buildMessages({ query, hits, mode = "answer", history = [], language = "en" }) {
  const context = formatContext(hits);
  const recent = history.slice(-6).map(({ role, content }) => ({ role, content: truncate(content, 700) }));
  return [
    { role: "system", content: SYSTEM_PROMPT },
    ...recent,
    {
      role: "user",
      content: `${MODE_INSTRUCTION[mode] || MODE_INSTRUCTION.answer}\n${languageInstruction(language)}\n\nLIBRARY PASSAGES (web imports are labelled):\n${context}\n\nQUESTION: ${query}\n\nRemember: cite [n] after each claim. If the passages are insufficient, say you could not find it in the library.`,
    },
  ];
}

/** Prompt for a labelled outside-source answer built from web results. */
export function buildOutsideMessages({ query, results = [], history = [], language = "en" }) {
  const context = formatOutsideContext(results);
  const recent = history.slice(-4).map(({ role, content }) => ({ role, content: truncate(content, 500) }));
  return [
    { role: "system", content: OUTSIDE_SYSTEM_PROMPT },
    ...recent,
    {
      role: "user",
      content: `${languageInstruction(language)}\n\nOUTSIDE SOURCES (web search results, not textbooks):\n${context}\n\nQUESTION: ${query}\n\nAnswer only from these sources, cite [W1] and so on, and say clearly what is missing if they do not answer everything.`,
    },
  ];
}

/** Backwards-compatible wrapper around the routed answer model. */
export async function callModel({ settings, messages, temperature = 0.2, maxTokens = 900, signal, task = "answer" } = {}) {
  const result = await callRoutedModel({ task, settings, messages, temperature, maxTokens, signal });
  return {
    content: result.content,
    usage: result.usage,
    engine: result.providerId,
    model: result.model,
    label: result.label,
    offline: result.offline,
    fallbackUsed: result.fallbackUsed,
    error: result.error,
  };
}

/**
 * Ask a connected model to answer an outside question from labelled web
 * sources. Returns `offline: true` when no model is available so the caller can
 * fall back to the extractive outside answer.
 */
export async function answerOutsideWithModel({ query, results = [], history = [], settings, signal } = {}) {
  const messages = buildOutsideMessages({ query, results, history, language: settings?.language });
  const result = await callModel({ settings, messages, task: "answer", signal, temperature: 0.2, maxTokens: 700 });
  if (result.offline) return { ...result, verification: { enabled: false } };
  let content = String(result.content || "").trim();
  if (content) {
    const label = "This is not from your textbooks — it comes from outside sources.";
    if (!content.includes(label)) content = `${label}\n\n${content}`;
    if (!/\[W\d+\]/.test(content)) {
      content += "\n\n_Verification note: this answer did not carry source labels. Read the linked sources below before relying on it._";
    }
  }
  return {
    ...result,
    content,
    sources: [],
    webSources: results,
    grounded: false,
    confidence: 0,
    meta: "Bolt · outside sources (AI summary)",
    verification: { enabled: false },
  };
}

export async function answerWithModel({ query, hits, mode, history, settings, signal, verify = true } = {}) {
  const messages = buildMessages({ query, hits, mode, history, language: settings?.language });
  const result = await callModel({ settings, messages, task: "answer", signal });
  if (result.offline) return { ...result, verification: { enabled: false } };
  const hasCitation = /\[\d+\]/.test(result.content);
  const content = hasCitation
    ? result.content
    : `${result.content}\n\n_Verification note: this answer did not include inline citations. Check the passages below before relying on it._`;

  let verification = { enabled: false };
  if (verify && settings?.routing?.verify && settings.routing.verify !== "offline") {
    verification = await verifyAnswer({ answer: content, hits, settings, signal });
  }
  return { ...result, content, verification };
}

export async function testModel(settings, providerId = settings?.activeProvider, options = {}) {
  return testProvider(settings, providerId, options);
}

export async function generateQuizWithModel({ topic, hits, count, type, difficulty, settings, signal }) {
  if (!settings?.routing?.quiz || settings.routing.quiz === "offline") {
    throw new Error("Quiz writing is routed to the offline engine.");
  }
  const context = formatContext(hits, { perPassage: 750, maxTotal: 4200 });
  const messages = [
    { role: "system", content: `${SYSTEM_PROMPT}\n\nYou are writing a quiz. ${QUIZ_SCHEMA}` },
    {
      role: "user",
      content: `Topic: ${topic || "this chapter"}\nDifficulty: ${difficulty}\nNumber of questions: ${count}\nPreferred type: ${type}\n${languageInstruction(settings?.language)}\n\nLIBRARY PASSAGES (web imports are labelled):\n${context}`,
    },
  ];
  const result = await callModel({ settings, messages, task: "quiz", temperature: 0.5, maxTokens: 1800, signal });
  if (result.offline) throw result.error || new Error("No quiz model was available.");
  const parsed = extractJson(result.content);
  const rawQuestions = Array.isArray(parsed) ? parsed : parsed?.questions;
  if (!Array.isArray(rawQuestions) || !rawQuestions.length) throw new Error("Model did not return a quiz.");
  return rawQuestions
    .map((question, index) => {
      const sourceIndex = Number(question.sourceIndex ?? question.source ?? 1) - 1;
      const source = hits[sourceIndex] || hits[0];
      if (!source) return null;
      return {
        type: ["mcq", "fill", "short"].includes(question.type) ? question.type : "mcq",
        prompt: String(question.prompt || question.question || "").trim(),
        options: Array.isArray(question.options) ? question.options.map(String) : [],
        answer: String(question.answer || "").trim(),
        reference: String(question.reference || question.answer || source.text).trim(),
        explanation: String(question.explanation || "See the cited textbook passage.").trim(),
        index,
        source: {
          bookId: source.bookId,
          chunkId: source.chunkId,
          title: source.title,
          sourceUrl: source.sourceUrl || "",
          sourceKind: source.sourceKind || "",
          page: source.page,
          section: source.section,
          quote: truncate(source.text, 260),
        },
        topic: source.section || "General",
      };
    })
    .filter((question) => question?.prompt)
    .slice(0, count);
}

/** Use any routed AI (including the local WebLLM model) to write cited cards. */
export async function generateFlashcardsWithModel({ topic, hits = [], count = 10, settings = {}, signal } = {}) {
  if (!settings?.routing?.flashcards || settings.routing.flashcards === "offline") {
    throw new Error("Flashcard writing is routed to the offline engine.");
  }
  const context = formatContext(hits, { perPassage: 700, maxTotal: 4200 });
  const messages = [
    { role: "system", content: `${SYSTEM_PROMPT}\n\nYou are writing revision flashcards. ${FLASHCARD_SCHEMA}` },
    {
      role: "user",
      content: `Topic: ${topic || "this chapter"}\nNumber of cards: ${count}\n${languageInstruction(settings?.language)}\n\nLIBRARY PASSAGES (web imports are labelled):\n${context}`,
    },
  ];
  const result = await callModel({ settings, messages, task: "flashcards", temperature: 0.45, maxTokens: 1600, signal });
  if (result.offline) throw result.error || new Error("No flashcard model was available.");
  const parsed = extractJson(result.content);
  const rawCards = Array.isArray(parsed) ? parsed : parsed?.cards || parsed?.flashcards;
  if (!Array.isArray(rawCards) || !rawCards.length) throw new Error("Model did not return flashcards.");
  return rawCards
    .map((card) => {
      const sourceIndex = Number(card.sourceIndex ?? card.source ?? 1) - 1;
      const source = hits[sourceIndex] || hits[0];
      if (!source) return null;
      const front = String(card.front || card.question || "").trim();
      const back = String(card.back || card.answer || "").trim();
      if (!front || !back) return null;
      return {
        id: uid("card"),
        front,
        back,
        source: {
          n: sourceIndex + 1,
          bookId: source.bookId,
          chunkId: source.chunkId,
          title: source.title,
          sourceUrl: source.sourceUrl || "",
          sourceKind: source.sourceKind || "",
          page: source.page,
          section: source.section,
          quote: truncate(source.text, 260),
        },
        topic: source.section || "General",
      };
    })
    .filter(Boolean)
    .slice(0, count);
}
