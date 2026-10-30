import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { hashPassword } from "../server/accounts.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));

function setCookies(response) {
  if (typeof response.headers.getSetCookie === "function") return response.headers.getSetCookie();
  const value = response.headers.get("set-cookie") || "";
  return value ? value.split(/,(?=\s*[^;,\s]+=)/) : [];
}
function cookieValue(response, name) {
  const line = setCookies(response).find((item) => item.startsWith(`${name}=`));
  return line ? line.split(";")[0].slice(name.length + 1) : "";
}
function cookieHeader(csrf, session = "") {
  return `vignan_csrf=${csrf}${session ? `; vignan_session=${session}` : ""}`;
}

async function startServer(t, overrides = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "vignan-http-test-"));
  const accountFile = path.join(directory, "accounts.json");
  const legacy = {
    id: "usr_legacy", username: "oldstudent", passwordHash: await hashPassword("oldpass1"),
    ageBand: "13-15", gender: "prefer-not", avatarSeed: 1, xp: 0, streak: 0, best: 0,
    quizzes: 0, totalCorrect: 0, totalQuestions: 0, referrals: 0, history: [], createdAt: "2026-01-01T00:00:00Z",
  };
  await fs.writeFile(accountFile, JSON.stringify({ version: 1, users: [legacy] }));
  const child = spawn(process.execPath, ["serve.mjs"], {
    cwd: root,
    env: {
      ...process.env,
      STUDY_AI_HOST: "127.0.0.1", STUDY_AI_PORT: "0", STUDY_AI_ACCOUNTS_BACKEND: "local",
      STUDY_AI_ACCOUNTS_FILE: accountFile, STUDY_AI_COOKIE_SECURE: "true", STUDY_AI_TRUST_PROXY: "false",
      STUDY_AI_ALLOWED_ORIGINS: "", STUDY_AI_SEARCH_URL: "", STUDY_AI_WIKIPEDIA_SEARCH: "false", STUDY_AI_GEMINI_KEY: "", STUDY_AI_GROQ_KEY: "",
      ...overrides,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stderr.on("data", (chunk) => { output += chunk; });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
      await Promise.race([once(child, "exit"), new Promise((resolve) => setTimeout(resolve, 2000))]);
    }
    await fs.rm(directory, { recursive: true, force: true });
  });
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Server did not start: ${output}`)), 8000);
    child.stdout.on("data", (chunk) => {
      output += chunk;
      const match = output.match(/running at http:\/\/127\.0\.0\.1:(\d+)\//);
      if (match) { clearTimeout(timer); resolve(Number(match[1])); }
    });
    child.once("exit", (code) => { clearTimeout(timer); reject(new Error(`Server exited ${code}: ${output}`)); });
  });
  return `http://127.0.0.1:${port}`;
}

