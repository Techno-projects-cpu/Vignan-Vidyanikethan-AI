/**
 * Provider adapters for existing AI services.
 *
 * Vignan Vidyanikethan AI is an orchestrator, not a trained model. It can call any of
 * these providers for answers, quiz writing, grading or verification. The
 * recommended production path is the local server proxy: it keeps API keys off
 * student devices and avoids browser CORS limits. Direct browser calls are
 * supported for providers/endpoints that allow them.
 *
 * A provider config may hold multiple keys (comma/newline separated). Requests
 * rotate to the next key on quota/auth/network failures.
 */

import { isQuotaFailure, parseApiKeys, providerKeyVariants } from "./key-pool.js?v=12";

export const PROVIDERS = {
  server: {
    id: "server",
    label: "Atlas",
    nickname: "Atlas",
    specialty: "Free cloud router",
    kind: "server",
    endpoint: "api/ai",
    model: "",
    needsKey: false,
    private: true,
    description: "Uses /api/ai on this site's own server. The server tries configured free-tier providers and keeps their keys private.",
  },
  webllm: {
    id: "webllm",
    label: "Nova",
    nickname: "Nova",
    specialty: "Private local reasoning",
    kind: "webllm",
    endpoint: "local://webllm",
    model: "SmolLM2-360M-Instruct-q4f16_1-MLC",
    needsKey: false,
    private: true,
    description:
      "Real open-weight AI running in this browser via WebGPU. Choose Meta Llama 3.2 1B, SmolLM2 or Qwen2.5. Download once, then work offline with Vignan's own grounding rules.",
  },
  ollama: {
    id: "ollama",
    label: "Echo",
    nickname: "Echo",
    specialty: "Laptop open model",
    kind: "ollama",
    endpoint: "http://localhost:11434",
    model: "llama3.2:1b",
    needsKey: false,
    private: true,
    description: "Open-weight Meta Llama 3.2 running on the student's laptop. No internet required after `ollama pull llama3.2:1b`.",
  },
  lmstudio: {
    id: "lmstudio",
    label: "Haven",
    nickname: "Haven",
    specialty: "Local server model",
    kind: "openai",
    endpoint: "http://localhost:1234/v1",
    model: "local-model",
    needsKey: false,
    private: true,
    description: "OpenAI-compatible local server. Good for offline desktop builds.",
  },
  openai: {
    id: "openai",
    label: "Orbit",
    nickname: "Orbit",
    specialty: "General purpose",
    kind: "openai",
    endpoint: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    needsKey: true,
    description: "Example model shown; enter any model your account can access.",
  },
  openrouter: {
    id: "openrouter",
    label: "Sage",
    nickname: "Sage",
    specialty: "Wide model selection",
    kind: "openai",
    endpoint: "https://openrouter.ai/api/v1",
    model: "openrouter/free",
    needsKey: true,
    extraHeaders: { "HTTP-Referer": "https://github.com/Techno-projects-cpu/Vignan-Vidyanikethan-AI", "X-Title": "Vignan Vidyanikethan AI" },
    description: "openrouter/free picks from free models. Free tier is rate-limited and may train on prompts; check the model policy.",
  },
  groq: {
    id: "groq",
    label: "Dash",
    nickname: "Dash",
    specialty: "Ultra-fast cloud replies",
    kind: "openai",
    endpoint: "https://api.groq.com/openai/v1",
    model: "openai/gpt-oss-20b",
    needsKey: true,
    description: "Fast open-weight models. Free tier is rate-limited; model availability changes.",
  },
  gemini: {
    id: "gemini",
    label: "Prism",
    nickname: "Prism",
    specialty: "Balanced everyday answers",
    kind: "openai",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-3.5-flash-lite",
    needsKey: true,
    description: "Free-of-charge Flash/Flash-Lite models via Google's OpenAI-compatible endpoint. Limits are shown per project in AI Studio.",
  },
  anthropic: {
    id: "anthropic",
    label: "Quill",
    nickname: "Quill",
    specialty: "Long-form reasoning",
    kind: "anthropic",
    endpoint: "https://api.anthropic.com/v1",
    model: "claude-3-5-haiku-latest",
    needsKey: true,
    description: "Native Messages API adapter.",
  },
  arena: {
    id: "arena",
    label: "Vector",
    nickname: "Vector",
    specialty: "Workspace reasoning",
    kind: "arena",
    endpoint: "https://api.arena.ai",
    model: "coding-router-preview",
    needsKey: true,
    description:
      "Anthropic-compatible Arena gateway. Free-router keys are for Claude Code/Desktop only; a workspace API key is required for a website.",
  },
  cloudflare: {
    id: "cloudflare",
    label: "Aero",
    nickname: "Aero",
    specialty: "Edge inference",
    kind: "openai",
    endpoint: "https://api.cloudflare.com/client/v4/accounts/YOUR_ACCOUNT_ID/ai/v1",
    model: "@cf/openai/gpt-oss-20b",
    needsKey: true,
    description: "10,000 free Neurons/day. Replace YOUR_ACCOUNT_ID in the endpoint and add a Cloudflare API token.",
  },
  mistral: {
    id: "mistral",
    label: "Mica",
    nickname: "Mica",
    specialty: "Lightweight writing",
    kind: "openai",
    endpoint: "https://api.mistral.ai/v1",
    model: "open-mistral-nemo",
    needsKey: true,
    description: "Free mode needs no card. Limits and model access are shown in your Mistral admin panel; open-mistral-nemo is a conservative open-weight default.",
  },
  cohere: {
    id: "cohere",
    label: "Scout",
    nickname: "Scout",
    specialty: "Retrieval and citations",
    kind: "openai",
    endpoint: "https://api.cohere.ai/compatibility/v1",
    model: "command-r-08-2024",
    needsKey: true,
    description: "Cohere's OpenAI-compatible /compatibility/v1 endpoint. Trial keys are rate-limited and intended for evaluation, not production.",
  },
  deepseek: {
    id: "deepseek",
    label: "Axiom",
    nickname: "Axiom",
    specialty: "Maths and code",
    kind: "openai",
    endpoint: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    needsKey: true,
  },
  together: {
    id: "together",
    label: "Pulse",
    nickname: "Pulse",
    specialty: "Open-model cloud",
    kind: "openai",
    endpoint: "https://api.together.xyz/v1",
    model: "meta-llama/Llama-3.1-8B-Instruct-Turbo",
    needsKey: true,
  },
  custom: {
    id: "custom",
    label: "Any",
    nickname: "Any",
    specialty: "Your own endpoint",
    kind: "openai",
    endpoint: "",
    model: "",
    needsKey: false,
    description: "Any endpoint that accepts /chat/completions messages.",
  },
};

