/* Offline service worker for Vignan Vidyanikethan AI, release 2.2.0.
 * Versioned modules prevent an older active worker mixing code across releases. */

const CACHE_NAME = "vignan-vidyanikethan-ai-v45";
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
  "./styles-premium.css?v=45",
  "./styles-identity.css?v=45",
  "./styles-legal.css?v=45",
  "./styles-judge.css?v=45",
  "./styles-social.css?v=45",
  "./styles-pro.css?v=45",
  "./styles-custom.css?v=45",
  "./styles-next.css?v=45",
  "./manifest.webmanifest?v=45",
  "./precache.json",
  "./favicon.ico?v=45",
  "./icons/icon.svg?v=45",
  "./icons/icon-48.png?v=45",
  "./icons/icon-192.png?v=45",
  "./icons/icon-512.png?v=45",
  "./icons/icon-maskable-192.png?v=45",
  "./icons/icon-maskable-512.png?v=45",
  "./assets/brand/vignan-ai-mark.svg",
  "./assets/brand/nezaad-mark.png",
  "./assets/fonts/space-grotesk-latin.woff2",
  "./assets/fonts/manrope-latin.woff2",
  "./js/ai-nicknames.js?v=45",
  "./js/answer-quality.js?v=45",
  "./js/answer.js?v=45",
  "./js/app.js?v=45",
  "./js/auth.js?v=45",
  "./js/boot.js?v=45",
  "./js/card.js?v=45",
  "./js/chat-intents.js?v=45",
  "./js/chat-ui.js?v=45",
  "./js/chess.js?v=45",
  "./js/context.js?v=45",
  "./js/conversation.js?v=45",
  "./js/db.js?v=45",
  "./js/edit-audio.js?v=45",
  "./js/edit-studio.js?v=45",
  "./js/exam-packs.js?v=45",
  "./js/external-answer.js?v=45",
  "./js/files.js?v=45",
  "./js/flashcards.js?v=45",
  "./js/free-apis.js?v=45",
  "./js/goal-cards.js?v=45",
  "./js/friends-ui.js?v=45",
  "./js/i18n.js?v=45",
  "./js/ingest.js?v=45",
  "./js/key-pool.js?v=45",
  "./js/knowledge.js?v=45",
  "./js/languages.js?v=45",
  "./js/question-copy.js?v=45",
  "./js/avatars.js?v=45",
  "./js/replies.js?v=45",
  "./js/translations-core.js?v=45",
  "./js/link-reader.js?v=45",
  "./js/llm.js?v=45",
  "./js/local-ai-worker.js?v=45",
  "./js/local-ai.js?v=45",
  "./js/model-paper.js?v=45",
  "./js/model-router.js?v=45",
  "./js/notes.js?v=45",
  "./js/offline-check.js?v=45",
  "./js/offline-mode.js?v=45",
  "./js/motion.js?v=45",
  "./js/password-policy.js?v=45",
  "./js/play-ui.js?v=45",
  "./js/premium-ui.js?v=45",
  "./js/pro-mode.js?v=45",
  "./js/pro-ui.js?v=45",
  "./js/progress.js?v=45",
  "./js/providers.js?v=45",
  "./js/quiz.js?v=45",
  "./js/reader.js?v=45",
  "./js/retrieval.js?v=45",
  "./js/settings.js?v=45",
  "./js/social.js?v=45",
  "./js/startup.js?v=45",
  "./js/starter-shelf.js?v=45",
  "./js/student-keys.js?v=45",
  "./js/study-decks.js?v=45",
  "./js/updates.js?v=45",
  "./js/viewport.js?v=45",
  "./js/voice.js?v=45",
  "./js/viva.js?v=45",
  "./js/study-sheet.js?v=45",
  "./js/themes.js?v=45",
  "./js/revision-plan.js?v=45",
  "./js/text.js?v=45",
  "./js/ui.js?v=45",
  "./js/util.js?v=45",
  "./js/vector.js?v=45",
  "./js/web.js?v=45",
  "./vendor/qr/qrcode.js?v=45",
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
