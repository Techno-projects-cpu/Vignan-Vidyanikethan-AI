/**
 * Optional Supabase Edge Function for Vignan Vidyanikethan AI.
 *
 * Deploy with `verify_jwt: false` (or send a valid Supabase anon key) and point
 * the app's "server" provider endpoint at:
 *   https://<project-ref>.supabase.co/functions/v1/vignan-ai
 *
 * This is an ALTERNATIVE to the Render Node server. It keeps free-tier API keys
 * in Supabase secrets and tries several zero-cost providers before failing.
 * The browser app still falls back to its offline engine.
 */

type Upstream = {
  id: string;
  kind: "openai" | "arena";
  endpoint: string;
  model: string;
  key: string;
  headers?: Record<string, string>;
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function env(name: string, fallback = ""): string {
  return Deno.env.get(`STUDY_AI_${name}`) ?? Deno.env.get(`VIGNAN_AI_${name}`) ?? fallback;
}

function jsonEnv(name: string): Record<string, string> {
  try {
    const value = JSON.parse(env(name, "{}"));
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function buildUpstreams(): Upstream[] {
  const list: Upstream[] = [];
  const order = (env("FREE_ROUTER_ORDER", "gemini,groq,cloudflare,openrouter,mistral,cohere,arena,primary"))
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  const catalog: Record<string, Upstream | undefined> = {};
  const primaryBase = env("AI_BASE_URL");
  const primaryModel = env("AI_MODEL");
  if (primaryBase && primaryModel) {
    catalog.primary = {
      id: "primary",
      kind: env("AI_KIND", "openai") === "arena" ? "arena" : "openai",
      endpoint: primaryBase,
      model: primaryModel,
      key: env("AI_KEY"),
      headers: jsonEnv("AI_EXTRA_HEADERS"),
    };
  }
  const geminiKey = env("GEMINI_KEY");
  if (geminiKey) {
    catalog.gemini = {
      id: "gemini",
      kind: "openai",
      endpoint: env("GEMINI_ENDPOINT", "https://generativelanguage.googleapis.com/v1beta/openai"),
      model: env("GEMINI_MODEL", "gemini-3.5-flash-lite"),
      key: geminiKey,
    };
  }
  const groqKey = env("GROQ_KEY");
  if (groqKey) {
    catalog.groq = {
      id: "groq",
      kind: "openai",
      endpoint: env("GROQ_ENDPOINT", "https://api.groq.com/openai/v1"),
      model: env("GROQ_MODEL", "openai/gpt-oss-20b"),
      key: groqKey,
    };
  }
  const cfAccount = env("CLOUDFLARE_ACCOUNT_ID");
  const cfToken = env("CLOUDFLARE_TOKEN");
  if (cfAccount && cfToken && /^[a-zA-Z0-9_-]+$/.test(cfAccount)) {
    catalog.cloudflare = {
      id: "cloudflare",
      kind: "openai",
      endpoint: `https://api.cloudflare.com/client/v4/accounts/${cfAccount}/ai/v1`,
      model: env("CLOUDFLARE_MODEL", "@cf/openai/gpt-oss-20b"),
      key: cfToken,
    };
  }
  const orKey = env("OPENROUTER_KEY");
  if (orKey) {
    catalog.openrouter = {
      id: "openrouter",
      kind: "openai",
      endpoint: env("OPENROUTER_ENDPOINT", "https://openrouter.ai/api/v1"),
      model: env("OPENROUTER_MODEL", "openrouter/free"),
      key: orKey,
      headers: {
        "HTTP-Referer": env("OPENROUTER_REFERER", "https://github.com/Techno-projects-cpu/Vignan-Vidyanikethan-AI"),
        "X-Title": "Vignan Vidyanikethan AI",
      },
    };
  }
  const mistralKey = env("MISTRAL_KEY");
  if (mistralKey) {
    catalog.mistral = {
      id: "mistral",
      kind: "openai",
      endpoint: env("MISTRAL_ENDPOINT", "https://api.mistral.ai/v1"),
      model: env("MISTRAL_MODEL", "open-mistral-nemo"),
      key: mistralKey,
    };
  }
  const cohereKey = env("COHERE_KEY");
  if (cohereKey) {
    catalog.cohere = {
      id: "cohere",
      kind: "openai",
      endpoint: env("COHERE_ENDPOINT", "https://api.cohere.ai/compatibility/v1"),
      model: env("COHERE_MODEL", "command-r-08-2024"),
      key: cohereKey,
    };
  }
  const arenaKey = env("ARENA_KEY");
  if (arenaKey) {
    catalog.arena = {
      id: "arena",
      kind: "arena",
      endpoint: env("ARENA_ENDPOINT", "https://api.arena.ai"),
      model: env("ARENA_MODEL", "coding-router-preview"),
      key: arenaKey,
    };
  }

  for (const id of [...new Set([...order, ...Object.keys(catalog)])]) {
    if (catalog[id]) list.push(catalog[id]!);
  }
  return env("FREE_ROUTER", "true").toLowerCase() === "false" ? list.slice(0, 1) : list;
}

function extractContent(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const value = data as Record<string, unknown>;
  if (typeof value.content === "string") return value.content;
  if (Array.isArray(value.content)) {
    return value.content.map((part) => (typeof part === "string" ? part : String((part as { text?: string })?.text || ""))).join("").trim();
  }
  const choice = (value.choices as Array<{ message?: { content?: string }; text?: string }> | undefined)?.[0];
  return String(choice?.message?.content || choice?.text || value.response || value.output_text || "").trim();
}

function buildRequest(upstream: Upstream, messages: unknown[], temperature: number, maxTokens: number) {
  if (upstream.kind === "arena") {
    const system = messages.filter((m) => (m as { role?: string }).role === "system")
      .map((m) => String((m as { content?: string }).content || "")).join("\n\n");
    const chat = messages.filter((m) => (m as { role?: string }).role !== "system");
    return {
      url: `${upstream.endpoint.replace(/\/$/, "")}/v1/messages`,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${upstream.key}`,
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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "POST required" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let payload: { messages?: unknown[]; temperature?: number; max_tokens?: number } = {};
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  const messages = Array.isArray(payload.messages) ? payload.messages.slice(-20) : [];
  if (!messages.length) {
    return new Response(JSON.stringify({ ok: false, error: "A messages array is required." }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const upstreams = buildUpstreams();
  if (!upstreams.length) {
    return new Response(
      JSON.stringify({ ok: false, error: "No free AI provider configured. Add Gemini, Groq, Cloudflare, OpenRouter or Arena secrets." }),
      { status: 503, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  const temperature = Math.min(2, Math.max(0, Number(payload.temperature ?? 0.2)));
  const maxTokens = Math.min(4096, Math.max(1, Number(payload.max_tokens ?? 900)));
  const errors: string[] = [];

  for (let index = 0; index < upstreams.length; index += 1) {
    const upstream = upstreams[index];
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
        const err = data as { error?: { message?: string } | string; message?: string };
        errors.push(`${upstream.id}: ${err?.error && typeof err.error === "object" ? err.error.message : err?.error || err?.message || response.status}`);
        continue;
      }
      const content = extractContent(data);
      if (!content) {
        errors.push(`${upstream.id}: empty response`);
        continue;
      }
      return new Response(
        JSON.stringify({
          ok: true,
          content,
          provider: upstream.id,
          model: (data as { model?: string })?.model || upstream.model,
          usage: (data as { usage?: unknown })?.usage || null,
          attempts: index + 1,
          fallbackUsed: index > 0,
          errors,
        }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
      );
    } catch (error) {
      errors.push(`${upstream.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return new Response(
    JSON.stringify({ ok: false, error: `All AI providers failed. ${errors.at(-1) || "Unknown error"}` }),
    { status: 502, headers: { ...cors, "Content-Type": "application/json" } },
  );
});
