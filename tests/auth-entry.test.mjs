import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newPasswordProblem } from "../js/password-policy.js";

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
  assert.match(html, /js\/boot\.js\?v=11/);
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
  assert.match(html, /id="ask-input"[^>]*aria-label="Ask a question from your textbooks"/);
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
  for (const url of ["./styles-premium.css?v=11", "./js/boot.js?v=11", "./js/app.js?v=11", "./js/auth.js?v=11", "./js/ingest.js?v=9", "./js/edit-studio.js?v=11", "./js/card.js?v=11", "./js/edit-audio.js", "./js/ui.js?v=11", "./js/reader.js?v=11", "./js/i18n.js?v=11"]) {
    assert.ok(sw.includes(`"${url}"`), `${url} is a versioned core asset`);
  }
  assert.ok(precache.urls.includes("./js/edit-studio.js"));
  assert.ok(precache.urls.includes("./js/edit-audio.js"));
  assert.equal(precache.version, 11);
  assert.ok(!precache.urls.includes("./vendor/pdfjs/pdf.min.js"));
});
