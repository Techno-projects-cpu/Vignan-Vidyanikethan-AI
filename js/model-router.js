/**
 * Task-based model router.
 *
 * Different study jobs can use different existing AIs: a fast model for quiz
 * writing, a stronger model for explanations, a local model for private
 * grading, and a separate verifier for citation checking. If no model answers,
 * the caller uses the deterministic offline engine instead.
 */

import {
  GRADE_SYSTEM_PROMPT,
  extractJson,
  formatContext,
  VERIFY_SYSTEM_PROMPT,
} from "./context.js?v=88";
import { postModelRequest, resolveProvider } from "./providers.js?v=88";
import { generateWithLocalAI, getLocalAIState } from "./local-ai.js?v=88";
import { providerKeyVariants } from "./key-pool.js?v=88";
import { studentKeyPayload } from "./student-keys.js?v=88";
import { classifyFailure, routeIdentity, routeCooling, recordRouteFailure, recordRouteSuccess, reportRecovery } from "./recovery.js?v=88";
import { withNetworkDeadline, clamp, truncate } from "./util.js?v=88";

export const TASKS = [
  {
    id: "answer",
    label: "Answers & explanations",
    help: "Drafts the natural-language answer from retrieved textbook passages.",
  },
  {
    id: "quiz",
    label: "Quiz writing",
    help: "Writes custom MCQs, blanks and short-answer questions from a chapter.",
  },
  {
    id: "flashcards",
    label: "Flashcard writing",
    help: "Turns cited passages into question-and-answer revision cards.",
  },
  {
    id: "grade",
    label: "Short-answer grading",
    help: "Optionally grades written answers for meaning rather than exact words.",
  },
  {
    id: "verify",
    label: "Citation verification",
    help: "A second AI checks that claims are supported by the cited pages.",
  },
];

export function taskRoute(settings, task) {
  return settings?.routing?.[task] || "offline";
}

function offlineResult(error = null) {
  return {
    content: "",
    providerId: "offline",
    model: "offline",
    label: "Offline engine",
    offline: true,
    usage: null,
    error,
  };
}

export async function callProvider({
  providerId,
  settings = {},
  messages = [],
  temperature = 0.2,
  maxTokens = 900,
  signal,
  forceStudentKeys = false,
} = {}) {
  if (signal?.aborted) throw Object.assign(new Error("The request was cancelled."), { name: "AbortError" });
  if (settings.offlineMode) return offlineResult();
  const provider = resolveProvider(settings, providerId);
  if (!provider) return offlineResult();
  if (provider.kind === "webllm") {
    const local = await generateWithLocalAI({
      modelId: provider.model,
      messages,
      temperature,
      maxTokens,
      signal,
    });
    return {
      content: local.content,
      providerId,
      model: local.modelId,
      label: provider.label,
      private: true,
      offline: false,
      usage: local.usage,
      runtime: local.runtime,
      error: null,
    };
  }
  if (provider.needsKey && provider.kind !== "server" && !providerKeyVariants(provider).length) {
    throw new Error(`Add at least one API key for ${provider.label} in Settings.`);
  }
  const studentKeys = studentKeyPayload(settings, { force: forceStudentKeys });
  const result = await postModelRequest(provider, messages, {
    temperature,
    maxTokens,
    signal,
    studentKeys,
    studentKeyFallback: forceStudentKeys || settings.studentKeyFallback !== false,
    forceStudentKeys,
  });
  if (!result.content) throw new Error(`${provider.label} returned an empty response.`);
  return {
    content: result.content,
    providerId,
    model: result.data?.model || provider.model || provider.label,
    label: result.data?.providerLabel || provider.label,
    private: Boolean(provider.private),
    offline: false,
    usage: result.usage,
    keyIndex: result.keyIndex,
    keyCount: result.keyCount,
    keySource: result.data?.keySource || result.keySource,
    studentKeyUsed: Boolean(result.data?.studentKeyUsed),
    freeRouter: Boolean(result.data?.freeRouter),
    error: null,
  };
}

/**
 * Call the provider assigned to a task. Falls back to another configured
 * provider (if set) and finally to the offline engine result.
 */