export const PROVIDER_IDS = Object.keys(PROVIDERS);

export function providerList() {
  return PROVIDER_IDS.map((id) => ({ id, ...PROVIDERS[id] }));
}

export function defaultProviderConfig(providerId) {
  const provider = PROVIDERS[providerId] || PROVIDERS.custom;
  return {
    endpoint: provider.endpoint,
    model: provider.model,
    apiKey: "",
    apiKeys: [],
  };
}

export function resolveProvider(settings = {}, providerId = "offline") {
  if (!providerId || providerId === "offline" || !PROVIDERS[providerId]) return null;
  const definition = PROVIDERS[providerId];
  const config = settings.providers?.[providerId] || {};
  const apiKeys = parseApiKeys([config.apiKeys, config.apiKey].join("\n"));
  return {
    ...definition,
    endpoint: String(config.endpoint || definition.endpoint || "").trim(),
    model: String(config.model || definition.model || "").trim(),
    apiKey: apiKeys[0] || "",
    apiKeys,
  };
}

function pathUrl(base, path, fullSuffix) {
  const value = String(base || "").trim();
  if (!value) return "";
  if (value.endsWith(fullSuffix)) return value;
  return `${value.replace(/\/$/, "")}${path}`;
}

function splitSystem(messages = []) {
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
  return { system, messages: messages.filter((message) => message.role !== "system") };
}

