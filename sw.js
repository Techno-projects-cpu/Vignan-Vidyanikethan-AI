/* Offline service worker for Vignan Vidyanikethan AI, release 2.2.0.
 * Versioned modules prevent an older active worker mixing code across releases. */

const CACHE_NAME = "vignan-vidyanikethan-ai-v57";
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
  "./styles-premium.css?v=57",
  "./styles-identity.css?v=57",
  "./styles-legal.css?v=57",
  "./styles-judge.css?v=57",
  "./styles-welcome.css?v=57",
  "./styles-blog.css?v=57",
  "./styles-social.css?v=57",
  "./styles-pro.css?v=57",
  "./styles-custom.css?v=57",
  "./styles-next.css?v=57",
  "./manifest.webmanifest?v=57",
  "./precache.json",
  "./favicon.ico?v=57",
  "./icons/icon.svg?v=57",
  "./icons/icon-48.png?v=57",
  "./icons/icon-192.png?v=57",
  "./icons/icon-512.png?v=57",
  "./icons/icon-maskable-192.png?v=57",
  "./icons/icon-maskable-512.png?v=57",
  "./assets/brand/vignan-ai-mark.svg",
  "./assets/brand/nezaad-mark.png",
  "./assets/fonts/space-grotesk-latin.woff2",
  "./assets/fonts/manrope-latin.woff2",
  "./js/ai-nicknames.js?v=57",
  "./js/answer-quality.js?v=57",
  "./js/answer.js?v=57",
  "./js/app.js?v=57",
  "./js/auth.js?v=57",
  "./js/boot.js?v=57",
  "./js/card.js?v=57",
  "./js/chat-intents.js?v=57",
  "./js/chat-scroll.js?v=57",
  "./js/chat-ui.js?v=57",
  "./js/code-mode.js?v=57",
  "./js/chess.js?v=57",
  "./js/context.js?v=57",
  "./js/conversation.js?v=57",
  "./js/db.js?v=57",
  "./js/edit-audio.js?v=57",
  "./js/edit-studio.js?v=57",
  "./js/exam-packs.js?v=57",
  "./js/external-answer.js?v=57",
  "./js/files.js?v=57",
  "./js/flashcards.js?v=57",
  "./js/free-apis.js?v=57",
  "./js/goal-cards.js?v=57",
  "./js/friends-ui.js?v=57",
  "./js/i18n.js?v=57",
  "./js/ingest.js?v=57",
  "./js/key-pool.js?v=57",
  "./js/knowledge.js?v=57",
  "./js/languages.js?v=57",
  "./js/question-copy.js?v=57",
  "./js/avatars.js?v=57",
  "./js/replies.js?v=57",
  "./js/translations-core.js?v=57",
  "./js/link-reader.js?v=57",
  "./js/llm.js?v=57",
  "./js/local-ai-worker.js?v=57",
  "./js/local-ai.js?v=57",
  "./js/model-paper.js?v=57",
  "./js/memory.js?v=57",
  "./js/model-router.js?v=57",
  "./js/notes.js?v=57",
  "./js/offline-check.js?v=57",
  "./js/offline-mode.js?v=57",
  "./js/motion.js?v=57",
  "./js/password-policy.js?v=57",
  "./js/play-ui.js?v=57",
  "./js/premium-ui.js?v=57",
  "./js/pro-mode.js?v=57",
  "./js/pro-ui.js?v=57",
  "./js/progress.js?v=57",
  "./js/providers.js?v=57",
  "./js/quiz.js?v=57",
  "./js/reader.js?v=57",
  "./js/retrieval.js?v=57",
  "./js/settings.js?v=57",
  "./js/shell.js?v=57",
  "./js/social.js?v=57",
  "./js/startup.js?v=57",
  "./js/starter-shelf.js?v=57",
  "./js/student-keys.js?v=57",
  "./js/study-decks.js?v=57",
  "./js/updates.js?v=57",
  "./js/viewport.js?v=57",
  "./js/voice.js?v=57",
  "./js/viva.js?v=57",
  "./js/study-sheet.js?v=57",
  "./js/themes.js?v=57",
  "./js/revision-plan.js?v=57",
  "./js/text.js?v=57",
  "./js/ui.js?v=57",
  "./js/util.js?v=57",
  "./js/vector.js?v=57",
  "./js/web.js?v=57",
  "./vendor/qr/qrcode.js?v=57",
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
