/**
 * Vignan Vidyanikethan AI — application controller.
 *
 * Architecture: local textbook index -> evidence retrieval -> task-based model
 * router (existing AI providers) -> citation UI. The offline extractive engine
 * is the guaranteed fallback. No model is trained in this repository.
 */

import * as db from "./db.js?v=16";
import { buildBookIndex, retrieveChapter, retrievePreferBooks } from "./retrieval.js?v=16";
import { ingestPdf, ingestText } from "./ingest.js?v=16";
import { checkFileName, inspectFile, MAX_PDF_BYTES, MAX_TEXT_BYTES } from "./files.js?v=16";
import { downloadPublicLink, firstLink, hasLinkCredentials, readPublicLink } from "./link-reader.js?v=16";
import { asksAboutCreator, casualReply, consecutiveCasualTurns, contextualQuery, conversationReply, creatorAnswer, isFollowUp, safetyReply, searchTopic } from "./conversation.js?v=16";
import { lastCitedStudyContext, parseChatIntent, requestedChatMode } from "./chat-intents.js?v=16";
import { buildModelPaper, modelPaperText } from "./model-paper.js?v=16";
import { composeLinkAnswer, composeOutsideAnswer, composeWebAnswer } from "./external-answer.js?v=16";
import { knowledgeFactAnswer, knowledgeTopicAnswer } from "./knowledge.js?v=16";
import { composeGroundedAnswer, confidenceLabel, sourcesFromHits } from "./answer.js?v=16";
import {
  answerOutsideWithModel,
  answerWithModel,
  generateFlashcardsWithModel,
  generateQuizWithModel,
  gradeShortWithModel,
  testModel,
} from "./llm.js?v=16";
import { FREE_API_PROVIDERS, FREE_API_WARNING } from "./free-apis.js?v=16";
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
} from "./local-ai.js?v=16";
import { TASKS } from "./model-router.js?v=16";
import { PROVIDERS, providerList } from "./providers.js?v=16";
import {
  DEFAULT_SETTINGS,
  engineLabel,
  isModelConnected,
  normalizeSettings,
  privacyLabel,
  providerConfig,
  serverHealth,
} from "./settings.js?v=16";
import { parseApiKeys } from "./key-pool.js?v=16";
import {
  STUDENT_KEY_PROVIDERS,
  cleanStudentEndpoint,
  cleanStudentKeyVault,
  studentKeySummary,
} from "./student-keys.js?v=16";
import {
  generateQuiz,
  gradeQuiz,
  makeQuiz,
  recomputeResult,
} from "./quiz.js?v=16";
import {
  buildFlashcards,
  deckStats,
  dueCards,
  writeProgress as writeFlashProgress,
} from "./flashcards.js?v=16";
import {
  STUDY_DECKS_KEY, activeDeck, addDeck, cardsFromMistakes, emptyDeckCollection, makeStudyDeck,
  nextReviewIndex, nextStudyStep, normalizeDeckCollection, removeDeck, reviewDeck, selectDeck,
} from "./study-decks.js?v=16";
import {
  accuracy,
  currentStreak,
  leaderboard,
  readProgress as readStudyProgress,
  recordResult,
  resetProgress,
  streakMessage,
  topicMastery,
  writeProgress as writeStudyProgress,
} from "./progress.js?v=16";
import { externalSearchUrl, searchWeb } from "./web.js?v=16";
import { openEditStudio } from "./edit-studio.js?v=16";
import { openReader } from "./reader.js?v=16";
import { applyTranslations, languageName, setLanguage, t } from "./i18n.js?v=16";
import { languageLabel, languageGroups } from "./languages.js?v=16";
import { clamp, downloadBlob, formatDate, truncate, uid } from "./util.js?v=16";
import * as ui from "./ui.js?v=16";
import {
  clearReferral,
  getLeaderboard,
  getSession,
  inviteLink,
  logout,
  openAuthModal,
  readReferral,
  syncProgress,
} from "./auth.js?v=16";
import { aiOptionLabel, aiProfile } from "./ai-nicknames.js?v=16";
import {
  closeCommandMenu,
  initPremiumUI,
  openCommandMenu,
  setPremiumAI,
  setPremiumView,
  toggleSources,
} from "./premium-ui.js?v=16";
import { initMotion, revealVisible } from "./motion.js?v=16";
import { focusFriendsTab, initFriendsUI, renderFriends as renderSocialFriends, updateSocialBadges } from "./friends-ui.js?v=16";
import { initChatUI as initSocialChatUI, renderChat as renderSocialChat } from "./chat-ui.js?v=16";
import { initPlayUI as initSocialPlayUI, renderPlay as renderSocialPlay } from "./play-ui.js?v=16";
import { resetSocial, socialState, startSocialPolling, stopSocialPolling, syncSocial } from "./social.js?v=16";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const VIEW_META = {
  ask: { kicker: "view.ask.kicker", title: "view.ask.title", subtitle: "view.ask.subtitle" },
  library: { kicker: "view.library.kicker", title: "view.library.title", subtitle: "view.library.subtitle" },
  quiz: { kicker: "view.quiz.kicker", title: "view.quiz.title", subtitle: "view.quiz.subtitle" },
  flashcards: { kicker: "view.flashcards.kicker", title: "view.flashcards.title", subtitle: "view.flashcards.subtitle" },
  progress: { kicker: "view.progress.kicker", title: "view.progress.title", subtitle: "view.progress.subtitle" },
  friends: { kicker: "view.friends.kicker", title: "view.friends.title", subtitle: "view.friends.subtitle" },
  chat: { kicker: "view.chat.kicker", title: "view.chat.title", subtitle: "view.chat.subtitle" },
  play: { kicker: "view.play.kicker", title: "view.play.title", subtitle: "view.play.subtitle" },
  settings: { kicker: "view.settings.kicker", title: "view.settings.title", subtitle: "view.settings.subtitle" },
};

const SUGGESTIONS = [
  { label: "Why do leaves look green?", prompt: "Why do leaves look green?", mode: "answer" },
  { label: "Explain photosynthesis", prompt: "Explain photosynthesis step by step", mode: "explain" },
  { label: "Quiz me on forces", prompt: "Make a quiz on forces", mode: "answer" },
  { label: "Make flashcards", prompt: "Make flashcards on photosynthesis", mode: "answer" },
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
  askBusy: false,
  linkContext: null,
  paper: null,
  paperSelection: new Map(),
  quiz: null,
  quizResponses: {},
  quizIndex: 0,
  quizContext: null,
  quizTimer: null,
  quizDeadline: null,
  quizSubmitting: false,
  quizSubmissionPrompt: false,
  result: null,
  studyDecks: emptyDeckCollection(),
  storageMode: "indexeddb",
  flashcards: [],
  flashDeck: [],
  flashProgress: {},
  flashIndex: 0,
  flashFlipped: false,
  flashPracticeAll: false,
  deckStorageError: false,
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

async function init({ initialUser = null, guest = false, sessionKnown = false } = {}) {
  try {
    // Local storage and the optional health check run in parallel.
    const healthPromise = serverHealth();
    const stored = await db.getSetting("settings", null);
    state.settings = normalizeSettings(stored || DEFAULT_SETTINGS);
    state.studyProgress = readStudyProgress();
    state.storageMode = await db.getStorageMode();
    state.studyDecks = normalizeDeckCollection(await db.getSetting(STUDY_DECKS_KEY, null));
    syncActiveDeck();
    $("#deck-create").open = !state.studyDecks.decks.length;
    state.results = await db.getResults();
    state.messages = await db.getMessages(100);
    state.lastAnswer = [...state.messages].reverse().find((message) => message.role === "assistant" && (message.sources?.length || message.webSources?.length)) || {};
    setLanguage(state.settings.language);
    setTheme(state.settings.theme, { save: false });
    await reloadIndexes();
    if (!state.messages.length) addWelcomeMessage();
    bindEvents();
    subscribeLocalAI((snapshot) => {
      state.localAI = snapshot;
      renderLocalAIStatus(snapshot);
    });
    state.referral = readReferral();
    state.serverHealth = await healthPromise;
    if (guest) {
      state.account = null;
      state.authAvailable = Boolean(state.serverHealth.ok && state.serverHealth.accounts);
      if (state.authAvailable) void refreshLeaderboard();
    } else if (sessionKnown) {
      state.account = initialUser;
      state.authAvailable = true;
      void refreshLeaderboard();
    } else {
      await refreshAuth();
    }
    renderAll();
    $$(".view .card, .premium-hero, .command-group").forEach((element) => {
      if (!element.hasAttribute("data-reveal")) element.setAttribute("data-reveal", "");
    });
    initPremiumUI({
      currentAI: currentAIId(),
      currentView: state.currentView,
      onView: (view) => setView(view),
      onAction: (action, dataset) => handlePremiumAction(action, dataset),
      onAi: (providerId) => setActiveAI(providerId),
    });
    initMotion();
    initSocialScreens();
    const requestedView = new URL(location.href).searchParams.get("view");
    setView(VIEW_META[requestedView] ? requestedView : "ask", { skipHistory: true });
    registerServiceWorker();
    if (state.storageMode === "memory") {
      ui.showToast("This browser blocked storage. Your work will last only until this tab closes.", "warning", 9000);
    }
  } catch (error) {
    console.error("[vignan-ai] init failed", error);
    ui.showToast(`Vignan Vidyanikethan AI could not start: ${error.message}`, "error", 8000);
    bindEvents();
    renderAll();
  }
}

const rebuiltLegacyIndexes = new Map();
async function reloadIndexes() {
  const loaded = await db.loadAllIndexes();
  // Retire only the old auto-installed sample. Never delete student uploads,
  // notes, decks, chat history or quiz results during this migration.
  for (const index of loaded.filter((item) => item.book.demo === true)) {
    try { await db.deleteBook(index.book.id); }
    catch { ui.showToast("The old sample could not be removed from device storage; it is hidden from the library.", "warning"); }
  }
  const stored = loaded.filter((index) => index.book.demo !== true);
  const activeIds = new Set(stored.map((index) => index.book.id));
  for (const id of rebuiltLegacyIndexes.keys()) if (!activeIds.has(id)) rebuiltLegacyIndexes.delete(id);
  state.indexes = stored.map((index) => {
    if (Number(index.book.indexVersion) >= 2 || !index.book.pages?.length) return index;
    // Rebuild older tokenization without deleting or mutating stored books. If
    // storage is interrupted, the original textbook and PDF remain untouched.
    let rebuilt = rebuiltLegacyIndexes.get(index.book.id);
    if (!rebuilt) {
      rebuilt = buildBookIndex(index.book, index.book.pages);
      rebuiltLegacyIndexes.set(index.book.id, rebuilt);
    }
    return rebuilt;
  });
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
  if (view === "friends" || view === "chat" || view === "play") {
    if (state.account) syncSocial().catch(() => {});
    if (view === "friends") renderSocialFriends();
    if (view === "chat") renderSocialChat();
    if (view === "play") renderSocialPlay();
  }
  $("#main").scrollTop = 0;
  setPremiumView(view);
  requestAnimationFrame(() => revealVisible());
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
  setPremiumAI(currentAIId());
}

function renderQuizEngineNote() {
  const route = state.settings.routing.quiz;
  const useModel = $("#quiz-use-model")?.checked;
  const label =
    route === "offline" || !useModel
      ? t("common.offlineQuiz") || "Offline quiz writer"
      : `AI writer: ${aiProfile(route).nickname}`;
  const note = $("#quiz-engine-note");
  const context = state.quizContext;
  const usingAnswer = context && $("#quiz-topic")?.value.trim() === context.topic && $("#quiz-book-scope")?.value === context.bookScope;
  if (note) note.textContent = `${label}${usingAnswer ? " · using cited answer pages" : ""}`;
}

function renderAll() {
  applyTranslations(document);
  for (const button of $$(".nav-item, .mobile-nav-item")) {
    const label = button.textContent.trim();
    button.title = label;
    button.setAttribute("aria-label", label);
  }
  const meta = VIEW_META[state.currentView];
  if (meta) {
    $("#view-kicker").textContent = t(meta.kicker);
    $("#view-title").textContent = t(meta.title);
    $("#view-subtitle").textContent = t(meta.subtitle);
  }
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

async function refreshLeaderboard() {
  try {
    const board = state.authAvailable ? await getLeaderboard() : [];
    state.serverLeaderboard = board;
  } catch {
    state.serverLeaderboard = [];
  }
  renderAccount();
}

async function refreshAuth() {
  try {
    const session = await getSession();
    state.authAvailable = session.accountsAvailable !== false;
    state.account = session.user || null;
  } catch {
    state.authAvailable = false;
    state.account = null;
  }
  updateStatus();
  renderAccount();
  void refreshLeaderboard();
}

/** Reflect a successful entry-screen login without reloading the application. */
export async function setAccountSession(user = null, { guest = false } = {}) {
  state.account = user || null;
  if (user) {
    startSocialPolling();
    syncSocial().catch(() => {});
  } else {
    stopSocialPolling();
    resetSocial();
  }
  updateSocialBadges();
  state.authAvailable = Boolean(user) || Boolean(state.serverHealth.ok && state.serverHealth.accounts);
  state.serverLeaderboard = [];
  if (user) {
    clearReferral();
    state.referral = "";
  }
  updateStatus();
  renderAccount();
  renderProgress();
  if (state.authAvailable) void refreshLeaderboard();
}

/** Friends, chat and games share the account session and boot lazily. */
function initSocialScreens() {
  initFriendsUI();
  initSocialChatUI();
  initSocialPlayUI();
  if (state.account) {
    startSocialPolling();
    syncSocial().catch(() => {});
  }
  window.addEventListener("vignan:view", (event) => {
    const view = event.detail?.view;
    if (view && VIEW_META[view]) setView(view);
  });
  window.addEventListener("vignan:friends-tab", (event) => {
    focusFriendsTab(event.detail?.tab || "friends");
    setView("friends");
  });
  window.addEventListener("vignan:social-refresh", () => {
    if (state.account) syncSocial().catch(() => {});
  });
  $("#social-bell")?.addEventListener("click", () => {
    if (!state.account) {
      window.dispatchEvent(new CustomEvent("vignan:auth-required", { detail: { mode: "login" } }));
      return;
    }
    focusFriendsTab("alerts");
    setView("friends");
    syncSocial().catch(() => {});
  });
}

function openAccountModal(mode = "login") {
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
      await setAccountSession(null, { guest: true });
    },
    onViewProgress: () => setView("progress"),
  });
}