test("account HTTP endpoints enforce CSRF, safe cookies, rate limits and preserve AI routes", async (t) => {
  const base = await startServer(t);
  const get = (route, headers = {}) => fetch(`${base}${route}`, { headers });
  const post = (route, body, { origin = base, csrf = "", session = "", contentType = "application/json", token = csrf } = {}) =>
    fetch(`${base}${route}`, {
      method: "POST",
      headers: { Origin: origin, "Content-Type": contentType, Cookie: cookieHeader(csrf, session), ...(token ? { "X-CSRF-Token": token } : {}) },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });

  const page = await get("/");
  const csp = page.headers.get("content-security-policy");
  assert.match(csp, /script-src 'self' 'wasm-unsafe-eval'/);
  assert.match(csp, /object-src 'none'/);
  assert.doesNotMatch(csp, /frame-ancestors/); // The Arena live preview embeds the page.
  assert.equal(page.headers.get("x-content-type-options"), "nosniff");
  assert.equal((await get("/.env.example")).status, 403);
  const sitemap = await get("/sitemap.xml");
  assert.equal(sitemap.status, 200);
  assert.match(sitemap.headers.get("content-type"), /^application\/xml/);
  assert.match(await sitemap.text(), /<urlset/);
  const robots = await get("/robots.txt");
  assert.equal(robots.status, 200);
  assert.match(await robots.text(), /Sitemap: https:/);
  const icon = await get("/icons/icon.svg?v=38");
  assert.equal(icon.status, 200);
  assert.match(icon.headers.get("content-type"), /^image\/svg\+xml/);

  const initial = await get("/api/auth/me", { Origin: base });
  const initialData = await initial.json();
  let csrf = cookieValue(initial, "vignan_csrf");
  assert.match(csrf, /^[a-f0-9]{64}$/);
  assert.equal(initialData.csrfToken, csrf);
  assert.match(setCookies(initial).find((item) => item.startsWith("vignan_csrf=")), /SameSite=Strict/);
  assert.equal((await get("/api/auth/me", { Cookie: "bad=%E0%A4%A" })).status, 200);

  assert.equal((await post("/api/auth/login", { username: "oldstudent", password: "oldpass1" }, { csrf, token: "" })).status, 403);
  const crossSite = await post("/api/auth/login", { username: "oldstudent", password: "oldpass1" }, { csrf, origin: "https://attacker.example" });
  assert.equal(crossSite.status, 403);
  assert.equal(crossSite.headers.get("access-control-allow-origin"), null);
  assert.equal((await post("/api/auth/login", "{}", { csrf, contentType: "text/plain" })).status, 415);
  assert.equal((await post("/api/auth/login", "not-json", { csrf })).status, 400);
  assert.equal((await post("/api/auth/login", "null", { csrf })).status, 400);

  const registration = { username: "test-child", password: "unique paper lantern 74", age: 11, gender: "prefer-not" };
  assert.equal((await post("/api/auth/register", registration, { csrf })).status, 400, "under-13 signup needs a confirmation");
  const registered = await post("/api/auth/register", { ...registration, guardianConsent: true }, { csrf });
  assert.equal(registered.status, 201);
  const registeredData = await registered.json();
  assert.equal(registeredData.user.username, "test-child");
  const session1 = cookieValue(registered, "vignan_session");
  csrf = cookieValue(registered, "vignan_csrf");
  assert.match(session1, /^[a-f0-9]{64}$/);
  const sessionCookie = setCookies(registered).find((item) => item.startsWith("vignan_session="));
  assert.match(sessionCookie, /HttpOnly/);
  assert.match(sessionCookie, /SameSite=Lax/);
  assert.match(sessionCookie, /Secure/);
  assert.equal(registeredData.csrfToken, csrf);
  const me = await (await get("/api/auth/me", { Cookie: cookieHeader(csrf, session1), Origin: base })).json();
  assert.equal(me.user.username, "test-child");

  const loggedIn = await post("/api/auth/login", { username: registration.username, password: registration.password }, { csrf, session: session1 });
  assert.equal(loggedIn.status, 200);
  const session2 = cookieValue(loggedIn, "vignan_session");
  const newCsrf = cookieValue(loggedIn, "vignan_csrf");
  assert.notEqual(session2, session1);
  assert.notEqual(newCsrf, csrf);
  csrf = newCsrf;
  const revoked = await (await get("/api/auth/me", { Cookie: cookieHeader(csrf, session1), Origin: base })).json();
  assert.equal(revoked.user, null, "previous session is revoked at login");
  const progress = await post("/api/progress", { result: { topic: "Forces", total: 3, score: 2, xp: 20 } }, { csrf, session: session2 });
  assert.equal(progress.status, 200);
  assert.equal((await progress.json()).user.quizzes, 1);
  assert.notEqual((await post("/api/ai", { messages: [{ role: "user", content: "Hello" }] }, { csrf: "" })).status, 403);
  assert.notEqual((await post("/api/search", { query: "textbook" }, { csrf: "" })).status, 403);
  assert.equal((await post("/api/ai", { messages: [] }, { csrf: "", origin: "https://attacker.example" })).status, 403);

  const loggedOut = await post("/api/auth/logout", {}, { csrf, session: session2 });
  assert.equal(loggedOut.status, 200);
  csrf = cookieValue(loggedOut, "vignan_csrf");
  const afterLogout = await (await get("/api/auth/me", { Cookie: cookieHeader(csrf, session2), Origin: base })).json();
  assert.equal(afterLogout.user, null);
  const legacyLogin = await post("/api/auth/login", { username: "oldstudent", password: "oldpass1" }, { csrf });
  assert.equal(legacyLogin.status, 200, "existing shorter passwords still work");
  csrf = cookieValue(legacyLogin, "vignan_csrf");
  const session3 = cookieValue(legacyLogin, "vignan_session");
  for (let attempt = 0; attempt < 6; attempt++) {
    const failed = await post("/api/auth/login", { username: "unknownstudent", password: "incorrect" }, { csrf, session: session3 });
    assert.equal(failed.status, 401);
  }
  assert.equal((await post("/api/auth/login", { username: "unknownstudent", password: "incorrect" }, { csrf, session: session3 })).status, 429);
});

