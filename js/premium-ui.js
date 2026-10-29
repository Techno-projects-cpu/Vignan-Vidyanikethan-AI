/**
 * Premium minimal shell: command menu, engine status and hero actions.
 *
 * All original feature IDs remain in index.html. This module only adds a
 * second, calmer way to reach them; the underlying app keeps its own event
 * wiring. Motion is limited to opacity/transform and respects reduced motion.
 */

import { aiProfile } from "./ai-nicknames.js?v=30";
import { pulseElement } from "./motion.js?v=30";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
let callbacks = {};
let currentAI = "offline";
let closeTimer = 0;
let commandInerted = [];
let commandReturnFocus = null;

export function setPremiumAI(id = "offline") {
  const profile = aiProfile(id);
  currentAI = profile.id;
  const trigger = $("#premium-ai-trigger");
  if (trigger) {
    trigger.dataset.provider = profile.id;
    const name = $("#premium-ai-name", trigger);
    const specialty = $("#premium-ai-specialty", trigger);
    if (name) name.textContent = profile.nickname;
    if (specialty) specialty.textContent = profile.specialty;
    trigger.removeAttribute("aria-label");
    trigger.title = "Current answer engine";
  }
  document.body.dataset.ai = profile.id;
  if (id !== "offline") pulseElement(trigger);
}

export function setPremiumView(view = "ask") {
  const labels = {
    ask: "Ask",
    library: "Library",
    quiz: "Quiz",
    exam: "Exams",
    flashcards: "Flashcards",
    progress: "Progress",
    friends: "Friends",
    chat: "Chat",
    play: "Play",
    settings: "Settings",
  };
  const label = labels[view] || labels.ask;
  const chip = $("#premium-view-label");
  if (chip) chip.textContent = label;
  $$(".command-item[data-view]").forEach((item) => {
    item.classList.toggle("active", item.dataset.view === view);
  });
}

export function openCommandMenu() {
  const overlay = $("#command-overlay");
  if (!overlay || $(".modal-overlay")) return;
  globalThis.clearTimeout?.(closeTimer);
  if (overlay.getAttribute("aria-hidden") !== "false") {
    commandReturnFocus = document.activeElement;
    commandInerted = [...(document.body?.children || [])]
      .filter((node) => node !== overlay && node.id !== "toast" && node.tagName !== "SCRIPT")
      .map((node) => { const wasInert = node.inert; node.inert = true; return [node, wasInert]; });
  }
  overlay.hidden = false;
  overlay.inert = false;
  overlay.setAttribute("aria-hidden", "false");
  requestAnimationFrame(() => {
    // A quick close can happen before this animation frame runs.
    if (overlay.hidden || overlay.getAttribute("aria-hidden") === "true") return;
    overlay.classList.add("open");
    $("#command-search")?.focus({ preventScroll: true });
  });
}

export function closeCommandMenu() {
  const overlay = $("#command-overlay");
  if (!overlay || overlay.hidden) return;
  const focusWasInside = overlay.contains?.(document.activeElement);
  overlay.classList.remove("open");
  overlay.setAttribute("aria-hidden", "true");
  overlay.inert = true;
  for (const [node, wasInert] of commandInerted) node.inert = wasInert;
  commandInerted = [];
  if (focusWasInside) {
    const returnFocus = commandReturnFocus?.isConnected ? commandReturnFocus : $("#command-menu-button");
    returnFocus?.focus({ preventScroll: true });
  }
  commandReturnFocus = null;
  closeTimer = globalThis.setTimeout?.(() => {
    overlay.hidden = true;
    const search = $("#command-search");
    if (search) search.value = "";
    filterCommands("");
  }, 150);
}

export function toggleCommandMenu() {
  const overlay = $("#command-overlay");
  if (!overlay || overlay.hidden || overlay.getAttribute("aria-hidden") === "true") openCommandMenu();
  else closeCommandMenu();
}

