/**
 * Operator console for Vignan Vidyanikethan AI.
 *
 * One school runs this deployment, so one person has to be able to see the
 * account records, export a backup and answer a guardian asking what is held
 * about their child. That is a real operational need, and pretending otherwise
 * would just mean the operator does it badly, in Supabase's SQL editor, with
 * no audit trail.
 *
 * So the console exists, with hard limits baked into the design:
 *
 *   - It is **off unless the operator sets a long secret** in the environment.
 *     No token, no console; a short token, no console.
 *   - It shows **account records only**: username, age band, gender, signup
 *     date, progress figures. Never a password, never a hash, never a session,
 *     and it cannot log in as anybody.
 *   - It **cannot read books, chats, decks or answers**, because those never
 *     leave the student's browser in the first place. There is nothing to
 *     expose.
 *   - Every visit and every export writes an audit line to the server log.
 *   - Sessions are signed with a key derived from the token, so rotating the
 *     token in Render logs every existing console session out immediately.
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "vignan_admin";
export const ADMIN_TTL_MS = 8 * 60 * 60 * 1000;
/** Anything shorter is a guessable password, not an operator secret. */
export const ADMIN_MIN_TOKEN_LENGTH = 24;

const sha256 = (value) => createHash("sha256").update(String(value), "utf8").digest();
const hex = (value) => createHash("sha256").update(String(value), "utf8").digest("hex");

/** Constant-time comparison of two secrets of any length. */
export function secretsMatch(left, right) {
  const a = sha256(left);
  const b = sha256(right);
  return timingSafeEqual(a, b);
}

/**
 * The configured operator token, or "" when the console is off.
 * Accepted names, so an operator can use whichever reads best to them.
 */
export function adminTokenFromEnv(env = process.env) {
  for (const name of ["STUDY_AI_ADMIN_TOKEN", "VIGNAN_AI_ADMIN_TOKEN", "ADMIN_TOKEN"]) {
    const value = String(env[name] ?? "").trim();
    if (value) return value;
  }
  return "";
}

/** Whether the console may be used, and why not if it may not. */
export function adminState(env = process.env) {
  const token = adminTokenFromEnv(env);
  if (!token) {
    return {
      enabled: false,
      reason: "Set STUDY_AI_ADMIN_TOKEN in the Render environment to turn the operator console on.",
    };
  }
  if (token.length < ADMIN_MIN_TOKEN_LENGTH) {
    return {
      enabled: false,
      reason: `STUDY_AI_ADMIN_TOKEN is too short. Use at least ${ADMIN_MIN_TOKEN_LENGTH} characters, ideally ${64}.`,
    };
  }
  return { enabled: true, reason: "", token };
}

/** Check a token typed into the login form. */
export function verifyAdminToken(input, token) {
  const candidate = String(input || "");
  if (!token || !candidate) return false;
  if (candidate.length > 512) return false;
  return secretsMatch(candidate, token);
}

/**
 * Sign a session cookie with a key derived from the operator token.
 *
 * Value layout: `<expiresAt>.<mac>`. Nothing secret is stored in the cookie,
 * and rotating the token changes the key, which invalidates every session.
 */
export function signAdminSession(token, now = Date.now(), ttlMs = ADMIN_TTL_MS) {
  const expires = now + ttlMs;
  const mac = createHmac("sha256", sha256(token)).update(`admin.${expires}`).digest("hex");
  return `${expires}.${mac}`;
}

/** True when the cookie is well-formed, unexpired and correctly signed. */
export function verifyAdminSession(value, token, now = Date.now()) {
  const raw = String(value || "");
  if (!token || !raw) return false;
  const [expiresRaw, mac] = raw.split(".");
  if (!/^\d{10,16}$/.test(expiresRaw || "") || !/^[a-f0-9]{64}$/.test(mac || "")) return false;
  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || expires <= now) return false;
  const expected = createHmac("sha256", sha256(token)).update(`admin.${expires}`).digest("hex");
  return secretsMatch(mac, expected);
}

/**
 * A CSRF token for the console's plain HTML forms, which cannot send headers.
 * Derived from the session cookie, so it is per-session and needs no storage.
 */
export function adminFormToken(sessionValue) {
  return createHmac("sha256", sha256(sessionValue)).update("admin.form").digest("hex").slice(0, 40);
}

export function adminFormTokenMatches(input, sessionValue) {
  const expected = adminFormToken(sessionValue);
  return Boolean(input) && secretsMatch(String(input), expected);
}

/** Headers for the console: never cached, never indexed, never framed twice. */
export function adminHeaders(extra = {}) {
  return {
    "Cache-Control": "no-store, max-age=0",
    "X-Robots-Tag": "noindex, nofollow",
    "Referrer-Policy": "no-referrer",
    ...extra,
  };
}

