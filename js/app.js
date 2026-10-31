/**
 * Vignan Vidyanikethan AI — application controller.
 *
 * Architecture: local textbook index -> evidence retrieval -> task-based model
 * router (existing AI providers) -> citation UI. The offline extractive engine
 * is the guaranteed fallback. No model is trained in this repository.
 */

import * as db from "./db.js?v=39";
import { buildBookIndex, retrieveChapter, retrievePreferBooks } from "./retrieval.js?v=39";
import { ingestPdf, ingestText } from "./ingest.js?v=39";
import { splitSentences } from "./text.js?v=39";
import { checkFileName, inspectFile, MAX_PDF_BYTES, MAX_TEXT_BYTES } from "./files.js?v=39";
import { downloadPublicLink, firstLink, hasLinkCredentials, readPublicLink } from "./link-reader.js?v=39";
import { asksAboutCreator, casualReply, consecutiveCasualTurns, contextualQuery, conversationReply, creatorAnswer, isFollowUp, safetyReply, searchTopic } from "./conversation.js?v=39";
import { lastCitedStudyContext, parseChatIntent, requestedChatMode } from "./chat-intents.js?v=39";
import { buildModelPaper, modelPaperText } from "./model-paper.js?v=39";
import { composeLinkAnswer, composeOutsideAnswer, composeWebAnswer } from "./external-answer.js?v=39";
import { asksForStudySheet, buildStudySheet, studySheetMarkdown, studySheetTopic } from "./study-sheet.js?v=39";
import { buildRevisionPlan, revisionPlanText } from "./revision-plan.js?v=39";
import {
  PRO_META, PRO_NAME, PRO_TYPING, matchesActivation, matchesPowerDown, matchesStatusQuery, splitActivation,
  proBootLines, proBriefing, proGreeting, proStatusReport,
} from "./pro-mode.js?v=39";
import { playProActivation, setProChrome } from "./pro-ui.js?v=39";
import {
  RELEASE, applyUpdate, checkForUpdate, startUpdateWatch, updateBannerText, updateStatusLabel,
} from "./updates.js?v=39";
import { CRITICAL_FILES, runOfflineCheck } from "./offline-check.js?v=39";
import { DEFAULT_DEPTH, citationAudit, citationSummary, citationWarning, followUpsFor, looksUncited, matchedTerms, normalizeDepth, ungroundedNumbers } from "./answer-quality.js?v=39";
import { avatarInitials, decorateAvatar, renderAvatarSwatches } from "./avatars.js?v=39";
import { knowledgeFactAnswer, knowledgeTopicAnswer } from "./knowledge.js?v=39";
import { composeGroundedAnswer, confidenceLabel, sourcesFromHits } from "./answer.js?v=39";
import {
  answerOutsideWithModel,
  answerWithModel,
  generateFlashcardsWithModel,
  generateQuizWithModel,
  gradeShortWithModel,
  testModel,
} from "./llm.js?v=39";
import { FREE_API_PROVIDERS, FREE_API_WARNING } from "./free-apis.js?v=39";
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
} from "./local-ai.js?v=39";
import {
  EXAMS,
  MODES,
  OFFICIAL,
  blueprint,
  examAdvice,
  examByIdOrFirst,
  getExam,
  paceLabel,
  paceSeconds,
  pacingLine,
  scoreExam,
  syllabusCoverage,
  nextUp,
} from "./exam-packs.js?v=39";
import { isStarterBookId, shelfBooks, shelfMarkdown, shelfSummary } from "./starter-shelf.js?v=39";
import { availableVoices, insideFrame, listenMessage, listenOnce, microphoneProblem, speakText, speechLanguage, stopSpeaking, voiceSupport } from "./voice.js?v=39";
import { examinerLine, probeFor, vivaQuestionsFromSentences, vivaReport } from "./viva.js?v=39";
import { TASKS } from "./model-router.js?v=39";
import { PROVIDERS, providerList } from "./providers.js?v=39";
import {
  DEFAULT_SETTINGS,
  engineLabel,
  isModelConnected,
  normalizeSettings,
  privacyLabel,
  providerConfig,
  serverHealth,
} from "./settings.js?v=39";
import { parseApiKeys } from "./key-pool.js?v=39";
import {
  STUDENT_KEY_PROVIDERS,
  cleanStudentEndpoint,
  cleanStudentKeyVault,
  studentKeySummary,
} from "./student-keys.js?v=39";
import {
  generateQuiz,
  gradeQuiz,
  makeQuiz,
  recomputeResult,
} from "./quiz.js?v=39";
import {
  buildFlashcards,
  deckStats,
  dueCards,
  writeProgress as writeFlashProgress,
} from "./flashcards.js?v=39";
import {
  STUDY_DECKS_KEY, activeDeck, addDeck, cardsFromMistakes, emptyDeckCollection, makeStudyDeck,
  nextReviewIndex, nextStudyStep, normalizeDeckCollection, removeDeck, reviewDeck, selectDeck,
} from "./study-decks.js?v=39";
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
} from "./progress.js?v=39";
import { externalSearchUrl, searchWeb } from "./web.js?v=39";
import { openEditStudio } from "./edit-studio.js?v=39";
import { openReader } from "./reader.js?v=39";
import { applyTranslations, languageName, setLanguage, t } from "./i18n.js?v=39";
import { LANGUAGE_CATALOGUE, languageGlyphFor, languageLabel, languageGroups, languageMeta, matchesLanguageQuery } from "./languages.js?v=39";
import { DEFAULT_STYLE, THEMES, isKnownStyle, normalizeStyle, resolveStyle, switchLockedReason, themeById, themeSupportsSwitch } from "./themes.js?v=39";
import { askFromUrl, cardIndex, goalCards } from "./goal-cards.js?v=39";
import { clamp, downloadBlob, formatDate, localDay, truncate, uid } from "./util.js?v=39";
import * as ui from "./ui.js?v=39";
import {
  clearReferral,
  getLeaderboard,
  getSession,
  inviteLink,
  logout,
  openAuthModal,
  readReferral,
  syncProgress,
} from "./auth.js?v=39";
import { aiOptionLabel, aiProfile } from "./ai-nicknames.js?v=39";
import {
  closeCommandMenu,
  initPremiumUI,
  openCommandMenu,
  setPremiumAI,
  setPremiumView,
  toggleSources,
} from "./premium-ui.js?v=39";
import { initMotion, revealVisible } from "./motion.js?v=39";
import { focusFriendsTab, initFriendsUI, renderFriends as renderSocialFriends, updateSocialBadges } from "./friends-ui.js?v=39";
import { initChatUI as initSocialChatUI, renderChat as renderSocialChat } from "./chat-ui.js?v=39";
import { initPlayUI as initSocialPlayUI, renderPlay as renderSocialPlay } from "./play-ui.js?v=39";
import { resetSocial, socialState, startSocialPolling, stopSocialPolling, syncSocial } from "./social.js?v=39";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const VIEW_META = {
  ask: { kicker: "view.ask.kicker", title: "view.ask.title", subtitle: "view.ask.subtitle" },
  library: { kicker: "view.library.kicker", title: "view.library.title", subtitle: "view.library.subtitle" },
  quiz: { kicker: "view.quiz.kicker", title: "view.quiz.title", subtitle: "view.quiz.subtitle" },
  exam: { kicker: "view.exam.kicker", title: "view.exam.title", subtitle: "view.exam.subtitle" },
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
  { label: "Key terms sheet", prompt: "Make a study sheet of the key terms and formulas in this chapter", mode: "answer" },
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
  updateStatus: { status: "unsupported", remote: "" },
  lastUpdateCheck: "",
  selectedFile: null,
  askBusy: false,
  linkContext: null,
  paper: null,
  paperSelection: new Map(),
  quiz: null,
  exam: { examId: "jee-main", mode: "mock", count: 10, chapter: "", subjectId: "" },
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
    // The mirror is what the first frame already painted, so it is the truth
    // for this device; the database copy is the backup. Boot must not claim
    // either as a fresh choice, or the school default could never apply.
    let mirroredStyle = "";
    try { mirroredStyle = localStorage.getItem(STYLE_MIRROR_KEY) || ""; } catch { /* private mode */ }
    applyStyle(isKnownStyle(mirroredStyle) ? mirroredStyle : state.settings.style, { save: false, remember: false });
    setProChrome(Boolean(state.settings.pro));
    state.updateStatus = { status: "unsupported", remote: "" };
    state.lastUpdateCheck = "";
    await reloadIndexes();
    await ensureStarterShelf();
    if (!state.messages.length) addWelcomeMessage();
    bindEvents();
    applyLinkedQuestion();
    maybeStartFirstRun();
    subscribeLocalAI((snapshot) => {
      state.localAI = snapshot;
      renderLocalAIStatus(snapshot);
    });
    state.referral = readReferral();
    state.serverHealth = await healthPromise;
    applySchoolDefaultStyle();
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

let swRegistration = null;

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  try {
    const script = new URL("../sw.js", import.meta.url);
    const scope = new URL("../", import.meta.url).pathname;
    navigator.serviceWorker
      .register(script, { scope })
      .then((registration) => {
        swRegistration = registration;
        watchForUpdates(registration);
      })
      .catch(() => {});
  } catch {
    // Service workers are optional; the app still works from a static host.
  }
}

/** Show the update banner; never swap a release under a student mid-lesson. */
function showUpdateBanner({ remote = "" } = {}) {
  const banner = $("#update-banner");
  if (!banner) return;
  const detail = $("#update-detail");
  if (detail) detail.textContent = updateBannerText({ current: RELEASE, remote });
  banner.hidden = false;
  document.body.classList.add("has-update");
}

function hideUpdateBanner() {
  const banner = $("#update-banner");
  if (banner) banner.hidden = true;
  document.body.classList.remove("has-update");
}

function watchForUpdates(registration) {
  startUpdateWatch(registration, {
    onAvailable: ({ remote }) => showUpdateBanner({ remote }),
    onStatus: (result) => {
      state.updateStatus = result;
      renderAppVersion();
    },
  });
  updateLastCheckLabel("Checked on load");
}

function renderAppVersion() {
  const version = $("#app-version");
  if (version) version.textContent = `Release ${RELEASE}`;
  const offline = $("#app-offline-state");
  if (offline && !offline.dataset.checked) offline.textContent = state.settings ? "Checking…" : "—";
  const last = $("#app-last-check");
  if (last && state.lastUpdateCheck) last.textContent = state.lastUpdateCheck;
}

function updateLastCheckLabel(text) {
  state.lastUpdateCheck = text;
  const node = $("#app-last-check");
  if (node) node.textContent = text;
}

/** The "Check offline readiness" button: counts what the worker really stored. */
async function checkOfflineReadiness({ announce = true } = {}) {
  const node = $("#app-offline-state");
  const report = await runOfflineCheck({ version: RELEASE, critical: CRITICAL_FILES });
  if (node) {
    node.dataset.checked = "1";
    node.textContent = report.ready
      ? `Ready · ${report.cached}/${report.total || "?"} files`
      : report.installed
        ? `Incomplete · ${report.cached}/${report.total} files`
        : "Not installed yet";
    node.dataset.state = report.ready ? "ready" : report.installed ? "partial" : "none";
  }
  if (announce) {
    ui.showToast(report.summary, report.ready ? "success" : "warning", 6000);
    const result = $("#update-result");
    if (result) {
      result.textContent = report.ready
        ? `${report.summary} Answers, study sheets, revision and quizzes work with the network off.`
        : `${report.summary} Open the app once while online so the worker can store the release.`;
    }
  }
  return report;
}

async function runUpdateCheck({ userInitiated = false } = {}) {
  const result = $("#update-result");
  if (navigator.onLine === false) {
    if (userInitiated) ui.showToast(updateStatusLabel("offline"), "warning", 5000);
    if (result) result.textContent = updateStatusLabel("offline");
    return;
  }
  if (result) result.textContent = "Checking…";
  const outcome = swRegistration
    ? await checkForUpdate(swRegistration)
    : { status: "unsupported", remote: "" };
  updateLastCheckLabel(new Date().toLocaleTimeString());
  if (outcome.status === "available") {
    showUpdateBanner({ remote: outcome.remote });
    if (result) result.textContent = updateStatusLabel("available");
    if (userInitiated) ui.showToast("A new version is ready — use Update now.", "info", 5000);
    return;
  }
  if (result) result.textContent = updateStatusLabel(outcome.status);
  if (userInitiated) ui.showToast(updateStatusLabel(outcome.status), outcome.status === "current" ? "success" : "warning", 4500);
}

