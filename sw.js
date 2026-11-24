/* Offline service worker for Vignan Vidyanikethan AI, release 2.2.0.
 * Versioned modules prevent an older active worker mixing code across releases. */

const CACHE_NAME = "vignan-vidyanikethan-ai-v89";
const CORE = [
  "./",
  "./index.html",
  "./privacy.html",
  "./terms.html",
  "./security.html",
  "./copyright.html",
  "./judge.html",
  "./presentation.html",
  "./styles-presentation.css?v=89",
  "./js/presentation.js?v=89",
  "./welcome.html",
  "./blog/index.html",
  "./blog/feed.xml",
  "./.well-known/security.txt",
  "./styles.css",
  "./styles.css?v=89",
  "./styles-premium.css?v=89",
  "./styles-identity.css?v=89",
  "./styles-legal.css?v=89",
  "./styles-judge.css?v=89",
  "./styles-welcome.css?v=89",
  "./styles-blog.css?v=89",
  "./styles-social.css?v=89",
  "./styles-pro.css?v=89",
  "./styles-glass.css?v=89",
  "./styles-painted.css?v=89",
  "./styles-custom.css?v=89",
  "./styles-next.css?v=89",
  "./manifest.webmanifest?v=89",
  "./precache.json",
  "./favicon.ico?v=89",
  "./icons/icon.svg?v=89",
  "./icons/icon-48.png?v=89",
  "./icons/icon-192.png?v=89",
  "./icons/icon-512.png?v=89",
  "./icons/icon-maskable-192.png?v=89",
  "./icons/icon-maskable-512.png?v=89",
  "./assets/brand/vignan-ai-mark.svg",
  "./assets/brand/nezaad-mark.png",
  "./assets/fonts/space-grotesk-latin.woff2",
  "./assets/fonts/manrope-latin.woff2",
  "./js/ai-nicknames.js?v=89",
  "./js/answer-quality.js?v=89",
  "./js/answer.js?v=89",
  "./js/app.js?v=89",
  "./js/auth.js?v=89",
  "./js/boot.js?v=89",
  "./js/glass-lens.js?v=89",
  "./js/card.js?v=89",
  "./js/chat-intents.js?v=89",
  "./js/chat-scroll.js?v=89",
  "./js/chat-ui.js?v=89",
  "./js/study-card.js?v=89",
  "./js/ask-recent.js?v=89",
  "./js/code-mode.js?v=89",
  "./js/chess.js?v=89",
  "./js/context.js?v=89",
  "./js/conversation.js?v=89",
  "./js/db.js?v=89",
  "./js/edit-audio.js?v=89",
  "./js/edit-studio.js?v=89",
  "./js/exam-packs.js?v=89",
  "./js/external-answer.js?v=89",
  "./js/files.js?v=89",
  "./js/flashcards.js?v=89",
  "./js/free-apis.js?v=89",
  "./js/goal-cards.js?v=89",
  "./js/friends-ui.js?v=89",
  "./js/i18n.js?v=89",
  "./js/ingest.js?v=89",
  "./js/key-pool.js?v=89",
  "./js/knowledge.js?v=89",
  "./js/languages.js?v=89",
  "./js/question-copy.js?v=89",
  "./js/avatars.js?v=89",
  "./js/replies.js?v=89",
  "./js/translations-core.js?v=89",
  "./js/link-reader.js?v=89",
  "./js/llm.js?v=89",
  "./js/local-ai-worker.js?v=89",
  "./js/local-ai.js?v=89",
  "./js/model-paper.js?v=89",
  "./js/memory.js?v=89",
  "./js/model-router.js?v=89",
  "./js/recovery.js?v=89",
  "./js/notes.js?v=89",
  "./js/offline-check.js?v=89",
  "./js/offline-mode.js?v=89",
  "./js/motion.js?v=89",
  "./js/password-policy.js?v=89",
  "./js/play-ui.js?v=89",
  "./js/premium-ui.js?v=89",
  "./js/pro-mode.js?v=89",
  "./js/pro-ui.js?v=89",
  "./js/progress.js?v=89",
  "./js/providers.js?v=89",
  "./js/quiz.js?v=89",
  "./js/reader.js?v=89",
  "./js/retrieval.js?v=89",
  "./js/settings.js?v=89",
  "./js/shell.js?v=89",
  "./js/social.js?v=89",
  "./js/startup.js?v=89",
  "./js/starter-shelf.js?v=89",
  "./js/student-keys.js?v=89",
  "./js/study-decks.js?v=89",
  "./js/updates.js?v=89",
  "./js/viewport.js?v=89",
  "./js/voice.js?v=89",
  "./js/viva.js?v=89",
  "./js/study-sheet.js?v=89",
  "./js/themes.js?v=89",
  "./js/tour.js?v=89",
  "./js/theme-paint.js?v=89",
  "./js/theme-glass.js?v=89",
  "./js/revision-plan.js?v=89",
  "./js/text.js?v=89",
  "./js/ui.js?v=89",
  "./js/util.js?v=89",
  "./js/vector.js?v=89",
  "./js/web.js?v=89",
  "./vendor/qr/qrcode.js?v=89",
  "./vendor/webllm/web-llm.js",
  "./vendor/pdfjs/pdf.min.mjs",
  "./vendor/pdfjs/pdf.worker.min.mjs",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.allSettled(CORE.map((url) => cache.add(url)));
      try {
        const response = await fetch("./precache.json", { cache: "no-store" });
        if (response.ok) {
          const manifest = await response.json();
          const urls = (manifest.urls || []).filter((url) => !CORE.includes(url));
          for (let index = 0; index < urls.length; index += 25) {
            await Promise.allSettled(urls.slice(index, index + 25).map((url) => cache.add(url)));
          }
        }
      } catch {
        // The core shell is enough to keep the app usable.
      }
      // Do not replace a working worker with an incomplete application module
      // graph after a flaky deployment. Keep the previous installed release.
      const essential = CORE.filter(url => url === "./" || url === "./index.html" || /\.(?:js|mjs|css)(?:\?|$)/.test(url));
      for (const url of essential) {
        if (!(await cache.match(url))) throw new Error("Incomplete app cache; keeping the previous release.");
      }
      // A release is not an offer. The new worker takes over at once, the page
      // reloads itself (js/updates.js), and the student gets the new version
      // whether or not they ever opened Settings.
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => /^vignan-vidyanikethan-ai-v\d+$/.test(name) && name !== CACHE_NAME).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

