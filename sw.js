/* Offline service worker for Vignan Vidyanikethan AI, release 2.2.0.
 * Versioned modules prevent an older active worker mixing code across releases. */

const CACHE_NAME = "vignan-vidyanikethan-ai-v67";
const CORE = [
  "./",
  "./index.html",
  "./privacy.html",
  "./terms.html",
  "./security.html",
  "./copyright.html",
  "./judge.html",
  "./welcome.html",
  "./blog/index.html",
  "./blog/feed.xml",
  "./.well-known/security.txt",
  "./styles.css",
  "./styles-premium.css?v=67",
  "./styles-identity.css?v=67",
  "./styles-legal.css?v=67",
  "./styles-judge.css?v=67",
  "./styles-welcome.css?v=67",
  "./styles-blog.css?v=67",
  "./styles-social.css?v=67",
  "./styles-pro.css?v=67",
  "./styles-painted.css?v=67",
  "./styles-custom.css?v=67",
  "./styles-next.css?v=67",
  "./manifest.webmanifest?v=67",
  "./precache.json",
  "./favicon.ico?v=67",
  "./icons/icon.svg?v=67",
  "./icons/icon-48.png?v=67",
  "./icons/icon-192.png?v=67",
  "./icons/icon-512.png?v=67",
  "./icons/icon-maskable-192.png?v=67",
  "./icons/icon-maskable-512.png?v=67",
  "./assets/brand/vignan-ai-mark.svg",
  "./assets/brand/nezaad-mark.png",
  "./assets/fonts/space-grotesk-latin.woff2",
  "./assets/fonts/manrope-latin.woff2",
  "./js/ai-nicknames.js?v=67",
  "./js/answer-quality.js?v=67",
  "./js/answer.js?v=67",
  "./js/app.js?v=67",
  "./js/auth.js?v=67",
  "./js/boot.js?v=67",
  "./js/card.js?v=67",
  "./js/chat-intents.js?v=67",
  "./js/chat-scroll.js?v=67",
  "./js/chat-ui.js?v=67",
  "./js/study-card.js?v=67",
  "./js/ask-recent.js?v=67",
  "./js/code-mode.js?v=67",
  "./js/chess.js?v=67",
  "./js/context.js?v=67",
  "./js/conversation.js?v=67",
  "./js/db.js?v=67",
  "./js/edit-audio.js?v=67",
  "./js/edit-studio.js?v=67",
  "./js/exam-packs.js?v=67",
  "./js/external-answer.js?v=67",
  "./js/files.js?v=67",
  "./js/flashcards.js?v=67",
  "./js/free-apis.js?v=67",
  "./js/goal-cards.js?v=67",
  "./js/friends-ui.js?v=67",
  "./js/i18n.js?v=67",
  "./js/ingest.js?v=67",
  "./js/key-pool.js?v=67",
  "./js/knowledge.js?v=67",
  "./js/languages.js?v=67",
  "./js/question-copy.js?v=67",
  "./js/avatars.js?v=67",
  "./js/replies.js?v=67",
  "./js/translations-core.js?v=67",
  "./js/link-reader.js?v=67",
  "./js/llm.js?v=67",
  "./js/local-ai-worker.js?v=67",
  "./js/local-ai.js?v=67",
  "./js/model-paper.js?v=67",
  "./js/memory.js?v=67",
  "./js/model-router.js?v=67",
  "./js/notes.js?v=67",
  "./js/offline-check.js?v=67",
  "./js/offline-mode.js?v=67",
  "./js/motion.js?v=67",
  "./js/password-policy.js?v=67",
  "./js/play-ui.js?v=67",
  "./js/premium-ui.js?v=67",
  "./js/pro-mode.js?v=67",
  "./js/pro-ui.js?v=67",
  "./js/progress.js?v=67",
  "./js/providers.js?v=67",
  "./js/quiz.js?v=67",
  "./js/reader.js?v=67",
  "./js/retrieval.js?v=67",
  "./js/settings.js?v=67",
  "./js/shell.js?v=67",
  "./js/social.js?v=67",
  "./js/startup.js?v=67",
  "./js/starter-shelf.js?v=67",
  "./js/student-keys.js?v=67",
  "./js/study-decks.js?v=67",
  "./js/updates.js?v=67",
  "./js/viewport.js?v=67",
  "./js/voice.js?v=67",
  "./js/viva.js?v=67",
  "./js/study-sheet.js?v=67",
  "./js/themes.js?v=67",
  "./js/theme-paint.js?v=67",
  "./js/revision-plan.js?v=67",
  "./js/text.js?v=67",
  "./js/ui.js?v=67",
  "./js/util.js?v=67",
  "./js/vector.js?v=67",
  "./js/web.js?v=67",
  "./vendor/qr/qrcode.js?v=67",
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
