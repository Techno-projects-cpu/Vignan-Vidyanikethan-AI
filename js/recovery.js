/** Session-only resilience state. Never retain prompts, URLs, keys or error text. */
const circuits = new Map();
const listeners = new Set();
let recent = [];
let runtimeErrors = 0;
let monitoring = false;
const COOLDOWN_MS = 60000;

export function classifyFailure(error) {
  if (error?.name === 'AbortError') return 'cancelled';
  if (error?.name === 'TimeoutError') return 'timeout';
  if (error?.status === 401 || error?.status === 403) return 'credentials';
  if (error?.status === 429 || error?.code === 'ALL_KEYS_EXHAUSTED') return 'quota';
  if (error?.status >= 500) return 'service';
  if (error?.code === 'EMPTY_MODEL_RESPONSE') return 'empty-response';
  return 'unavailable';
}

// A non-persisted fingerprint changes when endpoint/model/keys change.
// Fingerprints are internal routing identifiers, never included in diagnostics.
export function routeIdentity(provider) {
  const value = JSON.stringify([provider?.id, provider?.endpoint, provider?.model, provider?.apiKey, provider?.apiKeys]);
  let hash = 2166136261;
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `${provider?.id}:${hash >>> 0}`;
}
export function routeCooling(identity, now = Date.now()) {
  return (circuits.get(identity)?.until || 0) > now;
}
export function recordRouteFailure(identity, now = Date.now()) {
  const entry = circuits.get(identity) || { failures: 0, until: 0 };
  entry.failures++;
  if (entry.failures >= 2) entry.until = now + COOLDOWN_MS;
  circuits.delete(identity);
  circuits.set(identity, entry);
  while (circuits.size > 24) circuits.delete(circuits.keys().next().value);
}
export function recordRouteSuccess(identity) { circuits.delete(identity); }
export function recoverySnapshot() {
  return { recent: recent.map(entry => ({ ...entry })), runtimeErrors,
    coolingRoutes: [...circuits.values()].filter(entry => entry.until > Date.now()).length };
}
export function reportRecovery(kind, providerId = 'offline') {
  const allowed = ['server', 'webllm', 'offline', 'ollama', 'lmstudio', 'openai', 'anthropic', 'gemini', 'groq', 'openrouter', 'mistral', 'cohere', 'cloudflare', 'deepseek', 'together', 'arena', 'custom'];
  const kinds = ['timeout', 'credentials', 'quota', 'service', 'empty-response', 'unavailable', 'cooldown', 'network-offline', 'recovered', 'offline-fallback', 'online', 'runtime-error', 'reset', 'primary-success'];
  recent.push({ kind: kinds.includes(kind) ? kind : 'unavailable', providerId: allowed.includes(providerId) ? providerId : 'custom' });
  recent = recent.slice(-8);
  for (const listener of listeners) { try { listener(recoverySnapshot()); } catch { /* diagnostics must not break study */ } }
}
export function subscribeRecovery(listener) {
  listeners.add(listener);
  listener(recoverySnapshot());
  return () => listeners.delete(listener);
}
export function resetRecovery() {
  circuits.clear(); recent = []; runtimeErrors = 0;
  reportRecovery('reset');
}
export function initRecoveryMonitoring(target = globalThis) {
  if (monitoring || !target.addEventListener) return;
  monitoring = true;
  const runtime = () => { runtimeErrors++; reportRecovery('runtime-error'); };
  // Observe only: do not suppress errors, resend questions or auto-reload a form.
  target.addEventListener('error', runtime);
  target.addEventListener('unhandledrejection', runtime);
  target.addEventListener('offline', () => reportRecovery('network-offline'));
  target.addEventListener('online', () => { circuits.clear(); reportRecovery('online'); });
}

export function recoveryMessage(snapshot = recoverySnapshot()) {
  const latest = snapshot.recent.at(-1);
  if (!latest || latest.kind === 'reset') return 'Automatic recovery is ready. A loaded local model can take over; otherwise textbook lookup stays available. No automatic model downloads.';
  if (latest.kind === 'primary-success') return 'Your selected AI responded successfully. Automatic recovery remains on standby.';
  if (latest.kind === 'recovered') return latest.providerId === 'webllm' ? 'Recovered with Nova: this answer is running on your device.' : 'Recovered using your configured fallback model.';
  if (latest.kind === 'offline-fallback') return 'AI is unavailable. Using offline textbook lookup. To prepare Nova for next time, load a model in Settings → AI.';
  if (latest.kind === 'runtime-error') return 'A screen error was detected. If controls stop responding, reload the page. Saved books remain on this device.';
  if (latest.kind === 'network-offline') return 'Network unavailable. Ready local AI and saved textbook study remain available; online features may not work.';
  if (latest.kind === 'online') return 'Network connection restored. Paused AI routes can be tried again; no question was resent.';
  return 'An AI route failed or is temporarily paused. Trying an available fallback without changing your saved model choices.';
}
