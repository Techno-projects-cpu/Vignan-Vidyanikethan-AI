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
} from "../js/local-ai.js?v=88";
import { DEFAULT_SETTINGS, normalizeSettings } from "../js/settings.js";
import { callProvider, callRoutedModel } from "../js/model-router.js";
import { resetRecovery, recoverySnapshot } from "../js/recovery.js?v=88";
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

test('local model cancellation settles promptly even if the worker immediately acknowledges abort', async () => {
  resetLocalAIForTests();
  const worker = new FakeLocalWorker();
  const original = worker.postMessage.bind(worker);
  worker.postMessage = message => {
    if (message.type === 'load') { worker.posted.push(message); return; }
    original(message);
  };
  setLocalAICapabilities({ webgpu: true, worker: true });
  setLocalAIWorkerFactory(() => worker);
  const controller = new AbortController();
  const loading = loadLocalModel(DEFAULT_LOCAL_MODEL_ID, { signal: controller.signal });
  controller.abort();
  let timer;
  try {
    await assert.rejects(Promise.race([loading, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('cancellation hung')), 200); })]), { name: 'AbortError' });
  } finally { clearTimeout(timer); resetLocalAIForTests(); }
});

test('replacing a local worker rejects in-flight requests rather than leaving them pending', async () => {
  resetLocalAIForTests();
  setLocalAICapabilities({ webgpu: true, worker: true });
  setLocalAIWorkerFactory(() => ({ postMessage() {}, terminate() {} }));
  const loading = loadLocalModel(DEFAULT_LOCAL_MODEL_ID);
  setLocalAIWorkerFactory(null);
  await assert.rejects(loading, { name: 'AbortError' });
  resetLocalAIForTests();
});

test('real WebLLM worker protocol serializes model operations and reports failed cache deletion', async () => {
  const { readFileSync } = await import('node:fs');
  const { default: vm } = await import('node:vm');
  const source = readFileSync(new URL('../js/local-ai-worker.js', import.meta.url), 'utf8').replace(/import\s*\{[\s\S]*?\}\s*from\s*"\.\.\/vendor\/webllm\/web-llm.js";/, '');
  const posted = [], operations = [];
  let release;
  const engine = {
    setInitProgressCallback() {},
    reload: async model => { operations.push(`reload:${model}`); },
    unload: async () => { operations.push('unload'); },
    chat: { completions: { create: async () => { operations.push('generate'); return { choices: [{ message: { content: 'OK' } }] }; } } },
  };
  const context = vm.createContext({
    postMessage: message => posted.push(message),
    prebuiltAppConfig: { model_list: [{ model_id: 'A' }, { model_id: 'B' }] },
    CreateMLCEngine: async model => { operations.push(`load:${model}`); await new Promise(resolve => { release = resolve; }); return engine; },
    hasModelInCache: async () => true,
    deleteModelAllInfoInCache: async () => { throw new Error('cache denied'); },
    deleteModelWasmInCache: async () => {},
  });
  vm.runInContext(source, context);
  const send = (id, type, modelId) => context.onmessage({ data: { id, type, payload: { modelId } } });
  send(1, 'load', 'A'); send(2, 'generate', 'A'); send(3, 'load', 'B');
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(operations, ['load:A']);
  release(); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(operations, ['load:A', 'generate', 'reload:B']);
  assert.deepEqual(posted.map(message => message.id), [1, 2, 3]);
  send(4, 'clear', 'B'); await new Promise(resolve => setImmediate(resolve));
  assert.equal(posted.at(-1).type, 'error');
  assert.match(posted.at(-1).message, /cache denied/);
});

test('all selectable local models exist in the actual vendored runtime catalogue', async () => {
  const { prebuiltAppConfig } = await import('../vendor/webllm/web-llm.js');
  for (const model of LOCAL_MODELS) {
    const entry = prebuiltAppConfig.model_list.find(item => item.model_id === model.id);
    assert.ok(entry, `${model.id} must be supported by the shipped runtime`);
    assert.match(entry.model_lib, /^https:\/\/raw\.githubusercontent\.com\//);
    assert.match(entry.model, /^https:\/\/huggingface\.co\//);
  }
});

test('a crashed WebLLM worker is replaced on the next load', async () => {
  resetLocalAIForTests();
  setLocalAICapabilities({ webgpu: true, worker: true });
  const dead = { postMessage() {}, terminate() {} };
  let starts = 0;
  setLocalAIWorkerFactory(() => ++starts === 1 ? dead : new FakeLocalWorker());
  const loading = loadLocalModel(DEFAULT_LOCAL_MODEL_ID);
  dead.onerror({ message: 'worker stopped unexpectedly' });
  await assert.rejects(loading, /worker stopped unexpectedly/);
  await loadLocalModel(DEFAULT_LOCAL_MODEL_ID);
  assert.equal(starts, 2);
  assert.equal(getLocalAIState().ready, true);
  resetLocalAIForTests();
});

test('failed cloud requests automatically reroute to the already-loaded WebLLM model', async () => {
  resetLocalAIForTests(); resetRecovery();
  setLocalAICapabilities({ webgpu: true, worker: true });
  const worker = new FakeLocalWorker();
  setLocalAIWorkerFactory(() => worker);
  await loadLocalModel(DEFAULT_LOCAL_MODEL_ID);
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'unavailable' }), { status: 503 });
  try {
    const settings = normalizeSettings({ routing: { answer: 'server' }, localAIModel: 'Llama-3.2-1B-Instruct-q4f16_1-MLC' });
    const result = await callRoutedModel({ settings, messages: [{ role: 'user', content: 'Explain' }] });
    assert.equal(result.providerId, 'webllm');
    assert.equal(result.model, DEFAULT_LOCAL_MODEL_ID, 'use ready model, not a new download');
    assert.equal(result.fallbackUsed, true);
    assert.equal(worker.posted.filter(message => message.type === 'load').length, 1);
    assert.equal(recoverySnapshot().recent.at(-1).kind, 'recovered');
    assert.equal(settings.routing.answer, 'server', 'saved routes are never rewritten');
  } finally { globalThis.fetch = oldFetch; resetLocalAIForTests(); resetRecovery(); }
});
