/**
 * Releases are applied, and the offline readiness report.
 *
 * There is no permission step any more: pressing publish is the whole gesture,
 * so these tests hold the opposite contract — the worker must take over on its
 * own, no banner may exist, and no "Later" may come back.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

import {
  isNewer, parseCacheVersion, shouldReloadNow, startUpdateWatch,
} from "../js/updates.js";
import { CRITICAL_FILES, normalizeUrl, pickCacheName, runOfflineCheck, summarize } from "../js/offline-check.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8");

test("the worker version is read from the cache name", () => {
  assert.equal(parseCacheVersion('const CACHE_NAME = "vignan-vidyanikethan-ai-v33";'), "33");
  assert.equal(parseCacheVersion('const CACHE_NAME = "vignan-vidyanikethan-ai-v40";'), "40");
  assert.equal(parseCacheVersion("nonsense"), "");
  assert.equal(isNewer("19", "18"), true);
  assert.equal(isNewer("18", "18"), false);
  assert.equal(isNewer("17", "18"), false);
  assert.equal(isNewer("", "18"), false);
  assert.equal(isNewer("abc", "18"), false);
});

test("there is no banner, no permission and no postponement left", () => {
  const index = read("/index.html");
  const app = read("/js/app.js");
  const offline = read("/js/offline-mode.js");
  const css = read("/styles-premium.css");
  assert.doesNotMatch(index, /update-banner/);
  assert.doesNotMatch(index, /Update now/);
  assert.doesNotMatch(index, /Check for updates/);
  assert.doesNotMatch(app, /updateBannerText|applyUpdate|checkForUpdate|hideUpdateBanner|takeUpdate|deferVersion|deferredVersion/);
  assert.doesNotMatch(offline, /deferVersion|deferredVersion|shouldAnnounceUpdate/);
  assert.doesNotMatch(css, /update-banner/);
  assert.doesNotMatch(offline, /vignan\.update-deferred/);
});

test("the release in the page matches the release in the worker", async () => {
  const swVersion = parseCacheVersion(read("/sw.js"));
  assert.ok(swVersion, "the worker names its release");
  // Load the module the way the page does, with the release query, and confirm
  // both report the same version.
  const mod = await import(`../js/updates.js?v=${swVersion}`);
  assert.equal(String(mod.RELEASE), String(swVersion));
  assert.match(read("/js/app.js"), new RegExp(`updates\\.js\\?v=${swVersion}`));
});

test("the worker takes over by itself, so a release reaches every device", () => {
  const sw = read("/sw.js");
  const installBlock = sw.slice(sw.indexOf('addEventListener("install"'), sw.indexOf('addEventListener("activate"'));
  assert.match(installBlock, /await self\.skipWaiting\(\)/, "install activates immediately");
  assert.doesNotMatch(sw, /SKIP_WAITING/, "nothing has to be asked for");
  assert.match(read("/js/updates.js"), /addEventListener\("controllerchange", onControlChange\)/);
  assert.match(read("/js/app.js"), /startUpdateWatch\(registration, \{/);
});

test("a reload waits for an answer to finish, and only for that", () => {
  assert.equal(shouldReloadNow({}), true);
  assert.equal(shouldReloadNow({ busy: false }), true);
  assert.equal(shouldReloadNow({ busy: true }), false, "a question in flight is not thrown away");
  const source = read("/js/app.js");
  assert.match(source, /shouldWait: \(\) => Boolean\(state\.askBusy\) \|\| Boolean\(\$\("#ask-input"\)\?\.value\.trim\(\)\)/,
    "an answer in flight and an unsent question are both waited for");
});

test("a new controller reloads the page once, and a first install does not", () => {
  const listeners = {};
  const reloads = [];
  const container = {
    navigator: { serviceWorker: { controller: {}, addEventListener: (name, fn) => { listeners[name] = fn; }, removeEventListener() {} } },
    document: { addEventListener() {}, removeEventListener() {}, visibilityState: "visible" },
    addEventListener() {},
    removeEventListener() {},
    setTimeout: (fn) => { fn(); return 1; },
    clearTimeout() {},
    location: { reload: () => reloads.push("reload") },
  };
  const stop = startUpdateWatch({ update: async () => {} }, { container, shouldWait: () => false });
  listeners.controllerchange();           // an update took over
  assert.deepEqual(reloads, ["reload"]);
  listeners.controllerchange();           // ... and must not reload twice
  assert.deepEqual(reloads, ["reload"]);
  stop();

  // A page that never had a controller is on its first install: it is already
  // the new release, so nothing reloads.
  const firstListeners = {};
  const firstReloads = [];
  const firstContainer = {
    navigator: { serviceWorker: { controller: null, addEventListener: (name, fn) => { firstListeners[name] = fn; }, removeEventListener() {} } },
    document: { addEventListener() {}, removeEventListener() {}, visibilityState: "visible" },
    addEventListener() {}, removeEventListener() {},
    setTimeout: (fn) => { fn(); return 1; }, clearTimeout() {},
    location: { reload: () => firstReloads.push("reload") },
  };
  startUpdateWatch({ update: async () => {} }, { container: firstContainer });
  firstListeners.controllerchange();
  assert.deepEqual(firstReloads, []);
});

test("the watcher keeps trying while an answer is being written", () => {
  const listeners = {};
  const reloads = [];
  let busy = true;
  const container = {
    navigator: { serviceWorker: { controller: {}, addEventListener: (name, fn) => { listeners[name] = fn; }, removeEventListener() {} } },
    document: { addEventListener() {}, removeEventListener() {}, visibilityState: "visible" },
    addEventListener() {}, removeEventListener() {},
    // Call the retry immediately so the test does not wait two seconds.
    setTimeout: (fn) => { if (!busy) fn(); return 1; },
    clearTimeout() {},
    location: { reload: () => reloads.push("reload") },
  };
  startUpdateWatch({ update: async () => {} }, { container, shouldWait: () => busy });
  listeners.controllerchange();
  assert.deepEqual(reloads, [], "waits for the answer");
  busy = false;
  listeners.controllerchange();
  assert.deepEqual(reloads, ["reload"], "and then applies it without asking");
});

test("the offline report counts what the worker really stored", () => {
  const ready = summarize({
    expected: ["./index.html", "./js/app.js?v=50", "./styles.css"],
    cached: ["./index.html", "./js/app.js?v=50", "./styles.css"],
    critical: ["./index.html"],
  });
  assert.equal(ready.total, 3);
  assert.equal(ready.ready, true);
  assert.match(ready.summary, /Ready offline: 3 of 3/);

  const broken = summarize({
    expected: ["./index.html", "./js/app.js?v=50"],
    cached: [],
    critical: ["./index.html"],
  });
  assert.equal(broken.ready, false);
  assert.deepEqual(broken.missingCritical, ["index.html"]);
  assert.match(broken.summary, /2 of 2 files are missing/);

  // A release is not "ready" when a file every lesson needs is missing.
  const missingShell = summarize({
    expected: ["./index.html", "./js/app.js?v=50"],
    cached: ["./js/app.js?v=50"],
    critical: CRITICAL_FILES,
  });
  assert.equal(missingShell.ready, false);
  assert.ok(missingShell.missingCritical.includes("index.html"));

  const nothing = summarize({ expected: [], cached: [] });
  assert.equal(nothing.ready, false);
  assert.match(nothing.summary, /Open the app once while online/);

  // Query strings and absolute URLs compare equal.
  assert.equal(normalizeUrl("./js/app.js?v=50"), "js/app.js");
  assert.equal(normalizeUrl("https://app.local/js/app.js?v=50"), "js/app.js");
  assert.equal(pickCacheName(["other", "vignan-vidyanikethan-ai-v17", "vignan-vidyanikethan-ai-v33"], "18"), "vignan-vidyanikethan-ai-v33");
});

test("the in-app check survives a browser with no cache and no network", async () => {
  const noCacheApi = await runOfflineCheck({ cachesRef: null });
  assert.equal(noCacheApi.installed, false);
  assert.equal(noCacheApi.reason, "no-cache-api");

  const emptyCaches = { keys: async () => [], open: async () => ({ keys: async () => [], match: async () => null }) };
  const notInstalled = await runOfflineCheck({ cachesRef: emptyCaches });
  assert.equal(notInstalled.installed, false);
  assert.equal(notInstalled.reason, "not-installed");
});

test("the real worker, simulated with the network off, serves the whole app", () => {
  // tools/offline-sim.mjs installs sw.js, flips the network off, and fetches
  // every core file. It fails loudly if any of them is not cached.
  const output = execFileSync(process.execPath, [`${root}/tools/offline-sim.mjs`], { encoding: "utf8" });
  assert.match(output, /OFFLINE CHECK PASSED/);
  assert.match(output, /Navigation fallback offline: ok/);
  assert.doesNotMatch(output, /FAIL /);
});

test("the security and copyright pages are real, linked and cached", () => {
  for (const page of ["security.html", "copyright.html"]) {
    const html = read(`/${page}`);
    assert.match(html, /<\/html>/, page);
    assert.match(html, /Privacy policy ↗/, `${page} links the privacy policy`);
    assert.match(html, /security\.txt/, `${page} points at security.txt`);
    assert.ok(JSON.parse(read("/precache.json")).urls.includes(`./${page}`), `${page} is precached`);
  }
  const security = read("/security.html");
  assert.match(security, /HttpOnly/);
  assert.match(security, /Digital Personal Data Protection Act/);
  assert.match(security, /report it privately/i);
  const copyright = read("/copyright.html");
  assert.match(copyright, /No textbook is bundled or hosted/);
  assert.match(copyright, /NCERT and SCERT/);
  const index = read("/index.html");
  assert.match(index, /href="\.\/security\.html"/);
  assert.match(index, /href="\.\/copyright\.html"/);
});

test("the server hardens every response", () => {
  const server = read("/serve.mjs");
  for (const header of [
    "X-Content-Type-Options",
    "Referrer-Policy",
    "Permissions-Policy",
    "Cross-Origin-Resource-Policy",
    "Cross-Origin-Opener-Policy",
    "X-Permitted-Cross-Domain-Policies",
    "Strict-Transport-Security",
  ]) {
    assert.match(server, new RegExp(header), header);
  }
  // The Arena preview embeds the page, so framing is deliberately not blocked;
  // the CSRF + same-origin checks on mutations are the compensating control.
  assert.doesNotMatch(server, /frame-ancestors/);
  assert.doesNotMatch(server, /X-Frame-Options/);
  assert.match(server, /CSRF/);
  // API responses share the same base headers.
  assert.match(server, /\.\.\.baseSecurityHeaders\(response\.__vignanRequest/);
  assert.match(read("/.well-known/security.txt"), /^Contact: /m);
  assert.match(read("/robots.txt"), /Disallow: \/api\//);
  assert.match(read("/sitemap.xml"), /security\.html/);
});

test("versioned assets are cached hard, unversioned files are not", () => {
  const server = read("/serve.mjs");
  assert.match(server, /versioned \? "public, max-age=31536000, immutable"/);
  assert.match(server, /"public, max-age=3600"/);
  assert.match(server, /noCache \? "no-cache"/);
});

test("the settings card says what works offline and what needs a connection", () => {
  const index = read("/index.html");
  assert.match(index, /Works with the network off/);
  assert.match(index, /Needs a connection/);
  assert.match(index, /study sheets, revision plan, quizzes, flashcards/);
});

test("judge mode is a real page, linked from the app and the legal footers", () => {
  const judge = read("/judge.html");
  assert.match(judge, /Judge mode/);
  assert.match(judge, /OFFLINE CHECK PASSED/);
  assert.match(judge, /Honest limitations/);
  assert.match(judge, /rel="stylesheet" href="\.\/styles-judge\.css/);
  for (const page of ["/index.html", "/privacy.html", "/terms.html", "/security.html", "/copyright.html"]) {
    assert.match(read(page), /judge\.html/, `${page} should link to judge mode`);
  }
  assert.match(read("/sitemap.xml"), /judge\.html/);
});

test("judge mode stays grayscale and does not overclaim", () => {
  const css = read("/styles-judge.css");
  const colours = css.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  for (const colour of colours) {
    const hex = colour.slice(1);
    const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex.slice(0, 6);
    assert.equal(full.slice(0, 2).toLowerCase(), full.slice(2, 4).toLowerCase(), `${colour} is not grey`);
    assert.equal(full.slice(2, 4).toLowerCase(), full.slice(4, 6).toLowerCase(), `${colour} is not grey`);
  }
  const judge = read("/judge.html");
  assert.match(judge, /No textbook is bundled/);
  // Honesty that a judge can check is a feature, and it must not be quietly
  // deleted in a later release: AI assistance and the unproven parts are named.
  assert.match(judge, /Was this code written by AI\?/);
  assert.match(judge, /Arena Agent Mode/);
  assert.match(judge, /Not proven here, and stated plainly/);
  assert.match(judge, /no professional security audit/);
  assert.match(read("/README.md"), /## How this was built/);
  // Credit, not comparison: reading other free tutors is stated as the source of
  // ideas and they are named in the credits.
  assert.match(judge, /OPEN_SOURCE_CREDITS\.md/);
  assert.match(read("/README.md"), /## Where the ideas came from/);
  assert.match(read("/OPEN_SOURCE_CREDITS.md"), /visheshpandey\/Eklavya/);
  // Two projects share the name Eklavya, and the page must not blur them: the
  // funded product and the independent hackathon repository are named apart.
  assert.match(judge, /eklavya\.io/);
  assert.match(judge, /Apni Pathshala with Malpani Ventures/);
  assert.match(judge, /independent weekend hackathon repository/);
  assert.match(judge, /on our list/);
  assert.match(read("/OPEN_SOURCE_CREDITS.md"), /\*\*not\*\* the funded product at eklavya\.io/);
  assert.match(read("/README.md"), /two different projects use the name \*\*Eklavya\*\*/);
  assert.match(judge, /no professional security audit/);
  assert.doesNotMatch(judge, /guarantee|100% accurate|unhackable/i);
});

