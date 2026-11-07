/**
 * Optional Supabase Edge Function for Vignan Vidyanikethan AI.
 *
 * Deploy with `verify_jwt: false` (or send a valid Supabase anon key) and point
 * the app's "server" provider endpoint at:
 *   https://<project-ref>.supabase.co/functions/v1/vignan-ai
 *
 * This is an ALTERNATIVE to the Render Node server. It keeps multiple
 * free-tier API keys in Supabase secrets, tries them in order, and also accepts
 * per-request student BYOK keys after the server pool is exhausted. Student
 * keys are never stored, logged or echoed back. The browser app still falls
 * back to its offline engine.
 *
 * Edge Functions are stateless, so key cooldowns are per request here. The
 * Render Node server additionally keeps short in-memory cooldowns between
 * requests.
 */

type Kind = "openai" | "arena" | "anthropic";

type Upstream = {
  id: string;
  label: string;
  kind: Kind;
  endpoint: string;
  model: string;
  key: string;
  headers?: Record<string, string>;
  keyId: string;
  keyIndex: number;
  keyCount: number;
  source: "server" | "student";
};

type ProviderDefault = {
  id: string;
  label: string;
  kind: Kind;
  endpoint: string;
  model: string;
  headers?: Record<string, string>;
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_ORDER = ["gemini", "groq", "cloudflare", "openrouter", "mistral", "cohere", "arena", "primary"];
const MAX_TOTAL_STUDENT_KEYS = 24;
const MAX_KEYS_PER_STUDENT_PROVIDER = 12;
const MAX_KEY_LENGTH = 512;

const PROVIDER_DEFAULTS: Record<string, ProviderDefault> = {
  gemini: {
    id: "gemini",
    label: "Google Gemini (free tier)",
    kind: "openai",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-3.5-flash-lite",
  },
  groq: {
    id: "groq",
    label: "Groq (free tier)",
    kind: "openai",
    endpoint: "https://api.groq.com/openai/v1",
    model: "openai/gpt-oss-20b",
  },
  cloudflare: {
    id: "cloudflare",
    label: "Cloudflare Workers AI",
    kind: "openai",
    endpoint: "https://api.cloudflare.com/client/v4/accounts/YOUR_ACCOUNT_ID/ai/v1",
    model: "@cf/openai/gpt-oss-20b",
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter (free models)",
    kind: "openai",
    endpoint: "https://openrouter.ai/api/v1",
    model: "openrouter/free",
    headers: {
      "HTTP-Referer": "https://github.com/Techno-projects-cpu/Vignan-Vidyanikethan-AI",
      "X-Title": "Vignan Vidyanikethan AI",
    },
  },
  mistral: {
    id: "mistral",
    label: "Mistral AI (free mode)",
    kind: "openai",
    endpoint: "https://api.mistral.ai/v1",
    model: "open-mistral-nemo",
  },
  cohere: {
    id: "cohere",
    label: "Cohere (free trial key)",
    kind: "openai",
    endpoint: "https://api.cohere.ai/compatibility/v1",
    model: "command-r-08-2024",
  },
  arena: {
    id: "arena",
    label: "Arena AI (workspace API)",
    kind: "arena",
    endpoint: "https://api.arena.ai",
    model: "coding-router-preview",
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    kind: "openai",
    endpoint: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic Claude",
    kind: "anthropic",
    endpoint: "https://api.anthropic.com/v1",
    model: "claude-3-5-haiku-latest",
  },
  deepseek: {
    id: "deepseek",
    label: "DeepSeek",
    kind: "openai",
    endpoint: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
  },
  together: {
    id: "together",
    label: "Together AI",
    kind: "openai",
    endpoint: "https://api.together.xyz/v1",
    model: "meta-llama/Llama-3.1-8B-Instruct-Turbo",
  },
};

function env(name: string, fallback = ""): string {
  return String(Deno.env.get(`STUDY_AI_${name}`) ?? Deno.env.get(`VIGNAN_AI_${name}`) ?? Deno.env.get(name) ?? fallback).trim();
}

function jsonEnv(name: string): Record<string, string> {
  try {
    const value = JSON.parse(env(name, "{}"));
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function parseKeys(value: unknown): string[] {
  const parts = Array.isArray(value)
    ? value.flatMap((item) => parseKeys(item))
    : String(value ?? "").split(/[\n\r,;]+/);
  const cleaned = parts
    .map((key) => String(key ?? "").trim().replace(/^['"`]|['"`]$/g, ""))
    .filter((key) => key && !/^\[stored locally\]$/i.test(key))
    .map((key) => key.slice(0, MAX_KEY_LENGTH));
  return [...new Set(cleaned)];
}

function envKeys(...names: string[]): string[] {
  return parseKeys(names.map((name) => env(name)).join("\n"));
}

function fingerprint(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  }
  return (hash >>> 0).toString(36).slice(0, 7);
}

function safeAccountId(value: string): string {
  return /^[a-zA-Z0-9_-]+$/.test(value) ? value : "";
}

function safeEndpoint(value: unknown, fallback: string): string {
  try {
    const expected = new URL(fallback);
    const url = new URL(String(value || fallback).trim());
    if (url.protocol !== "https:" || url.hostname !== expected.hostname) return fallback;
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return fallback;
  }
}

function safeModel(value: unknown, fallback: string): string {
  const model = String(value ?? "").trim();
  return model && /^[a-zA-Z0-9._:@/+ -]{1,120}$/.test(model) ? model : fallback;
}

function expand(
  definition: ProviderDefault,
  keys: string[],
  source: "server" | "student",
  endpoint = definition.endpoint,
  model = definition.model,
): Upstream[] {
  return keys.map((key, index) => ({
    id: definition.id,
    label: keys.length > 1 ? `${definition.label} · key ${index + 1}/${keys.length}` : definition.label,
    kind: definition.kind,
    endpoint,
    model,
    key,
    headers: { ...(definition.headers || {}) },
    keyId: `${source}:${definition.id}:${index + 1}:${fingerprint(key)}`,
    keyIndex: index,
    keyCount: keys.length,
    source,
  }));
}

function buildServerUpstreams(): Upstream[] {
  const catalog: Record<string, Upstream[]> = {};
  const add = (id: string, definition: ProviderDefault, keys: string[], endpoint?: string, model?: string, headers?: Record<string, string>) => {
    const merged = { ...definition, headers: { ...(definition.headers || {}), ...(headers || {}) } };
    catalog[id] = expand(merged, keys, "server", endpoint, model);
  };

  const primaryBase = env("AI_BASE_URL") || env("AI_ENDPOINT") || env("AI_BASE");
  const primaryModel = env("AI_MODEL");
  if (primaryBase && primaryModel) {
    add(
      "primary",
      {
        id: "primary",
        label: "Configured primary model",
        kind: env("AI_KIND", "openai") === "arena" ? "arena" : "openai",
        endpoint: primaryBase,
        model: primaryModel,
      },
      envKeys("AI_KEY", "AI_KEYS"),
      primaryBase,
      primaryModel,
      jsonEnv("AI_EXTRA_HEADERS"),
    );
  }

  add(PROVIDER_DEFAULTS.gemini.id, PROVIDER_DEFAULTS.gemini, envKeys("GEMINI_KEY", "GEMINI_KEYS"), env("GEMINI_ENDPOINT", PROVIDER_DEFAULTS.gemini.endpoint), env("GEMINI_MODEL", PROVIDER_DEFAULTS.gemini.model));
  add(PROVIDER_DEFAULTS.groq.id, PROVIDER_DEFAULTS.groq, envKeys("GROQ_KEY", "GROQ_KEYS"), env("GROQ_ENDPOINT", PROVIDER_DEFAULTS.groq.endpoint), env("GROQ_MODEL", PROVIDER_DEFAULTS.groq.model));

  const cfAccount = safeAccountId(env("CLOUDFLARE_ACCOUNT_ID") || env("ACCOUNT_ID"));
  const cfEndpoint = env("CLOUDFLARE_ENDPOINT") ||
    (cfAccount ? `https://api.cloudflare.com/client/v4/accounts/${cfAccount}/ai/v1` : PROVIDER_DEFAULTS.cloudflare.endpoint);
  add(PROVIDER_DEFAULTS.cloudflare.id, PROVIDER_DEFAULTS.cloudflare, envKeys("CLOUDFLARE_TOKEN", "CLOUDFLARE_TOKENS"), cfEndpoint, env("CLOUDFLARE_MODEL", PROVIDER_DEFAULTS.cloudflare.model));
  add(PROVIDER_DEFAULTS.openrouter.id, PROVIDER_DEFAULTS.openrouter, envKeys("OPENROUTER_KEY", "OPENROUTER_KEYS"), env("OPENROUTER_ENDPOINT", PROVIDER_DEFAULTS.openrouter.endpoint), env("OPENROUTER_MODEL", PROVIDER_DEFAULTS.openrouter.model), {
    "HTTP-Referer":
      env("OPENROUTER_REFERER") ||
      env("SITE_URL") ||
      PROVIDER_DEFAULTS.openrouter.headers?.["HTTP-Referer"] ||
      "https://github.com/Techno-projects-cpu/Vignan-Vidyanikethan-AI",
  });
  add(PROVIDER_DEFAULTS.mistral.id, PROVIDER_DEFAULTS.mistral, envKeys("MISTRAL_KEY", "MISTRAL_KEYS"), env("MISTRAL_ENDPOINT", PROVIDER_DEFAULTS.mistral.endpoint), env("MISTRAL_MODEL", PROVIDER_DEFAULTS.mistral.model));
  add(PROVIDER_DEFAULTS.cohere.id, PROVIDER_DEFAULTS.cohere, envKeys("COHERE_KEY", "COHERE_KEYS"), env("COHERE_ENDPOINT", PROVIDER_DEFAULTS.cohere.endpoint), env("COHERE_MODEL", PROVIDER_DEFAULTS.cohere.model));
  add(PROVIDER_DEFAULTS.arena.id, PROVIDER_DEFAULTS.arena, envKeys("ARENA_KEY", "ARENA_KEYS", "ARENA_API_KEY"), env("ARENA_ENDPOINT", PROVIDER_DEFAULTS.arena.endpoint), env("ARENA_MODEL", PROVIDER_DEFAULTS.arena.model));

  const configured = env("FREE_ROUTER_ORDER");
  const order = configured ? configured.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean) : DEFAULT_ORDER;
  const upstreams = [...new Set([...order, ...DEFAULT_ORDER])].flatMap((id) => catalog[id] || []);
  return env("FREE_ROUTER", "true").toLowerCase() === "false" ? upstreams.slice(0, 1) : upstreams;
}

type StudentEntry = { providerId?: unknown; keys?: unknown; endpoint?: unknown; model?: unknown };

function buildStudentUpstreams(value: unknown): Upstream[] {
  const entries = Array.isArray(value) ? value as StudentEntry[] : [];
  const upstreams: Upstream[] = [];
  for (const entry of entries) {
    if (upstreams.length >= MAX_TOTAL_STUDENT_KEYS) break;
    const id = String(entry?.providerId ?? "");
    const definition = PROVIDER_DEFAULTS[id];
    if (!definition) continue;
    const keys = parseKeys(entry.keys).slice(0, Math.min(MAX_KEYS_PER_STUDENT_PROVIDER, MAX_TOTAL_STUDENT_KEYS - upstreams.length));
    if (!keys.length) continue;
    upstreams.push(
      ...expand(
        definition,
        keys,
        "student",
        safeEndpoint(entry.endpoint, definition.endpoint),
        safeModel(entry.model, definition.model),
      ),
    );
  }
  return upstreams.slice(0, MAX_TOTAL_STUDENT_KEYS);
}

function extractContent(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const value = data as Record<string, unknown>;
  if (typeof value.content === "string") return value.content.trim();
  if (Array.isArray(value.content)) {
    return value.content.map((part) => (typeof part === "string" ? part : String((part as { text?: string })?.text || ""))).join("").trim();
  }
  const choice = (value.choices as Array<{ message?: { content?: string }; text?: string }> | undefined)?.[0];
  return String(choice?.message?.content || choice?.text || value.response || value.output_text || "").trim();
}

function errorMessage(status: number, data: unknown): string {
  const value = data as { error?: { message?: string } | string; message?: string; msg?: string; detail?: string } | null;
  const message = typeof value?.error === "string"
    ? value.error
    : value?.error?.message || value?.message || value?.msg || value?.detail || `HTTP ${status}`;
  return String(message).replace(/\s+/g, " ").trim().slice(0, 300);
}

function isQuotaFailure(status: number, message: string): boolean {
  return [401, 402, 403, 429].includes(status) ||
    /quota|rate.?limit|exhausted|insufficient|billing|payment|too many requests|resource_exhausted|over quota|limit reached/i.test(message);
}

function buildRequest(upstream: Upstream, messages: unknown[], temperature: number, maxTokens: number) {
  if (upstream.kind === "arena" || upstream.kind === "anthropic") {
    const system = messages.filter((m) => (m as { role?: string }).role === "system")
      .map((m) => String((m as { content?: string }).content || "")).join("\n\n");
    const chat = messages.filter((m) => (m as { role?: string }).role !== "system");
    return {
      url: upstream.kind === "arena"
        ? `${upstream.endpoint.replace(/\/$/, "")}/v1/messages`
        : `${upstream.endpoint.replace(/\/$/, "")}/messages`,
      headers: {
        "Content-Type": "application/json",
        ...(upstream.kind === "arena"
          ? { Authorization: `Bearer ${upstream.key}` }
          : { "x-api-key": upstream.key }),
        "anthropic-version": "2023-06-01",
        ...(upstream.headers || {}),
      },
      body: {
        model: upstream.model,
        max_tokens: maxTokens,
        temperature,
        system,
        messages: chat.map((m) => ({
          role: (m as { role?: string }).role === "assistant" ? "assistant" : "user",
          content: String((m as { content?: string }).content || ""),
        })),
      },
    };
  }
  return {
    url: `${upstream.endpoint.replace(/\/$/, "")}/chat/completions`,
    headers: {
      "Content-Type": "application/json",
      ...(upstream.key ? { Authorization: `Bearer ${upstream.key}` } : {}),
      ...(upstream.headers || {}),
    },
    body: { model: upstream.model, messages, temperature, max_tokens: maxTokens },
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ ok: false, error: "POST required" }, 405);

  let payload: {
    messages?: unknown[];
    temperature?: number;
    max_tokens?: number;
    studentKeys?: unknown;
    studentKeyFallback?: boolean;
    forceStudentKeys?: boolean;
  } = {};
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }
  const messages = Array.isArray(payload.messages) ? payload.messages.slice(-20) : [];
  if (!messages.length) return json({ ok: false, error: "A messages array is required." }, 400);

  const serverUpstreams = buildServerUpstreams();
  const studentUpstreams = payload.studentKeyFallback === false ? [] : buildStudentUpstreams(payload.studentKeys);
  const upstreams = payload.forceStudentKeys ? studentUpstreams : [...serverUpstreams, ...studentUpstreams];
  if (!upstreams.length) {
    return json({
      ok: false,
      error: "No AI keys are available. Add Supabase/Render secrets or use student keys in Settings.",
      code: "NO_AI_KEYS",
      needStudentKeys: true,
    }, 503);
  }

  const temperature = Math.min(2, Math.max(0, Number(payload.temperature ?? 0.2)));
  const maxTokens = Math.min(4096, Math.max(1, Number(payload.max_tokens ?? 900)));
  const errors: string[] = [];
  let quotaFailures = 0;
  let attempts = 0;

  for (const upstream of upstreams) {
    attempts += 1;
    try {
      const built = buildRequest(upstream, messages, temperature, maxTokens);
      const response = await fetch(built.url, {
        method: "POST",
        headers: built.headers,
        body: JSON.stringify(built.body),
        signal: AbortSignal.timeout(45_000),
      });
      const text = await response.text();
      let data: unknown;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { content: text };
      }
      if (!response.ok) {
        const message = errorMessage(response.status, data);
        if (isQuotaFailure(response.status, message)) quotaFailures += 1;
        errors.push(`${upstream.keyId}: ${message}`);
        continue;
      }
      const content = extractContent(data);
      if (!content) {
        errors.push(`${upstream.keyId}: empty response`);
        continue;
      }
      return json({
        ok: true,
        content,
        provider: upstream.id,
        providerLabel: upstream.label,
        model: (data as { model?: string })?.model || upstream.model,
        usage: (data as { usage?: unknown })?.usage || null,
        attempts,
        fallbackUsed: attempts > 1,
        freeRouter: true,
        keySource: upstream.source,
        studentKeyUsed: upstream.source === "student",
        keyCount: upstream.keyCount,
        errors,
      });
    } catch (error) {
      errors.push(`${upstream.keyId}: ${String(error?.message || error).slice(0, 200)}`);
    }
  }

  const exhausted = quotaFailures > 0 && quotaFailures === errors.length;
  return json({
    ok: false,
    error: exhausted
      ? "All configured AI keys are exhausted. Add a student key in Settings or keep using offline answers."
      : `No AI provider answered. ${errors.slice(0, 3).join(" | ")}`,
    code: exhausted ? "ALL_KEYS_EXHAUSTED" : "AI_UNAVAILABLE",
    needStudentKeys: exhausted,
    attempts,
    errors: errors.slice(0, 6),
  }, exhausted ? 429 : 502);
});
