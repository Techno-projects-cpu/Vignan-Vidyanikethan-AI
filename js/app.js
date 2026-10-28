/**
 * Vignan Vidyanikethan AI — application controller.
 *
 * Architecture: local textbook index -> evidence retrieval -> task-based model
 * router (existing AI providers) -> citation UI. The offline extractive engine
 * is the guaranteed fallback. No model is trained in this repository.
 */

import * as db from "./db.js";
import { retrieve, retrieveChapter } from "./retrieval.js";
import { ingestPdf, ingestText, ingestDemoPack } from "./ingest.js";
import { composeGroundedAnswer, confidenceLabel, sourcesFromHits } from "./answer.js";
import {
  answerWithModel,
  generateFlashcardsWithModel,
  generateQuizWithModel,
  gradeShortWithModel,
  testModel,
} from "./llm.js";
import { FREE_API_PROVIDERS, FREE_API_WARNING } from "./free-apis.js";
import {
  DEFAULT_LOCAL_MODEL_ID,
  LOCAL_MODELS,
  clearLocalModelCache,
  getLocalAIState,
  loadLocalModel,
  localAIStatusText,
  localModelLabel,
  refreshLocalAIStatus,
  subscribeLocalAI,
  testLocalAI,
} from "./local-ai.js";
import { TASKS } from "./model-router.js";
import { PROVIDERS, providerList } from "./providers.js";
import {
  DEFAULT_SETTINGS,
  engineLabel,
  isModelConnected,
  normalizeSettings,
  privacyLabel,
  providerConfig,
  serverHealth,
} from "./settings.js";
import { parseApiKeys } from "./key-pool.js";
import {
  STUDENT_KEY_PROVIDERS,
  cleanStudentEndpoint,
  cleanStudentKeyVault,
  studentKeySummary,
} from "./student-keys.js";
import {
  generateQuiz,
  gradeQuiz,
  makeQuiz,
  recomputeResult,
} from "./quiz.js";
import {
  buildFlashcards,
  deckStats,
  dueCards,
  readProgress as readFlashProgress,
  reviewCard,
  writeProgress as writeFlashProgress,
} from "./flashcards.js";
import {
  accuracy,
  leaderboard,
  readProgress as readStudyProgress,
  recordResult,
  resetProgress,
  streakMessage,
  topicMastery,
  writeProgress as writeStudyProgress,
} from "./progress.js";
import { externalSearchUrl, searchWeb } from "./web.js";
import {
  createPerformanceVideo,
  createPoster,
  drawPerformanceCard,
  preferredVideoMime,
} from "./card.js";
import { openReader } from "./reader.js";
import { applyTranslations, setLanguage, t } from "./i18n.js";
import { clamp, downloadBlob, formatDate, readFileAsText, truncate, uid } from "./util.js";
import * as ui from "./ui.js";
import {
  clearReferral,
  getLeaderboard,
  getSession,
  inviteLink,
  logout,
  openAuthModal,
  readReferral,
  syncProgress,
} from "./auth.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const VIEW_META = {
  ask: { kicker: "view.ask.kicker", title: "view.ask.title", subtitle: "view.ask.subtitle" },
  library: { kicker: "view.library.kicker", title: "view.library.title", subtitle: "view.library.subtitle" },
  quiz: { kicker: "view.quiz.kicker", title: "view.quiz.title", subtitle: "view.quiz.subtitle" },
  flashcards: { kicker: "view.flashcards.kicker", title: "view.flashcards.title", subtitle: "view.flashcards.subtitle" },
  progress: { kicker: "view.progress.kicker", title: "view.progress.title", subtitle: "view.progress.subtitle" },
  settings: { kicker: "view.settings.kicker", title: "view.settings.title", subtitle: "view.settings.subtitle" },
};

const SUGGESTIONS = [
  { label: "Why do leaves look green?", prompt: "Why do leaves look green?", mode: "answer" },
  { label: "Explain photosynthesis", prompt: "Explain photosynthesis step by step", mode: "explain" },
  { label: "Newton's laws", prompt: "State Newton's laws of motion", mode: "answer" },
  { label: "Quiz on forces", prompt: "forces", view: "quiz" },
  { label: "Water cycle summary", prompt: "Summarise the water cycle and monsoon", mode: "summarize" },
];

const state = {
  settings: normalizeSettings(DEFAULT_SETTINGS),
  indexes: [],
  books: [],
  messages: [],
  results: [],
  mode: "answer",
  currentView: "ask",
  lastAnswer: {},
  selectedFile: null,
  quiz: null,
  quizResponses: {},
  quizIndex: 0,
  quizTimer: null,
  quizDeadline: null,
  result: null,
  flashcards: [],
  flashDeck: [],
  flashProgress: {},
  flashIndex: 0,
  flashFlipped: false,
  studyProgress: readStudyProgress(),
  serverHealth: { ok: false, ai: false, aiProviders: [], freeRouter: false, search: false, accountsBackend: "local", keyPool: { serverKeys: 0, studentKeyFallback: true, cooldownMs: 60000 } },
  localAI: getLocalAIState(),
  localStatusRequested: false,
  studentKeyProvider: STUDENT_KEY_PROVIDERS[0]?.id || "gemini",
  account: null,
  authAvailable: false,
  serverLeaderboard: [],
  referral: "",
  bound: false,
};

/* ------------------------------------------------------------------ init */

async function init() {
  try {
    const stored = await db.getSetting("settings", null);
    state.settings = normalizeSettings(stored || DEFAULT_SETTINGS);
    state.studyProgress = readStudyProgress();
    state.flashProgress = readFlashProgress();
    state.results = await db.getResults();
    state.messages = await db.getMessages(100);
    setLanguage(state.settings.language);
    setTheme(state.settings.theme, { save: false });
    await reloadIndexes();
    if (!state.indexes.length) await loadDemoPack({ silent: true });
    if (!state.messages.length) addWelcomeMessage();
    bindEvents();
    subscribeLocalAI((snapshot) => {
      state.localAI = snapshot;
      renderLocalAIStatus(snapshot);
    });
    state.referral = readReferral();
    state.serverHealth = await serverHealth();
    if (state.serverHealth.ai && !isModelConnected(state.settings) && !state.settings.freeRouterDismissed) {
      for (const task of TASKS) state.settings.routing[task.id] = "server";
      state.settings.fallback = "offline";
      state.settings.activeProvider = "server";
      state.settings.disclaimerSeen = true;
      await saveSettings();
      ui.showToast("Free Vignan Vidyanikethan AI router connected — answers stay grounded in your books.", "success", 5200);
    }
    await refreshAuth();
    renderAll();
    const requestedView = new URL(location.href).searchParams.get("view");
    setView(VIEW_META[requestedView] ? requestedView : "ask", { skipHistory: true });
    registerServiceWorker();
    if (state.referral && !state.account && state.authAvailable) {
      setTimeout(() => openAccountModal("register"), 450);
    }
  } catch (error) {
    console.error("[vignan-ai] init failed", error);
    ui.showToast(`Vignan Vidyanikethan AI could not start: ${error.message}`, "error", 8000);
    bindEvents();
    renderAll();
  }
}

async function reloadIndexes() {
  state.indexes = await db.loadAllIndexes();
  state.books = state.indexes.map((index) => index.book);
}

async function saveSettings() {
  await db.setSetting("settings", state.settings);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  try {
    const script = new URL("../sw.js", import.meta.url);
    const scope = new URL("../", import.meta.url).pathname;
    navigator.serviceWorker.register(script, { scope }).catch(() => {});
  } catch {
    // Service workers are optional; the app still works from a static host.
  }
}

/* ------------------------------------------------------------- navigation */

function setView(view, { skipHistory = false } = {}) {
  if (!VIEW_META[view]) view = "ask";
  state.currentView = view;
  $$(".view").forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === view));
  $$(".nav-item, .mobile-nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  const meta = VIEW_META[view];
  $("#view-kicker").textContent = t(meta.kicker);
  $("#view-title").textContent = t(meta.title);
  $("#view-subtitle").textContent = t(meta.subtitle);
  if (!skipHistory) {
    const url = new URL(location.href);
    url.searchParams.set("view", view);
    history.replaceState(null, "", url);
  }
  if (view === "progress") {
    renderProgress();
    renderAccount();
  }
  if (view === "settings") renderSettings();
  if (view === "quiz") renderQuizState();
  if (view === "flashcards") renderFlashcards();
  $("#main").scrollTop = 0;
}

function setMode(mode) {
  if (!mode) return;
  state.mode = mode;
  $$(".mode-chip").forEach((chip) => chip.classList.toggle("active", chip.dataset.mode === mode));
}

function setTheme(theme, { save = true } = {}) {
  document.documentElement.dataset.theme = theme === "dark" ? "dark" : "light";
  state.settings.theme = theme === "dark" ? "dark" : "light";
  const use = $("#theme-toggle use");
  if (use) use.setAttribute("href", theme === "dark" ? "#i-sun" : "#i-moon");
  if (save) saveSettings();
}

function updateOfflineChip() {
  const chip = $("#offline-chip");
  const online = navigator.onLine !== false;
  chip.classList.toggle("offline", !online);
  const label = $("span[data-i18n]", chip);
  if (label) label.textContent = online ? t("app.online") : t("app.offline");
}

function updateStatus() {
  $("#engine-label").textContent = engineLabel(state.settings);
  const displayName = state.account?.username || state.settings.profile || "Student";
  $("#profile-initial").textContent = String(displayName).trim().charAt(0).toUpperCase() || "S";
  const accountChip = $("#account-chip");
  const accountName = $("#account-name");
  if (accountChip) {
    accountChip.textContent = state.account ? `@${state.account.username}` : state.authAvailable ? "Guest" : "Offline guest";
    accountChip.classList.toggle("online", Boolean(state.account));
  }
  if (accountName) {
    accountName.textContent = state.account ? `@${state.account.username}` : "";
    accountName.classList.toggle("hidden", !state.account);
  }
  $("#profile-button")?.classList.toggle("online", Boolean(state.account));
  const connected = isModelConnected(state.settings);
  $("#connect-banner").classList.toggle("hidden", connected || state.settings.disclaimerSeen);
  const health = state.serverHealth;
  const providerList = (health.aiProviders || []).slice(0, 4).join(" → ");
  const serverKeys = health.keyPool?.serverKeys || 0;
  const keyLabel = serverKeys ? ` · ${serverKeys} key${serverKeys === 1 ? "" : "s"}` : "";
  $("#server-status").textContent = health.ai
    ? health.freeRouter
      ? `Free AI router · ${providerList || "configured"}${keyLabel}`
      : `Server AI ready · ${health.aiModel || "configured"}${keyLabel}`
    : health.ok
      ? health.keyPool?.studentKeyFallback
        ? "Server online · add your key or use offline AI"
        : "Server online · no free AI keys yet"
      : "No local server model";
  renderQuizEngineNote();
  renderLocalAIStatus(state.localAI);
  updateOfflineChip();
}

function renderQuizEngineNote() {
  const route = state.settings.routing.quiz;
  const useModel = $("#quiz-use-model")?.checked;
  const label =
    route === "offline" || !useModel
      ? t("common.offlineQuiz") || "Offline quiz writer"
      : `AI writer: ${PROVIDERS[route]?.label || route}`;
  const note = $("#quiz-engine-note");
  if (note) note.textContent = label;
}

function renderAll() {
  applyTranslations(document);
  renderSuggestions();
  renderChat();
  renderSources(state.lastAnswer);
  renderBookScopes();
  renderLibrary();
  renderQuizState();
  renderFlashcards();
  renderProgress();
  renderAccount();
  renderSettings();
  updateStatus();
}

/* ------------------------------------------------------- accounts & squad */