test("incomplete Supabase settings fail closed and keep guest mode available", async (t) => {
  const base = await startServer(t, {
    STUDY_AI_ACCOUNTS_BACKEND: "supabase",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_ANON_KEY: "<Project Settings → API → anon>",
    SUPABASE_SERVICE_ROLE_KEY: "<Project Settings → API → service_role>",
  });
  const health = await (await fetch(`${base}/api/health`)).json();
  assert.equal(health.accountsBackend, "unavailable");
  assert.equal(health.accounts, false);
  const session = await fetch(`${base}/api/auth/me`);
  const data = await session.json();
  assert.equal(data.guest, true);
  assert.equal(data.accountsAvailable, false);
  const csrf = cookieValue(session, "vignan_csrf");
  const login = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json", Cookie: cookieHeader(csrf), "X-CSRF-Token": csrf },
    body: JSON.stringify({ username: "oldstudent", password: "oldpass1" }),
  });
  assert.equal(login.status, 503);
  assert.match((await login.json()).error, /guest/i);
  assert.equal((await fetch(`${base}/`)).status, 200);
});

test("AI proxy rate limits cannot be bypassed with untrusted forwarded IP headers", async (t) => {
  const base = await startServer(t, { STUDY_AI_AI_RATE_LIMIT: "2", STUDY_AI_TRUST_PROXY: "false" });
  const call = (forwarded) => fetch(`${base}/api/ai`, {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json", "X-Forwarded-For": forwarded },
    body: JSON.stringify({ messages: [{ role: "user", content: "test" }] }),
  });
  assert.notEqual((await call("198.51.100.1")).status, 429);
  assert.notEqual((await call("198.51.100.2")).status, 429);
  assert.equal((await call("198.51.100.3")).status, 429);
});

test("HTTPS preview cookies work in an embedded partition without weakening normal cookies", async (t) => {
  const base = await startServer(t);
  const host = "4173-test-preview.e2b.app";
  const origin = `https://${host}`;
  const proxyHeaders = { Host: host, Origin: origin, "X-Forwarded-Proto": "https" };
  const request = (route, { method = "GET", headers = {}, body = "" } = {}) => new Promise((resolve, reject) => {
    const req = http.request(`${base}${route}`, { method, headers: { ...proxyHeaders, ...headers } }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, cookies: res.headers["set-cookie"] || [], body: Buffer.concat(chunks).toString() }));
    });
    req.on("error", reject);
    req.end(body);
  });
  const session = await request("/api/auth/me");
  const csrfCookie = session.cookies.find((item) => item.startsWith("vignan_csrf="));
  const csrf = csrfCookie.split(";")[0].slice("vignan_csrf=".length);
  assert.match(csrfCookie, /SameSite=None/);
  assert.match(csrfCookie, /Secure/);
  assert.match(csrfCookie, /Partitioned/);
  const registration = await request("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader(csrf), "X-CSRF-Token": csrf },
    body: JSON.stringify({ username: "preview-student", password: "a unique preview passphrase", age: 14 }),
  });
  assert.equal(registration.status, 201);
  const sessionCookie = registration.cookies.find((item) => item.startsWith("vignan_session="));
  assert.match(sessionCookie, /HttpOnly/);
  assert.match(sessionCookie, /SameSite=None/);
  assert.match(sessionCookie, /Secure/);
  assert.match(sessionCookie, /Partitioned/);
});

