/**
 * Shared API-key pool helpers for Vignan Vidyanikethan AI.
 *
 * Used by both the Node free router and the browser provider adapters. Key
 * VALUES never appear in logs, health responses, exports or error identifiers;
 * only short, non-reversible fingerprints are used for cooldown bookkeeping.
 */

const KEY_SEPARATOR = /[\n\r,;]+/;

/** Split a textarea / env value into unique, trimmed API keys. */
export function parseApiKeys(value) {
  const parts = Array.isArray(value)
    ? value.flatMap((item) => parseApiKeys(item))
    : String(value ?? "").split(KEY_SEPARATOR);
  const cleaned = parts
    .map((key) => String(key ?? "").trim().replace(/^['"`]|['"`]$/g, ""))
    .filter((key) => key && !/^\[stored locally\]$/i.test(key));
  return [...new Set(cleaned)];
}

/** Small FNV-1a style fingerprint. Not cryptographic; just a cooldown label. */
export function fingerprintKey(value) {
  let hash = 2166136261;
  const text = String(value ?? "");
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  }
  return (hash >>> 0).toString(36).slice(0, 7);
}

/**
 * Expand one provider definition into one request variant per API key.
 * A keyless provider still yields one variant. A key-required provider with no
 * keys yields none, so the caller can show a helpful setup message.
 */
export function providerKeyVariants(provider = {}, namespace = provider.keyNamespace || provider.id || "provider") {
  const keys = parseApiKeys([provider.apiKeys, provider.apiKey].join("\n"));
  if (!keys.length) {
    return provider.needsKey
      ? []
      : [{
          ...provider,
          apiKey: "",
          apiKeys: [],
          keyIndex: 0,
          keyCount: 0,
          keyId: `${namespace}:no-key`,
        }];
  }
  return keys.map((apiKey, index) => ({
    ...provider,
    apiKey,
    apiKeys: [],
    keyIndex: index,
    keyCount: keys.length,
    keyId: `${namespace}:${index + 1}:${fingerprintKey(apiKey)}`,
  }));
}

export function isQuotaFailure(status, message = "") {
  const code = Number(status || 0);
  const text = String(message || "").toLowerCase();
  return (
    [401, 402, 403, 429].includes(code) ||
    /quota|rate.?limit|exhausted|insufficient|billing|payment|too many requests|resource_exhausted|over quota|limit reached|credits? (?:depleted|exceeded)/i.test(text)
  );
}

/**
 * In-memory cooldown tracker. When a key returns a quota/auth error, skip it
 * for a short window so the next request goes straight to a working key. If
 * every key is cooling down (e.g. quotas reset early), clear the cooldowns and
 * try the whole pool again.
 */
export class KeyCooldowns {
  constructor({ cooldownMs = 60_000, now = () => Date.now(), store = new Map() } = {}) {
    this.cooldownMs = Math.max(1000, Number(cooldownMs) || 60_000);
    this.now = now;
    this.store = store;
  }

  isCooling(keyId, at = this.now()) {
    if (!keyId) return false;
    const retryAt = this.store.get(keyId);
    if (!retryAt) return false;
    if (retryAt <= at) {
      this.store.delete(keyId);
      return false;
    }
    return true;
  }

  mark(keyId, cooldownMs = this.cooldownMs, at = this.now()) {
    if (!keyId) return;
    this.store.set(keyId, at + Math.max(1000, Number(cooldownMs) || this.cooldownMs));
  }

  select(upstreams = [], at = this.now()) {
    const active = upstreams.filter((upstream) => !this.isCooling(upstream?.keyId, at));
    if (active.length) return active;
    if (this.store.size) this.store.clear();
    return upstreams;
  }

  clear(keyId) {
    if (keyId) this.store.delete(keyId);
    else this.store.clear();
  }

  status(at = this.now()) {
    return [...this.store.entries()]
      .filter(([, retryAt]) => retryAt > at)
      .map(([keyId, retryAt]) => ({ keyId, retryInMs: retryAt - at }));
  }
}
