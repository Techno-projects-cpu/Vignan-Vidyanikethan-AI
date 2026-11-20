/**
 * Web Worker host for Vignan Vidyanikethan AI's local WebLLM engine.
 *
 * Keeping the 6 MB runtime and all inference inside a worker means the chat,
 * quiz and flashcard views stay responsive on phones. The main thread talks to
 * this worker with a tiny JSON message protocol; no API key ever exists here.
 */

import {
  CreateMLCEngine,
  deleteModelAllInfoInCache,
  deleteModelWasmInCache,
  hasModelInCache,
  prebuiltAppConfig,
} from "../vendor/webllm/web-llm.js";

let engine = null;
let loadedModelId = "";
let loading = null;

function post(message) {
  globalThis.postMessage(message);
}

function knownModel(modelId) {
  return prebuiltAppConfig.model_list.some((entry) => entry.model_id === modelId);
}

function progressFor(id) {
  return (report) => {
    post({
      type: "progress",
      id,
      report: {
        progress: Number(report?.progress || 0),
        timeElapsed: Number(report?.timeElapsed || 0),
        text: String(report?.text || "Loading model…"),
      },
    });
  };
}

async function ensureEngine(modelId, id) {
  if (engine && loadedModelId === modelId) return engine;
  if (loading) return loading;
  if (!knownModel(modelId)) throw new Error(`Unknown local model: ${modelId}`);

  const callback = progressFor(id);
  loading = (async () => {
    if (!engine) {
      engine = await CreateMLCEngine(modelId, { initProgressCallback: callback });
    } else {
      engine.setInitProgressCallback(callback);
      await engine.reload(modelId);
    }
    loadedModelId = modelId;
    return engine;
  })();
  try {
    return await loading;
  } finally {
    loading = null;
  }
}

function contentFromCompletion(completion) {
  const choice = completion?.choices?.[0];
  const content = choice?.message?.content ?? choice?.text ?? completion?.content ?? "";
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) return content.map((part) => (typeof part === "string" ? part : part?.text || "")).join("").trim();
  return String(content || "").trim();
}

async function loadModel(id, payload) {
  const modelId = String(payload?.modelId || "");
  await ensureEngine(modelId, id);
  post({ type: "result", id, data: { modelId, cached: await hasModelInCache(modelId, prebuiltAppConfig).catch(() => false) } });
}

async function generate(id, payload) {
  const modelId = String(payload?.modelId || loadedModelId);
  const active = await ensureEngine(modelId, id);
  const completion = await active.chat.completions.create({
    messages: Array.isArray(payload?.messages) ? payload.messages : [],
    temperature: Number.isFinite(payload?.temperature) ? payload.temperature : 0.2,
    max_tokens: Number.isFinite(payload?.maxTokens) ? payload.maxTokens : 900,
    stream: false,
  });
  post({
    type: "result",
    id,
    data: {
      modelId,
      content: contentFromCompletion(completion),
      usage: completion?.usage || null,
    },
  });
}

async function status(id, payload) {
  const modelId = String(payload?.modelId || "");
  if (!modelId || !knownModel(modelId)) {
    post({ type: "error", id, message: `Unknown local model: ${modelId}` });
    return;
  }
  const cached = await hasModelInCache(modelId, prebuiltAppConfig).catch(() => false);
  post({ type: "status", id, modelId, cached, webgpu: Boolean(globalThis.navigator?.gpu) });
}

async function clearModel(id, payload) {
  const modelId = String(payload?.modelId || loadedModelId);
  try {
    await engine?.unload?.();
  } catch {
    // A lost GPU device can make unload fail; clearing the cache is still useful.
  }
  engine = null;
  loadedModelId = "";
  loading = null;
  await Promise.all([
    deleteModelAllInfoInCache(modelId, prebuiltAppConfig),
    deleteModelWasmInCache(modelId, prebuiltAppConfig),
  ]);
  post({ type: "result", id, data: { modelId, cleared: true } });
}

async function unload() {
  try {
    await engine?.unload?.();
  } finally {
    engine = null;
    loadedModelId = "";
    loading = null;
  }
}

async function dispatch(message) {
  const { id, type, payload } = message;
  try {
    if (type === "load") return await loadModel(id, payload);
    if (type === "generate") return await generate(id, payload);
    if (type === "status") return await status(id, payload);
    if (type === "clear") return await clearModel(id, payload);
    if (type === "unload") {
      await unload();
      return post({ type: "result", id, data: { unloaded: true } });
    }
    post({ type: "error", id, message: `Unknown local AI worker command: ${type}` });
  } catch (error) {
    post({ type: "error", id, message: error?.message || String(error) });
  }
}

// WebGPU engines cannot safely reload/unload while another command generates.
// Keep abort out of the queue so Stop can interrupt an active generation.
let commands = Promise.resolve();
let activeId = null;
const queued = new Set();
const cancelled = new Set();
globalThis.onmessage = (event) => {
  const message = event?.data || {};
  if (message.type === "abort") {
    if (queued.has(message.id)) cancelled.add(message.id);
    if (activeId === message.id) {
      try { engine?.interruptGenerate?.(); } catch { /* already stopped */ }
    }
    return;
  }
  queued.add(message.id);
  commands = commands.then(async () => {
    activeId = message.id;
    try {
      if (!cancelled.has(message.id)) await dispatch(message);
    } finally {
      queued.delete(message.id);
      cancelled.delete(message.id);
      activeId = null;
    }
  }).catch(error => post({ type: "error", id: message.id, message: error?.message || String(error) }));
};
