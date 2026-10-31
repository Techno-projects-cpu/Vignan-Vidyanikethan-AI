import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_LOCAL_MODEL_ID,
  LOCAL_MODELS,
  VIGNAN_LOCAL_RULES,
  applyVignanRules,
  clearLocalModelCache,
  getLocalAIState,
  loadLocalModel,
  recommendedLocalModel,
  refreshLocalAIStatus,
  resetLocalAIForTests,
  setLocalAICapabilities,
  setLocalAIWorkerFactory,
  testLocalAI,
} from "../js/local-ai.js?v=39";
import { DEFAULT_SETTINGS, normalizeSettings } from "../js/settings.js";
import { callProvider } from "../js/model-router.js";
import {
  answerWithModel,
  generateFlashcardsWithModel,
  generateQuizWithModel,
  gradeShortWithModel,
  verifyAnswer,
} from "../js/llm.js";
import { FREE_API_PROVIDERS, FREE_API_WARNING } from "../js/free-apis.js";
import { chapterHits } from "./helpers.mjs";

class FakeLocalWorker {
  constructor() {
    this.listeners = [];
    this.cleared = false;
    this.posted = [];
    this.onmessage = null;
    this.onerror = null;
  }

  addEventListener(type, listener) {
    if (type === "message") this.listeners.push(listener);
  }

  emit(data) {
    const event = { data };
    this.onmessage?.(event);
    for (const listener of this.listeners) listener(event);
  }

  modelReply(payload) {
    const system = payload.messages?.[0]?.content || "";
    if (system.includes("Reply with exactly: OK")) return "OK";
    if (system.includes("You are writing a quiz")) {
      return JSON.stringify({
        questions: [{
          type: "mcq",
          prompt: "Why do leaves look green?",
          options: ["Chlorophyll", "Sand", "Oxygen", "Roots"],
          answer: "Chlorophyll",
          explanation: "Chlorophyll reflects green light.",
          sourceIndex: 1,
        }],
      });
    }
    if (system.includes("writing revision flashcards")) {
      return JSON.stringify({
        cards: [{ front: "What makes leaves look green?", back: "Chlorophyll reflects green light.", sourceIndex: 1 }],
      });
    }
    if (system.includes("strict citation verifier")) {
      return JSON.stringify({ supported: true, unsupported: [], missingCitations: [], note: "All claims cited." });
    }
    if (system.includes("grading a short school answer")) {
      return JSON.stringify({ awarded: 1, feedback: "Correct meaning.", missing: [] });
    }
    return "Local grounded answer [1]";
  }

  postMessage(message) {
    this.posted.push(message);
    const { type, id, payload = {} } = message;
    if (type === "status") {
      this.emit({ type: "status", id, modelId: payload.modelId, cached: !this.cleared, webgpu: true });
      return;
    }
    if (type === "load") {
      this.emit({ type: "progress", id, report: { progress: 0.5, text: "Half downloaded", timeElapsed: 1 } });
      this.emit({ type: "result", id, data: { modelId: payload.modelId, cached: !this.cleared } });
      return;
    }
    if (type === "generate") {
      assert.match(payload.messages[0].content, /LOCAL MODEL RULES/);
      const content = this.modelReply(payload);
      this.emit({ type: "result", id, data: { modelId: payload.modelId, content, usage: { total_tokens: 24 } } });
      return;
    }
    if (type === "clear") {
      this.cleared = true;
      this.emit({ type: "result", id, data: { cleared: true } });
      return;
    }
    if (type === "unload" || type === "abort") {
      this.emit({ type: "result", id, data: { [type === "unload" ? "unloaded" : "aborted"]: true } });
    }
  }

  terminate() {}
}

let lastWorker = null;
function setupLocalAI(caps = {}) {
  resetLocalAIForTests();
  setLocalAICapabilities({ webgpu: true, worker: true, width: 1280, deviceMemory: 8, ...caps });
  setLocalAIWorkerFactory(() => {
    lastWorker = new FakeLocalWorker();
    return lastWorker;
  });
}

function webLLMSettings() {
  const settings = normalizeSettings(DEFAULT_SETTINGS);
  for (const task of Object.keys(settings.routing)) settings.routing[task] = "webllm";
  settings.activeProvider = "webllm";
  settings.fallback = "offline";
  settings.localAIModel = DEFAULT_LOCAL_MODEL_ID;
  settings.providers.webllm.model = DEFAULT_LOCAL_MODEL_ID;
  return settings;
}

