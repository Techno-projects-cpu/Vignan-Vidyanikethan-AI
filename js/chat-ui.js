/**
 * Chat screen: the Study Hall plus private conversations with friends.
 *
 * One poll per open conversation, incremental fetches, and a composer that
 * stays above the phone keyboard. Nothing is sent unless the server confirms
 * the sender is a friend or the room is the shared Study Hall.
 */

import { decorateAvatar } from "./avatars.js?v=37";
import * as ui from "./ui.js?v=37";
import { onSocialChange, setActiveThread, social, socialState, syncSocial } from "./social.js?v=37";
import { relativeTime } from "./friends-ui.js?v=37";

const $ = (selector, root = document) => root.querySelector(selector);
const POLL_MS = 4000;

const chat = {
  threadId: "",
  kind: "",
  title: "",
  messages: [],
  lastAt: "",
  loading: false,
  sending: false,
  timer: null,
  error: "",
  initialised: false,
};

const openView = (view) => window.dispatchEvent(new CustomEvent("vignan:view", { detail: { view } }));

function scrollToBottom(force = false) {
  const log = $("#chat-messages");
  if (!log) return;
  const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 120;
  if (force || nearBottom) log.scrollTop = log.scrollHeight;
}

function timeLabel(value) {
  const time = Date.parse(value || "");
  if (!Number.isFinite(time)) return "";
  return new Date(time).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function renderMessage(row) {
  const wrap = ui.element("div", `chat-message${row.mine ? " mine" : ""}`);
  const meta = ui.element("div", "chat-message-meta");
  meta.appendChild(ui.element("span", "chat-message-name", row.mine ? "You" : row.name));
  meta.appendChild(ui.element("span", "chat-message-time", timeLabel(row.at)));
  wrap.appendChild(meta);
  const bubble = ui.element("p", "chat-bubble");
  bubble.textContent = row.body;
  wrap.appendChild(bubble);
  return wrap;
}

export function renderChat() {
  const shell = $("#chat-shell");
  if (!shell || !chat.initialised) return;
  const app = socialState();
  const list = $("#chat-thread-list");
  const log = $("#chat-messages");

  if (!app.signedIn) {
    if (list) list.textContent = "";
    if (log) {
      log.textContent = "";
      const gate = ui.element("div", "social-gate");
      gate.appendChild(ui.element("h3", "", "Chat needs a student account"));
      gate.appendChild(ui.element("p", "", "Log in to join the Study Hall or message a friend. Questions and quizzes still work as a guest."));
      const actions = ui.element("div", "social-gate-actions");
      const go = ui.element("button", "button primary", "Log in or register");
      go.type = "button";
      go.addEventListener("click", () => openView("progress"));
      actions.appendChild(go);
      gate.appendChild(actions);
      log.appendChild(gate);
    }
    shell.dataset.mode = "room";
    return;
  }

  const data = app.data;
  if (list && data) {
    list.textContent = "";
    const threads = data.threads || [];
    const hall = threads.find((row) => row.kind === "hall");
    const direct = threads.filter((row) => row.kind === "dm");
    const ordered = [...(hall ? [hall] : []), ...direct];
    if (!ordered.length) {
      list.appendChild(ui.element("p", "social-hint", "No conversations yet. Add a friend, then tap Message."));
    }
    for (const thread of ordered) {
      const node = ui.element("button", `chat-thread${thread.id === chat.threadId ? " active" : ""}`);
      node.type = "button";
      const mark = ui.element("span", `social-avatar${thread.kind === "hall" ? " hall" : ""}`);
      if (thread.kind === "hall") {
        mark.textContent = "☰";
      } else {
        // Same monogram and pattern as the Friends list, so threads are easy to spot.
        decorateAvatar(mark, { name: thread.title || "?", seed: thread.avatarSeed, online: thread.online });
      }
      node.appendChild(mark);
      const copy = ui.element("span", "chat-thread-copy");
      copy.appendChild(ui.element("strong", "", thread.title || "Conversation"));
      copy.appendChild(ui.element("small", "", thread.preview || (thread.kind === "hall" ? "Say hello to everyone revising now" : "No messages yet")));
      node.appendChild(copy);
      const meta = ui.element("span", "chat-thread-meta");
      meta.appendChild(ui.element("span", "chat-thread-time", relativeTime(thread.lastAt)));
      node.appendChild(meta);
      node.addEventListener("click", () => openThread({ threadId: thread.id }));
      list.appendChild(node);
    }
  }

  if (log) {
    log.textContent = "";
    if (!chat.threadId) {
      log.appendChild(ui.emptyState("✦", "Pick a conversation", "Study Hall is open to every student. Private chats need a friendship."));
    } else if (chat.error) {
      log.appendChild(ui.element("p", "social-hint", chat.error));
    } else if (!chat.messages.length) {
      log.appendChild(ui.emptyState("✎", chat.kind === "hall" ? "The hall is quiet" : "Say hello", "Keep it academic and kind."));
    } else {
      let lastDay = "";
      for (const row of chat.messages) {
        const day = new Date(row.at).toDateString();
        if (day !== lastDay) {
          log.appendChild(ui.element("div", "chat-day", day === new Date().toDateString() ? "Today" : new Date(row.at).toLocaleDateString(undefined, { day: "numeric", month: "short" })));
          lastDay = day;
        }
        log.appendChild(renderMessage(row));
      }
    }
    scrollToBottom(true);
  }

  $("#chat-title").textContent = chat.threadId ? chat.title || "Conversation" : "Chat";
  const sub = $("#chat-sub");
  if (sub) {
    if (chat.kind === "hall") sub.textContent = "Study Hall · everyone signed in";
    else if (chat.threadId) sub.textContent = chat.online ? "Friend · online" : "Private chat with a friend";
    else sub.textContent = "Friends and the Study Hall";
  }
  $("#chat-back").hidden = !chat.threadId;
  const composer = $("#chat-input");
  if (composer) composer.disabled = !chat.threadId || chat.sending;
  $("#chat-send").disabled = !chat.threadId || chat.sending;
  shell.dataset.mode = chat.threadId ? "room" : "list";
}

async function loadMessages({ reset = false } = {}) {
  if (!chat.threadId) return;
  try {
    const data = await social.messages(chat.threadId, reset ? "" : chat.lastAt);
    const incoming = data.messages || [];
    if (reset) {
      chat.messages = incoming;
    } else if (incoming.length) {
      const seen = new Set(chat.messages.map((row) => row.id));
      chat.messages.push(...incoming.filter((row) => !seen.has(row.id)));
    }
    chat.lastAt = chat.messages.at(-1)?.at || "";
    chat.error = "";
  } catch (error) {
    chat.error = error.status === 403 ? "You do not have access to this conversation." : error.message;
  }
  renderChat();
}

function schedulePoll() {
  if (chat.timer) clearInterval(chat.timer);
  chat.timer = setInterval(() => {
    if (document.visibilityState === "hidden" || !chat.threadId) return;
    if (document.activeElement === $("#chat-input")) return;
    loadMessages().catch(() => {});
  }, POLL_MS);
}

export async function openThread({ threadId = "", friendId = "" } = {}) {
  if (!threadId && !friendId) return;
  chat.loading = true;
  chat.error = "";
  try {
    const data = await social.openChat(threadId ? { threadId } : { friendId });
    chat.threadId = data.thread.id;
    chat.kind = data.thread.kind;
    chat.title = data.thread.title;
    chat.online = Boolean(data.thread.online);
    chat.messages = [];
    chat.lastAt = "";
    setActiveThread(chat.threadId);
    await loadMessages({ reset: true });
    schedulePoll();
    openView("chat");
    const input = $("#chat-input");
    if (input) input.focus({ preventScroll: true });
  } catch (error) {
    ui.showToast(error.message, "error");
  } finally {
    chat.loading = false;
    renderChat();
  }
}

function closeThread() {
  chat.threadId = "";
  chat.kind = "";
  chat.title = "";
  chat.messages = [];
  chat.lastAt = "";
  chat.error = "";
  setActiveThread("");
  if (chat.timer) clearInterval(chat.timer);
  chat.timer = null;
  renderChat();
}

async function sendMessage(event) {
  event?.preventDefault();
  const input = $("#chat-input");
  if (!input || !chat.threadId || chat.sending) return;
  const body = input.value.trim();
  if (!body) return;
  chat.sending = true;
  renderChat();
  try {
    const data = await social.send(chat.threadId, body);
    chat.messages.push(data.message);
    chat.lastAt = data.message.at;
    input.value = "";
    input.style.height = "";
    chat.error = "";
    renderChat();
    scrollToBottom(true);
    syncSocial().catch(() => {});
  } catch (error) {
    ui.showToast(error.message, "error");
  } finally {
    chat.sending = false;
    renderChat();
    input.focus({ preventScroll: true });
  }
}

function initComposer() {
  const form = $("#chat-form");
  const input = $("#chat-input");
  if (!form || !input) return;
  form.addEventListener("submit", sendMessage);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage(event);
    }
  });
  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = `${Math.min(120, input.scrollHeight)}px`;
  });
}

export function initChatUI() {
  if (chat.initialised) return;
  chat.initialised = true;
  initComposer();
  $("#chat-back")?.addEventListener("click", closeThread);
  $("#chat-hall")?.addEventListener("click", () => {
    const hall = socialState().data?.threads?.find((row) => row.kind === "hall");
    if (hall) openThread({ threadId: hall.id });
    else socialState().data?.studyHallId && openThread({ threadId: socialState().data.studyHallId });
  });
  window.addEventListener("vignan:open-chat", (event) => {
    const detail = event.detail || {};
    if (detail.play && detail.friendId) {
      openView("play");
      window.dispatchEvent(new CustomEvent("vignan:play-invite", { detail: { friendId: detail.friendId } }));
      return;
    }
    openThread(detail);
  });
  onSocialChange(() => renderChat());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && chat.threadId) loadMessages().catch(() => {});
  });
  renderChat();
}

export function chatThread() {
  return { threadId: chat.threadId, kind: chat.kind, title: chat.title };
}