test("Render rate limiting distinguishes verified Cloudflare client addresses", async (t) => {
  const base = await startServer(t, { RENDER: "true", STUDY_AI_TRUST_PROXY: "true", STUDY_AI_AI_RATE_LIMIT: "1" });
  const call = (client) => fetch(`${base}/api/ai`, {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json", "CF-Connecting-IP": client, "X-Forwarded-For": "198.51.100.99" },
    body: JSON.stringify({ messages: [{ role: "user", content: "test" }] }),
  });
  assert.notEqual((await call("203.0.113.1")).status, 429);
  assert.notEqual((await call("203.0.113.2")).status, 429);
  assert.equal((await call("203.0.113.1")).status, 429);
});

test("Supabase keys work under both the legacy and the renamed variable names", async () => {
  const server = await fs.readFile(path.join(root, "serve.mjs"), "utf8");
  assert.match(server, /"SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY"/);
  assert.match(server, /"SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"/);
  assert.match(server, /sb_publishable_/);
  assert.match(server, /sb_secret_/);
  // Diagnostics name the variable, never echo its value.
  assert.match(server, /accountsConfig/);
  assert.match(server, /missing: supabaseMissing/);
});

test("the health payload can tell an operator which variable is wrong", async () => {
  const port = 4930 + Math.floor(Math.random() * 40);
  const child = spawn(process.execPath, ["serve.mjs"], {
    cwd: new URL("..", import.meta.url).pathname,
    env: {
      ...process.env,
      STUDY_AI_PORT: String(port),
      STUDY_AI_ACCOUNTS_BACKEND: "supabase",
      SUPABASE_URL: "",
      SUPABASE_ANON_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      SUPABASE_PUBLISHABLE_KEY: "",
      SUPABASE_SECRET_KEY: "",
    },
    stdio: "ignore",
  });
  try {
    let body = null;
    for (let attempt = 0; attempt < 40 && !body; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      try {
        const response = await fetch(`http://127.0.0.1:${port}/api/health`);
        if (response.ok) body = await response.json();
      } catch { /* not listening yet */ }
    }
    assert.ok(body, "health endpoint did not answer");
    assert.equal(body.accounts, false);
    assert.equal(body.accountsBackend, "unavailable");
    assert.ok(Array.isArray(body.accountsConfig.missing), "missing list should be an array");
    assert.ok(body.accountsConfig.missing.some((name) => name.includes("SUPABASE_URL")));
    assert.ok(body.accountsConfig.missing.some((name) => name.includes("SUPABASE_ANON_KEY")));
    assert.doesNotMatch(JSON.stringify(body.accountsConfig), /sb_secret_|eyJ/, "no key value should be echoed");
  } finally {
    child.kill("SIGKILL");
  }
});

async function withServer(env, run) {
  const port = 5000 + Math.floor(Math.random() * 400);
  const child = spawn(process.execPath, ["serve.mjs"], {
    cwd: root,
    env: { ...process.env, STUDY_AI_PORT: String(port), ...env },
    stdio: "ignore",
  });
  try {
    let ready = false;
    for (let attempt = 0; attempt < 60 && !ready; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 120));
      try {
        const probe = await fetch(`http://127.0.0.1:${port}/api/health`);
        ready = probe.ok;
      } catch { /* still starting */ }
    }
    assert.ok(ready, "server did not start");
    return await run(`http://127.0.0.1:${port}`);
  } finally {
    child.kill("SIGKILL");
  }
}

const NO_SUPABASE = {
  STUDY_AI_ACCOUNTS_BACKEND: "supabase",
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  SUPABASE_PUBLISHABLE_KEY: "",
  SUPABASE_SECRET_KEY: "",
};

test("/setup names the missing variables and never prints a key", async () => {
  await withServer(NO_SUPABASE, async (origin) => {
    const response = await fetch(`${origin}/setup`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/html/);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.match(response.headers.get("x-content-type-options"), /nosniff/);
    assert.match(response.headers.get("content-security-policy"), /default-src 'self'/);
    const html = await response.text();
    assert.match(html, /Accounts are not connected yet/);
    for (const name of ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
      assert.match(html, new RegExp(name), `${name} should be listed`);
    }
    assert.match(html, /class="state bad">fix</);
    assert.match(html, /Settings, then API Keys/, "should name the current dashboard page");
    assert.doesNotMatch(html, /Settings \u2192 API/, "the removed Settings -> API page must not be mentioned");
    assert.match(html, /noindex/);
  });
});

