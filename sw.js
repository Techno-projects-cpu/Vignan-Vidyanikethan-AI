/* Offline service worker for Vignan Vidyanikethan AI, release 2.2.0.
 * Versioned modules prevent an older active worker mixing code across releases. */

const CACHE_NAME = "vignan-vidyanikethan-ai-v84";
const CORE = [
  "./",
  "./index.html",
  "./privacy.html",
  "./terms.html",
  "./security.html",
  "./copyright.html",
  "./judge.html",
  "./presentation.html",
  "./styles-presentation.css?v=84",
  "./js/presentation.js?v=84",
  "./welcome.html",
  "./blog/index.html",
  "./blog/feed.xml",
  "./.well-known/security.txt",
  "./styles.css",
  "./styles.css?v=84",
  "./styles-premium.css?v=84",
  "./styles-identity.css?v=84",
  "./styles-legal.css?v=84",
  "./styles-judge.css?v=84",
  "./styles-welcome.css?v=84",
  "./styles-blog.css?v=84",
  "./styles-social.css?v=84",
  "./styles-pro.css?v=84",
  "./styles-glass.css?v=84",
  "./styles-painted.css?v=84",
  "./styles-custom.css?v=84",
  "./styles-next.css?v=84",
  "./manifest.webmanifest?v=84",
  "./precache.json",
  "./favicon.ico?v=84",
  "./icons/icon.svg?v=84",
  "./icons/icon-48.png?v=84",
  "./icons/icon-192.png?v=84",
  "./icons/icon-512.png?v=84",
  "./icons/icon-maskable-192.png?v=84",
  "./icons/icon-maskable-512.png?v=84",
  "./assets/brand/vignan-ai-mark.svg",
  "./assets/brand/nezaad-mark.png",
  "./assets/fonts/space-grotesk-latin.woff2",
  "./assets/fonts/manrope-latin.woff2",
  "./js/ai-nicknames.js?v=84",
  "./js/answer-quality.js?v=84",
  "./js/answer.js?v=84",
  "./js/app.js?v=84",
  "./js/auth.js?v=84",
  "./js/boot.js?v=84",
  "./js/glass-lens.js?v=84",
  "./js/card.js?v=84",
  "./js/chat-intents.js?v=84",
  "./js/chat-scroll.js?v=84",
  "./js/chat-ui.js?v=84",
  "./js/study-card.js?v=84",
  "./js/ask-recent.js?v=84",
  "./js/code-mode.js?v=84",
  "./js/chess.js?v=84",
  "./js/context.js?v=84",
  "./js/conversation.js?v=84",
  "./js/db.js?v=84",
  "./js/edit-audio.js?v=84",
  "./js/edit-studio.js?v=84",
  "./js/exam-packs.js?v=84",
  "./js/external-answer.js?v=84",
  "./js/files.js?v=84",
  "./js/flashcards.js?v=84",
  "./js/free-apis.js?v=84",
  "./js/goal-cards.js?v=84",
  "./js/friends-ui.js?v=84",
  "./js/i18n.js?v=84",
  "./js/ingest.js?v=84",
  "./js/key-pool.js?v=84",
  "./js/knowledge.js?v=84",
  "./js/languages.js?v=84",
  "./js/question-copy.js?v=84",
  "./js/avatars.js?v=84",
  "./js/replies.js?v=84",
  "./js/translations-core.js?v=84",
  "./js/link-reader.js?v=84",
  "./js/llm.js?v=84",
  "./js/local-ai-worker.js?v=84",
  "./js/local-ai.js?v=84",
  "./js/model-paper.js?v=84",
  "./js/memory.js?v=84",
  "./js/model-router.js?v=84",
  "./js/notes.js?v=84",
  "./js/offline-check.js?v=84",
  "./js/offline-mode.js?v=84",
  "./js/motion.js?v=84",
  "./js/password-policy.js?v=84",
  "./js/play-ui.js?v=84",
  "./js/premium-ui.js?v=84",
  "./js/pro-mode.js?v=84",
  "./js/pro-ui.js?v=84",
  "./js/progress.js?v=84",
  "./js/providers.js?v=84",
  "./js/quiz.js?v=84",
  "./js/reader.js?v=84",
  "./js/retrieval.js?v=84",
  "./js/settings.js?v=84",
  "./js/shell.js?v=84",
  "./js/social.js?v=84",
  "./js/startup.js?v=84",
  "./js/starter-shelf.js?v=84",
  "./js/student-keys.js?v=84",
  "./js/study-decks.js?v=84",
  "./js/updates.js?v=84",
  "./js/viewport.js?v=84",
  "./js/voice.js?v=84",
  "./js/viva.js?v=84",
  "./js/study-sheet.js?v=84",
  "./js/themes.js?v=84",
  "./js/tour.js?v=84",
  "./js/theme-paint.js?v=84",
  "./js/theme-glass.js?v=84",
  "./js/revision-plan.js?v=84",
  "./js/text.js?v=84",
  "./js/ui.js?v=84",
  "./js/util.js?v=84",
  "./js/vector.js?v=84",
  "./js/web.js?v=84",
  "./vendor/qr/qrcode.js?v=84",
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
