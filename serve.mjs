#!/usr/bin/env node
/**
 * Zero-dependency server for Vignan Vidyanikethan AI.
 *
 * - Serves the Vignan Vidyanikethan AI PWA from the repository root.
 * - Runs a free AI router over several zero-cost upstream providers, with an
 *   offline extractive engine as the final fallback in the browser.
 * - Optionally proxies web-search fallback to a configured JSON endpoint.
 * - Provides student accounts backed by a local JSON file or Supabase, plus
 *   progress sync and a privacy-safe public leaderboard.
 *
 * No server key is ever sent to the browser. Free-tier keys stay on the server,
 * and a single env var may contain several comma/newline-separated keys. Student
 * BYOK keys are per-request only and are never persisted or logged.
 * Passwords are scrypt-hashed (local mode) or handled by Supabase Auth.
 *
 * Quick start:
 *   npm start
 *   STUDY_AI_GEMINI_KEYS='key1,key2' STUDY_AI_GROQ_KEY=... npm start
 */

import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { isIP } from "node:net";
import { fileURLToPath } from "node:url";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { parseSearchResults } from "./js/web.js";
import { buildUpstreams, callFreeRouter, getKeyCooldownStatus } from "./server/free-router.mjs";
import { buildStudentUpstreams } from "./server/student-keys.mjs";
import { fetchPublicResource, PublicFetchError } from "./server/safe-fetch.mjs";
import { limitedText, searchOutside } from "./server/web-search.mjs";
import { extractHtmlText } from "./js/files.js";
import { LANGUAGE_CODES } from "./js/languages.js";
import { createSupabaseAccountStore } from "./server/supabase-accounts.mjs";
import { ValidationError, cleanUsername, createAccountStore, publicUser, validateLoginPassword, validateUsername } from "./server/accounts.mjs";
import { createLocalSocialStore, createSupabaseSocialStore } from "./server/social-store.mjs";
import { SocialError, createSocialService } from "./server/social.mjs";
import { createSocialRouter } from "./server/social-http.mjs";
import {
  ADMIN_COOKIE, adminCookieHeader, adminFormToken, adminFormTokenMatches, adminHeaders,
  adminState, accountsToBackup, accountsToCsv, auditLog, renderAdminDashboard, renderAdminLogin,
  signAdminSession, verifyAdminSession, verifyAdminToken,
} from "./server/admin.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const env = (name, fallback = "") => process.env[`STUDY_AI_${name}`] ?? process.env[`VIGNAN_AI_${name}`] ?? fallback;
const HOST = env("HOST") || "0.0.0.0";
const PORT = Number(env("PORT") || process.env.PORT || 4173);
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const ACCOUNTS_FILE = env("ACCOUNTS_FILE") || path.join(ROOT, "server", "data", "accounts.json");
const SOCIAL_FILE = env("SOCIAL_FILE") || path.join(ROOT, "server", "data", "social.json");
const SESSION_COOKIE = "vignan_session";
const CSRF_COOKIE = "vignan_csrf";
const CSRF_HEADER = "x-csrf-token";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const sessions = new Map();
const rateBuckets = new Map();
const sessionKey = (token) => createHash("sha256").update(token).digest("hex");

const AI_UPSTREAMS = buildUpstreams(process.env);
const AI_PROVIDER_IDS = [...new Set(AI_UPSTREAMS.map((upstream) => upstream.id))];
const FREE_ROUTER = AI_UPSTREAMS.length > 1;
const KEY_COOLDOWN_MS = Math.min(
  3_600_000,
  Math.max(1_000, Number(env("KEY_COOLDOWN_MS") || 60_000) || 60_000),
);
const STUDENT_KEY_FALLBACK = String(env("STUDENT_KEY_FALLBACK") || "true").toLowerCase() !== "false";
const AI_RATE_LIMIT = Math.min(600, Math.max(1, Number(env("AI_RATE_LIMIT") || 60) || 60));
const SEARCH_RATE_LIMIT = Math.min(600, Math.max(1, Number(env("SEARCH_RATE_LIMIT") || 30) || 30));
const SEARCH_URL = env("SEARCH_URL");

// The look a brand-new device starts in. A school sets this once as an
// environment variable; anything unrecognised falls back to Minimal, so a typo
// cannot leave the app unstyled.
const STYLE_IDS = ["minimal", "soft", "editorial", "luxury", "terminal", "brutal"];
const SCHOOL_DEFAULT_STYLE = STYLE_IDS.includes(String(process.env.SCHOOL_DEFAULT_STYLE || "").trim())
  ? String(process.env.SCHOOL_DEFAULT_STYLE).trim()
  : "minimal";
