/* Offline service worker for Vignan Vidyanikethan AI, release 2.2.0.
 * Versioned modules prevent an older active worker mixing code across releases. */

const CACHE_NAME = "vignan-vidyanikethan-ai-v22";
const CORE = [
  "./",
  "./index.html",
  "./privacy.html",
  "./terms.html",
  "./security.html",
  "./copyright.html",
  "./judge.html",
  "./.well-known/security.txt",
  "./styles.css",
  "./styles-premium.css?v=22",
  "./styles-identity.css?v=22",
  "./styles-legal.css?v=22",
  "./styles-judge.css?v=22",
  "./styles-social.css?v=22",
  "./styles-pro.css?v=22",
  "./manifest.webmanifest?v=22",
  "./precache.json",
  "./favicon.ico?v=22",
  "./icons/icon.svg?v=22",
  "./icons/icon-48.png?v=22",
  "./icons/icon-192.png?v=22",
  "./icons/icon-512.png?v=22",
  "./icons/icon-maskable-192.png?v=22",
  "./icons/icon-maskable-512.png?v=22",
  "./assets/brand/vignan-ai-mark.svg",
  "./assets/brand/nezaad-mark.png",
  "./assets/fonts/space-grotesk-latin.woff2",
  "./assets/fonts/manrope-latin.woff2",
  "./js/ai-nicknames.js?v=22",
  "./js/answer-quality.js?v=22",
  "./js/answer.js?v=22",
  "./js/app.js?v=22",
  "./js/auth.js?v=22",
  "./js/boot.js?v=22",
  "./js/card.js?v=22",
  "./js/chat-intents.js?v=22",
  "./js/chat-ui.js?v=22",
  "./js/chess.js?v=22",
  "./js/context.js?v=22",
  "./js/conversation.js?v=22",
  "./js/db.js?v=22",
  "./js/edit-audio.js?v=22",
  "./js/edit-studio.js?v=22",
  "./js/exam-packs.js?v=22",
  "./js/external-answer.js?v=22",
  "./js/files.js?v=22",
  "./js/flashcards.js?v=22",
  "./js/free-apis.js?v=22",
  "./js/friends-ui.js?v=22",
  "./js/i18n.js?v=22",
  "./js/ingest.js?v=22",
  "./js/key-pool.js?v=22",
  "./js/knowledge.js?v=22",
  "./js/languages.js?v=22",
  "./js/question-copy.js?v=22",
  "./js/avatars.js?v=22",
  "./js/replies.js?v=22",
  "./js/translations-core.js?v=22",
  "./js/link-reader.js?v=22",
  "./js/llm.js?v=22",
  "./js/local-ai-worker.js?v=22",
  "./js/local-ai.js?v=22",
  "./js/model-paper.js?v=22",
  "./js/model-router.js?v=22",
  "./js/offline-check.js?v=22",
  "./js/motion.js?v=22",
  "./js/password-policy.js?v=22",
  "./js/play-ui.js?v=22",
  "./js/premium-ui.js?v=22",
  "./js/pro-mode.js?v=22",
  "./js/pro-ui.js?v=22",
  "./js/progress.js?v=22",
  "./js/providers.js?v=22",
  "./js/quiz.js?v=22",
  "./js/reader.js?v=22",
  "./js/retrieval.js?v=22",
  "./js/settings.js?v=22",
  "./js/social.js?v=22",
  "./js/startup.js?v=22",
  "./js/starter-shelf.js?v=22",
  "./js/student-keys.js?v=22",
  "./js/study-decks.js?v=22",
  "./js/updates.js?v=22",
  "./js/study-sheet.js?v=22",
  "./js/revision-plan.js?v=22",
  "./js/text.js?v=22",
  "./js/ui.js?v=22",
  "./js/util.js?v=22",
  "./js/vector.js?v=22",
  "./js/web.js?v=22",
  "./vendor/qr/qrcode.js?v=22",
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
      // No automatic skipWaiting: a new worker waits until the student taps
      // "Update now", so a lesson is never interrupted by a silent swap.
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
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
    if (response.ok) cache.put(request, response.clone());
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
    if (response.ok && response.type === "basic") cache.put(request, response.clone());
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