async function takeUpdate() {
  if (!swRegistration) {
    location.reload();
    return;
  }
  ui.showToast("Updating — the page will reload.", "info", 3000);
  await applyUpdate(swRegistration);
}

/* ------------------------------------------------------------- navigation */

function setView(view, { skipHistory = false } = {}) {
  if (!VIEW_META[view]) view = "ask";
  if (view === "settings") {
    renderAppVersion();
    void checkOfflineReadiness({ announce: false });
    void runUpdateCheck();
  }
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
  if (view === "exam") renderExamView();
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
  $$(".mode-chip[data-mode]").forEach((chip) => chip.classList.toggle("active", chip.dataset.mode === mode));
}

/** Answer length: brief, balanced or a model exam answer. */
async function setAnswerDepth(depth) {
  state.settings.answerDepth = normalizeDepth(depth || DEFAULT_DEPTH);
  $$(".mode-chip[data-depth]").forEach((chip) => chip.classList.toggle("active", chip.dataset.depth === state.settings.answerDepth));
  await saveSettings();
  const chosen = state.settings.answerDepth;
  ui.showToast(chosen === "exam" ? "Answers will come as model exam answers." : chosen === "brief" ? "Answers will stay brief." : "Answers will be balanced.", "info", 2200);
}

const THEME_MIRROR_KEY = "vignan.theme";

function setTheme(theme, { save = true } = {}) {
  if (!themeSupportsSwitch(state.settings.style)) {
    // Three things can call this — the header button, Settings, and a command.
    // Refusing here means none of them can flip a palette that has no twin.
    ui.showToast(switchLockedReason(state.settings.style), "info", 3200);
    syncThemeSwitchLock();
    return;
  }
  document.documentElement.dataset.theme = theme === "dark" ? "dark" : "light";
  state.settings.theme = theme === "dark" ? "dark" : "light";
  const use = $("#theme-toggle use");
  if (use) use.setAttribute("href", theme === "dark" ? "#i-sun" : "#i-moon");
  // The styles mirror to localStorage for the first frame; the theme did not,
  // so a student who chose dark saw a white flash on every load. Same reason,
  // same fix, and only for a value this app wrote itself.
  try { localStorage.setItem(THEME_MIRROR_KEY, theme === "dark" ? "dark" : "light"); } catch { /* private mode */ }
  if (save) saveSettings();
}

/**
 * Apply one of the six looks.
 *
 * The stylesheet reads `data-style` on <html>; "minimal" is the absence of the
 * attribute so the original look is byte-for-byte what it was. The choice is
 * mirrored into localStorage synchronously so the next page load can paint the
 * right colours before the first frame instead of flashing the default.
 */
const STYLE_MIRROR_KEY = "vignan.style";
const SCHOOL_STYLE_KEY = "vignan.style.school";

/**
 * Grey out any control that cannot do anything in the current style, and say
 * why in one line. A disabled button with no explanation is a bug from the
 * student's point of view, so the reason travels with it.
 */
function syncThemeSwitchLock() {
  const style = normalizeStyle(state.settings.style);
  const locked = !themeSupportsSwitch(style);
  const reason = switchLockedReason(style);
  const toggle = $("#theme-toggle");
  if (toggle) {
    toggle.disabled = locked;
    toggle.setAttribute("aria-disabled", locked ? "true" : "false");
    toggle.title = locked ? reason : "Toggle theme";
    toggle.setAttribute("aria-label", locked ? `Light/dark is fixed in this style. ${reason}` : "Toggle theme");
  }
  const select = $("#settings-theme");
  if (select) select.disabled = locked;
  const invert = document.querySelector('[data-premium-action="theme"]');
  if (invert) {
    invert.disabled = locked;
    invert.title = locked ? reason : "";
  }
  const note = $("#theme-locked-note");
  if (note) {
    note.textContent = locked ? reason : "";
    note.hidden = !locked;
  }
}

/**
 * The school's default style, for a device that has never chosen one.
 *
 * Only a device with no saved choice is touched, and the school's value is kept
 * in its own key so a later change by the school still reaches that device.
 */
function applySchoolDefaultStyle() {
  let chosen = "";
  try { chosen = localStorage.getItem(STYLE_MIRROR_KEY) || ""; } catch { /* private mode */ }
  if (isKnownStyle(chosen)) return;
  const school = resolveStyle({ schoolDefault: state.serverHealth?.defaultStyle });
  try { localStorage.setItem(SCHOOL_STYLE_KEY, school); } catch { /* private mode */ }
  if (school !== normalizeStyle(state.settings.style)) applyStyle(school, { save: false, remember: false });
}

function applyStyle(id, { save = true, remember = true } = {}) {
  const style = normalizeStyle(id);
  state.settings.style = style;
  const root = document.documentElement;
  if (style === DEFAULT_STYLE) root.removeAttribute("data-style");
  else root.dataset.style = style;
  if (remember) {
    try { localStorage.setItem(STYLE_MIRROR_KEY, style); } catch { /* private mode */ }
  }
  const chip = $("#style-chip");
  if (chip) chip.textContent = themeById(style).name;
  syncThemeSwitchLock();
  if (save) void saveSettings();
}

/** Six tiles, each showing its own three colours before you commit to it. */
function renderStyleTiles() {
  const host = $("#style-grid");
  if (!host) return;
  const active = normalizeStyle(state.settings.style);
  host.replaceChildren();
  for (const theme of THEMES) {
    const tile = ui.element("button", `style-tile${theme.id === active ? " active" : ""}`);
    tile.type = "button";
    tile.dataset.style = theme.id;
    tile.setAttribute("aria-pressed", theme.id === active ? "true" : "false");
    tile.setAttribute("aria-label", `${theme.name}. ${theme.note}`);
    const preview = ui.element("span", "style-preview");
    preview.setAttribute("aria-hidden", "true");
    for (const colour of theme.swatches) {
      const swatch = ui.element("span", "");
      swatch.style.background = colour;
      preview.appendChild(swatch);
    }
    const name = ui.element("span", "style-name", theme.name);
    const note = ui.element("span", "style-note", theme.note);
    const tags = ui.element("span", "style-tags");
    for (const tag of theme.tags) tags.appendChild(ui.element("span", "style-tag", tag));
    tile.append(preview, name, note, tags);
    tile.addEventListener("click", () => {
      applyStyle(theme.id);
      renderStyleTiles();
      ui.showToast(`${theme.name} applied.`, "success", 2600);
    });
    host.appendChild(tile);
  }
}

/**
 * Settings tabs.
 *
 * The page had grown into a long scroll of twelve cards. The cards are tagged with
 * `data-settings-group` in the markup, so the tabs only decide what is visible —
 * nothing moves, nothing is rebuilt, and a card that forgets its tag stays on
 * screen in every tab rather than disappearing.
 */
const SETTINGS_TABS = ["appearance", "ai", "privacy"];

function setSettingsTab(tab = "appearance") {
  const chosen = SETTINGS_TABS.includes(tab) ? tab : "appearance";
  state.settingsTab = chosen;
  $$("#view-settings [data-settings-group]").forEach((node) => {
    const group = node.dataset.settingsGroup;
    node.classList.toggle("settings-hidden", Boolean(group) && group !== chosen);
  });
  $$("#settings-tabs .settings-tab").forEach((button) => {
    const selected = button.dataset.settingsTab === chosen;
    button.setAttribute("aria-selected", selected ? "true" : "false");
    button.tabIndex = selected ? 0 : -1;
  });
}

function wireSettingsTabs() {
  const tabs = $("#settings-tabs");
  if (!tabs) return;
  $$("#settings-tabs .settings-tab").forEach((button) => {
    button.addEventListener("click", () => setSettingsTab(button.dataset.settingsTab));
  });
  // Arrow keys move between tabs, as a tablist should.
  tabs.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const list = $$("#settings-tabs .settings-tab");
    const index = Math.max(0, list.findIndex((button) => button.dataset.settingsTab === state.settingsTab));
    const next = event.key === "Home" ? 0
      : event.key === "End" ? list.length - 1
        : event.key === "ArrowRight" ? (index + 1) % list.length
          : (index - 1 + list.length) % list.length;
    event.preventDefault();
    setSettingsTab(list[next].dataset.settingsTab);
    list[next].focus();
  });
  setSettingsTab(state.settingsTab || "appearance");
}

/**
 * The three-step first-run tour.
 *
 * It appears once per device, in the corner, and never blocks the app: there is no
 * overlay behind it, so a student can ignore it and start typing. Finishing or
 * skipping writes a flag so nobody sees it twice.
 */
const FIRST_RUN_KEY = "vignan.firstRun.v2";
const FIRST_RUN_STEPS = [
  {
    title: "Your books, your pages",
    body: "Add a PDF or your notes in Library — or use the starter pages written for this project. Every answer names the page it came from.",
  },
  {
    title: "Start from a sentence",
    body: "The Ask screen opens with five blocks: explain a concept, quiz me, my viva is coming up, revise, exam answer. Tap one and it is asked straight away.",
  },
  {
    title: "Make it yours",
    body: "Settings → Look & language has six styles — Minimal, Soft, Editorial, Luxury, Terminal and Neo-brutalism — plus 33 languages.",
  },
];

function firstRunStep(index) {
  const tour = $("#first-run");
  if (!tour) return;
  const step = FIRST_RUN_STEPS[index];
  if (!step) {
    endFirstRun();
    return;
  }
  tour.dataset.step = String(index + 1);
  $("#first-run-step").textContent = `STEP ${index + 1} OF ${FIRST_RUN_STEPS.length}`;
  $("#first-run-title").textContent = step.title;
  $("#first-run-body").textContent = step.body;
  $("#first-run-next").textContent = index === FIRST_RUN_STEPS.length - 1 ? "Start studying" : "Next";
  tour.hidden = false;
}

function endFirstRun() {
  const tour = $("#first-run");
  if (tour) tour.hidden = true;
  try { localStorage.setItem(FIRST_RUN_KEY, "done"); } catch { /* private mode */ }
}

function maybeStartFirstRun() {
  const tour = $("#first-run");
  if (!tour) return;
  try {
    if (localStorage.getItem(FIRST_RUN_KEY)) return;
  } catch {
    return;
  }
  firstRunStep(0);
  $("#first-run-skip")?.addEventListener("click", endFirstRun);
  $("#first-run-next")?.addEventListener("click", () => {
    firstRunStep(Number(tour.dataset.step || 1));
  });
}

function updateOfflineChip() {
  const chip = $("#offline-chip");
  const online = navigator.onLine !== false;
  chip.classList.toggle("offline", !online);
  const label = $("span[data-i18n]", chip);
  if (label) label.textContent = online ? t("app.online") : t("app.offline");
}

/** The avatar pinned on the student account, if Friends has loaded it. */
function socialSeed() {
  const seed = String(socialState()?.data?.self?.avatarSeed || globalThis.__vignanSocialSeed || "");
  return /^p[0-7]$/.test(seed) ? seed : "";
}

