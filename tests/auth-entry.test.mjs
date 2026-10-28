import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { newPasswordProblem } from "../js/password-policy.js";
import { login, register } from "../js/auth.js?v=16";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const html = read("index.html");
const boot = read("js/boot.js");
const app = read("js/app.js");
const css = read("styles-premium.css");
const sw = read("sw.js");
const precache = JSON.parse(read("precache.json"));

test("entry screen offers login and registration before guest mode", () => {
  const loginTab = html.indexOf('id="gate-login-tab"');
  const registerTab = html.indexOf('id="gate-register-tab"');
  const guest = html.indexOf('id="gate-guest-button"');
  assert.ok(loginTab > 0 && registerTab > loginTab && guest > registerTab);
  assert.match(html, /id="gate-login-tab"[^>]*aria-selected="true"/);
  assert.match(html, /id="gate-register-form"[^>]*\bhidden>/);
  assert.match(html, /id="gate-guardian-row" hidden/);
  assert.match(html, /id="gate-login-form"[^>]*method="post"/);
  assert.match(html, /id="gate-register-form"[^>]*method="post"/);
  assert.match(html, /id="gate-guest-button"[^>]*disabled/);
  assert.match(css, /body\.auth-locked \.app-shell/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test("entry boot restores signed-in sessions, offers offline guest access and initializes once", () => {
  assert.match(html, /js\/boot\.js\?v=16/);
  assert.match(boot, /guestChosen\(\)/);
  assert.match(boot, /getSession\(\{ timeout: 5000 \}\)/);
  assert.match(boot, /unlock\(\{ guest: true \}\)/);
  assert.match(boot, /module\.setAccountSession\(user, \{ guest \}\)/);
  assert.match(app, /export function initApp\(options = \{\}\)/);
  assert.match(app, /export async function setAccountSession/);
  assert.match(html, /id="profile-button" aria-label="Account"/);
  assert.match(app, /classList\.toggle\("has-conversation"/);
  assert.match(css, /#view-ask:not\(\.has-conversation\) \.chat-log \{ display: none; \}/);
  assert.match(css, /#view-ask \.mode-row \{ flex-wrap: wrap; overflow: visible; \}/);
  assert.match(html, /id="ask-input"[^>]*aria-label="Ask, paste a public link, or request a quiz"/);
});

test("in-flight account requests can be cancelled before a response", async () => {
  const oldDocument = globalThis.document;
  const oldFetch = globalThis.fetch;
  const controller = new AbortController();
  let began;
  const started = new Promise((resolve) => { began = resolve; });
  globalThis.document = { cookie: "vignan_csrf=test-token" };
  globalThis.fetch = (_url, options) => new Promise((_resolve, reject) => {
    began();
    options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
  });
  try {
    const result = login({ username: "student", password: "example" }, { signal: controller.signal });
    await started;
    controller.abort();
    await assert.rejects(result, /cancelled/);
  } finally {
    globalThis.document = oldDocument;
    globalThis.fetch = oldFetch;
  }
});

test("cancelling during CSRF bootstrap prevents registration from being sent", async () => {
  const oldDocument = globalThis.document;
  const oldFetch = globalThis.fetch;
  const controller = new AbortController();
  let finishBootstrap;
  let calls = 0;
  globalThis.document = { cookie: "" };
  globalThis.fetch = () => {
    calls += 1;
    return new Promise((resolve) => {
      finishBootstrap = () => {
        globalThis.document.cookie = "vignan_csrf=test-token";
        resolve({ ok: true, json: async () => ({ ok: true }) });
      };
    });
  };
  try {
    const result = register({ username: "student" }, { signal: controller.signal });
    controller.abort();
    finishBootstrap();
    await assert.rejects(result, /cancelled/);
    assert.equal(calls, 1, "the register POST must not be made after cancellation");
  } finally {
    globalThis.document = oldDocument;
    globalThis.fetch = oldFetch;
  }
});

test("a closing command menu cannot steal the next tap", () => {
  assert.match(css, /\.command-overlay\s*\{\s*pointer-events:\s*none/);
  assert.match(css, /\.command-overlay\.open\s*\{\s*pointer-events:\s*auto/);
});

test("new password checks permit passphrases but reject short and common passwords", () => {
  assert.equal(newPasswordProblem("a memorable phrase"), "");
  assert.match(newPasswordProblem("short123"), /10–128/);
  assert.match(newPasswordProblem("PASSWORD123"), /less common/);
  assert.match(newPasswordProblem("a".repeat(129)), /10–128/);
});

test("application module imports share the offline cache version", () => {
  for (const file of readdirSync(new URL("../js/", import.meta.url)).filter((name) => name.endsWith(".js"))) {
    const source = read(`js/${file}`);
    for (const match of source.matchAll(/(?:from\s+|import\()\s*["'](\.\/[^"']+\.js(?:\?v=\d+)?)["']/g)) {
      assert.match(match[1], /\?v=16$/, `${file} imports ${match[1]} without the release version`);
      assert.ok(sw.includes(`"./js/${match[1].slice(2)}"`), `${match[1]} is precached`);
    }
  }
  assert.ok(sw.includes('"./js/local-ai-worker.js?v=16"'));
});

test("PDF reader is patched, lazily loaded, and available in the offline cache", () => {
  const ingest = read("js/ingest.js");
  assert.doesNotMatch(html, /<script[^>]+pdf\.min\.(?:js|mjs)/);
  assert.match(ingest, /import\(new URL\("pdf\.min\.mjs", PDF_BASE\)\.href\)/);
  assert.match(ingest, /isEvalSupported:\s*false/);
  assert.match(ingest, /enableXfa:\s*false/);
  assert.match(read("vendor/pdfjs/pdf.min.mjs"), /4\.2\.67/);
  for (const url of ["./js/boot.js", "./js/password-policy.js", "./vendor/pdfjs/pdf.min.mjs", "./vendor/pdfjs/pdf.worker.min.mjs"]) {
    assert.ok(precache.urls.includes(url), `${url} is precached`);
  }
  for (const url of ["./styles-premium.css?v=16", "./styles-identity.css?v=16", "./styles-legal.css?v=16", "./js/boot.js?v=16", "./js/app.js?v=16", "./js/auth.js?v=16", "./js/ingest.js?v=16", "./js/edit-studio.js?v=16", "./js/card.js?v=16", "./js/edit-audio.js?v=16", "./js/ui.js?v=16", "./js/reader.js?v=16", "./js/i18n.js?v=16", "./js/study-decks.js?v=16", "./js/startup.js?v=16", "./vendor/qr/qrcode.js?v=16", "./privacy.html", "./terms.html", "./assets/brand/nezaad-mark.png", "./assets/fonts/manrope-latin.woff2", "./assets/fonts/space-grotesk-latin.woff2"]) {
    assert.ok(sw.includes(`"${url}"`), `${url} is a core asset`);
  }
  assert.ok(precache.urls.includes("./js/edit-studio.js"));
  assert.ok(precache.urls.includes("./js/edit-audio.js"));
  assert.equal(precache.version, 16);
  assert.ok(!precache.urls.includes("./vendor/pdfjs/pdf.min.js"));
});