const WIKIPEDIA_SEARCH = String(env("WIKIPEDIA_SEARCH", "true")).toLowerCase() !== "false";
const searchCache = new Map();
const searchRequestTimes = [];
let activeSearches = 0;
const SEARCH_READ_PAGES = Math.min(4, Math.max(0, Number(env("SEARCH_READ_PAGES") || 2) || 2));
let activePageFetches = 0;
const SEARCH_TOKEN = env("SEARCH_TOKEN");
const SEARCH_TOKEN_HEADER = env("SEARCH_TOKEN_HEADER") || "Authorization";
const ALLOWED_ORIGINS = new Set(
  String(env("ALLOWED_ORIGINS") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);

// Supabase renamed its keys: "anon" is now "publishable" (sb_publishable_…)
// and "service_role" is now "secret" (sb_secret_…). Both formats work, so the
// same deployment keeps running before, during and after the rename.
const firstEnv = (...names) => {
  for (const name of names) {
    const value = String(process.env[name] ?? "").trim();
    if (value) return value;
  }
  return "";
};
const SUPABASE_URL = String(process.env.SUPABASE_URL || env("SUPABASE_URL") || "").trim();
const SUPABASE_ANON_KEY = firstEnv(
  "SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "STUDY_AI_SUPABASE_ANON_KEY", "STUDY_AI_SUPABASE_PUBLISHABLE_KEY",
);
const SUPABASE_SERVICE_ROLE_KEY = firstEnv(
  "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY",
  "STUDY_AI_SUPABASE_SERVICE_ROLE_KEY", "STUDY_AI_SUPABASE_SECRET_KEY",
);
const SUPABASE_EMAIL_DOMAIN = String(env("SUPABASE_EMAIL_DOMAIN") || "students.vignanvidyanikethan.org").trim();
const requestedAccountsBackend = String(env("ACCOUNTS_BACKEND") || "local").trim().toLowerCase();
function plausibleSupabaseUrl(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}
function plausibleSupabaseKey(value) {
  // Reject empty values, documentation placeholders and characters illegal in HTTP headers.
  return /^[\x21-\x7e]{20,2048}$/.test(value) && !/[<>]/.test(value);
}
const useSupabase = requestedAccountsBackend === "supabase" && plausibleSupabaseUrl(SUPABASE_URL) &&
  plausibleSupabaseKey(SUPABASE_ANON_KEY) && plausibleSupabaseKey(SUPABASE_SERVICE_ROLE_KEY);
const accountsBackend = useSupabase ? "supabase" : requestedAccountsBackend === "supabase" ? "unavailable" : "local";
// Names only, never values: an operator reading the Render log should know
// exactly which variable to fix without ever printing a secret.
const supabaseMissing = [];
if (!plausibleSupabaseUrl(SUPABASE_URL)) supabaseMissing.push("SUPABASE_URL");
if (!plausibleSupabaseKey(SUPABASE_ANON_KEY)) supabaseMissing.push("SUPABASE_ANON_KEY (or SUPABASE_PUBLISHABLE_KEY)");
if (!plausibleSupabaseKey(SUPABASE_SERVICE_ROLE_KEY)) supabaseMissing.push("SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)");
if (accountsBackend === "unavailable") {
  console.warn(`[vignan-ai] Supabase configuration is missing or invalid (${supabaseMissing.join(", ") || "unknown"}); accounts are unavailable until it is corrected. Guest mode remains available.`);
}
const accounts = useSupabase
  ? createSupabaseAccountStore({
      url: SUPABASE_URL,
      anonKey: SUPABASE_ANON_KEY,
      serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
      emailDomain: SUPABASE_EMAIL_DOMAIN,
    })
  : accountsBackend === "local" ? createAccountStore(ACCOUNTS_FILE) : null;

const socialStore = accountsBackend === "unavailable"
  ? null
  : useSupabase
    ? createSupabaseSocialStore({ url: SUPABASE_URL, serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY })
    : createLocalSocialStore(SOCIAL_FILE);
const socialService = socialStore
  ? createSocialService({
      store: socialStore,
      lookupByName: (username) => (accounts ? accounts.find(username) : null),
      lookupById: (id) => (accounts ? accounts.findById(id) : null),
    })
  : null;

const sessionStore = useSupabase
  ? {
      create: (userId, token, expires) =>
        accounts.createSession(userId, sessionKey(token), new Date(expires).toISOString()),
      get: async (token) => {
        const row = await accounts.getSession(sessionKey(token));
        return row ? { userId: row.user_id, expires: new Date(row.expires_at).getTime() } : null;
      },
      delete: (token) => accounts.deleteSession(sessionKey(token)),
    }
  : {
      create: async (userId, token, expires) => {
        sessions.set(token, { userId, expires });
      },
      get: async (token) => sessions.get(token) || null,
      delete: async (token) => {
        sessions.delete(token);
      },
    };

// Friends, notifications, chat and games reuse the same session cookie, CSRF
// token and rate limiter as accounts. Guest mode simply gets a 401.
const socialRouter = socialService
  ? createSocialRouter({
      service: socialService,
      accounts,
      accountsBackend,
      currentSession: (request) => currentSession(request),
      sendJson,
      sendError,
      authOptions,
      readJson,
      rateLimit,
    })
  : null;

// Restrict executable content while keeping the app's offline workers, local
// model downloads, browser-generated videos and Arena's embedded preview usable.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data: blob:",
  "connect-src 'self' https: http: wss: ws:",
  "worker-src 'self' blob:",
  "media-src 'self' data: blob:",
  "frame-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

/** True when the request reached us over TLS (directly or via a proxy). */
function isHttps(request) {
  const proto = String(request.headers["x-forwarded-proto"] || "").split(",")[0].trim().toLowerCase();
  return proto === "https" || Boolean(request.socket?.encrypted);
}

/**
 * Headers every response gets: no sniffing, no framing by strangers, no
 * referrer leakage, no powerful browser APIs, and HSTS once we are on TLS.
 */
function baseSecurityHeaders(request) {
  const headers = {
    "X-Content-Type-Options": "nosniff",
    // Framing is deliberately not restricted: the Arena live preview embeds
    // this page in an iframe. Clickjacking is limited instead by CSRF tokens,
    // the same-origin check on every mutation and JSON-only writes.
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), hid=(), midi=()",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    "X-Permitted-Cross-Domain-Policies": "none",
  };
  if (isHttps(request)) {
    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
  }
  return headers;
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".well-known": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".pdf": "application/pdf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".bcmap": "application/octet-stream",
  ".pfb": "application/octet-stream",
  ".map": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

function sendJson(response, status, data, { api = false, extraHeaders = {}, corsOrigin = null } = {}) {
  const body = Buffer.from(JSON.stringify(data));
  const headers = {
    ...baseSecurityHeaders(response.__vignanRequest || {}),
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": body.length,
    "Cache-Control": "no-store",
  };
  if (api) {
    headers["Vary"] = "Origin";
    if (corsOrigin !== false) {
      headers["Access-Control-Allow-Origin"] = corsOrigin || "*";
      if (corsOrigin) headers["Access-Control-Allow-Credentials"] = "true";
    }
    headers["Access-Control-Allow-Headers"] = "Content-Type, X-Vignan-Client, X-CSRF-Token";
    headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS";
  }
  Object.assign(headers, extraHeaders);
  response.writeHead(status, headers);
  response.end(body);
}

function sendError(response, status, message, options = {}, details = {}) {
  sendJson(response, status, { ok: false, error: message, ...details }, { api: true, ...options });
}

class RequestBodyError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "RequestBodyError";
    this.status = status;
  }
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new RequestBodyError("Request body is too large.", 413);
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  const text = Buffer.concat(chunks).toString("utf8");
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new RequestBodyError("Request body must be valid JSON.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RequestBodyError("Request body must be a JSON object.");
  }
  return value;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function cleanMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages.slice(-20).map((message) => ({
    role: ["system", "user", "assistant"].includes(message?.role) ? message.role : "user",
    content: String(message?.content ?? "").slice(0, 20_000),
  }));
}

/* ----------------------------------------------------------- student auth */

function clientIp(request) {
  // Only trust a forwarded address when running behind Render or an explicitly
  // trusted proxy. Use the last appended address, not a client-supplied first hop.
  const trustProxy = String(env("TRUST_PROXY") || process.env.RENDER || "").toLowerCase() === "true";
  if (trustProxy) {
    // Render's Cloudflare edge overwrites CF-Connecting-IP; never trust it on
    // a directly exposed or untrusted proxy deployment.
    const cloudflareIp = String(request.headers["cf-connecting-ip"] || "").trim();
    if (String(process.env.RENDER || "").toLowerCase() === "true" && isIP(cloudflareIp)) return cloudflareIp;
    const hops = String(request.headers["x-forwarded-for"] || "").split(",").map((value) => value.trim()).filter(Boolean);
    const nearest = hops[hops.length - 1];
    if (isIP(nearest)) return nearest;
  }
  return request.socket?.remoteAddress || "unknown";
}

function pruneRateBuckets(now = Date.now()) {
  if (rateBuckets.size < 4000) return;
  for (const [key, value] of rateBuckets) if (value.reset <= now) rateBuckets.delete(key);
  // Bound memory even when an attacker creates many distinct live buckets.
  while (rateBuckets.size >= 5000) rateBuckets.delete(rateBuckets.keys().next().value);
}

function rateLimit(request, bucket, limit = 12, windowMs = 60_000) {
  const now = Date.now();
  pruneRateBuckets(now);
  const key = `${bucket}:${clientIp(request)}`;
  const entry = rateBuckets.get(key);
  if (!entry || entry.reset <= now) {
    rateBuckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}

function loginFailureKey(request, username) {
  return `login-fail:${clientIp(request)}:${username}`;
}
function tooManyLoginFailures(request, username) {
  const key = loginFailureKey(request, username);
  const entry = rateBuckets.get(key);
  if (!entry || entry.reset <= Date.now()) {
    rateBuckets.delete(key);
    return false;
  }
  return entry.count >= 6;
}
function recordLoginFailure(request, username) {
  const now = Date.now();
  pruneRateBuckets(now);
  const key = loginFailureKey(request, username);
  const entry = rateBuckets.get(key);
  if (!entry || entry.reset <= now) rateBuckets.set(key, { count: 1, reset: now + 15 * 60_000 });
  else entry.count += 1;
}

function parseCookies(request) {
  const output = {};
  for (const part of String(request.headers.cookie || "").split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) {
      try { output[key] = decodeURIComponent(value); } catch { /* ignore malformed cookies */ }
    }
  }
  return output;
}

function safeTextEqual(left, right) {
  const a = Buffer.from(String(left ?? ""));
  const b = Buffer.from(String(right ?? ""));
  return a.length === b.length && timingSafeEqual(a, b);
}

function tokenLike(value) {
  return /^[a-f0-9]{64}$/.test(String(value || ""));
}

function csrfTokenFor(request) {
  if (request.csrfToken) return request.csrfToken;
  const existing = parseCookies(request)[CSRF_COOKIE];
  const token = tokenLike(existing) ? existing : randomBytes(32).toString("hex");
  request.csrfToken = token;
  return token;
}

function cookiePolicy(request) {
  const proto = String(request.headers["x-forwarded-proto"] || "").split(",")[0].trim().toLowerCase();
  const secure = proto === "https" || Boolean(request.socket?.encrypted) || String(env("COOKIE_SECURE") || "").toLowerCase() === "true";
  const host = String(request.headers.host || "").split(":")[0].trim().toLowerCase();
  // Arena's cross-site HTTPS preview needs partitioned cookies in an iframe.
  // Normal deployments keep stricter first-party SameSite settings.
  return { secure, partitioned: secure && host.endsWith(".e2b.app") };
}

