#!/usr/bin/env node
/**
 * Offline simulation: run the real service worker outside a browser.
 *
 * This is how the offline version is tested without a browser. It loads
 * `sw.js`, gives it a Cache Storage implementation backed by the repository, and
 * a `fetch` that reads files from disk the way the server would. Then it wires
 * the network off and asks the worker for every file a lesson needs.
 *
 *   node tools/offline-sim.mjs          # report
 *   node tools/offline-sim.mjs --quiet  # exit code only
 *
 * Exit code 0 means: with the network down, every core file and every module of
 * the current release is served from the cache.
 */

import { readFileSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ORIGIN = "https://app.local";
const SCOPE = `${ORIGIN}/`;
const quiet = process.argv.includes("--quiet");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".mjs": "text/javascript; charset=utf-8",
  ".wasm": "application/wasm",
};

/** The repository, served the way serve.mjs serves it. */
function readFromRepo(urlString) {
  const url = new URL(urlString, SCOPE);
  let relative = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  if (!relative) relative = "index.html";
  const target = path.resolve(ROOT, relative);
  if (!target.startsWith(ROOT)) return null;
  if (!existsSync(target)) return null;
  const stat = statSync(target);
  const file = stat.isDirectory() ? path.join(target, "index.html") : target;
  if (!existsSync(file)) return null;
  const body = readFileSync(file);
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" },
  });
}

const networkLog = [];

/** fetch() as the worker sees it: online by default, off when flipped. */
function makeFetch(state) {
  return async (input, init = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url, SCOPE).href;
    networkLog.push(url);
    if (state.offline) throw new TypeError("Failed to fetch (simulated offline)");
    if (init.cache === "no-store") state.noStore.add(url);
    const response = readFromRepo(url);
    if (response) return response;
    return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain" } });
  };
}

class SimCache {
  constructor(name) {
    this.name = name;
    this.entries = new Map();
  }

  key(request) {
    return new URL(typeof request === "string" ? request : request.url, SCOPE).href;
  }

  async add(url) {
    const response = await this.fetchImpl(new URL(url, SCOPE).href);
    if (!response.ok) throw new Error(`cache.add failed for ${url}: ${response.status}`);
    this.entries.set(this.key(url), response.clone());
  }

  async put(request, response) {
    this.entries.set(this.key(request), response.clone());
  }

  async match(request) {
    return this.entries.get(this.key(request))?.clone();
  }

  async keys() {
    return [...this.entries.keys()].map((url) => new Request(url));
  }
}

class SimCacheStorage {
  constructor(fetchImpl) {
    this.caches = new Map();
    this.fetchImpl = fetchImpl;
  }

  async open(name) {
    if (!this.caches.has(name)) {
      const cache = new SimCache(name);
      cache.fetchImpl = this.fetchImpl;
      this.caches.set(name, cache);
    }
    return this.caches.get(name);
  }

  async keys() {
    return [...this.caches.keys()];
  }

  async delete(name) {
    return this.caches.delete(name);
  }
}

function createWorker(fetchImpl) {
  const listeners = new Map();
  const clients = { claim: async () => {}, matchAll: async () => [] };
  const self = {
    location: { origin: ORIGIN, href: `${SCOPE}sw.js` },
    addEventListener: (type, handler) => {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(handler);
    },
    skipWaiting: async () => {
      self.skippedWaiting = true;
    },
    clients,
    registration: { scope: SCOPE },
  };

  const caches = new SimCacheStorage(fetchImpl);
  const source = readFileSync(path.join(ROOT, "sw.js"), "utf8");
  // The worker is plain script, so a function is a faithful sandbox: no globals leak.
  const load = new Function("self", "caches", "fetch", "Response", "Request", "Headers", "URL", "console", source);
  load(self, caches, fetchImpl, Response, Request, Headers, URL, { log() {}, warn() {}, error() {} });

  async function dispatch(type, event = {}) {
    const waits = [];
    const responds = [];
    const full = {
      ...event,
      waitUntil: (promise) => waits.push(promise),
      respondWith: (promise) => responds.push(promise),
    };
    for (const handler of listeners.get(type) || []) handler(full);
    if (waits.length) await Promise.allSettled(waits);
    return responds.length ? await responds[0] : null;
  }

  return { self, caches, dispatch, listeners };
}