export function setSourcesOpen(open) {
  const layout = $("#view-ask .ask-layout");
  const button = $("#premium-sources-button");
  layout?.classList.toggle("show-sources", Boolean(open));
  button?.setAttribute("aria-expanded", String(Boolean(open)));
  if (button) button.textContent = open ? "Hide sources" : "Sources";
}

export function toggleSources() {
  const layout = $("#view-ask .ask-layout");
  setSourcesOpen(!layout?.classList.contains("show-sources"));
}

function filterCommands(query) {
  const q = String(query || "").trim().toLowerCase();
  const overlay = $("#command-overlay");
  if (!overlay) return;
  $$(".command-item, .ai-option", overlay).forEach((item) => {
    const haystack = `${item.dataset.keywords || ""} ${item.textContent || ""}`.toLowerCase();
    item.hidden = Boolean(q) && !haystack.includes(q);
  });
  $$(".command-group", overlay).forEach((group) => {
    const visible = $$(".command-item, .ai-option", group).some((item) => !item.hidden);
    group.hidden = !visible;
  });
  const empty = $("#command-empty");
  if (empty) empty.hidden = $$(".command-group:not([hidden])", overlay).length > 0;
}

function bind() {
  $("#command-menu-button")?.addEventListener("click", toggleCommandMenu);
  $("#command-close")?.addEventListener("click", closeCommandMenu);
  $("#command-overlay")?.addEventListener("click", (event) => {
    if (event.target?.id === "command-overlay") closeCommandMenu();
  });
  $("#command-search")?.addEventListener("input", (event) => filterCommands(event.target.value));

  document.addEventListener("click", (event) => {
    const command = event.target.closest?.(".command-item");
    if (command) {
      // Restore the workspace before an action opens a new modal or auth gate.
      closeCommandMenu();
      if (command.dataset.view) callbacks.onView?.(command.dataset.view);
      else if (command.dataset.action) callbacks.onAction?.(command.dataset.action, command.dataset);
      else if (command.dataset.provider) callbacks.onAi?.(command.dataset.provider);
      return;
    }
    const action = event.target.closest?.("[data-premium-action]");
    if (action) {
      callbacks.onAction?.(action.dataset.premiumAction, action.dataset);
      return;
    }
  });

  document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if ((event.metaKey || event.ctrlKey) && key === "k") {
      event.preventDefault();
      toggleCommandMenu();
      return;
    }
    if (event.key === "Escape") {
      closeCommandMenu();
      return;
    }
    const overlay = $("#command-overlay");
    if (!overlay || overlay.hidden || overlay.inert || overlay.getAttribute("aria-hidden") === "true") return;
    if (event.key === "Tab") {
      const focusable = $$('button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])', overlay)
        .filter((node) => node.getClientRects().length && !node.closest("[hidden], [inert]"));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !overlay.contains(document.activeElement))) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !overlay.contains(document.activeElement))) {
        event.preventDefault(); first?.focus();
      }
      return;
    }
    const commands = $$(".command-item:not([hidden])", overlay).filter((node) => node.getClientRects().length);
    if (["ArrowDown", "ArrowUp"].includes(event.key) && (document.activeElement === $("#command-search") || document.activeElement?.classList.contains("command-item"))) {
      const index = commands.indexOf(document.activeElement);
      const next = event.key === "ArrowDown" ? Math.min(index + 1, commands.length - 1) : index < 0 ? commands.length - 1 : Math.max(index - 1, 0);
      if (commands[next]) { event.preventDefault(); commands[next].focus(); }
      return;
    }
    if (event.key === "Enter" && document.activeElement === $("#command-search") && commands[0]) {
      event.preventDefault();
      commands[0].click();
    }
  });
}

export function initPremiumUI(options = {}) {
  callbacks = options;
  bind();
  setPremiumAI(options.currentAI || currentAI);
  setPremiumView(options.currentView || "ask");
  setSourcesOpen(false);
}
