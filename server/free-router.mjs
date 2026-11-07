/**
 * $0 AI failover router for Vignan Vidyanikethan AI.
 *
 * Each provider may have multiple official free-tier API keys. Paste them into
 * one Render env var separated by commas/newlines, or use a plural *_KEYS
 * variable. A key that returns a quota/auth error is cooled down in memory so
 * the next request goes straight to the next key. Student-owned keys can be
 * appended after all server keys; they are never persisted by this module.
 *
 * Both STUDY_AI_* (backwards compatible) and VIGNAN_AI_* prefixes are
 * accepted. Secrets stay on the server; only provider IDs, key indexes and
 * short non-reversible key fingerprints appear in errors and health output.
 */

import { isQuotaFailure, KeyCooldowns, parseApiKeys, providerKeyVariants } from "../js/key-pool.js";

const DEFAULT_ORDER = ["gemini", "groq", "cloudflare", "openrouter", "mistral", "cohere", "arena", "primary"];
export const FREE_ROUTER_DEFAULT_ORDER = DEFAULT_ORDER;

function readEnv(env, name, fallback = "") {
  const value = env?.[`STUDY_AI_${name}`] ?? env?.[`VIGNAN_AI_${name}`] ?? env?.[name] ?? fallback;
  return String(value ?? "").trim();
}

/** Read one or more singular/plural env vars as a unique key list. */
function readKeys(env, ...names) {
  return parseApiKeys(names.map((name) => readEnv(env, name)).join("\n"));
}

function parseJsonEnv(value) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function safeAccountId(value) {
  return /^[a-zA-Z0-9_-]+$/.test(value) ? value : "";
}

function readArenaHeaders(env) {
  const headers = {};
  const authScheme = readEnv(env, "ARENA_AUTH_SCHEME");
  const arenaKey = readEnv(env, "ARENA_KEY") || readEnv(env, "ARENA_API_KEY") || readEnv(env, "ARENA_KEYS");
  if (authScheme && arenaKey) headers.Authorization = `${authScheme} ${arenaKey}`.trim();
  const anthropicVersion = readEnv(env, "ARENA_ANTHROPIC_VERSION");
  if (anthropicVersion) headers["anthropic-version"] = anthropicVersion;
  const beta = readEnv(env, "ARENA_BETA");
  if (beta) headers["anthropic-beta"] = beta;
  return headers;
}

function pathUrl(base, path, fullSuffix) {
  const value = String(base || "").trim();
  if (!value) return "";
  if (value.endsWith(fullSuffix)) return value;
  return `${value.replace(/\/$/, "")}${path}`;
}

function expandTemplate(providerId, template, keys, source = "server") {
  if (!keys.length) return [];
  const namespace = `${source}:${providerId}`;
  return providerKeyVariants(
    { id: providerId, ...template, apiKeys: keys, needsKey: true, keyNamespace: namespace },
    namespace,
  ).map((variant) => ({
    ...variant,
    apiKeys: [],
    id: providerId,
    providerId,
    source,
    label: keys.length > 1 ? `${template.label} · key ${variant.keyIndex + 1}/${keys.length}` : template.label,
  }));
}

/**
 * Build one upstream per API key for each configured provider.
 * `id` stays the provider ID so the UI sees "gemini"; `keyId` is unique for
 * cooldown bookkeeping. No key value is copied into a label or id.
 */
