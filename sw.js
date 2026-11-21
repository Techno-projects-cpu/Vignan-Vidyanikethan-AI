/* Offline service worker for Vignan Vidyanikethan AI, release 2.2.0.
 * Versioned modules prevent an older active worker mixing code across releases. */

const CACHE_NAME = "vignan-vidyanikethan-ai-v87";
const CORE = [
  "./",
  "./index.html",
  "./privacy.html",
  "./terms.html",
  "./security.html",
  "./copyright.html",
  "./judge.html",
  "./presentation.html",
  "./styles-presentation.css?v=87",
  "./js/presentation.js?v=87",
  "./welcome.html",
  "./blog/index.html",
  "./blog/feed.xml",
  "./.well-known/security.txt",
  "./styles.css",
  "./styles.css?v=87",
  "./styles-premium.css?v=87",
  "./styles-identity.css?v=87",
  "./styles-legal.css?v=87",
  "./styles-judge.css?v=87",
  "./styles-welcome.css?v=87",
  "./styles-blog.css?v=87",
  "./styles-social.css?v=87",
  "./styles-pro.css?v=87",
  "./styles-glass.css?v=87",
  "./styles-painted.css?v=87",
  "./styles-custom.css?v=87",
  "./styles-next.css?v=87",
  "./manifest.webmanifest?v=87",
  "./precache.json",
  "./favicon.ico?v=87",
  "./icons/icon.svg?v=87",
  "./icons/icon-48.png?v=87",
  "./icons/icon-192.png?v=87",
  "./icons/icon-512.png?v=87",
  "./icons/icon-maskable-192.png?v=87",
  "./icons/icon-maskable-512.png?v=87",
  "./assets/brand/vignan-ai-mark.svg",
  "./assets/brand/nezaad-mark.png",
  "./assets/fonts/space-grotesk-latin.woff2",
  "./assets/fonts/manrope-latin.woff2",
  "./js/ai-nicknames.js?v=87",
  "./js/answer-quality.js?v=87",
  "./js/answer.js?v=87",
  "./js/app.js?v=87",
  "./js/auth.js?v=87",
  "./js/boot.js?v=87",
  "./js/glass-lens.js?v=87",
  "./js/card.js?v=87",
  "./js/chat-intents.js?v=87",
  "./js/chat-scroll.js?v=87",
  "./js/chat-ui.js?v=87",
  "./js/study-card.js?v=87",
  "./js/ask-recent.js?v=87",
  "./js/code-mode.js?v=87",
  "./js/chess.js?v=87",
  "./js/context.js?v=87",
  "./js/conversation.js?v=87",
  "./js/db.js?v=87",
  "./js/edit-audio.js?v=87",
  "./js/edit-studio.js?v=87",
  "./js/exam-packs.js?v=87",
  "./js/external-answer.js?v=87",
  "./js/files.js?v=87",
  "./js/flashcards.js?v=87",
  "./js/free-apis.js?v=87",
  "./js/goal-cards.js?v=87",
  "./js/friends-ui.js?v=87",
  "./js/i18n.js?v=87",
  "./js/ingest.js?v=87",
  "./js/key-pool.js?v=87",
  "./js/knowledge.js?v=87",
  "./js/languages.js?v=87",
  "./js/question-copy.js?v=87",
  "./js/avatars.js?v=87",
  "./js/replies.js?v=87",
  "./js/translations-core.js?v=87",
  "./js/link-reader.js?v=87",
  "./js/llm.js?v=87",
  "./js/local-ai-worker.js?v=87",
  "./js/local-ai.js?v=87",
  "./js/model-paper.js?v=87",
  "./js/memory.js?v=87",
  "./js/model-router.js?v=87",
  "./js/recovery.js?v=87",
  "./js/notes.js?v=87",
  "./js/offline-check.js?v=87",
  "./js/offline-mode.js?v=87",
  "./js/motion.js?v=87",
  "./js/password-policy.js?v=87",
  "./js/play-ui.js?v=87",
  "./js/premium-ui.js?v=87",
  "./js/pro-mode.js?v=87",
  "./js/pro-ui.js?v=87",
  "./js/progress.js?v=87",
  "./js/providers.js?v=87",
  "./js/quiz.js?v=87",
  "./js/reader.js?v=87",
  "./js/retrieval.js?v=87",
  "./js/settings.js?v=87",
  "./js/shell.js?v=87",
  "./js/social.js?v=87",
  "./js/startup.js?v=87",
  "./js/starter-shelf.js?v=87",
  "./js/student-keys.js?v=87",
  "./js/study-decks.js?v=87",
  "./js/updates.js?v=87",
  "./js/viewport.js?v=87",
  "./js/voice.js?v=87",
  "./js/viva.js?v=87",
  "./js/study-sheet.js?v=87",
  "./js/themes.js?v=87",
  "./js/tour.js?v=87",
  "./js/theme-paint.js?v=87",
  "./js/theme-glass.js?v=87",
  "./js/revision-plan.js?v=87",
  "./js/text.js?v=87",
  "./js/ui.js?v=87",
  "./js/util.js?v=87",
  "./js/vector.js?v=87",
  "./js/web.js?v=87",
  "./vendor/qr/qrcode.js?v=87",
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
      await Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.status >= 500) throw new Error("Hosting service temporarily unavailable.");
    if (response.ok) cache.put(request, response.clone()).catch(() => {});
    return response;
  } catch {
    const cached = (await cache.match(request)) || (await cache.match("./index.html"));
    return (
      cached ||
      new Response("<!doctype html><title>Offline</title><p>Vignan Vidyanikethan AI is offline. Open the app once while online to cache it.</p>", {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      })
    );
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") cache.put(request, response.clone()).catch(() => {});
    return response;
  } catch (error) {
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
  if (request.mode === "navigate") event.respondWith(networkFirst(request));
  else event.respondWith(cacheFirst(request));
});