test("local model catalogue and Vignan rules are bundled", () => {
  assert.ok(LOCAL_MODELS.some((model) => model.id.includes("Llama-3.2-1B")));
  assert.ok(LOCAL_MODELS.some((model) => model.id.includes("SmolLM2")));
  assert.ok(LOCAL_MODELS.some((model) => model.id.includes("Qwen2.5")));
  assert.match(VIGNAN_LOCAL_RULES, /textbook passages/i);
  const messages = applyVignanRules([
    { role: "user", content: "Why are leaves green?" },
    { role: "system", content: "Be concise." },
  ]);
  assert.equal(messages[0].role, "system");
  assert.match(messages[0].content, /LOCAL MODEL RULES/);
  assert.match(messages[0].content, /Be concise/);
  assert.equal(messages[1].content, "Why are leaves green?");
});

test("device recommendation changes with memory and screen size", () => {
  setupLocalAI({ width: 390, deviceMemory: 3 });
  assert.equal(recommendedLocalModel().id, "SmolLM2-135M-Instruct-q0f16-MLC");
  setLocalAICapabilities({ width: 1280, deviceMemory: 16 });
  assert.equal(recommendedLocalModel().id, "Llama-3.2-1B-Instruct-q4f16_1-MLC");
});

test("local model downloads, reports progress and becomes ready", async () => {
  setupLocalAI();
  const progress = [];
  const result = await loadLocalModel(DEFAULT_LOCAL_MODEL_ID, { onProgress: (report) => progress.push(report) });
  assert.equal(result.modelId, DEFAULT_LOCAL_MODEL_ID);
  assert.equal(result.cached, true);
  assert.ok(progress.length >= 1);
  assert.equal(getLocalAIState().ready, true);
  assert.equal(getLocalAIState().status, "ready");
  assert.ok(lastWorker.posted.some((message) => message.type === "load"));
});

test("WebLLM provider answers with Vignan rules and no HTTP request", async () => {
  setupLocalAI();
  const settings = webLLMSettings();
  const result = await callProvider({
    providerId: "webllm",
    settings,
    messages: [{ role: "user", content: "Why are leaves green?" }],
    maxTokens: 120,
  });
  assert.equal(result.providerId, "webllm");
  assert.equal(result.offline, false);
  assert.equal(result.private, true);
  assert.equal(result.content, "Local grounded answer [1]");
  assert.equal(result.usage.total_tokens, 24);
  assert.ok(lastWorker.posted.every((message) => message.type !== "unknown"));
});

test("local model powers answers, quizzes, flashcards, grading and verification", async () => {
  setupLocalAI();
  const settings = webLLMSettings();
  const hits = chapterHits("photosynthesis", 4);

  const answer = await answerWithModel({
    query: "Why do leaves look green?",
    hits,
    settings,
    verify: true,
  });
  assert.match(answer.content, /\[1\]/);
  assert.equal(answer.verification.supported, true);

  const questions = await generateQuizWithModel({
    topic: "photosynthesis",
    hits,
    count: 1,
    type: "mcq",
    difficulty: "easy",
    settings,
  });
  assert.equal(questions.length, 1);
  assert.equal(questions[0].source.page, hits[0].page);

  const cards = await generateFlashcardsWithModel({ topic: "photosynthesis", hits, count: 1, settings });
  assert.equal(cards.length, 1);
  assert.match(cards[0].back, /Chlorophyll/);
  assert.equal(cards[0].source.page, hits[0].page);

  const grade = await gradeShortWithModel({
    question: { prompt: "Why are leaves green?", reference: "Chlorophyll reflects green light." },
    submitted: "Because chlorophyll reflects green light.",
    settings,
  });
  assert.equal(grade.awarded, 1);

  const verification = await verifyAnswer({ answer: answer.content, hits, settings });
  assert.equal(verification.enabled, true);
  assert.equal(verification.supported, true);
  assert.equal(verification.providerId, "webllm");
});

test("cache status, health check and clear work through the worker", async () => {
  setupLocalAI();
  const status = await refreshLocalAIStatus(DEFAULT_LOCAL_MODEL_ID);
  assert.equal(status.cachedModels.includes(DEFAULT_LOCAL_MODEL_ID), true);
  assert.equal(await testLocalAI(DEFAULT_LOCAL_MODEL_ID), "OK");
  await clearLocalModelCache(DEFAULT_LOCAL_MODEL_ID);
  assert.equal(getLocalAIState().cachedModels.includes(DEFAULT_LOCAL_MODEL_ID), false);
  assert.equal(getLocalAIState().ready, false);
});

test("official free API catalogue contains links but no key values", () => {
  assert.ok(FREE_API_PROVIDERS.length >= 8);
  assert.match(FREE_API_WARNING, /No API keys are bundled/i);
  for (const provider of FREE_API_PROVIDERS) {
    assert.match(provider.url, /^https:\/\//);
    assert.equal(Object.hasOwn(provider, "apiKey"), false);
    assert.equal(Object.hasOwn(provider, "key"), false);
    assert.ok(provider.env || provider.local);
  }
});