export function buildUpstreams(env = process.env) {
  const catalog = {};

  const primaryBase = readEnv(env, "AI_BASE_URL") || readEnv(env, "AI_ENDPOINT");
  const primaryModel = readEnv(env, "AI_MODEL");
  if (primaryBase && primaryModel) {
    catalog.primary = expandTemplate(
      "primary",
      {
        label: "Configured primary model",
        kind: readEnv(env, "AI_KIND", "openai") || "openai",
        endpoint: primaryBase,
        model: primaryModel,
        extraHeaders: parseJsonEnv(readEnv(env, "AI_EXTRA_HEADERS")),
      },
      readKeys(env, "AI_KEY", "AI_KEYS"),
    );
  }

  catalog.gemini = expandTemplate(
    "gemini",
    {
      label: "Gemini free tier",
      kind: "openai",
      endpoint: readEnv(env, "GEMINI_ENDPOINT", "https://generativelanguage.googleapis.com/v1beta/openai"),
      model: readEnv(env, "GEMINI_MODEL", "gemini-3.5-flash-lite"),
    },
    readKeys(env, "GEMINI_KEY", "GEMINI_KEYS"),
  );

  catalog.groq = expandTemplate(
    "groq",
    {
      label: "Groq free tier",
      kind: "openai",
      endpoint: readEnv(env, "GROQ_ENDPOINT", "https://api.groq.com/openai/v1"),
      model: readEnv(env, "GROQ_MODEL", "openai/gpt-oss-20b"),
    },
    readKeys(env, "GROQ_KEY", "GROQ_KEYS"),
  );

  const cfAccount = safeAccountId(readEnv(env, "CLOUDFLARE_ACCOUNT_ID") || readEnv(env, "ACCOUNT_ID"));
  catalog.cloudflare = cfAccount
    ? expandTemplate(
        "cloudflare",
        {
          label: "Cloudflare Workers AI free Neurons",
          kind: "openai",
          endpoint:
            readEnv(env, "CLOUDFLARE_ENDPOINT") ||
            `https://api.cloudflare.com/client/v4/accounts/${cfAccount}/ai/v1`,
          model: readEnv(env, "CLOUDFLARE_MODEL", "@cf/openai/gpt-oss-20b"),
        },
        readKeys(env, "CLOUDFLARE_TOKEN", "CLOUDFLARE_TOKENS"),
      )
    : [];

  catalog.openrouter = expandTemplate(
    "openrouter",
    {
      label: "OpenRouter free models",
      kind: "openai",
      endpoint: readEnv(env, "OPENROUTER_ENDPOINT", "https://openrouter.ai/api/v1"),
      model: readEnv(env, "OPENROUTER_MODEL", "openrouter/free"),
      extraHeaders: {
        "HTTP-Referer":
          readEnv(env, "OPENROUTER_REFERER") ||
          readEnv(env, "SITE_URL") ||
          "https://github.com/Techno-projects-cpu/Vignan-Vidyanikethan-AI",
        "X-Title": "Vignan Vidyanikethan AI",
      },
    },
    readKeys(env, "OPENROUTER_KEY", "OPENROUTER_KEYS"),
  );

  catalog.mistral = expandTemplate(
    "mistral",
    {
      label: "Mistral free mode",
      kind: "openai",
      endpoint: readEnv(env, "MISTRAL_ENDPOINT", "https://api.mistral.ai/v1"),
      model: readEnv(env, "MISTRAL_MODEL", "open-mistral-nemo"),
    },
    readKeys(env, "MISTRAL_KEY", "MISTRAL_KEYS"),
  );

  catalog.cohere = expandTemplate(
    "cohere",
    {
      label: "Cohere free trial",
      kind: "openai",
      endpoint: readEnv(env, "COHERE_ENDPOINT", "https://api.cohere.ai/compatibility/v1"),
      model: readEnv(env, "COHERE_MODEL", "command-r-08-2024"),
    },
    readKeys(env, "COHERE_KEY", "COHERE_KEYS"),
  );

  catalog.arena = expandTemplate(
    "arena",
    {
      label: "Arena AI workspace",
      kind: "arena",
      endpoint: readEnv(env, "ARENA_ENDPOINT", "https://api.arena.ai"),
      model: readEnv(env, "ARENA_MODEL", "coding-router-preview"),
      extraHeaders: readArenaHeaders(env),
    },
    readKeys(env, "ARENA_KEY", "ARENA_KEYS", "ARENA_API_KEY"),
  );

  const configuredOrder = readEnv(env, "FREE_ROUTER_ORDER");
  const order = configuredOrder
    ? configuredOrder.split(",").map((id) => id.trim().toLowerCase()).filter(Boolean)
    : DEFAULT_ORDER;
  const unique = [...new Set([...order, ...DEFAULT_ORDER])];
  const upstreams = unique.flatMap((id) => catalog[id] || []);
  const enabled = readEnv(env, "FREE_ROUTER", "true").toLowerCase() !== "false";
  return enabled ? upstreams : upstreams.slice(0, 1);
}