/** Build a provider-specific HTTP request without exposing secrets in URLs. */
export function buildModelRequest(provider, messages = [], options = {}) {
  if (!provider) throw new Error("No AI provider selected.");
  const { temperature = 0.2, maxTokens = 900 } = options;
  const { kind, endpoint, model, apiKey, extraHeaders = {} } = provider;
  if (kind === "webllm") {
    throw new Error("WebLLM runs locally in a Web Worker; use generateWithLocalAI() instead of an HTTP request.");
  }
  if (kind === "server") {
    const studentKeys = Array.isArray(options.studentKeys) ? options.studentKeys.filter((entry) => entry?.keys?.length) : [];
    return {
      url: pathUrl(endpoint || "api/ai", "", "api/ai"),
      headers: {},
      body: {
        messages,
        temperature,
        max_tokens: maxTokens,
        ...(options.studentKeyFallback ? { studentKeyFallback: true } : {}),
        ...(options.forceStudentKeys ? { forceStudentKeys: true } : {}),
        ...(studentKeys.length ? { studentKeys } : {}),
      },
    };
  }
  if (kind === "ollama") {
    if (!model) throw new Error("Add an Ollama model name in Settings.");
    return {
      url: pathUrl(endpoint, "/api/chat", "/api/chat"),
      headers: {},
      body: {
        model,
        messages,
        stream: false,
        options: { temperature, num_predict: maxTokens },
      },
    };
  }
  if (kind === "anthropic") {
    if (!endpoint) throw new Error("Add an Anthropic endpoint in Settings.");
    if (!model) throw new Error("Add an Anthropic model name in Settings.");
    const { system, messages: chatMessages } = splitSystem(messages);
    return {
      url: pathUrl(endpoint, "/messages", "/messages"),
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        ...extraHeaders,
      },
      body: {
        model,
        max_tokens: maxTokens,
        temperature,
        system,
        messages: chatMessages.map(({ role, content }) => ({
          role: role === "assistant" ? "assistant" : "user",
          content,
        })),
      },
    };
  }
  if (kind === "arena") {
    if (!endpoint) throw new Error("Add an Arena AI endpoint in Settings.");
    if (!model) throw new Error("Add an Arena AI model name in Settings.");
    const { system, messages: chatMessages } = splitSystem(messages);
    return {
      url: pathUrl(endpoint, "/v1/messages", "/v1/messages"),
      headers: {
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        "anthropic-version": "2023-06-01",
        ...extraHeaders,
      },
      body: {
        model,
        max_tokens: maxTokens,
        temperature,
        system,
        messages: chatMessages.map(({ role, content }) => ({
          role: role === "assistant" ? "assistant" : "user",
          content,
        })),
      },
    };
  }
  if (!endpoint) throw new Error("Add a model endpoint in Settings.");
  if (!model) throw new Error("Add a model name in Settings.");
  return {
    url: pathUrl(endpoint, "/chat/completions", "/chat/completions"),
    headers: {
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      ...extraHeaders,
    },
    body: {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    },
  };
}

export function parseProviderResponse(provider, data) {
  if (!data) return "";
  if (typeof data === "string") return data;
  if (provider?.kind === "anthropic" || provider?.kind === "arena") {
    return (data.content || [])
      .map((part) => (typeof part === "string" ? part : part?.text || ""))
      .join("")
      .trim();
  }
  if (provider?.kind === "ollama") {
    return String(data.message?.content || data.response || data.content || "").trim();
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

function modelErrorMessage(data, status) {
  const value = data?.error?.message || data?.error || data?.message || data?.detail || `Model request failed (${status})`;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value).slice(0, 400);
  } catch {
    return `Model request failed (${status})`;
  }
}

function modelRequestError(data, status) {
  const error = new Error(modelErrorMessage(data, status));
  error.status = status;
  error.code = data?.code || (isQuotaFailure(status, error.message) ? "ALL_KEYS_EXHAUSTED" : "MODEL_REQUEST_FAILED");
  error.needStudentKeys = Boolean(data?.needStudentKeys) || error.code === "ALL_KEYS_EXHAUSTED";
  return error;
}

/** Try each configured key in order; quota/auth/network failures roll over. */
export async function postModelRequest(provider, messages, options = {}) {
  const variants = providerKeyVariants(provider);
  if (!variants.length) throw new Error("Add at least one API key for this provider in Settings.");
  let lastError = null;
  let quotaFailures = 0;

  for (const variant of variants) {
    const { url, headers, body } = buildModelRequest(variant, messages, options);
    if (!url) {
      lastError = new Error("The selected provider has no endpoint configured.");
      continue;
    }
    let response;
    let raw;
    let data = {};
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
        signal: options.signal,
      });
      raw = await response.text();
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { content: raw };
      }
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      lastError = new Error(`Could not reach ${provider.label || "the provider"}: ${error.message}`);
      lastError.code = "PROVIDER_UNREACHABLE";
      continue;
    }
    if (!response.ok) {
      lastError = modelRequestError(data, response.status);
      if (isQuotaFailure(response.status, lastError.message)) quotaFailures += 1;
      if (variants.length > 1) continue;
      throw lastError;
    }
    const content = parseProviderResponse(variant, data);
    if (!content) {
      lastError = new Error("The model returned an empty answer.");
      lastError.code = "EMPTY_MODEL_RESPONSE";
      continue;
    }
    return {
      data,
      content,
      usage: data.usage || null,
      keyIndex: variant.keyIndex,
      keyCount: variant.keyCount,
      keyId: variant.keyId,
      keySource: variant.source || "local",
    };
  }

  if (lastError) {
    if (variants.length > 1 && quotaFailures >= variants.length) {
      lastError.code = "ALL_KEYS_EXHAUSTED";
      lastError.needStudentKeys = true;
    }
    throw lastError;
  }
  throw new Error("No usable API key or endpoint is configured for this provider.");
}
