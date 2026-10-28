/**
 * Convert a student BYOK payload into safe free-router upstreams.
 *
 * The endpoint may only target the same host as the official provider default;
 * this prevents an arbitrary request from becoming a server-side SSRF. Keys
 * are capped, deduplicated, and never included in an id, label, error or log.
 */

import { parseApiKeys, providerKeyVariants } from "../js/key-pool.js";
import { getStudentProvider, studentProviderCatalog } from "../js/student-keys.js";

const MAX_KEYS_PER_PROVIDER = 12;
const MAX_TOTAL_KEYS = 24;
const MAX_KEY_LENGTH = 512;
const SAFE_MODEL = /^[a-zA-Z0-9._:@/+ -]{1,120}$/;

function safeModel(value, fallback) {
  const model = String(value || "").trim();
  return model && SAFE_MODEL.test(model) ? model : fallback;
}

function safeEndpoint(value, fallback) {
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

function normalizePayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  return Object.entries(payload).map(([providerId, value]) => ({
    providerId,
    ...(typeof value === "object" && value ? value : { keys: value }),
  }));
}

export function buildStudentUpstreams(payload = [], { maxKeys = MAX_TOTAL_KEYS } = {}) {
  const allowed = new Set(studentProviderCatalog().map((provider) => provider.id));
  const limit = Math.max(0, Math.min(MAX_TOTAL_KEYS, Number(maxKeys) || MAX_TOTAL_KEYS));
  const upstreams = [];

  for (const entry of normalizePayload(payload)) {
    if (upstreams.length >= limit) break;
    const providerId = String(entry?.providerId || "");
    const definition = allowed.has(providerId) ? getStudentProvider(providerId) : null;
    if (!definition) continue;
    const keys = parseApiKeys(entry.keys ?? entry.apiKeys ?? entry.apiKey)
      .map((key) => key.slice(0, MAX_KEY_LENGTH))
      .filter(Boolean)
      .slice(0, Math.min(MAX_KEYS_PER_PROVIDER, limit - upstreams.length));
    if (!keys.length) continue;

    const template = {
      id: definition.id,
      providerId: definition.id,
      label: `${definition.label} · student key`,
      kind: definition.kind,
      endpoint: safeEndpoint(entry.endpoint, definition.endpoint),
      model: safeModel(entry.model, definition.model),
      apiKeys: keys,
      needsKey: true,
      keyNamespace: `student:${definition.id}`,
      source: "student",
      extraHeaders: { ...(definition.extraHeaders || {}) },
    };

    for (const variant of providerKeyVariants(template, template.keyNamespace).slice(0, limit - upstreams.length)) {
      upstreams.push({
        ...variant,
        apiKeys: [],
        label: `${definition.label} · student key ${variant.keyIndex + 1}/${keys.length}`,
        source: "student",
      });
    }
  }
  return upstreams;
}
