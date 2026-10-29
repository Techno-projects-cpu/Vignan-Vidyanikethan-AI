/**
 * Offline coverage: everything the app needs to boot and answer must be in the
 * service worker's cache list.
 *
 * This is the test that catches the quiet failure mode — a new module or
 * stylesheet that works online and 404s the moment a judge turns the Wi-Fi off.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8");
const sw = read("/sw.js");
const index = read("/index.html");

const VERSION = (index.match(/js\/boot\.js\?v=(\d+)/) || [])[1];

/** Every local ES module import in the client source. */
function importedModules() {
  const files = readdirSync(`${root}/js`).filter((name) => name.endsWith(".js"));
  const modules = new Set();
  for (const file of files) {
    const source = read(`/js/${file}`);
    for (const match of source.matchAll(/from\s+"\.\/([a-z0-9-]+\.js)(?:\?v=\d+)?"/g)) {
      modules.add(match[1]);
    }
  }
  return [...modules].sort();
}

test("the release version is shared by html, modules and the worker", () => {
  assert.ok(VERSION, "a release version is present");
  assert.match(read("/sw.js"), new RegExp(`CACHE_NAME = "vignan-vidyanikethan-ai-v${VERSION}"`));
  const manifest = JSON.parse(read("/precache.json"));
  assert.equal(manifest.version, Number(VERSION), "precache.json is regenerated for this release");
});

test("every module the app imports is cached for offline use", () => {
  const missing = importedModules().filter((name) => !sw.includes(`./js/${name}?v=${VERSION}`));
  assert.deepEqual(missing, [], `not precached: ${missing.join(", ")}`);
});

test("every stylesheet and script the page loads is cached", () => {
  const assets = [...index.matchAll(/(?:href|src)="\.\/([^"]+?\.(?:css|js))(?:\?v=\d+)?"/g)].map((match) => match[1]);
  const missing = [...new Set(assets)].filter((asset) => !sw.includes(`./${asset}`));
  assert.deepEqual(missing, [], `not precached: ${missing.join(", ")}`);
});

test("the newest features are explicitly offline: sheets, revision, pro mode", () => {
  for (const module of ["study-sheet.js", "revision-plan.js", "pro-mode.js", "pro-ui.js"]) {
    assert.match(sw, new RegExp(`\\./js/${module.replace(".", "\\.")}\\?v=${VERSION}`), module);
  }
  assert.match(sw, new RegExp(`\\./styles-pro\\.css\\?v=${VERSION}`));
});

test("offline answers never promise a web search they cannot run", () => {
  const app = read("/js/app.js");
  assert.match(app, /navigator\.onLine !== false/, "the ask flow checks the connection");
  assert.match(app, /webSkippedOffline/, "the skipped search is reported");
  assert.match(app, /web search was skipped/, "the student is told what still works");
  // A sheet or a plan must not need the network: both are local modules.
  assert.doesNotMatch(read("/js/study-sheet.js"), /fetch\(|await import\(/, "study sheets are pure");
  assert.doesNotMatch(read("/js/revision-plan.js"), /fetch\(|await import\(/, "revision plans are pure");
  assert.doesNotMatch(read("/js/pro-mode.js"), /fetch\(/, "pro mode is local");
});