export function buildProviderRequest(upstream, messages, { temperature = 0.2, maxTokens = 900 } = {}) {
  const headers = { "Content-Type": "application/json", ...(upstream.extraHeaders || {}) };
  const apiKey = String(upstream.apiKey || "").trim();
  if (apiKey) {
    if (upstream.kind === "anthropic") {
      headers["x-api-key"] = apiKey;
      headers["anthropic-version"] = headers["anthropic-version"] || "2023-06-01";
    } else if (upstream.kind === "arena") {
      headers.Authorization = headers.Authorization || `Bearer ${apiKey}`;
      headers["anthropic-version"] = headers["anthropic-version"] || "2023-06-01";
    } else {
      headers.Authorization = `Bearer ${apiKey}`;
    }
  }
  const body = { model: upstream.model, messages, temperature, max_tokens: maxTokens };
  if (upstream.kind === "arena" || upstream.kind === "anthropic") {
    const system = messages
      .filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n\n");
    body.system = system;
    body.messages = messages
      .filter((message) => message.role !== "system")
      .map(({ role, content }) => ({ role: role === "assistant" ? "assistant" : "user", content }));
  }
  const url =
    upstream.kind === "arena"
      ? pathUrl(upstream.endpoint, "/v1/messages", "/v1/messages")
      : upstream.kind === "anthropic"
        ? pathUrl(upstream.endpoint, "/messages", "/messages")
        : pathUrl(upstream.endpoint, "/chat/completions", "/chat/completions");
  return { url, headers, body };
}

export function parseProviderResponse(provider, data) {
  if (!data) return "";
  if (typeof data === "string") return data.trim();
  if (provider?.kind === "arena" || provider?.kind === "anthropic") {
    return (data.content || [])
      .map((part) => (typeof part === "string" ? part : part?.text || ""))
      .join("")
      .trim();
  }
  if (typeof data.content === "string") return data.content.trim();
  if (typeof data.response === "string") return data.response.trim();
  if (typeof data.output_text === "string") return data.output_text.trim();
  const choice = data.choices?.[0];
  if (choice?.message?.content) return String(choice.message.content).trim();
  if (typeof choice?.text === "string") return choice.text.trim();
  if (Array.isArray(data.output)) {
    return data.output.map((entry) => entry.content?.map((part) => part.text || "").join("") || "").join("\n").trim();
  }
  return "";
}

export function errorMessage(status, data, fallback = `HTTP ${status}`, secrets = []) {
  const message =
    (typeof data?.error === "string" && data.error) ||
    (typeof data?.error?.message === "string" && data.error.message) ||
    (typeof data?.message === "string" && data.message) ||
    (typeof data?.msg === "string" && data.msg) ||
    (typeof data?.detail === "string" && data.detail) ||
    fallback;
  return redactSecrets(String(message), secrets).replace(/\s+/g, " ").trim().slice(0, 300);
}

function sensitiveValues(upstreams) {
  const values = new Set();
  const add = (value) => {
    const text = String(value || "").trim();
    if (text.length >= 4) values.add(text);
  };
  for (const upstream of upstreams) {
    add(upstream.apiKey);
    for (const [name, value] of Object.entries(upstream.extraHeaders || {})) {
      if (!/authorization|api[-_]?key|token|secret|cookie/i.test(name)) continue;
      add(value);
      add(String(value || "").replace(/^(?:Bearer|Basic)\s+/i, ""));
    }
    try {
      const url = new URL(upstream.endpoint);
      for (const [name, value] of url.searchParams) if (/key|token|secret/i.test(name)) add(value);
      if (url.password) add(decodeURIComponent(url.password));
    } catch { /* an invalid endpoint will be handled by the router */ }
  }
  return [...values].sort((a, b) => b.length - a.length);
}