function csrfCookieHeader(request, token) {
  const { secure, partitioned } = cookiePolicy(request);
  const parts = [
    `${CSRF_COOKIE}=${token}`,
    "Path=/",
    `SameSite=${partitioned ? "None" : "Strict"}`,
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (secure) parts.push("Secure");
  if (partitioned) parts.push("Partitioned");
  return parts.join("; ");
}

function isSameOriginRequest(request) {
  const origin = String(request.headers.origin || "").trim();
  if (!origin) return String(request.headers["sec-fetch-site"] || "").toLowerCase() !== "cross-site";
  return allowedOrigin(request) === origin;
}

function csrfAllowed(request) {
  if (!isSameOriginRequest(request)) return false;
  const headerToken = String(request.headers[CSRF_HEADER] || "").trim();
  const cookieToken = String(parseCookies(request)[CSRF_COOKIE] || "").trim();
  return tokenLike(headerToken) && tokenLike(cookieToken) && safeTextEqual(headerToken, cookieToken);
}

async function currentSession(request) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!tokenLike(token)) return null;
  const session = await sessionStore.get(token);
  if (!session) return null;
  if (session.expires < Date.now()) {
    await sessionStore.delete(token);
    return null;
  }
  return session;
}

async function createSession(userId) {
  const token = randomBytes(32).toString("hex");
  await sessionStore.create(userId, token, Date.now() + SESSION_TTL_MS);
  return token;
}

