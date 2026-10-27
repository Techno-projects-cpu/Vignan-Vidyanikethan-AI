import test from "node:test";
import assert from "node:assert/strict";
import { buildUpstreams, callFreeRouter, FREE_ROUTER_DEFAULT_ORDER } from "../server/free-router.mjs";

function response(ok, status, data) {
  return {
    ok,
    status,
    text: async () => (typeof data === "string" ? data : JSON.stringify(data)),
  };
}

test("free router builds providers only from configured keys", () => {
  const upstreams = buildUpstreams({
    STUDY_AI_GEMINI_KEY: "gemini-key",
    STUDY_AI_GROQ_KEY: "groq-key",
    VIGNAN_AI_CLOUDFLARE_ACCOUNT_ID: "abc123",
    STUDY_AI_CLOUDFLARE_TOKEN: "cf-token",
    STUDY_AI_OPENROUTER_KEY: "or-key",
    STUDY_AI_MISTRAL_KEY: "mistral-key",
    STUDY_AI_COHERE_KEY: "cohere-key",
    STUDY_AI_ARENA_KEY: "arena-workspace-key",
  });
  assert.deepEqual(
    upstreams.map((item) => item.id),
    ["gemini", "groq", "cloudflare", "openrouter", "mistral", "cohere", "arena"],
  );
  assert.equal(upstreams[0].model, "gemini-3.5-flash-lite");
  assert.equal(upstreams[1].model, "openai/gpt-oss-20b");
  assert.match(upstreams[2].endpoint, /accounts\/abc123\/ai\/v1/);
  assert.equal(upstreams[3].model, "openrouter/free");
  assert.equal(upstreams[4].model, "open-mistral-nemo");
  assert.equal(upstreams[5].model, "command-r-08-2024");
  assert.equal(upstreams[6].kind, "arena");
  assert.equal(upstreams[6].endpoint, "https://api.arena.ai");
  assert.deepEqual(FREE_ROUTER_DEFAULT_ORDER, [
    "gemini", "groq", "cloudflare", "openrouter", "mistral", "cohere", "arena", "primary",
  ]);
});

test("free router honours custom order, aliases and disable flag", () => {
  const upstreams = buildUpstreams({
    VIGNAN_AI_GEMINI_KEY: "g",
    VIGNAN_AI_GROQ_KEY: "q",
    VIGNAN_AI_FREE_ROUTER_ORDER: "groq,gemini",
    VIGNAN_AI_FREE_ROUTER: "false",
  });
  assert.deepEqual(upstreams.map((item) => item.id), ["groq"]);
});

test("primary upstream supports Arena kind and extra headers", () => {
  const upstreams = buildUpstreams({
    STUDY_AI_AI_BASE_URL: "https://api.arena.ai",
    STUDY_AI_AI_MODEL: "coding-router-preview",
    STUDY_AI_AI_KIND: "arena",
    STUDY_AI_AI_KEY: "workspace-key",
    STUDY_AI_AI_EXTRA_HEADERS: '{"X-School":"Vignan"}',
  });
  assert.equal(upstreams.length, 1);
  assert.equal(upstreams[0].kind, "arena");
  assert.equal(upstreams[0].apiKey, "workspace-key");
  assert.equal(upstreams[0].extraHeaders["X-School"], "Vignan");
});

test("callFreeRouter falls through rate limits and empty replies", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (calls.length === 1) return response(false, 429, { error: { message: "rate limited" } });
    if (calls.length === 2) return response(true, 200, { choices: [] });
    return response(true, 200, { choices: [{ message: { content: "Grounded answer [1]" } }], model: "fallback-model" });
  };
  const upstreams = [
    { id: "a", label: "A", kind: "openai", endpoint: "https://a.example/v1", model: "a", apiKey: "" },
    { id: "b", label: "B", kind: "openai", endpoint: "https://b.example/v1", model: "b", apiKey: "" },
    { id: "c", label: "C", kind: "openai", endpoint: "https://c.example/v1", model: "c", apiKey: "" },
  ];
  const result = await callFreeRouter({
    upstreams,
    messages: [{ role: "user", content: "Why?" }],
    fetchImpl,
  });
  assert.equal(result.content, "Grounded answer [1]");
  assert.equal(result.provider, "c");
  assert.equal(result.model, "fallback-model");
  assert.equal(result.attempts, 3);
  assert.equal(result.fallbackUsed, true);
  assert.equal(calls.length, 3);
  assert.match(result.errors[0], /rate limited/);
});

test("callFreeRouter reports a helpful error when every provider fails", async () => {
  const fetchImpl = async () => response(false, 503, { error: "unavailable" });
  const upstreams = [
    { id: "a", label: "A", kind: "openai", endpoint: "https://a.example/v1", model: "a", apiKey: "" },
  ];
  await assert.rejects(
    callFreeRouter({ upstreams, messages: [{ role: "user", content: "Hi" }], fetchImpl }),
    /All AI providers failed.*unavailable/,
  );
});