export async function callRoutedModel({
  task = "answer",
  settings = {},
  messages = [],
  temperature = 0.2,
  maxTokens = 900,
  signal,
} = {}) {
  if (signal?.aborted) throw Object.assign(new Error("The request was cancelled."), { name: "AbortError" });
  if (settings.offlineMode) return offlineResult();
  const primary = taskRoute(settings, task);
  if (primary === "offline") return offlineResult();
  const recoveryEnabled = settings.autoRecovery !== false;
  const local = getLocalAIState();
  const fallback = settings.fallback || "offline";
  const attempts = [primary];
  // Recovery uses only an ALREADY LOADED model: no surprise downloads or network
  // probes to model hosts, and no new cloud providers without saved consent.
  if (recoveryEnabled && primary !== "webllm" && local.ready && local.webgpuReady) attempts.push("webllm");
  if (fallback !== "offline" && !attempts.includes(fallback)) attempts.push(fallback);
  const deadline = Date.now() + 45000;
  let lastError = null;
  for (const providerId of attempts) {
    const provider = resolveProvider(settings, providerId);
    if (!provider) continue;
    const identity = routeIdentity(provider);
    if (recoveryEnabled && providerId === "webllm" && providerId !== primary && (!local.ready || !local.webgpuReady)) continue;
    const automaticLocal = providerId === "webllm" && providerId !== primary && recoveryEnabled && local.ready;
    const routeSettings = automaticLocal
      ? { ...settings, localAIModel: local.modelId, providers: { ...settings.providers, webllm: { ...settings.providers?.webllm, model: local.modelId } } }
      : settings;
    if (recoveryEnabled && providerId !== "webllm" && (routeCooling(identity) || globalThis.navigator?.onLine === false)) {
      reportRecovery(globalThis.navigator?.onLine === false ? "network-offline" : "cooldown", providerId);
      continue;
    }
    try {
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      const run = requestSignal => callProvider({ providerId, settings: routeSettings, messages, temperature, maxTokens, signal: requestSignal });
      // Explicit local selection retains its intentional first-download flow.
      const result = providerId === "webllm" && providerId === primary
        ? await run(signal)
        : await withNetworkDeadline(run, { signal, timeoutMs: automaticLocal ? Math.min(15000, remaining) : remaining });
      if (result.offline) continue;
      recordRouteSuccess(identity);
      if (recoveryEnabled) reportRecovery(providerId !== primary ? "recovered" : "primary-success", providerId);
      return { ...result, fallbackUsed: providerId !== primary, task };
    } catch (error) {
      if (signal?.aborted || error?.name === "AbortError") throw error;
      lastError = error;
      if (recoveryEnabled) {
        recordRouteFailure(identity);
        reportRecovery(classifyFailure(error), providerId);
      }
    }
  }
  if (recoveryEnabled) reportRecovery("offline-fallback");
  return { ...offlineResult(lastError), fallbackUsed: true, task };

}

export async function testProvider(settings, providerId, options = {}) {
  const result = await callProvider({
    providerId,
    settings,
    messages: [
      { role: "system", content: "You are a health check. Reply with exactly: OK" },
      { role: "user", content: "Say OK." },
    ],
    temperature: 0,
    maxTokens: 20,
    ...options,
  });
  if (result.offline) throw new Error("Choose a provider first.");
  return result.content.slice(0, 120);
}

/** Ask a verifier model to check an answer against the same cited passages. */
export async function verifyAnswer({ answer, hits = [], settings = {}, signal } = {}) {
  const providerId = taskRoute(settings, "verify");
  if (providerId === "offline") return { enabled: false, providerId: "offline" };
  const messages = [
    { role: "system", content: VERIFY_SYSTEM_PROMPT },
    {
      role: "user",
      content: `PASSAGES:\n${formatContext(hits, { perPassage: 700, maxTotal: 4600 })}\n\nANSWER:\n${truncate(answer, 3500)}`,
    },
  ];
  const result = await callRoutedModel({ task: "verify", settings, messages, temperature: 0, maxTokens: 700, signal });
  if (result.offline) {
    return {
      enabled: true,
      providerId,
      error: result.error?.message || "The verifier model was unavailable.",
    };
  }
  const parsed = extractJson(result.content) || {};
  return {
    enabled: true,
    providerId: result.providerId,
    model: result.model,
    supported: Boolean(parsed.supported),
    unsupported: Array.isArray(parsed.unsupported) ? parsed.unsupported.slice(0, 5) : [],
    missingCitations: Array.isArray(parsed.missingCitations) ? parsed.missingCitations.slice(0, 5) : [],
    note: String(parsed.note || "").slice(0, 220),
  };
}

/** Optional meaning-based grading for short answers. Returns null if offline. */
export async function gradeShortWithModel({ question, submitted, settings = {}, signal } = {}) {
  const providerId = taskRoute(settings, "grade");
  if (providerId === "offline") return null;
  const reference = question?.reference || question?.source?.quote || question?.explanation || "";
  const messages = [
    { role: "system", content: GRADE_SYSTEM_PROMPT },
    {
      role: "user",
      content: `QUESTION: ${question?.prompt || ""}\nREFERENCE PASSAGE: ${truncate(reference, 1400)}\nSTUDENT ANSWER: ${truncate(submitted || "", 900)}`,
    },
  ];
  const result = await callRoutedModel({ task: "grade", settings, messages, temperature: 0, maxTokens: 350, signal });
  if (result.offline) return null;
  const parsed = extractJson(result.content);
  if (!parsed) return null;
  return {
    awarded: clamp(Number(parsed.awarded) || 0, 0, 1),
    feedback: String(parsed.feedback || "Reviewed against the textbook passage.").slice(0, 240),
    missing: Array.isArray(parsed.missing) ? parsed.missing.slice(0, 4) : [],
    providerId: result.providerId,
    model: result.model,
  };
}