async function refreshAuth() {
  try {
    const session = await getSession();
    state.authAvailable = true;
    state.account = session.user || null;
  } catch {
    state.authAvailable = false;
    state.account = null;
  }
  try {
    state.serverLeaderboard = state.authAvailable ? await getLeaderboard() : [];
  } catch {
    state.serverLeaderboard = [];
  }
  updateStatus();
  renderAccount();
}

function openAccountModal(mode = "register") {
  openAuthModal({
    account: state.account,
    mode,
    referral: state.referral,
    onAuthenticated: async (user) => {
      state.account = user || null;
      state.authAvailable = true;
      if (user) {
        clearReferral();
        state.referral = "";
      }
      try {
        state.serverLeaderboard = await getLeaderboard();
      } catch {
        state.serverLeaderboard = [];
      }
      updateStatus();
      renderAccount();
      renderProgress();
    },
    onLogout: async () => {
      state.account = null;
      state.serverLeaderboard = [];
      await refreshAuth();
      renderProgress();
    },
    onViewProgress: () => setView("progress"),
  });
}

async function signOut() {
  try {
    await logout();
  } catch {
    // Even if the server is unreachable, forget the account locally.
  }
  state.account = null;
  state.serverLeaderboard = [];
  await refreshAuth();
  renderProgress();
  ui.showToast("You are studying as a guest now.", "info");
}

function copyInvite(link) {
  if (!link) return;
  navigator.clipboard
    ?.writeText(link)
    .then(() => ui.showToast("Invite link copied. Send it to your friends!", "success"))
    .catch(() => ui.showToast("Could not copy automatically. Select the invite link and copy it.", "warning"));
}

function renderAccount() {
  const body = $("#account-body");
  const board = $("#server-leaderboard-list");
  if (!body || !board) return;
  body.replaceChildren();
  board.replaceChildren();
  const account = state.account;

  if (account) {
    const hero = ui.element("div", "account-hero");
    hero.appendChild(ui.element("div", "account-avatar", String(account.username || "V").charAt(0).toUpperCase()));
    const copy = ui.element("div", "account-hero-copy");
    copy.appendChild(ui.element("strong", "", `You're in, @${account.username}!`));
    copy.appendChild(
      ui.element(
        "p",
        "",
        `${account.ageBand || "Private"} age band · ${account.referrals || 0} friends joined · best score ${account.best || 0}%`,
      ),
    );
    hero.appendChild(copy);
    body.appendChild(hero);

    const stats = ui.element("div", "account-stats");
    for (const [label, value] of [
      ["XP", account.xp || 0],
      ["Streak", `${account.streak || 0} 🔥`],
      ["Best", `${account.best || 0}%`],
      ["Friends", account.referrals || 0],
    ]) {
      const cell = ui.element("div", "account-stat");
      cell.appendChild(ui.element("strong", "", String(value)));
      cell.appendChild(ui.element("span", "", label));
      stats.appendChild(cell);
    }
    body.appendChild(stats);

    const link = inviteLink(account.refCode);
    const invite = ui.element("div", "invite-row");
    const input = ui.element("input");
    input.readOnly = true;
    input.value = link;
    input.setAttribute("aria-label", "Your invite link");
    const copyButton = ui.element("button", "button primary small", "Copy invite link");
    copyButton.type = "button";
    copyButton.addEventListener("click", () => copyInvite(link));
    invite.append(input, copyButton);
    body.appendChild(invite);
    body.appendChild(
      ui.element(
        "p",
        "hint",
        `Squad code ${account.refCode || "VIGNAN-YOU"}. Put this link in your edit video caption and bring your friends to Vignan Vidyanikethan AI.`,
      ),
    );

    const actions = ui.element("div", "account-actions");
    const manage = ui.element("button", "button ghost small", "My account");
    manage.type = "button";
    manage.addEventListener("click", () => openAccountModal());
    const keys = ui.element("button", "button ghost small", "My AI keys");
    keys.type = "button";
    keys.addEventListener("click", () => openSettingsPanel("student-key-card"));
    const leave = ui.element("button", "button ghost small danger", "Log out");
    leave.type = "button";
    leave.addEventListener("click", signOut);
    const inviteAgain = ui.element("button", "button ghost small", "Invite more friends");
    inviteAgain.type = "button";
    inviteAgain.addEventListener("click", () => copyInvite(link));
    actions.append(manage, keys, inviteAgain, leave);
    body.appendChild(actions);
  } else {
    const hero = ui.element("div", "account-hero");
    hero.appendChild(ui.element("div", "account-avatar", "V"));
    const copy = ui.element("div", "account-hero-copy");
    copy.appendChild(ui.element("strong", "", "Study solo or with your squad"));
    copy.appendChild(
      ui.element(
        "p",
        "",
        "Create a free student account to sync streaks, join the live leaderboard and get a personal invite code.",
      ),
    );
    hero.appendChild(copy);
    body.appendChild(hero);

    const actions = ui.element("div", "account-actions");
    const join = ui.element("button", "button primary small", "Register now");
    join.type = "button";
    join.addEventListener("click", () => openAccountModal("register"));
    const login = ui.element("button", "button ghost small", "I already have an account");
    login.type = "button";
    login.addEventListener("click", () => openAccountModal("login"));
    const keys = ui.element("button", "button ghost small", "Add my AI key");
    keys.type = "button";
    keys.addEventListener("click", () => openSettingsPanel("student-key-card"));
    actions.append(join, login, keys);
    body.appendChild(actions);
    body.appendChild(
      ui.element(
        "p",
        "hint",
        state.authAvailable
          ? "Username and password live on the local Vignan server. Only an age band is stored; gender stays private."
          : "Accounts need the local Vignan Vidyanikethan AI server. Offline books, quizzes and progress still work as a guest.",
      ),
    );
    if (state.referral) {
      body.appendChild(
        ui.element("p", "hint", `You were invited with code ${state.referral}. Register to credit your friend.`),
      );
    }
  }

  if (!state.authAvailable) {
    board.appendChild(
      ui.element("p", "hint", "Start the local server to see the live class leaderboard. Your local scores are below."),
    );
  } else if (!state.serverLeaderboard.length) {
    board.appendChild(ui.element("p", "hint", "No live scores yet. Log in and finish a quiz to claim the top spot."));
  } else {
    for (const entry of state.serverLeaderboard) {
      const row = ui.element("div", "server-leaderboard-row");
      const rank = Number(entry.rank) || 0;
      const rankClass = rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : "";
      row.appendChild(ui.element("div", `rank ${rankClass}`.trim(), String(rank)));
      const who = ui.element("div", "who");
      who.appendChild(ui.element("strong", "", `@${entry.username || "student"}`));
      who.appendChild(
        ui.element(
          "span",
          "",
          `${entry.quizzes || 0} quizzes · ${entry.xp || 0} XP · ${entry.streak || 0} 🔥 · ${entry.referrals || 0} friends`,
        ),
      );
      row.appendChild(who);
      row.appendChild(ui.element("div", "score", `${entry.best || 0}%`));
      board.appendChild(row);
    }
  }
}

/* ------------------------------------------------------------------- chat */

function addMessage(message, { persist = true } = {}) {
  const full = {
    id: uid("msg"),
    role: message.role === "user" ? "user" : "assistant",
    content: String(message.content || ""),
    createdAt: new Date().toISOString(),
    sources: message.sources || [],
    webSources: message.webSources || [],
    meta: message.meta || "",
    confidence: message.confidence || 0,
    verification: message.verification || null,
    flashcards: message.flashcards || [],
  };
  state.messages.push(full);
  if (persist) db.addMessage(full).catch(() => {});
  renderChat();
  return full;
}

function addWelcomeMessage() {
  addMessage({
    role: "assistant",
    content: [
      "**Welcome to Vignan Vidyanikethan AI.** I answer from your own textbooks and show the page behind every claim.",
      "",
      "- Add a class PDF in **Library**, or start with the demo study pack already loaded.",
      "- Connect an existing AI model in **Settings** for natural explanations grounded in the same pages.",
      "- Try: “Why do leaves look green?” or generate a quiz on forces.",
      "",
      "_No model was trained for this app. Your books are the knowledge base; existing AIs are optional reasoning engines._",
    ].join("\n"),
    meta: "Offline ready",
  });
}

function renderSuggestions() {
  const container = $("#chat-suggestions");
  container.replaceChildren();
  for (const suggestion of SUGGESTIONS) {
    const button = ui.element("button", "suggestion-chip", suggestion.label);
    button.type = "button";
    button.addEventListener("click", () => {
      if (suggestion.view === "quiz") {
        $("#quiz-topic").value = suggestion.prompt;
        setView("quiz");
        return;
      }
      $("#ask-input").value = suggestion.prompt;
      setMode(suggestion.mode);
      $("#ask-form").requestSubmit();
    });
    container.appendChild(button);
  }
}

function renderChat() {
  const log = $("#chat-log");
  log.replaceChildren();
  for (const message of state.messages) {
    const wrapper = ui.element("div", `message ${message.role}`);
    const avatar = ui.element("div", "message-avatar", message.role === "user" ? "S" : "V");
    const body = ui.element("div", "message-body");
    if (message.role === "user") {
      body.textContent = message.content;
    } else {
      ui.renderRichText(body, message.content, {
        sources: message.sources,
        webSources: message.webSources,
        onSource: (number, source) => openSource(source),
        onWebSource: (number, source) => openWebSource(source),
      });
      const meta = ui.element("div", "message-meta");
      if (message.meta) meta.appendChild(ui.element("span", "", message.meta));
      if (message.confidence) meta.appendChild(ui.element("span", "", `${Math.round(message.confidence * 100)}% grounding`));
      if (message.verification?.enabled && message.verification.supported) {
        meta.appendChild(ui.element("span", "", "✓ AI-verified"));
      }
      if (meta.childNodes.length) body.appendChild(meta);
    }
    wrapper.append(avatar, body);
    log.appendChild(wrapper);
  }
  log.scrollTop = log.scrollHeight;
}

function showTyping(visible) {
  $("#typing").classList.toggle("hidden", !visible);
  $("#ask-send").disabled = visible;
}

async function handleAsk(event) {
  event.preventDefault();
  const input = $("#ask-input");
  const query = input.value.trim();
  if (!query) return;
  addMessage({ role: "user", content: query });
  input.value = "";
  showTyping(true);

  try {
    const bookIds = scopeIds("#ask-book-scope");
    const retrieval = retrieve(query, state.indexes, { topK: 5, bookIds });
    const hits = retrieval.hits;
    const webToggle = $("#ask-web-fallback").checked;
    const webEnabled = webToggle && state.settings.webEnabled;
    if (webToggle && !state.settings.webEnabled) {
      ui.showToast("Turn on web fallback in Settings to use outside sources.", "warning");
    }
    let webResults = [];
    if (!retrieval.grounded && webEnabled && retrieval.reason !== "too-vague") {
      try {
        const search = await searchWeb(query, { ...state.settings, webEnabled: true });
        webResults = search.results || [];
      } catch (error) {
        ui.showToast(`Web fallback failed: ${error.message}`, "warning");
      }
    }

    let answer = null;
    let modelError = null;
    const connected = state.settings.routing.answer !== "offline";
    if (hits.length && connected) {
      try {
        const history = state.messages
          .slice(0, -1)
          .slice(-6)
          .map(({ role, content }) => ({ role, content }));
        const model = await answerWithModel({
          query,
          hits,
          mode: state.mode,
          history,
          settings: state.settings,
        });
        if (!model.offline && model.content) {
          answer = {
            text: model.content,
            sources: sourcesFromHits(hits),
            webSources: [],
            grounded: true,
            confidence: retrieval.confidence,
            verification: model.verification,
            meta: `${model.label || "AI"} · ${model.model || "model"}${model.fallbackUsed ? " (fallback)" : ""}`,
            flashcards: [],
          };
        } else if (model.error) {
          modelError = model.error;
        }
      } catch (error) {
        modelError = error;
      }
    }

    if (!answer) {
      answer = composeGroundedAnswer({
        query,
        hits,
        mode: state.mode,
        reason: retrieval.reason,
        confidence: retrieval.confidence,
        webResults,
        webEnabled,
      });
      answer.meta = modelError
        ? "Model unavailable — cited excerpts shown"
        : "Offline engine — cited excerpts";
      answer.verification = { enabled: false };
      showKeyExhaustedToast(modelError);
    }
    answer.webSources = webResults;
    state.lastAnswer = answer;

    addMessage({
      role: "assistant",
      content: answer.text,
      sources: answer.sources,
      webSources: answer.webSources,
      meta: answer.meta,
      confidence: answer.confidence,
      verification: answer.verification,
      flashcards: answer.flashcards,
    });
    renderSources(answer);

    if (answer.flashcards?.length) {
      state.flashcards = answer.flashcards;
      state.flashIndex = 0;
      state.flashFlipped = false;
      renderFlashcards();
      ui.showToast(`${answer.flashcards.length} flashcards are ready in Flashcards.`, "success");
    }
    if (webResults.length) {
      ui.showToast("Outside sources are labelled separately — they are not textbook answers.", "warning");
    }
  } catch (error) {
    console.error(error);
    ui.showToast(`Could not answer: ${error.message}`, "error");
  } finally {
    showTyping(false);
  }
}