async function signOut() {
  try {
    await logout();
    await setAccountSession(null, { guest: true });
    ui.showToast("You have been logged out.", "info");
    window.dispatchEvent(new CustomEvent("vignan:auth-required", { detail: { mode: "login" } }));
  } catch {
    ui.showToast("Could not log out while the account server is offline. Please reconnect and try again.", "warning", 7000);
  }
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
        "Log in or create a free student account to sync streaks, join the live leaderboard and get a personal invite code.",
      ),
    );
    hero.appendChild(copy);
    body.appendChild(hero);

    const actions = ui.element("div", "account-actions");
    const login = ui.element("button", "button primary small", "Log in");
    login.type = "button";
    login.addEventListener("click", () => window.dispatchEvent(new CustomEvent("vignan:auth-required", { detail: { mode: "login" } })));
    const join = ui.element("button", "button ghost small", "Create an account");
    join.type = "button";
    join.addEventListener("click", () => window.dispatchEvent(new CustomEvent("vignan:auth-required", { detail: { mode: "register" } })));
    const keys = ui.element("button", "button ghost small", "Add my AI key");
    keys.type = "button";
    keys.addEventListener("click", () => openSettingsPanel("student-key-card"));
    actions.append(login, join, keys);
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
  // Locally generated actions can finish within one millisecond. Preserve the
  // user/assistant order when IndexedDB restores messages after a reload.
  const previousTime = Date.parse(state.messages.at(-1)?.createdAt || "") || 0;
  const createdAt = new Date(Math.max(Date.now(), previousTime + 1)).toISOString();
  const full = {
    id: uid("msg"),
    role: message.role === "user" ? "user" : "assistant",
    content: String(message.content || ""),
    createdAt,
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
    content: "**Welcome.** Add study material you have permission to use in Library, then ask a question for cited answers. When books have no match, web search can look on Wikipedia.",
    meta: "Offline ready",
  });
}

async function prepareQuizFromText(topic = "", bookId = "", sources = []) {
  if (state.quizSubmitting) { ui.showToast("Please wait while your quiz is graded.", "info"); return; }
  if (state.quiz && !state.result) {
    const confirmed = await ui.confirmDialog({
      title: "Start a different quiz?",
      message: "Your current unfinished quiz will be discarded.",
      confirmLabel: "Start a new quiz",
    });
    if (!confirmed) return;
  }
  newQuizHandler();
  renderBookScopes();
  $("#quiz-topic").value = topic;
  const select = $("#quiz-book-scope");
  select.value = [...select.options].some((option) => option.value === bookId) ? bookId : "all";
  if (sources.length) state.quizContext = { topic, bookScope: select.value, sources };
  setView("quiz");
  $("#quiz-topic").focus({ preventScroll: true });
}