function sessionCookieHeader(request, token, { clear = false } = {}) {
  const { secure, partitioned } = cookiePolicy(request);
  const parts = [
    `${SESSION_COOKIE}=${clear ? "" : token}`,
    "Path=/",
    "HttpOnly",
    `SameSite=${partitioned ? "None" : "Lax"}`,
    `Max-Age=${clear ? 0 : Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (secure) parts.push("Secure");
  if (partitioned) parts.push("Partitioned");
  return parts.join("; ");
}

function allowedOrigin(request) {
  const origin = String(request.headers.origin || "").trim();
  if (!origin) return null;
  if (ALLOWED_ORIGINS.has(origin)) return origin;
  try {
    const parsed = new URL(origin);
    const host = String(request.headers.host || "")
      .split(",")[0]
      .trim();
    const proto = String(request.headers["x-forwarded-proto"] || (request.socket?.encrypted ? "https" : "http"))
      .split(",")[0]
      .trim();
    if (host && parsed.host === host && parsed.protocol === `${proto}:`) return origin;
  } catch {
    // Malformed Origin: do not reflect it.
  }
  return null;
}

function authOptions(request, extraHeaders = {}) {
  const token = csrfTokenFor(request);
  const headers = { ...extraHeaders };
  const existing = headers["Set-Cookie"];
  const values = Array.isArray(existing) ? existing : existing ? [existing] : [];
  const hasCsrfCookie = values.some((value) => String(value).startsWith(`${CSRF_COOKIE}=`));
  if (!tokenLike(parseCookies(request)[CSRF_COOKIE]) && !hasCsrfCookie) {
    values.push(csrfCookieHeader(request, token));
  }
  if (values.length) headers["Set-Cookie"] = values.length === 1 ? values[0] : values;
  return { api: true, corsOrigin: allowedOrigin(request) || false, extraHeaders: headers };
}

async function handleRegister(request, response) {
  if (!rateLimit(request, "register", 8, 60_000)) {
    sendError(response, 429, "Too many registration attempts. Try again in a minute.", authOptions(request));
    return;
  }
  const body = await readJson(request);
  try {
    const account = await accounts.register(body);
    const oldToken = parseCookies(request)[SESSION_COOKIE];
    if (oldToken) await sessionStore.delete(oldToken);
    const token = await createSession(account.id);
    const csrf = randomBytes(32).toString("hex");
    request.csrfToken = csrf;
    sendJson(
      response,
      201,
      { ok: true, user: publicUser(account), csrfToken: csrf },
      authOptions(request, {
        "Set-Cookie": [sessionCookieHeader(request, token), csrfCookieHeader(request, csrf)],
      }),
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      sendError(response, error.status || 400, error.message, authOptions(request));
    } else {
      console.error("[vignan-ai] register failed", error?.name || "Error");
      sendError(response, 500, "Could not create the account.", authOptions(request));
    }
  }
}

async function handleLogin(request, response) {
  if (!rateLimit(request, "login", 12, 60_000)) {
    sendError(response, 429, "Too many login attempts. Try again in a minute.", authOptions(request));
    return;
  }
  const body = await readJson(request);
  try {
    const username = validateUsername(body.username);
    const password = validateLoginPassword(body.password);
    if (tooManyLoginFailures(request, username)) {
      sendError(response, 429, "Too many attempts from this device. Try again in 15 minutes.", authOptions(request));
      return;
    }
    const account = await accounts.authenticate(username, password);
    if (!account) {
      recordLoginFailure(request, username);
      sendError(response, 401, "Invalid username or password.", authOptions(request));
      return;
    }
    rateBuckets.delete(loginFailureKey(request, username));
    const oldToken = parseCookies(request)[SESSION_COOKIE];
    if (oldToken) await sessionStore.delete(oldToken);
    const token = await createSession(account.id);
    const csrf = randomBytes(32).toString("hex");
    request.csrfToken = csrf;
    sendJson(
      response,
      200,
      { ok: true, user: publicUser(account), csrfToken: csrf },
      authOptions(request, {
        "Set-Cookie": [sessionCookieHeader(request, token), csrfCookieHeader(request, csrf)],
      }),
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      sendError(response, 401, "Invalid username or password.", authOptions(request));
    } else {
      console.error("[vignan-ai] login failed", error?.name || "Error");
      sendError(response, 500, "Could not log in.", authOptions(request));
    }
  }
}

async function handleLogout(request, response) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (token) await sessionStore.delete(token);
  const csrf = randomBytes(32).toString("hex");
  request.csrfToken = csrf;
  sendJson(
    response,
    200,
    { ok: true, user: null, csrfToken: csrf },
    authOptions(request, { "Set-Cookie": [sessionCookieHeader(request, "", { clear: true }), csrfCookieHeader(request, csrf)] }),
  );
}

async function handleMe(request, response) {
  const options = authOptions(request);
  const csrfToken = request.csrfToken;
  if (accountsBackend === "unavailable") {
    sendJson(response, 200, { ok: true, user: null, guest: true, accountsAvailable: false, csrfToken }, options);
    return;
  }
  const session = await currentSession(request);
  if (!session) {
    sendJson(response, 200, { ok: true, user: null, guest: true, csrfToken }, options);
    return;
  }
  const account = await accounts.findById(session.userId);
  if (!account) {
    sendJson(response, 200, { ok: true, user: null, guest: true, csrfToken }, options);
    return;
  }
  sendJson(response, 200, { ok: true, user: publicUser(account), guest: false, csrfToken }, options);
}

async function handleLeaderboard(request, response) {
  const board = await accounts.leaderboard(20);
  sendJson(response, 200, { ok: true, leaderboard: board }, authOptions(request));
}

async function handleProgress(request, response) {
  const session = await currentSession(request);
  if (!session) {
    sendError(response, 401, "Log in to sync progress.", authOptions(request));
    return;
  }
  if (!rateLimit(request, `progress:${session.userId}`, 30, 60_000)) {
    sendError(response, 429, "Too many progress updates.", authOptions(request));
    return;
  }
  const body = await readJson(request);
  const user = await accounts.recordResult(session.userId, body.result || body);
  if (!user) {
    sendError(response, 401, "Account not found.", authOptions(request));
    return;
  }
  sendJson(response, 200, { ok: true, user }, authOptions(request));
}

async function handleAi(request, response) {
  if (!rateLimit(request, "ai", AI_RATE_LIMIT, 60_000)) {
    sendError(response, 429, "Too many AI requests from this network. Please try again in a minute.");
    return;
  }
  const body = await readJson(request);
  const messages = cleanMessages(body.messages);
  if (!messages.length) {
    sendError(response, 400, "A messages array is required.");
    return;
  }

  // Student keys are per-request only: never written to disk, accounts or logs.
  // They are appended after all official Render keys, or used alone by the
  // explicit "test my keys" button in Settings.
  const allowStudentKeys = STUDENT_KEY_FALLBACK && body.studentKeyFallback !== false;
  const studentUpstreams = allowStudentKeys ? buildStudentUpstreams(body.studentKeys) : [];
  const upstreams = body.forceStudentKeys ? studentUpstreams : [...AI_UPSTREAMS, ...studentUpstreams];
  if (!upstreams.length) {
    sendError(
      response,
      503,
      "No AI keys are available. Add one or more official free-tier keys to Render, add your own in Settings, or keep using the offline engine.",
      {},
      { code: "NO_AI_KEYS", needStudentKeys: STUDENT_KEY_FALLBACK, studentKeyFallback: STUDENT_KEY_FALLBACK },
    );
    return;
  }

  try {
    const result = await callFreeRouter({
      upstreams,
      messages,
      temperature: clampNumber(body.temperature, 0, 2, 0.2),
      maxTokens: clampNumber(body.max_tokens ?? body.maxTokens, 1, 4096, 900),
      cooldownMs: KEY_COOLDOWN_MS,
    });
    console.info(
      `[vignan-ai] AI answer via ${result.provider}/${result.keySource} (attempt ${result.attempts}/${upstreams.length})`,
    );
    sendJson(
      response,
      200,
      {
        ok: true,
        content: result.content,
        model: result.model,
        provider: result.provider,
        providerLabel: result.providerLabel,
        usage: result.usage,
        attempts: result.attempts,
        fallbackUsed: result.fallbackUsed,
        freeRouter: FREE_ROUTER,
        keySource: result.keySource,
        studentKeyUsed: result.studentKeyUsed,
        keyCount: result.keyCount,
      },
      { api: true },
    );
  } catch (error) {
    const status = error.code === "ALL_KEYS_EXHAUSTED" ? 429 : 502;
    sendError(
      response,
      status,
      error.message || "Could not reach any AI provider.",
      {},
      {
        code: error.code || "AI_UNAVAILABLE",
        needStudentKeys: Boolean(error.needStudentKeys) && STUDENT_KEY_FALLBACK,
        attempts: error.attempts || 0,
        studentKeysTried: studentUpstreams.length,
      },
    );
  }
}

/**
 * Read the top non-encyclopedic results so the answer is built from a real
 * passage instead of a two-line search snippet. Wikipedia already returns a
 * long extract, so it is skipped. Failures are ignored: the snippet stays.
 */
async function readSearchPassages(results = [], limit = SEARCH_READ_PAGES) {
  if (!limit) return results;
  const candidates = results
    .filter((result) => {
      try {
        const host = new URL(result.url).hostname.replace(/^www\./, "");
        return !/(^|\.)wikipedia\.org$/.test(host) && String(result.snippet || "").length < 700;
      } catch {
        return false;
      }
    })
    .slice(0, limit);
  await Promise.allSettled(candidates.map(async (result) => {
    try {
      const resource = await fetchPublicResource(result.url, { maxBytes: 400 * 1024, timeoutMs: 5500 });
      const type = String(resource.contentType || "").toLowerCase();
      if (!/^(?:text\/html|application\/xhtml\+xml|text\/plain)/.test(type)) return;
      const raw = new TextDecoder("utf-8").decode(resource.bytes);
      const text = type.startsWith("text/plain") ? raw : extractHtmlText(raw).text;
      const passage = text.replace(/\s+/g, " ").trim().slice(0, 3200);
      if (passage.length > 240) result.passage = passage;
    } catch {
      // Keep the snippet when a page cannot be read.
    }
  }));
  return results;
}

async function handleSearch(request, response) {
  if (!rateLimit(request, "search", SEARCH_RATE_LIMIT, 60_000)) {
    sendError(response, 429, "Too many search requests from this network. Please try again in a minute.");
    return;
  }
  const body = await readJson(request);
  const query = String(body.query || "").trim().slice(0, 300);
  const natural = String(body.natural || "").trim().slice(0, 300);
  if (!query) {
    sendError(response, 400, "A query is required.");
    return;
  }
  if (!SEARCH_URL) {
    if (!WIKIPEDIA_SEARCH) {
      sendError(response, 503, "Web search is disabled on this server.");
      return;
    }
    const language = LANGUAGE_CODES.includes(String(body.language || "")) ? String(body.language) : "en";
    const key = `${language}:${query.toLowerCase()}`;
    const now = Date.now();
    const cached = searchCache.get(key);
    if (cached && cached.expires > now) {
      sendJson(response, 200, { ok: true, results: cached.results, provider: cached.provider, providers: cached.providers, message: "" }, { api: true });
      return;
    }
    while (searchRequestTimes.length && searchRequestTimes[0] <= now - 60_000) searchRequestTimes.shift();
    if (activeSearches >= 4 || searchRequestTimes.length >= 60) {
      sendError(response, 429, "Web search is busy. Please try again shortly.");
      return;
    }
    searchRequestTimes.push(now);
    activeSearches += 1;
    try {
      const outside = await searchOutside(query, { natural, language });
      let results = outside.results;
      if (body.read !== false) results = await readSearchPassages(results);
      const providers = outside.providers.length ? outside.providers : ["Wikipedia"];
      const provider = providers.join(" + ");
      const entry = { results, provider, providers, expires: Date.now() + 5 * 60_000 };
      searchCache.set(key, entry);
      const expiry = setTimeout(() => { if (searchCache.get(key) === entry) searchCache.delete(key); }, 5 * 60_000);
      expiry.unref?.();
      while (searchCache.size > 120) searchCache.delete(searchCache.keys().next().value);
      sendJson(
        response,
        200,
        {
          ok: true,
          results,
          provider,
          providers,
          message: results.length ? "" : "No outside results were found for this question yet.",
        },
        { api: true },
      );
    } catch (error) {
      sendError(response, 502, `Web search could not be reached (${error.message || "unknown error"}). Check your connection or try again later.`);
    } finally { activeSearches -= 1; }
    return;
  }
  let url;
  try {
    url = SEARCH_URL.includes("{q}")
      ? SEARCH_URL.replace("{q}", encodeURIComponent(query))
      : `${SEARCH_URL}${SEARCH_URL.includes("?") ? "&" : "?"}q=${encodeURIComponent(query)}`;
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Only http(s) search endpoints are allowed.");
  } catch (error) {
    sendError(response, 500, "The web search provider is not configured correctly.");
    return;
  }
  const headers = SEARCH_TOKEN
    ? { [SEARCH_TOKEN_HEADER]: SEARCH_TOKEN_HEADER.toLowerCase() === "authorization" ? `Bearer ${SEARCH_TOKEN}` : SEARCH_TOKEN }
    : {};
  try {
    const upstream = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) });
    const raw = await limitedText(upstream);
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      sendError(response, 502, "The search endpoint did not return JSON.");
      return;
    }
    if (!upstream.ok) {
      sendError(response, 502, `The search provider could not complete the request (${upstream.status}).`);
      return;
    }
    const results = parseSearchResults(data);
    sendJson(
      response,
      200,
      {
        ok: true,
        results,
        provider: "configured",
        providers: ["configured"],
        message: results.length ? "" : "No outside results found for this question.",
      },
      { api: true },
    );
  } catch (error) {
    sendError(response, 502, "Could not reach the search provider. Try again later.");
  }
}

async function handleFetch(request, response) {
  if (!rateLimit(request, "fetch", 15, 60_000)) {
    sendError(response, 429, "Too many link requests from this network. Please try again in a minute.");
    return;
  }
  const body = await readJson(request);
  if (typeof body.url !== "string" || !body.url.trim()) {
    sendError(response, 400, "A public webpage or file URL is required.");
    return;
  }
  if (activePageFetches >= 4) {
    sendError(response, 429, "Link reading is busy. Please try again shortly.");
    return;
  }
  activePageFetches += 1;
  const controller = new AbortController();
  const onClose = () => { if (!response.writableFinished) controller.abort(); };
  response.on("close", onClose);
  try {
    const resource = await fetchPublicResource(body.url, { signal: controller.signal });
    const type = /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(resource.contentType) ? resource.contentType : "application/octet-stream";
    response.writeHead(200, {
      ...securityHeaders({ api: true }),
      "Content-Type": "application/octet-stream",
      "Content-Disposition": "attachment; filename=source.bin",
      "Content-Length": String(resource.bytes.length),
      "X-Vignan-Content-Type": type,
      "X-Vignan-Source-URL": encodeURIComponent(resource.finalUrl),
    });
    response.end(resource.bytes);
  } catch (error) {
    if (!response.destroyed && !response.headersSent) {
      sendError(response, error instanceof PublicFetchError ? error.status : 502, error instanceof PublicFetchError ? error.message : "That link could not be read.");
    }
  } finally {
    response.removeListener("close", onClose);
    activePageFetches -= 1;
  }
}

let socialCheckCache = { at: 0, value: null };

/**
 * Ask the social store whether it can actually serve requests.
 *
 * Cached for a minute: it costs one tiny query per table, and health checks are
 * cheap to call. `?social=1` returns the result; the plain health payload stays
 * as small as before.
 */
async function socialDiagnostics({ fresh = false } = {}) {
  if (!socialStore) return { ok: false, backend: "unavailable", detail: "accounts backend unavailable" };
  if (!fresh && socialCheckCache.value && Date.now() - socialCheckCache.at < 60_000) return socialCheckCache.value;
  let value;
  try {
    value = typeof socialStore.health === "function"
      ? await socialStore.health()
      : { ok: true, backend: socialStore.backend, detail: "no probe" };
  } catch (error) {
    value = { ok: false, backend: socialStore.backend, code: error?.code || "", detail: error?.message || String(error) };
  }
  socialCheckCache = { at: Date.now(), value };
  return value;
}

function health() {
  return {
    ok: true,
    version: "2.12.0",
    brand: "Vignan Vidyanikethan AI",
    ai: AI_UPSTREAMS.length > 0,
    aiProviders: AI_PROVIDER_IDS,
    aiModel: AI_UPSTREAMS[0]?.model || null,
    freeRouter: FREE_ROUTER,
    keyPool: {
      serverKeys: AI_UPSTREAMS.length,
      coolingKeys: getKeyCooldownStatus().length,
      cooldownMs: KEY_COOLDOWN_MS,
      studentKeyFallback: STUDENT_KEY_FALLBACK,
    },
    search: Boolean(SEARCH_URL || WIKIPEDIA_SEARCH),
    searchProvider: SEARCH_URL ? "configured" : WIKIPEDIA_SEARCH ? "Wikipedia + DuckDuckGo" : null,
    searchSources: SEARCH_URL ? ["configured"] : WIKIPEDIA_SEARCH ? ["Wikipedia", "DuckDuckGo"] : [],
    languages: LANGUAGE_CODES,
    linkReading: true,
    accounts: accountsBackend !== "unavailable",
    accountsBackend,
    // Booleans and variable names only, so a parent can diagnose a deployment
    // from /api/health without any secret being readable.
    accountsConfig: accountsBackend === "supabase"
      ? { publicKey: true, secretKey: true }
      : { publicKey: plausibleSupabaseKey(SUPABASE_ANON_KEY), secretKey: plausibleSupabaseKey(SUPABASE_SERVICE_ROLE_KEY), url: plausibleSupabaseUrl(SUPABASE_URL), missing: supabaseMissing },
    social: socialStore ? socialStore.backend : "unavailable",
    games: ["chess", "quiz", "math", "word"],
    offlineReady: true,
    // The style a device uses before anyone has chosen one. Chosen per device,
    // set per school: a shared classroom tablet should not inherit a taste.
    defaultStyle: SCHOOL_DEFAULT_STYLE,
    localAI: {
      runtime: "webllm",
      bundled: true,
      models: ["SmolLM2-135M", "SmolLM2-360M", "Llama-3.2-1B", "Qwen2.5-0.5B"],
    },
    time: new Date().toISOString(),
  };
}

const escapeHtml = (value) => String(value)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/**
 * Describe a key's *shape* without revealing it.
 *
 * Half of all setup failures are a publishable key pasted into the secret
 * variable (or the reverse), and the two formats are distinguishable without
 * printing a single character of the value.
 */
function keyKind(value) {
  if (!value) return "empty";
  if (/^sb_publishable_/.test(value)) return "publishable key";
  if (/^sb_secret_/.test(value)) return "secret key";
  if (/^eyJ/.test(value)) {
    try {
      const payload = JSON.parse(Buffer.from(value.split(".")[1] || "", "base64url").toString("utf8"));
      if (payload.role === "service_role") return "legacy service_role JWT";
      if (payload.role === "anon") return "legacy anon JWT";
      return "legacy JWT";
    } catch {
      return "legacy JWT (unreadable payload)";
    }
  }
  if (/^[A-Za-z0-9_\-.]{20,}$/.test(value)) return "a key of unknown format";
  return "not a key";
}

function supabaseProjectRef() {
  try {
    const host = new URL(SUPABASE_URL).hostname;
    const [ref] = host.split(".");
    return /^[a-z0-9]{10,}$/.test(ref) ? ref : "";
  } catch { return ""; }
}

/**
 * A human-readable setup page.
 *
 * `/api/health` is for machines; this is the page a student or a parent opens
 * when registration is broken. It reports presence and *shape* only — never a
 * key value — and tells them exactly which variable to fix and where.
 */
function setupPage() {
  const ref = supabaseProjectRef();
  const rows = [
    {
      name: "SUPABASE_URL",
      ok: plausibleSupabaseUrl(SUPABASE_URL),
      detail: plausibleSupabaseUrl(SUPABASE_URL) ? escapeHtml(SUPABASE_URL) : "not set",
      purpose: "Address of the Supabase project.",
    },
    {
      name: "SUPABASE_ANON_KEY",
      ok: plausibleSupabaseKey(SUPABASE_ANON_KEY) && keyKind(SUPABASE_ANON_KEY) !== "secret key",
      detail: keyKind(SUPABASE_ANON_KEY),
      purpose: "The publishable key. Public by design; row-level security limits it.",
    },
    {
      name: "SUPABASE_SERVICE_ROLE_KEY",
      ok: plausibleSupabaseKey(SUPABASE_SERVICE_ROLE_KEY) && keyKind(SUPABASE_SERVICE_ROLE_KEY) !== "publishable key",
      detail: keyKind(SUPABASE_SERVICE_ROLE_KEY),
      purpose: "The secret key. Server only; bypasses row-level security.",
    },
  ];
  // `local` is a working backend (JSON store on the server), not a broken one:
  // only `unavailable` means registration is actually down.
  const usingSupabase = accountsBackend === "supabase";
  const ready = accountsBackend !== "unavailable";
  const wantsSupabase = requestedAccountsBackend === "supabase";
  // Every problem is reported at once: fixing one variable only to be told
  // about the next is how an evening disappears.
  const problems = [];
  if (wantsSupabase || usingSupabase) {
    if (!rows[0].ok) {
      problems.push("<code>SUPABASE_URL</code> is empty or not a URL.");
    }
    if (keyKind(SUPABASE_ANON_KEY) === "secret key") {
      problems.push("<code>SUPABASE_ANON_KEY</code> holds a <strong>secret</strong> key. Put the <strong>publishable</strong> key there instead.");
    } else if (!rows[1].ok) {
      problems.push("<code>SUPABASE_ANON_KEY</code> is empty. Paste the <strong>publishable</strong> key, which starts <code>sb_publishable_</code>.");
    }
    if (keyKind(SUPABASE_SERVICE_ROLE_KEY) === "publishable key") {
      problems.push("<code>SUPABASE_SERVICE_ROLE_KEY</code> holds a <strong>publishable</strong> key. Put the <strong>secret</strong> key there instead.");
    } else if (!rows[2].ok) {
      problems.push("<code>SUPABASE_SERVICE_ROLE_KEY</code> is empty. Paste the <strong>secret</strong> key, which starts <code>sb_secret_</code>.");
    } else if (keyKind(SUPABASE_SERVICE_ROLE_KEY) === "legacy service_role JWT") {
      problems.push("<code>SUPABASE_SERVICE_ROLE_KEY</code> still uses a <strong>legacy</strong> service_role key. It works, but Supabase retires it at the end of 2026, so replace it with a new secret key when convenient.");
    }
  }

  const keysPage = ref ? `https://supabase.com/dashboard/project/${ref}/settings/api-keys` : "https://supabase.com/dashboard";
  const keyRows = rows.map((row) => `
        <tr>
          <td><code>${row.name}</code><span class="purpose">${row.purpose}</span></td>
          <td class="state ${row.ok ? "ok" : "bad"}">${row.ok ? "set" : "fix"}</td>
          <td class="detail">${escapeHtml(row.detail)}</td>
        </tr>`).join("");

  const providerList = AI_PROVIDER_IDS.length
    ? AI_PROVIDER_IDS.map((id) => `<li>${escapeHtml(id)}</li>`).join("")
    : `<li>none — the app will answer from saved pages only</li>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark light">
  <meta name="robots" content="noindex, nofollow">
  <title>Setup check — Vignan AI</title>
  ${ready ? "" : '<meta http-equiv="refresh" content="15">'}
  <link rel="icon" href="/icons/icon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/styles-legal.css">
  <style>
    .check-main { max-width: 980px; margin: 0 auto; padding: 64px 0 90px; }
    .verdict { display: flex; gap: 16px; align-items: flex-start; padding: 24px; border: 1px solid #383838; margin: 26px 0 10px; }
    .verdict .mark { flex: 0 0 auto; width: 34px; height: 34px; display: grid; place-items: center; border: 1px solid #555; font-size: 15px; font-weight: 700; }
    .verdict h2 { margin: 0 0 6px; font-size: 20px; }
    .verdict p { margin: 0; color: #c9c9c9; font-size: 14px; line-height: 1.7; }
    table { width: 100%; border-collapse: collapse; margin: 22px 0 8px; font-size: 13.5px; }
    th { text-align: left; padding: 10px 12px; border-bottom: 1px solid #4a4a4a; color: #9a9a9a; font-size: 10px; letter-spacing: .12em; text-transform: uppercase; }
    td { padding: 14px 12px; border-bottom: 1px solid #2b2b2b; vertical-align: top; }
    td code { font-size: 12.5px; color: #fff; }
    td.purpose, .purpose { display: block; margin-top: 5px; color: #9a9a9a; font-size: 12px; line-height: 1.6; }
    td.state { white-space: nowrap; font-weight: 700; font-size: 12px; letter-spacing: .04em; text-transform: uppercase; }
    td.state.ok::before, td.state.bad::before { content: ""; display: inline-block; width: 7px; height: 7px; margin-right: 7px; border: 1px solid #fff; vertical-align: 1px; }
    td.state.bad::before { background: #fff; }
    td.state.bad { border-left: 2px solid #fff; }
    td.detail { color: #b8b8b8; font-family: ui-monospace, monospace; font-size: 11.5px; overflow-wrap: anywhere; }
    .steps { counter-reset: step; list-style: none; padding: 0; margin: 18px 0; }
    .steps li { display: grid; grid-template-columns: 34px 1fr; gap: 12px; padding: 12px 0; border-bottom: 1px solid #262626; counter-increment: step; color: #d2d2d2; font-size: 13.5px; line-height: 1.7; }
    .steps li::before { content: counter(step, decimal-leading-zero); color: #7d7d7d; font-family: ui-monospace, monospace; font-size: 11px; }
    .facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); border: 1px solid #383838; margin-top: 26px; }
    .facts div { padding: 14px 16px; border-right: 1px solid #383838; border-bottom: 1px solid #383838; }
    .facts span { display: block; color: #8e8e8e; font-size: 10px; letter-spacing: .1em; text-transform: uppercase; }
    .facts strong { display: block; margin-top: 6px; font-size: 14px; color: #f2f2f2; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 22px; }
    .actions a { padding: 12px 18px; border: 1px solid #4a4a4a; color: #fff; font-size: 11px; font-weight: 750; letter-spacing: .1em; text-decoration: none; text-transform: uppercase; }
    .actions a:hover { background: #f5f5f5; color: #080808; }
    ul.providers { margin: 8px 0 0; padding-left: 18px; color: #c8c8c8; font-size: 13px; line-height: 1.9; }
    p.note { color: #9d9d9d; font-size: 12.5px; line-height: 1.75; }
  </style>
</head>
<body>
  <a class="skip" href="#content">Skip to the check</a>
  <header class="legal-header"><a class="wordmark" href="/">VIGNAN <span>/ AI</span></a><a href="/">Open the study space ↗</a></header>
  <main id="content" class="check-main">
    <div class="legal-intro" style="position:static">
      <p class="eyebrow">SETUP CHECK / LIVE</p>
      <h1 style="font-size:clamp(42px,6vw,72px)">Is it<br><span>connected?</span></h1>
      <p style="max-width:560px">This page reads the deployment's own configuration and reports what is set, what is missing and which key is the wrong shape. It shows variable names and formats only, never a key value, so it is safe to open in front of anyone.</p>
    </div>

    <div class="verdict">
      <div class="mark">${ready ? "OK" : "!"}</div>
      <div>
        <h2>${ready
          ? usingSupabase
            ? "Accounts are connected to Supabase."
            : "Accounts are working on this server's local store."
          : "Accounts are not connected yet."}</h2>
        <p>${ready
          ? usingSupabase
            ? "Registration, login, sessions, progress, referrals, friends and the leaderboard all run on Supabase, so they survive a redeploy."
            : "Registration, login, progress and referrals work, but they are stored in a JSON file on the server. On Render's free tier that file is erased by a redeploy or a cold restart, so use Supabase for anything lasting."
          : `Registration and login will fail until this is fixed. Guest mode, the library, answers from saved pages and the offline mode all still work.${problems.length ? " " + problems.length + " problem" + (problems.length === 1 ? "" : "s") + " to fix, below." : ""}`}</p>
      </div>
    </div>

    <table>
      <thead><tr><th>Variable</th><th>State</th><th>What the server sees</th></tr></thead>
      <tbody>${keyRows}</tbody>
    </table>
    <p class="note"><strong>set</strong> means the variable is present and looks like the right kind of key; <strong>fix</strong> means it is missing, malformed, or the wrong kind of key. The last column describes the <em>shape</em> of the value, not the value itself. A publishable key starts <code>sb_publishable_</code>; a secret key starts <code>sb_secret_</code>; an older project may still hold long <code>eyJ…</code> keys, which work but are being retired.</p>

    ${problems.length ? `<ol class="steps">${problems.map((problem) => `<li>${problem}</li>`).join("")}</ol>` : ""}
    ${ready && !usingSupabase ? `<p class="note">The three Supabase rows above are optional in this mode; they only matter once accounts should outlive a redeploy.</p>` : ""}

    <h2 style="font-size:20px;margin:34px 0 0">Where to fix it</h2>
    <ol class="steps">
      <li>Open <a href="${keysPage}" target="_blank" rel="noopener noreferrer">Supabase: Settings, then API Keys</a>. There is no separate “Settings, API” page any more, and the old names are gone: the <strong>anon</strong> key is now the <strong>publishable</strong> key, and the <strong>service_role</strong> key is now the <strong>secret</strong> key.</li>
      <li>In <a href="https://dashboard.render.com/" target="_blank" rel="noopener noreferrer">Render: your service, then Environment</a>, paste the publishable key into <code>SUPABASE_ANON_KEY</code> and the secret key into <code>SUPABASE_SERVICE_ROLE_KEY</code>. The variable names are historical; the values are the new ones.</li>
      <li>Save. Render redeploys by itself; this page refreshes every 15 seconds while something is wrong.</li>
      <li>If registration still fails after this page shows all three as set, check that both SQL migrations have been run in the Supabase SQL editor.</li>
    </ol>

    <div class="facts">
      <div><span>release</span><strong>2.12.0</strong></div>
      <div><span>accounts backend</span><strong>${escapeHtml(accountsBackend)}</strong></div>
      <div><span>friends &amp; chat</span><strong>${escapeHtml(socialStore ? socialStore.backend : "unavailable")}</strong></div>
      <div><span>offline mode</span><strong>ready</strong></div>
      <div><span>web fallback</span><strong>${SEARCH_URL || WIKIPEDIA_SEARCH ? "on" : "off"}</strong></div>
      <div><span>server AI keys</span><strong>${AI_UPSTREAMS.length}</strong></div>
    </div>

    <h3 style="margin:26px 0 0;font-size:15px">AI providers with a key on the server</h3>
    <ul class="providers">${providerList}</ul>
    <p class="note">Key rotation, cooldown and the student-key fallback need no dashboard work: paste several keys into one variable separated by commas and the server tries them in order.</p>

    <div class="actions">
      <a href="/setup">Check again</a>
      <a href="/api/health?social=1">Machine-readable health ↗</a>
      <a href="/judge.html">Judge mode ↗</a>
      <a href="/">Open the app ↗</a>
    </div>
    <p class="note" style="margin-top:22px">This page is marked <code>noindex</code> and reveals no secret, but you can also treat it as private: it is an operator's diagnostic, not part of the student experience.</p>
  </main>
  <footer class="legal-footer"><div><strong>BUILT BY A STUDENT</strong><p>Vignan Vidyanikethan English Medium High School<br>INSPIRE-MANAK science fair</p></div><nav aria-label="Legal and project links"><a href="/privacy.html">Privacy policy ↗</a><a href="/terms.html">Terms of use ↗</a><a href="/security.html">Security ↗</a><a href="/copyright.html">Copyright ↗</a><a href="/judge.html">Judge mode ↗</a></nav></footer>
</body>
</html>`;
}

function sendSetupPage(request, response) {
  const body = Buffer.from(setupPage(), "utf8");
  response.writeHead(200, {
    ...baseSecurityHeaders(request),
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": body.length,
    // Always fresh: the whole point is to see the state after an env change.
    "Cache-Control": "no-store",
    "Content-Security-Policy": CONTENT_SECURITY_POLICY,
  });
  response.end(request.method === "HEAD" ? undefined : body);
}

/* ---------------------------------------------------------------- operator console */

/**
 * The console is off unless STUDY_AI_ADMIN_TOKEN is set to something long.
 * Resolved lazily so a token changed in Render takes effect on redeploy, and so
 * tests can drive it with a bare process.env.
 */
function adminConfig() {
  return adminState(process.env);
}

function adminSession(request) {
  const config = adminConfig();
  if (!config.enabled) return null;
  const value = parseCookies(request)[ADMIN_COOKIE];
  return verifyAdminSession(value, config.token) ? value : null;
}

/** Read a urlencoded form body with a hard cap. */
async function readForm(request, limit = 8_192) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new RequestBodyError("That form was too large.", 413);
    chunks.push(chunk);
  }
  const params = new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
  const output = {};
  for (const [key, value] of params) output[key] = value;
  return output;
}