async function clearChat() {
  await db.clearMessages();
  state.messages = [];
  addWelcomeMessage();
  state.lastAnswer = {};
  renderSources({});
  ui.showToast("Chat cleared.", "success");
}

/* ---------------------------------------------------------------- sources */

function renderSources(answer = {}) {
  const sources = answer.sources || [];
  const webSources = answer.webSources || [];
  $("#source-count").textContent = String(sources.length);
  const list = $("#source-list");
  list.replaceChildren();
  if (!sources.length) {
    list.appendChild(ui.emptyState("⌕", t("ask.sources"), t("ask.sourcesEmpty")));
  } else {
    sources.forEach((source) => list.appendChild(sourceCard(source)));
  }

  const confidenceBox = $("#confidence-box");
  if (sources.length && answer.confidence) {
    confidenceBox.classList.remove("hidden");
    const percent = Math.round(answer.confidence * 100);
    $("#confidence-value").textContent = `${percent}%`;
    $("#confidence-bar").style.width = `${percent}%`;
    $("#confidence-label").textContent = confidenceLabel(answer.confidence);
  } else {
    confidenceBox.classList.add("hidden");
  }

  renderVerification(answer.verification);
  renderWebResults(webSources);
}

function sourceCard(source) {
  const card = ui.element("div", "source-card");
  const top = ui.element("div", "source-card-top");
  top.appendChild(ui.element("span", "source-number", String(source.n)));
  top.appendChild(ui.element("div", "source-title", truncate(source.title, 54)));
  top.appendChild(ui.element("span", "source-page", `p. ${source.page}`));
  const snippet = ui.element("p", "source-snippet", truncate(source.quote || source.text, 190));
  const actions = ui.element("div", "source-actions");
  const read = ui.element("button", "", t("ask.reader"));
  read.type = "button";
  read.addEventListener("click", () => openSource(source));
  const copy = ui.element("button", "", "Copy quote");
  copy.type = "button";
  copy.addEventListener("click", () => copyText(source.quote || source.text));
  actions.append(read, copy);
  card.append(top, snippet, actions);
  return card;
}

function renderVerification(verification) {
  const box = $("#verification-box");
  box.replaceChildren();
  if (!verification?.enabled) {
    box.classList.add("hidden");
    return;
  }
  box.classList.remove("hidden");
  box.classList.toggle("warn", Boolean(verification.error || verification.supported === false));
  if (verification.error) {
    box.appendChild(ui.element("strong", "", "Second AI check unavailable"));
    box.appendChild(ui.element("span", "", verification.error));
    return;
  }
  if (verification.supported) {
    box.appendChild(ui.element("strong", "", "✓ Second AI check: claims supported"));
    box.appendChild(
      ui.element(
        "span",
        "",
        verification.note || `Checked by ${PROVIDERS[verification.providerId]?.label || "another model"}.`,
      ),
    );
  } else {
    box.appendChild(ui.element("strong", "", "Check these claims against the pages"));
    const issues = [...(verification.unsupported || []), ...(verification.missingCitations || [])]
      .slice(0, 3)
      .map((issue) => `• ${issue}`)
      .join("\n");
    box.appendChild(ui.element("span", "", issues || "The verifier found unsupported or uncited claims."));
  }
}

function renderWebResults(results) {
  const container = $("#web-results");
  container.replaceChildren();
  if (!results.length) {
    container.classList.add("hidden");
    return;
  }
  container.classList.remove("hidden");
  container.appendChild(ui.element("div", "external-label", "⚠ OUTSIDE YOUR TEXTBOOKS — VERIFY INDEPENDENTLY"));
  for (const result of results.slice(0, 5)) {
    const link = ui.element("a", "web-result");
    link.href = result.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.appendChild(ui.element("strong", "", result.title));
    link.appendChild(ui.element("span", "", result.domain));
    link.appendChild(ui.element("span", "", result.snippet));
    container.appendChild(link);
  }
  const open = ui.element("button", "text-button", "Open a wider web search ↗");
  open.type = "button";
  open.addEventListener("click", () => {
    const query = $("#ask-input").value || state.messages.filter((m) => m.role === "user").slice(-1)[0]?.content || "study topic";
    window.open(externalSearchUrl(query), "_blank", "noopener,noreferrer");
  });
  container.appendChild(open);
}

function openSource(source) {
  if (!source) return;
  const index = state.indexes.find((entry) => entry.book.id === source.bookId);
  if (!index) {
    ui.showToast("This book is no longer in your library.", "warning");
    return;
  }
  openReader({
    book: index.book,
    pages: index.book.pages || [],
    initialPage: source.page || 1,
    highlight: source.text || source.quote || "",
  });
}

function openWebSource(source) {
  if (source?.url) window.open(source.url, "_blank", "noopener,noreferrer");
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text || "");
    ui.showToast("Quote copied.", "success");
  } catch {
    ui.showToast("Clipboard is not available here.", "warning");
  }
}

/* ---------------------------------------------------------------- library */

function renderBookScopes() {
  for (const selector of ["#ask-book-scope", "#quiz-book-scope", "#flash-book-scope"]) {
    const select = $(selector);
    if (!select) continue;
    const previous = select.value;
    select.replaceChildren(ui.option("all", t("common.allBooks")));
    for (const book of state.books) select.appendChild(ui.option(book.id, truncate(book.title, 42)));
    select.value = [...select.options].some((option) => option.value === previous) ? previous : "all";
  }
}

function scopeIds(selector) {
  const value = $(selector)?.value || "all";
  return value === "all" ? [] : [value];
}

function renderLibrary() {
  const list = $("#book-list");
  list.replaceChildren();
  const totalPages = state.books.reduce((sum, book) => sum + (book.pageCount || 0), 0);
  const totalChunks = state.books.reduce((sum, book) => sum + (book.chunkCount || 0), 0);
  $("#book-summary").textContent = `${state.books.length} ${state.books.length === 1 ? "book" : "books"} · ${totalPages} pages · ${totalChunks} passages`;
  if (!state.books.length) {
    list.appendChild(ui.emptyState("▤", t("library.yourBooks"), t("library.empty")));
    return;
  }
  for (const book of state.books) {
    const card = ui.element("div", "card book-card");
    const top = ui.element("div", "book-card-top");
    top.appendChild(ui.element("div", "book-icon", (book.subject || "B").slice(0, 2).toUpperCase()));
    const copy = document.createElement("div");
    copy.appendChild(ui.element("h4", "", book.title));
    copy.appendChild(ui.element("p", "", book.demo ? t("library.demoNote") : `${book.type?.toUpperCase() || "TEXT"} · ${book.fileName || "local notes"}`));
    top.appendChild(copy);
    const meta = ui.element("div", "book-meta");
    [
      book.subject,
      book.grade ? `Class ${book.grade}` : "",
      book.board,
      `${book.pageCount || 0} ${t("common.pages")}`,
      `${book.chunkCount || 0} passages`,
    ]
      .filter(Boolean)
      .forEach((value) => meta.appendChild(ui.element("span", "book-tag", value)));
    const actions = ui.element("div", "book-actions");
    const buttons = [
      ["ask", t("library.askThis")],
      ["quiz", t("library.quizThis")],
      ["read", t("library.openReader")],
      ["delete", t("library.deleteBook")],
    ];
    for (const [action, label] of buttons) {
      const button = ui.element("button", action === "delete" ? "danger" : "", label);
      button.type = "button";
      button.dataset.action = action;
      button.dataset.bookId = book.id;
      actions.appendChild(button);
    }
    card.append(top, meta, actions);
    list.appendChild(card);
  }
}

async function loadDemoPack({ silent = false } = {}) {
  if (state.books.some((book) => book.demo)) {
    if (!silent) ui.showToast("The demo study pack is already in your library.", "warning");
    return;
  }
  try {
    const response = await fetch("./data/demo-textbook.txt");
    if (!response.ok) throw new Error("Demo study pack could not be loaded.");
    const raw = await response.text();
    const index = await ingestDemoPack(raw, {
      title: "Demo Study Pack",
      subject: "Science, Maths & English",
      grade: "8",
      board: "Sample notes",
    });
    await db.saveBookIndex(index);
    await reloadIndexes();
    renderBookScopes();
    renderLibrary();
    if (!silent) ui.showToast("Demo study pack added — try asking about photosynthesis.", "success");
  } catch (error) {
    if (!silent) ui.showToast(error.message, "error");
  }
}

