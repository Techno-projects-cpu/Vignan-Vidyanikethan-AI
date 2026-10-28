/** Settings defaults, migration and health checks for the model router. */

import { PROVIDERS, PROVIDER_IDS, defaultProviderConfig } from "./providers.js?v=15";
import { DEFAULT_LOCAL_MODEL_ID, LOCAL_MODELS } from "./local-ai.js?v=15";
import { parseApiKeys } from "./key-pool.js?v=15";
import { cleanStudentKeyVault, defaultStudentKeyVault } from "./student-keys.js?v=15";
import { aiProfile } from "./ai-nicknames.js?v=15";

export const ROUTING_TASKS = ["answer", "quiz", "flashcards", "grade", "verify"];

const DEFAULT_PROVIDER_CONFIGS = Object.fromEntries(
  PROVIDER_IDS.map((id) => [id, defaultProviderConfig(id)]),
);

export const DEFAULT_SETTINGS = {
  // Vignan Vidyanikethan AI is an orchestrator around existing AIs. Each job can be routed to
  // a different provider; "offline" uses the deterministic local engine.
  routing: {
    answer: "offline",
    quiz: "offline",
    flashcards: "offline",
    grade: "offline",
    verify: "offline",
  },
  fallback: "offline",
  providers: DEFAULT_PROVIDER_CONFIGS,
  studentKeyFallback: true,
  studentKeys: defaultStudentKeyVault(),
  activeProvider: "webllm",
  localAIModel: DEFAULT_LOCAL_MODEL_ID,
  localAIAutoEnable: true,
  // New installations can search Wikipedia when books have no match. Explicit
  // stored choices (including older opt-outs) are preserved by normalization.
  webEnabled: true,
  webMode: "server",
  searchEndpoint: "",
  searchToken: "",
  language: "en",
  theme: "dark",
  profile: "Student",
  disclaimerSeen: false,
  freeRouterDismissed: false,
};

function cleanProviderConfig(config = {}, fallback = {}) {
  const keys = parseApiKeys([config.apiKeys, config.apiKey, fallback.apiKeys, fallback.apiKey].join("\n")).slice(0, 12);
  return {
    endpoint: String(config.endpoint ?? fallback.endpoint ?? "").trim(),
    model: String(config.model ?? fallback.model ?? "").trim(),
    apiKey: keys[0] || "",
    apiKeys: keys,
  };
}

function migrateLegacy(raw) {
  if (!raw?.engine || raw.routing) return raw;
  const legacyMap = { server: "server", ollama: "ollama", webllm: "webllm", custom: "openai" };
  const providerId = legacyMap[raw.engine] || (raw.engine === "offline" ? "offline" : "custom");
  const routing = {
    answer: providerId,
    quiz: providerId,
    flashcards: providerId,
    grade: "offline",
    verify: "offline",
  };
  const providers = { ...DEFAULT_PROVIDER_CONFIGS };
  if (providerId !== "offline") {
    providers[providerId] = cleanProviderConfig(
      { endpoint: raw.endpoint, model: raw.model, apiKey: raw.apiKey },
      DEFAULT_PROVIDER_CONFIGS[providerId],
    );
  }
  return { ...raw, routing, providers, activeProvider: providerId === "offline" ? "server" : providerId };
}

export function normalizeSettings(value = {}) {
  const raw = migrateLegacy(value || {});
  const merged = {
    ...DEFAULT_SETTINGS,
    ...raw,
    routing: { ...DEFAULT_SETTINGS.routing, ...(raw.routing || {}) },
    providers: { ...DEFAULT_PROVIDER_CONFIGS },
  };
  for (const id of PROVIDER_IDS) {
    merged.providers[id] = cleanProviderConfig(raw.providers?.[id], DEFAULT_PROVIDER_CONFIGS[id]);
  }
  merged.studentKeyFallback = raw.studentKeyFallback !== false;
  merged.studentKeys = cleanStudentKeyVault(raw.studentKeys);
  const candidateLocalModel = raw.localAIModel || raw.providers?.webllm?.model || DEFAULT_LOCAL_MODEL_ID;
  merged.localAIModel = LOCAL_MODELS.some((model) => model.id === candidateLocalModel)
    ? candidateLocalModel
    : DEFAULT_LOCAL_MODEL_ID;
  merged.localAIAutoEnable = raw.localAIAutoEnable !== false;
  merged.providers.webllm.model = merged.localAIModel;
  for (const task of ROUTING_TASKS) {
    const route = merged.routing[task];
    if (route !== "offline" && !PROVIDERS[route]) merged.routing[task] = "offline";
  }
  if (merged.fallback !== "offline" && !PROVIDERS[merged.fallback]) merged.fallback = "offline";
  if (!PROVIDERS[merged.activeProvider]) merged.activeProvider = "server";
  if (!["server", "custom"].includes(merged.webMode)) merged.webMode = "server";
  if (!["light", "dark"].includes(merged.theme)) merged.theme = "light";
  if (!["en", "te", "hi"].includes(merged.language)) merged.language = "en";
  merged.freeRouterDismissed = Boolean(raw.freeRouterDismissed);
  merged.profile = String(merged.profile || "Student").slice(0, 32);
  return merged;
}

export function isModelConnected(settings) {
  return ROUTING_TASKS.some((task) => settings?.routing?.[task] && settings.routing[task] !== "offline");
}

export function connectedProviders(settings) {
  return ROUTING_TASKS.map((task) => settings?.routing?.[task]).filter(
    (providerId, index, list) => providerId && providerId !== "offline" && list.indexOf(providerId) === index,
  );
}

export function engineLabel(settings) {
  const primary = settings?.routing?.answer;
  if (!primary || primary === "offline") return "Bolt · Instant offline engine";
  const profile = aiProfile(PROVIDERS[primary] || primary);
  return `${profile.nickname} · ${profile.specialty}`;
}

export function privacyLabel(settings) {
  const providers = connectedProviders(settings);
  const hasStudentKeys =
    settings?.studentKeyFallback !== false &&
    Object.values(settings?.studentKeys || {}).some((entry) => parseApiKeys(entry?.keys).length > 0);
  const web = settings?.webEnabled
    ? "When books have no match, the search query goes to Wikipedia or your chosen search provider."
    : "Web fallback is off.";
  const links = "Links you explicitly request are sent to the site server and the linked website.";
  if (!providers.length && !hasStudentKeys) return `Book lookup stays on this device. ${web} ${links}`;
  const allPrivate = providers.every((id) => PROVIDERS[id]?.private);
  const ai = hasStudentKeys
    ? "Short passages go to configured AIs; your keys stay in this browser."
    : allPrivate
      ? "Short passages go to your configured local models."
      : "Short passages go to your configured AI provider(s).";
  return `${ai} ${web} ${links}`;
}

export function providerConfig(settings, providerId = settings?.activeProvider) {
  return settings?.providers?.[providerId] || defaultProviderConfig(providerId);
}

export async function serverHealth({ timeout = 1500 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch("api/health", { signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new Error(`Health check failed (${response.status})`);
    return await response.json();
  } catch {
    return {
      ok: false,
      ai: false,
      aiProviders: [],
      freeRouter: false,
      search: false,
      accountsBackend: "local",
      offlineReady: false,
      keyPool: { serverKeys: 0, coolingKeys: 0, cooldownMs: 60000, studentKeyFallback: true },
    };
  } finally {
    clearTimeout(timer);
  }
}
