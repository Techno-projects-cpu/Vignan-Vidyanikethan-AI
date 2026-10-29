/* Offline service worker for Vignan Vidyanikethan AI, release 2.2.0.
 * Versioned modules prevent an older active worker mixing code across releases. */

const CACHE_NAME = "vignan-vidyanikethan-ai-v36";
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
  "./styles-premium.css?v=36",
  "./styles-identity.css?v=36",
  "./styles-legal.css?v=36",
  "./styles-judge.css?v=36",
  "./styles-social.css?v=36",
  "./styles-pro.css?v=36",
  "./styles-custom.css?v=36",
  "./manifest.webmanifest?v=36",
  "./precache.json",
  "./favicon.ico?v=36",
  "./icons/icon.svg?v=36",
  "./icons/icon-48.png?v=36",
  "./icons/icon-192.png?v=36",
  "./icons/icon-512.png?v=36",
  "./icons/icon-maskable-192.png?v=36",
  "./icons/icon-maskable-512.png?v=36",
  "./assets/brand/vignan-ai-mark.svg",
  "./assets/brand/nezaad-mark.png",
  "./assets/fonts/space-grotesk-latin.woff2",
  "./assets/fonts/manrope-latin.woff2",
  "./js/ai-nicknames.js?v=36",
  "./js/answer-quality.js?v=36",
  "./js/answer.js?v=36",
  "./js/app.js?v=36",
  "./js/auth.js?v=36",
  "./js/boot.js?v=36",
  "./js/card.js?v=36",
  "./js/chat-intents.js?v=36",
  "./js/chat-ui.js?v=36",
  "./js/chess.js?v=36",
  "./js/context.js?v=36",
  "./js/conversation.js?v=36",
  "./js/db.js?v=36",
  "./js/edit-audio.js?v=36",
  "./js/edit-studio.js?v=36",
  "./js/exam-packs.js?v=36",
  "./js/external-answer.js?v=36",
  "./js/files.js?v=36",
  "./js/flashcards.js?v=36",
  "./js/free-apis.js?v=36",
  "./js/goal-cards.js?v=36",
  "./js/friends-ui.js?v=36",
  "./js/i18n.js?v=36",
  "./js/ingest.js?v=36",
  "./js/key-pool.js?v=36",
  "./js/knowledge.js?v=36",
  "./js/languages.js?v=36",
  "./js/question-copy.js?v=36",
  "./js/avatars.js?v=36",
  "./js/replies.js?v=36",
  "./js/translations-core.js?v=36",
  "./js/link-reader.js?v=36",
  "./js/llm.js?v=36",
  "./js/local-ai-worker.js?v=36",
  "./js/local-ai.js?v=36",
  "./js/model-paper.js?v=36",
  "./js/model-router.js?v=36",
  "./js/notes.js?v=36",
  "./js/offline-check.js?v=36",
  "./js/motion.js?v=36",
  "./js/password-policy.js?v=36",
  "./js/play-ui.js?v=36",
  "./js/premium-ui.js?v=36",
  "./js/pro-mode.js?v=36",
  "./js/pro-ui.js?v=36",
  "./js/progress.js?v=36",
  "./js/providers.js?v=36",
  "./js/quiz.js?v=36",
  "./js/reader.js?v=36",
  "./js/retrieval.js?v=36",
  "./js/settings.js?v=36",
  "./js/social.js?v=36",
  "./js/startup.js?v=36",
  "./js/starter-shelf.js?v=36",
  "./js/student-keys.js?v=36",
  "./js/study-decks.js?v=36",
  "./js/updates.js?v=36",
  "./js/voice.js?v=36",
  "./js/viva.js?v=36",
  "./js/study-sheet.js?v=36",
  "./js/themes.js?v=36",
  "./js/revision-plan.js?v=36",
  "./js/text.js?v=36",
  "./js/ui.js?v=36",
  "./js/util.js?v=36",
  "./js/vector.js?v=36",
  "./js/web.js?v=36",
  "./vendor/qr/qrcode.js?v=36",
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