function handleFile(file) {
  if (!file) return;
  const allowed = /\.(pdf|txt|md|markdown)$/i.test(file.name);
  if (!allowed) {
    ui.showToast("Choose a PDF, TXT or Markdown file.", "warning");
    return;
  }
  if (file.size > 40 * 1024 * 1024) {
    ui.showToast("That file is larger than 40 MB. Split it into chapters first.", "warning");
    return;
  }
  state.selectedFile = file;
  const name = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
  $("#book-title").value = name;
  if (!$("#book-subject").value) $("#book-subject").value = "General";
  const selected = $("#selected-file");
  selected.textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB`;
  selected.classList.remove("hidden");
}

function uploadProgress(event) {
  const wrap = $("#upload-progress");
  const meter = $("#upload-meter");
  const status = $("#upload-status");
  wrap.classList.remove("hidden");
  if (event.phase === "reading") {
    const percent = Math.round((event.current / Math.max(1, event.total)) * 100);
    meter.style.width = `${percent}%`;
    status.textContent = `Extracting text — page ${event.current} of ${event.total}`;
  } else if (event.phase === "indexing") {
    meter.style.width = "94%";
    status.textContent = "Building the local passage index and cached vectors…";
  } else if (event.phase === "done") {
    meter.style.width = "100%";
    status.textContent = "Done.";
  } else if (event.phase === "notice") {
    ui.showToast(event.message, "warning");
  }
}

async function handleUpload() {
  const file = state.selectedFile;
  if (!file) {
    ui.showToast("Choose a file first.", "warning");
    return;
  }
  const button = $("#upload-submit");
  ui.setBusy(button, true, "Indexing…");
  $("#upload-progress").classList.remove("hidden");
  try {
    const meta = {
      title: $("#book-title").value.trim() || file.name,
      subject: $("#book-subject").value.trim() || "General",
      grade: $("#book-grade").value.trim(),
      board: $("#book-board").value.trim(),
      fileName: file.name,
    };
    let index;
    if (/\.pdf$/i.test(file.name)) {
      index = await ingestPdf(file, meta, uploadProgress);
    } else {
      const raw = await readFileAsText(file);
      index = ingestText(raw, meta, uploadProgress);
    }
    await db.saveBookIndex(index);
    await reloadIndexes();
    state.selectedFile = null;
    $("#file-input").value = "";
    $("#selected-file").classList.add("hidden");
    $("#book-title").value = "";
    $("#book-grade").value = "";
    $("#book-board").value = "";
    $("#upload-progress").classList.add("hidden");
    renderBookScopes();
    renderLibrary();
    ui.showToast(`${index.book.title} added — ${index.book.pageCount} pages indexed.`, "success");
  } catch (error) {
    console.error(error);
    ui.showToast(error.message || "Could not add that book.", "error");
  } finally {
    ui.setBusy(button, false);
  }
}

async function handlePaste() {
  const raw = $("#paste-text").value.trim();
  if (raw.length < 40) {
    ui.showToast("Paste at least a paragraph of notes.", "warning");
    return;
  }
  const button = $("#paste-submit");
  ui.setBusy(button, true, "Indexing…");
  try {
    const index = ingestText(raw, {
      title: $("#paste-title").value.trim() || "Pasted notes",
      subject: "General",
      fileName: "pasted-notes.txt",
    });
    await db.saveBookIndex(index);
    await reloadIndexes();
    $("#paste-text").value = "";
    $("#paste-title").value = "";
    renderBookScopes();
    renderLibrary();
    ui.showToast("Notes added to your library.", "success");
  } catch (error) {
    ui.showToast(error.message, "error");
  } finally {
    ui.setBusy(button, false);
  }
}

async function handleBookAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const book = state.books.find((entry) => entry.id === button.dataset.bookId);
  if (!book) return;
  const action = button.dataset.action;
  if (action === "ask") {
    renderBookScopes();
    $("#ask-book-scope").value = book.id;
    setView("ask");
    $("#ask-input").focus();
  } else if (action === "quiz") {
    renderBookScopes();
    $("#quiz-book-scope").value = book.id;
    $("#quiz-topic").value = book.subject || "";
    setView("quiz");
  } else if (action === "read") {
    openReader({ book, pages: book.pages || [], initialPage: 1 });
  } else if (action === "delete") {
    const confirmed = await ui.confirmDialog({
      title: "Remove this book?",
      message: `${book.title} and its cached passages will be deleted from this device.`,
      confirmLabel: t("common.delete"),
      danger: true,
    });
    if (!confirmed) return;
    await db.deleteBook(book.id);
    await reloadIndexes();
    renderBookScopes();
    renderLibrary();
    ui.showToast("Book removed.", "success");
  }
}

/* ------------------------------------------------------------------- quiz */

async function generateQuizHandler() {
  const topic = $("#quiz-topic").value.trim();
  const bookIds = scopeIds("#quiz-book-scope");
  const count = clamp(Number($("#quiz-count").value) || 5, 3, 10);
  const type = $("#quiz-type").value;
  const difficulty = $("#quiz-difficulty").value;
  const timed = $("#quiz-timed").value === "yes";
  const useModel = $("#quiz-use-model").checked;
  const button = $("#quiz-generate");
  ui.setBusy(button, true, "Writing questions…");

  try {
    const retrieval = retrieveChapter(topic, state.indexes, { topK: Math.max(12, count * 2), bookIds });
    if (!retrieval.hits.length) {
      ui.showToast("Add a textbook first, then generate a quiz.", "warning");
      return;
    }
    let quiz = null;
    let engine = "offline";
    if (useModel && state.settings.routing.quiz !== "offline") {
      try {
        const questions = await generateQuizWithModel({
          topic,
          hits: retrieval.hits,
          count,
          type,
          difficulty,
          settings: state.settings,
        });
        if (questions.length) {
          quiz = makeQuiz({
            questions,
            topic,
            bookIds,
            type,
            difficulty,
            timed,
            secondsPerQuestion: 45,
            generatedBy: "model",
            hits: retrieval.hits,
          });
          engine = "model";
        }
      } catch (error) {
        ui.showToast(`AI writer unavailable — offline quiz used. ${error.message}`, "warning");
        showKeyExhaustedToast(error);
      }
    }
    if (!quiz) {
      quiz = generateQuiz({
        hits: retrieval.hits,
        topic,
        count,
        type,
        difficulty,
        timed,
        secondsPerQuestion: 45,
        bookIds,
      });
    }
    if (!quiz.questions.length) {
      ui.showToast("Not enough readable text was found for a quiz.", "warning");
      return;
    }
    state.quiz = quiz;
    state.quizResponses = {};
    state.quizIndex = 0;
    state.result = null;
    $("#quiz-setup").classList.add("hidden");
    $("#quiz-results").classList.add("hidden");
    $("#quiz-runner").classList.remove("hidden");
    $("#quiz-topic-title").textContent = quiz.title;
    $("#quiz-engine-note").textContent =
      engine === "model" ? `Generated by ${PROVIDERS[state.settings.routing.quiz]?.label || "connected AI"}` : "Generated offline from your books";
    startQuizTimer();
    renderQuizQuestion();
  } catch (error) {
    console.error(error);
    ui.showToast(error.message || "Could not generate the quiz.", "error");
  } finally {
    ui.setBusy(button, false);
  }
}

function renderQuizState() {
  if (state.result) {
    $("#quiz-setup").classList.add("hidden");
    $("#quiz-runner").classList.add("hidden");
    $("#quiz-results").classList.remove("hidden");
    renderQuizResults(state.result);
  } else if (state.quiz) {
    $("#quiz-setup").classList.add("hidden");
    $("#quiz-results").classList.add("hidden");
    $("#quiz-runner").classList.remove("hidden");
    renderQuizQuestion();
  } else {
    $("#quiz-setup").classList.remove("hidden");
    $("#quiz-runner").classList.add("hidden");
    $("#quiz-results").classList.add("hidden");
  }
  renderQuizEngineNote();
}

function renderQuizQuestion() {
  const quiz = state.quiz;
  if (!quiz) return;
  const total = quiz.questions.length;
  state.quizIndex = clamp(state.quizIndex, 0, total - 1);
  const question = quiz.questions[state.quizIndex];
  $("#quiz-progress-label").textContent = `${t("quiz.question")} ${state.quizIndex + 1} ${t("common.of") || "of"} ${total}`;
  $("#quiz-progress-bar").style.width = `${((state.quizIndex + 1) / total) * 100}%`;
  const container = $("#quiz-question");
  container.replaceChildren();
  container.appendChild(
    ui.element(
      "div",
      "question-type",
      `${question.type === "mcq" ? "Multiple choice" : question.type === "fill" ? "Fill in the blank" : "Short answer"} · ${question.topic || "General"}`,
    ),
  );
  container.appendChild(ui.element("div", "question-prompt", question.prompt));

  const saved = state.quizResponses[question.id] || "";
  if (question.type === "mcq") {
    const options = ui.element("div", "options");
    for (const [index, optionText] of question.options.entries()) {
      const label = ui.element("label", `option${saved === optionText ? " selected" : ""}`);
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = `quiz-option-${question.id}`;
      radio.value = optionText;
      radio.checked = saved === optionText;
      radio.addEventListener("change", () => {
        saveQuizResponse(optionText);
        $$(".option", options).forEach((node) => node.classList.remove("selected"));
        label.classList.add("selected");
      });
      label.append(radio, ui.element("span", "", `${String.fromCharCode(65 + index)}. ${optionText}`));
      options.appendChild(label);
    }
    container.appendChild(options);
  } else if (question.type === "fill") {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "fill-input";
    input.placeholder = "Type the missing word or phrase";
    input.value = saved;
    input.addEventListener("input", () => saveQuizResponse(input.value));
    container.appendChild(input);
  } else {
    const textarea = document.createElement("textarea");
    textarea.className = "short-input";
    textarea.placeholder = "Write your answer in your own words…";
    textarea.value = saved;
    textarea.addEventListener("input", () => saveQuizResponse(textarea.value));
    container.appendChild(textarea);
  }
  const source = ui.element("p", "hint", `${question.source?.title || "Textbook"} · page ${question.source?.page || "?"}`);
  container.appendChild(source);

  $("#quiz-prev").disabled = state.quizIndex === 0;
  const last = state.quizIndex === total - 1;
  $("#quiz-next").classList.toggle("hidden", last);
  $("#quiz-submit").classList.toggle("hidden", !last);
}

function saveQuizResponse(value) {
  const question = state.quiz?.questions[state.quizIndex];
  if (question) state.quizResponses[question.id] = value;
}

function startQuizTimer() {
  clearQuizTimer();
  const timer = $("#quiz-timer");
  if (!state.quiz?.timed) {
    timer.classList.add("hidden");
    return;
  }
  timer.classList.remove("hidden");
  const totalSeconds = state.quiz.questions.length * (state.quiz.secondsPerQuestion || 45);
  state.quizDeadline = Date.now() + totalSeconds * 1000;
  const update = () => {
    const remaining = Math.max(0, Math.ceil((state.quizDeadline - Date.now()) / 1000));
    timer.textContent = formatTime(remaining);
    timer.classList.toggle("urgent", remaining <= 30);
    if (remaining <= 0) {
      clearQuizTimer();
      ui.showToast("Time is up — submitting your quiz.", "warning");
      submitQuiz();
    }
  };
  update();
  state.quizTimer = setInterval(update, 250);
}

function clearQuizTimer() {
  if (state.quizTimer) clearInterval(state.quizTimer);
  state.quizTimer = null;
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

async function submitQuiz() {
  if (!state.quiz) return;
  clearQuizTimer();
  const button = $("#quiz-submit");
  ui.setBusy(button, true, "Grading…");
  try {
    let result = gradeQuiz(state.quiz, state.quizResponses);
    const hasShortWritten = result.perQuestion.some(
      (item) => item.question.type === "short" && item.submitted.trim().length > 2,
    );
    if (state.settings.routing.grade !== "offline" && hasShortWritten) {
      ui.showToast("A connected AI is reviewing the written answers…");
      for (const item of result.perQuestion) {
        if (item.question.type !== "short" || item.submitted.trim().length < 3) continue;
        try {
          const grade = await gradeShortWithModel({
            question: item.question,
            submitted: item.submitted,
            settings: state.settings,
          });
          if (grade) {
            item.awarded = grade.awarded;
            item.status = grade.awarded >= 1 ? "correct" : grade.awarded >= 0.5 ? "partial" : "wrong";
            item.feedback = grade.feedback;
          }
        } catch (error) {
          // Keep the deterministic grade if the AI grader is unavailable.
          showKeyExhaustedToast(error);
        }
      }
      result = recomputeResult(result);
    }
    result.profile = state.account?.username || state.settings.profile || "Student";
    state.result = result;
    state.studyProgress = recordResult(state.studyProgress, result, { profile: result.profile });
    writeStudyProgress(state.studyProgress);
    await db.addResult(result);
    state.results.unshift(result);
    renderQuizResults(result);
    renderProgress();
    $("#quiz-runner").classList.add("hidden");
    $("#quiz-results").classList.remove("hidden");
    ui.showToast(`Quiz complete — ${result.percent}% · +${result.xp} XP`, "success");
    if (state.account && state.authAvailable) {
      syncProgress(result)
        .then(async (user) => {
          if (user) state.account = user;
          try {
            state.serverLeaderboard = await getLeaderboard();
          } catch {
            state.serverLeaderboard = [];
          }
          updateStatus();
          renderAccount();
        })
        .catch(() => ui.showToast("Saved locally. Live squad sync will retry after your next quiz.", "warning", 3200));
    }
  } catch (error) {
    console.error(error);
    ui.showToast(error.message || "Could not grade the quiz.", "error");
  } finally {
    ui.setBusy(button, false);
  }
}

function renderQuizResults(result) {
  const root = $("#quiz-results");
  root.replaceChildren();

  const hero = ui.element("div", "card result-hero");
  const ring = ui.element("div", "score-ring");
  ring.style.setProperty("--percent", String(result.percent));
  ring.appendChild(ui.element("span", "", `${result.percent}%`));
  hero.appendChild(ring);
  hero.appendChild(ui.element("h2", "", t("quiz.resultsTitle")));
  hero.appendChild(
    ui.element(
      "p",
      "",
      `${Number(result.score).toFixed(Number.isInteger(result.score) ? 0 : 1)} / ${result.total} correct · ${truncate(result.topic, 44)}`,
    ),
  );
  hero.appendChild(ui.element("p", "hint", streakMessage(state.studyProgress)));
  const actions = ui.element("div", "result-actions");
  const newQuiz = ui.element("button", "button ghost small", t("quiz.newQuiz"));
  newQuiz.addEventListener("click", newQuizHandler);
  const retake = ui.element("button", "button ghost small", t("quiz.retake"));
  retake.addEventListener("click", retakeQuiz);
  const card = ui.element("button", "button primary small", t("quiz.card"));
  card.addEventListener("click", () => openPerformanceCard(result));
  actions.append(newQuiz, retake, card);
  hero.appendChild(actions);
  root.appendChild(hero);

  const detail = ui.element("div", "result-detail");

  if (result.reviseList?.length) {
    const revise = ui.element("section", "card result-section");
    revise.appendChild(ui.element("h3", "", t("quiz.revise")));
    for (const item of result.reviseList.slice(0, 6)) {
      const box = ui.element("div", "revise-card");
      box.appendChild(ui.element("strong", "", `${item.topic} · ${item.title}, p. ${item.page}`));
      box.appendChild(ui.element("div", "", truncate(item.answer || item.quote, 160)));
      revise.appendChild(box);
    }
    detail.appendChild(revise);
  }

  const topics = ui.element("section", "card result-section");
  topics.appendChild(ui.element("h3", "", t("quiz.topicBreakdown")));
  for (const topic of result.topicBreakdown || []) {
    const row = ui.element("div", `topic-bar${topic.percent < 50 ? " low" : ""}`);
    row.appendChild(ui.element("span", "", truncate(topic.topic, 22)));
    const meter = ui.element("div", "meter");
    const fill = ui.element("span");
    fill.style.width = `${topic.percent}%`;
    meter.appendChild(fill);
    row.append(meter, ui.element("strong", "", `${topic.percent}%`));
    topics.appendChild(row);
  }
  detail.appendChild(topics);

  const review = ui.element("section", "card result-section");
  review.appendChild(ui.element("h3", "", t("quiz.perQuestion")));
  for (const [index, item] of (result.perQuestion || []).entries()) {
    const box = ui.element("div", "review-item");
    const top = ui.element("div", "review-top");
    top.appendChild(ui.element("span", `status-pill ${item.status}`, item.status));
    top.appendChild(ui.element("span", "review-prompt", `${index + 1}. ${truncate(item.question.prompt, 100)}`));
    box.appendChild(top);
    box.appendChild(ui.element("p", "", `Your answer: ${item.submitted || "(empty)"}`));
    box.appendChild(ui.element("p", "", `${item.feedback} Correct: ${truncate(item.correctText, 120)}`));
    const source = ui.element("button", "source-link", `${item.question.source?.title || "Textbook"} · page ${item.question.source?.page || "?"} ↗`);
    source.type = "button";
    source.addEventListener("click", () => openQuestionSource(item.question.source));
    box.appendChild(source);
    review.appendChild(box);
  }
  detail.appendChild(review);
  root.appendChild(detail);
}

function newQuizHandler() {
  clearQuizTimer();
  state.quiz = null;
  state.result = null;
  state.quizResponses = {};
  state.quizIndex = 0;
  renderQuizState();
}

function retakeQuiz() {
  if (!state.quiz) return;
  state.result = null;
  state.quizResponses = {};
  state.quizIndex = 0;
  $("#quiz-results").classList.add("hidden");
  $("#quiz-setup").classList.add("hidden");
  $("#quiz-runner").classList.remove("hidden");
  startQuizTimer();
  renderQuizQuestion();
}

function openQuestionSource(source) {
  if (!source) return;
  const index = state.indexes.find((entry) => entry.book.id === source.bookId);
  if (!index) return;
  openReader({
    book: index.book,
    pages: index.book.pages || [],
    initialPage: source.page || 1,
    highlight: source.quote || "",
  });
}

/* ------------------------------------------------------- performance card */

function openPerformanceCard(result) {
  const content = ui.element("div", "card-preview");
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  content.appendChild(canvas);
  const mime = preferredVideoMime();
  const share = {
    refCode: state.account?.refCode || "",
    link: state.account ? inviteLink(state.account.refCode) : "",
    username: state.account?.username || state.settings.profile || "Student",
  };
  content.appendChild(
    ui.element(
      "p",
      "hint",
      `Funky edit mode: neon cuts, beat drops and a squad invite. MP4 when supported, otherwise WebM; PNG always works. Preferred: ${mime || "browser default"}.`,
    ),
  );
  const progressWrap = ui.element("div", "recording-progress");
  const meter = ui.element("div", "meter");
  const fill = ui.element("span");
  meter.appendChild(fill);
  progressWrap.appendChild(meter);
  content.appendChild(progressWrap);

  let lastVideo = null;
  const actions = ui.element("div", "card-actions");
  const recordButton = ui.element("button", "button primary small", "Record edit video");
  const pngButton = ui.element("button", "button ghost small", "Download PNG poster");
  const shareButton = ui.element("button", "button ghost small", "Share video");
  actions.append(recordButton, pngButton, shareButton);
  content.appendChild(actions);

  const drawPreview = () =>
    drawPerformanceCard(canvas, {
      result,
      progress: state.studyProgress,
      profile: share.username,
      account: state.account,
      share,
      animation: 1,
    });
  drawPreview();

  recordButton.addEventListener("click", async () => {
    ui.setBusy(recordButton, true, "Recording…");
    fill.style.width = "0%";
    try {
      lastVideo = await createPerformanceVideo({
        canvas,
        result,
        progress: state.studyProgress,
        profile: share.username,
        account: state.account,
        share,
        duration: 7200,
        onProgress: (value) => {
          fill.style.width = `${Math.round(value * 100)}%`;
        },
      });
      downloadBlob(lastVideo.blob, lastVideo.filename);
      drawPreview();
      ui.showToast(`Saved ${lastVideo.extension.toUpperCase()} edit video. Go flex those marks!`, "success");
    } catch (error) {
      drawPreview();
      ui.showToast(error.message, "error");
    } finally {
      ui.setBusy(recordButton, false);
    }
  });

  pngButton.addEventListener("click", async () => {
    try {
      const blob = await createPoster(canvas, {
        result,
        progress: state.studyProgress,
        profile: share.username,
        account: state.account,
        share,
      });
      downloadBlob(blob, `vignan-vidyanikethan-edit-${new Date().toISOString().slice(0, 10)}.png`);
      ui.showToast("PNG edit poster saved.", "success");
    } catch (error) {
      ui.showToast(error.message, "error");
    }
  });

  shareButton.addEventListener("click", async () => {
    try {
      let video = lastVideo;
      if (!video) {
        ui.setBusy(shareButton, true, "Preparing…");
        video = await createPerformanceVideo({
          canvas,
          result,
          progress: state.studyProgress,
          profile: share.username,
          account: state.account,
          share,
          duration: 6200,
          onProgress: (value) => {
            fill.style.width = `${Math.round(value * 100)}%`;
          },
        });
        lastVideo = video;
        ui.setBusy(shareButton, false);
        drawPreview();
      }
      const file = new File([video.blob], video.filename, { type: video.mime });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "My Vignan Vidyanikethan AI edit",
          text: `I scored ${result.percent}% from my own textbooks. #VignanVidyanikethanAI #StudyStreak${share.refCode ? ` Join my squad: ${share.refCode}` : ""}`,
        });
      } else {
        downloadBlob(video.blob, video.filename);
        ui.showToast("Sharing is not supported here — the video was downloaded instead.", "warning");
      }
    } catch (error) {
      ui.setBusy(shareButton, false);
      ui.showToast(error.message || "Could not share the card.", "error");
    }
  });

  ui.openModal({ title: "Share your funky result edit", content, wide: false });
}

