/**
 * Student-owned "bring your own key" (BYOK) vault.
 *
 * Keys live only in this browser's IndexedDB/localStorage settings. They are
 * sent per request to the Vignan /api/ai proxy, never to the public
 * leaderboard, account table or support exports, and only after official
 * server-side free-tier keys have been tried (or during an explicit test).
 */

import { PROVIDERS } from "./providers.js?v=17";
import { parseApiKeys } from "./key-pool.js?v=17";

const STUDENT_KEY_PROVIDER_IDS = [
  "gemini",
  "groq",
  "cloudflare",
  "openrouter",
  "mistral",
  "cohere",
  "arena",
  "openai",
  "anthropic",
  "deepseek",
  "together",
];

export const STUDENT_KEY_PROVIDERS = STUDENT_KEY_PROVIDER_IDS.filter((id) => PROVIDERS[id]).map((id) => {
  const provider = PROVIDERS[id];
  return {
    id,
    label: provider.label,
    nickname: provider.nickname || provider.label,
    specialty: provider.specialty || "Configured model",
    endpoint: provider.endpoint,
    model: provider.model,
    kind: provider.kind,
    extraHeaders: { ...(provider.extraHeaders || {}) },
    needsKey: provider.needsKey,
  };
});

const PROVIDER_BY_ID = new Map(STUDENT_KEY_PROVIDERS.map((provider) => [provider.id, provider]));
const MAX_KEYS_PER_PROVIDER = 12;
const MAX_TOTAL_KEYS = 24;
const MAX_KEY_LENGTH = 512;

/** Strip query strings/hashes so a pasted URL cannot smuggle a secret. */
export function cleanStudentEndpoint(value, fallback = "https://api.openai.com/v1") {
  try {
    const url = new URL(String(value || fallback).trim());
    if (url.protocol !== "https:") return fallback;
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return fallback;
  }
}

export function defaultStudentKeyVault() {
  return Object.fromEntries(
    STUDENT_KEY_PROVIDERS.map((provider) => [
      provider.id,
      { endpoint: provider.endpoint, model: provider.model, keys: [] },
    ]),
  );
}

export function cleanStudentKeyVault(raw = {}) {
  const vault = defaultStudentKeyVault();
  const source = raw && typeof raw === "object" ? raw : {};
  for (const provider of STUDENT_KEY_PROVIDERS) {
    const value = source[provider.id];
    const entry = typeof value === "string" ? { keys: value } : value && typeof value === "object" ? value : null;
    if (!entry) continue;
    vault[provider.id] = {
      endpoint: cleanStudentEndpoint(entry.endpoint, provider.endpoint),
      model: String(entry.model || provider.model).trim().slice(0, 120),
      keys: parseApiKeys(entry.keys ?? entry.apiKeys ?? entry.apiKey)
        .map((key) => key.slice(0, MAX_KEY_LENGTH))
        .slice(0, MAX_KEYS_PER_PROVIDER),
    };
  }
  return vault;
}

/** Build the minimal per-request payload sent to the site's own /api/ai proxy. */
export function studentKeyPayload(settings = {}, { force = false } = {}) {
  if (!force && settings.studentKeyFallback === false) return [];
  const vault = cleanStudentKeyVault(settings.studentKeys);
  let remaining = MAX_TOTAL_KEYS;
  return STUDENT_KEY_PROVIDERS.map((provider) => {
    const entry = vault[provider.id];
    const keys = entry.keys.slice(0, Math.max(0, remaining));
    remaining -= keys.length;
    return { providerId: provider.id, endpoint: entry.endpoint, model: entry.model, keys };
  }).filter((entry) => entry.keys.length > 0);
}

export function studentKeySummary(settings = {}) {
  const vault = cleanStudentKeyVault(settings.studentKeys);
  const entries = STUDENT_KEY_PROVIDERS.map((provider) => ({
    id: provider.id,
    label: provider.label,
    count: vault[provider.id].keys.length,
  }));
  return {
    providers: entries.filter((entry) => entry.count > 0).length,
    keys: entries.reduce((total, entry) => total + entry.count, 0),
    entries,
    enabled: settings.studentKeyFallback !== false,
  };
}

/** Replace values with placeholders while preserving counts for safe exports. */
export function maskStudentKeyVault(raw = {}) {
  const vault = cleanStudentKeyVault(raw);
  return Object.fromEntries(
    Object.entries(vault).map(([id, entry]) => [
      id,
      { ...entry, keys: entry.keys.map(() => "[stored locally]") },
    ]),
  );
}

export function studentProviderCatalog() {
  return STUDENT_KEY_PROVIDERS.map((provider) => ({ ...provider }));
}

export function getStudentProvider(id) {
  return PROVIDER_BY_ID.get(id) || null;
}
