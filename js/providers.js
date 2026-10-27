/**
 * Provider adapters for existing AI services.
 *
 * Vignan Vidyanikethan AI is an orchestrator, not a trained model. It can call any of
 * these providers for answers, quiz writing, grading or verification. The
 * recommended production path is the local server proxy: it keeps API keys off
 * student devices and avoids browser CORS limits. Direct browser calls are
 * supported for providers/endpoints that allow them.
 */

export const PROVIDERS = {
  server: {
    id: "server",
    label: "Vignan free AI router",
    kind: "server",
    endpoint: "api/ai",
    model: "",
    needsKey: false,
    private: true,
    description: "Uses /api/ai on this site's own server. The server tries configured free-tier providers and keeps their keys private.",
  },
  webllm: {
    id: "webllm",
    label: "Local open model (WebLLM)",
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
    label: "Ollama (on-device, offline)",
    kind: "ollama",
    endpoint: "http://localhost:11434",
    model: "llama3.2:1b",
    needsKey: false,
    private: true,
    description: "Open-weight Meta Llama 3.2 running on the student's laptop. No internet required after `ollama pull llama3.2:1b`.",
  },
  lmstudio: {
    id: "lmstudio",
    label: "LM Studio (local server)",
    kind: "openai",
    endpoint: "http://localhost:1234/v1",
    model: "local-model",
    needsKey: false,
    private: true,
    description: "OpenAI-compatible local server. Good for offline desktop builds.",
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    kind: "openai",
    endpoint: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    needsKey: true,
    description: "Example model shown; enter any model your account can access.",
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter (free models)",
    kind: "openai",
    endpoint: "https://openrouter.ai/api/v1",
    model: "openrouter/free",
    needsKey: true,
    extraHeaders: { "HTTP-Referer": "https://github.com/Techno-projects-cpu/Vignan-Vidyanikethan-AI", "X-Title": "Vignan Vidyanikethan AI" },
    description: "openrouter/free picks from free models. Free tier is rate-limited and may train on prompts; check the model policy.",
  },
  groq: {
    id: "groq",
    label: "Groq (free tier)",
    kind: "openai",
    endpoint: "https://api.groq.com/openai/v1",
    model: "openai/gpt-oss-20b",
    needsKey: true,
    description: "Fast open-weight models. Free tier is rate-limited; model availability changes.",
  },
  gemini: {
    id: "gemini",
    label: "Google Gemini (free tier)",
    kind: "openai",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-3.5-flash-lite",
    needsKey: true,
    description: "Free-of-charge Flash/Flash-Lite models via Google's OpenAI-compatible endpoint. Limits are shown per project in AI Studio.",
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic Claude",
    kind: "anthropic",
    endpoint: "https://api.anthropic.com/v1",
    model: "claude-3-5-haiku-latest",
    needsKey: true,
    description: "Native Messages API adapter.",
  },
  arena: {
    id: "arena",
    label: "Arena AI (workspace API)",
    kind: "arena",
    endpoint: "https://api.arena.ai",
    model: "coding-router-preview",
    needsKey: true,
    description:
      "Anthropic-compatible Arena gateway. Free-router keys are for Claude Code/Desktop only; a workspace API key is required for a website.",
  },
  cloudflare: {
    id: "cloudflare",
    label: "Cloudflare Workers AI",
    kind: "openai",
    endpoint: "https://api.cloudflare.com/client/v4/accounts/YOUR_ACCOUNT_ID/ai/v1",
    model: "@cf/openai/gpt-oss-20b",
    needsKey: true,
    description: "10,000 free Neurons/day. Replace YOUR_ACCOUNT_ID in the endpoint and add a Cloudflare API token.",
  },
  mistral: {
    id: "mistral",
    label: "Mistral AI (free mode)",
    kind: "openai",
    endpoint: "https://api.mistral.ai/v1",
    model: "open-mistral-nemo",
    needsKey: true,
    description: "Free mode needs no card. Limits and model access are shown in your Mistral admin panel; open-mistral-nemo is a conservative open-weight default.",
  },
  cohere: {
    id: "cohere",
    label: "Cohere (free trial key)",
    kind: "openai",
    endpoint: "https://api.cohere.ai/compatibility/v1",
    model: "command-r-08-2024",
    needsKey: true,
    description: "Cohere's OpenAI-compatible /compatibility/v1 endpoint. Trial keys are rate-limited and intended for evaluation, not production.",
  },
  deepseek: {
    id: "deepseek",
    label: "DeepSeek",
    kind: "openai",
    endpoint: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    needsKey: true,
  },
  together: {
    id: "together",
    label: "Together AI",
    kind: "openai",
    endpoint: "https://api.together.xyz/v1",
    model: "meta-llama/Llama-3.1-8B-Instruct-Turbo",
    needsKey: true,
  },
  custom: {
    id: "custom",
    label: "Custom OpenAI-compatible endpoint",
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
  };
}

export function resolveProvider(settings = {}, providerId = "offline") {
  if (!providerId || providerId === "offline" || !PROVIDERS[providerId]) return null;
  const definition = PROVIDERS[providerId];
  const config = settings.providers?.[providerId] || {};
  return {
    ...definition,
    endpoint: String(config.endpoint || definition.endpoint || "").trim(),
    model: String(config.model || definition.model || "").trim(),
    apiKey: String(config.apiKey || "").trim(),
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
export function buildModelRequest(provider, messages = [], { temperature = 0.2, maxTokens = 900 } = {}) {
  if (!provider) throw new Error("No AI provider selected.");
  const { kind, endpoint, model, apiKey, extraHeaders = {} } = provider;
  if (kind === "webllm") {
    throw new Error("WebLLM runs locally in a Web Worker; use generateWithLocalAI() instead of an HTTP request.");
  }
  if (kind === "server") {
    return {
      url: pathUrl(endpoint || "api/ai", "", "api/ai"),
      headers: {},
      body: { messages, temperature, max_tokens: maxTokens },
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

export async function postModelRequest(provider, messages, options = {}) {
  const { url, headers, body } = buildModelRequest(provider, messages, options);
  if (!url) throw new Error("The selected provider has no endpoint configured.");
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: options.signal,
  });
  const raw = await response.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { content: raw };
  }
  if (!response.ok) {
    const message =
      data.error?.message || data.error || data.message || data.detail || `Model request failed (${response.status})`;
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }
  return { data, content: parseProviderResponse(provider, data), usage: data.usage || null };
}
