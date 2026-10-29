/**
 * A small, responsive entry screen. The larger study app is loaded only after
 * a student logs in, registers, or chooses guest mode. Guest mode is available
 * even when the account server is asleep or the device is offline.
 */
import { clearReferral, getSession, login, register } from "./auth.js?v=30";
import { newPasswordProblem } from "./password-policy.js?v=30";
import { setupStartup } from "./startup.js?v=30";
import { showToast } from "./ui.js?v=30";

const GUEST_SESSION_KEY = "vignan_guest_session";
const USERNAME_RE = /^[a-zA-Z0-9_-]{3,20}$/;
const params = new URL(location.href).searchParams;
const gate = document.getElementById("auth-gate");
const loginForm = document.getElementById("gate-login-form");
const registerForm = document.getElementById("gate-register-form");
const loginTab = document.getElementById("gate-login-tab");
const registerTab = document.getElementById("gate-register-tab");
let startupStorage = null;
try { startupStorage = globalThis.sessionStorage; } catch { /* Private browsing can block the getter. */ }
const startup = setupStartup({
  screen: document.getElementById("startup-screen"), gate,
  enter: document.getElementById("startup-enter"), skip: document.getElementById("startup-skip"),
  focusTarget: () => document.getElementById(registerForm.hidden ? "gate-login-username" : "gate-register-username"),
  storage: startupStorage,
});
let appModulePromise;
let appStarted = false;
let unlocking = false;
let gateGeneration = 0;
let flowGeneration = 0;
let interacted = false;
let pendingAuth = null;

// app.js can also be loaded directly in development; the entry screen owns
// initialization when it is present.
globalThis.__VIGNAN_BOOT__ = true;

function guestChosen() {
  try { return sessionStorage.getItem(GUEST_SESSION_KEY) === "1"; } catch { return false; }
}
function rememberGuest() {
  try { sessionStorage.setItem(GUEST_SESSION_KEY, "1"); } catch { /* storage may be disabled */ }
}
function forgetGuest() {
  try { sessionStorage.removeItem(GUEST_SESSION_KEY); } catch { /* storage may be disabled */ }
}
function setStatus(message) {
  const status = document.getElementById("gate-status");
  if (status) status.textContent = message;
}
function setGlobalError(message = "") {
  const node = document.getElementById("gate-global-error");
  if (node) node.textContent = message;
}
function setError(form, message = "", field = null) {
  const node = form.querySelector(".gate-error");
  if (node) node.textContent = message;
  form.querySelectorAll("[aria-invalid]").forEach((element) => element.removeAttribute("aria-invalid"));
  if (field && message) {
    field.setAttribute("aria-invalid", "true");
    field.focus({ preventScroll: false });
  }
}
function setBusy(button, busy, label = "Working…") {
  if (!button) return;
  if (busy) {
    button.dataset.originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = label;
  } else {
    button.disabled = false;
    if (button.dataset.originalLabel) button.textContent = button.dataset.originalLabel;
    delete button.dataset.originalLabel;
  }
}
function cancelPendingAuth() {
  const pending = pendingAuth;
  pendingAuth = null;
  if (pending) {
    pending.controller.abort();
    setBusy(pending.button, false);
  }
  return pending?.kind || "";
}
function beginAuthRequest(button, kind, label) {
  cancelPendingAuth();
  const controller = new AbortController();
  pendingAuth = { controller, button, kind };
  setBusy(button, true, label);
  return controller;
}
function finishAuthRequest(controller) {
  if (pendingAuth?.controller === controller) {
    setBusy(pendingAuth.button, false);
    pendingAuth = null;
  }
}
function selectTab(mode, { focus = false } = {}) {
  const isRegister = mode === "register";
  loginTab.setAttribute("aria-selected", String(!isRegister));
  registerTab.setAttribute("aria-selected", String(isRegister));
  loginTab.tabIndex = isRegister ? -1 : 0;
  registerTab.tabIndex = isRegister ? 0 : -1;
  loginForm.hidden = isRegister;
  registerForm.hidden = !isRegister;
  setGlobalError();
  if (focus) (isRegister ? registerTab : loginTab).focus({ preventScroll: true });
}
function clearPasswords() {
  for (const id of ["gate-login-password", "gate-register-password", "gate-register-confirm"]) {
    const input = document.getElementById(id);
    if (input) { input.value = ""; input.type = "password"; }
  }
  document.querySelectorAll(".gate-toggle").forEach((button) => {
    button.textContent = "Show";
    button.setAttribute("aria-label", "Show password");
    button.setAttribute("aria-pressed", "false");
  });
}
function syncGuardian() {
  const age = document.getElementById("gate-register-age");
  const row = document.getElementById("gate-guardian-row");
  const consent = document.getElementById("gate-guardian");
  const years = Number(age.value);
  const needed = years > 0 && years < 13;
  row.hidden = !needed;
  consent.required = needed;
  if (!needed) consent.checked = false;
}
function removeAuthParameter() {
  try {
    const url = new URL(location.href);
    url.searchParams.delete("auth");
    history.replaceState(null, "", url);
  } catch { /* optional URL cleanup */ }
}
function loadApp() {
  if (!appModulePromise) {
    appModulePromise = import("./app.js?v=30").catch((error) => {
      appModulePromise = null;
      throw error;
    });
  }
  return appModulePromise;
}
function showGate(mode = "login", { focus = true } = {}) {
  gateGeneration += 1;
  flowGeneration += 1;
  cancelPendingAuth();
  interacted = false;
  document.body.classList.add("auth-locked");
  gate.hidden = false;
  gate.removeAttribute("aria-hidden");
  gate.scrollTop = 0;
  setStatus("");
  setGlobalError();
  selectTab(mode, { focus });
}
async function unlock({ user = null, guest = false } = {}) {
  if (unlocking) return;
  unlocking = true;
  const previousInert = gate.inert;
  gate.inert = true; // Prevent a second entry choice while the workspace starts.
  gateGeneration += 1; // A late session check must never reopen the gate.
  setStatus("Preparing your study space…");
  try {
    const module = await loadApp();
    if (!appStarted) {
      await module.initApp({ initialUser: user, guest, sessionKnown: Boolean(user) });
      appStarted = true;
    } else {
      await module.setAccountSession(user, { guest });
    }
    clearPasswords();
    gate.hidden = true;
    gate.setAttribute("aria-hidden", "true");
    document.body.classList.remove("auth-locked");
    requestAnimationFrame(() => document.getElementById("main")?.focus({ preventScroll: true }));
  } catch (error) {
    console.error("[vignan-ai] Could not start the study workspace", error);
    showGate("login", { focus: false });
    setGlobalError("The study space couldn't start. Check your connection and try again.");
  } finally {
    gate.inert = previousInert;
    unlocking = false;
  }
}