function redactSecrets(value, secrets) {
  if (typeof value === "string") {
    return secrets.reduce((text, secret) => text.split(secret).join("[redacted]"), value);
  }
  if (Array.isArray(value)) return value.map((item) => redactSecrets(item, secrets));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [redactSecrets(key, secrets), redactSecrets(item, secrets)]));
  }
  return value;
}

const defaultCooldowns = new KeyCooldowns({ cooldownMs: 60_000 });

export function getKeyCooldownStatus() {
  return defaultCooldowns.status();
}

export function resetKeyCooldownsForTests() {
  defaultCooldowns.clear();
}

/**
 * Try each active server key, then any student keys appended by /api/ai.
 * A quota failure cools that key down; the next request skips it entirely.
 */
export async function callFreeRouter({
  upstreams = [],
  messages = [],
  temperature = 0.2,
  maxTokens = 900,
  timeoutMs = 45_000,
  fetchImpl = fetch,
  build = buildProviderRequest,
  parse = parseProviderResponse,
  cooldownMs = 60_000,
  cooldowns = defaultCooldowns,
  now = () => Date.now(),
} = {}) {
  const pool = Array.isArray(upstreams) ? upstreams.filter(Boolean) : [];
  if (!pool.length) {
    const error = new Error("No AI keys are configured on this server.");
    error.code = "NO_AI_KEYS";
    error.needStudentKeys = true;
    throw error;
  }
  if (!Array.isArray(messages) || !messages.length) throw new Error("No prompt messages were provided.");

  const active = cooldowns.select(pool, now());
  const secrets = sensitiveValues(pool);
  const errors = [];
  const exhaustedKeys = new Set();
  let attempts = 0;

  for (const upstream of active) {
    attempts += 1;
    const label = upstream.keyId || upstream.id;
    try {
      const built = build(upstream, messages, { temperature, maxTokens });
      if (!built.url) throw new Error("Upstream has no endpoint.");
      const response = await fetchImpl(built.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...built.headers },
        body: JSON.stringify(built.body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const raw = await response.text();
      let data;
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { content: raw };
      }
      if (!response.ok) {
        const message = errorMessage(response.status, data, `HTTP ${response.status}`, secrets);
        if (isQuotaFailure(response.status, message) && upstream.keyId) {
          cooldowns.mark(upstream.keyId, cooldownMs, now());
          exhaustedKeys.add(upstream.keyId);
        }
        errors.push(redactSecrets(`${label}: ${message}`, secrets));
        continue;
      }
      const content = redactSecrets(String(parse(upstream, data) || "").trim(), secrets);
      if (!content) {
        errors.push(`${label}: empty response`);
        continue;
      }
      return {
        content,
        provider: upstream.id,
        providerLabel: upstream.label,
        model: redactSecrets(data.model || upstream.model, secrets),
        usage: redactSecrets(data.usage || null, secrets),
        attempts,
        fallbackUsed: attempts > 1,
        errors,
        keyIndex: upstream.keyIndex || 0,
        keyCount: upstream.keyCount || 0,
        keySource: upstream.source || "server",
        studentKeyUsed: upstream.source === "student",
        freeRouter: true,
      };
    } catch (error) {
      const message = error?.message || String(error);
      if (isQuotaFailure(0, message) && upstream.keyId) {
        cooldowns.mark(upstream.keyId, cooldownMs, now());
        exhaustedKeys.add(upstream.keyId);
      }
      errors.push(`${label}: ${redactSecrets(message, secrets).slice(0, 200)}`);
    }
  }

  const last = errors.at(-1) || "unknown error";
  const hint = exhaustedKeys.size ? " Add a student key in Settings or keep using offline answers." : "";
  const failure = new Error(`All AI providers failed. Last error: ${last}.${hint}`);
  failure.code = exhaustedKeys.size ? "ALL_KEYS_EXHAUSTED" : "AI_UNAVAILABLE";
  failure.needStudentKeys = Boolean(exhaustedKeys.size);
  failure.attempts = attempts;
  failure.errors = errors;
  failure.exhaustedKeys = [...exhaustedKeys];
  throw failure;
}