// Cache access is an enhancement, not a prerequisite for a network response.
async function availableCache() {
  try { return await caches.open(CACHE_NAME); } catch { return null; }
}
async function cachedResponse(cache, request) {
  try { return await cache?.match(request); } catch { return undefined; }
}
function storeResponse(cache, request, response) {
  if (!cache || !response.ok || /(?:^|,)\s*(?:no-store|private)\b/i.test(response.headers.get("Cache-Control") || "")) return;
  try { cache.put(request, response.clone()).catch(() => {}); } catch { /* blocked/quota-limited cache */ }
}

async function networkFirst(request) {
  const cache = await availableCache();
  try {
    const response = await fetch(request);
    if (response.status >= 500) throw new Error("Hosting service temporarily unavailable.");
    storeResponse(cache, request, response);
    return response;
  } catch {
    const cached = (await cachedResponse(cache, request)) || (await cachedResponse(cache, "./index.html"));
    return cached || new Response("<!doctype html><title>Offline</title><p>Vignan Vidyanikethan AI is offline. Open the app once while online to cache it.</p>", {
      status: 503,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}

async function cacheFirst(request) {
  const cache = await availableCache();
  const cached = await cachedResponse(cache, request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.type === "basic") storeResponse(cache, request, response);
    return response;
  } catch {
    return new Response("Offline and this file is not cached yet.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes("/api/")) return;
  // Operator/account responses must never enter the public app-shell cache.
  if (/^\/(?:admin|setup)(?:\/|$|\.html$)/.test(url.pathname)) return;
  if (request.mode === "navigate") event.respondWith(networkFirst(request));
  else event.respondWith(cacheFirst(request));
});