function bindForms() {
  const markInteracted = () => { interacted = true; };
  gate.addEventListener("input", markInteracted);
  gate.addEventListener("pointerdown", markInteracted);
  gate.addEventListener("keydown", markInteracted);

  function chooseTab(mode, { focus = false } = {}) {
    const changing = mode === "register" ? registerForm.hidden : loginForm.hidden;
    if (changing) {
      flowGeneration += 1;
      const cancelled = cancelPendingAuth();
      if (cancelled) setStatus(cancelled === "register" ? "Registration may have completed; try logging in if your username is taken." : "");
    }
    selectTab(mode, { focus });
  }
  for (const [tab, mode] of [[loginTab, "login"], [registerTab, "register"]]) {
    tab.addEventListener("click", () => chooseTab(mode));
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const target = event.key === "Home" ? "login" : event.key === "End" ? "register" : mode === "login" ? "register" : "login";
      chooseTab(target, { focus: true });
    });
  }

  document.querySelectorAll(".gate-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      const input = button.parentElement.querySelector("input");
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      button.textContent = show ? "Hide" : "Show";
      button.setAttribute("aria-label", show ? "Hide password" : "Show password");
      button.setAttribute("aria-pressed", String(show));
      input.focus({ preventScroll: true });
    });
  });
  document.getElementById("gate-register-age").addEventListener("input", syncGuardian);

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    interacted = true;
    setError(loginForm);
    const username = document.getElementById("gate-login-username");
    const password = document.getElementById("gate-login-password");
    if (!USERNAME_RE.test(username.value.trim())) {
      setError(loginForm, "Use 3–20 letters, numbers, underscores or hyphens.", username);
      return;
    }
    if (!password.value) {
      setError(loginForm, "Enter your password.", password);
      return;
    }
    const submit = loginForm.querySelector('[type="submit"]');
    const flow = ++flowGeneration;
    const controller = beginAuthRequest(submit, "login", "Logging in…");
    try {
      const data = await login({ username: username.value.trim(), password: password.value }, { signal: controller.signal });
      if (flow !== flowGeneration) return;
      if (!data.user) throw new Error("The account server returned an incomplete response.");
      forgetGuest();
      clearReferral();
      removeAuthParameter();
      await unlock({ user: data.user });
    } catch (error) {
      if (flow === flowGeneration) setError(loginForm, error.message || "Couldn't log in. Try again.");
    } finally {
      finishAuthRequest(controller);
    }
  });

  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    interacted = true;
    setError(registerForm);
    const username = document.getElementById("gate-register-username");
    const password = document.getElementById("gate-register-password");
    const confirm = document.getElementById("gate-register-confirm");
    const age = document.getElementById("gate-register-age");
    const gender = document.getElementById("gate-register-gender");
    const guardian = document.getElementById("gate-guardian");
    const referral = document.getElementById("gate-referral");
    if (!USERNAME_RE.test(username.value.trim())) {
      setError(registerForm, "Use 3–20 letters, numbers, underscores or hyphens.", username);
      return;
    }
    const problem = newPasswordProblem(password.value);
    if (problem) { setError(registerForm, problem, password); return; }
    if (password.value !== confirm.value) {
      setError(registerForm, "Your passwords do not match.", confirm);
      return;
    }
    const years = Number(age.value);
    if (!Number.isInteger(years) || years < 5 || years > 25) {
      setError(registerForm, "Enter an age between 5 and 25.", age);
      return;
    }
    if (years < 13 && !guardian.checked) {
      setError(registerForm, "Students under 13 need a parent or guardian's permission.", guardian);
      return;
    }
    const submit = registerForm.querySelector('[type="submit"]');
    const flow = ++flowGeneration;
    const controller = beginAuthRequest(submit, "register", "Creating account…");
    try {
      const data = await register({
        username: username.value.trim(), password: password.value, age: years,
        gender: gender.value, guardianConsent: guardian.checked, referral: referral.value.trim(),
      }, { signal: controller.signal });
      if (flow !== flowGeneration) return;
      if (!data.user) throw new Error("The account server returned an incomplete response.");
      forgetGuest();
      clearReferral();
      removeAuthParameter();
      await unlock({ user: data.user });
    } catch (error) {
      if (flow === flowGeneration) setError(registerForm, error.message || "Couldn't create the account. Try again.");
    } finally {
      finishAuthRequest(controller);
    }
  });

  const guest = document.getElementById("gate-guest-button");
  guest.addEventListener("click", async () => {
    interacted = true;
    flowGeneration += 1;
    const cancelled = cancelPendingAuth();
    rememberGuest();
    removeAuthParameter();
    setBusy(guest, true, "Opening…");
    await unlock({ guest: true });
    setBusy(guest, false);
    if (cancelled === "register") {
      showToast("Registration may already have completed. Try logging in later if your username is taken.", "info", 8000);
    }
  });
  loginForm.querySelector('[type="submit"]').disabled = false;
  registerForm.querySelector('[type="submit"]').disabled = false;
  guest.disabled = false;
}