/* ------------------------------------------------------------- flashcards */

async function generateFlashcardsHandler() {
  const topic = $("#flash-topic").value.trim();
  const bookIds = scopeIds("#flash-book-scope");
  const count = Number($("#flash-count").value) || 10;
  const useModel = $("#flash-use-model")?.checked !== false;
  const button = $("#flash-generate");
  ui.setBusy(button, true, "Writing cards…");
  try {
    const retrieval = retrieveChapter(topic, state.indexes, { topK: Math.max(12, count), bookIds });
    let cards = [];
    if (useModel && state.settings.routing.flashcards !== "offline" && retrieval.hits.length) {
      try {
        cards = await generateFlashcardsWithModel({
          topic,
          hits: retrieval.hits,
          count,
          settings: state.settings,
        });
      } catch (error) {
        ui.showToast(`AI writer unavailable — offline cards used. ${error.message}`, "warning");
        showKeyExhaustedToast(error);
      }
    }
    if (!cards.length) cards = buildFlashcards(retrieval.hits, count);
    if (!cards.length) {
      ui.showToast("Not enough readable sentences for flashcards. Try another topic.", "warning");
      return;
    }
    state.flashcards = cards;
    state.flashProgress = readFlashProgress();
    state.flashIndex = 0;
    state.flashFlipped = false;
    renderFlashcards();
    ui.showToast(`${cards.length} flashcards generated from cited pages.`, "success");
  } catch (error) {
    console.error(error);
    ui.showToast(error.message || "Could not make flashcards.", "error");
  } finally {
    ui.setBusy(button, false);
  }
}

function renderFlashcards() {
  const area = $("#flashcard-area");
  area.replaceChildren();
  const stats = deckStats(state.flashcards, state.flashProgress);
  $("#deck-stats").textContent = state.flashcards.length
    ? `${stats.due} ${t("flashcards.due")} · ${stats.mastered} mastered · ${stats.reviews} reviews`
    : "";
  if (!state.flashcards.length) {
    area.appendChild(ui.emptyState("◇", t("flashcards.title"), t("flashcards.empty")));
    return;
  }
  const due = dueCards(state.flashcards, state.flashProgress);
  state.flashDeck = due.length ? due : state.flashcards;
  state.flashIndex = clamp(state.flashIndex, 0, state.flashDeck.length - 1);
  const card = state.flashDeck[state.flashIndex];

  const flashcard = ui.element("div", `flashcard${state.flashFlipped ? " flipped" : ""}`);
  flashcard.dataset.cardId = card.id;
  const inner = ui.element("div", "flashcard-inner");
  const front = ui.element("div", "flashcard-face flashcard-front");
  front.appendChild(ui.element("div", "flashcard-kicker", `${t("flashcards.flip")} · ${state.flashIndex + 1}/${state.flashDeck.length}`));
  front.appendChild(ui.element("div", "flashcard-text", card.front));
  front.appendChild(ui.element("div", "flashcard-source", `${card.source.title} · page ${card.source.page}`));
  const back = ui.element("div", "flashcard-face flashcard-back");
  back.appendChild(ui.element("div", "flashcard-kicker", "Answer"));
  back.appendChild(ui.element("div", "flashcard-text", card.back));
  const sourceButton = ui.element("button", "text-button", `Open page ${card.source.page} ↗`);
  sourceButton.type = "button";
  sourceButton.dataset.action = "source";
  sourceButton.addEventListener("click", (event) => {
    event.stopPropagation();
    openQuestionSource(card.source);
  });
  back.appendChild(sourceButton);
  inner.append(front, back);
  flashcard.appendChild(inner);
  flashcard.addEventListener("click", () => {
    state.flashFlipped = !state.flashFlipped;
    flashcard.classList.toggle("flipped", state.flashFlipped);
  });
  area.appendChild(flashcard);

  const progress = ui.element("div", "deck-progress");
  const meter = ui.element("div", "meter");
  const fill = ui.element("span");
  fill.style.width = `${((state.flashIndex + 1) / state.flashDeck.length) * 100}%`;
  meter.appendChild(fill);
  progress.appendChild(meter);
  area.appendChild(progress);

  const controls = ui.element("div", "flash-controls");
  const again = ui.element("button", "button ghost", t("flashcards.again"));
  again.dataset.action = "again";
  again.dataset.cardId = card.id;
  const gotIt = ui.element("button", "button primary", t("flashcards.gotIt"));
  gotIt.dataset.action = "got";
  gotIt.dataset.cardId = card.id;
  controls.append(again, gotIt, ui.element("span", "flash-hint", due.length ? `${due.length} due now` : "All caught up — reviewing anyway"));
  area.appendChild(controls);
}

function handleFlashAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button || !["again", "got"].includes(button.dataset.action)) return;
  const remembered = button.dataset.action === "got";
  state.flashProgress = reviewCard(state.flashProgress, button.dataset.cardId, remembered);
  writeFlashProgress(state.flashProgress);
  state.flashIndex = state.flashDeck.length ? (state.flashIndex + 1) % state.flashDeck.length : 0;
  state.flashFlipped = false;
  renderFlashcards();
}

/* --------------------------------------------------------------- progress */

function renderProgress() {
  const grid = $("#stat-grid");
  grid.replaceChildren();
  const cards = [
    { label: t("progress.streak"), value: `${state.studyProgress.current || 0} 🔥`, sub: streakMessage(state.studyProgress) },
    { label: t("progress.xp"), value: String(state.studyProgress.xp || 0), sub: `${state.studyProgress.best || 0} day best streak` },
    { label: t("progress.quizzes"), value: String(state.studyProgress.totalQuizzes || 0), sub: `${state.results.length} saved results` },
    { label: t("progress.accuracy"), value: `${accuracy(state.studyProgress)}%`, sub: `${state.studyProgress.totalCorrect || 0} / ${state.studyProgress.totalQuestions || 0} marks` },
  ];
  for (const item of cards) {
    const card = ui.element("div", "card stat-card");
    card.appendChild(ui.element("div", "stat-icon", "✦"));
    card.appendChild(ui.element("div", "stat-label", item.label));
    card.appendChild(ui.element("div", "stat-value", item.value));
    card.appendChild(ui.element("div", "hint", item.sub));
    grid.appendChild(card);
  }

  const mastery = $("#mastery-list");
  mastery.replaceChildren();
  const topics = topicMastery(state.results);
  if (!topics.length) mastery.appendChild(ui.element("p", "hint", "Finish a quiz to see which topics need revision."));
  for (const topic of topics) {
    const row = ui.element("div", "list-row");
    const main = ui.element("div", "list-row-main");
    main.appendChild(ui.element("strong", "", topic.topic));
    const meter = ui.element("div", "meter");
    const fill = ui.element("span");
    fill.style.width = `${topic.percent}%`;
    meter.appendChild(fill);
    main.appendChild(meter);
    row.append(main, ui.element("span", "list-row-value", `${topic.percent}%`));
    mastery.appendChild(row);
  }

  const board = $("#leaderboard-list");
  board.replaceChildren();
  const ranks = leaderboard(state.results);
  if (!ranks.length) board.appendChild(ui.element("p", "hint", "No scores yet. Finish a quiz to join the local board."));
  ranks.forEach((entry, index) => {
    const row = ui.element("div", "list-row");
    row.appendChild(ui.element("div", "rank", String(index + 1)));
    const main = ui.element("div", "list-row-main");
    main.appendChild(ui.element("strong", "", entry.name));
    main.appendChild(ui.element("span", "", `${entry.quizzes} quizzes · ${entry.xp} XP · avg ${entry.average}%`));
    row.append(main, ui.element("span", "list-row-value", `${entry.best}%`));
    board.appendChild(row);
  });

  const recent = $("#recent-results");
  recent.replaceChildren();
  if (!state.results.length) recent.appendChild(ui.element("p", "hint", "Your recent quiz results will appear here."));
  for (const result of state.results.slice(0, 8)) {
    const row = ui.element("div", "list-row");
    row.appendChild(ui.element("div", "rank", "✓"));
    const main = ui.element("div", "list-row-main");
    main.appendChild(ui.element("strong", "", truncate(result.topic || "Chapter quiz", 48)));
    main.appendChild(ui.element("span", "", `${formatDate(result.date)} · ${result.profile || "Student"}`));
    row.append(main, ui.element("span", "list-row-value", `${result.percent}%`));
    recent.appendChild(row);
  }
  $("#profile-name").value = state.settings.profile || "Student";
}

async function saveProfile() {
  state.settings.profile = ($("#profile-name").value || "Student").trim().slice(0, 32) || "Student";
  await saveSettings();
  updateStatus();
  renderProgress();
  ui.showToast("Profile name saved.", "success");
}

async function resetProgressHandler() {
  const confirmed = await ui.confirmDialog({
    title: "Reset study progress?",
    message: "This clears streaks, XP and saved quiz results on this device. Your books stay in the library.",
    confirmLabel: "Reset progress",
    danger: true,
  });
  if (!confirmed) return;
  state.studyProgress = resetProgress();
  await db.clearResults();
  state.results = [];
  state.result = null;
  state.quiz = null;
  renderProgress();
  renderQuizState();
  ui.showToast("Local progress reset. Your squad account stats stay on the server.", "success");
}

/* --------------------------------------------------------------- settings */

let lastKeyToastAt = 0;
function showKeyExhaustedToast(error) {
  if (error?.code !== "ALL_KEYS_EXHAUSTED" && !error?.needStudentKeys) return;
  const now = Date.now();
  if (now - lastKeyToastAt < 60_000) return;
  lastKeyToastAt = now;
  ui.showToast(
    "All school AI keys are exhausted. Add your own in Settings → Your own API keys, or keep using offline answers.",
    "warning",
    9000,
  );
}

function renderSettings() {
  renderRoutingTable();
  renderProviderEditor();
  renderWebSettings();
  renderAppearanceSettings();
  renderStorageSummary();
  renderLocalAISettings();
  renderFreeAPILinks();
  renderStudentKeySettings();
  updateStatus();
  if (!state.localStatusRequested) {
    state.localStatusRequested = true;
    refreshLocalAIStatus(state.settings.localAIModel).catch(() => {});
  }
}

function renderLocalAISettings() {
  const select = $("#local-model-select");
  if (!select) return;
  select.replaceChildren();
  for (const model of LOCAL_MODELS) {
    const label = `${model.label} · ${model.download} · ${model.device}`;
    select.appendChild(ui.option(model.id, label, model.id === state.settings.localAIModel));
  }
  select.value = state.settings.localAIModel || DEFAULT_LOCAL_MODEL_ID;
  const snapshot = getLocalAIState();
  $("#local-recommended").value = localModelLabel(snapshot.recommendedModelId);
  $("#local-device-info").value = snapshot.webgpuReady
    ? `WebGPU + Worker ready${snapshot.capabilities.deviceMemory ? ` · ~${snapshot.capabilities.deviceMemory} GB` : ""}`
    : "WebGPU or Worker unavailable";
  renderLocalAIStatus(snapshot);
}

function renderLocalAIStatus(snapshot = state.localAI) {
  if (!snapshot) return;
  const chip = $("#local-ai-chip");
  if (chip) {
    chip.textContent = snapshot.ready
      ? "Model ready"
      : snapshot.status === "loading" || snapshot.status === "retrying" || snapshot.status === "generating"
        ? "Working…"
        : snapshot.webgpuReady
          ? "WebGPU ready"
          : "Fallback mode";
    chip.classList.toggle("online", snapshot.ready);
    chip.classList.toggle("warning", !snapshot.webgpuReady && !snapshot.ready);
  }
  const status = $("#local-ai-status");
  if (status) status.textContent = localAIStatusText(snapshot);
  const progressBar = $("#local-progress-bar");
  if (progressBar) progressBar.style.width = `${Math.round((snapshot.progress || 0) * 100)}%`;
  const progressText = $("#local-progress-text");
  if (progressText) progressText.textContent = snapshot.progressText || "Local model status will appear here.";
  const cacheInfo = $("#local-cache-info");
  if (cacheInfo) {
    cacheInfo.value = snapshot.cachedModels.length
      ? `Cached: ${snapshot.cachedModels.map((id) => localModelLabel(id)).join(", ")}`
      : "No model cached yet — first download needs internet";
  }
  const engineModel = $("#engine-model");
  if (engineModel) {
    engineModel.textContent = snapshot.ready
      ? snapshot.modelLabel
      : snapshot.cachedModels.length
        ? "Model cached"
        : "Offline extractive";
  }
  const engineDetail = $("#engine-detail");
  if (engineDetail) engineDetail.textContent = localAIStatusText(snapshot);
  const card = $("#local-engine-card");
  if (card) card.classList.toggle("ready", snapshot.ready);
}

function renderFreeAPILinks() {
  const warning = $("#free-api-warning");
  if (warning) warning.textContent = FREE_API_WARNING;
  const grid = $("#free-api-links");
  if (!grid) return;
  grid.replaceChildren();
  for (const provider of FREE_API_PROVIDERS) {
    const link = ui.element("a", "key-card");
    link.href = provider.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", `Open ${provider.name} key page in a new tab`);
    const head = ui.element("div", "key-card-head");
    head.appendChild(ui.element("strong", "", provider.name));
    const badge = ui.element("span", `key-badge${provider.local ? " local" : provider.recommended ? " recommended" : ""}`,
      provider.local ? "KEYLESS" : provider.recommended ? "START HERE" : "FREE TIER");
    head.appendChild(badge);
    link.appendChild(head);
    link.appendChild(ui.element("p", "key-free", provider.free));
    const meta = ui.element("div", "key-meta");
    meta.appendChild(ui.element("code", "", provider.model));
    meta.appendChild(ui.element("code", "", provider.env));
    link.appendChild(meta);
    link.appendChild(ui.element("span", "key-cta", provider.local ? "Open local model guide ↗" : "Create my own key ↗"));
    grid.appendChild(link);
  }
}

function selectedStudentProvider() {
  return STUDENT_KEY_PROVIDERS.find((provider) => provider.id === state.studentKeyProvider) || STUDENT_KEY_PROVIDERS[0];
}

function renderStudentKeySummary() {
  const container = $("#student-key-summary");
  const chip = $("#student-key-chip");
  const summary = studentKeySummary(state.settings);
  if (chip) {
    chip.textContent = !summary.enabled
      ? "Paused"
      : summary.keys
        ? `${summary.keys} local key${summary.keys === 1 ? "" : "s"}`
        : "Local only";
  }
  if (!container) return;
  container.replaceChildren();
  if (!summary.keys) {
    container.appendChild(ui.element("span", "vault-empty", "No student keys saved on this device yet."));
    return;
  }
  for (const entry of summary.entries.filter((item) => item.count > 0)) {
    const badge = ui.element("span", "vault-chip");
    badge.appendChild(ui.element("strong", "", entry.label));
    badge.appendChild(ui.element("span", "", `${entry.count} key${entry.count === 1 ? "" : "s"}`));
    container.appendChild(badge);
  }
}

