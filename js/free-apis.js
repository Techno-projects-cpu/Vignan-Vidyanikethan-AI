/**
 * Official places to create your OWN free-tier AI credentials.
 *
 * Vignan Vidyanikethan AI deliberately ships with zero API keys. Public or
 * leaked keys are unsafe: they can expose private data, burn someone else's
 * quota, and create surprise bills. These links only open the provider's own
 * key page; the resulting secret belongs in Render / Supabase environment
 * variables, never in Git or in a student's browser.
 */

export const FREE_API_WARNING =
  "No API keys are bundled. Create your own keys, then paste one or more into each Render → Environment secret (comma/newline separated). Vignan rotates to the next key on quota limits. Students can also add their own keys below, used only after the Render pool is exhausted. Never use a key found in a public repo, video, or chat.";

export const FREE_API_PROVIDERS = [
  {
    id: "gemini",
    name: "Prism",
    nickname: "Prism",
    specialty: "Balanced everyday answers",
    realName: "Google AI Studio",
    model: "gemini-3.5-flash-lite",
    env: "STUDY_AI_GEMINI_KEY",
    free: "Free Flash / Flash-Lite rows; no credit card. Limits are shown per project in AI Studio.",
    url: "https://aistudio.google.com/app/apikey",
    recommended: true,
  },
  {
    id: "groq",
    name: "Dash",
    nickname: "Dash",
    specialty: "Ultra-fast cloud replies",
    realName: "Groq Console",
    model: "openai/gpt-oss-20b",
    env: "STUDY_AI_GROQ_KEY",
    free: "No-card developer tier for fast open-weight models; per-model rate limits apply.",
    url: "https://console.groq.com/keys",
    recommended: true,
  },
  {
    id: "cloudflare",
    name: "Aero",
    nickname: "Aero",
    specialty: "Edge inference",
    realName: "Cloudflare Workers AI",
    model: "@cf/openai/gpt-oss-20b",
    env: "STUDY_AI_CLOUDFLARE_TOKEN + STUDY_AI_CLOUDFLARE_ACCOUNT_ID",
    free: "10,000 free Neurons per day. You also need your Cloudflare account ID.",
    url: "https://dash.cloudflare.com/profile/api-tokens",
  },
  {
    id: "openrouter",
    name: "Sage",
    nickname: "Sage",
    specialty: "Wide model selection",
    realName: "OpenRouter",
    model: "openrouter/free",
    env: "STUDY_AI_OPENROUTER_KEY",
    free: "Free :free models; unfunded accounts get 20 RPM / 50 requests per day.",
    url: "https://openrouter.ai/keys",
  },
  {
    id: "mistral",
    name: "Mica",
    nickname: "Mica",
    specialty: "Lightweight writing",
    realName: "Mistral AI",
    model: "open-mistral-nemo",
    env: "STUDY_AI_MISTRAL_KEY",
    free: "Free mode is enabled by default with no card; exact limits appear in your admin panel.",
    url: "https://console.mistral.ai/api-keys/",
  },
  {
    id: "cohere",
    name: "Scout",
    nickname: "Scout",
    specialty: "Retrieval and citations",
    realName: "Cohere",
    model: "command-r-08-2024",
    env: "STUDY_AI_COHERE_KEY",
    free: "Free trial key: about 1,000 calls/month and 20 chat RPM; evaluation/non-commercial use.",
    url: "https://dashboard.cohere.com/api-keys",
  },
  {
    id: "arena",
    name: "Vector",
    nickname: "Vector",
    specialty: "Workspace reasoning",
    realName: "Arena AI workspace",
    model: "coding-router-preview",
    env: "STUDY_AI_ARENA_KEY",
    free: "OPTIONAL. Free-router keys are for Claude Code/Desktop only; a website needs a workspace API key.",
    url: "https://platform.arena.ai/docs",
  },
  {
    id: "ollama",
    name: "Echo",
    nickname: "Echo",
    specialty: "Laptop open model",
    realName: "Ollama",
    model: "llama3.2:1b",
    env: "No key — run ollama locally",
    free: "Open-weight Meta Llama 3.2 1B on a laptop. No account, no internet after download.",
    url: "https://ollama.com/library/llama3.2",
    local: true,
  },
];

export function freeAPIProvider(id) {
  return FREE_API_PROVIDERS.find((provider) => provider.id === id) || null;
}
