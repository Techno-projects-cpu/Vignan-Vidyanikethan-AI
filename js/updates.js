/**
 * Releases are applied, not offered.
 *
 * A new worker installs, takes over immediately (`skipWaiting` in sw.js) and the
 * page reloads once, by itself. There is no banner, no "Later", no setting to
 * press: publishing a release is the whole gesture, and every open tab picks it
 * up within a minute.
 *
 * One thing is still respected — a student is never reloaded on top of their own
 * work. The watcher waits while an answer is being written, and while a question
 * sits in the box unsent, then reloads by itself. That is a delay, not a
 * permission prompt.
 *
 * Everything here degrades quietly when the browser has no service worker
 * (Safari private mode, file://, older browsers): the page still loads the new
 * release on its next visit, because the app is served network-first.
 */

/** Release the page itself was loaded from: "./js/app.js?v=56" → "45". */
export const RELEASE = new URL(import.meta.url).searchParams.get("v") || "dev";

/** "const CACHE_NAME = \"vignan-vidyanikethan-ai-v45\"" → "45". */
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

/**
 * May the page reload right now?
 *
 * Only one reason to say no: an answer is being written and reloading would
 * throw it away. `busy` covers that. Hidden tabs reload instantly — nobody is
 * reading them.
 */
export function shouldReloadNow({ busy = false } = {}) {
  return !busy;
}

/**
 * Watch the worker and reload once a new release takes control.
 *
 * `shouldWait()` is asked at the moment control changes; if it says yes, the
 * watcher tries again shortly, so the update still lands without being asked.
 *
 * @returns {() => void} stop watching
 */
export function startUpdateWatch(
  registration,
  { container = globalThis, retryMs = 2000, shouldWait = () => false } = {},
) {
  if (!registration) return () => {};
  const workers = container.navigator?.serviceWorker;
  if (!workers?.addEventListener) return () => {};

  let reloading = false;
  let retryTimer = 0;
  let stopped = false;
  let hadController = Boolean(workers.controller);

  const reload = () => {
    if (stopped || reloading) return;
    if (!shouldReloadNow({ busy: shouldWait() })) {
      container.clearTimeout?.(retryTimer);
      retryTimer = container.setTimeout(reload, retryMs);
      return;
    }
    reloading = true;
    container.location?.reload?.();
  };

  const onControlChange = () => {
    // The first controller of a fresh install is not an update: the page in
    // front of the student is already the new release.
    if (!hadController) {
      hadController = true;
      return;
    }
    reload();
  };

  const onVisibility = () => {
    if (container.document?.visibilityState === "hidden") reload();
  };

  const onOnline = () => {
    // Not a promise to fetch anything: the browser decides, and offline simply
    // means the call resolves with no new worker.
    registration.update?.().catch?.(() => {});
  };

  workers.addEventListener("controllerchange", onControlChange);
  container.document?.addEventListener?.("visibilitychange", onVisibility);
  container.addEventListener?.("online", onOnline);

  return () => {
    stopped = true;
    container.clearTimeout?.(retryTimer);
    workers.removeEventListener?.("controllerchange", onControlChange);
    container.document?.removeEventListener?.("visibilitychange", onVisibility);
    container.removeEventListener?.("online", onOnline);
  };
}
