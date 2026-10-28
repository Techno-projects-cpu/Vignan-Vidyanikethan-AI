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
import { createSupabaseAccountStore } from "./server/supabase-accounts.mjs";
import { ValidationError, cleanUsername, createAccountStore, publicUser, validateLoginPassword, validateUsername } from "./server/accounts.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const env = (name, fallback = "") => process.env[`STUDY_AI_${name}`] ?? process.env[`VIGNAN_AI_${name}`] ?? fallback;
const HOST = env("HOST") || "0.0.0.0";
const PORT = Number(env("PORT") || process.env.PORT || 4173);
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const ACCOUNTS_FILE = env("ACCOUNTS_FILE") || path.join(ROOT, "server", "data", "accounts.json");
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
const SEARCH_TOKEN = env("SEARCH_TOKEN");
const SEARCH_TOKEN_HEADER = env("SEARCH_TOKEN_HEADER") || "Authorization";
const ALLOWED_ORIGINS = new Set(
  String(env("ALLOWED_ORIGINS") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);

const SUPABASE_URL = String(process.env.SUPABASE_URL || env("SUPABASE_URL") || "").trim();
const SUPABASE_ANON_KEY = String(process.env.SUPABASE_ANON_KEY || env("SUPABASE_ANON_KEY") || "").trim();
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || env("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
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
if (accountsBackend === "unavailable") {
  console.warn("[vignan-ai] Supabase configuration is missing or invalid; accounts are unavailable until it is corrected. Guest mode remains available.");
}
const accounts = useSupabase
  ? createSupabaseAccountStore({
      url: SUPABASE_URL,
      anonKey: SUPABASE_ANON_KEY,
      serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
      emailDomain: SUPABASE_EMAIL_DOMAIN,
    })
  : accountsBackend === "local" ? createAccountStore(ACCOUNTS_FILE) : null;

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
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": body.length,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Cross-Origin-Resource-Policy": "same-origin",
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

async function handleSearch(request, response) {
  if (!rateLimit(request, "search", SEARCH_RATE_LIMIT, 60_000)) {
    sendError(response, 429, "Too many search requests from this network. Please try again in a minute.");
    return;
  }
  if (!SEARCH_URL) {
    sendError(
      response,
      501,
      "Web fallback is not configured. Set STUDY_AI_SEARCH_URL to a JSON search endpoint with a {q} placeholder.",
    );
    return;
  }
  const body = await readJson(request);
  const query = String(body.query || "").trim().slice(0, 300);
  if (!query) {
    sendError(response, 400, "A query is required.");
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
    const raw = await upstream.text();
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
        message: results.length ? "" : "No outside results found for this question.",
      },
      { api: true },
    );
  } catch (error) {
    sendError(response, 502, "Could not reach the search provider. Try again later.");
  }
}

function health() {
  return {
    ok: true,
    version: "1.7.1",
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
    search: Boolean(SEARCH_URL),
    accounts: accountsBackend !== "unavailable",
    accountsBackend,
    offlineReady: true,
    localAI: {
      runtime: "webllm",
      bundled: true,
      models: ["SmolLM2-135M", "SmolLM2-360M", "Llama-3.2-1B", "Qwen2.5-0.5B"],
    },
    time: new Date().toISOString(),
  };
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
  const noCache = ["sw.js", "index.html", "precache.json", "manifest.webmanifest", "demo-textbook.txt"].includes(path.basename(target));
  const buffer = await fs.readFile(target);
  const headers = {
    "Content-Type": contentType,
    "Content-Length": buffer.length,
    "Cache-Control": noCache ? "no-cache" : "public, max-age=3600",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Content-Security-Policy": CONTENT_SECURITY_POLICY,
  };
  response.writeHead(200, headers);
  response.end(request.method === "HEAD" ? undefined : buffer);
}

const server = http.createServer(async (request, response) => {
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
  const accountMutation = apiPath.startsWith("/api/auth/") || apiPath === "/api/progress";
  if (unsafeApiRequest && (!isSameOriginRequest(request) || (accountMutation && !csrfAllowed(request)))) {
    sendError(response, 403, "Security check failed. Refresh the page and try again.", authOptions(request));
    return;
  }
  if (unsafeApiRequest && accountMutation && !/^application\/json(?:\s*;|\s*$)/i.test(String(request.headers["content-type"] || ""))) {
    sendError(response, 415, "Please send account requests as JSON.", authOptions(request));
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
      sendJson(response, 200, health(), { api: true });
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
    if (apiPath === "/api/ai" && request.method === "POST") {
      await handleAi(request, response);
      return;
    }
    if (apiPath === "/api/search" && request.method === "POST") {
      await handleSearch(request, response);
      return;
    }
    if (apiPath.startsWith("/api/")) {
      sendError(response, 404, "Unknown API endpoint.");
      return;
    }
    if (!["GET", "HEAD"].includes(request.method)) {
      response.writeHead(405).end("Method not allowed");
      return;
    }
    await serveStatic(request, response, url.pathname);
  } catch (error) {
    if (error instanceof RequestBodyError && !response.headersSent) {
      sendError(response, error.status, error.message, authOptions(request));
      return;
    }
    console.error("[vignan-ai] request failed", apiPath, error?.name || "Error");
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
  console.log(`Web fallback: ${SEARCH_URL ? "configured" : "not configured"}`);
  console.log(
    `Student accounts: ${accountsBackend === "supabase" ? "Supabase Auth + persistent sessions" : accountsBackend === "local" ? "local JSON store (scrypt-hashed)" : "unavailable — check Supabase configuration"}`,
  );
});