function renderStudentKeySettings() {
  const select = $("#student-provider-select");
  const provider = selectedStudentProvider();
  if (!select || !provider) return;
  select.replaceChildren();
  for (const item of STUDENT_KEY_PROVIDERS) {
    select.appendChild(ui.option(item.id, item.label, item.id === provider.id));
  }
  select.value = provider.id;
  const vault = cleanStudentKeyVault(state.settings.studentKeys);
  const entry = vault[provider.id];
  $("#student-provider-endpoint").value = entry.endpoint;
  $("#student-provider-model").value = entry.model;
  $("#student-provider-keys").value = entry.keys.join("\n");
  $("#student-key-enabled").checked = state.settings.studentKeyFallback !== false;
  const cooldown = Math.round((state.serverHealth?.keyPool?.cooldownMs || 60_000) / 1000);
  $("#student-key-status").textContent =
    "Keys are tried one by one after the Render pool. A rate-limited key is paused for about " +
    `${cooldown}s. Keys never appear in exports, leaderboards or account data.`;
  renderStudentKeySummary();
}

function handleStudentProviderChange(event) {
  state.studentKeyProvider = event.target.value;
  renderStudentKeySettings();
}

async function handleStudentKeyToggle(event) {
  state.settings.studentKeyFallback = event.target.checked;
  await saveSettings();
  renderStudentKeySummary();
  renderStorageSummary();
  ui.showToast(
    state.settings.studentKeyFallback
      ? "Your keys will be used only after Render keys are exhausted."
      : "Student key fallback paused. Your saved keys remain on this device.",
    "success",
  );
}

async function saveStudentKeys() {
  const provider = selectedStudentProvider();
  if (!provider) return;
  const vault = cleanStudentKeyVault(state.settings.studentKeys);
  vault[provider.id] = {
    endpoint: cleanStudentEndpoint($("#student-provider-endpoint").value, provider.endpoint),
    model: $("#student-provider-model").value.trim().slice(0, 120) || provider.model,
    keys: parseApiKeys($("#student-provider-keys").value)
      .map((key) => key.slice(0, 512))
      .slice(0, 12),
  };
  state.settings.studentKeys = vault;
  state.settings.studentKeyFallback = $("#student-key-enabled").checked;
  await saveSettings();
  renderStudentKeySettings();
  renderStorageSummary();
  $("#student-key-status").textContent = `Saved ${vault[provider.id].keys.length} key(s) for ${provider.label} on this device only.`;
  ui.showToast("Student keys saved locally. They are excluded from exports.", "success");
}

async function clearStudentKeys() {
  const provider = selectedStudentProvider();
  if (!provider) return;
  const confirmed = await ui.confirmDialog({
    title: "Clear your saved keys?",
    message: `This removes all saved ${provider.label} API keys from this browser. Your account, books and progress are not affected.`,
    confirmLabel: "Clear keys",
    danger: true,
  });
  if (!confirmed) return;
  const vault = cleanStudentKeyVault(state.settings.studentKeys);
  vault[provider.id].keys = [];
  state.settings.studentKeys = vault;
  await saveSettings();
  renderStudentKeySettings();
  renderStorageSummary();
  $("#student-key-status").textContent = `No saved keys remain for ${provider.label}.`;
  ui.showToast("Student keys cleared from this device.", "success");
}

async function testStudentKeys(event) {
  const provider = selectedStudentProvider();
  const keys = parseApiKeys($("#student-provider-keys").value);
  if (!provider || !keys.length) {
    ui.showToast("Paste at least one API key before testing.", "warning");
    return;
  }
  const vault = cleanStudentKeyVault(state.settings.studentKeys);
  vault[provider.id] = {
    endpoint: cleanStudentEndpoint($("#student-provider-endpoint").value, provider.endpoint),
    model: $("#student-provider-model").value.trim().slice(0, 120) || provider.model,
    keys: keys.map((key) => key.slice(0, 512)).slice(0, 12),
  };
  const draft = normalizeSettings({
    ...state.settings,
    studentKeyFallback: true,
    studentKeys: vault,
    activeProvider: "server",
  });
  const button = event.currentTarget;
  const status = $("#student-key-status");
  ui.setBusy(button, true, "Testing…");
  status.textContent = "Testing your keys through this site's /api/ai proxy…";
  try {
    const reply = await testModel(draft, "server", { forceStudentKeys: true });
    status.textContent = `Success. ${provider.label} replied: ${reply}`;
    ui.showToast("Your student key works.", "success");
  } catch (error) {
    status.textContent = `Test failed: ${error.message}`;
    ui.showToast(`Student key test failed: ${error.message}`, "error", 7000);
    showKeyExhaustedToast(error);
  } finally {
    ui.setBusy(button, false);
  }
}

function renderRoutingTable() {
  const table = $("#routing-table");
  table.replaceChildren();
  for (const task of TASKS) {
    const row = ui.element("div", "routing-row");
    const info = ui.element("div", "routing-task");
    info.appendChild(ui.element("strong", "", task.label));
    info.appendChild(ui.element("span", "", task.help));
    const select = document.createElement("select");
    select.dataset.task = task.id;
    select.appendChild(ui.option("offline", "Offline engine (private)", state.settings.routing[task.id] === "offline"));
    for (const provider of providerList()) {
      select.appendChild(ui.option(provider.id, provider.label, state.settings.routing[task.id] === provider.id));
    }
    select.value = state.settings.routing[task.id] || "offline";
    row.append(info, select);
    table.appendChild(row);
  }
}

function renderProviderEditor() {
  const select = $("#provider-select");
  select.replaceChildren();
  for (const provider of providerList()) {
    select.appendChild(ui.option(provider.id, provider.label, provider.id === state.settings.activeProvider));
  }
  select.value = state.settings.activeProvider;
  const config = providerConfig(state.settings);
  $("#provider-endpoint").value = config.endpoint || "";
  $("#provider-model").value = config.model || "";
  $("#provider-key").value = (config.apiKeys?.length ? config.apiKeys : parseApiKeys(config.apiKey)).join("\n");
  const definition = PROVIDERS[state.settings.activeProvider];
  const isWebLLM = definition?.kind === "webllm";
  $("#provider-endpoint").disabled = isWebLLM;
  $("#provider-key").disabled = isWebLLM;
  $("#provider-description").textContent = `${definition?.description || ""}${
    isWebLLM
      ? " Choose and download the model in the Real local model panel above."
      : definition?.needsKey
        ? " Paste one or more keys (comma/newline separated); Vignan rotates to the next key on quota errors. For production, prefer the local server proxy so keys never reach student browsers."
        : " No API key is needed for local/private providers."
  }`;

  const fallback = $("#fallback-provider");
  fallback.replaceChildren();
  fallback.appendChild(ui.option("offline", "Offline engine", state.settings.fallback === "offline"));
  for (const provider of providerList()) {
    fallback.appendChild(ui.option(provider.id, provider.label, provider.id === state.settings.fallback));
  }
  fallback.value = state.settings.fallback || "offline";
}

function renderWebSettings() {
  $("#settings-web-enabled").checked = Boolean(state.settings.webEnabled);
  $("#settings-web-mode").value = state.settings.webMode;
  $("#settings-web-endpoint").value = state.settings.searchEndpoint || "";
  $("#settings-web-token").value = state.settings.searchToken || "";
  $("#ask-web-fallback").checked = Boolean(state.settings.webEnabled);
}

function renderAppearanceSettings() {
  $("#settings-language").value = state.settings.language;
  $("#settings-theme").value = state.settings.theme;
  $("#settings-profile").value = state.settings.profile;
}

async function renderStorageSummary() {
  const summary = await db.storageSummary();
  const vault = studentKeySummary(state.settings);
  const usage = summary.quota ? `${(summary.quota.usage / 1024 / 1024).toFixed(1)} MB used` : "Storage estimate unavailable";
  $("#storage-summary").textContent = [
    `${summary.mode === "indexeddb" ? "Browser database" : "Temporary memory"} · ${usage}`,
    `${summary.books} books · ${summary.chunks} cached passages · ${summary.results} results · ${summary.messages} chat messages`,
    vault.keys
      ? `${vault.keys} student key${vault.keys === 1 ? "" : "s"} across ${vault.providers} provider${vault.providers === 1 ? "" : "s"} · excluded from exports`
      : "No student API keys saved on this device",
    privacyLabel(state.settings),
  ].join("\n");
}

async function handleRoutingChange(event) {
  const select = event.target.closest("select[data-task]");
  if (!select) return;
  state.settings.routing[select.dataset.task] = select.value;
  state.settings.freeRouterDismissed = true;
  await saveSettings();
  updateStatus();
  ui.showToast("Model routing saved.", "success");
}

async function handleProviderChange(event) {
  state.settings.activeProvider = event.target.value;
  await saveSettings();
  renderProviderEditor();
}

async function saveProvider() {
  const id = $("#provider-select").value;
  const definition = PROVIDERS[id];
  if (!definition) return;
  const isLocal = definition.kind === "webllm";
  const endpoint = isLocal ? definition.endpoint : $("#provider-endpoint").value.trim();
  const model = $("#provider-model").value.trim() || (isLocal ? definition.model : "");
  const apiKeys = isLocal ? [] : parseApiKeys($("#provider-key").value).map((key) => key.slice(0, 512)).slice(0, 12);
  if (definition.kind !== "server" && !isLocal && !endpoint) {
    ui.showToast("Add an endpoint for this provider.", "warning");
    return;
  }
  if (definition.kind !== "server" && !model) {
    ui.showToast("Add a model name for this provider.", "warning");
    return;
  }
  if (isLocal && !LOCAL_MODELS.some((item) => item.id === model)) {
    ui.showToast("Choose a supported local model from the list above.", "warning");
    return;
  }
  state.settings.activeProvider = id;
  state.settings.providers[id] = { endpoint, model, apiKey: apiKeys[0] || "", apiKeys };
  if (isLocal) {
    state.settings.localAIModel = model;
    state.settings.providers.webllm.model = model;
  }
  state.settings.fallback = $("#fallback-provider").value;
  state.settings.freeRouterDismissed = true;
  if ($("#provider-use-now").checked && id !== "offline") {
    for (const task of TASKS) state.settings.routing[task.id] = id;
  }
  await saveSettings();
  renderRoutingTable();
  renderLocalAISettings();
  updateStatus();
  ui.showToast(`${definition.label} saved${$("#provider-use-now").checked ? " and routed to every AI task" : ""}.`, "success");
}

async function resetProvider() {
  const id = $("#provider-select").value;
  const definition = PROVIDERS[id];
  if (!definition) return;
  state.settings.providers[id] = {
    endpoint: definition.endpoint,
    model: definition.model,
    apiKey: "",
    apiKeys: [],
  };
  if (definition.kind === "webllm") state.settings.localAIModel = definition.model;
  state.settings.freeRouterDismissed = true;
  await saveSettings();
  renderProviderEditor();
  renderLocalAISettings();
  ui.showToast("Provider defaults restored.", "success");
}

async function testProviderConnection() {
  const id = $("#provider-select").value;
  const draft = normalizeSettings({
    ...state.settings,
    activeProvider: id,
    providers: {
      ...state.settings.providers,
      [id]: {
        endpoint: $("#provider-endpoint").value.trim(),
        model: $("#provider-model").value.trim(),
        apiKey: $("#provider-key").value.trim(),
        apiKeys: parseApiKeys($("#provider-key").value),
      },
    },
  });
  const button = $("#provider-test");
  const result = $("#provider-test-result");
  ui.setBusy(button, true, "Testing…");
  result.textContent = "";
  try {
    const reply = await testModel(draft, id);
    result.textContent = `Connected: ${reply}`;
    ui.showToast("Provider connection works.", "success");
  } catch (error) {
    result.textContent = `Failed: ${error.message}`;
    ui.showToast(`Connection failed: ${error.message}`, "error", 6000);
  } finally {
    ui.setBusy(button, false);
  }
}

async function saveWebSettings() {
  state.settings.webEnabled = $("#settings-web-enabled").checked;
  state.settings.webMode = $("#settings-web-mode").value;
  state.settings.searchEndpoint = $("#settings-web-endpoint").value.trim();
  state.settings.searchToken = $("#settings-web-token").value.trim();
  if (state.settings.webEnabled && state.settings.webMode === "custom" && !state.settings.searchEndpoint) {
    ui.showToast("Add a custom JSON search endpoint first.", "warning");
    return;
  }
  await saveSettings();
  renderWebSettings();
  ui.showToast("Web fallback settings saved.", "success");
}