function sendHtml(request, response, status, html, extraHeaders = {}) {
  const body = Buffer.from(html, "utf8");
  response.writeHead(status, {
    ...baseSecurityHeaders(request),
    ...adminHeaders(extraHeaders),
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": body.length,
    "Content-Security-Policy": CONTENT_SECURITY_POLICY,
  });
  response.end(request.method === "HEAD" ? undefined : body);
}

async function handleAdminPage(request, response) {
  const config = adminConfig();
  const session = adminSession(request);
  if (!session) {
    const message = new URL(request.url || "/admin", "http://local").searchParams.get("error") === "expired"
      ? "That session ended. Sign in again."
      : "";
    const page = renderAdminLogin({ enabled: config.enabled, reason: config.reason, message });
    sendHtml(request, response, config.enabled ? 200 : 503, page.html);
    return;
  }

  const url = new URL(request.url || "/admin", "http://local");
  const search = String(url.searchParams.get("q") || "").trim().slice(0, 40);
  const page = Math.max(1, Math.min(200, Number(url.searchParams.get("page") || 1) || 1));
  const pageSize = 100;
  let rows = [];
  let total = 0;
  let failure = "";
  try {
    const all = typeof accounts?.list === "function" ? await accounts.list({ limit: 500, search }) : [];
    total = all.length;
    rows = all.slice((page - 1) * pageSize, page * pageSize);
  } catch (error) {
    failure = `Could not read the account list: ${String(error?.message || error).slice(0, 200)}`;
  }
  auditLog("view-accounts", { ip: clientIp(request), search, page, rows: rows.length, total });
  const html = renderAdminDashboard({
    rows, total, search, page, pageSize,
    csrf: adminFormToken(session),
    backend: accountsBackend,
    release: "2.12.0",
    message: failure,
  });
  sendHtml(request, response, 200, html.html);
}