test("the device checklist covers every area before a demo", () => {
  const checklist = read("/CHECKLIST.md");
  for (const heading of ["First impression", "Books and citations", "Study loop", "Social and play", "Offline", "Polish and trust"]) {
    assert.match(checklist, new RegExp(heading));
  }
  assert.match(checklist, /aeroplane mode/);
  assert.match(checklist, /reloads \*\*by itself\*\*/);
  assert.doesNotMatch(checklist, /Later\*\* hides the banner/);
});

test("the security page explains how the project's own keys are kept", () => {
  const page = read("/security.html");
  assert.match(page, /How the project's own keys are kept/);
  assert.match(page, /fails the build if one appears/);
  assert.match(page, /treated as burned/);
});

test("the secret scanner is wired in and catches a real-shape key", async () => {
  const { execFileSync } = await import("node:child_process");
  const fsmod = await import("node:fs/promises");
  const pathmod = await import("node:path");
  const root = pathmod.resolve(new URL("..", import.meta.url).pathname);
  const scripts = JSON.parse(await fsmod.readFile(pathmod.join(root, "package.json"), "utf8")).scripts;
  assert.match(scripts.check, /scan-secrets/);
  assert.equal(scripts.secrets, "node tools/scan-secrets.mjs");

  // A file that looks like a live key must fail the scan, and the report must
  // not repeat the secret it found.
  const probe = ".secret-probe.test.tmp";
  // Assembled at run time so this fixture never trips the scanner itself.
  const fake = ["sb", "secret", "AbCdEfGhIjKlMnOpQrStUvWxYz012345"].join("_");
  await fsmod.writeFile(pathmod.join(root, probe), `KEY=${fake}\n`);
  try {
    assert.throws(
      () => execFileSync(process.execPath, ["tools/scan-secrets.mjs", "--all"], { cwd: root, encoding: "utf8", stdio: "pipe" }),
      (error) => {
        const report = `${error.stderr || ""}`;
        assert.match(report, /Supabase secret key/);
        assert.doesNotMatch(report, new RegExp(fake), "the report must not echo the secret");
        return true;
      },
    );
  } finally {
    await fsmod.rm(pathmod.join(root, probe), { force: true });
  }
});