async function saveAppearance() {
  state.settings.language = $("#settings-language").value;
  state.settings.theme = $("#settings-theme").value;
  state.settings.profile = ($("#settings-profile").value || "Student").trim().slice(0, 32) || "Student";
  await saveSettings();
  setLanguage(state.settings.language);
  setTheme(state.settings.theme, { save: false });
  renderAll();
  ui.showToast("Appearance saved.", "success");
}

async function exportData() {
  const data = await db.exportData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  downloadBlob(blob, `vignan-vidyanikethan-ai-export-${new Date().toISOString().slice(0, 10)}.json`);
  ui.showToast("Data exported without API keys.", "success");
}

async function deleteAllData() {
  const confirmed = await ui.confirmDialog({
    title: "Delete all local data?",
    message: "Books, chats, quiz results, settings and cached passages will be removed from this device. This cannot be undone.",
    confirmLabel: t("settings.deleteAll"),
    danger: true,
  });
  if (!confirmed) return;
  await db.clearAllData();
  state.studyProgress = resetProgress();
  writeFlashProgress({});
  state.settings = normalizeSettings(DEFAULT_SETTINGS);
  await db.setSetting("settings", state.settings);
  state.messages = [];
  state.results = [];
  state.quiz = null;
  state.result = null;
  state.quizResponses = {};
  state.flashcards = [];
  state.flashProgress = {};
  state.lastAnswer = {};
  clearQuizTimer();
  await reloadIndexes();
  await loadDemoPack({ silent: true });
  addWelcomeMessage();
  setLanguage(state.settings.language);
  setTheme(state.settings.theme, { save: false });
  renderAll();
  ui.showToast("All local data deleted. A fresh demo pack was loaded.", "success");
}

/* ----------------------------------------------------------------- events */

function openSettingsPanel(id) {
  setView("settings");
  requestAnimationFrame(() => {
    const reduced = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    document.getElementById(id)?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  });
}

function selectedLocalModelId() {
  return $("#local-model-select")?.value || state.settings.localAIModel || DEFAULT_LOCAL_MODEL_ID;
}

function routeEveryTaskToLocal() {
  for (const task of TASKS) state.settings.routing[task.id] = "webllm";
  state.settings.activeProvider = "webllm";
  state.settings.fallback = "offline";
  state.settings.disclaimerSeen = true;
  state.settings.freeRouterDismissed = true;
}

async function activateLocalAI(button, { requireCached = false } = {}) {
  const modelId = selectedLocalModelId();
  const snapshot = getLocalAIState();
  if (requireCached && !snapshot.cachedModels.includes(modelId) && !(snapshot.ready && snapshot.modelId === modelId)) {
    ui.showToast("That model is not cached yet. Press Download & enable once first.", "warning", 6000);
    return;
  }
  ui.setBusy(button, true, requireCached ? "Loading…" : "Downloading…");
  try {
    state.settings.localAIModel = modelId;
    state.settings.providers.webllm.model = modelId;
    state.settings.providers.webllm.endpoint = PROVIDERS.webllm.endpoint;
    state.settings.providers.webllm.apiKey = "";
    routeEveryTaskToLocal();
    await saveSettings();
    const result = await loadLocalModel(modelId);
    state.settings.localAIModel = result.modelId;
    state.settings.providers.webllm.model = result.modelId;
    await saveSettings();
    await refreshLocalAIStatus(result.modelId);
    renderRoutingTable();
    renderProviderEditor();
    renderLocalAISettings();
    updateStatus();
    ui.showToast(`${result.label} is ready. Answers, quizzes, cards, grading and verification can run on this device.`, "success", 7000);
  } catch (error) {
    for (const task of TASKS) state.settings.routing[task.id] = "offline";
    state.settings.fallback = "offline";
    await saveSettings();
    renderRoutingTable();
    updateStatus();
    ui.showToast(`Local AI unavailable — cited excerpts kept. ${error.message}`, "warning", 9000);
  } finally {
    ui.setBusy(button, false);
  }
}

async function handleLocalModelChange() {
  const modelId = selectedLocalModelId();
  state.settings.localAIModel = modelId;
  state.settings.providers.webllm.model = modelId;
  state.settings.providers.webllm.endpoint = PROVIDERS.webllm.endpoint;
  state.settings.activeProvider = "webllm";
  await saveSettings();
  renderProviderEditor();
  renderLocalAISettings();
  await refreshLocalAIStatus(modelId).catch(() => {});
}

async function testLocalAIHandler(button) {
  const result = $("#local-ai-status");
  ui.setBusy(button, true, "Testing…");
  if (result) result.textContent = "Running a tiny local prompt…";
  try {
    const reply = await testLocalAI(selectedLocalModelId());
    if (result) result.textContent = `Local AI replied: ${reply}`;
    ui.showToast("Local AI is working on this device.", "success");
  } catch (error) {
    if (result) result.textContent = `Local AI test failed: ${error.message}`;
    ui.showToast(error.message || "Local AI test failed.", "warning", 7000);
  } finally {
    ui.setBusy(button, false);
  }
}

async function clearLocalModelHandler(button) {
  const modelId = selectedLocalModelId();
  const ok = await ui.confirmDialog({
    title: "Clear cached model?",
    message: `${localModelLabel(modelId)} will be removed from this browser. You can download it again later; textbooks and results are not deleted.`,
    confirmLabel: "Clear model",
    danger: true,
  });
  if (!ok) return;
  ui.setBusy(button, true, "Clearing…");
  try {
    await clearLocalModelCache(modelId);
    if (state.settings.routing.answer === "webllm") {
      for (const task of TASKS) state.settings.routing[task.id] = "offline";
      state.settings.fallback = "offline";
      await saveSettings();
    }
    await refreshLocalAIStatus(modelId).catch(() => {});
    renderRoutingTable();
    updateStatus();
    ui.showToast("Local model cache cleared.", "success");
  } catch (error) {
    ui.showToast(error.message || "Could not clear the model cache.", "warning");
  } finally {
    ui.setBusy(button, false);
  }
}

function bindEvents() {
  if (state.bound) return;
  state.bound = true;
  $$(".nav-item, .mobile-nav-item").forEach((button) => {
    const label = button.textContent.trim();
    button.title = label;
    button.setAttribute("aria-label", label);
    button.addEventListener("click", () => setView(button.dataset.view));
  });
  $("#theme-toggle").addEventListener("click", () =>
    setTheme(state.settings.theme === "dark" ? "light" : "dark"),
  );
  $("#profile-button").addEventListener("click", () => openAccountModal(state.account ? "account" : "register"));
  window.addEventListener("online", updateOfflineChip);
  window.addEventListener("offline", updateOfflineChip);

  $("#ask-form").addEventListener("submit", handleAsk);
  $("#ask-input").addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      $("#ask-form").requestSubmit();
    }
  });
  $("#mode-row").addEventListener("click", (event) => {
    const chip = event.target.closest(".mode-chip");
    if (chip) setMode(chip.dataset.mode);
  });
  $("#clear-chat").addEventListener("click", clearChat);
  $("#use-local-ai-button").addEventListener("click", () => openSettingsPanel("local-ai-panel"));
  $("#sidebar-local-ai").addEventListener("click", () => openSettingsPanel("local-ai-panel"));
  $("#free-keys-button").addEventListener("click", () => openSettingsPanel("free-api-card"));
  $("#add-my-key-button").addEventListener("click", () => openSettingsPanel("student-key-card"));
  $("#open-student-keys").addEventListener("click", () => openSettingsPanel("student-key-card"));
  $("#use-free-ai-button").addEventListener("click", async () => {
    if (!state.serverHealth.ai) {
      ui.showToast(
        "No Render AI keys are configured yet. Generate a free key for Render, or add your own key in Settings → Your own API keys, then reload.",
        "warning",
        8000,
      );
      openSettingsPanel("free-api-card");
      return;
    }
    for (const task of TASKS) state.settings.routing[task.id] = "server";
    state.settings.fallback = "offline";
    state.settings.activeProvider = "server";
    state.settings.disclaimerSeen = true;
    state.settings.freeRouterDismissed = false;
    await saveSettings();
    renderSettings();
    updateStatus();
    ui.showToast("Vignan Vidyanikethan AI free router connected.", "success");
  });
  $("#connect-model-button").addEventListener("click", () => {
    openSettingsPanel("provider-editor");
    requestAnimationFrame(() => $("#provider-select")?.focus({ preventScroll: true }));
  });
  $("#dismiss-banner").addEventListener("click", async () => {
    state.settings.disclaimerSeen = true;
    state.settings.freeRouterDismissed = true;
    await saveSettings();
    updateStatus();
  });

  $("#add-demo-book").addEventListener("click", () => loadDemoPack());
  const dropzone = $("#dropzone");
  dropzone.addEventListener("click", () => $("#file-input").click());
  dropzone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      $("#file-input").click();
    }
  });
  dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropzone.classList.add("dragover");
  });
  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
  dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropzone.classList.remove("dragover");
    handleFile(event.dataTransfer.files?.[0]);
  });
  $("#file-input").addEventListener("change", (event) => handleFile(event.target.files?.[0]));
  $("#upload-submit").addEventListener("click", handleUpload);
  $("#paste-submit").addEventListener("click", handlePaste);
  $("#book-list").addEventListener("click", handleBookAction);

  $("#quiz-generate").addEventListener("click", generateQuizHandler);
  $("#quiz-use-model").addEventListener("change", renderQuizEngineNote);
  $("#quiz-prev").addEventListener("click", () => {
    state.quizIndex -= 1;
    renderQuizQuestion();
  });
  $("#quiz-next").addEventListener("click", () => {
    state.quizIndex += 1;
    renderQuizQuestion();
  });
  $("#quiz-submit").addEventListener("click", submitQuiz);

  $("#flash-generate").addEventListener("click", generateFlashcardsHandler);
  $("#flashcard-area").addEventListener("click", handleFlashAction);

  $("#save-profile").addEventListener("click", saveProfile);
  $("#reset-progress").addEventListener("click", resetProgressHandler);

  $("#local-model-select").addEventListener("change", handleLocalModelChange);
  $("#local-ai-download").addEventListener("click", (event) =>
    activateLocalAI(event.currentTarget, { requireCached: false }),
  );
  $("#local-ai-use").addEventListener("click", (event) =>
    activateLocalAI(event.currentTarget, { requireCached: true }),
  );
  $("#local-ai-test").addEventListener("click", (event) => testLocalAIHandler(event.currentTarget));
  $("#local-ai-clear").addEventListener("click", (event) => clearLocalModelHandler(event.currentTarget));
  $("#routing-table").addEventListener("change", handleRoutingChange);
  $("#provider-select").addEventListener("change", handleProviderChange);
  $("#provider-save").addEventListener("click", saveProvider);
  $("#provider-reset").addEventListener("click", resetProvider);
  $("#provider-test").addEventListener("click", testProviderConnection);
  $("#student-provider-select").addEventListener("change", handleStudentProviderChange);
  $("#student-key-enabled").addEventListener("change", handleStudentKeyToggle);
  $("#student-key-save").addEventListener("click", saveStudentKeys);
  $("#student-key-clear").addEventListener("click", clearStudentKeys);
  $("#student-key-test").addEventListener("click", testStudentKeys);
  $("#web-save").addEventListener("click", saveWebSettings);
  $("#appearance-save").addEventListener("click", saveAppearance);
  $("#export-data").addEventListener("click", exportData);
  $("#clear-chat-data").addEventListener("click", async () => {
    await clearChat();
    renderStorageSummary();
  });
  $("#delete-all").addEventListener("click", deleteAllData);
}

init();