async function handleAdminExport(request, response) {
  const session = adminSession(request);
  if (!session) {
    response.writeHead(302, { Location: "/admin?error=expired", ...adminHeaders() }).end();
    return;
  }
  const url = new URL(request.url || "/admin/export", "http://local");
  const format = url.searchParams.get("format") === "csv" ? "csv" : "json";
  const search = String(url.searchParams.get("q") || "").trim().slice(0, 40);
  let rows = [];
  try {
    rows = typeof accounts?.list === "function" ? await accounts.list({ limit: 500, search }) : [];
  } catch (error) {
    sendError(response, 500, `Could not build the backup: ${String(error?.message || error).slice(0, 200)}`);
    return;
  }
  const stamp = new Date().toISOString().slice(0, 10);
  auditLog("export-accounts", { ip: clientIp(request), format, rows: rows.length, search });
  const payload = format === "csv"
    ? accountsToCsv(rows)
    : JSON.stringify(accountsToBackup(rows, { backend: accountsBackend }), null, 2);
  const body = Buffer.from(payload, "utf8");
  response.writeHead(200, {
    ...baseSecurityHeaders(request),
    ...adminHeaders({
      "Content-Type": format === "csv" ? "text/csv; charset=utf-8" : "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="vignan-accounts-${stamp}.${format}"`,
    }),
    "Content-Length": body.length,
  });
  response.end(body);
}

