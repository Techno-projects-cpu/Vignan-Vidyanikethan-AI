/**
 * Student accounts for Vignan Vidyanikethan AI.
 *
 * The browser never receives password hashes. Sessions are HttpOnly cookies
 * set by the small Node server; when that server is unavailable (for example
 * a purely static export) the app continues as a guest with local progress.
 */

import * as ui from "./ui.js?v=12";
import { truncate } from "./util.js?v=12";
import { newPasswordProblem } from "./password-policy.js?v=12";

const API_BASE = new URL("../api/", import.meta.url);
const REQUEST_TIMEOUT = 12000;
const USERNAME_RE = /^[a-zA-Z0-9_-]{3,20}$/;
const CSRF_COOKIE = "vignan_csrf";

export function authApiUrl(path = "") {
  return new URL(String(path || "").replace(/^\/+/, ""), API_BASE).toString();
}

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

function requestHeaders(hasBody = false) {
  const headers = { "X-Vignan-Client": "1" };
  if (hasBody) headers["Content-Type"] = "application/json";
  const token = csrfToken();
  if (token) headers["X-CSRF-Token"] = token;
  return headers;
}

export function localDay(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

let csrfRefresh = null;

async function ensureCsrf() {
  if (csrfToken()) return;
  // Share the bootstrap request when two forms/actions start at the same time.
  if (!csrfRefresh) {
    csrfRefresh = request("auth/me").finally(() => { csrfRefresh = null; });
  }
  await csrfRefresh;
  if (!csrfToken()) throw new Error("Cookies are needed to log in. Please enable cookies and try again.");
}

async function request(path, { method = "GET", body, timeout = REQUEST_TIMEOUT } = {}) {
  if (method !== "GET") await ensureCsrf();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(authApiUrl(path), {
      method,
      credentials: "include",
      headers: requestHeaders(Boolean(body)),
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });
    let data = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }
    if (!response.ok || data.ok === false) {
      const error = new Error(data.error || `Account request failed (${response.status}).`);
      error.status = response.status;
      throw error;
    }
    return data;
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("The account server did not respond. Check your connection.");
    if (error instanceof TypeError) throw new Error("Accounts need the Vignan Vidyanikethan AI server. You can keep studying as a guest.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function getSession({ timeout = REQUEST_TIMEOUT } = {}) {
  return request("auth/me", { timeout });
}

export async function register(payload) {
  return request("auth/register", { method: "POST", body: payload });
}

export async function login(payload) {
  return request("auth/login", { method: "POST", body: payload });
}

export async function logout() {
  return request("auth/logout", { method: "POST", body: {} });
}

export async function getLeaderboard() {
  const data = await request("leaderboard");
  return data.leaderboard || [];
}

export async function syncProgress(result = {}) {
  const payload = {
    topic: truncate(result.topic || "Chapter quiz", 120),
    percent: Number(result.percent) || 0,
    score: Number(result.score) || 0,
    total: Number(result.total) || 0,
    xp: Number(result.xp) || 0,
    day: localDay(result.date ? new Date(result.date) : new Date()),
  };
  const data = await request("progress", { method: "POST", body: { result: payload } });
  return data.user || null;
}

export function readReferral() {
  try {
    const params = new URL(location.href).searchParams;
    return (params.get("ref") || params.get("invite") || "").trim().slice(0, 32);
  } catch {
    return "";
  }
}

export function clearReferral() {
  try {
    const url = new URL(location.href);
    url.searchParams.delete("ref");
    url.searchParams.delete("invite");
    history.replaceState(null, "", url);
  } catch {
    // Non-browser or file URL; nothing to clean.
  }
}

export function inviteLink(refCode) {
  if (!refCode) return "";
  try {
    const url = new URL(location.href);
    url.searchParams.set("ref", refCode);
    url.searchParams.set("view", "progress");
    return url.toString();
  } catch {
    return "";
  }
}

export function genderLabel(value) {
  const labels = {
    girl: "Girl",
    boy: "Boy",
    other: "Other / non-binary",
    "prefer-not": "Prefer not to say",
  };
  return labels[value] || "Private";
}

function field(labelText, control, { className = "", hint = "" } = {}) {
  const wrapper = ui.element("label", `auth-field ${className}`.trim());
  wrapper.appendChild(ui.element("span", "auth-label", labelText));
  wrapper.appendChild(control);
  if (hint) wrapper.appendChild(ui.element("small", "auth-hint", hint));
  return wrapper;
}

function input(type, id, { placeholder = "", autocomplete = "", min = "", max = "", inputmode = "" } = {}) {
  const node = ui.element("input", "auth-input");
  node.type = type;
  node.id = id;
  node.name = id;
  if (placeholder) node.placeholder = placeholder;
  if (autocomplete) node.autocomplete = autocomplete;
  if (min !== "") node.min = String(min);
  if (max !== "") node.max = String(max);
  if (inputmode) node.inputMode = inputmode;
  return node;
}

function errorNode() {
  const node = ui.element("div", "auth-error");
  node.setAttribute("role", "alert");
  node.setAttribute("aria-live", "assertive");
  return node;
}

function accountView({ account, onLogout, onViewProgress }) {
  const wrap = ui.element("div", "auth-account");
  const avatar = ui.element("div", "auth-avatar large", (account.username || "V").charAt(0).toUpperCase());
  wrap.appendChild(avatar);
  wrap.appendChild(ui.element("h3", "", `@${account.username}`));
  wrap.appendChild(
    ui.element(
      "p",
      "hint",
      `${account.ageBand || "Private"} age band · gender kept private · joined ${new Date(account.createdAt || Date.now()).toLocaleDateString()}`,
    ),
  );

  const stats = ui.element("div", "auth-stats");
  for (const [label, value] of [
    ["XP", account.xp || 0],
    ["Streak", `${account.streak || 0} 🔥`],
    ["Best", `${account.best || 0}%`],
    ["Friends", account.referrals || 0],
  ]) {
    const cell = ui.element("div", "auth-stat");
    cell.appendChild(ui.element("strong", "", String(value)));
    cell.appendChild(ui.element("span", "", label));
    stats.appendChild(cell);
  }
  wrap.appendChild(stats);

  const invite = ui.element("div", "invite-row");
  const link = ui.element("input", "auth-input");
  link.readOnly = true;
  link.value = inviteLink(account.refCode);
  link.setAttribute("aria-label", "Your invite link");
  const copy = ui.element("button", "button ghost small", "Copy invite");
  copy.type = "button";
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(link.value);
      ui.showToast("Invite link copied. Send it to your friends!", "success");
    } catch {
      link.select();
      ui.showToast("Select and copy the invite link.", "warning");
    }
  });
  invite.append(link, copy);
  wrap.appendChild(invite);
  wrap.appendChild(
    ui.element(
      "p",
      "hint",
      `Your squad code is ${account.refCode || "VIGNAN-YOU"}. Friends who join with it count toward your referrals.`,
    ),
  );

  const board = ui.element("button", "button ghost full", "View class leaderboard");
  board.type = "button";
  board.addEventListener("click", () => {
    ui.closeModal();
    onViewProgress?.();
  });
  wrap.appendChild(board);

  const logoutButton = ui.element("button", "button ghost danger full", "Log out");
  logoutButton.type = "button";
  logoutButton.addEventListener("click", async () => {
    ui.setBusy(logoutButton, true, "Logging out…");
    try {
      await logout();
      ui.closeModal();
      await onLogout?.(null);
      ui.showToast("You have been logged out.", "info");
      window.dispatchEvent(new CustomEvent("vignan:auth-required", { detail: { mode: "login" } }));
    } catch (error) {
      ui.showToast(error.message, "error");
    } finally {
      ui.setBusy(logoutButton, false);
    }
  });
  wrap.appendChild(logoutButton);
  return wrap;
}