function updateStatus() {
  $("#engine-label").textContent = engineLabel(state.settings);
  const displayName = state.account?.username || state.settings.profile || "Student";
  const seed = socialSeed() || state.settings.avatar || "";
  const initial = $("#profile-initial");
  if (initial) {
    initial.textContent = avatarInitials(displayName);
    decorateAvatar(initial, { name: displayName, seed });
  }
  const chip = $("#profile-button");
  if (chip) chip.dataset.avatar = initial?.dataset.avatar || "";
  const preview = $("#settings-avatar-preview");
  if (preview) decorateAvatar(preview, { name: displayName, seed });
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
  // The banner moved to Settings; the guard keeps older caches from throwing.
  $("#connect-banner")?.classList.toggle("hidden", connected || state.settings.disclaimerSeen);
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
  $$(".mode-chip[data-depth]").forEach((chip) =>
    chip.classList.toggle("active", chip.dataset.depth === normalizeDepth(state.settings.answerDepth)));
  $$(".mode-chip[data-mode]").forEach((chip) => chip.classList.toggle("active", chip.dataset.mode === state.mode));
  const meta = VIEW_META[state.currentView];
  if (meta) {
    $("#view-kicker").textContent = t(meta.kicker);
    $("#view-title").textContent = t(meta.title);
    $("#view-subtitle").textContent = t(meta.subtitle);
  }
  renderSuggestions();
  renderGoalCards();
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
    studySheet: message.studySheet && !message.studySheet.empty ? message.studySheet : null,
    suggest: message.suggest || null,
    citationAudit: message.citationAudit || null,
    query: String(message.query || ""),
  };
  state.messages.push(full);
  if (persist) db.addMessage(full).catch(() => {});
  renderChat();
  return full;
}