async function handleAdminLogin(request, response) {
  const config = adminConfig();
  if (!config.enabled) {
    sendHtml(request, response, 503, renderAdminLogin({ enabled: false, reason: config.reason }).html);
    return;
  }
  if (!isSameOriginRequest(request)) {
    sendHtml(request, response, 403, renderAdminLogin({ enabled: true, message: "Send that form from this site, not from another page." }).html);
    return;
  }
  if (!rateLimit(request, "admin-login", 5, 600_000)) {
    auditLog("login-throttled", { ip: clientIp(request) });
    sendHtml(request, response, 429, renderAdminLogin({ enabled: true, message: "Too many attempts. Wait ten minutes, then try again." }).html);
    return;
  }
  const form = await readForm(request);
  if (!verifyAdminToken(form.token, config.token)) {
    auditLog("login-failed", { ip: clientIp(request) });
    sendHtml(request, response, 401, renderAdminLogin({ enabled: true, message: "That token is not right. It is the exact value of STUDY_AI_ADMIN_TOKEN." }).html);
    return;
  }
  const { secure, partitioned } = cookiePolicy(request);
  const value = signAdminSession(config.token);
  auditLog("login-ok", { ip: clientIp(request) });
  response.writeHead(303, {
    ...adminHeaders({
      "Set-Cookie": adminCookieHeader({ secure, partitioned, value }),
      Location: "/admin",
    }),
  });
  response.end();
}

async function handleAdminLogout(request, response) {
  const session = adminSession(request);
  if (!session || !isSameOriginRequest(request)) {
    response.writeHead(303, { ...adminHeaders({ Location: "/admin" }) }).end();
    return;
  }
  const form = await readForm(request);
  if (!adminFormTokenMatches(form.csrf, session)) {
    sendHtml(request, response, 403, renderAdminLogin({ enabled: true, message: "That sign-out form was out of date. Reload the console and try again." }).html);
    return;
  }
  auditLog("logout", { ip: clientIp(request) });
  const { secure, partitioned } = cookiePolicy(request);
  response.writeHead(303, {
    ...adminHeaders({
      "Set-Cookie": adminCookieHeader({ secure, partitioned, clear: true }),
      Location: "/admin",
    }),
  });
  response.end();
}

async function serveStatic(request, response, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    response.writeHead(400).end("Bad path");
    return;
  }
  const relative = decoded.replace(/^\/+/, "");
  // Never serve account data, backend source, tooling or dotfiles.
  if (
    /^(\.git|server|supabase|node_modules|tools|tests)(\/|$)/.test(relative) ||
    relative.startsWith(".env") ||
    relative === ".gitignore" ||
    relative === "render.yaml" ||
    relative === "serve.mjs"
  ) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  let target = path.resolve(ROOT, relative || "index.html");
  if (!target.startsWith(ROOT + path.sep) && target !== ROOT) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  let stat;
  try {
    stat = await fs.stat(target);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
    return;
  }
  if (stat.isDirectory()) {
    target = path.join(target, "index.html");
    try {
      stat = await fs.stat(target);
    } catch {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
      return;
    }
  }
  const extension = path.extname(target).toLowerCase();
  const contentType = MIME[extension] || "application/octet-stream";
  const noCache = ["sw.js", "index.html", "precache.json", "manifest.webmanifest"].includes(path.basename(target));
  // A ?v= query is a content address for one release, so it can be cached hard.
  // Unversioned files keep a short cache so a fix is never stuck for a year.
  const versioned = new URL(request.url || "/", "http://local").searchParams.has("v");
  const buffer = await fs.readFile(target);
  const headers = {
    ...baseSecurityHeaders(request),
    "Content-Type": contentType,
    "Content-Length": buffer.length,
    "Cache-Control": noCache ? "no-cache" : versioned ? "public, max-age=31536000, immutable" : "public, max-age=3600",
    "Content-Security-Policy": CONTENT_SECURITY_POLICY,
  };
  response.writeHead(200, headers);
  response.end(request.method === "HEAD" ? undefined : buffer);
}

