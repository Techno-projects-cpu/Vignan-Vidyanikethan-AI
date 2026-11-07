/* Offline service worker for Vignan Vidyanikethan AI, release 2.2.0.
 * Versioned modules prevent an older active worker mixing code across releases. */

const CACHE_NAME = "vignan-vidyanikethan-ai-v54";
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
  "./styles-premium.css?v=54",
  "./styles-identity.css?v=54",
  "./styles-legal.css?v=54",
  "./styles-judge.css?v=54",
  "./styles-welcome.css?v=54",
  "./styles-blog.css?v=54",
  "./styles-social.css?v=54",
  "./styles-pro.css?v=54",
  "./styles-custom.css?v=54",
  "./styles-next.css?v=54",
  "./manifest.webmanifest?v=54",
  "./precache.json",
  "./favicon.ico?v=54",
  "./icons/icon.svg?v=54",
  "./icons/icon-48.png?v=54",
  "./icons/icon-192.png?v=54",
  "./icons/icon-512.png?v=54",
  "./icons/icon-maskable-192.png?v=54",
  "./icons/icon-maskable-512.png?v=54",
  "./assets/brand/vignan-ai-mark.svg",
  "./assets/brand/nezaad-mark.png",
  "./assets/fonts/space-grotesk-latin.woff2",
  "./assets/fonts/manrope-latin.woff2",
  "./js/ai-nicknames.js?v=54",
  "./js/answer-quality.js?v=54",
  "./js/answer.js?v=54",
  "./js/app.js?v=54",
  "./js/auth.js?v=54",
  "./js/boot.js?v=54",
  "./js/card.js?v=54",
  "./js/chat-intents.js?v=54",
  "./js/chat-scroll.js?v=54",
  "./js/chat-ui.js?v=54",
  "./js/code-mode.js?v=54",
  "./js/chess.js?v=54",
  "./js/context.js?v=54",
  "./js/conversation.js?v=54",
  "./js/db.js?v=54",
  "./js/edit-audio.js?v=54",
  "./js/edit-studio.js?v=54",
  "./js/exam-packs.js?v=54",
  "./js/external-answer.js?v=54",
  "./js/files.js?v=54",
  "./js/flashcards.js?v=54",
  "./js/free-apis.js?v=54",
  "./js/goal-cards.js?v=54",
  "./js/friends-ui.js?v=54",
  "./js/i18n.js?v=54",
  "./js/ingest.js?v=54",
  "./js/key-pool.js?v=54",
  "./js/knowledge.js?v=54",
  "./js/languages.js?v=54",
  "./js/question-copy.js?v=54",
  "./js/avatars.js?v=54",
  "./js/replies.js?v=54",
  "./js/translations-core.js?v=54",
  "./js/link-reader.js?v=54",
  "./js/llm.js?v=54",
  "./js/local-ai-worker.js?v=54",
  "./js/local-ai.js?v=54",
  "./js/model-paper.js?v=54",
  "./js/memory.js?v=54",
  "./js/model-router.js?v=54",
  "./js/notes.js?v=54",
  "./js/offline-check.js?v=54",
  "./js/offline-mode.js?v=54",
  "./js/motion.js?v=54",
  "./js/password-policy.js?v=54",
  "./js/play-ui.js?v=54",
  "./js/premium-ui.js?v=54",
  "./js/pro-mode.js?v=54",
  "./js/pro-ui.js?v=54",
  "./js/progress.js?v=54",
  "./js/providers.js?v=54",
  "./js/quiz.js?v=54",
  "./js/reader.js?v=54",
  "./js/retrieval.js?v=54",
  "./js/settings.js?v=54",
  "./js/shell.js?v=54",
  "./js/social.js?v=54",
  "./js/startup.js?v=54",
  "./js/starter-shelf.js?v=54",
  "./js/student-keys.js?v=54",
  "./js/study-decks.js?v=54",
  "./js/updates.js?v=54",
  "./js/viewport.js?v=54",
  "./js/voice.js?v=54",
  "./js/viva.js?v=54",
  "./js/study-sheet.js?v=54",
  "./js/themes.js?v=54",
  "./js/revision-plan.js?v=54",
  "./js/text.js?v=54",
  "./js/ui.js?v=54",
  "./js/util.js?v=54",
  "./js/vector.js?v=54",
  "./js/web.js?v=54",
  "./vendor/qr/qrcode.js?v=54",
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
