/**
 * Premium minimal shell: command menu, AI nickname chooser and hero actions.
 *
 * All original feature IDs remain in index.html. This module only adds a
 * second, calmer way to reach them; the underlying app keeps its own event
 * wiring. Motion is limited to opacity/transform and respects reduced motion.
 */

import { aiProfile, allAIProfiles, FEATURED_AI_IDS } from "./ai-nicknames.js?v=13";
import { pulseElement } from "./motion.js?v=13";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
let callbacks = {};
let currentAI = "offline";
let closeTimer = 0;
let commandInerted = [];
let commandReturnFocus = null;

function button(className, dataset = {}) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = className;
  for (const [key, value] of Object.entries(dataset)) element.dataset[key] = value;
  return element;
}

function optionMarkup(element, profile, { command = false, index = 0 } = {}) {
  const indexEl = document.createElement("span");
  indexEl.className = "ai-option-index";
  indexEl.setAttribute("aria-hidden", "true");
  indexEl.textContent = profile.id === "offline" ? "00" : String(Math.max(1, index + 1)).padStart(2, "0");
  const copy = document.createElement("span");
  copy.className = "ai-option-copy";
  const name = document.createElement("strong");
  name.textContent = profile.nickname;
  const specialty = document.createElement("small");
  specialty.textContent = profile.specialty;
  copy.append(name, specialty);
  const tag = document.createElement("span");
  tag.className = "ai-option-tag";
  tag.textContent = profile.id === "offline" ? "BUILT IN" : "MODEL";
  element.replaceChildren(indexEl, copy, tag);
  element.dataset.provider = profile.id;
  element.dataset.nickname = profile.nickname;
  element.dataset.specialty = profile.specialty;
  element.dataset.keywords = `${profile.nickname} ${profile.specialty} ${profile.id} ai model nickname`;
  if (command) element.classList.add("command-item");
  // Let the visible nickname, specialty and tag form the accessible name.
  return element;
}

function renderAIChoosers() {
  const chooser = $("#ai-chooser-menu");
  if (chooser) {
    const heading = $(".ai-chooser-head", chooser);
    const note = $(".ai-chooser-note", chooser);
    chooser.replaceChildren(...[heading, note].filter(Boolean));
    FEATURED_AI_IDS.forEach((id, index) => {
      const option = button("ai-option");
      chooser.appendChild(optionMarkup(option, aiProfile(id), { index }));
    });
  }
  const directory = $("#command-ai-list");
  if (directory) {
    directory.replaceChildren();
    allAIProfiles().forEach((profile, index) => {
      const option = button("ai-option command-ai-option");
      directory.appendChild(optionMarkup(option, profile, { command: true, index }));
    });
  }
}

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
    trigger.title = "Choose another AI";
  }
  $$(".ai-option").forEach((option) => {
    option.classList.toggle("active", option.dataset.provider === profile.id);
    option.setAttribute("aria-pressed", String(option.dataset.provider === profile.id));
  });
  document.body.dataset.ai = profile.id;
  if (id !== "offline") pulseElement(trigger);
}

export function setPremiumView(view = "ask") {
  const labels = {
    ask: "Ask",
    library: "Library",
    quiz: "Quiz",
    flashcards: "Flashcards",
    progress: "Progress",
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
  closeAIChooser();
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

function openAIChooser() {
  const menu = $("#ai-chooser-menu");
  const trigger = $("#premium-ai-trigger");
  if (!menu || !trigger) return;
  menu.hidden = false;
  trigger.setAttribute("aria-expanded", "true");
}

function closeAIChooser() {
  const menu = $("#ai-chooser-menu");
  const trigger = $("#premium-ai-trigger");
  if (menu) menu.hidden = true;
  trigger?.setAttribute("aria-expanded", "false");
}

function toggleAIChooser() {
  const menu = $("#ai-chooser-menu");
  if (!menu || menu.hidden) openAIChooser();
  else closeAIChooser();
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

  $("#premium-ai-trigger")?.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleAIChooser();
  });
  $("#premium-close-ai")?.addEventListener("click", closeAIChooser);

  document.addEventListener("click", (event) => {
    const aiOption = event.target.closest?.(".ai-option");
    if (aiOption?.dataset.provider) {
      closeAIChooser();
      if (aiOption.classList.contains("command-item")) closeCommandMenu();
      callbacks.onAi?.(aiOption.dataset.provider);
      return;
    }
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
    if (!event.target.closest?.("#ai-chooser")) closeAIChooser();
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
      closeAIChooser();
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
  renderAIChoosers();
  bind();
  setPremiumAI(options.currentAI || currentAI);
  setPremiumView(options.currentView || "ask");
  setSourcesOpen(false);
}

export { openAIChooser, closeAIChooser };
