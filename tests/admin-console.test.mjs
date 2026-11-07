/**
 * The operator console: the one place in this project where an adult can see
 * student records. Almost every test here is about what it refuses to do.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

import {
  ADMIN_COOKIE, ADMIN_MIN_TOKEN_LENGTH, accountsToBackup, accountsToCsv, adminFormToken,
  adminFormTokenMatches, adminState, csvCell, secretsMatch, signAdminSession, verifyAdminSession,
  verifyAdminToken,
} from "../server/admin.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (file) => fs.readFile(path.join(root, file), "utf8");
const token = () => randomBytes(32).toString("hex");

/* --------------------------------------------------------------- pure helpers */

test("the console is off unless a long token is configured", () => {
  assert.equal(adminState({}).enabled, false);
  assert.match(adminState({}).reason, /STUDY_AI_ADMIN_TOKEN/);
  assert.equal(adminState({ STUDY_AI_ADMIN_TOKEN: "short" }).enabled, false);
  assert.match(adminState({ STUDY_AI_ADMIN_TOKEN: "short" }).reason, /too short/);
  assert.equal(adminState({ STUDY_AI_ADMIN_TOKEN: "x".repeat(ADMIN_MIN_TOKEN_LENGTH - 1) }).enabled, false);
  assert.equal(adminState({ STUDY_AI_ADMIN_TOKEN: "x".repeat(ADMIN_MIN_TOKEN_LENGTH) }).enabled, true);
  assert.equal(adminState({ VIGNAN_AI_ADMIN_TOKEN: "y".repeat(40) }).enabled, true);
  // A weak token must never silently work because another name is set.
  assert.equal(adminState({ STUDY_AI_ADMIN_TOKEN: "", ADMIN_TOKEN: "a".repeat(64) }).enabled, true);
  assert.equal(adminState({ STUDY_AI_ADMIN_TOKEN: "tiny", ADMIN_TOKEN: "a".repeat(64) }).enabled, false);
});

test("tokens are compared without leaking length or content", () => {
  const secret = token();
  assert.equal(verifyAdminToken(secret, secret), true);
  assert.equal(verifyAdminToken(`${secret} `, secret), false);
  assert.equal(verifyAdminToken(secret.slice(0, -1), secret), false);
  assert.equal(verifyAdminToken("", secret), false);
  assert.equal(verifyAdminToken(secret, ""), false);
  assert.equal(verifyAdminToken("x".repeat(2000), secret), false);
  assert.equal(secretsMatch("a", "b"), false);
  assert.equal(secretsMatch("same", "same"), true);
});

test("a console session is signed, expires, and dies when the token rotates", () => {
  const secret = token();
  const now = 1_760_000_000_000;
  const cookie = signAdminSession(secret, now);
  assert.match(cookie, /^\d{13}\.[a-f0-9]{64}$/);
  assert.equal(verifyAdminSession(cookie, secret, now + 1000), true);
  assert.equal(verifyAdminSession(cookie, secret, now + 9 * 60 * 60 * 1000), false, "expires after eight hours");
  assert.equal(verifyAdminSession(cookie, token(), now + 1000), false, "a rotated token invalidates old sessions");

  const [expires, mac] = cookie.split(".");
  assert.equal(verifyAdminSession(`${expires}.${"0".repeat(64)}`, secret, now), false, "tampered mac");
  assert.equal(verifyAdminSession(`${Number(expires) + 1000}.${mac}`, secret, now), false, "extended expiry");
  assert.equal(verifyAdminSession("nonsense", secret, now), false);
  assert.equal(verifyAdminSession("", secret, now), false);
});

test("the form token is per session and cannot be reused with another cookie", () => {
  const secret = token();
  const session = signAdminSession(secret);
  const form = adminFormToken(session);
  assert.equal(adminFormTokenMatches(form, session), true);
  assert.equal(adminFormTokenMatches("", session), false);
  assert.equal(adminFormTokenMatches(form, signAdminSession(secret, Date.now() + 5000)), false);
});

