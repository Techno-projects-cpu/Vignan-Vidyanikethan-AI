/**
 * Premium minimal shell: command menu, AI nickname chooser and hero actions.
 *
 * All original feature IDs remain in index.html. This module only adds a
 * second, calmer way to reach them; the underlying app keeps its own event
 * wiring. Motion is limited to opacity/transform and respects reduced motion.
 */

import { aiProfile, allAIProfiles, FEATURED_AI_IDS } from "./ai-nicknames.js";
import { pulseElement } from "./motion.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
let callbacks = {};
let currentAI = "offline";
let closeTimer = 0;

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
  element.setAttribute("aria-label", `${profile.nickname}. ${profile.specialty}`);
  return element;
}

function renderAIChoosers() {
  const chooser = $("#ai-chooser-menu");
  if (chooser) {
    chooser.replaceChildren();
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
    trigger.setAttribute("aria-label", `AI: ${profile.nickname}. ${profile.specialty}. Choose another AI`);
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
  if (!overlay) return;
  globalThis.clearTimeout?.(closeTimer);
  overlay.hidden = false;
  overlay.setAttribute("aria-hidden", "false");
  closeAIChooser();
  requestAnimationFrame(() => {
    overlay.classList.add("open");
    $("#command-search")?.focus({ preventScroll: true });
  });
}

export function closeCommandMenu() {
  const overlay = $("#command-overlay");
  if (!overlay || overlay.hidden) return;
  overlay.classList.remove("open");
  overlay.setAttribute("aria-hidden", "true");
  closeTimer = globalThis.setTimeout?.(() => {
    overlay.hidden = true;
    const search = $("#command-search");
    if (search) search.value = "";
    filterCommands("");
  }, 150);
}

export function toggleCommandMenu() {
  const overlay = $("#command-overlay");
  if (!overlay || overlay.hidden) openCommandMenu();
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
      callbacks.onAi?.(aiOption.dataset.provider);
      closeAIChooser();
      if (aiOption.classList.contains("command-item")) closeCommandMenu();
      return;
    }
    const command = event.target.closest?.(".command-item");
    if (command) {
      if (command.dataset.view) callbacks.onView?.(command.dataset.view);
      else if (command.dataset.action) callbacks.onAction?.(command.dataset.action, command.dataset);
      else if (command.dataset.provider) callbacks.onAi?.(command.dataset.provider);
      closeCommandMenu();
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
    if (!overlay || overlay.hidden || event.key !== "Enter" || document.activeElement !== $("#command-search")) return;
    const first = $$(".command-item:not([hidden])", overlay)[0];
    if (first) {
      event.preventDefault();
      first.click();
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