export function adminCookieHeader({ secure = false, partitioned = false, value = "", clear = false } = {}) {
  const parts = [
    `${ADMIN_COOKIE}=${clear ? "" : encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    `SameSite=${partitioned ? "None" : "Strict"}`,
    `Max-Age=${clear ? 0 : Math.floor(ADMIN_TTL_MS / 1000)}`,
  ];
  if (secure) parts.push("Secure");
  if (partitioned) parts.push("Partitioned");
  return parts.join("; ");
}

/** One audit line per console action, to the server log the school can read. */
export function auditLog(action, details = {}) {
  const fields = Object.entries(details)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}=${String(value).replace(/\s+/g, "_").slice(0, 80)}`)
    .join(" ");
  console.log(`[vignan-admin] ${action}${fields ? ` ${fields}` : ""} at=${new Date().toISOString()}`);
}

/** Settings an operator needs to see when the console is off. */
export const ADMIN_HELP = `Generate a token on your own machine (never in a chat, never in Git):

  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

Paste it into the Render environment as STUDY_AI_ADMIN_TOKEN, save, and wait for
the redeploy. Then open /admin and paste the same value once. Rotating the token
logs every console session out, which is also how you revoke access if a laptop
is lost.`;

/** Escape untrusted text for HTML. */
export const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** CSV cell: quoted, doubled quotes, and never interpreted as a formula. */
export function csvCell(value) {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function accountsToCsv(rows = []) {
  const columns = [
    ["username", (row) => row.username],
    ["age band", (row) => row.ageBand],
    ["gender", (row) => row.gender],
    ["created", (row) => row.createdAt],
    ["quizzes", (row) => row.quizzes],
    ["average", (row) => row.average],
    ["xp", (row) => row.xp],
    ["streak", (row) => row.streak],
    ["best streak", (row) => row.bestStreak],
    ["referrals", (row) => row.referrals],
  ];
  const lines = [columns.map(([name]) => csvCell(name)).join(",")];
  for (const row of rows) lines.push(columns.map(([, pick]) => csvCell(pick(row))).join(","));
  return `${lines.join("\n")}\n`;
}

/** The shape of the JSON backup. Explicit fields: nothing new leaks by default. */
export function accountsToBackup(rows = [], meta = {}) {
  return {
    product: "Vignan Vidyanikethan AI",
    kind: "account-records-backup",
    generatedAt: new Date().toISOString(),
    note: "Account records only. Passwords are held by Supabase Auth and are not included. Books, chats, decks and answers never leave a student's browser and cannot be exported.",
    ...meta,
    count: rows.length,
    accounts: rows.map((row) => ({
      username: row.username,
      ageBand: row.ageBand,
      gender: row.gender,
      createdAt: row.createdAt,
      quizzes: row.quizzes,
      average: row.average,
      xp: row.xp,
      streak: row.streak,
      bestStreak: row.bestStreak,
      referrals: row.referrals,
    })),
  };
}

function shell({ title, body, description }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark light">
  <meta name="robots" content="noindex, nofollow">
  <meta name="description" content="${escapeHtml(description || "Operator console.")}">
  <title>${escapeHtml(title)}</title>
  <link rel="icon" href="/icons/icon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/styles-legal.css">
  <style>
    .admin-main { max-width: 1120px; margin: 0 auto; padding: 56px 0 80px; }
    .admin-main h1 { margin: 18px 0 10px; }
    .admin-lede { max-width: 640px; color: #cfcfcf; font-size: 15px; line-height: 1.75; }
    .admin-card { border: 1px solid #383838; padding: 22px; margin: 26px 0; }
    .admin-card h2 { margin: 0 0 10px; font-size: 18px; }
    .admin-card p { color: #c6c6c6; font-size: 13.5px; line-height: 1.7; }
    .admin-facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); border: 1px solid #383838; margin: 22px 0; }
    .admin-facts div { padding: 14px 16px; border-right: 1px solid #383838; border-bottom: 1px solid #383838; }
    .admin-facts span { display: block; color: #8e8e8e; font-size: 9.5px; letter-spacing: .12em; text-transform: uppercase; }
    .admin-facts strong { display: block; margin-top: 6px; font-size: 15px; }
    form.admin-form { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end; margin: 18px 0 0; }
    label.admin-label { display: grid; gap: 6px; flex: 1 1 260px; color: #b9b9b9; font-size: 10px; letter-spacing: .12em; text-transform: uppercase; }
    input[type="password"], input[type="search"] { padding: 12px 14px; border: 1px solid #4a4a4a; background: #0d0d0d; color: #f2f2f2; font: inherit; font-size: 14px; }
    input:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
    button, .admin-button { padding: 12px 18px; border: 1px solid #f2f2f2; background: #f2f2f2; color: #080808; font: 750 11px system-ui, sans-serif; letter-spacing: .1em; text-transform: uppercase; cursor: pointer; text-decoration: none; display: inline-block; }
    button:hover, .admin-button:hover { background: #fff; }
    .admin-button.secondary, button.secondary { background: transparent; color: #f2f2f2; border-color: #4a4a4a; }
    .admin-button.secondary:hover, button.secondary:hover { background: #1a1a1a; }
    table.admin-table { width: 100%; border-collapse: collapse; margin: 18px 0 0; font-size: 12.5px; }
    table.admin-table th { text-align: left; padding: 10px; border-bottom: 1px solid #4a4a4a; color: #9a9a9a; font-size: 9.5px; letter-spacing: .1em; text-transform: uppercase; white-space: nowrap; }
    table.admin-table td { padding: 10px; border-bottom: 1px solid #262626; color: #ddd; white-space: nowrap; }
    table.admin-table td.user { color: #fff; font-weight: 650; }
    .admin-scroll { overflow-x: auto; }
    .admin-note { color: #9a9a9a; font-size: 12px; line-height: 1.7; }
    .admin-banner { border: 1px solid #4a4a4a; border-left: 3px solid #fff; padding: 14px 16px; margin: 20px 0; color: #dcdcdc; font-size: 13px; line-height: 1.7; }
    .admin-banner strong { color: #fff; }
    .admin-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; align-items: center; }
    code { background: #141414; padding: 2px 5px; font-size: 12px; }
    pre { background: #0d0d0d; border: 1px solid #333; padding: 14px; overflow-x: auto; color: #d8d8d8; font-size: 12px; line-height: 1.7; }
  </style>
</head>
<body>
  <a class="skip" href="#content">Skip to the console</a>
  <header class="legal-header"><a class="wordmark" href="/">VIGNAN <span>/ AI</span></a><a href="/">Leave the console ↗</a></header>
  <main id="content" class="admin-main">
${body}
  </main>
  <footer class="legal-footer"><div><strong>OPERATOR CONSOLE</strong><p>Not a student page. Every action here is written to the server log.</p></div><nav aria-label="Legal links"><a href="/privacy.html">Privacy ↗</a><a href="/security.html">Security ↗</a><a href="/terms.html">Terms ↗</a></nav></footer>
</body>
</html>`;
}

export function renderAdminLogin({ enabled, reason, message = "", status = 200, csrf = "" } = {}) {
  const body = `
    <p class="eyebrow">OPERATOR / SIGN IN</p>
    <h1 style="font-size:clamp(38px,5vw,64px)">Operator<br><span>console.</span></h1>
    <p class="admin-lede">Account records for this school's deployment: who signed up, when, and how their practice is going. Books, chats and answers are not here, because they never leave a student's browser.</p>
    ${message ? `<div class="admin-banner">${escapeHtml(message)}</div>` : ""}
    ${enabled
      ? `<form class="admin-form" method="post" action="/api/admin/login">
          <input type="hidden" name="csrf" value="${escapeHtml(csrf)}">
          <label class="admin-label" for="token">Operator token
            <input id="token" name="token" type="password" autocomplete="current-password" required minlength="${ADMIN_MIN_TOKEN_LENGTH}" spellcheck="false">
          </label>
          <button type="submit">Sign in</button>
        </form>
        <p class="admin-note">The token is the value of <code>STUDY_AI_ADMIN_TOKEN</code> in the Render environment. It is compared on the server and never stored in the page. Five wrong attempts from one address pauses sign-in for ten minutes.</p>`
      : `<div class="admin-banner"><strong>The console is off.</strong> ${escapeHtml(reason)}</div>
        <p class="admin-note">Until it is configured, nobody can open this page, including the operator. That is the intended default.</p>
        <pre>${escapeHtml(ADMIN_HELP)}</pre>`}
    <div class="admin-card">
      <h2>What this console can and cannot do</h2>
      <p><strong>Can:</strong> list accounts, search by username, export a backup, see progress totals. <strong>Cannot:</strong> read a password or hash, sign in as a student, read a book, chat, deck or answer, or change a mark. Those limits are in the code, not just in this sentence.</p>
    </div>`;
  return { status, html: shell({ title: "Operator console — Vignan AI", body, description: "Operator console for the school deployment." }) };
}

export function renderAdminDashboard({
  rows = [],
  total = 0,
  search = "",
  page = 1,
  pageSize = 100,
  csrf = "",
  backend = "",
  release = "",
  message = "",
} = {}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const created = rows.filter((row) => row.createdAt).length;
  const quizzes = rows.reduce((sum, row) => sum + Number(row.quizzes || 0), 0);
  const avg = rows.length
    ? Math.round(rows.reduce((sum, row) => sum + Number(row.average || 0), 0) / rows.length)
    : 0;
  const query = search ? `&q=${encodeURIComponent(search)}` : "";
  const table = rows.length
    ? `<div class="admin-scroll"><table class="admin-table">
        <thead><tr><th>Username</th><th>Age band</th><th>Gender</th><th>Joined</th><th>Quizzes</th><th>Average</th><th>XP</th><th>Streak</th><th>Referrals</th></tr></thead>
        <tbody>${rows.map((row) => `<tr>
          <td class="user">${escapeHtml(row.username)}</td>
          <td>${escapeHtml(row.ageBand || "—")}</td>
          <td>${escapeHtml(row.gender || "—")}</td>
          <td>${escapeHtml(shortDate(row.createdAt))}</td>
          <td>${Number(row.quizzes || 0)}</td>
          <td>${Number(row.average || 0)}%</td>
          <td>${Number(row.xp || 0)}</td>
          <td>${Number(row.streak || 0)}</td>
          <td>${Number(row.referrals || 0)}</td>
        </tr>`).join("")}</tbody>
      </table></div>`
    : `<p class="admin-note">No accounts matched${search ? ` “${escapeHtml(search)}”` : ""}.</p>`;

  const body = `
    <p class="eyebrow">OPERATOR / ACCOUNTS</p>
    <h1 style="font-size:clamp(38px,5vw,64px)">Account<br><span>records.</span></h1>
    <p class="admin-lede">Signed in as the operator. This page is not cached, not indexed and not linked from the app; every visit writes a line to the server log.</p>
    ${message ? `<div class="admin-banner">${escapeHtml(message)}</div>` : ""}
    <div class="admin-facts">
      <div><span>accounts</span><strong>${total}</strong></div>
      <div><span>on this page</span><strong>${rows.length}</strong></div>
      <div><span>with a signup date</span><strong>${created}</strong></div>
      <div><span>quizzes, this page</span><strong>${quizzes}</strong></div>
      <div><span>average score</span><strong>${avg}%</strong></div>
      <div><span>backend</span><strong>${escapeHtml(backend || "unknown")}</strong></div>
      <div><span>release</span><strong>${escapeHtml(release)}</strong></div>
    </div>
    <form class="admin-form" method="get" action="/admin">
      <label class="admin-label" for="q">Search by username
        <input id="q" name="q" type="search" value="${escapeHtml(search)}" placeholder="e.g. aarav" maxlength="40">
      </label>
      <button type="submit">Search</button>
      ${search ? `<a class="admin-button secondary" href="/admin">Clear</a>` : ""}
    </form>
    ${table}
    <div class="admin-actions">
      <a class="admin-button" href="/admin/export?format=json${query}">Backup as JSON</a>
      <a class="admin-button secondary" href="/admin/export?format=csv${query}">Backup as CSV</a>
      ${page > 1 ? `<a class="admin-button secondary" href="/admin?page=${page - 1}${query}">Previous</a>` : ""}
      ${page < pages ? `<a class="admin-button secondary" href="/admin?page=${page + 1}${query}">Next</a>` : ""}
      <span class="admin-note">page ${page} of ${pages}</span>
      <form method="post" action="/api/admin/logout" style="margin-left:auto">
        <input type="hidden" name="csrf" value="${escapeHtml(csrf)}">
        <button class="secondary" type="submit">Sign out</button>
      </form>
    </div>
    <div class="admin-card">
      <h2>Why this page cannot see their work</h2>
      <p>Books, chats, study sheets, decks and answers are stored in each student's browser and are never uploaded. Nothing here can read them, and neither could a bug in this page: the data does not exist on the server. Exporting a backup gives account records and progress totals, nothing more.</p>
    </div>
    <div class="admin-card">
      <h2>If a guardian asks</h2>
      <p>Search the username, read out the age band, gender, signup date and progress figures, then explain that the student's own notes are on their device and can be erased from <strong>Settings, then Delete all local data</strong>. For account deletion, the profile row and the Supabase Auth user both have to go; do that in the Supabase dashboard, and say so plainly rather than promising a button that does not exist.</p>
    </div>`;
  return { status: 200, html: shell({ title: "Account records — Vignan AI operator console", body, description: "Account records for the school deployment." }) };
}

function shortDate(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "—";
  return date.toISOString().slice(0, 10);
}