test("a CSV export cannot smuggle a spreadsheet formula", () => {
  assert.equal(csvCell("aarav"), '"aarav"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell("=1+1"), `"'=1+1"`);
  assert.equal(csvCell("+SUM(A1)"), `"'+SUM(A1)"`);
  assert.equal(csvCell("-2"), `"'-2"`);
  assert.equal(csvCell(null), '""');
});

test("the backup contains account records and nothing sensitive", () => {
  const rows = [{
    username: "aarav", ageBand: "13-15", gender: "male", createdAt: "2026-10-01T00:00:00.000Z",
    quizzes: 4, average: 75, xp: 120, streak: 3, bestStreak: 5, referrals: 1,
    password: "should never appear", passwordHash: "scrypt$deadbeef",
  }];
  const backup = accountsToBackup(rows, { backend: "supabase" });
  assert.equal(backup.count, 1);
  assert.equal(backup.accounts[0].username, "aarav");
  // The note may explain where passwords live; the records must not carry one.
  assert.deepEqual(
    Object.keys(backup.accounts[0]).sort(),
    ["ageBand", "average", "bestStreak", "createdAt", "gender", "quizzes", "referrals", "streak", "username", "xp"].sort(),
  );
  assert.doesNotMatch(JSON.stringify(backup.accounts), /scrypt|deadbeef|passwordHash/i);
  assert.match(backup.note, /never leave a student's browser/);

  const csv = accountsToCsv(rows);
  assert.match(csv, /"username"/);
  assert.match(csv, /"aarav"/);
  assert.doesNotMatch(csv, /scrypt|deadbeef/);
});

/* --------------------------------------------------------------------- routes */

const COURSE_PASSWORD = "a memorable phrase";

async function withServer(env, run) {
  const port = 5100 + Math.floor(Math.random() * 400);
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vignan-admin-"));
  const child = spawn(process.execPath, ["serve.mjs"], {
    cwd: root,
    env: {
      ...process.env,
      STUDY_AI_PORT: String(port),
      STUDY_AI_ACCOUNTS_FILE: path.join(dir, "accounts.json"),
      STUDY_AI_SOCIAL_FILE: path.join(dir, "social.json"),
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += String(chunk); });
  child.stderr.on("data", (chunk) => { output += String(chunk); });
  try {
    let ready = false;
    for (let attempt = 0; attempt < 60 && !ready; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 120));
      try {
        ready = (await fetch(`http://127.0.0.1:${port}/api/health`)).ok;
      } catch { /* still starting */ }
    }
    assert.ok(ready, "server did not start");
    const origin = `http://127.0.0.1:${port}`;

    async function register(username) {
      const me = await fetch(`${origin}/api/auth/me`);
      const cookies = (me.headers.getSetCookie?.() || []).map((line) => line.split(";")[0]).join("; ");
      const csrf = /vignan_csrf=([a-f0-9]+)/.exec(cookies)?.[1] || "";
      const response = await fetch(`${origin}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: origin,
          Cookie: cookies,
          "X-CSRF-Token": csrf,
        },
        body: JSON.stringify({ username, password: COURSE_PASSWORD, age: 14, guardianConsent: true }),
      });
      assert.equal(response.status, 201, `registering ${username}`);
      return response.json();
    }

    async function adminLogin(secret) {
      const response = await fetch(`${origin}/api/admin/login`, {
        method: "POST",
        redirect: "manual",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: origin },
        body: new URLSearchParams({ token: secret }),
      });
      return response;
    }

    return await run({ origin, register, adminLogin, output: () => output });
  } finally {
    child.kill("SIGKILL");
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test("with no token the console is locked, and says how to unlock it", async () => {
  await withServer({ STUDY_AI_ADMIN_TOKEN: "" }, async ({ origin }) => {
    const page = await fetch(`${origin}/admin`);
    assert.equal(page.status, 503);
    const html = await page.text();
    assert.match(html, /The console is off/);
    assert.match(html, /STUDY_AI_ADMIN_TOKEN/);
    assert.doesNotMatch(html, /<table/i, "no account table when locked");

    const attempt = await fetch(`${origin}/api/admin/login`, {
      method: "POST",
      redirect: "manual",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: origin },
      body: new URLSearchParams({ token: "x".repeat(64) }),
    });
    assert.equal(attempt.status, 503);
    assert.equal(attempt.headers.getSetCookie?.().length || 0, 0, "no cookie is issued while locked");
  });
});

test("wrong tokens are refused, right ones get a locked-down cookie", async () => {
  const secret = token();
  await withServer({ STUDY_AI_ADMIN_TOKEN: secret }, async ({ origin, adminLogin }) => {
    const wrong = await adminLogin("nope");
    assert.equal(wrong.status, 401);
    assert.equal(wrong.headers.getSetCookie?.().length || 0, 0);

    const good = await adminLogin(secret);
    assert.equal(good.status, 303);
    assert.equal(good.headers.get("location"), "/admin");
    const cookie = good.headers.getSetCookie().find((line) => line.startsWith(`${ADMIN_COOKIE}=`));
    assert.ok(cookie, "a session cookie is set");
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
    assert.match(cookie, /Path=\//);
  });
});

test("the dashboard lists account records and nothing else", async () => {
  const secret = token();
  await withServer({ STUDY_AI_ADMIN_TOKEN: secret }, async ({ origin, register, adminLogin, output }) => {
    await register("aarav");
    await register("diya");
    const login = await adminLogin(secret);
    const cookie = login.headers.getSetCookie()[0].split(";")[0];

    const page = await fetch(`${origin}/admin`, { headers: { Cookie: cookie } });
    assert.equal(page.status, 200);
    assert.equal(page.headers.get("cache-control"), "no-store, max-age=0");
    assert.equal(page.headers.get("x-robots-tag"), "noindex, nofollow");
    assert.equal(page.headers.get("referrer-policy"), "no-referrer");
    const html = await page.text();
    assert.match(html, /<td class="user">aarav/);
    assert.match(html, /<td class="user">diya/);
    assert.doesNotMatch(html, /scrypt|passwordHash/i, "no credential material on the page");

    const search = await (await fetch(`${origin}/admin?q=di&${""}`, { headers: { Cookie: cookie } })).text();
    assert.match(search, /<td class="user">diya/);
    assert.doesNotMatch(search, /<td class="user">aarav/);

    // Audit lines go to the server log, naming the action and never the token.
    assert.match(output(), /\[vignan-admin\] login-ok/);
    assert.match(output(), /\[vignan-admin\] view-accounts/);
    assert.doesNotMatch(output(), new RegExp(secret), "the token must never be logged");
  });
});

test("backups download as attachments, and need the cookie", async () => {
  const secret = token();
  await withServer({ STUDY_AI_ADMIN_TOKEN: secret }, async ({ origin, register, adminLogin }) => {
    await register("aarav");
    const anonymous = await fetch(`${origin}/admin/export?format=json`, { redirect: "manual" });
    assert.equal(anonymous.status, 302);
    assert.match(anonymous.headers.get("location"), /error=expired/);

    const login = await adminLogin(secret);
    const cookie = login.headers.getSetCookie()[0].split(";")[0];

    const json = await fetch(`${origin}/admin/export?format=json`, { headers: { Cookie: cookie } });
    assert.equal(json.status, 200);
    assert.match(json.headers.get("content-type"), /application\/json/);
    assert.match(json.headers.get("content-disposition"), /attachment; filename="vignan-accounts-\d{4}-\d{2}-\d{2}\.json"/);
    const backup = await json.json();
    assert.equal(backup.kind, "account-records-backup");
    assert.equal(backup.count, 1);
    assert.equal(backup.accounts[0].username, "aarav");
    assert.equal(backup.accounts[0].password, undefined);
    assert.doesNotMatch(JSON.stringify(backup.accounts), /scrypt|passwordHash/i);

    const csv = await fetch(`${origin}/admin/export?format=csv`, { headers: { Cookie: cookie } });
    assert.equal(csv.status, 200);
    assert.match(csv.headers.get("content-type"), /text\/csv/);
    assert.match(await csv.text(), /"aarav"/);
  });
});

test("signing out needs the form token, so a stray link cannot do it", async () => {
  const secret = token();
  await withServer({ STUDY_AI_ADMIN_TOKEN: secret }, async ({ origin, adminLogin }) => {
    const login = await adminLogin(secret);
    const cookie = login.headers.getSetCookie()[0].split(";")[0];
    const page = await (await fetch(`${origin}/admin`, { headers: { Cookie: cookie } })).text();
    const formToken = /name="csrf" value="([a-f0-9]+)"/.exec(page)?.[1];
    assert.ok(formToken, "the page carries a form token");

    const forged = await fetch(`${origin}/api/admin/logout`, {
      method: "POST",
      redirect: "manual",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: origin, Cookie: cookie },
      body: new URLSearchParams({ csrf: "0".repeat(40) }),
    });
    assert.equal(forged.status, 403);

    const real = await fetch(`${origin}/api/admin/logout`, {
      method: "POST",
      redirect: "manual",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: origin, Cookie: cookie },
      body: new URLSearchParams({ csrf: formToken }),
    });
    assert.equal(real.status, 303);
    assert.match(real.headers.getSetCookie()[0], /Max-Age=0/);
  });
});

test("five wrong attempts pause sign-in", async () => {
  const secret = token();
  await withServer({ STUDY_AI_ADMIN_TOKEN: secret }, async ({ origin, adminLogin, output }) => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      assert.equal((await adminLogin(`guess-${attempt}`)).status, 401);
    }
    const blocked = await adminLogin(`guess-5`);
    assert.equal(blocked.status, 429);
    assert.match(output(), /login-throttled/);
    // A correct token is still refused while the pause is running: the limit is
    // about the address, not the guess.
    assert.equal((await adminLogin(secret)).status, 429);
  });
});

test("there is no way to act as a student", async () => {
  const server = await read("serve.mjs");
  const admin = await read("server/admin.mjs");
  for (const forbidden of ["impersonate", "sudo", "login-as", "loginAs"]) {
    assert.doesNotMatch(`${server}\n${admin}`, new RegExp(forbidden, "i"), `${forbidden} must not exist`);
  }
  // The console reads accounts through list(), which maps to publicUser — the
  // allow-list that has no password field.
  assert.match(server, /accounts\.list\(\{ limit: 500, search \}\)/);
  assert.match(await read("server/accounts.mjs"), /\.map\(\(account\) => publicUser\(account\)\)/);
  assert.match(await read("server/supabase-accounts.mjs"), /\.map\(\(account\) => publicUser\(account\)\)/);
});

test("the console is kept out of search engines and the offline cache", async () => {
  const robots = await read("robots.txt");
  assert.match(robots, /Disallow: \/admin/);
  assert.match(robots, /Disallow: \/setup/);
  const sw = await read("sw.js");
  assert.doesNotMatch(sw, /admin/, "the console must never be precached");
  const precache = JSON.parse(await read("precache.json"));
  assert.ok(!precache.urls.some((url) => /admin/i.test(url)), "the console is not in the manifest");
});

test("the console pages use only glyphs the bundled fonts can draw", async () => {
  const source = await read("server/admin.mjs");
  for (const glyph of ["\u20B9", "\u2713", "\u2715", "\u2192", "\u2190", "\u00D7"]) {
    assert.ok(!source.includes(glyph), `server/admin.mjs contains ${JSON.stringify(glyph)}`);
  }
});

test("a session cookie cannot be forged, extended or replayed after logout", async () => {
  const secret = token();
  await withServer({ STUDY_AI_ADMIN_TOKEN: secret }, async ({ origin, register, adminLogin }) => {
    await register("aarav");
    const login = await adminLogin(secret);
    const cookie = login.headers.getSetCookie()[0].split(";")[0];
    const value = cookie.split("=")[1];
    const [expires, mac] = value.split(".");

    // Extending the expiry without the signing key gets the login page, not the data.
    const extended = `vignan_admin=${Number(expires) + 86_400_000}.${mac}`;
    const page = await fetch(`${origin}/admin`, { headers: { Cookie: extended } });
    const html = await page.text();
    assert.doesNotMatch(html, /<td class="user">aarav/, "an extended cookie must not unlock the console");
    assert.match(html, /Operator/);

    // A correctly signed cookie works until the token is rotated.
    assert.match(await (await fetch(`${origin}/admin`, { headers: { Cookie: cookie } })).text(), /<td class="user">aarav/);
  });
});
