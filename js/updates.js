/**
 * Update handling for the installed app.
 *
 * The service worker no longer swaps itself in silently: a new worker installs,
 * then waits. The page decides when to take it — the student taps "Update now",
 * or keeps working and updates later. Everything here degrades quietly when the
 * browser has no service worker (Safari private mode, file://, older browsers).
 *
 * The pure helpers are exported so they can be tested without a browser.
 */

/** Release the page itself was loaded from: "./js/app.js?v=22" → "22". */
export const RELEASE = new URL(import.meta.url).searchParams.get("v") || "dev";

const CACHE_PREFIX = "vignan-vidyanikethan-ai-v";

/** "const CACHE_NAME = \"vignan-vidyanikethan-ai-v22\"" → "22". */
export function parseCacheVersion(source = "") {
  const match = String(source || "").match(/vignan-vidyanikethan-ai-v(\d+)/);
  return match ? match[1] : "";
}

/** True when `remote` is a later release than `current`. */
export function isNewer(remote, current) {
  const next = Number.parseInt(String(remote), 10);
  const now = Number.parseInt(String(current), 10);
  if (!Number.isFinite(next) || !Number.isFinite(now)) return false;
  return next > now;
}

/** The sentence shown in the update banner. Kept pure so it can be tested. */
export function updateBannerText({ current = RELEASE, remote = "" } = {}) {
  const versions = remote && remote !== current ? ` · ${current} → ${remote}` : "";
  return `A new version is ready${versions}. Your books, decks and chats stay on this device.`;
}

/**
 * Read the worker's cache version from the server. Cache-busted, and never
 * allowed to throw: offline simply means "no answer".
 */
export async function fetchRemoteVersion(fetchImpl = globalThis.fetch) {
  try {
    const response = await fetchImpl(`./sw.js?check=${Date.now()}`, { cache: "no-store" });
    if (!response?.ok) return { ok: false, version: "", reason: "unreachable" };
    return { ok: true, version: parseCacheVersion(await response.text()), reason: "" };
  } catch {
    return { ok: false, version: "", reason: "offline" };
  }
}

/**
 * Ask the browser to look for a new worker.
 * @returns {Promise<{status:'updated'|'available'|'current'|'offline'|'unsupported', remote:string}>}
 */
export async function checkForUpdate(registration, { online = globalThis.navigator?.onLine !== false } = {}) {
  if (!registration) return { status: "unsupported", remote: "" };
  if (!online) return { status: "offline", remote: "" };
  const remote = await fetchRemoteVersion();
  try {
    await registration.update();
  } catch {
    return { status: remote.ok ? "current" : "offline", remote: remote.version };
  }
  if (registration.waiting || registration.installing) {
    return { status: "available", remote: remote.version };
  }
  if (remote.ok && isNewer(remote.version, RELEASE)) return { status: "available", remote: remote.version };
  return { status: "current", remote: remote.version };
}

/**
 * Hand control to the waiting worker and reload once it takes over.
 * Resolves after the reload is requested; the page may disappear first.
 */
export async function applyUpdate(registration, { reload = true, container = globalThis } = {}) {
  const waiting = registration?.waiting;
  if (!waiting) return false;
  await new Promise((resolve) => {
    const timer = container.setTimeout(resolve, 3000);
    const onChange = () => {
      container.clearTimeout(timer);
      container.navigator?.serviceWorker?.removeEventListener?.("controllerchange", onChange);
      resolve();
    };
    container.navigator?.serviceWorker?.addEventListener?.("controllerchange", onChange);
    waiting.postMessage({ type: "SKIP_WAITING" });
  });
  if (reload) container.location?.reload?.();
  return true;
}

/**
 * Watch for updates: when the app comes back online, when the tab is shown, and
 * on a slow timer. Calls `onAvailable({ remote, registration })` at most once
 * per version so the banner does not nag.
 */
export function startUpdateWatch(registration, { onAvailable, onStatus, intervalMs = 30 * 60 * 1000, container = globalThis } = {}) {
  if (!registration) return () => {};
  let announced = "";
  let stopped = false;

  const announce = async (remote = "") => {
    if (stopped) return;
    const key = remote || "waiting";
    if (announced === key) return;
    announced = key;
    onAvailable?.({ remote, registration });
  };

  const look = async () => {
    const result = await checkForUpdate(registration, { online: container.navigator?.onLine !== false });
    onStatus?.(result);
    if (result.status === "available") await announce(result.remote);
    return result;
  };

  // A worker that is already waiting (for example after a reload) counts too.
  if (registration.waiting) announce("");
  registration.addEventListener?.("updatefound", () => {
    const worker = registration.installing;
    worker?.addEventListener?.("statechange", () => {
      if (worker.state === "installed" && container.navigator?.serviceWorker?.controller) announce("");
    });
  });

  container.addEventListener?.("online", look);
  container.document?.addEventListener?.("visibilitychange", () => {
    if (container.document.visibilityState === "visible") look();
  });
  const timer = container.setInterval(look, intervalMs);

  return () => {
    stopped = true;
    container.clearInterval(timer);
    container.removeEventListener?.("online", look);
  };
}

/** Label used by the Settings card. */
export function updateStatusLabel(status = "") {
  switch (status) {
    case "updated": return "Updated.";
    case "available": return "A new version is available.";
    case "current": return "You are on the latest version.";
    case "offline": return "Offline — the update check needs a connection.";
    default: return "This browser does not support app updates.";
  }
}
