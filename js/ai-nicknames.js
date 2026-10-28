/**
 * Friendly, non-branded nicknames for Vignan's AI routes.
 *
 * The public chooser never shows the underlying provider name. Real IDs stay
 * in `data-provider` / select values so routing, server proxies and tests keep
 * working. Specialties are short enough to sit under a nickname in a menu.
 */

export const AI_NICKNAMES = {
  offline: { nickname: "Bolt", specialty: "Instant offline textbook lookup" },
  server: { nickname: "Atlas", specialty: "Free cloud router" },
  webllm: { nickname: "Nova", specialty: "Private local reasoning" },
  ollama: { nickname: "Echo", specialty: "Laptop open model" },
  lmstudio: { nickname: "Haven", specialty: "Local server model" },
  gemini: { nickname: "Prism", specialty: "Balanced everyday answers" },
  groq: { nickname: "Dash", specialty: "Ultra-fast cloud replies" },
  openrouter: { nickname: "Sage", specialty: "Wide model selection" },
  anthropic: { nickname: "Quill", specialty: "Long-form reasoning" },
  openai: { nickname: "Orbit", specialty: "General purpose" },
  mistral: { nickname: "Mica", specialty: "Lightweight writing" },
  cohere: { nickname: "Scout", specialty: "Retrieval and citations" },
  cloudflare: { nickname: "Aero", specialty: "Edge inference" },
  deepseek: { nickname: "Axiom", specialty: "Maths and code" },
  together: { nickname: "Pulse", specialty: "Open-model cloud" },
  arena: { nickname: "Vector", specialty: "Workspace reasoning" },
  custom: { nickname: "Any", specialty: "Your own endpoint" },
};

/** Shown first in the compact chooser; the rest live in the command menu. */
export const FEATURED_AI_IDS = [
  "offline",
  "webllm",
  "server",
  "groq",
  "gemini",
  "openrouter",
  "ollama",
  "custom",
];

export function aiProfile(value) {
  const id = typeof value === "string" ? value : value?.id || "offline";
  const fallbackName = typeof value === "string" ? id : value?.label || "AI";
  const profile = AI_NICKNAMES[id] || { nickname: fallbackName, specialty: "Configured model" };
  return { id, nickname: profile.nickname, specialty: profile.specialty };
}

export function aiOptionLabel(value) {
  const profile = aiProfile(value);
  return `${profile.nickname} · ${profile.specialty}`;
}

export function allAIProfiles() {
  return Object.keys(AI_NICKNAMES).map((id) => aiProfile(id));
}