test("/setup spots a publishable key in the secret slot, without echoing it", async () => {
  const publishable = ["sb", "publishable", "AbCdEfGhIjKlMnOpQrStUvWxYz"].join("_");
  await withServer({
    ...NO_SUPABASE,
    SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
    SUPABASE_ANON_KEY: publishable,
    SUPABASE_SERVICE_ROLE_KEY: publishable,
  }, async (origin) => {
    const html = await (await fetch(`${origin}/setup`)).text();
    assert.match(html, /SUPABASE_SERVICE_ROLE_KEY<\/code> holds a <strong>publishable<\/strong> key/);
    assert.doesNotMatch(html, new RegExp(publishable), "the page must never contain the key");
    assert.match(html, /Refresh|refreshes every 15 seconds/);
  });
});

test("/setup reports a connected deployment honestly", async () => {
  await withServer({
    STUDY_AI_ACCOUNTS_BACKEND: "local",
    STUDY_AI_ACCOUNTS_FILE: path.join(os.tmpdir(), `vignan-setup-${Date.now()}.json`),
  }, async (origin) => {
    const html = await (await fetch(`${origin}/setup`)).text();
    assert.match(html, /local/);
    assert.match(html, /offline mode/);
    assert.match(html, /Machine-readable health/);
  });
});

test("a known endpoint called with the wrong method explains itself", async () => {
  await withServer({ STUDY_AI_ACCOUNTS_FILE: path.join(os.tmpdir(), `vignan-method-${Date.now()}.json`) }, async (origin) => {
    const response = await fetch(`${origin}/api/ai`);
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("allow"), "POST");
    const body = await response.json();
    assert.equal(body.ok, false);
    assert.match(body.error, /\/api\/ai accepts POST only/);
    assert.match(body.error, /messages/);
    assert.deepEqual(body.allow, ["POST"]);
    assert.match(body.example, /messages/);

    const health = await fetch(`${origin}/api/health`, { method: "POST" });
    assert.equal(health.status, 405);
    assert.equal(health.headers.get("allow"), "GET");

    const unknown = await fetch(`${origin}/api/does-not-exist`);
    assert.equal(unknown.status, 404);
    assert.match((await unknown.json()).error, /no API endpoint at \/api\/does-not-exist/);
  });
});

test("pages avoid glyphs the bundled latin fonts cannot draw", async () => {
  // The two bundled subsets stop at latin: the rupee sign, arrows, ticks and
  // crosses fall back to a system font, and on some Android phones that shows
  // as a box. These pages are read by judges, so keep them font-safe.
  const unsafe = ["\u20B9", "\u2713", "\u2715", "\u2716", "\u2714", "\u2192", "\u00D7"];
  const files = ["judge.html", "security.html", "copyright.html"];
  for (const file of files) {
    const text = await fs.readFile(path.join(root, file), "utf8");
    for (const glyph of unsafe) {
      assert.ok(!text.includes(glyph), `${file} contains ${JSON.stringify(glyph)}, which the bundled font cannot draw`);
    }
  }
  await withServer(NO_SUPABASE, async (origin) => {
    const html = await (await fetch(`${origin}/setup`)).text();
    for (const glyph of unsafe) {
      assert.ok(!html.includes(glyph), `/setup contains ${JSON.stringify(glyph)}`);
    }
    assert.match(html, /class="state bad">fix</);
  });
});

test("/setup reports every problem at once, not one per reload", async () => {
  await withServer(NO_SUPABASE, async (origin) => {
    const html = await (await fetch(`${origin}/setup`)).text();
    for (const variable of ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
      assert.match(html, new RegExp(`<li><code>${variable}</code>`), `${variable} should have its own fix`);
    }
  });
});

test("/setup does not call a working local store broken", async () => {
  await withServer({
    STUDY_AI_ACCOUNTS_FILE: path.join(os.tmpdir(), `vignan-local-${Date.now()}.json`),
  }, async (origin) => {
    const html = await (await fetch(`${origin}/setup`)).text();
    assert.match(html, /Accounts are working on this server's local store/);
    assert.match(html, /optional in this mode/);
    assert.doesNotMatch(html, /Accounts are not connected yet/);
  });
});