async function boot() {
  bindForms();
  const referral = (params.get("ref") || params.get("invite") || "").trim().slice(0, 32);
  if (referral) {
    document.getElementById("gate-referral").value = referral;
    document.getElementById("gate-referral-details").open = true;
  }
  syncGuardian();
  const forceGate = params.has("auth") || Boolean(referral);
  const requestedMode = params.get("auth") === "register" || referral ? "register" : "login";
  selectTab(requestedMode);

  if (!forceGate && guestChosen()) {
    unlock({ guest: true });
  } else if (!forceGate) {
    const generation = gateGeneration;
    setStatus("Checking your session…");
    try {
      const session = await getSession({ timeout: 5000 });
      if (generation !== gateGeneration) return;
      if (session.user && !interacted) await unlock({ user: session.user });
      else {
        setStatus(session.accountsAvailable === false ? "Accounts are unavailable right now. You can continue as a guest." : "");
        if (!interacted) startup.show();
      }
    } catch {
      if (generation === gateGeneration && !interacted) {
        setStatus("Accounts may be offline. Guest mode is still available.");
        startup.show();
      }
    }
  } else {
    startup.show();
  }

  // Prefetch only on devices that have not requested data savings. No app
  // initialization or textbook indexing happens until the user continues.
  if (!navigator.connection?.saveData) {
    const prefetch = () => loadApp().catch(() => {});
    if ("requestIdleCallback" in window) window.requestIdleCallback(prefetch, { timeout: 1500 });
    else setTimeout(prefetch, 500);
  }
}

window.addEventListener("vignan:auth-required", (event) => {
  forgetGuest();
  showGate(event.detail?.mode === "register" ? "register" : "login");
});
boot();
