import test from "node:test";
import assert from "node:assert/strict";
import { buildModelRequest, parseProviderResponse, postModelRequest, providerList, PROVIDERS, resolveProvider } from "../js/providers.js";
import { DEFAULT_SETTINGS, engineLabel, isModelConnected, normalizeSettings, privacyLabel } from "../js/settings.js";
import { callRoutedModel, taskRoute, TASKS } from "../js/model-router.js";
import { extractJson, formatContext, SYSTEM_PROMPT } from "../js/context.js";
import { buildMessages } from "../js/llm.js";
import { parseSearchResults } from "../js/web.js";
import { chapterHits } from "./helpers.mjs";

const messages = [
  { role: "system", content: "Be grounded." },
  { role: "user", content: "Why do leaves look green?" },
];

test("provider registry includes local and hosted AI adapters", () => {
  const ids = providerList().map((provider) => provider.id);
  for (const id of ["server", "webllm", "ollama", "lmstudio", "openai", "gemini", "anthropic", "groq", "arena", "cloudflare", "mistral", "cohere", "custom"]) {
    assert.ok(ids.includes(id));
  }
  assert.equal(providerList().length, 16);
  assert.equal(PROVIDERS.webllm.private, true);
  assert.equal(PROVIDERS.webllm.needsKey, false);
  assert.equal(PROVIDERS.cohere.kind, "openai");
  assert.equal(PROVIDERS.server.private, true);
  assert.equal(PROVIDERS.openai.needsKey, true);
});

test("Arena AI adapter uses bearer auth and the Anthropic messages shape", () => {
  const settings = normalizeSettings(DEFAULT_SETTINGS);
  settings.providers.arena.apiKey = "arena-workspace-key";
  const provider = resolveProvider(settings, "arena");
  const request = buildModelRequest(provider, messages, { maxTokens: 120 });
  assert.equal(request.url, "https://api.arena.ai/v1/messages");
  assert.equal(request.headers.Authorization, "Bearer arena-workspace-key");
  assert.equal(request.headers["anthropic-version"], "2023-06-01");
  assert.equal(request.body.model, "coding-router-preview");
  assert.equal(request.body.system, "Be grounded.");
  assert.equal(request.body.messages.length, 1);
  assert.equal(parseProviderResponse(provider, { content: [{ type: "text", text: "Arena" }] }), "Arena");
});

test("OpenAI-compatible request uses chat/completions and bearer auth", () => {
  const settings = normalizeSettings(DEFAULT_SETTINGS);
  settings.providers.openai.apiKey = "test-key";
  const provider = resolveProvider(settings, "openai");
  const request = buildModelRequest(provider, messages, { temperature: 0.3, maxTokens: 250 });
  assert.equal(request.url, "https://api.openai.com/v1/chat/completions");
  assert.equal(request.headers.Authorization, "Bearer test-key");
  assert.equal(request.body.model, "gpt-4o-mini");
  assert.equal(request.body.max_tokens, 250);
  assert.equal(request.body.messages.length, 2);
});

test("Anthropic adapter splits system messages and uses x-api-key", () => {
  const settings = normalizeSettings(DEFAULT_SETTINGS);
  settings.providers.anthropic.apiKey = "claude-key";
  const provider = resolveProvider(settings, "anthropic");
  const request = buildModelRequest(provider, messages, { maxTokens: 100 });
  assert.equal(request.url, "https://api.anthropic.com/v1/messages");
  assert.equal(request.headers["x-api-key"], "claude-key");
  assert.equal(request.body.system, "Be grounded.");
  assert.equal(request.body.messages.length, 1);
  assert.equal(request.body.messages[0].role, "user");
});

test("Ollama adapter uses the native chat endpoint and no key", () => {
  const settings = normalizeSettings(DEFAULT_SETTINGS);
  const provider = resolveProvider(settings, "ollama");
  const request = buildModelRequest(provider, messages, { maxTokens: 120 });
  assert.equal(request.url, "http://localhost:11434/api/chat");
  assert.equal(request.body.stream, false);
  assert.equal(request.body.options.num_predict, 120);
  assert.equal(request.body.messages.length, 2);
});

test("server adapter posts to the same-origin proxy", () => {
  const provider = resolveProvider(normalizeSettings(DEFAULT_SETTINGS), "server");
  const request = buildModelRequest(provider, messages, { maxTokens: 80 });
  assert.equal(request.url, "api/ai");
  assert.equal(request.body.max_tokens, 80);
});

test("parseProviderResponse handles OpenAI, Anthropic and Ollama shapes", () => {
  assert.equal(parseProviderResponse(PROVIDERS.openai, { choices: [{ message: { content: "OpenAI" } }] }), "OpenAI");
  assert.equal(
    parseProviderResponse(PROVIDERS.anthropic, { content: [{ type: "text", text: "Claude" }] }),
    "Claude",
  );
  assert.equal(parseProviderResponse(PROVIDERS.ollama, { message: { content: "Llama" } }), "Llama");
  assert.equal(parseProviderResponse(PROVIDERS.server, { content: "Proxy" }), "Proxy");
});