const server = http.createServer(async (request, response) => {
  // Remember the request on the response so JSON helpers can pick HSTS/security
  // headers without threading it through every call site.
  response.__vignanRequest = request;
  let url;
  try {
    url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  } catch {
    response.writeHead(400).end("Bad request");
    return;
  }
  const apiPath = url.pathname.replace(/^\/study-ai(?=\/api\/)/, "");
  if (request.method === "OPTIONS" && apiPath.startsWith("/api/")) {
    sendJson(response, 204, {}, { api: true, corsOrigin: allowedOrigin(request) || false });
    return;
  }
  const unsafeApiRequest = apiPath.startsWith("/api/") && !["GET", "HEAD"].includes(request.method);
  const socialPath = apiPath.startsWith("/api/social/") || apiPath.startsWith("/api/games/");
  const accountMutation = apiPath.startsWith("/api/auth/") || apiPath === "/api/progress" || socialPath;
  if (unsafeApiRequest && (!isSameOriginRequest(request) || (accountMutation && !csrfAllowed(request)))) {
    sendError(response, 403, "Security check failed. Refresh the page and try again.", authOptions(request));
    return;
  }
  const jsonOnly = accountMutation || apiPath === "/api/search" || apiPath === "/api/fetch";
  if (unsafeApiRequest && jsonOnly && !/^application\/json(?:\s*;|\s*$)/i.test(String(request.headers["content-type"] || ""))) {
    sendError(response, 415, "Please send this request as JSON.", authOptions(request));
    return;
  }
  try {
    if (accountsBackend === "unavailable" &&
        (apiPath === "/api/leaderboard" || apiPath === "/api/progress" ||
          ["/api/auth/register", "/api/auth/login", "/api/auth/logout"].includes(apiPath))) {
      sendError(response, 503, "Accounts are temporarily unavailable. You can continue as a guest.", authOptions(request));
      return;
    }
    if (apiPath === "/api/health" && request.method === "GET") {
      const payload = health();
      if (url.searchParams.get("social")) {
        payload.socialCheck = await socialDiagnostics({ fresh: url.searchParams.get("social") === "fresh" });
        payload.socialReady = Boolean(payload.socialCheck.ok);
      }
      sendJson(response, 200, payload, { api: true });
      return;
    }
    if (apiPath === "/api/auth/register" && request.method === "POST") {
      await handleRegister(request, response);
      return;
    }
    if (apiPath === "/api/auth/login" && request.method === "POST") {
      await handleLogin(request, response);
      return;
    }
    if (apiPath === "/api/auth/logout" && request.method === "POST") {
      await handleLogout(request, response);
      return;
    }
    if (apiPath === "/api/auth/me" && request.method === "GET") {
      await handleMe(request, response);
      return;
    }
    if (apiPath === "/api/leaderboard" && request.method === "GET") {
      await handleLeaderboard(request, response);
      return;
    }
    if (apiPath === "/api/progress" && request.method === "POST") {
      await handleProgress(request, response);
      return;
    }
    if (socialPath) {
      if (socialRouter) {
        await socialRouter({ request, response, apiPath, url });
        return;
      }
      sendError(response, 503, "Friends, chat and games are temporarily unavailable.", authOptions(request));
      return;
    }
    if (apiPath === "/api/admin/login" && request.method === "POST") {
      await handleAdminLogin(request, response);
      return;
    }
    if (apiPath === "/api/admin/logout" && request.method === "POST") {
      await handleAdminLogout(request, response);
      return;
    }
    if (apiPath === "/api/ai" && request.method === "POST") {
      await handleAi(request, response);
      return;
    }
    if (apiPath === "/api/search" && request.method === "POST") {
      await handleSearch(request, response);
      return;
    }
    if (apiPath === "/api/fetch" && request.method === "POST") {
      await handleFetch(request, response);
      return;
    }
    // A known endpoint called with the wrong method is a mistake, not a 404.
    // Say which method it wants and give a body that would actually work, so
    // opening /api/ai in a browser tab explains itself instead of looking broken.
    const API_METHODS = {
      "/api/health": ["GET"],
      "/api/ai": ["POST"],
      "/api/search": ["POST"],
      "/api/fetch": ["POST"],
      "/api/auth/register": ["POST"],
      "/api/auth/login": ["POST"],
      "/api/auth/logout": ["POST"],
      "/api/auth/me": ["GET"],
      "/api/leaderboard": ["GET"],
      "/api/progress": ["POST"],
    };
    if (API_METHODS[apiPath]) {
      const allowed = API_METHODS[apiPath];
      const examples = {
        "/api/ai": '{"messages":[{"role":"user","content":"Explain photosynthesis"}]}',
        "/api/search": '{"query":"Kakatiya dynasty"}',
        "/api/fetch": '{"url":"https://example.com/page"}',
      };
      response.setHeader("Allow", allowed.join(", "));
      const example = examples[apiPath];
      sendError(
        response,
        405,
        `${apiPath} accepts ${allowed.join(" or ")} only.` +
          (example ? ` Send a POST with a JSON body such as ${example}.` : " Change the method and try again."),
        authOptions(request),
        example ? { allow: allowed, example } : { allow: allowed },
      );
      return;
    }
    if (apiPath.startsWith("/api/")) {
      sendError(response, 404, `There is no API endpoint at ${apiPath}.`);
      return;
    }
    if (!["GET", "HEAD"].includes(request.method)) {
      response.writeHead(405).end("Method not allowed");
      return;
    }
    if (url.pathname === "/setup" || url.pathname === "/setup/" || url.pathname === "/setup.html") {
      sendSetupPage(request, response);
      return;
    }
    if (url.pathname === "/admin" || url.pathname === "/admin/") {
      await handleAdminPage(request, response);
      return;
    }
    if (url.pathname === "/admin/export") {
      await handleAdminExport(request, response);
      return;
    }
    await serveStatic(request, response, url.pathname);
  } catch (error) {
    if (error instanceof SocialError && !response.headersSent) {
      sendError(response, error.status || 400, error.message, authOptions(request));
      return;
    }
    if (error instanceof RequestBodyError && !response.headersSent) {
      sendError(response, error.status, error.message, authOptions(request));
      return;
    }
    // Log the cause once, in a form that maps onto the front-end message.
    console.error("[vignan-ai] request failed", apiPath, error?.name || "Error", error?.message || "", error?.code || "", error?.table || "");
    if (!response.headersSent) sendError(response, 500, "The server could not complete the request. Please try again.");
    else response.end();
  }
});

server.listen(PORT, HOST, () => {
  const displayHost = HOST === "0.0.0.0" ? "localhost" : HOST;
  const listeningPort = server.address()?.port ?? PORT;
  console.log(`Vignan Vidyanikethan AI is running at http://${displayHost}:${listeningPort}/`);
  console.log(
    `Free AI router: ${AI_UPSTREAMS.length ? `${AI_PROVIDER_IDS.join(" → ")} (${AI_UPSTREAMS.length} providers)` : "not configured (offline engine only)"}`,
  );
  console.log(`Web fallback: ${SEARCH_URL ? "configured provider" : WIKIPEDIA_SEARCH ? "Wikipedia + DuckDuckGo (no key)" : "disabled"}`);
  console.log(
    `Student accounts: ${accountsBackend === "supabase" ? "Supabase Auth + persistent sessions" : accountsBackend === "local" ? "local JSON store (scrypt-hashed)" : "unavailable — check Supabase configuration"}`,
  );
  console.log(`Social layer: ${socialStore ? `friends, chat and 4 games (${socialStore.backend} store)` : "unavailable"}`);
  // A missing Supabase migration is the one social failure worth shouting about
  // at boot: everything else recovers by itself.
  socialDiagnostics({ fresh: true })
    .then((check) => {
      if (check?.ok) console.log(`Social store: ${check.detail || check.backend}`);
      else if (check?.missing?.length) {
        console.warn(`[vignan-ai] Social tables missing (${check.missing.join(", ")}). Run supabase/migrations/20261028000000_vignan_social.sql in the Supabase SQL editor. Friends, chat and games stay unavailable until then.`);
      } else {
        console.warn(`[vignan-ai] Social store check failed: ${check?.detail || "unknown"}. Friends, chat and games may be unavailable.`);
      }
    })
    .catch(() => {});
});
