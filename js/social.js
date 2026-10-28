/**
 * Client for the social layer: friends, notifications, chat and games.
 *
 * Every call goes through the same cookie session and CSRF header as accounts.
 * All rules are enforced on the server; this module only keeps the screens in
 * sync and makes retries readable.
 */

import { authApiUrl } from "./auth.js?v=16";

const REQUEST_TIMEOUT = 15000;
const CSRF_COOKIE = "vignan_csrf";
const POLL_MS = 20000;

function csrfToken() {
  try {
    for (const part of document.cookie.split(";")) {
      const [key, ...rest] = part.trim().split("=");
      if (key === CSRF_COOKIE) return decodeURIComponent(rest.join("="));
    }
  } catch {
    // Ignore malformed cookies.
  }
  return "";
}

const listeners = new Set();
const state = {
  loaded: false,
  loading: false,
  signedIn: false,
  error: "",
  data: null,
  catalogue: [],
  timer: null,
  gameId: "",
  threadId: "",
};

export function socialState() {
  return state;
}

export function onSocialChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  for (const listener of listeners) {
    try {
      listener(state);
    } catch (error) {
      console.warn("social listener failed", error);
    }
  }
}

export class SocialClientError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = "SocialClientError";
    this.status = status;
  }
}

async function api(path, { method = "GET", body, signal } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    const headers = { "X-Vignan-Client": "1" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const token = csrfToken();
    if (token) headers["X-CSRF-Token"] = token;
    const response = await fetch(authApiUrl(path), {
      method,
      credentials: "include",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });
    let data = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }
    if (!response.ok || data.ok === false) {
      const message = data.error || (response.status === 401
        ? "Log in with your student account to use friends, chat and games."
        : "The server could not complete that request. Please try again.");
      throw new SocialClientError(message, response.status);
    }
    return data;
  } catch (error) {
    if (error.name === "AbortError" || error.name === "TimeoutError") {
      throw new SocialClientError("That took too long. Check your connection and try again.", 0);
    }
    if (error instanceof SocialClientError) throw error;
    throw new SocialClientError("The social server could not be reached.", 0);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}

export async function syncSocial({ silent = true } = {}) {
  if (state.loading) return state.data;
  state.loading = true;
  if (!silent) emit();
  try {
    const data = await api("social/state");
    state.data = data;
    state.signedIn = true;
    state.error = "";
    state.loaded = true;
  } catch (error) {
    state.signedIn = error.status !== 401;
    state.error = error.message;
    if (error.status === 401) state.data = null;
  } finally {
    state.loading = false;
    emit();
  }
  return state.data;
}

/** Called after a successful login so badges fill in immediately. */
export function resetSocial() {
  state.data = null;
  state.loaded = false;
  state.signedIn = false;
  state.threadId = "";
  state.gameId = "";
  emit();
}

export function startSocialPolling() {
  if (state.timer) return;
  const tick = () => {
    if (document.visibilityState === "hidden") return;
    syncSocial().catch(() => {});
  };
  state.timer = setInterval(tick, POLL_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") syncSocial().catch(() => {});
  });
  syncSocial().catch(() => {});
}

export function stopSocialPolling() {
  if (state.timer) clearInterval(state.timer);
  state.timer = null;
}

export const social = {
  state: () => api("social/state"),
  people: (query) => api(`social/people?q=${encodeURIComponent(query)}`),
  requestFriend: (username) => api("social/friends/request", { method: "POST", body: { username } }),
  respondFriend: (requestId, accept) => api("social/friends/respond", { method: "POST", body: { requestId, accept } }),
  removeFriend: (userId) => api("social/friends/remove", { method: "POST", body: { userId } }),
  markRead: (ids = null) => api("social/notifications/read", { method: "POST", body: ids ? { ids } : {} }),
  openChat: (payload) => api("social/chat/open", { method: "POST", body: payload }),
  messages: (threadId, after = "") =>
    api(`social/chat/messages?threadId=${encodeURIComponent(threadId)}${after ? `&after=${encodeURIComponent(after)}` : ""}`),
  send: (threadId, body) => api("social/chat/send", { method: "POST", body: { threadId, body } }),
  catalogue: async () => {
    if (state.catalogue.length) return state.catalogue;
    const data = await api("games/catalogue");
    state.catalogue = data.games || [];
    return state.catalogue;
  },
  createGame: (kind, friendId = "") => api("games/create", { method: "POST", body: { kind, friendId } }),
  quickMatch: (kind) => api("games/quick", { method: "POST", body: { kind } }),
  joinGame: (payload) => api("games/join", { method: "POST", body: payload }),
  move: (gameId, move) => api("games/move", { method: "POST", body: { gameId, move } }),
  resign: (gameId) => api("games/resign", { method: "POST", body: { gameId } }),
  game: (gameId) => api(`games/${encodeURIComponent(gameId)}`),
};

export function unreadCount() {
  return Number(state.data?.unread) || 0;
}

export function friendRequests() {
  return state.data?.requests?.incoming || [];
}

export function setActiveGame(gameId = "") {
  state.gameId = gameId;
  emit();
}

export function setActiveThread(threadId = "") {
  state.threadId = threadId;
  emit();
}
