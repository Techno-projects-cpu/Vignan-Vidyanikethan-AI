/**
 * Zero-budget AI router for Vignan Vidyanikethan AI.
 *
 * It builds a list of upstream providers from environment variables and tries
 * them in order. A 429, 5xx, network error or empty response moves to the next
 * provider; the browser app still has its offline extractive engine as the
 * final fallback. Keys stay on the server and are never sent to students.
 *
 * Both STUDY_AI_* (backwards compatible) and VIGNAN_AI_* (new brand) prefixes
 * are accepted. Nothing here is Arena.ai-specific: Arena is one optional
 * upstream among several free-tier providers.
 */

import { buildModelRequest, parseProviderResponse } from "../js/providers.js";

const DEFAULT_ORDER = ["gemini", "groq", "cloudflare", "openrouter", "mistral", "cohere", "arena", "primary"];

function readEnv(env, name, fallback = "") {
  const value = env[`STUDY_AI_${name}`] ?? env[`VIGNAN_AI_${name}`] ?? fallback;
  return String(value ?? "").trim();
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

/**
 * Build the ordered list of configured upstreams.
 * @param {Record<string, string|undefined>} env
 * @returns {Array<{id:string,label:string,kind:string,endpoint:string,model:string,apiKey:string,extraHeaders?:object}>}
 */
export function buildUpstreams(env = process.env) {
  const catalog = {};
  const primaryBase = readEnv(env, "AI_BASE_URL");
  const primaryModel = readEnv(env, "AI_MODEL");
  if (primaryBase && primaryModel) {
    catalog.primary = {
      id: "primary",
      label: "Configured primary model",
      kind: readEnv(env, "AI_KIND", "openai") || "openai",
      endpoint: primaryBase,
      model: primaryModel,
      apiKey: readEnv(env, "AI_KEY"),
      extraHeaders: parseJsonEnv(readEnv(env, "AI_EXTRA_HEADERS")),
    };
  }

  const geminiKey = readEnv(env, "GEMINI_KEY");
  if (geminiKey) {
    catalog.gemini = {
      id: "gemini",
      label: "Gemini free tier",
      kind: "openai",
      endpoint: readEnv(env, "GEMINI_ENDPOINT", "https://generativelanguage.googleapis.com/v1beta/openai"),
      model: readEnv(env, "GEMINI_MODEL", "gemini-3.5-flash-lite"),
      apiKey: geminiKey,
    };
  }

  const groqKey = readEnv(env, "GROQ_KEY");
  if (groqKey) {
    catalog.groq = {
      id: "groq",
      label: "Groq free tier",
      kind: "openai",
      endpoint: readEnv(env, "GROQ_ENDPOINT", "https://api.groq.com/openai/v1"),
      model: readEnv(env, "GROQ_MODEL", "openai/gpt-oss-20b"),
      apiKey: groqKey,
    };
  }

  const cfAccount = safeAccountId(readEnv(env, "CLOUDFLARE_ACCOUNT_ID"));
  const cfToken = readEnv(env, "CLOUDFLARE_TOKEN");
  if (cfAccount && cfToken) {
    catalog.cloudflare = {
      id: "cloudflare",
      label: "Cloudflare Workers AI free Neurons",
      kind: "openai",
      endpoint: `https://api.cloudflare.com/client/v4/accounts/${cfAccount}/ai/v1`,
      model: readEnv(env, "CLOUDFLARE_MODEL", "@cf/openai/gpt-oss-20b"),
      apiKey: cfToken,
    };
  }

  const openrouterKey = readEnv(env, "OPENROUTER_KEY");
  if (openrouterKey) {
    catalog.openrouter = {
      id: "openrouter",
      label: "OpenRouter free models",
      kind: "openai",
      endpoint: readEnv(env, "OPENROUTER_ENDPOINT", "https://openrouter.ai/api/v1"),
      model: readEnv(env, "OPENROUTER_MODEL", "openrouter/free"),
      apiKey: openrouterKey,
      extraHeaders: {
        "HTTP-Referer": readEnv(env, "OPENROUTER_REFERER", "https://github.com/Techno-projects-cpu/Vignan-Vidyanikethan-AI"),
        "X-Title": "Vignan Vidyanikethan AI",
      },
    };
  }

  const mistralKey = readEnv(env, "MISTRAL_KEY");
  if (mistralKey) {
    catalog.mistral = {
      id: "mistral",
      label: "Mistral free mode",
      kind: "openai",
      endpoint: readEnv(env, "MISTRAL_ENDPOINT", "https://api.mistral.ai/v1"),
      model: readEnv(env, "MISTRAL_MODEL", "open-mistral-nemo"),
      apiKey: mistralKey,
    };
  }

  const cohereKey = readEnv(env, "COHERE_KEY");
  if (cohereKey) {
    catalog.cohere = {
      id: "cohere",
      label: "Cohere free trial",
      kind: "openai",
      endpoint: readEnv(env, "COHERE_ENDPOINT", "https://api.cohere.ai/compatibility/v1"),
      model: readEnv(env, "COHERE_MODEL", "command-r-08-2024"),
      apiKey: cohereKey,
    };
  }

  const arenaKey = readEnv(env, "ARENA_KEY");
  if (arenaKey) {
    catalog.arena = {
      id: "arena",
      label: "Arena AI workspace",
      kind: "arena",
      endpoint: readEnv(env, "ARENA_ENDPOINT", "https://api.arena.ai"),
      model: readEnv(env, "ARENA_MODEL", "coding-router-preview"),
      apiKey: arenaKey,
    };
  }

  const configuredOrder = readEnv(env, "FREE_ROUTER_ORDER");
  const order = configuredOrder
    ? configuredOrder.split(",").map((id) => id.trim().toLowerCase()).filter(Boolean)
    : DEFAULT_ORDER;
  const unique = [...new Set([...order, ...DEFAULT_ORDER])];
  const upstreams = unique.map((id) => catalog[id]).filter(Boolean);
  const enabled = readEnv(env, "FREE_ROUTER", "true").toLowerCase() !== "false";
  return enabled ? upstreams : upstreams.slice(0, 1);
}

function errorMessage(data, fallback) {
  const message =
    (typeof data?.error === "string" && data.error) ||
    (typeof data?.error?.message === "string" && data.error.message) ||
    (typeof data?.message === "string" && data.message) ||
    (typeof data?.msg === "string" && data.msg) ||
    fallback;
  return String(message).replace(/\s+/g, " ").trim().slice(0, 300);
}

/**
 * Try each upstream until one returns non-empty content.
 * Returns the chosen provider metadata so the UI can be transparent.
 */
export async function callFreeRouter({
  upstreams = [],
  messages = [],
  temperature = 0.2,
  maxTokens = 900,
  timeoutMs = 45_000,
  fetchImpl = fetch,
  build = buildModelRequest,
  parse = parseProviderResponse,
} = {}) {
  if (!upstreams.length) throw new Error("No AI providers are configured on this server.");
  const errors = [];
  for (let index = 0; index < upstreams.length; index += 1) {
    const upstream = upstreams[index];
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
        errors.push(`${upstream.id}: ${errorMessage(data, `HTTP ${response.status}`)}`);
        continue;
      }
      const content = String(parse(upstream, data) || "").trim();
      if (!content) {
        errors.push(`${upstream.id}: empty response`);
        continue;
      }
      return {
        content,
        provider: upstream.id,
        providerLabel: upstream.label,
        model: data.model || upstream.model,
        usage: data.usage || null,
        attempts: index + 1,
        fallbackUsed: index > 0,
        errors,
      };
    } catch (error) {
      errors.push(`${upstream.id}: ${error?.message || String(error)}`);
    }
  }
  const last = errors.at(-1) || "unknown error";
  throw new Error(`All AI providers failed. Last error: ${last}`);
}

export const FREE_ROUTER_DEFAULT_ORDER = DEFAULT_ORDER;