const state = { offline: false, noStore: new Set() };
const fetchImpl = makeFetch(state);
const worker = createWorker(fetchImpl);

await worker.dispatch("install");
await worker.dispatch("activate");

const cacheNames = await worker.caches.keys();
const cache = await worker.caches.open(cacheNames[0]);
const cachedUrls = (await cache.keys()).map((request) => request.url);

// Everything the offline app must be able to answer.
const manifest = JSON.parse(readFileSync(path.join(ROOT, "precache.json"), "utf8"));
const release = String(manifest.version);
const required = [
  "./",
  "./index.html",
  "./privacy.html",
  "./terms.html",
  "./security.html",
  "./copyright.html",
  "./sw.js",
  "./precache.json",
  "./styles.css",
  `./styles-premium.css?v=${release}`,
  `./styles-pro.css?v=${release}`,
  `./js/app.js?v=${release}`,
  `./js/boot.js?v=${release}`,
  `./js/ui.js?v=${release}`,
  `./js/study-sheet.js?v=${release}`,
  `./js/revision-plan.js?v=${release}`,
  `./js/pro-mode.js?v=${release}`,
  `./js/pro-ui.js?v=${release}`,
  `./js/answer-quality.js?v=${release}`,
  `./js/updates.js?v=${release}`,
  `./js/offline-check.js?v=${release}`,
];

state.offline = true;
const results = [];
for (const url of required) {
  const absolute = new URL(url, SCOPE).href;
  const response = await worker.dispatch("fetch", { request: new Request(absolute) });
  const body = response ? await response.text() : "";
  results.push({ url, status: response?.status ?? 0, bytes: body.length });
}

// A navigation while offline should still open the app shell.
// undici refuses mode:"navigate"; the worker only reads request.mode, so a plain
// request with that mode set is enough for the simulation.
const navigationRequest = new Request(`${SCOPE}some/deep/route`);
Object.defineProperty(navigationRequest, "mode", { value: "navigate" });
const navigation = await worker.dispatch("fetch", { request: navigationRequest });
const navigationOk = Boolean(navigation?.ok);
const navigationBody = navigation ? await navigation.text() : "";

// An uncached file must fail honestly rather than hang.
const uncached = await worker.dispatch("fetch", {
  request: new Request(`${SCOPE}not-cached-${Date.now()}.js`),
});

const failed = results.filter((row) => row.status !== 200 || row.bytes === 0);
const manifestMissing = manifest.urls.filter((url) => {
  const absolute = new URL(url, SCOPE).href;
  return !cachedUrls.includes(absolute);
});

if (!quiet) {
  console.log(`Release v${release}`);
  console.log(`Cached after install: ${cachedUrls.length} files in ${cacheNames[0]}`);
  console.log("");
  for (const row of results) {
    console.log(`${row.status === 200 && row.bytes ? "  ok " : "FAIL "} ${row.status} ${String(row.bytes).padStart(7)} B  ${row.url}`);
  }
  console.log("");
  console.log(`Navigation fallback offline: ${navigationOk ? `ok (${navigationBody.length} B of index.html)` : "FAILED"}`);
  console.log(`Uncached file while offline: ${uncached?.status === 503 ? "503 with a clear message (correct)" : `status ${uncached?.status}`}`);
  console.log(`Manifest files missing from the cache: ${manifestMissing.length}`);
  if (manifestMissing.length) console.log(`  ${manifestMissing.slice(0, 8).join("\n  ")}`);
  console.log("");
  console.log(failed.length ? `${failed.length} required file(s) did NOT work offline.` : "All required files were served from the cache with the network off.");
}

const ok = failed.length === 0 && navigationOk && manifestMissing.length === 0;
if (!quiet) console.log(ok ? "OFFLINE CHECK PASSED" : "OFFLINE CHECK FAILED");
process.exit(ok ? 0 : 1);