test("settings migrate legacy engine config and validate routes", () => {
  const migrated = normalizeSettings({
    engine: "custom",
    endpoint: "https://example.com/v1",
    model: "tiny-model",
    apiKey: "secret",
  });
  assert.equal(migrated.routing.answer, "openai");
  assert.equal(migrated.providers.openai.endpoint, "https://example.com/v1");
  assert.equal(migrated.providers.openai.apiKey, "secret");
  const invalid = normalizeSettings({ routing: { answer: "not-a-provider" }, theme: "purple" });
  assert.equal(invalid.routing.answer, "offline");
  assert.equal(invalid.theme, "light");
  assert.equal(isModelConnected(invalid), false);
  assert.match(engineLabel(invalid), /Offline/i);
  assert.match(privacyLabel(invalid), /Nothing leaves/i);
});

test("task router defaults to offline and exposes four tasks", () => {
  const settings = normalizeSettings(DEFAULT_SETTINGS);
  assert.deepEqual(TASKS.map((task) => task.id), ["answer", "quiz", "flashcards", "grade", "verify"]);
  assert.equal(taskRoute(settings, "answer"), "offline");
  return callRoutedModel({ task: "answer", settings, messages }).then((result) => {
    assert.equal(result.offline, true);
    assert.equal(result.content, "");
  });
});

test("prompt context is page-labelled and length-limited", () => {
  const hits = chapterHits("photosynthesis", 4);
  const context = formatContext(hits, { perPassage: 200, maxTotal: 900 });
  assert.match(context, /\[1\].*page \d+/);
  assert.ok(context.length <= 1000);
  const built = buildMessages({ query: "What is photosynthesis?", hits, mode: "explain" });
  assert.equal(built[0].content, SYSTEM_PROMPT);
  assert.match(built.at(-1).content, /Explain the idea step by step/);
  assert.match(built.at(-1).content, /TEXTBOOK PASSAGES/);
});

test("extractJson tolerates code fences and surrounding prose", () => {
  assert.deepEqual(extractJson('```json\n{"supported":true}\n```'), { supported: true });
  assert.deepEqual(extractJson('Here you go: {"awarded":0.5,"feedback":"ok"} thanks'), {
    awarded: 0.5,
    feedback: "ok",
  });
  assert.equal(extractJson("no json here"), null);
});

test("parseSearchResults normalises common JSON shapes and rejects bad URLs", () => {
  const parsed = parseSearchResults({
    results: [
      { title: "Good", url: "https://example.com/a", snippet: "A preview" },
      { title: "Bad", url: "javascript:alert(1)", snippet: "Nope" },
      { link: "https://openalex.org/works/W1", description: "Another" },
    ],
  });
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].domain, "example.com");
  assert.match(parsed[0].snippet, /preview/);
  assert.equal(parsed[1].url, "https://openalex.org/works/W1");
});

test("direct provider rotates to the next key after a quota failure", async () => {
  const settings = normalizeSettings(DEFAULT_SETTINGS);
  settings.providers.openai.apiKeys = ["KEY-ONE", "KEY-TWO"];
  const provider = resolveProvider(settings, "openai");
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (_url, options) => {
    calls.push(options.headers.Authorization);
    if (calls.length === 1) {
      return {
        ok: false,
        status: 429,
        text: async () => JSON.stringify({ error: { message: "quota exceeded" } }),
      };
    }
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ choices: [{ message: { content: "Second key answered" } }] }),
    };
  };
  try {
    const result = await postModelRequest(provider, messages);
    assert.equal(result.content, "Second key answered");
    assert.equal(result.keyCount, 2);
    assert.equal(result.keyIndex, 1);
    assert.deepEqual(calls, ["Bearer KEY-ONE", "Bearer KEY-TWO"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("server adapter forwards student keys only for an explicit BYOK test", () => {
  const provider = resolveProvider(normalizeSettings(DEFAULT_SETTINGS), "server");
  const request = buildModelRequest(provider, messages, {
    maxTokens: 40,
    studentKeyFallback: true,
    studentKeys: [{ providerId: "gemini", endpoint: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-test", keys: ["STUDENT-KEY"] }],
    forceStudentKeys: true,
  });
  assert.equal(request.url, "api/ai");
  assert.equal(request.body.studentKeyFallback, true);
  assert.equal(request.body.forceStudentKeys, true);
  assert.equal(request.body.studentKeys.length, 1);
  assert.deepEqual(request.body.studentKeys[0].keys, ["STUDENT-KEY"]);
});