function formView({ initialTab, referral, onAuthenticated }) {
  let tab = initialTab === "register" ? "register" : "login";
  const wrap = ui.element("div", "auth-modal");
  const hero = ui.element("div", "auth-hero");
  hero.appendChild(ui.element("div", "auth-avatar", "V"));
  const heroCopy = ui.element("div", "auth-hero-copy");
  heroCopy.appendChild(ui.element("strong", "", "Join the Vignan squad"));
  heroCopy.appendChild(
    ui.element("p", "", "Save your streak, climb the class leaderboard and share edit-style result videos."),
  );
  hero.appendChild(heroCopy);
  wrap.appendChild(hero);

  const tabs = ui.element("div", "auth-tabs");
  tabs.setAttribute("role", "tablist");
  const loginTab = ui.element("button", "auth-tab", "Log in");
  loginTab.type = "button";
  loginTab.dataset.tab = "login";
  const registerTab = ui.element("button", "auth-tab", "Register");
  registerTab.type = "button";
  registerTab.dataset.tab = "register";
  tabs.append(loginTab, registerTab);
  wrap.appendChild(tabs);

  const form = ui.element("form", "auth-form");
  form.noValidate = true;
  const username = input("text", "auth-username", {
    placeholder: "e.g. ananya_08",
    autocomplete: "username",
  });
  const password = input("password", "auth-password", {
    placeholder: "At least 10 characters",
    autocomplete: "new-password",
  });
  const confirm = input("password", "auth-confirm", {
    placeholder: "Repeat your password",
    autocomplete: "new-password",
  });
  const age = input("number", "auth-age", {
    placeholder: "Your age",
    min: 5,
    max: 25,
    inputmode: "numeric",
  });
  const gender = ui.element("select", "auth-input");
  gender.id = "auth-gender";
  gender.name = "auth-gender";
  for (const [value, label] of [
    ["", "Choose an option"],
    ["girl", "Girl"],
    ["boy", "Boy"],
    ["other", "Other / non-binary"],
    ["prefer-not", "Prefer not to say"],
  ]) {
    const option = ui.element("option", "", label);
    option.value = value;
    gender.appendChild(option);
  }
  const guardianLabel = ui.element("label", "auth-check register-only");
  const guardian = ui.element("input");
  guardian.type = "checkbox";
  guardian.id = "auth-guardian";
  guardianLabel.append(guardian, ui.element("span", "", "I have my parent or guardian's permission to join."));
  guardianLabel.classList.add("hidden");

  const ref = input("text", "auth-referral", {
    placeholder: "Optional friend code",
    autocomplete: "off",
  });
  ref.value = referral || "";

  const registerFields = [
    field("Confirm password", confirm, { className: "register-only" }),
    field("Age", age, {
      className: "register-only",
      hint: "Only an age band is stored. If you are under 13, ask a parent or guardian first.",
    }),
    field("Gender", gender, { className: "register-only", hint: "Private. Never shown on the leaderboard." }),
    guardianLabel,
    field("Friend's invite code", ref, { className: "register-only" }),
  ];
  form.appendChild(field("Username", username, {
    hint: "3–20 letters, numbers, _ or -. Use a nickname.",
  }));
  form.appendChild(field("Password", password));
  registerFields.forEach((node) => form.appendChild(node));

  const error = errorNode();
  form.appendChild(error);
  const submit = ui.element("button", "button primary full", "Create my account");
  submit.type = "submit";
  form.appendChild(submit);
  wrap.appendChild(form);

  const footer = ui.element("div", "auth-footer");
  const guest = ui.element("button", "text-button", "Continue as guest");
  guest.type = "button";
  guest.addEventListener("click", () => ui.closeModal());
  footer.appendChild(guest);
  footer.appendChild(
    ui.element(
      "p",
      "hint",
      "Passwords are hashed. Use a unique password or passphrase. Exact age and gender stay private.",
    ),
  );
  wrap.appendChild(footer);

  function syncTab() {
    const isRegister = tab === "register";
    registerTab.classList.toggle("active", isRegister);
    loginTab.classList.toggle("active", !isRegister);
    registerTab.setAttribute("aria-selected", String(isRegister));
    loginTab.setAttribute("aria-selected", String(!isRegister));
    wrap.querySelectorAll(".register-only").forEach((node) => {
      if (node === guardianLabel) return;
      node.classList.toggle("hidden", !isRegister);
    });
    username.required = true;
    confirm.required = isRegister;
    age.required = isRegister;
    gender.required = isRegister;
    password.autocomplete = isRegister ? "new-password" : "current-password";
    submit.textContent = isRegister ? "Create my account" : "Log in";
    error.textContent = "";
    syncGuardian();
  }

  function syncGuardian() {
    const under13 = tab === "register" && Number(age.value) > 0 && Number(age.value) < 13;
    guardianLabel.classList.toggle("hidden", !under13);
    guardian.required = under13;
  }

  registerTab.addEventListener("click", () => {
    tab = "register";
    syncTab();
  });
  loginTab.addEventListener("click", () => {
    tab = "login";
    syncTab();
  });
  age.addEventListener("input", syncGuardian);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    error.textContent = "";
    const isRegister = tab === "register";
    if (isRegister) {
      if (!USERNAME_RE.test(username.value.trim())) {
        error.textContent = "Use 3–20 letters, numbers, underscores or hyphens for your username.";
        username.focus();
        return;
      }
      if (password.value !== confirm.value) {
        error.textContent = "Your passwords do not match.";
        confirm.focus();
        return;
      }
      const problem = newPasswordProblem(password.value);
      if (problem) {
        error.textContent = problem;
        password.focus();
        return;
      }
      const years = Number(age.value);
      if (!Number.isInteger(years) || years < 5 || years > 25) {
        error.textContent = "Enter an age between 5 and 25.";
        age.focus();
        return;
      }
      if (!gender.value) {
        error.textContent = "Choose a gender option, or select “Prefer not to say”.";
        gender.focus();
        return;
      }
      if (years < 13 && !guardian.checked) {
        error.textContent = "Students under 13 need a parent or guardian's permission.";
        guardian.focus();
        return;
      }
    }
    ui.setBusy(submit, true, isRegister ? "Creating…" : "Logging in…");
    try {
      const data = isRegister
        ? await register({
            username: username.value.trim(),
            password: password.value,
            age: Number(age.value),
            gender: gender.value,
            guardianConsent: guardian.checked,
            referral: ref.value.trim(),
          })
        : await login({ username: username.value.trim(), password: password.value });
      ui.closeModal();
      onAuthenticated?.(data.user);
      ui.showToast(
        isRegister ? `Welcome to the squad, @${data.user.username}!` : `Welcome back, @${data.user.username}!`,
        "success",
      );
    } catch (requestError) {
      error.textContent = requestError.message || "Could not reach the account server.";
    } finally {
      ui.setBusy(submit, false);
    }
  });

  syncTab();
  return wrap;
}

/**
 * Open the Roblox-inspired account modal.
 * If `account` is null, a tabbed Log in / Register form is shown; otherwise a
 * profile with referral link and logout is shown.
 */
export function openAuthModal({
  account = null,
  mode = "login",
  referral = "",
  onAuthenticated = () => {},
  onLogout = () => {},
  onViewProgress = () => {},
} = {}) {
  const content = account
    ? accountView({ account, onLogout, onViewProgress })
    : formView({ initialTab: mode, referral, onAuthenticated });
  ui.openModal({
    title: account ? "Your Vignan squad account" : "Log in or register",
    content,
    className: "auth-dialog",
    wide: false,
  });
}