function renderSuggestions() {
  const container = $("#chat-suggestions");
  container.classList.toggle("hidden", state.messages.some((message) => message.role === "user"));
  container.replaceChildren();
  for (const suggestion of SUGGESTIONS) {
    const button = ui.element("button", "suggestion-chip", suggestion.label);
    button.type = "button";
    button.addEventListener("click", () => {
      if (suggestion.view === "quiz") {
        void prepareQuizFromText(suggestion.prompt);
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
  $("#view-ask")?.classList.toggle("has-conversation", state.messages.some((message) => message.role === "user"));
  log.replaceChildren();
  let lastQuestion = "";
  for (const message of state.messages) {
    const wrapper = ui.element("div", `message ${message.role}`);
    const avatar = ui.element("div", "message-avatar", message.role === "user" ? "S" : "V");
    const body = ui.element("div", "message-body");
    if (message.role === "user") {
      body.textContent = message.content;
      lastQuestion = message.content;
    } else {
      ui.renderRichText(body, message.content, {
        sources: message.sources,
        webSources: message.webSources,
        onSource: (number, source) => openSource(source),
        onWebSource: (number, source) => openWebSource(source),
      });
      const meta = ui.element("div", "message-meta");
      if (message.meta) meta.appendChild(ui.element("span", "", message.meta));
      if (message.confidence) meta.appendChild(ui.element("span", "", `${Math.round(message.confidence * 100)}% text match`));
      if (message.verification?.enabled && message.verification.supported) {
        meta.appendChild(ui.element("span", "", "✓ Second AI check"));
      }
      if (meta.childNodes.length) body.appendChild(meta);
      if (lastQuestion) {
        const actions = ui.element("div", "message-actions");
        const copy = ui.element("button", "message-action", "Copy answer");
        copy.type = "button";
        copy.addEventListener("click", () => copyText(formatAnswerForCopy(message), "Answer and citations copied."));
        actions.appendChild(copy);
        if (message.sources?.length) {
          const question = lastQuestion;
          const ids = [...new Set(message.sources.map((source) => source.bookId).filter(Boolean))];
          const quiz = ui.element("button", "message-action", "Quiz me on this");
          quiz.type = "button";
          quiz.addEventListener("click", () => prepareQuizFromText(question, ids.length === 1 ? ids[0] : "", message.sources));
          actions.appendChild(quiz);
        }
        body.appendChild(actions);
      }
    }
    wrapper.append(avatar, body);
    log.appendChild(wrapper);
  }
  log.scrollTop = log.scrollHeight;
  renderSuggestions();
}

function showTyping(visible) {
  $("#typing").classList.toggle("hidden", !visible);
  $("#ask-send").disabled = visible;
}

function chatActionText(key, language = state.settings.language, values = {}) {
  const copies = {
    missingContext: {
      en: "I need a recent cited library answer for “that”. Ask about a chapter first, or name the topic in your request. Web snippets must be imported into Library before I can make study materials from them.",
      te: "‘దాని’ కోసం ఇటీవల పుస్తక మూలాలతో వచ్చిన సమాధానం కావాలి. ముందుగా అధ్యాయం గురించి అడగండి లేదా అంశం పేరు చెప్పండి. వెబ్ సమాచారాన్ని ముందుగా Library లో చేర్చండి.",
      hi: "‘उस’ के लिए हाल का स्रोत सहित लाइब्रेरी उत्तर चाहिए। पहले अध्याय के बारे में पूछें या विषय का नाम बताएँ। वेब सामग्री पहले Library में जोड़ें।",
    },
    cancelled: { en: "Cancelled. Your unfinished quiz is still here.", te: "రద్దు చేశాను. మీ అసంపూర్తి క్విజ్ అలాగే ఉంది.", hi: "रद्द किया। आपकी अधूरी क्विज़ सुरक्षित है।" },
    quiz: { en: "I started a quiz with {count} cited questions. Open Quiz to begin.", te: "{count} మూలాలతో కూడిన ప్రశ్నల క్విజ్ మొదలైంది. Quiz తెరిచి ప్రారంభించండి.", hi: "{count} स्रोत सहित प्रश्नों की क्विज़ शुरू है। Quiz खोलकर शुरू करें।" },
    cards: { en: "I made {count} cited flashcards and opened your deck.", te: "{count} మూలాలతో ఫ్లాష్ కార్డులు తయారు చేసి డెక్ తెరిచాను.", hi: "{count} स्रोत सहित फ़्लैशकार्ड बनाकर डेक खोल दिया है।" },
    paper: { en: "I assembled {count} practice questions from the selected local documents. The preview shows source pages; questions can be reused and the paper does not predict the exam. No answer key was inferred.", te: "ఎంచుకున్న ఫైళ్ల నుండి {count} సాధన ప్రశ్నలు తయారు చేశాను. మూల పేజీలు ప్రివ్యూలో ఉన్నాయి. ప్రశ్నలు తిరిగి వాడవచ్చు; ఇది పరీక్ష అంచనా కాదు. సమాధానాలు ఊహించలేదు.", hi: "चुनी हुई फ़ाइलों से {count} अभ्यास प्रश्न बनाए हैं। स्रोत पृष्ठ प्रीव्यू में हैं। प्रश्न दोबारा उपयोग हो सकते हैं; यह परीक्षा की भविष्यवाणी नहीं है। उत्तरमाला का अनुमान नहीं लगाया।" },
  };
  let value = copies[key]?.[language] || copies[key]?.en || "";
  for (const [name, replacement] of Object.entries(values)) value = value.replaceAll(`{${name}}`, String(replacement));
  return value;
}

async function executeChatAction(intent, history) {
  if (intent.action === "navigate") return { text: `Opened ${intent.view}.`, view: intent.view, sources: [] };
  const context = intent.contextual ? lastCitedStudyContext(history) : null;
  if (intent.contextual && !context) return { text: chatActionText("missingContext"), sources: [] };
  const topic = intent.contextual ? (intent.topic || context.topic) : intent.topic;
  const ids = intent.contextual
    ? [...new Set(context.sources.map((source) => source.bookId).filter(Boolean))]
    : scopeIds("#ask-book-scope");

  if (intent.action === "quiz") {
    if (state.quizSubmitting) return { text: "Please wait while your current quiz is graded.", sources: [] };
    const guard = { quiz: state.quiz, result: state.result };
    if (state.quiz && !state.result) {
      const confirmed = await ui.confirmDialog({
        title: "Start a different quiz?", message: "Your current unfinished quiz will be discarded only if the new quiz is ready.", confirmLabel: "Start a new quiz",
      });
      if (!confirmed) return { text: chatActionText("cancelled"), sources: [] };
      if (state.quiz !== guard.quiz || state.result !== guard.result || state.quizSubmitting) return { text: "Your quiz changed while the confirmation was open. Please try again.", sources: [] };
    }
    const prior = { context: state.quizContext, topic: $("#quiz-topic").value, scope: $("#quiz-book-scope").value };
    renderBookScopes();
    $("#quiz-topic").value = topic || "";
    const select = $("#quiz-book-scope");
    select.value = ids.length === 1 && [...select.options].some((option) => option.value === ids[0]) ? ids[0] : "all";
    $("#quiz-count").value = String(intent.count || 5);
    $("#quiz-type").value = intent.type || "mcq";
    $("#quiz-difficulty").value = intent.difficulty || "medium";
    $("#quiz-timed").value = "no";
    state.quizContext = context ? { topic: topic || "", bookScope: select.value, sources: context.sources } : null;
    const result = await generateQuizHandler({ guard });
    if (!result?.ok) {
      state.quizContext = prior.context;
      $("#quiz-topic").value = prior.topic;
      select.value = prior.scope;
      return { text: result?.message || "I could not make that quiz.", sources: [] };
    }
    return { text: chatActionText("quiz", undefined, { count: result.quiz.questions.length }), sources: sourcesFromHits(result.hits), view: "quiz", focus: "#quiz-question" };
  }

  if (intent.action === "flashcards") {
    $("#flash-topic").value = topic || "";
    const select = $("#flash-book-scope");
    select.value = ids.length === 1 && [...select.options].some((option) => option.value === ids[0]) ? ids[0] : "all";
    const result = await generateFlashcardsHandler({ topic: topic || "", bookIds: ids, count: intent.count || 10, ...(context ? { sources: context.sources } : {}) });
    if (!result?.ok) return { text: result?.message || "I could not make those flashcards.", sources: [] };
    const notSaved = result.saved ? "" : " The deck is only available in this tab because saving failed.";
    return { text: chatActionText("cards", undefined, { count: result.cards.length }) + notSaved, sources: sourcesFromHits(result.hits), view: "flashcards", focus: "#flashcard-area .flashcard" };
  }

  if (intent.action === "paper") {
    const chosen = context ? ids : [...state.paperSelection].filter(([, checked]) => checked).map(([id]) => id);
    const result = generateModelPaper({ bookIds: chosen, topic: context ? intent.topic : topic, count: intent.count || 10 });
    if (!result.ok) return { text: result.message, sources: [] };
    if (context) {
      for (const book of state.books) state.paperSelection.set(book.id, chosen.includes(book.id));
      renderPaperSources();
    }
    $("#paper-builder").open = true;
    return { text: chatActionText("paper", undefined, { count: result.paper.questions.length }), sources: [], view: "library", focus: "#paper-preview-title" };
  }
  return { text: "I could not complete that action.", sources: [] };
}

async function handleAsk(event) {
  event.preventDefault();
  if (state.askBusy) return;
  const input = $("#ask-input");
  const query = input.value.trim();
  if (!query) return;
  const submittedLink = firstLink(query);
  if (submittedLink && hasLinkCredentials(submittedLink)) {
    ui.showToast("Please remove usernames, passwords or signed tokens and use a public link.", "warning", 6500);
    return;
  }
  const history = state.messages.slice(-12);
  addMessage({ role: "user", content: query });
  input.value = "";
  state.askBusy = true;
  showTyping(true);

  try {
    const requestedLink = submittedLink;
    const previousAssistant = [...history].reverse().find((message) => message.role === "assistant" && !["Bolt · conversation", "Bolt · casual"].includes(message.meta));
    const recentLink = state.linkContext && previousAssistant?.webSources?.some((source) =>
      String(source.url || "").split("#")[0] === state.linkContext.resource.url.split("#")[0],
    );
    let answer = null;
    let hits = [];
    const language = state.settings.language;
    const safety = safetyReply(query, language);
    const intent = !safety && !asksAboutCreator(query) ? parseChatIntent(query) : null;
    const greeting = conversationReply(query, language);
    const casual = requestedLink ? "" : casualReply(query, language, consecutiveCasualTurns(history));
    const requestMode = requestedChatMode(query) || state.mode;
    if (safety) {
      state.linkContext = null;
      answer = { text: safety, sources: [], webSources: [], flashcards: [], grounded: false, confidence: 0, meta: "Bolt · support", verification: { enabled: false } };
    } else if (asksAboutCreator(query)) {
      state.linkContext = null;
      answer = {
        text: creatorAnswer(language), sources: [], webSources: [], flashcards: [],
        grounded: false, confidence: 0, meta: "About Vignan AI", verification: { enabled: false },
      };
    } else if (intent) {
      const action = await executeChatAction(intent, history);
      answer = { text: action.text, sources: action.sources || [], webSources: [], flashcards: [], grounded: Boolean(action.sources?.length), confidence: 0, meta: "Bolt · study action", verification: { enabled: false } };
      state.lastAnswer = answer;
      addMessage({ role: "assistant", content: answer.text, sources: answer.sources, meta: answer.meta });
      renderSources(answer);
      if (action.view) {
        setView(action.view);
        if (action.focus) requestAnimationFrame(() => $(action.focus)?.focus({ preventScroll: false }));
      }
      return;
    } else if (greeting || casual) {
      answer = {
        text: greeting || casual, sources: [], webSources: [], flashcards: [],
        grounded: false, confidence: 0, meta: greeting ? "Bolt · conversation" : "Bolt · casual", verification: { enabled: false },
      };
    } else if (requestedLink || (recentLink && isFollowUp(query))) {
      if (requestedLink) {
        const resource = await readPublicLink(requestedLink);
        const index = buildBookIndex({ id: uid("link"), title: resource.title, subject: "Public web source", sourceUrl: resource.url }, resource.pages);
        state.linkContext = { resource, index };
      }
      answer = composeLinkAnswer({ query, ...state.linkContext });
    } else {
      state.linkContext = null;
      const effectiveQuery = contextualQuery(query, history);
      const schoolAnswer = knowledgeTopicAnswer(effectiveQuery, language) || knowledgeTopicAnswer(query, language);
      if (schoolAnswer) {
        answer = schoolAnswer;
      } else {
      const bookIds = scopeIds("#ask-book-scope");
      const retrieval = retrievePreferBooks(effectiveQuery, state.indexes, { topK: 5, bookIds });
      hits = retrieval.hits;
      const webEnabled = Boolean(state.settings.webEnabled);
      let webResults = [];
      let searchProvider = "Web search";
      let searchProviders = [];
      let searchError = null;
      if (!retrieval.grounded && webEnabled && retrieval.reason !== "too-vague") {
        try {
          const search = await searchWeb(searchTopic(effectiveQuery), { ...state.settings, webEnabled: true }, { natural: effectiveQuery });
          webResults = search.results || [];
          searchProvider = search.provider || "Web search";
          searchProviders = search.providers || [];
        } catch (error) {
          searchError = error;
          ui.showToast(`Web fallback failed: ${error.message}`, "warning");
        }
      }

      let modelError = null;
      const connected = state.settings.routing.answer !== "offline";
      if (hits.length && connected) {
        try {
          const model = await answerWithModel({
            query,
            hits,
            mode: requestMode,
            history: history.slice(-6).map(({ role, content }) => ({ role, content })),
            settings: state.settings,
          });
          if (!model.offline && model.content) {
            const webImportNotice = hits.some((hit) => hit.sourceUrl)
              ? "_This answer includes a website you imported; it is not an independently verified textbook._\n\n"
              : "";
            answer = {
              text: webImportNotice + model.content,
              sources: sourcesFromHits(hits), webSources: [], grounded: true,
              confidence: retrieval.confidence, verification: model.verification,
              meta: `${aiProfile(model.engine).nickname} · AI answer${model.fallbackUsed ? " (fallback)" : ""}`,
              flashcards: [],
            };
          } else if (model.error) modelError = model.error;
        } catch (error) { modelError = error; }
      }
      if (!answer && !hits.length && webResults.length) {
        // A connected model writes the outside answer from labelled source text;
        // the extractive composer is the no-key fallback.
        if (connected) {
          try {
            const model = await answerOutsideWithModel({
              query: effectiveQuery,
              results: webResults,
              history: history.slice(-4).map(({ role, content }) => ({ role, content })),
              settings: state.settings,
            });
            if (!model.offline && model.content) {
              answer = {
                text: model.content,
                sources: [], webSources: webResults.slice(0, 2), flashcards: [],
                grounded: false, confidence: 0, meta: model.meta,
                verification: { enabled: false },
              };
            } else if (model.error) modelError = model.error;
          } catch (error) { modelError = error; }
        }
        if (!answer) {
          answer = composeOutsideAnswer({ query: effectiveQuery, results: webResults, provider: searchProvider, providers: searchProviders })
            || composeWebAnswer({ query: effectiveQuery, results: webResults, provider: searchProvider });
        }
      }
      if (!answer) {
        // No library page, no usable web text: fall back to the built-in fact pack.
        answer = knowledgeFactAnswer(effectiveQuery, language) || knowledgeFactAnswer(query, language);
      }
      if (!answer && !hits.length && webEnabled && !webResults.length
        && retrieval.reason !== "too-vague") {
        const query$ = searchTopic(effectiveQuery) || effectiveQuery;
        answer = {
          text: [
            `**${t("knowledge.notFound")}**`,
            t("knowledge.outsideHelp"),
            `- [DuckDuckGo](${externalSearchUrl(query$, "duckduckgo")})`,
            `- [Google](${externalSearchUrl(query$, "google")})`,
            searchError ? `_${searchError.message}_` : t("knowledge.webEmpty"),
          ].join("\n\n"),
          sources: [], webSources: [], flashcards: [], grounded: false, confidence: 0,
          meta: "Bolt · outside search unavailable", verification: { enabled: false },
        };
      }
      if (!answer) {
        answer = composeGroundedAnswer({
          query, evidenceQuery: effectiveQuery, hits, mode: requestMode,
          reason: retrieval.reason, confidence: retrieval.confidence, webResults, webEnabled, language: state.settings.language,
        });
        answer.meta = modelError ? "Model unavailable — cited excerpts shown"
          : hits.length ? "Bolt · cited library excerpts" : "Bolt · no matching source";
        answer.verification = { enabled: false };
        if (!hits.length && !webEnabled) {
          answer.text = `${answer.text}\n\n_${t("knowledge.webOff")}_`;
        }
        showKeyExhaustedToast(modelError);
      }
      if (requestMode === "flashcards" && hits.length && !answer.flashcards?.length) {
        answer.flashcards = buildFlashcards(hits, 6, { language: state.settings.language });
      }
      }
    }
    state.lastAnswer = answer;
    addMessage({
      role: "assistant", content: answer.text, sources: answer.sources,
      webSources: answer.webSources, meta: answer.meta, confidence: answer.confidence,
      verification: answer.verification, flashcards: answer.flashcards,
    });
    renderSources(answer);
    if (answer.flashcards?.length) {
      const { saved } = await saveNewDeck({ cards: answer.flashcards, topic: query, bookIds: hits.map((hit) => hit.bookId) });
      if (saved) ui.showToast(state.storageMode === "memory" ? "Cited cards are ready for this session." : "A cited revision deck was saved in Flashcards.", "success");
    }
  } catch (error) {
    // Never leave a submitted message unanswered, even for a blocked link.
    const message = firstLink(query)
      ? `I could not read that link. ${error.message || "Please use a public webpage, PDF or text file."}`
      : "I could not complete that answer. Please try again.";
    const answer = { text: message, sources: [], webSources: [], meta: "Bolt · request not completed", confidence: 0 };
    state.lastAnswer = answer;
    addMessage({ role: "assistant", content: answer.text, meta: answer.meta });
    renderSources(answer);
    ui.showToast(message, "warning", 6500);
  } finally {
    state.askBusy = false;
    showTyping(false);
  }
}

async function clearChat() {
  if (state.askBusy) { ui.showToast("Wait for the current answer before clearing the chat.", "info"); return; }
  await db.clearMessages();
  state.messages = [];
  state.linkContext = null;
  addWelcomeMessage();
  state.lastAnswer = {};
  renderSources({});
  ui.showToast("Chat cleared.", "success");
}

/* ---------------------------------------------------------------- sources */

function renderSources(answer = {}) {
  const sources = answer.sources || [];
  const webSources = answer.webSources || [];
  $("#source-count").textContent = String(sources.length + webSources.length);
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
  top.appendChild(ui.element("div", "source-title", `${source.sourceUrl ? "Web import · " : ""}${truncate(source.title, 54)}`));
  top.appendChild(ui.element("span", "source-page", source.sourceUrl && source.sourceKind !== "pdf" ? `section ${source.page}` : `p. ${source.page}`));
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

function studySourceLabel(source = {}) {
  source ||= {};
  const kind = source.sourceUrl && source.sourceKind !== "pdf" ? "section" : "page";
  return `${source.sourceUrl ? "Web import · " : ""}${source.title || "Library source"} · ${kind} ${source.page || "?"}`;
}

function formatAnswerForCopy(message) {
  const references = (message.sources || []).map((source, index) => `[${source.n || index + 1}] ${source.sourceUrl ? "Web import: " : ""}${source.title || "Library source"} · ${source.sourceUrl && source.sourceKind !== "pdf" ? "section" : "page"} ${source.page || "?"}${source.sourceUrl ? ` — ${source.sourceUrl}` : ""}`);
  const outside = (message.webSources || []).map((source, index) => `[W${index + 1}] ${source.title || "Outside source"} — ${source.url || ""}`);
  return [message.content || "", ...(references.length ? ["", "Textbook sources:", ...references] : []), ...(outside.length ? ["", "Outside sources:", ...outside] : [])].join("\n");
}

async function copyText(text, successMessage = "Quote copied.") {
  try {
    await navigator.clipboard.writeText(text || "");
    ui.showToast(successMessage, "success");
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

function citedHitsFromLibrary(sources = []) {
  return sources.flatMap((source) => {
    const index = state.indexes.find((entry) => entry.book.id === source.bookId);
    const chunk = index?.chunks?.find((entry) => entry.id === source.chunkId);
    if (!chunk) return [];
    return [{
      ...source, bookId: index.book.id, chunkId: chunk.id, title: index.book.title,
      page: chunk.page, section: chunk.section, text: chunk.text,
      sourceUrl: index.book.sourceUrl || "", sourceKind: index.book.type || "text",
    }];
  });
}

function topicSearchMessage(reason) {
  if (reason === "empty-library") return "Add a textbook or choose a book with readable text first.";
  if (reason === "too-vague") return "Name a topic, or leave it blank for general practice.";
  if (reason === "partial-topic") return "Only part of that topic matched. Try a shorter, more specific topic or another book.";
  return "That topic wasn't found in the selected books. Try another topic or add the right chapter.";
}

function renderLibrary() {
  renderPaperSources();
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
    copy.appendChild(ui.element("p", "", `${book.sourceUrl ? "WEB IMPORT · " : ""}${book.type?.toUpperCase() || "TEXT"} · ${book.fileName || "local notes"}`));
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

function renderPaperSources() {
  const container = $("#paper-sources");
  if (!container) return;
  container.replaceChildren();
  const ids = new Set(state.books.map((book) => book.id));
  for (const id of state.paperSelection.keys()) if (!ids.has(id)) state.paperSelection.delete(id);
  if (!state.books.length) {
    container.appendChild(ui.element("p", "hint", t("paper.empty")));
    return;
  }
  for (const book of state.books) {
    const label = ui.element("label", "paper-source-choice");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = book.id;
    input.checked = state.paperSelection.has(book.id) ? state.paperSelection.get(book.id) : true;
    state.paperSelection.set(book.id, input.checked);
    input.addEventListener("change", () => state.paperSelection.set(book.id, input.checked));
    const pageCount = book.pageCount || 0;
    const text = ui.element("span", "", `${book.sourceUrl ? "Web import · " : ""}${book.title} · ${pageCount} ${t(pageCount === 1 ? "common.page" : "common.pages")}`);
    label.append(input, text);
    container.appendChild(label);
  }
}

function renderModelPaper(paper) {
  const preview = $("#paper-preview");
  preview.hidden = !paper?.questions?.length;
  if (preview.hidden) return;
  $("#paper-preview-title").textContent = paper.title;
  const stats = paper.analysis;
  $("#paper-analysis").textContent = t("paper.stats", {
    found: stats.extracted, duplicates: stats.duplicates, selected: paper.questions.length,
    choices: stats.types["multiple-choice"] || 0, other: stats.types.written || 0,
    limited: stats.truncated ? t("paper.limited") : "",
  });
  const list = $("#paper-questions");
  list.replaceChildren();
  for (const item of paper.questions) {
    const li = document.createElement("li");
    li.appendChild(ui.element("div", "paper-question-text", item.text));
    const source = ui.element("button", "source-link paper-question-source", `${item.source.sourceUrl ? "Web import · " : ""}${item.source.title} · page ${item.source.page} ↗`);
    source.type = "button";
    source.addEventListener("click", () => openSource(item.source));
    li.appendChild(source);
    list.appendChild(li);
  }
}

function clearModelPaperPreview() {
  state.paper = null;
  $("#paper-preview").hidden = true;
  $("#paper-questions").replaceChildren();
  $("#paper-analysis").textContent = "";
}

function generateModelPaper({ bookIds, topic, count } = {}) {
  const chosen = Array.isArray(bookIds) ? bookIds : [...state.paperSelection].filter(([, checked]) => checked).map(([id]) => id);
  const indexes = state.indexes.filter((index) => chosen.includes(index.book.id));
  if (!indexes.length) {
    clearModelPaperPreview();
    const message = t("paper.selectSources");
    $("#paper-status").textContent = message;
    return { ok: false, message };
  }
  const target = typeof topic === "string" ? topic.trim() : $("#paper-topic").value.trim();
  const requested = clamp(Number(count) || Number($("#paper-count").value) || 10, 1, 30);
  const paper = buildModelPaper(indexes, { topic: target, count: requested });
  if (!paper.questions.length) {
    clearModelPaperPreview();
    const message = target ? t("paper.noTopic", { topic: target }) : t("paper.noQuestions");
    $("#paper-status").textContent = message;
    return { ok: false, message };
  }
  state.paper = paper;
  $("#paper-topic").value = target;
  $("#paper-count").value = String(requested);
  $("#paper-status").textContent = paper.questions.length < requested
    ? t("paper.builtFewer", { selected: paper.questions.length, requested })
    : t("paper.built", { selected: paper.questions.length });
  renderModelPaper(paper);
  return { ok: true, paper };
}

function handleFile(file) {
  if (!file) return;
  if ($("#upload-submit").disabled) {
    ui.showToast("Wait for the current import to finish.", "info");
    return;
  }
  state.selectedFile = null;
  $("#selected-file").classList.add("hidden");
  try {
    checkFileName(file.name, file.type);
    if (file.size > MAX_PDF_BYTES) throw new Error("That file is larger than 40 MB. Split it into chapters first.");
    if (!file.size) throw new Error("That file is empty.");
  } catch (error) {
    $("#file-input").value = "";
    ui.showToast(error.message, "warning");
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
    const inspected = await inspectFile(file);
    const index = inspected.kind === "pdf"
      ? await ingestPdf(file, meta, uploadProgress)
      : ingestText(inspected.text, meta, uploadProgress);
    if (!index.chunks.length) throw new Error("That file does not contain enough readable text to index.");
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
    $("#upload-progress").classList.add("hidden");
    ui.showToast(error.message || "Could not add that book.", "error");
  } finally {
    ui.setBusy(button, false);
  }
}

async function handleLinkImport() {
  const input = $("#library-url");
  const url = input.value.trim();
  if (!url) { ui.showToast("Enter a public webpage, PDF or text-file URL.", "warning"); return; }
  const button = $("#library-url-submit");
  if (button.disabled) return;
  ui.setBusy(button, true, "Importing…");
  try {
    const { url: finalUrl, file, inspected } = await downloadPublicLink(url);
    const fallbackTitle = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ") || new URL(finalUrl).hostname;
    const meta = { title: inspected.title || fallbackTitle, subject: "Web import", fileName: file.name, sourceUrl: finalUrl };
    const index = inspected.kind === "pdf" ? await ingestPdf(file, meta, uploadProgress) : ingestText(inspected.text, meta);
    if (!index.chunks.length) throw new Error("That source does not contain enough readable text to index.");
    await db.saveBookIndex(index);
    await reloadIndexes();
    input.value = "";
    $("#upload-progress").classList.add("hidden");
    renderBookScopes();
    renderLibrary();
    ui.showToast(`${index.book.title} imported. It remains labelled as a web source.`, "success", 5500);
  } catch (error) {
    $("#upload-progress").classList.add("hidden");
    ui.showToast(error.message || "Could not import that link.", "warning", 6500);
  } finally { ui.setBusy(button, false); }
}

async function handlePaste() {
  const raw = $("#paste-text").value.trim();
  if (raw.length < 40) {
    ui.showToast("Paste at least a paragraph of notes.", "warning");
    return;
  }
  if (new TextEncoder().encode(raw).length > MAX_TEXT_BYTES) {
    ui.showToast("Notes are limited to 4 MB. Split the material into chapters first.", "warning");
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
    await prepareQuizFromText("", book.id);
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
    if (state.paper?.questions.some((item) => item.source?.bookId === book.id)) {
      clearModelPaperPreview();
      $("#paper-status").textContent = "A source was removed. Build the paper again from the remaining documents.";
    }
    await reloadIndexes();
    renderBookScopes();
    renderLibrary();
    ui.showToast("Book removed.", "success");
  }
}

/* ------------------------------------------------------------------- quiz */

async function generateQuizHandler(options = {}) {
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
    const context = state.quizContext;
    const usingAnswer = context && topic === context.topic && $("#quiz-book-scope").value === context.bookScope;
    let retrieval;
    if (usingAnswer) {
      const hits = citedHitsFromLibrary(context.sources);
      if (!hits.length) {
        const message = "Those cited pages are no longer in your library. Choose another book or topic.";
        ui.showToast(message, "warning", 6500);
        return { ok: false, message };
      }
      retrieval = { hits, reason: "answer-sources" };
    } else {
      retrieval = retrieveChapter(topic, state.indexes, { topK: Math.max(12, count * 2), bookIds });
    }
    if (!retrieval.hits.length) {
      const message = topicSearchMessage(retrieval.reason);
      ui.showToast(message, "warning", 6500);
      return { ok: false, message };
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
        language: state.settings.language,
      });
    }
    if (!quiz.questions.length) {
      const message = "Not enough readable text was found for a quiz.";
      ui.showToast(message, "warning");
      return { ok: false, message };
    }
    if (options.guard && (state.quiz !== options.guard.quiz || state.result !== options.guard.result || state.quizSubmitting)) {
      const message = "The current quiz changed while questions were being written. Your current work was kept; please try again.";
      ui.showToast(message, "warning", 6500);
      return { ok: false, message };
    }
    state.quiz = quiz;
    state.quizResponses = {};
    state.quizIndex = 0;
    state.result = null;
    $("#quiz-setup").classList.add("hidden");
    $("#quiz-results").classList.add("hidden");
    $("#quiz-runner").classList.remove("hidden");
    $("#quiz-topic-title").textContent = quiz.title;
    // The model router may have fallen back to another provider; this API
    // returns questions, not the final route, so do not mislabel the writer.
    $("#quiz-run-note").textContent = `${quiz.questions.length} ${quiz.questions.length === 1 ? "question" : "questions"} · ${engine === "model" ? "AI writer · from your books" : "Bolt · from your books"}`;
    if (quiz.questions.length < count) ui.showToast(`Found enough material for ${quiz.questions.length} of the ${count} requested questions.`, "info", 5000);
    startQuizTimer();
    renderQuizQuestion();
    return { ok: true, quiz, hits: retrieval.hits };
  } catch (error) {
    console.error(error);
    const message = error.message || "Could not generate the quiz.";
    ui.showToast(message, "error");
    return { ok: false, message };
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
  const source = ui.element("p", "hint", studySourceLabel(question.source));
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
      submitQuiz({ auto: true });
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

async function submitQuiz(options = {}) {
  if (!state.quiz || state.quizSubmitting || state.result) return;
  const quiz = state.quiz;
  const auto = options.auto === true;
  const unanswered = quiz.questions.filter((question) => !String(state.quizResponses[question.id] ?? "").trim()).length;
  if (!auto && unanswered) {
    state.quizSubmissionPrompt = true;
    const confirmed = await ui.confirmDialog({
      title: "Submit with unanswered questions?",
      message: `${unanswered} ${unanswered === 1 ? "question is" : "questions are"} blank and will receive no points.`,
      confirmLabel: "Submit anyway",
    });
    state.quizSubmissionPrompt = false;
    if (!confirmed || state.quiz !== quiz || state.quizSubmitting || state.result) return;
  }
  state.quizSubmitting = true;
  // A timed quiz can expire while the unanswered-question prompt is open.
  if (auto && state.quizSubmissionPrompt) ui.closeModal();
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
    let savedLocally = state.storageMode !== "memory";
    try { await db.addResult(result); } catch (error) { savedLocally = false; console.error("Could not save quiz result", error); }
    state.results.unshift(result);
    renderQuizResults(result);
    renderProgress();
    $("#quiz-runner").classList.add("hidden");
    $("#quiz-results").classList.remove("hidden");
    ui.showToast(savedLocally ? `Quiz complete — ${result.percent}% · +${result.xp} XP` : `Quiz complete — ${result.percent}%. This result could not be saved on this device.`, savedLocally ? "success" : "warning", 6000);
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
        .catch(() => ui.showToast(savedLocally ? "Your result is on this device, but its score could not be added to your account." : "The result is only in this tab, and its score could not be added to your account.", "warning", 6000));
    }
  } catch (error) {
    console.error(error);
    ui.showToast(error.message || "Could not grade the quiz.", "error");
  } finally {
    state.quizSubmitting = false;
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
      `${Number(result.score).toFixed(Number.isInteger(result.score) ? 0 : 1)} / ${result.total} points · ${truncate(result.topic, 44)}`,
    ),
  );
  hero.appendChild(ui.element("p", "hint", streakMessage(state.studyProgress)));
  const card = ui.element("button", "result-edit-cta");
  card.type = "button";
  const cardIcon = ui.element("span", "result-edit-icon", "✳");
  cardIcon.setAttribute("aria-hidden", "true");
  const cardCopy = ui.element("span", "result-edit-copy");
  cardCopy.append(ui.element("strong", "", t("quiz.card")), ui.element("small", "", "Your score, remixed into a short video"));
  const cardArrow = ui.element("span", "result-edit-arrow", "↗");
  cardArrow.setAttribute("aria-hidden", "true");
  card.append(cardIcon, cardCopy, cardArrow);
  card.addEventListener("click", () => openPerformanceCard(result));
  hero.appendChild(card);
  const actions = ui.element("div", "result-actions");
  const newQuiz = ui.element("button", "button ghost small", t("quiz.newQuiz"));
  newQuiz.addEventListener("click", newQuizHandler);
  const canRetake = Boolean(state.quiz && state.quiz.id === result.quizId);
  const retake = ui.element("button", "button ghost small", canRetake ? t("quiz.retake") : "Practice this topic");
  retake.type = "button";
  retake.addEventListener("click", () => {
    if (canRetake) return retakeQuiz();
    newQuizHandler();
    $("#quiz-topic").value = result.topic === "Chapter quiz" ? "" : (result.topic || "");
    const bookId = result.perQuestion?.find((item) => item.question?.source?.bookId)?.question.source.bookId;
    if (bookId && [...$("#quiz-book-scope").options].some((option) => option.value === bookId)) $("#quiz-book-scope").value = bookId;
    $("#quiz-topic").focus();
  });
  actions.append(newQuiz, retake);
  if ((result.perQuestion || []).some((item) => item.question?.prompt && Number(item.awarded || 0) < 1)) {
    const reviseCards = ui.element("button", "button ghost small result-revise-cards", "Make cards from mistakes");
    reviseCards.type = "button";
    reviseCards.addEventListener("click", async () => {
      reviseCards.disabled = true;
      try { await reviewMistakes(result); } finally { reviseCards.disabled = false; }
    });
    actions.appendChild(reviseCards);
  }
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
    const source = ui.element("button", "source-link", `${studySourceLabel(item.question.source)} ↗`);
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
  state.quizContext = null;
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
  openSource(source);
}

/* ------------------------------------------------------- performance card */

function openPerformanceCard(result) {
  const share = {
    refCode: state.account?.refCode || "",
    link: state.account ? inviteLink(state.account.refCode) : "",
    username: state.account?.username || state.settings.profile || "Student",
  };
  openEditStudio({ result, progress: { ...state.studyProgress, current: currentStreak(state.studyProgress) }, profile: share.username, account: state.account, share });
}

/* ------------------------------------------------------------- flashcards */

let deckWriteQueue = Promise.resolve();

function syncActiveDeck() {
  const deck = activeDeck(state.studyDecks);
  state.flashcards = deck?.cards || [];
  state.flashProgress = deck?.progress || {};
}

function updateDeckStorageNote() {
  const note = $("#deck-storage-note");
  if (!note) return;
  note.textContent = state.storageMode === "memory"
    ? "Storage is blocked; these decks last only for this tab."
    : state.deckStorageError
      ? "The latest changes could not be saved and are only available in this tab."
      : "Cards and review dates stay on this device; they do not sync to your account.";
}

async function persistStudyDecks() {
  const snapshot = state.studyDecks;
  const write = deckWriteQueue.catch(() => {}).then(() => db.setSetting(STUDY_DECKS_KEY, snapshot));
  deckWriteQueue = write;
  try {
    await write;
    state.deckStorageError = false;
    updateDeckStorageNote();
    return true;
  } catch (error) {
    state.deckStorageError = true;
    updateDeckStorageNote();
    console.error("Could not save revision decks", error);
    ui.showToast("Your deck changes could not be saved; they are only available in this tab.", "warning", 7000);
    return false;
  }
}

async function saveNewDeck({ cards, topic = "", title = "", bookIds = [], originResultId = "" }) {
  const deck = makeStudyDeck({ cards, topic, title, bookIds, originResultId });
  state.studyDecks = addDeck(state.studyDecks, deck);
  syncActiveDeck();
  state.flashIndex = 0;
  state.flashFlipped = false;
  state.flashPracticeAll = false;
  $("#deck-create").open = false;
  renderFlashcards();
  renderStudyNext();
  const saved = await persistStudyDecks();
  return { deck, saved };
}

function openSavedDeck(deckId) {
  state.studyDecks = selectDeck(state.studyDecks, deckId);
  syncActiveDeck();
  state.flashIndex = 0;
  state.flashFlipped = false;
  state.flashPracticeAll = false;
  void persistStudyDecks();
  setView("flashcards");
}

async function reviewMistakes(result) {
  const cards = cardsFromMistakes(result);
  if (!cards.length) {
    ui.showToast("No missed questions to turn into cards yet.", "info");
    return;
  }
  const existing = state.studyDecks.decks.find((deck) => deck.originResultId && deck.originResultId === result.id);
  if (existing) {
    openSavedDeck(existing.id);
    ui.showToast("Opened your existing revision deck.", "info");
    return;
  }
  const { saved } = await saveNewDeck({
    cards,
    topic: result.topic || "Quiz review",
    title: `Revise: ${result.topic || "Quiz"}`,
    bookIds: cards.map((card) => card.source?.bookId).filter(Boolean),
    originResultId: result.id || "",
  });
  setView("flashcards");
  if (saved) ui.showToast(state.storageMode === "memory" ? "Revision cards are ready for this session." : "Missed questions saved as a revision deck.", "success");
}

async function generateFlashcardsHandler(options = {}) {
  const topic = typeof options.topic === "string" ? options.topic : $("#flash-topic").value.trim();
  const bookIds = Array.isArray(options.bookIds) ? options.bookIds : scopeIds("#flash-book-scope");
  const count = clamp(Number(options.count) || Number($("#flash-count").value) || 10, 3, 15);
  const useModel = $("#flash-use-model")?.checked !== false;
  const button = $("#flash-generate");
  ui.setBusy(button, true, "Writing cards…");
  try {
    const retrieval = Array.isArray(options.sources)
      ? { hits: citedHitsFromLibrary(options.sources), reason: "missing-cited-pages" }
      : retrieveChapter(topic, state.indexes, { topK: Math.max(12, count), bookIds });
    if (!retrieval.hits.length) {
      const message = retrieval.reason === "missing-cited-pages"
        ? "Those cited pages are no longer in your library. Choose another book or topic."
        : topicSearchMessage(retrieval.reason);
      ui.showToast(message, "warning", 6500);
      return { ok: false, message };
    }
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
    if (!cards.length) cards = buildFlashcards(retrieval.hits, count, { language: state.settings.language });
    if (!cards.length) {
      const message = "Not enough readable sentences for flashcards. Try another topic.";
      ui.showToast(message, "warning");
      return { ok: false, message };
    }
    const { saved } = await saveNewDeck({ cards, topic, bookIds: bookIds.length ? bookIds : retrieval.hits.map((hit) => hit.bookId) });
    if (saved) {
      const message = state.storageMode === "memory" ? "ready for this session" : "saved on this device";
      const fewer = cards.length < count ? ` (${cards.length} of ${count} requested)` : "";
      ui.showToast(`${cards.length} cited cards ${message}${fewer}.`, "success", 5000);
    }
    return { ok: true, cards, hits: retrieval.hits, saved };
  } catch (error) {
    console.error(error);
    const message = error.message || "Could not make flashcards.";
    ui.showToast(message, "error");
    return { ok: false, message };
  } finally {
    ui.setBusy(button, false);
  }
}

function renderFlashcards() {
  const area = $("#flashcard-area");
  const savedPanel = $("#saved-decks");
  const select = $("#flash-deck-select");
  const deck = activeDeck(state.studyDecks);
  savedPanel.hidden = !state.studyDecks.decks.length;
  // This panel starts hidden, so it must not remain transparent while waiting
  // for an IntersectionObserver after the first deck is created.
  savedPanel.classList.add("is-revealed");
  updateDeckStorageNote();
  select.replaceChildren();
  for (const entry of state.studyDecks.decks) {
    const dueCount = dueCards(entry.cards, entry.progress).length;
    select.appendChild(ui.option(entry.id, `${truncate(entry.title, 54)} · ${dueCount} due`, entry.id === deck?.id));
  }
  const stats = deckStats(state.flashcards, state.flashProgress);
  $("#deck-stats").textContent = deck ? `${stats.due} due · ${state.flashcards.length} cards` : "";
  area.replaceChildren();
  if (!state.flashcards.length) {
    area.appendChild(ui.emptyState("◇", "No decks yet", "Make a deck from a topic or turn quiz mistakes into cards."));
    return;
  }

  const due = dueCards(state.flashcards, state.flashProgress);
  if (!due.length && !state.flashPracticeAll) {
    const complete = ui.element("div", "card deck-complete");
    complete.appendChild(ui.element("span", "study-kicker", "NICE WORK"));
    complete.appendChild(ui.element("h3", "", "You're all caught up."));
    const nextDay = Object.values(state.flashProgress).map((item) => item?.due).filter(Boolean).sort()[0];
    complete.appendChild(ui.element("p", "", nextDay ? `Next review: ${nextDay}.` : "Your next review will appear here."));
    const practice = ui.element("button", "button ghost", "Practice anyway");
    practice.type = "button";
    practice.dataset.action = "practice-all";
    complete.appendChild(practice);
    complete.appendChild(ui.element("small", "", "Practice mode does not change your review schedule."));
    area.appendChild(complete);
    return;
  }

  state.flashDeck = state.flashPracticeAll ? state.flashcards : due;
  state.flashIndex = clamp(state.flashIndex, 0, state.flashDeck.length - 1);
  const card = state.flashDeck[state.flashIndex];
  const flashcard = ui.element("button", `flashcard${state.flashFlipped ? " flipped" : ""}`);
  flashcard.type = "button";
  flashcard.dataset.cardId = card.id;
  const inner = ui.element("div", "flashcard-inner");
  const front = ui.element("div", "flashcard-face flashcard-front");
  front.appendChild(ui.element("div", "flashcard-kicker", `Tap or press to reveal · ${state.flashIndex + 1}/${state.flashDeck.length}`));
  front.appendChild(ui.element("div", "flashcard-text", card.front));
  front.appendChild(ui.element("div", "flashcard-source", studySourceLabel(card.source)));
  const back = ui.element("div", "flashcard-face flashcard-back");
  const plainBack = card.back.replace(/\*\*(.*?)\*\*/g, "$1");
  back.appendChild(ui.element("div", "flashcard-kicker", "Answer · press to see question"));
  back.appendChild(ui.element("div", "flashcard-text", plainBack));
  inner.append(front, back);
  flashcard.appendChild(inner);
  area.appendChild(flashcard);

  const sourceButton = ui.element("button", "text-button deck-source", `Open ${studySourceLabel(card.source)} ↗`);
  sourceButton.type = "button";
  sourceButton.disabled = !card.source?.bookId;
  sourceButton.addEventListener("click", () => openQuestionSource(card.source));
  area.appendChild(sourceButton);

  const progress = ui.element("div", "deck-progress");
  const meter = ui.element("div", "meter");
  const fill = ui.element("span");
  fill.style.width = `${((state.flashIndex + 1) / state.flashDeck.length) * 100}%`;
  meter.appendChild(fill);
  progress.appendChild(meter);
  area.appendChild(progress);

  const controls = ui.element("div", "flash-controls");
  let again = null;
  let gotIt = null;
  if (state.flashPracticeAll) {
    const next = ui.element("button", "button primary", "Next card");
    next.type = "button";
    next.dataset.action = "practice-next";
    const backToDue = ui.element("button", "button ghost", "Back to schedule");
    backToDue.type = "button";
    backToDue.dataset.action = "practice-done";
    controls.append(next, backToDue, ui.element("span", "flash-hint", "Practice only · schedule unchanged"));
  } else {
    again = ui.element("button", "button ghost", t("flashcards.again"));
    again.type = "button";
    again.dataset.action = "again";
    again.dataset.cardId = card.id;
    gotIt = ui.element("button", "button primary", t("flashcards.gotIt"));
    gotIt.type = "button";
    gotIt.dataset.action = "got";
    gotIt.dataset.cardId = card.id;
    controls.append(again, gotIt, ui.element("span", "flash-hint", `${due.length} due · reveal, then rate your recall`));
  }
  area.appendChild(controls);

  function updateFlip() {
    flashcard.classList.toggle("flipped", state.flashFlipped);
    flashcard.setAttribute("aria-pressed", String(state.flashFlipped));
    front.setAttribute("aria-hidden", String(state.flashFlipped));
    back.setAttribute("aria-hidden", String(!state.flashFlipped));
    if (again) again.disabled = !state.flashFlipped;
    if (gotIt) gotIt.disabled = !state.flashFlipped;
  }
  flashcard.addEventListener("click", () => { state.flashFlipped = !state.flashFlipped; updateFlip(); });
  updateFlip();
}

function handleFlashAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  if (action === "practice-all" || action === "practice-done") {
    state.flashPracticeAll = action === "practice-all";
    state.flashIndex = 0;
    state.flashFlipped = false;
    renderFlashcards();
    if (event.detail === 0) $(".flashcard, .deck-complete button", $("#flashcard-area"))?.focus({ preventScroll: true });
    return;
  }
  if (action === "practice-next") {
    state.flashIndex = (state.flashIndex + 1) % state.flashDeck.length;
    state.flashFlipped = false;
    renderFlashcards();
    if (event.detail === 0) $(".flashcard", $("#flashcard-area"))?.focus({ preventScroll: true });
    return;
  }
  if (!["again", "got"].includes(action) || !state.flashFlipped) return;
  const deck = activeDeck(state.studyDecks);
  const cardId = button.dataset.cardId;
  if (!deck || state.flashDeck[state.flashIndex]?.id !== cardId) return;
  const before = state.flashDeck;
  state.studyDecks = reviewDeck(state.studyDecks, deck.id, cardId, action === "got");
  syncActiveDeck();
  const after = dueCards(state.flashcards, state.flashProgress);
  state.flashIndex = nextReviewIndex(before, cardId, after);
  state.flashFlipped = false;
  renderFlashcards();
  renderStudyNext();
  void persistStudyDecks();
  if (event.detail === 0) $(".flashcard, .deck-complete button", $("#flashcard-area"))?.focus({ preventScroll: true });
}

async function deleteActiveDeck() {
  const deck = activeDeck(state.studyDecks);
  if (!deck) return;
  const confirmed = await ui.confirmDialog({
    title: "Delete this deck?",
    message: `“${deck.title}” and its review dates will be removed from this device. Your books and quiz results stay.`,
    confirmLabel: "Delete deck",
    danger: true,
  });
  if (!confirmed) return;
  state.studyDecks = removeDeck(state.studyDecks, deck.id);
  syncActiveDeck();
  state.flashIndex = 0;
  state.flashFlipped = false;
  state.flashPracticeAll = false;
  if (!state.studyDecks.decks.length) $("#deck-create").open = true;
  renderFlashcards();
  renderStudyNext();
  if (await persistStudyDecks()) ui.showToast("Deck deleted from this device.", "success");
}

/* --------------------------------------------------------------- progress */

function renderStudyNext() {
  const step = nextStudyStep(state.studyDecks, state.results);
  const copy = $("#study-next-copy");
  const action = $("#study-next-action");
  if (!copy || !action) return;
  action.disabled = false;
  if (step.kind === "due") {
    copy.textContent = `${step.count} ${step.count === 1 ? "card is" : "cards are"} ready for a quick review.`;
    action.textContent = "Review due cards  →";
    action.onclick = () => openSavedDeck(step.deckId);
  } else if (step.kind === "mistakes") {
    copy.textContent = `${step.count} ${step.count === 1 ? "question" : "questions"} from a recent quiz could use another look.`;
    action.textContent = "Make review cards  →";
    action.onclick = async () => {
      const result = state.results.find((entry) => entry.id === step.resultId);
      if (!result) return;
      action.disabled = true;
      try { await reviewMistakes(result); } finally { action.disabled = false; }
    };
  } else {
    copy.textContent = state.results.length ? "Keep your momentum going with a short quiz." : "Start with a short quiz from your books.";
    action.textContent = "Start a quiz  →";
    action.onclick = () => setView("quiz");
  }
}

async function openSavedQuizResult(result) {
  if (state.quizSubmitting) { ui.showToast("Please wait while your quiz is graded.", "info"); return; }
  if (state.quiz && !state.result) {
    const confirmed = await ui.confirmDialog({
      title: "Leave your current quiz?",
      message: "Opening a past result will discard this unfinished quiz.",
      confirmLabel: "Open past result",
    });
    if (!confirmed) return;
  }
  clearQuizTimer();
  state.quiz = null;
  state.quizResponses = {};
  state.quizIndex = 0;
  state.result = result;
  setView("quiz");
}

function renderProgress() {
  renderStudyNext();
  const grid = $("#stat-grid");
  grid.replaceChildren();
  const streak = currentStreak(state.studyProgress);
  const cards = [
    { label: t("progress.streak"), value: `${streak} ${streak === 1 ? "day" : "days"}`, sub: streakMessage(state.studyProgress) },
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
    const score = ui.element("span", "list-row-value", `${result.percent}%`);
    const review = ui.element("button", "button ghost small recent-review", "Review");
    review.type = "button";
    review.setAttribute("aria-label", `Review result: ${result.topic || "Chapter quiz"}, ${result.percent}%`);
    review.addEventListener("click", () => openSavedQuizResult(result));
    row.append(main, score, review);
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
  if (state.quizSubmitting) { ui.showToast("Please wait while your quiz is graded.", "info"); return; }
  const confirmed = await ui.confirmDialog({
    title: "Reset study progress?",
    message: "This clears streaks, XP and saved quiz results on this device. Your books and flashcard decks stay.",
    confirmLabel: "Reset progress",
    danger: true,
  });
  if (!confirmed) return;
  state.studyProgress = resetProgress();
  await db.clearResults();
  state.results = [];
  state.result = null;
  state.quiz = null;
  state.quizContext = null;
  clearQuizTimer();
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
  syncAdvancedSettingsButton();
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
    const nickname = provider.nickname || provider.name;
    const specialty = provider.specialty || provider.free;
    link.dataset.nickname = nickname;
    link.dataset.specialty = specialty;
    link.setAttribute("aria-label", `Open ${nickname} key page in a new tab`);
    const head = ui.element("div", "key-card-head");
    head.appendChild(ui.element("strong", "", nickname));
    const badge = ui.element("span", `key-badge${provider.local ? " local" : provider.recommended ? " recommended" : ""}`,
      provider.local ? "KEYLESS" : provider.recommended ? "START HERE" : "FREE TIER");
    head.appendChild(badge);
    link.appendChild(head);
    link.appendChild(ui.element("span", "key-specialty", specialty));
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
    select.appendChild(ui.option(item.id, aiOptionLabel(item), item.id === provider.id));
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
      select.appendChild(ui.option(provider.id, aiOptionLabel(provider), state.settings.routing[task.id] === provider.id));
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
    select.appendChild(ui.option(provider.id, aiOptionLabel(provider), provider.id === state.settings.activeProvider));
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
    fallback.appendChild(ui.option(provider.id, aiOptionLabel(provider), provider.id === state.settings.fallback));
  }
  fallback.value = state.settings.fallback || "offline";
}

function renderWebChoice() {
  const enabled = Boolean(state.settings.webEnabled);
  $("#settings-web-enabled").checked = enabled;
  $("#ask-web-fallback").checked = enabled;
  const label = t(enabled ? "ask.webOn" : "ask.webOff");
  $("#web-search-state").textContent = label;
  $("#settings-web-state").textContent = label;
}

let webPreferenceWrites = Promise.resolve();
async function setWebChoice(enabled) {
  state.settings.webEnabled = enabled;
  if (enabled && state.settings.webMode === "custom" && !state.settings.searchEndpoint) {
    state.settings.webMode = "server";
    $("#settings-web-mode").value = "server";
    ui.showToast("Using the built-in search because no custom search source was set.", "info");
  }
  renderWebChoice();
  try {
    webPreferenceWrites = webPreferenceWrites.catch(() => {}).then(() => saveSettings());
    await webPreferenceWrites;
    void renderStorageSummary();
  } catch {
    ui.showToast("That web preference could not be saved; it applies only to this session.", "warning");
  }
}

function renderWebSettings() {
  renderWebChoice();
  $("#settings-web-mode").value = state.settings.webMode;
  $("#settings-web-endpoint").value = state.settings.searchEndpoint || "";
  $("#settings-web-token").value = state.settings.searchToken || "";
}

/** Build the grouped language picker from the catalogue (33 languages). */
function renderLanguageOptions() {
  const select = $("#settings-language");
  if (!select) return;
  const selected = state.settings.language;
  select.replaceChildren();
  for (const group of languageGroups()) {
    const optgroup = document.createElement("optgroup");
    optgroup.label = t(group.labelKey);
    if (!t(group.labelKey) || t(group.labelKey) === group.labelKey) optgroup.label = group.label;
    for (const language of group.languages) {
      const option = document.createElement("option");
      option.value = language.code;
      option.textContent = languageLabel(language.code);
      option.lang = language.code;
      if (language.dir === "rtl") option.dir = "rtl";
      optgroup.appendChild(option);
    }
    select.appendChild(optgroup);
  }
  select.value = selected;
  const name = languageName(state.settings.language, { native: true });
  const chip = $("#language-chip");
  if (chip) chip.textContent = name;
  const answers = $("#language-answers");
  if (answers) answers.textContent = t("settings.answersIn", { language: name });
}

async function handleLanguageChange() {
  const select = $("#settings-language");
  if (!select) return;
  state.settings.language = select.value;
  setLanguage(state.settings.language);
  await saveSettings();
  renderAll();
  renderLanguageOptions();
  ui.showToast(t("settings.answersIn", { language: languageName(state.settings.language, { native: true }) }), "success", 4000);
}

function renderAppearanceSettings() {
  renderLanguageOptions();
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
  const enabled = $("#settings-web-enabled").checked;
  const mode = $("#settings-web-mode").value;
  const endpoint = $("#settings-web-endpoint").value.trim();
  if (enabled && mode === "custom" && !endpoint) {
    ui.showToast("Add a custom JSON search endpoint first.", "warning");
    return;
  }
  state.settings.webEnabled = enabled;
  state.settings.webMode = mode;
  state.settings.searchEndpoint = endpoint;
  state.settings.searchToken = $("#settings-web-token").value.trim();
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
  try {
    await deckWriteQueue.catch(() => {});
    const data = await db.exportData();
    // Include the current in-memory decks even if a recent disk write failed.
    data.settings = data.settings.filter((entry) => entry.key !== STUDY_DECKS_KEY);
    data.settings.push({ key: STUDY_DECKS_KEY, value: state.studyDecks });
    data.localProgress = state.studyProgress;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    downloadBlob(blob, `vignan-vidyanikethan-ai-export-${new Date().toISOString().slice(0, 10)}.json`);
    ui.showToast("Study data exported. Textbook pages and PDF files are not included.", "success", 6000);
  } catch (error) {
    console.error("Could not export study data", error);
    ui.showToast("Could not export your study data on this device.", "error");
  }
}

async function deleteAllData() {
  if (state.quizSubmitting) { ui.showToast("Please wait while your quiz is graded.", "info"); return; }
  const confirmed = await ui.confirmDialog({
    title: "Delete all local data?",
    message: "Books, chats, flashcard decks, quiz results, settings and cached passages will be removed from this device. This cannot be undone.",
    confirmLabel: t("settings.deleteAll"),
    danger: true,
  });
  if (!confirmed) return;
  await deckWriteQueue.catch(() => {});
  await webPreferenceWrites.catch(() => {});
  await db.clearAllData();
  state.studyProgress = resetProgress();
  writeFlashProgress({});
  state.settings = normalizeSettings(DEFAULT_SETTINGS);
  await db.setSetting("settings", state.settings);
  state.messages = [];
  state.results = [];
  state.linkContext = null;
  state.paper = null;
  state.paperSelection.clear();
  $("#paper-preview").hidden = true;
  $("#paper-questions").replaceChildren();
  $("#paper-preview-title").textContent = "Practice model paper";
  $("#paper-analysis").textContent = "";
  $("#paper-status").textContent = "";
  $("#paper-topic").value = "";
  state.quiz = null;
  state.result = null;
  state.quizResponses = {};
  state.quizContext = null;
  state.studyDecks = emptyDeckCollection();
  state.deckStorageError = false;
  state.flashcards = [];
  state.flashProgress = {};
  state.flashPracticeAll = false;
  $("#deck-create").open = true;
  state.lastAnswer = {};
  clearQuizTimer();
  await reloadIndexes();
  addWelcomeMessage();
  setLanguage(state.settings.language);
  setTheme(state.settings.theme, { save: false });
  renderAll();
  ui.showToast("All local data deleted. Your library is empty.", "success");
}

/* ----------------------------------------------------------------- events */

function syncAdvancedSettingsButton() {
  const button = $("#toggle-advanced-settings");
  if (!button) return;
  const shown = Boolean($("#view-settings")?.classList.contains("show-advanced"));
  button.textContent = shown ? t("settings.hideAdvanced") : t("settings.advanced");
  button.setAttribute("aria-expanded", String(shown));
}

function toggleAdvancedSettings() {
  $("#view-settings")?.classList.toggle("show-advanced");
  syncAdvancedSettingsButton();
}

function openSettingsPanel(id) {
  const target = document.getElementById(id);
  if (target && ($("#advanced-settings")?.contains(target) || $("#view-settings .settings-grid")?.contains(target) || target.id === "advanced-settings")) {
    $("#view-settings")?.classList.add("show-advanced");
  }
  setView("settings");
  syncAdvancedSettingsButton();
  requestAnimationFrame(() => {
    const reduced = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    target?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  });
}

function currentAIId() {
  return state.settings.routing.answer || "offline";
}

async function setActiveAI(providerId) {
  const id = providerId === "offline" ? "offline" : PROVIDERS[providerId] ? providerId : "server";
  for (const task of TASKS) state.settings.routing[task.id] = id === "offline" ? "offline" : id;
  state.settings.activeProvider = id === "offline" ? "server" : id;
  state.settings.fallback = "offline";
  state.settings.disclaimerSeen = true;
  state.settings.freeRouterDismissed = true;
  await saveSettings();
  renderSettings();
  updateStatus();
  const profile = aiProfile(id);
  ui.showToast(`${profile.nickname} selected — ${profile.specialty}.`, "success", 4500);
}

async function handlePremiumAction(action) {
  switch (action) {
    case "menu":
      openCommandMenu();
      return;
    case "upload-pdf":
      setView("library");
      // Open while the click's user gesture is active (important on phones).
      $("#file-input")?.click();
      return;
    case "instant-ai":
      await setActiveAI("offline");
      setView("ask");
      requestAnimationFrame(() => $("#ask-input")?.focus({ preventScroll: true }));
      return;
    case "deep-ai":
      await setActiveAI("webllm");
      openSettingsPanel("local-ai-panel");
      return;
    case "quiz":
      await prepareQuizFromText();
      return;
    case "flashcards":
      setView("flashcards");
      $("#deck-create").open = true;
      requestAnimationFrame(() => $("#flash-topic")?.focus({ preventScroll: true }));
      return;
    case "sources":
      setView("ask");
      toggleSources();
      return;
    case "advanced":
      openSettingsPanel("advanced-settings");
      return;
    case "keys":
      openSettingsPanel("student-key-card");
      return;
    case "theme":
      setTheme(state.settings.theme === "dark" ? "light" : "dark");
      return;
    case "export":
      $("#export-data")?.click();
      return;
    case "account":
      if (state.account) openAccountModal("account");
      else window.dispatchEvent(new CustomEvent("vignan:auth-required", { detail: { mode: "login" } }));
      return;
    default:
      if (VIEW_META[action]) setView(action);
      else if (action === "close-menu") closeCommandMenu();
  }
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
  $("#profile-button").addEventListener("click", () => {
    if (state.account) openAccountModal("account");
    else window.dispatchEvent(new CustomEvent("vignan:auth-required", { detail: { mode: "login" } }));
  });
  window.addEventListener("online", updateOfflineChip);
  window.addEventListener("offline", updateOfflineChip);

  $("#ask-form").addEventListener("submit", handleAsk);
  $("#ask-web-fallback").addEventListener("change", (event) => void setWebChoice(event.target.checked));
  $("#settings-web-enabled").addEventListener("change", (event) => void setWebChoice(event.target.checked));
  $("#ask-input").addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      $("#ask-form").requestSubmit();
    }
  });
  $("#mode-row").addEventListener("click", (event) => {
    const chip = event.target.closest(".mode-chip");
    if (chip) {
      setMode(chip.dataset.mode);
      const disclosure = chip.closest("details");
      if (disclosure) disclosure.open = false;
    }
  });
  $("#clear-chat").addEventListener("click", clearChat);
  $("#use-local-ai-button")?.addEventListener("click", () => openSettingsPanel("local-ai-panel"));
  $("#sidebar-local-ai")?.addEventListener("click", () => openSettingsPanel("local-ai-panel"));
  $("#open-student-keys")?.addEventListener("click", () => openSettingsPanel("student-key-card"));
  $("#toggle-advanced-settings")?.addEventListener("click", toggleAdvancedSettings);
  $("#use-free-ai-button")?.addEventListener("click", async () => {
    if (!state.serverHealth.ai) {
      ui.showToast(
        "No Render AI keys are configured yet. Add your own key in Settings → Advanced settings → Your own API keys, then reload.",
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
  $("#connect-model-button")?.addEventListener("click", () => {
    openSettingsPanel("student-key-card");
    requestAnimationFrame(() => $("#student-provider-keys")?.focus({ preventScroll: true }));
  });

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
  $("#library-url-submit").addEventListener("click", handleLinkImport);
  $("#library-url").addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); void handleLinkImport(); }
  });
  $("#paste-submit").addEventListener("click", handlePaste);
  $("#book-list").addEventListener("click", handleBookAction);
  $("#paper-generate").addEventListener("click", () => generateModelPaper());
  $("#paper-download").addEventListener("click", () => {
    if (state.paper) downloadBlob(new Blob([modelPaperText(state.paper)], { type: "text/plain;charset=utf-8" }), "vignan-practice-paper.txt");
  });
  $("#paper-print").addEventListener("click", () => {
    if (!state.paper) return;
    document.body.classList.add("paper-printing");
    try { window.print(); } finally { document.body.classList.remove("paper-printing"); }
  });

  $("#quiz-generate").addEventListener("click", generateQuizHandler);
  $("#quiz-use-model").addEventListener("change", renderQuizEngineNote);
  $("#quiz-topic").addEventListener("input", renderQuizEngineNote);
  $("#quiz-book-scope").addEventListener("change", renderQuizEngineNote);
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
  $("#flash-deck-select").addEventListener("change", (event) => {
    state.studyDecks = selectDeck(state.studyDecks, event.target.value);
    syncActiveDeck();
    state.flashIndex = 0;
    state.flashFlipped = false;
    state.flashPracticeAll = false;
    renderFlashcards();
    void persistStudyDecks();
  });
  $("#flash-deck-delete").addEventListener("click", deleteActiveDeck);
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
  $("#settings-language").addEventListener("change", handleLanguageChange);
  $("#export-data").addEventListener("click", exportData);
  $("#clear-chat-data").addEventListener("click", async () => {
    await clearChat();
    renderStorageSummary();
  });
  $("#delete-all").addEventListener("click", deleteAllData);
}

let initPromise;
export function initApp(options = {}) {
  if (!initPromise) {
    initPromise = init(options).catch((error) => {
      initPromise = null;
      throw error;
    });
  }
  return initPromise;
}

// Boot module controls startup on the live site. Direct loads still work.
if (!globalThis.__VIGNAN_BOOT__) initApp();
