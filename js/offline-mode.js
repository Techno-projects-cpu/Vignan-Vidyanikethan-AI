/**
 * Offline mode.
 *
 * The app has always worked without Wi-Fi: the pages are on the device, the
 * search index is local, and the answer comes from the student's own text. What
 * it did not have was a way to *say so* and then act like it. A student standing
 * in front of a judge with unreliable Wi-Fi still saw "A new version is ready"
 * on every visit, could still send a question to Wikipedia, and still watched the
 * friends panel try to reach a server that was not there.
 *
 * Offline mode closes that. When it is on:
 *   - no update checks, and no update banner,
 *   - no web fallback: the answer comes only from the pages on this device,
 *   - no account, friends, chat, leaderboard or game calls,
 *   - everything local keeps working: cited answers, quizzes, flashcards,
 *     study sheets, the revision plan, mock papers, evaluation, the viva.
 *
 * The flag is written twice: inside the saved settings, and under its own key so
 * the network modules (auth, social, updates) can read it without importing the
 * whole settings model. Pure functions, no DOM, so it can be tested.
 */

export const OFFLINE_MODE_KEY = "vignan.offline-mode";

/** The release a student chose to postpone. One key, so "Later" is remembered. */
export const UPDATE_DEFERRED_KEY = "vignan.update-deferred";

/** What offline mode switches off, said in plain language for the interface. */
export const OFFLINE_MODE_NOTE =
  "Offline mode is on. Answers come only from the pages on this device: no update checks, no web search, no friends or leaderboard.";

/** Safe storage read: a locked-down browser must not break the app. */
function read(key, storage) {
  try {
    return storage?.getItem?.(key) ?? null;
  } catch {
    return null;
  }
}

function write(key, value, storage) {
  try {
    if (value === null) storage?.removeItem?.(key);
    else storage?.setItem?.(key, String(value));
    return true;
  } catch {
    return false;
  }
}

/** True when the student switched offline mode on. */
export function isOfflineMode(storage = globalThis.localStorage) {
  const value = read(OFFLINE_MODE_KEY, storage);
  return value === "1" || value === "true";
}

/** Turn offline mode on or off, and keep the standalone key in step. */
export function setOfflineMode(on, storage = globalThis.localStorage) {
  return write(OFFLINE_MODE_KEY, on ? "1" : null, storage);
}

/** The release a student asked to be reminded about later, or "". */
export function deferredVersion(storage = globalThis.localStorage) {
  return String(read(UPDATE_DEFERRED_KEY, storage) || "");
}

/** Remember "Later" for this release. An empty value forgets it. */
export function deferVersion(version, storage = globalThis.localStorage) {
  return write(UPDATE_DEFERRED_KEY, version ? String(version) : null, storage);
}

/**
 * Should the update banner appear at all?
 *
 * Not when offline mode is on (there is nothing to fetch and nothing to swap),
 * not when the browser is offline, and not for a release the student already
 * postponed. That last rule is the fix for the nag: "Later" now means later,
 * not "until the next page load".
 */
export function shouldAnnounceUpdate({
  remote = "",
  release = "",
  deferred = "",
  offlineMode = false,
  online = true,
} = {}) {
  if (offlineMode || !online) return false;
  const key = String(remote || "");
  if (!key) return true;
  if (deferred && (deferred === key || deferred === String(release || ""))) return false;
  return true;
}

/**
 * May this feature reach the network right now?
 *
 * Used by the web fallback and by the update check. `webEnabled` stays the
 * student's own preference; offline mode overrides it without erasing it, so
 * switching offline mode off restores exactly what they had chosen before.
 */
export function networkAllowed({ offlineMode = false, webEnabled = true, online = true } = {}) {
  return Boolean(webEnabled) && !offlineMode && online;
}

/** The sentence shown instead of an error when something needs a connection. */
export function offlineRefusal(action = "this") {
  return `${OFFLINE_MODE_LABEL} ${action} needs a connection, so it is switched off. Turn offline mode off in Settings to use it.`;
}

export const OFFLINE_MODE_LABEL = "Offline mode is on.";

/** Guard used by the network layer (auth, social, updates). */
export function blockInOfflineMode(storage = globalThis.localStorage) {
  if (!isOfflineMode(storage)) return false;
  const error = new Error(offlineRefusal("This"));
  error.offlineMode = true;
  return error;
}