function addWelcomeMessage() {
  const starter = state.books.some((book) => isStarterBookId(book.id));
  addMessage({
    role: "assistant",
    content: starter
      ? "**Welcome.** Starter pages written for this project are already in your library, so you can ask a question and get a cited answer straight away. Add your own books whenever you like; they are searched first."
      : "**Welcome.** Add study material you have permission to use in Library, then ask a question for cited answers. When books have no match, web search can look on Wikipedia.",
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
  const lastAnswer = [...state.messages].reverse().find((message) => message.role === "assistant");
  const asked = state.messages.some((message) => message.role === "user");
  const suggestions = asked && lastAnswer?.sources?.length
    ? followUpsFor({
        query: [...state.messages].reverse().find((message) => message.role === "user")?.content || "",
        hits: lastAnswer.sources,
        hasSheet: Boolean(lastAnswer.studySheet),
        depth: state.settings.answerDepth,
      })
    : SUGGESTIONS;
  container.classList.toggle("hidden", asked && !suggestions.length);
  container.replaceChildren();
  const heading = ui.element("span", "suggestion-label", asked ? "Next" : "Try");
  container.appendChild(heading);
  for (const suggestion of suggestions) {
    const button = ui.element("button", "suggestion-chip", suggestion.label);
    button.type = "button";
    button.addEventListener("click", () => {
      if (suggestion.view === "quiz") {
        void prepareQuizFromText(suggestion.prompt);
        return;
      }
      if (suggestion.action === "quiz") {
        const sources = lastAnswer?.sources || [];
        const question = [...state.messages].reverse().find((message) => message.role === "user")?.content || "";
        const ids = [...new Set(sources.map((source) => source.bookId).filter(Boolean))];
        void prepareQuizFromText(question, ids.length === 1 ? ids[0] : "", sources);
        return;
      }
      if (suggestion.depth) void setAnswerDepth(suggestion.depth);
      $("#ask-input").value = suggestion.prompt;
      setMode(suggestion.mode);
      $("#ask-form").requestSubmit();
    });
    container.appendChild(button);
  }
}

/**
 * Starting sentences above the composer.
 *
 * They disappear the moment there is a conversation, because at that point the
 * student already knows what they came for. With an empty library the notes say
 * where the pages will come from instead of pretending everything is ready.
 */
function renderGoalCards() {
  const host = $("#goal-stack");
  if (!host) return;
  const hasBooks = state.indexes.length > 0;
  const cards = goalCards({ hasBooks, starterReady: true });
  host.replaceChildren();
  cards.forEach((card, index) => {
    const button = ui.element("button", `goal-card${card.empty ? " goal-card-empty" : ""}`);
    button.type = "button";
    button.dataset.goal = card.id;
    button.dataset.num = cardIndex(index, cards.length);
    button.setAttribute("aria-label", `${card.title}. ${card.note}`);

    const head = ui.element("span", "goal-top");
    head.appendChild(ui.element("span", "goal-index", cardIndex(index, cards.length)));
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("class", "goal-icon");
    icon.setAttribute("aria-hidden", "true");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", `#${card.icon}`);
    icon.appendChild(use);
    head.appendChild(icon);

    const copy = ui.element("span", "goal-copy");
    copy.appendChild(ui.element("strong", "", card.title));
    copy.appendChild(ui.element("small", "", card.note));

    button.append(head, copy, ui.element("span", "goal-arrow", "↗"));
    button.addEventListener("click", () => openGoal(card, button));
    host.appendChild(button);
  });
}

/**
 * A block either opens an existing tool or asks its question immediately.
 *
 * The question is complete before it is tapped — that is why each one ends by
 * asking for a page — so nothing is left half-written in the composer. The brief
 * colour change is the only confirmation the student gets that the tap landed,
 * so it must not depend on the answer arriving.
 */
function openGoal(card, element) {
  if (element && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    element.classList.add("goal-card-launching");
    setTimeout(() => element.classList.remove("goal-card-launching"), 620);
  }
  if (card.action === "quiz") {
    setView("quiz");
    $("#quiz-topic")?.focus({ preventScroll: true });
    return;
  }
  if (card.action === "viva") {
    examPreferences().mode = "viva";
    setView("exam");
    return;
  }
  if (!card.prompt) return;
  setMode(card.mode || "answer");
  const input = $("#ask-input");
  input.value = card.prompt;
  setView("ask");
  $("#ask-form")?.requestSubmit();
}

/**
 * A shared link can carry the question: `?ask=…`. It only fills the composer, it
 * never sends, so nothing is asked to a model without the student tapping send.
 */
function applyLinkedQuestion(search = location.search) {
  const input = $("#ask-input");
  const question = askFromUrl(search);
  if (!input || !question) return "";
  input.value = question;
  setView("ask");
  input.focus({ preventScroll: true });
  ui.showToast("Your question is ready. Edit it or send it.", "info", 3600);
  return question;
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
      const cited = citationSummary(message.citationAudit);
      if (cited) meta.appendChild(ui.element("span", "", cited));
      if (message.verification?.enabled && message.verification.supported) {
        meta.appendChild(ui.element("span", "", "✓ Second AI check"));
      }
      if (meta.childNodes.length) body.appendChild(meta);
      if (message.suggest?.bookId) {
        // A refusal that names a page should also be able to open it. One tap
        // beats the student hunting through Library for the book mentioned.
        const nearest = message.suggest;
        const openNearest = ui.element(
          "button",
          "message-suggest",
          `Open the closest page · ${truncate(nearest.title || "your book", 32)} p. ${nearest.page ?? 1}`,
        );
        openNearest.type = "button";
        openNearest.setAttribute("aria-label", "Open the closest page found for this question");
        openNearest.addEventListener("click", () => openSource(nearest));
        body.appendChild(openNearest);
      }
      if (lastQuestion) {
        const actions = ui.element("div", "message-actions");
        const copy = ui.element("button", "message-action", "Copy answer");
        copy.type = "button";
        copy.addEventListener("click", () => copyText(formatAnswerForCopy(message), "Answer and citations copied."));
        actions.appendChild(copy);
        if (voiceEnv().speak) {
          const speak = ui.element("button", "message-action", "Read aloud");
          speak.type = "button";
          speak.setAttribute("aria-label", "Read this answer aloud");
          speak.addEventListener("click", () => sayText(message.content, { label: "Reading the answer aloud." }));
          actions.appendChild(speak);
        }
        // A study sheet is a revision handout: let it leave the app as a file so
        // it can be printed or pasted into a notebook.
        if (message.studySheet && !message.studySheet.empty) {
          const save = ui.element("button", "message-action", "Save sheet");
          save.type = "button";
          save.setAttribute("aria-label", "Save this study sheet as a Markdown file");
          save.addEventListener("click", () => {
            const name = (message.studySheet.topic || "study-sheet").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "study-sheet";
            downloadBlob(new Blob([studySheetMarkdown(message.studySheet)], { type: "text/markdown;charset=utf-8" }), `${name}.md`);
            ui.showToast("Study sheet saved.", "success");
          });
          actions.appendChild(save);
        }
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
  renderGoalCards();
}

function showTyping(visible) {
  $("#typing").classList.toggle("hidden", !visible);
  const label = $("#typing-label");
  if (label) label.textContent = state.settings.pro ? PRO_TYPING : "Reading your textbooks…";
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

/** Swap the assistant's name for the Pro Mode voice without touching the answer. */
function proPersonaMeta(meta = "") {
  const base = String(meta || "").replace(/^Bolt\s*·\s*/, "").replace(/^V\.I\.G\.N\.A\.N\..*?·\s*/, "");
  return base ? `${PRO_NAME} · pro · ${base}` : PRO_META;
}

/** Live numbers for Pro Mode readouts: real state, never invented. */
function proStatus() {
  const books = Array.isArray(state.books) ? state.books : [];
  const decks = normalizeDeckCollection(state.studyDecks).decks;
  const today = localDay();
  const pageTotal = books.reduce((sum, book) => sum + (Array.isArray(book?.pages) ? book.pages.length : Number(book?.pageCount) || 0), 0);
  const route = state.settings.routing.answer;
  const offline = route === "offline" || navigator.onLine === false;
  return {
    books: books.length,
    pages: pageTotal,
    decks: decks.length,
    dueCards: decks.reduce((sum, deck) => sum + dueCards(deck.cards, deck.progress, today).length, 0),
    streaks: currentStreak(state.studyProgress),
    quizzes: state.studyProgress.totalQuizzes || 0,
    accuracy: accuracy(state.studyProgress),
    model: route === "offline" ? "local engine" : aiProfile(route).nickname,
    offline,
  };
}

async function engageProMode({ announce = true } = {}) {
  const status = proStatus();
  state.settings.pro = true;
  await saveSettings();
  setProChrome(true);
  await playProActivation({
    lines: proBootLines({
      books: status.books, pages: status.pages, dueCards: status.dueCards,
      decks: status.decks, streaks: status.streaks, offline: status.offline, model: status.model,
    }),
  });
  updateStatus();
  if (!announce) return;
  const answer = {
    text: proBriefing(status, { date: new Date() }),
    sources: [], webSources: [], flashcards: [], grounded: false, confidence: 0,
    meta: PRO_META, verification: { enabled: false },
  };
  state.lastAnswer = answer;
  addMessage({ role: "assistant", content: answer.text, meta: answer.meta });
  renderSources(answer);
  ui.showToast("Pro Mode engaged.", "success");
}

async function disengageProMode() {
  state.settings.pro = false;
  await saveSettings();
  setProChrome(false);
  updateStatus();
  const answer = {
    text: `Pro Mode powered down. ${PRO_NAME} returns to plain Bolt — same cited engine, fewer lights.`,
    sources: [], webSources: [], flashcards: [], grounded: false, confidence: 0,
    meta: "Bolt · pro mode off", verification: { enabled: false },
  };
  state.lastAnswer = answer;
  addMessage({ role: "assistant", content: answer.text, meta: answer.meta });
  ui.showToast("Pro Mode off.", "info");
}

async function handleAsk(event) {
  event.preventDefault();
  if (state.askBusy) return;
  const input = $("#ask-input");
  let query = input.value.trim();
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
    // The easter egg: any sentence in which the student says they are Nezaad
    // ("I am Nezaad", "this is Nezaad", "main Nezaad hoon") boots Pro Mode.
    if (matchesActivation(query)) {
      // Boot the easter egg, then answer whatever was asked alongside the
      // introduction: "I am Nezaad, explain photosynthesis" does both.
      const { question } = splitActivation(query);
      await engageProMode();
      if (!question) {
        showTyping(false);
        state.askBusy = false;
        return;
      }
      query = question;
    }
    if (matchesPowerDown(query) && state.settings.pro) {
      showTyping(false);
      state.askBusy = false;
      await disengageProMode();
      return;
    }
    if (matchesStatusQuery(query) && state.settings.pro) {
      showTyping(false);
      state.askBusy = false;
      const report = {
        text: proStatusReport(proStatus()), sources: [], webSources: [], flashcards: [],
        grounded: false, confidence: 0, meta: PRO_META, verification: { enabled: false },
      };
      state.lastAnswer = report;
      addMessage({ role: "assistant", content: report.text, meta: report.meta });
      renderSources(report);
      return;
    }
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
      // In Pro Mode a greeting gets an in-character readout rather than a
      // generic hello; the wording still comes from the same local replies.
      const persona = state.settings.pro && greeting ? `${proGreeting(new Date())} Systems nominal.\n\n` : "";
      answer = {
        text: persona + (greeting || casual), sources: [], webSources: [], flashcards: [],
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
      const bookIds = scopeIds("#ask-book-scope");
      const retrieval = retrievePreferBooks(effectiveQuery, state.indexes, { topK: 5, bookIds });
      hits = retrieval.hits;
      // Grounded hits go empty when retrieval refuses, which used to leave the
      // refusal with nothing to point at. The pages it considered but did not
      // stand behind are still real pages in the student's library.
      const contextHits = (retrieval.allHits?.length ? retrieval.allHits : hits).slice(0, 3);
      // Books first: the built-in notes are a fallback for topics no uploaded
      // page covers, not a shortcut past the student's own textbook.
      const schoolAnswer = retrieval.grounded
        ? null
        : knowledgeTopicAnswer(effectiveQuery, language) || knowledgeTopicAnswer(query, language);
      if (schoolAnswer) {
        answer = schoolAnswer;
      } else {
      // "Key terms of chapter 3" is a revision request, not a question: build a
      // cited sheet from the matched pages instead of asking a model to guess.
      if (hits.length && asksForStudySheet(effectiveQuery)) {
        const topic = studySheetTopic(effectiveQuery) || (hits[0]?.section || hits[0]?.title || "");
        const sheet = buildStudySheet(hits, { topic });
        if (!sheet.empty) {
          answer = {
            text: studySheetMarkdown(sheet),
            sources: sourcesFromHits(hits),
            webSources: [], flashcards: [], grounded: true,
            confidence: retrieval.confidence,
            meta: "Bolt · cited study sheet",
            verification: { enabled: false },
            studySheet: sheet,
          };
        }
      }

      const online = navigator.onLine !== false;
      const webEnabled = Boolean(state.settings.webEnabled) && online;
      const webSkippedOffline = Boolean(state.settings.webEnabled) && !online;
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
      // A ready study sheet is already grounded in the book; a model must not
      // replace it with prose that could drift from the pages.
      if (!answer && hits.length && connected) {
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
            // A long answer with few citations is the failure mode judges notice.
            const thinCitations = looksUncited(model.content)
              ? "_Some sentences here are not tied to a page. Check the sources panel before you rely on them._\n\n"
              : "";
            // A figure no cited page contains is the clearest sign a connected
            // model added something. Name the figures rather than hiding it.
            const strayNumbers = ungroundedNumbers(model.content, sourcesFromHits(hits));
            // A marker like [4] with three passages open is a citation to
            // nothing. The student cannot see that; this can.
            const audit = citationAudit(model.content, sourcesFromHits(hits));
            const citationNote = citationWarning(audit);
            const numbersWarning = strayNumbers.length
              ? `_These figures do not appear on the cited pages: ${strayNumbers.join(", ")}. Check them against your book before you write them down._\n\n`
              : "";
            answer = {
              text: webImportNotice + thinCitations + numbersWarning + (citationNote ? `${citationNote}\n\n` : "") + model.content,
              sources: sourcesFromHits(hits), webSources: [], grounded: true,
              confidence: retrieval.confidence, verification: model.verification,
              meta: `${aiProfile(model.engine).nickname} · AI answer${model.fallbackUsed ? " (fallback)" : ""}`,
              citationAudit: audit,
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
      if (!answer && !hits.length) {
        // Nothing in the library and no usable web text: the built-in fact pack
        // is the last resort, never a substitute for a page the student owns.
        answer = knowledgeFactAnswer(effectiveQuery, language) || knowledgeFactAnswer(query, language);
      }
      if (!answer && !hits.length && !webResults.length && retrieval.reason !== "too-vague"
        && (webEnabled || webSkippedOffline)) {
        // Offline is not a failure mode: say what still works instead of
        // offering a web link that cannot open.
        const query$ = searchTopic(effectiveQuery) || effectiveQuery;
        const webLines = [
          `**${t("knowledge.notFound")}**`,
          t("knowledge.outsideHelp"),
          `- [DuckDuckGo](${externalSearchUrl(query$, "duckduckgo")})`,
          `- [Google](${externalSearchUrl(query$, "google")})`,
          searchError ? `_${searchError.message}_` : t("knowledge.webEmpty"),
        ];
        const offlineLines = [
          `**${t("knowledge.notFound")}**`,
          "_You are offline, so web search was skipped. Your books, quizzes, flashcards, cited study sheets and today's revision all still work; saved pages answer questions with their page numbers._",
        ];
        answer = {
          text: (webSkippedOffline ? offlineLines : webLines).join("\n\n"),
          sources: [], webSources: [], flashcards: [], grounded: false, confidence: 0,
          meta: webSkippedOffline ? "Bolt · offline" : "Bolt · outside search unavailable",
          verification: { enabled: false },
        };
      }
      if (!answer) {
        answer = composeGroundedAnswer({
          query, evidenceQuery: effectiveQuery, hits, mode: requestMode,
          reason: retrieval.reason, confidence: retrieval.confidence, webResults, webEnabled,
          language: state.settings.language, depth: state.settings.answerDepth,
          // Grounded but not a strong match: the pages answer part of the
          // question. Say so in the body instead of only in a tag.
          partial: retrieval.confidence > 0 && retrieval.confidence < 0.62,
          contextHits,
        });
        answer.meta = modelError ? "Model unavailable — cited excerpts shown"
          : hits.length ? "Bolt · cited library excerpts" : "Bolt · no matching source";
        answer.verification = { enabled: false };
        if (!hits.length && !webEnabled) {
          answer.text = `${answer.text}\n\n_${webSkippedOffline ? "Offline — saved pages only." : t("knowledge.webOff")}_`;
        }
        showKeyExhaustedToast(modelError);
      }
      // A refusal is only useful if the student can get somewhere. Offer the
      // closest page as a button, not just a sentence they have to re-find.
      if (!answer.sources?.length && contextHits.length) {
        const nearest = contextHits[0];
        answer.suggest = {
          bookId: nearest.bookId, title: nearest.title,
          page: nearest.page, section: nearest.section, text: nearest.text,
        };
      }
      if (requestMode === "flashcards" && hits.length && !answer.flashcards?.length) {
        answer.flashcards = buildFlashcards(hits, 6, { language: state.settings.language });
      }
      }
    }
    if (state.settings.pro) answer.meta = proPersonaMeta(answer.meta);
    // The sources panel explains each page by the words it shares with the
    // question, so the question travels with the answer.
    answer.query = query;
    state.lastAnswer = answer;
    addMessage({
      role: "assistant", content: answer.text, sources: answer.sources,
      webSources: answer.webSources, meta: answer.meta, confidence: answer.confidence,
      verification: answer.verification, flashcards: answer.flashcards,
      studySheet: answer.studySheet, suggest: answer.suggest, citationAudit: answer.citationAudit,
      query: answer.query || query,
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
    sources.forEach((source) => list.appendChild(sourceCard(source, answer.query || "")));
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

function sourceCard(source, query = "") {
  const card = ui.element("div", "source-card");
  const top = ui.element("div", "source-card-top");
  top.appendChild(ui.element("span", "source-number", String(source.n)));
  top.appendChild(ui.element("div", "source-title", `${source.sourceUrl ? "Web import · " : ""}${truncate(source.title, 54)}`));
  top.appendChild(ui.element("span", "source-page", source.sourceUrl && source.sourceKind !== "pdf" ? `section ${source.page}` : `p. ${source.page}`));
  const snippet = ui.element("p", "source-snippet", truncate(source.quote || source.text, 190));
  // Why this page? The words it shares with the question, in plain sight. When
  // there are none, that is said too — a page can arrive for its neighbours.
  const matched = matchedTerms(query, `${source.text || ""} ${source.section || ""}`);
  const matchLine = ui.element(
    "p",
    `source-match${matched.length ? "" : " none"}`,
    matched.length ? t("source.matched", { terms: matched.join(", ") }) : t("source.noSharedWords"),
  );
  // The actions row has to exist before the card is assembled: this line used to
  // sit above its own declaration, which threw "cannot access 'actions' before
  // initialization" every time a source card was built. The answer then arrived
  // followed by "I could not complete that answer", because the throw was caught
  // by the ask handler, not by the card.
  const read = ui.element("button", "", t("ask.reader"));
  read.type = "button";
  read.addEventListener("click", () => openSource(source));
  const copy = ui.element("button", "", "Copy quote");
  copy.type = "button";
  copy.addEventListener("click", () => copyText(source.quote || source.text));
  const actions = ui.element("div", "source-actions");
  actions.append(read, copy);
  card.append(top, snippet, matchLine, actions);
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
  renderStarterCard();
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
    // No page in mind: the reader continues where this device stopped. A
    // citation passes its own page and is never affected by this.
    openReader({ book, pages: book.pages || [] });
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

/* --------------------------------------------------------------- voice, viva */

/** What this browser can do, asked once and remembered for the tab. */
let voiceCache = null;
function voiceEnv() {
  if (!voiceCache) {
    voiceCache = voiceSupport({
      speechSynthesis: globalThis.speechSynthesis,
      SpeechRecognition: globalThis.SpeechRecognition,
      webkitSpeechRecognition: globalThis.webkitSpeechRecognition,
      online: typeof navigator === "undefined" ? true : navigator.onLine !== false,
    });
  }
  return voiceCache;
}

function sayText(text, { label = "" } = {}) {
  const env = voiceEnv();
  if (!env.speak) {
    ui.showToast(env.reason || "This browser cannot read aloud. Everything still works by typing.", "info", 6000);
    return false;
  }
  stopSpeaking();
  const result = speakText(text, {
    synth: env.synth,
    voices: availableVoices(env.synth),
    language: speechLanguage(state.settings.language),
  });
  if (!result.ok) {
    ui.showToast(result.reason === "empty" ? "There is nothing to read on this screen." : "Reading aloud did not start. Try again, or read the page yourself.", "info", 5000);
    return false;
  }
  if (label) ui.showToast(label, "info", 1800);
  return true;
}

function speakCurrentQuestion() {
  const question = state.quiz?.questions?.[state.quizIndex];
  if (!question) return;
  const options = question.type === "mcq" ? ` The options are: ${question.options.join(", ")}.` : "";
  sayText(`${examinerLine(question)}${options}`, { label: "Reading the question aloud." });
}

/**
 * One spoken answer, dropped into whichever box the question uses.
 * Speech is a shortcut for typing, never a replacement: on any failure the box
 * keeps its text and the student is told what happened.
 */
/**
 * Put a microphone failure where the student can read it and act on it.
 *
 * A toast disappears in five seconds and cannot carry a link. This notice stays
 * until it is fixed or dismissed, says which failure happened, and when the page
 * is inside a preview frame it offers the one action that works: open the app in
 * its own tab.
 */
function showVoiceHelp(problem) {
  const box = $("#voice-help");
  if (!box) {
    ui.showToast(problem.message, "info", 7000);
    return;
  }
  box.replaceChildren();
  box.appendChild(document.createTextNode(problem.message));
  if (problem.openTab) {
    const link = ui.element("a", "voice-help-link", "Open in a new tab ↗");
    link.href = location.href;
    link.target = "_blank";
    link.rel = "noopener";
    box.appendChild(link);
  }
  const close = ui.element("button", "voice-help-close", "Dismiss");
  close.type = "button";
  close.addEventListener("click", hideVoiceHelp);
  box.appendChild(close);
  box.classList.remove("hidden");
  box.dataset.code = problem.code;
}

function hideVoiceHelp() {
  const box = $("#voice-help");
  if (!box) return;
  box.classList.add("hidden");
  box.replaceChildren();
  delete box.dataset.code;
}

/**
 * Ask the browser what it thinks before blaming the student.
 *
 * Chrome reports a blocked frame and a refused permission with the same error
 * code, so the frame check comes first; the Permissions API, where it exists,
 * distinguishes a refusal the student made themselves.
 */
async function voiceProblem(error) {
  let permission = "";
  try {
    const status = await navigator.permissions?.query?.({ name: "microphone" });
    if (status?.state === "denied") permission = "denied";
  } catch {
    // Firefox and Safari do not expose the microphone here; carry on.
  }
  return microphoneProblem({ error: permission || error, framed: insideFrame(), permission });
}

async function dictateAnswer(button) {
  const env = voiceEnv();
  if (!env.listen) {
    ui.showToast(env.reason || listenMessage("unsupported"), "info", 6500);
    return;
  }
  const Recognition = env.Recognition;
  let recognition = null;
  try { recognition = new Recognition(); } catch { recognition = null; }
  if (!recognition) {
    showVoiceHelp(microphoneProblem({ error: "unsupported", framed: insideFrame() }));
    return;
  }
  const input = $("#quiz-question textarea.short-input") || $("#quiz-question input.fill-input");
  if (!input) {
    ui.showToast("This kind of question is answered by choosing an option, not by speaking.", "info", 5000);
    return;
  }
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "Listening…";
  button.classList.add("listening");
  const { text, error } = await listenOnce({ recognition, language: speechLanguage(state.settings.language) });
  button.disabled = false;
  button.textContent = original;
  button.classList.remove("listening");
  if (text) {
    hideVoiceHelp();
    input.value = input.value ? `${input.value.trim()} ${text}` : text;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
    return;
  }
  showVoiceHelp(await voiceProblem(error || "empty"));
}

async function dictateQuestion(button) {
  const env = voiceEnv();
  const input = $("#ask-input");
  if (!env.listen || !input) {
    ui.showToast(env.reason || listenMessage("unsupported"), "info", 6500);
    return;
  }
  let recognition = null;
  try { recognition = new (env.Recognition)(); } catch { recognition = null; }
  if (!recognition) {
    showVoiceHelp(microphoneProblem({ error: "unsupported", framed: insideFrame() }));
    return;
  }
  button.disabled = true;
  button.classList.add("listening");
  const { text, error } = await listenOnce({ recognition, language: speechLanguage(state.settings.language) });
  button.disabled = false;
  button.classList.remove("listening");
  if (text) {
    hideVoiceHelp();
    input.value = text;
    input.focus();
    return;
  }
  showVoiceHelp(await voiceProblem(error || "empty"));
}

/** The viva report card, built from the questions the examiner actually asked. */
/** The current mark for one answer, using the same rule as the final result. */
function currentAward(question, answer) {
  if (!String(answer || "").trim()) return 0;
  try {
    const single = makeQuiz({ questions: [question], type: question.type });
    const graded = gradeQuiz(single, { [question.id]: answer });
    return Number(graded.perQuestion?.[0]?.awarded) || 0;
  } catch {
    return 0;
  }
}

function vivaCard(report, quiz) {
  const card = ui.element("div", "card viva-card");
  card.appendChild(ui.element("span", "eyebrow", `VIVA · ${(quiz?.examName || "Oral practice").toUpperCase()}`));
  const head = ui.element("div", "viva-head");
  head.appendChild(ui.element("strong", "viva-marks", `${report.marks} / ${report.outOf}`));
  head.appendChild(ui.element("span", `viva-band band-${report.band.toLowerCase().replace(/\s+/g, "-")}`, report.band));
  card.appendChild(head);
  card.appendChild(ui.element("p", "hint", report.bandNote));

  if (report.strengths.length) {
    card.appendChild(ui.element("h4", "exam-subhead", "Answered well"));
    card.appendChild(ui.element("p", "viva-list", report.strengths.slice(0, 5).join(" · ")));
  }
  if (report.weaknesses.length) {
    card.appendChild(ui.element("h4", "exam-subhead", "Needs another sentence"));
    card.appendChild(ui.element("p", "viva-list", report.weaknesses.slice(0, 5).join(" · ")));
  }
  if (report.misconception) {
    card.appendChild(ui.element("h4", "exam-subhead", `Examiner's note${report.misconceptionTopic ? ` on ${report.misconceptionTopic}` : ""}`));
    card.appendChild(ui.element("p", "viva-note", report.misconception));
  }
  card.appendChild(ui.element("p", "viva-next", report.nextStep));
  card.appendChild(ui.element("p", "hint", report.honesty));
  return card;
}

/* ------------------------------------------------------------ starter shelf */

const STARTER_SHELF_FLAG = "starterShelfAdded";

/**
 * Add our own study pages to the library.
 *
 * These are the pages the app can always answer from, written for this project
 * so that nothing here depends on a publisher's permission. They are stored
 * exactly like a pasted note, which means a citation points at a real page a
 * student can open, and deleting them deletes them for good.
 */
async function installStarterShelf({ announce = true } = {}) {
  const books = shelfBooks();
  const existing = new Set(state.books.map((book) => book.id));
  let added = 0;
  let pages = 0;
  for (const book of books) {
    if (existing.has(book.id)) continue;
    const index = ingestText(shelfMarkdown(book), {
      id: book.id,
      title: book.title,
      subject: book.subject,
      grade: book.grade,
      board: "Starter pages",
      language: "English",
      fileName: "starter-pages.txt",
    });
    await db.saveBookIndex(index);
    added += 1;
    pages += index.book.pageCount;
  }
  await reloadIndexes();
  renderBookScopes();
  renderLibrary();
  if ($("#view-exam")?.classList.contains("active")) renderExamView();
  if (announce) {
    ui.showToast(
      added
        ? `Starter pages added: ${pages} pages across ${added} ${added === 1 ? "book" : "books"}. Replace them with your own books any time.`
        : "The starter pages are already in your library.",
      added ? "success" : "info",
      7000,
    );
  }
  return { added, pages };
}

/** On the first open only: a student should never meet an empty workspace. */
async function ensureStarterShelf() {
  try {
    if (await db.getSetting(STARTER_SHELF_FLAG, false)) return false;
    await db.setSetting(STARTER_SHELF_FLAG, true);
    if (state.indexes.length) return false;
    await installStarterShelf({ announce: false });
    return true;
  } catch (error) {
    console.error("[vignan-ai] starter pages", error);
    return false;
  }
}

async function removeStarterShelf() {
  const starter = state.books.filter((book) => isStarterBookId(book.id));
  if (!starter.length) return false;
  const confirmed = await ui.confirmDialog({
    title: "Remove the starter pages?",
    message: `This deletes ${starter.length} ${starter.length === 1 ? "book" : "books"} written for this project. Your own uploads, notes and results stay untouched.`,
    confirmLabel: "Remove them",
  });
  if (!confirmed) return false;
  for (const book of starter) {
    try { await db.deleteBook(book.id); } catch (error) { console.error(error); }
  }
  await reloadIndexes();
  renderBookScopes();
  renderLibrary();
  if ($("#view-exam")?.classList.contains("active")) renderExamView();
  ui.showToast("Starter pages removed. Add them again from Library whenever you want.", "info", 6000);
  return true;
}

function renderStarterCard() {
  const card = $("#starter-card");
  if (!card) return;
  const starter = state.books.filter((book) => isStarterBookId(book.id));
  const summary = shelfSummary();
  const status = $("#starter-status");
  const add = $("#starter-add");
  const remove = $("#starter-remove");
  if (starter.length) {
    const pages = starter.reduce((total, book) => total + (book.pageCount || 0), 0);
    card.classList.add("installed");
    if (status) status.textContent = `${starter.length} ${starter.length === 1 ? "book" : "books"} · ${pages} pages · written for this project`;
    if (add) add.hidden = true;
    if (remove) remove.hidden = false;
  } else {
    card.classList.remove("installed");
    if (status) status.textContent = `${summary.pages} pages across ${summary.books} subjects, ready in one click.`;
    if (add) add.hidden = false;
    if (remove) remove.hidden = true;
  }
}

/* ------------------------------------------------------------------ exams */

const EXAM_COUNTS = [5, 10, 15, 20];

/** Exam-practice choices the student made last, kept for this session. */
function examPreferences() {
  if (!state.exam) state.exam = { examId: EXAMS[0].id, mode: "mock", count: 10, vivaCount: 3, chapter: "", subjectId: "" };
  const exam = examByIdOrFirst(state.exam.examId);
  state.exam.examId = exam.id;
  if (!MODES.some((mode) => mode.id === state.exam.mode)) state.exam.mode = MODES[0].id;
  if (!EXAM_COUNTS.includes(Number(state.exam.count))) state.exam.count = 10;
  if (![3, 5].includes(Number(state.exam.vivaCount))) state.exam.vivaCount = 3;
  if (!state.exam.subjectId || !exam.subjects.some((subject) => subject.id === state.exam.subjectId)) {
    state.exam.subjectId = exam.subjects[0]?.id || "";
  }
  return state.exam;
}

let examCorpusCache = { key: null, text: "" };

/** Every page the student owns, lowercased. Cached until the library changes. */
function examCorpusText() {
  const key = state.indexes.map((index) => `${index.book?.id || "book"}:${index.book?.pages?.length || 0}`).join("|");
  if (examCorpusCache.key === key) return examCorpusCache.text;
  const parts = [];
  // Four million characters is far more than a school library, and it keeps
  // this scan from stalling a phone when a student has added many PDFs.
  let budget = 4000000;
  for (const index of state.indexes) {
    for (const page of index.book?.pages || []) {
      const text = String(page.text || "").trim();
      if (!text) continue;
      parts.push(text);
      budget -= text.length;
      if (budget <= 0) break;
    }
    if (budget <= 0) break;
  }
  examCorpusCache = { key, text: parts.join("\n").toLowerCase() };
  return examCorpusCache.text;
}

function examCoverage(exam) {
  return syllabusCoverage(exam, examCorpusText());
}

/** "+4 right, -1 wrong", in the exam's own units. */
function markingLine(exam) {
  const marking = exam.marking || {};
  const right = Number(marking.correct) || 0;
  const wrong = Number(marking.wrong) || 0;
  if (wrong < 0) return `+${right} for a right answer, ${wrong} for a wrong one. Leaving it blank costs nothing.`;
  return `+${right} for a right answer, no negative marking.`;
}

/** Chapters already present in the student's pages come first. */
function chapterQueue(subject, coverage) {
  const covered = coverage.present.filter((entry) => entry.subjectId === subject.id).map((entry) => entry.chapter);
  const rest = (subject.chapters || []).filter((chapter) => !covered.includes(chapter));
  return [...covered, ...rest];
}

function subjectForChapter(exam, chapter) {
  return (exam.subjects || []).find((subject) => (subject.chapters || []).includes(chapter)) || exam.subjects[0];
}

/**
 * Questions for one chapter, written by the same offline engine as every other
 * quiz in the app, then tagged with the exam subject so marking can be exact.
 */
function examChapterQuestions(exam, { chapter, subjectId, count, type = "mcq" }) {
  const { hits } = retrieveChapter(chapter, state.indexes, { topK: Math.max(10, count * 4) });
  if (!hits.length) return [];
  const quiz = generateQuiz({
    hits,
    topic: chapter,
    count,
    type,
    difficulty: "medium",
    timed: false,
    secondsPerQuestion: 45,
    language: state.settings.language,
  });
  return quiz.questions.map((question) => ({ ...question, examId: exam.id, subjectId, chapter }));
}

/** A mock paper: subjects in the exam's own proportion, questions across chapters. */
function buildExamMock(exam, count) {
  const coverage = examCoverage(exam);
  const questions = [];
  for (const row of blueprint(exam, count)) {
    const subject = exam.subjects.find((entry) => entry.id === row.subjectId);
    if (!subject) continue;
    let taken = 0;
    let attempts = 0;
    for (const chapter of chapterQueue(subject, coverage)) {
      if (taken >= row.count || questions.length >= count) break;
      if (attempts >= row.count * 6) break;
      attempts += 1;
      const batch = examChapterQuestions(exam, { chapter, subjectId: subject.id, count: row.count - taken });
      for (const question of batch) {
        if (taken >= row.count || questions.length >= count) break;
        questions.push(question);
        taken += 1;
      }
    }
  }
  return questions;
}

function buildExamDrill(exam, chapter, count) {
  const subject = subjectForChapter(exam, chapter);
  return examChapterQuestions(exam, { chapter, subjectId: subject?.id || "general", count });
}

/**
 * A viva asks the student to explain, so the examiner hands over a sentence from
 * the student's own page and asks for it in their own words. One sentence per
 * page keeps the questions varied, and every one carries its citation.
 */
function buildExamViva(exam, chapter, count) {
  const subject = subjectForChapter(exam, chapter);
  const { hits } = retrieveChapter(chapter, state.indexes, { topK: Math.max(8, count * 3) });
  const rows = [];
  for (const hit of hits) {
    if (rows.length >= count) break;
    const usable = splitSentences(String(hit.text || ""))
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter((line) => line.split(/\s+/).filter(Boolean).length >= 10 && line.length <= 260);
    // A chapter can be one page long, so take a few sentences from each page
    // rather than one; the examiner still never repeats a sentence.
    for (const sentence of usable.slice(0, 3)) {
      if (rows.length >= count) break;
      rows.push({
        sentence,
        topic: hit.section || chapter,
        source: {
          bookId: hit.bookId,
          chunkId: hit.chunkId,
          title: hit.title,
          page: hit.page,
          section: hit.section,
          sourceUrl: hit.sourceUrl || "",
          quote: sentence,
        },
      });
    }
  }
  const questions = vivaQuestionsFromSentences(rows, { count });
  return questions.map((question) => ({ ...question, examId: exam.id, subjectId: subject?.id || "general", chapter }));
}

function examQuizFrom(exam, mode, questions) {
  const timed = mode === "mock";
  // A mock is paced at the real paper's rate, so a ten-question set takes as
  // long per question as the actual exam allows - that is the lesson.
  const perQuestion = timed
    ? Math.max(20, Math.round(paceSeconds(exam, questions.length) / Math.max(1, questions.length)))
    : 45;
  const bookIds = [...new Set(questions.map((question) => question.source?.bookId).filter(Boolean))];
  const quiz = makeQuiz({
    questions,
    topic: mode === "drill" ? questions[0]?.chapter || exam.name : exam.name,
    bookIds,
    type: "mcq",
    difficulty: "medium",
    timed,
    secondsPerQuestion: perQuestion,
    generatedBy: "offline",
    hits: [],
  });
  quiz.title = mode === "drill" ? `${quiz.topic} - ${exam.name} drill` : `${exam.name} mock test`;
  quiz.examId = exam.id;
  quiz.examMode = mode;
  quiz.examName = exam.name;
  if (mode === "viva") {
    quiz.viva = true;
    quiz.title = `${exam.name} viva - ${questions[0]?.chapter || "mixed"}`;
  }
  return quiz;
}

async function startExamSession(options = {}) {
  const preferences = examPreferences();
  const exam = examByIdOrFirst(options.examId || preferences.examId);
  const mode = options.mode === "drill" ? "drill" : options.mode === "viva" ? "viva" : "mock";
  const count = clamp(Number(options.count || preferences.count) || 10, 3, 40);
  const chapter = String(options.chapter || preferences.chapter || "").trim();

  if (!state.indexes.length) {
    const message = "Add a textbook or your notes in Library first - every question here comes from your own pages.";
    ui.showToast(message, "warning", 6500);
    return { ok: false, message };
  }
  if ((mode === "drill" || mode === "viva") && !chapter) {
    const message = mode === "viva" ? "Choose the chapter the examiner should ask about." : "Choose the chapter you want to drill.";
    ui.showToast(message, "warning");
    return { ok: false, message };
  }

  const button = $("#exam-start");
  if (button) ui.setBusy(button, true, "Building the paper…");
  try {
    const questions = mode === "drill"
      ? buildExamDrill(exam, chapter, count)
      : mode === "viva"
        ? buildExamViva(exam, chapter, count)
        : buildExamMock(exam, count);
    if (!questions.length) {
      const message = `No usable pages were found for ${mode === "drill" ? chapter : exam.name} in your library. Add more of the chapter, then try again.`;
      ui.showToast(message, "warning", 7000);
      return { ok: false, message };
    }
    const quiz = examQuizFrom(exam, mode, questions);
    state.quiz = quiz;
    state.quizContext = null;
    state.quizResponses = {};
    state.quizIndex = 0;
    state.result = null;
    $("#quiz-topic-title").textContent = quiz.title;
    $("#quiz-run-note").textContent = `${quiz.questions.length} ${quiz.questions.length === 1 ? "question" : "questions"} · ${
      mode === "mock" ? "exam pace, exam marking" : mode === "viva" ? "answer aloud or type, marked out of ten" : "untimed, no penalty"
    } · from your books`;
    setView("quiz");
    startQuizTimer();
    if (quiz.questions.length < count) {
      ui.showToast(`Your pages had enough material for ${quiz.questions.length} of the ${count} questions.`, "info", 6000);
    }
    return { ok: true, quiz };
  } catch (error) {
    console.error(error);
    const message = error?.message || "Could not build that paper.";
    ui.showToast(message, "error");
    return { ok: false, message };
  } finally {
    if (button) ui.setBusy(button, false);
  }
}

function examFactGrid(rows) {
  const grid = ui.element("div", "exam-facts");
  for (const [value, label] of rows) {
    const cell = ui.element("div", "exam-fact");
    cell.appendChild(ui.element("strong", "", String(value)));
    cell.appendChild(ui.element("span", "", label));
    grid.appendChild(cell);
  }
  return grid;
}

function examTab(active, label, onPick, title) {
  const tab = ui.element("button", `exam-tab${active ? " active" : ""}`, label);
  tab.type = "button";
  tab.setAttribute("aria-pressed", active ? "true" : "false");
  if (title) tab.title = title;
  tab.addEventListener("click", onPick);
  return tab;
}

function renderExamMock(preferences, exam, coverage) {
  const card = ui.element("div", "card exam-card");
  card.appendChild(ui.element("h3", "", `${exam.name} mock test`));
  card.appendChild(ui.element("p", "hint", "The real shape: the same subject split, the same marking and the real paper's pace per question."));
  card.appendChild(
    examFactGrid([
      [exam.questions, "questions in the real paper"],
      [exam.marks, "marks"],
      [`${exam.minutes} min`, "exam time"],
    ]),
  );
  card.appendChild(ui.element("p", "exam-marking", markingLine(exam)));

  const counts = ui.element("div", "exam-counts");
  counts.appendChild(ui.element("span", "exam-count-label", "Questions here"));
  for (const value of EXAM_COUNTS) {
    counts.appendChild(
      examTab(Number(preferences.count) === value, String(value), () => {
        preferences.count = value;
        renderExamView();
      }, `A ${value}-question set`),
    );
  }
  card.appendChild(counts);

  const split = ui.element("div", "exam-split");
  for (const row of blueprint(exam, preferences.count)) {
    const line = ui.element("div", "exam-split-row");
    line.appendChild(ui.element("span", "", row.name));
    line.appendChild(ui.element("strong", "", `${row.count} ${row.count === 1 ? "question" : "questions"}`));
    split.appendChild(line);
  }
  card.appendChild(split);
  card.appendChild(ui.element("p", "hint", `${pacingLine(exam, preferences.count)} ${paceLabel(exam)} at the real pace.`));

  const actions = ui.element("div", "exam-actions");
  const start = ui.element("button", "button primary", "Start mock test");
  start.type = "button";
  start.id = "exam-start";
  start.addEventListener("click", () => void startExamSession({ mode: "mock", examId: exam.id }));
  actions.appendChild(start);
  if (!state.indexes.length) {
    const shelf = ui.element("button", "button ghost small", "Add the starter pages");
    shelf.type = "button";
    shelf.addEventListener("click", async () => {
      ui.setBusy(shelf, true, "Adding pages…");
      try {
        await installStarterShelf();
        renderExamView();
      } finally {
        ui.setBusy(shelf, false);
      }
    });
    actions.appendChild(shelf);
  } else if (!coverage.covered) {
    actions.appendChild(ui.element("span", "hint", "Nothing in your library matches this syllabus yet, so the paper may come up short."));
  }
  card.appendChild(actions);
  return card;
}

function renderExamDrill(preferences, exam, coverage) {
  const card = ui.element("div", "card exam-card");
  card.appendChild(ui.element("h3", "", `${exam.name} chapter drill`));
  card.appendChild(ui.element("p", "hint", "One chapter, untimed, no penalty. For the day you learn something, not the day you test yourself."));

  const subject = exam.subjects.find((entry) => entry.id === preferences.subjectId) || exam.subjects[0];
  const grid = ui.element("div", "exam-selects");

  const subjectLabel = ui.element("label", "");
  subjectLabel.appendChild(ui.element("span", "", "Subject"));
  const subjectSelect = document.createElement("select");
  subjectSelect.id = "exam-subject";
  for (const entry of exam.subjects) {
    const option = document.createElement("option");
    option.value = entry.id;
    option.textContent = entry.name;
    option.selected = entry.id === subject.id;
    subjectSelect.appendChild(option);
  }
  subjectSelect.addEventListener("change", () => {
    preferences.subjectId = subjectSelect.value;
    const next = exam.subjects.find((entry) => entry.id === subjectSelect.value);
    preferences.chapter = next?.chapters?.[0] || "";
    renderExamView();
  });
  subjectLabel.appendChild(subjectSelect);
  grid.appendChild(subjectLabel);

  const coveredHere = new Set(
    coverage.present.filter((entry) => entry.subjectId === subject.id).map((entry) => entry.chapter),
  );
  const chapters = subject.chapters || [];
  const chosen = chapters.includes(preferences.chapter) ? preferences.chapter : chapters[0] || "";
  preferences.chapter = chosen;

  const chapterLabel = ui.element("label", "");
  chapterLabel.appendChild(ui.element("span", "", "Chapter"));
  const chapterSelect = document.createElement("select");
  chapterSelect.id = "exam-chapter";
  for (const chapter of chapters) {
    const option = document.createElement("option");
    option.value = chapter;
    option.textContent = coveredHere.has(chapter) ? `${chapter} - in your library` : chapter;
    option.selected = chapter === chosen;
    chapterSelect.appendChild(option);
  }
  chapterSelect.addEventListener("change", () => {
    preferences.chapter = chapterSelect.value;
    renderExamView();
  });
  chapterLabel.appendChild(chapterSelect);
  grid.appendChild(chapterLabel);
  card.appendChild(grid);

  const counts = ui.element("div", "exam-counts");
  counts.appendChild(ui.element("span", "exam-count-label", "Questions"));
  for (const value of [5, 10]) {
    counts.appendChild(
      examTab(Number(preferences.count) === value, String(value), () => {
        preferences.count = value;
        renderExamView();
      }, `A ${value}-question drill`),
    );
  }
  card.appendChild(counts);
  card.appendChild(
    ui.element(
      "p",
      "hint",
      coveredHere.has(chosen)
        ? "This chapter is in your library, so the drill will be grounded in your own pages."
        : "This chapter is not in your library yet. Add its pages in Library and the drill fills in.",
    ),
  );

  const actions = ui.element("div", "exam-actions");
  const start = ui.element("button", "button primary", "Start drill");
  start.type = "button";
  start.id = "exam-start";
  start.addEventListener("click", () =>
    void startExamSession({ mode: "drill", examId: exam.id, chapter: preferences.chapter, count: preferences.count }),
  );
  actions.appendChild(start);
  card.appendChild(actions);
  return card;
}

function renderExamViva(preferences, exam, coverage) {
  const card = ui.element("div", "card exam-card");
  card.appendChild(ui.element("h3", "", `${exam.name} viva`));
  card.appendChild(ui.element("p", "hint", "An examiner asks about one chapter. Explain out loud or type it; the answer is marked out of ten, and the examiner names what went wrong instead of only saying so."));

  const subject = exam.subjects.find((entry) => entry.id === preferences.subjectId) || exam.subjects[0];
  const grid = ui.element("div", "exam-selects");

  const subjectLabel = ui.element("label", "");
  subjectLabel.appendChild(ui.element("span", "", "Subject"));
  const subjectSelect = document.createElement("select");
  for (const entry of exam.subjects) {
    const option = document.createElement("option");
    option.value = entry.id;
    option.textContent = entry.name;
    option.selected = entry.id === subject.id;
    subjectSelect.appendChild(option);
  }
  subjectSelect.addEventListener("change", () => {
    preferences.subjectId = subjectSelect.value;
    const next = exam.subjects.find((entry) => entry.id === subjectSelect.value);
    preferences.chapter = next?.chapters?.[0] || "";
    renderExamView();
  });
  subjectLabel.appendChild(subjectSelect);
  grid.appendChild(subjectLabel);

  const coveredHere = new Set(coverage.present.filter((entry) => entry.subjectId === subject.id).map((entry) => entry.chapter));
  const chapters = subject.chapters || [];
  const chosen = chapters.includes(preferences.chapter) ? preferences.chapter : chapters[0] || "";
  preferences.chapter = chosen;
  const chapterLabel = ui.element("label", "");
  chapterLabel.appendChild(ui.element("span", "", "Chapter"));
  const chapterSelect = document.createElement("select");
  for (const chapter of chapters) {
    const option = document.createElement("option");
    option.value = chapter;
    option.textContent = coveredHere.has(chapter) ? `${chapter} - in your library` : chapter;
    option.selected = chapter === chosen;
    chapterSelect.appendChild(option);
  }
  chapterSelect.addEventListener("change", () => {
    preferences.chapter = chapterSelect.value;
    renderExamView();
  });
  chapterLabel.appendChild(chapterSelect);
  grid.appendChild(chapterLabel);
  card.appendChild(grid);

  const counts = ui.element("div", "exam-counts");
  counts.appendChild(ui.element("span", "exam-count-label", "Questions"));
  for (const value of [3, 5]) {
    counts.appendChild(examTab(Number(preferences.vivaCount) === value, String(value), () => {
      preferences.vivaCount = value;
      renderExamView();
    }, `A ${value}-question viva`));
  }
  card.appendChild(counts);

  const env = voiceEnv();
  card.appendChild(
    ui.element(
      "p",
      "hint",
      env.speak && env.listen
        ? "This browser can read the questions aloud and take a spoken answer. Both are optional; every question can be typed."
        : env.speak
          ? "This browser can read the questions aloud. Spoken answers are not available here, so type them."
          : "Type the answers here. This browser cannot read aloud or listen; the marking is the same either way.",
    ),
  );

  const actions = ui.element("div", "exam-actions");
  const start = ui.element("button", "button primary", "Start viva");
  start.type = "button";
  start.id = "exam-start";
  start.addEventListener("click", () =>
    void startExamSession({ mode: "viva", examId: exam.id, chapter: preferences.chapter, count: preferences.vivaCount }),
  );
  actions.appendChild(start);
  card.appendChild(actions);
  return card;
}

function renderExamCoverage(preferences, exam, coverage) {
  const card = ui.element("div", "card exam-card");
  card.appendChild(ui.element("h3", "", `${exam.name} syllabus coverage`));
  card.appendChild(
    ui.element(
      "p",
      "hint",
      state.indexes.length
        ? `${coverage.covered} of ${coverage.total} chapters of this syllabus are already answered by your own pages. The rest need a book before a question about them can be honest.`
        : "Your library is empty. Add a chapter in Library and this fills in from your own pages.",
    ),
  );

  const headline = ui.element("div", "exam-coverage-head");
  headline.appendChild(ui.element("strong", "exam-coverage-value", `${coverage.percent}%`));
  headline.appendChild(ui.element("span", "hint", `${coverage.covered} of ${coverage.total} chapters covered`));
  card.appendChild(headline);
  const meter = ui.element("div", "meter");
  const fill = ui.element("span", "");
  fill.style.width = `${coverage.percent}%`;
  meter.appendChild(fill);
  card.appendChild(meter);

  for (const row of coverage.bySubject) {
    if (!row.total) continue;
    const line = ui.element("div", "topic-bar");
    line.appendChild(ui.element("span", "", row.name));
    const bar = ui.element("div", "meter");
    const barFill = ui.element("span", "");
    barFill.style.width = `${row.percent}%`;
    bar.appendChild(barFill);
    line.appendChild(bar);
    line.appendChild(ui.element("span", "", `${row.covered}/${row.total}`));
    card.appendChild(line);
  }

  const mastery = topicMastery(state.results).map((entry) => ({ topic: entry.topic, accuracy: entry.percent }));
  const suggestions = nextUp({ exam, coverage, mastery, limit: 3 });
  if (suggestions.length) {
    card.appendChild(ui.element("h4", "exam-subhead", "Study next"));
    const list = ui.element("div", "exam-next");
    for (const entry of suggestions) {
      const row = ui.element("div", "exam-next-row");
      const copy = ui.element("div", "exam-next-copy");
      copy.appendChild(ui.element("strong", "", entry.chapter));
      copy.appendChild(ui.element("span", "hint", `${entry.subjectName} · ${entry.reason}`));
      row.appendChild(copy);
      const drill = ui.element("button", "button ghost small", "Drill");
      drill.type = "button";
      drill.addEventListener("click", () => {
        preferences.mode = "drill";
        preferences.subjectId = entry.subjectId;
        preferences.chapter = entry.chapter;
        renderExamView();
      });
      row.appendChild(drill);
      list.appendChild(row);
    }
    card.appendChild(list);
  }

  if (coverage.missing.length) {
    card.appendChild(ui.element("h4", "exam-subhead", "Not in your library yet"));
    const list = ui.element("div", "exam-missing");
    const shown = coverage.missing.slice(0, 12);
    for (const entry of shown) {
      list.appendChild(ui.element("span", "exam-missing-item", `${entry.chapter} · ${entry.subjectName}`));
    }
    card.appendChild(list);
    if (coverage.missing.length > shown.length) {
      card.appendChild(ui.element("p", "hint", `and ${coverage.missing.length - shown.length} more chapters.`));
    }
  }
  return card;
}

function renderExamView() {
  const root = $("#exam-panel");
  if (!root) return;
  const preferences = examPreferences();
  const exam = examByIdOrFirst(preferences.examId);
  const coverage = examCoverage(exam);
  root.replaceChildren();

  const packs = ui.element("div", "exam-packs");
  for (const pack of EXAMS) {
    packs.appendChild(
      examTab(pack.id === exam.id, pack.name, () => {
        preferences.examId = pack.id;
        preferences.chapter = "";
        preferences.subjectId = "";
        renderExamView();
      }, pack.full || pack.name),
    );
  }
  root.appendChild(packs);

  const modes = ui.element("div", "exam-tabs");
  for (const mode of MODES) {
    modes.appendChild(
      examTab(mode.id === preferences.mode, mode.name, () => {
        preferences.mode = mode.id;
        renderExamView();
      }, mode.line),
    );
  }
  root.appendChild(modes);

  if (preferences.mode === "coverage") root.appendChild(renderExamCoverage(preferences, exam, coverage));
  else if (preferences.mode === "drill") root.appendChild(renderExamDrill(preferences, exam, coverage));
  else if (preferences.mode === "viva") root.appendChild(renderExamViva(preferences, exam, coverage));
  else root.appendChild(renderExamMock(preferences, exam, coverage));

  const note = document.createElement("details");
  note.className = "exam-note";
  const summary = document.createElement("summary");
  summary.textContent = "Where these numbers come from";
  note.appendChild(summary);
  const body = ui.element("div", "");
  body.appendChild(
    ui.element(
      "p",
      "",
      "Counts, timing and marking are the pattern published by the exam body. Questions are never downloaded: each one is written from a page you added, so the citation points at your own book.",
    ),
  );
  body.appendChild(
    ui.element(
      "p",
      "",
      "No previous-year papers, coaching material or textbook scans are stored or fetched here. Patterns change - check the official page before you rely on them.",
    ),
  );
  const official = OFFICIAL[exam.id];
  if (official) {
    const link = ui.element("a", "text-button", `${exam.name} official page`);
    link.href = official;
    link.target = "_blank";
    link.rel = "noreferrer noopener";
    body.appendChild(link);
  }
  if (exam.check) body.appendChild(ui.element("p", "hint", exam.check));
  note.appendChild(body);
  root.appendChild(note);
}

function examResultCard(entry) {
  const card = ui.element("div", "card exam-result");
  card.appendChild(ui.element("span", "eyebrow", `EXAM MARKING · ${entry.name.toUpperCase()}`));
  card.appendChild(ui.element("h3", "", `${entry.score.marks} / ${entry.score.maxMarks} marks`));
  card.appendChild(
    examFactGrid([
      [entry.score.correct, "right"],
      [entry.score.wrong, "wrong"],
      [entry.score.skipped, "left blank"],
    ]),
  );
  card.appendChild(
    ui.element(
      "p",
      "hint",
      entry.score.negativeMarking
        ? "Negative marking was applied exactly as the exam applies it."
        : "This exam has no negative marking, so an attempt never costs you.",
    ),
  );
  card.appendChild(ui.element("p", "exam-advice", entry.advice));
  const actions = ui.element("div", "exam-actions");
  const back = ui.element("button", "button ghost small", "Back to exam practice");
  back.type = "button";
  back.addEventListener("click", () => setView("exam"));
  actions.appendChild(back);
  card.appendChild(actions);
  return card;
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
  if (quiz.viva) {
    container.appendChild(ui.element("div", "question-prompt viva-prompt", examinerLine(question)));
  } else {
    container.appendChild(ui.element("div", "question-prompt", question.prompt));
  }

  const voiceRow = ui.element("div", "question-voice");
  const env = voiceEnv();
  if (env.speak) {
    const read = ui.element("button", "question-voice-button", "Read aloud");
    read.type = "button";
    read.addEventListener("click", speakCurrentQuestion);
    voiceRow.appendChild(read);
  }
  if (env.listen && question.type !== "mcq" && (quiz.viva || question.type === "short" || question.type === "fill")) {
    const mic = ui.element("button", "question-voice-button mic", "Answer aloud");
    mic.type = "button";
    mic.setAttribute("aria-label", "Answer this question by speaking");
    mic.addEventListener("click", () => void dictateAnswer(mic));
    voiceRow.appendChild(mic);
  }
  if (voiceRow.childNodes.length) container.appendChild(voiceRow);

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
  if (quiz.viva) {
    // The probe updates as the student types or speaks, so a thin answer can be
    // repaired before it is marked. That is the point of a viva.
    const probeNode = ui.element("p", "viva-probe hidden", "");
    const refreshProbe = () => {
      const said = String(state.quizResponses[question.id] || "");
      const probe = probeFor({ question, answer: said, awarded: currentAward(question, said), probes: 0 });
      const line = probe && probe.kind !== "silent" ? probe.line : "";
      probeNode.textContent = line;
      probeNode.classList.toggle("hidden", !line);
    };
    refreshProbe();
    container.appendChild(probeNode);
    const box = container.querySelector(".short-input, .fill-input");
    box?.addEventListener("input", refreshProbe);
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
    if (quiz.viva) {
      const rows = result.perQuestion.map((item) => ({
        question: item.question,
        submitted: item.submitted,
        awarded: item.awarded,
      }));
      result.viva = vivaReport(rows);
    } else if (quiz.examId) {
      const exam = getExam(quiz.examId);
      if (exam) {
        const items = result.perQuestion.map((item) => ({
          subjectId: item.question.subjectId,
          status: item.awarded >= 1 ? "correct" : String(item.submitted || "").trim() ? "wrong" : "skipped",
        }));
        const score = scoreExam(exam, items);
        result.exam = {
          examId: exam.id,
          name: exam.name,
          mode: quiz.examMode || "mock",
          official: OFFICIAL[exam.id] || "",
          score,
          advice: examAdvice(exam, score),
        };
      }
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
  if (result.viva) root.appendChild(vivaCard(result.viva, state.quiz));
  if (result.exam) root.appendChild(examResultCard(result.exam));

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

/**
 * "Today's revision": up to three cited, actionable steps built from cards that
 * are due and topics that were weak in real quiz results. Nothing invented.
 */
function renderRevisionPlan() {
  const host = $("#revision-plan");
  if (!host) return;
  const decks = normalizeDeckCollection(state.studyDecks).decks;
  const today = localDay();
  const dueDeck = decks
    .map((deck) => ({ deck, count: dueCards(deck.cards, deck.progress, today).length }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count)[0];
  const plan = buildRevisionPlan({
    mastery: topicMastery(state.results),
    dueCards: decks.reduce((sum, deck) => sum + dueCards(deck.cards, deck.progress, today).length, 0),
    totalCards: decks.reduce((sum, deck) => sum + deck.cards.length, 0),
    history: state.results,
    streak: currentStreak(state.studyProgress),
    today,
  });
  host.replaceChildren();
  for (const step of plan.steps) {
    const row = ui.element("div", "revision-step");
    row.appendChild(ui.element("span", "revision-step-time", `${step.minutes} min`));
    const copy = ui.element("div", "revision-step-copy");
    copy.appendChild(ui.element("strong", "", step.title));
    copy.appendChild(ui.element("small", "", step.detail));
    row.appendChild(copy);
    const go = ui.element("button", "button ghost small", "Start");
    go.type = "button";
    go.addEventListener("click", () => {
      if (step.action === "review-cards" && dueDeck) openSavedDeck(dueDeck.deck.id);
      else if (step.action === "quiz-topic") {
        setView("quiz");
        const topic = $("#quiz-topic");
        if (topic) {
          topic.value = step.topic || "";
          requestAnimationFrame(() => topic.focus({ preventScroll: false }));
        }
      } else if (step.action === "quiz-mixed") setView("quiz");
      else setView("library");
    });
    row.appendChild(go);
    host.appendChild(row);
  }
  const total = $("#revision-plan-total");
  if (total) total.textContent = plan.steps.length ? `${plan.headline} About ${plan.minutes} minutes in total.` : plan.headline;
  const copyButton = $("#revision-plan-copy");
  if (copyButton && !copyButton.dataset.wired) {
    copyButton.dataset.wired = "1";
    copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(revisionPlanText(state.revisionPlan || plan));
        ui.showToast("Revision plan copied.", "success");
      } catch {
        ui.showToast("Copy is blocked in this browser.", "warning");
      }
    });
  }
  state.revisionPlan = plan;
}

function renderStudyNext() {
  renderRevisionPlan();
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
  renderStyleTiles();
  setSettingsTab(state.settingsTab || "appearance");
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

/**
 * The address and password fields only mean anything for a custom service.
 *
 * They used to be on screen permanently, which is how a student ended up looking
 * at "Endpoint with {q} placeholder" and a URL full of braces in a Settings card
 * they had no reason to open. A field that cannot do anything should not be
 * visible; when it can, it explains itself in one sentence.
 */
function syncCustomSearchFields() {
  const mode = $("#settings-web-mode")?.value || "server";
  const fields = $("#web-custom-fields");
  if (fields) fields.hidden = mode !== "custom";
}

function renderWebSettings() {
  renderWebChoice();
  $("#settings-web-mode").value = state.settings.webMode;
  $("#settings-web-endpoint").value = state.settings.searchEndpoint || "";
  $("#settings-web-token").value = state.settings.searchToken || "";
  syncCustomSearchFields();
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
  renderLanguageGrid();
  const name = languageName(state.settings.language, { native: true });
  const chip = $("#language-chip");
  if (chip) chip.textContent = name;
  const answers = $("#language-answers");
  if (answers) answers.textContent = t("settings.answersIn", { language: name });
}

let languageFilterText = "";

/** Does a language match what was typed? Native name, English name or code. */
// The search rule lives in languages.js so the app and the tests run the same
// code. It used to be copied into the test, which is how "francais" stayed
// unable to find Français for two releases.
function matchesLanguageFilter(language, term) {
  return matchesLanguageQuery(language.code, term);
}

/**
 * Thirty-three languages as a screen of tiles, not a dropdown.
 *
 * Each tile leads with a character from the language's own script, because that
 * is what a student recognises from across the room; the native name sits under
 * it and the English name under that for anyone searching in English. The hidden
 * <select> stays as the single source of truth for the current language and for
 * keyboard and screen-reader users, and the tiles are the same choice, visible.
 */
function renderLanguageGrid() {
  const host = $("#language-grid");
  if (!host) return;
  host.replaceChildren();
  let shown = 0;
  for (const group of languageGroups()) {
    const visible = group.languages.filter((language) => matchesLanguageFilter(language, languageFilterText));
    if (!visible.length) continue;
    shown += visible.length;
    const labelKey = t(group.labelKey);
    const section = ui.element("div", "language-group");
    section.appendChild(ui.element("span", "eyebrow", labelKey && labelKey !== group.labelKey ? labelKey : group.label));
    const tiles = ui.element("div", "language-tiles");
    for (const language of visible) {
      const meta = languageMeta(language.code);
      const active = state.settings.language === language.code;
      const tile = ui.element("button", `language-tile${active ? " active" : ""}`);
      tile.type = "button";
      // A picker where exactly one is chosen behaves as a set of toggle buttons:
      // each one is reachable with Tab and says whether it is the current choice.
      tile.setAttribute("aria-pressed", active ? "true" : "false");
      tile.dataset.language = language.code;
      tile.lang = language.code;
      // The tile shows two scripts, so its accessible name has to spell out
      // both; "తెలుగు" alone is not a language name to an English screen reader.
      // Whether it is the current one is already carried by aria-pressed, which
      // is the state a screen reader announces — no English word needed.
      tile.setAttribute("aria-label", languageLabel(language.code));
      if (meta.dir === "rtl") tile.dir = "rtl";
      tile.title = languageLabel(language.code);
      // Unique on the whole board: "EN" and "ES", not two tiles both reading "E".
      const glyph = languageGlyphFor(language.code);
      tile.appendChild(ui.element("span", `language-glyph${[...glyph].length > 1 ? " wide" : ""}`, glyph));
      tile.appendChild(ui.element("span", "language-name", meta.native));
      if (meta.name && meta.name !== meta.native) tile.appendChild(ui.element("span", "language-latin", meta.name));
      tile.addEventListener("click", () => {
        const select = $("#settings-language");
        if (!select) return;
        if (select.value === language.code) {
          // Tapping the tile you already have used to do nothing at all, which
          // reads as a broken button. Say what is already true instead.
          ui.showToast(t("settings.languageAlready", { language: meta.native }), "info", 2200);
          return;
        }
        select.value = language.code;
        void handleLanguageChange();
      });
      tiles.appendChild(tile);
    }
    section.appendChild(tiles);
    host.appendChild(section);
  }
  // The total comes from the catalogue, never from a number typed into a
  // sentence: the placeholder, the counter and the empty state all agree.
  const total = LANGUAGE_CATALOGUE.length;
  if (!shown) {
    const empty = ui.element("div", "language-empty");
    empty.appendChild(ui.element("p", "", t("settings.languageEmpty", { term: languageFilterText.trim(), count: total })));
    // Telling someone to clear the box is not the same as letting them.
    const showAll = ui.element("button", "button ghost small", t("settings.languageShowAll", { count: total }));
    showAll.type = "button";
    showAll.addEventListener("click", () => {
      languageFilterText = "";
      if ($("#language-filter")) $("#language-filter").value = "";
      renderLanguageGrid();
      $("#language-filter")?.focus({ preventScroll: true });
    });
    empty.appendChild(showAll);
    host.appendChild(empty);
  }
  const count = $("#language-count");
  if (count) {
    count.textContent = shown === total
      ? t("settings.languageCount", { count: total })
      : t("settings.languageCountFiltered", { shown, total });
  }
  const filter = $("#language-filter");
  const placeholder = t("settings.languageFilterPlaceholder", { count: total });
  if (filter && filter.placeholder !== placeholder) filter.placeholder = placeholder;
  const totals = $("#language-count");
  if (totals) totals.dataset.empty = shown ? "no" : "yes";
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
  renderAvatarSettings();
  renderLanguageOptions();
  $("#settings-language").value = state.settings.language;
  $("#settings-theme").value = state.settings.theme;
  $("#settings-profile").value = state.settings.profile;
}

/** Eight swatches in Settings, so the avatar is visible without opening Friends. */
function renderAvatarSettings() {
  const host = $("#settings-avatar-swatches");
  if (!host) return;
  const name = state.account?.username || state.settings.profile || "Student";
  host.replaceChildren(
    renderAvatarSwatches({
      name,
      seed: state.settings.avatar || socialSeed(),
      id: "settings-avatar-options",
      label: "Choose your avatar",
      onPick: async (seed) => {
        state.settings.avatar = seed;
        await saveSettings();
        updateStatus();
        renderAvatarSettings();
        ui.showToast("Avatar saved.", "success");
        // Signed-in students also update the avatar their classmates see.
        if (state.account) {
          try {
            const { social } = await import("./social.js?v=39");
            await social.setAvatar(seed);
            globalThis.__vignanSocialSeed = seed;
            window.dispatchEvent(new CustomEvent("vignan:avatar", { detail: { seed } }));
          } catch {
            // Local choice still applies; the shared one can be retried in Friends.
          }
        }
      },
    }),
  );
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
  // The reader builds a question from the page in front of the student. It fills
  // the composer and stops there: nothing is sent without a tap on Send.
  window.addEventListener("vignan:ask-page", (event) => {
    const input = $("#ask-input");
    if (!input) return;
    input.value = String(event.detail?.question || "");
    setMode("answer");
    setView("ask");
    input.focus({ preventScroll: true });
    ui.showToast("Your question is ready. Edit it or send it.", "info", 3600);
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
  $("#pro-chip")?.addEventListener("click", () => { void disengageProMode(); });
  $("#update-now")?.addEventListener("click", () => { void takeUpdate(); });
  $("#update-later")?.addEventListener("click", () => {
    hideUpdateBanner();
    ui.showToast("Fine — it will wait. Update from Settings whenever you like.", "info", 3600);
  });
  $("#check-updates")?.addEventListener("click", () => { void runUpdateCheck({ userInitiated: true }); });
  $("#run-offline-check")?.addEventListener("click", () => { void checkOfflineReadiness(); });

  $("#ask-form").addEventListener("submit", handleAsk);
  $("#ask-mic")?.addEventListener("click", (event) => void dictateQuestion(event.currentTarget));
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
  $("#depth-row")?.addEventListener("click", (event) => {
    const chip = event.target.closest(".mode-chip[data-depth]");
    if (chip) {
      void setAnswerDepth(chip.dataset.depth);
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

  $("#starter-add")?.addEventListener("click", async () => {
    const button = $("#starter-add");
    ui.setBusy(button, true, "Adding pages…");
    try { await installStarterShelf(); } finally { ui.setBusy(button, false); renderStarterCard(); }
  });
  $("#starter-remove")?.addEventListener("click", () => void removeStarterShelf());
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
  $("#settings-web-mode").addEventListener("change", syncCustomSearchFields);
  $("#appearance-save").addEventListener("click", saveAppearance);
  // The Friends picker saves to the account; mirror it locally so the header,
  // Settings and offline use all agree.
  window.addEventListener("vignan:avatar", (event) => {
    const seed = String(event.detail?.seed || "");
    if (!/^p[0-7]$/.test(seed) || state.settings.avatar === seed) return;
    state.settings.avatar = seed;
    saveSettings()
      .then(() => {
        updateStatus();
        renderAvatarSettings();
      })
      .catch(() => {});
  });
  $("#settings-language").addEventListener("change", handleLanguageChange);
  wireSettingsTabs();
  const languageFilter = $("#language-filter");
  languageFilter?.addEventListener("input", (event) => {
    languageFilterText = event.target.value;
    renderLanguageGrid();
  });
  languageFilter?.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !languageFilter.value) return;
    event.preventDefault();
    languageFilter.value = "";
    languageFilterText = "";
    renderLanguageGrid();
  });
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
