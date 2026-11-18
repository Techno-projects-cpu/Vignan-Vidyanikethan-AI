/* Offline service worker for Vignan Vidyanikethan AI, release 2.2.0.
 * Versioned modules prevent an older active worker mixing code across releases. */

const CACHE_NAME = "vignan-vidyanikethan-ai-v66";
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
  "./styles-premium.css?v=66",
  "./styles-identity.css?v=66",
  "./styles-legal.css?v=66",
  "./styles-judge.css?v=66",
  "./styles-welcome.css?v=66",
  "./styles-blog.css?v=66",
  "./styles-social.css?v=66",
  "./styles-pro.css?v=66",
  "./styles-painted.css?v=66",
  "./styles-custom.css?v=66",
  "./styles-next.css?v=66",
  "./manifest.webmanifest?v=66",
  "./precache.json",
  "./favicon.ico?v=66",
  "./icons/icon.svg?v=66",
  "./icons/icon-48.png?v=66",
  "./icons/icon-192.png?v=66",
  "./icons/icon-512.png?v=66",
  "./icons/icon-maskable-192.png?v=66",
  "./icons/icon-maskable-512.png?v=66",
  "./assets/brand/vignan-ai-mark.svg",
  "./assets/brand/nezaad-mark.png",
  "./assets/fonts/space-grotesk-latin.woff2",
  "./assets/fonts/manrope-latin.woff2",
  "./js/ai-nicknames.js?v=66",
  "./js/answer-quality.js?v=66",
  "./js/answer.js?v=66",
  "./js/app.js?v=66",
  "./js/auth.js?v=66",
  "./js/boot.js?v=66",
  "./js/card.js?v=66",
  "./js/chat-intents.js?v=66",
  "./js/chat-scroll.js?v=66",
  "./js/chat-ui.js?v=66",
  "./js/study-card.js?v=66",
  "./js/ask-recent.js?v=66",
  "./js/code-mode.js?v=66",
  "./js/chess.js?v=66",
  "./js/context.js?v=66",
  "./js/conversation.js?v=66",
  "./js/db.js?v=66",
  "./js/edit-audio.js?v=66",
  "./js/edit-studio.js?v=66",
  "./js/exam-packs.js?v=66",
  "./js/external-answer.js?v=66",
  "./js/files.js?v=66",
  "./js/flashcards.js?v=66",
  "./js/free-apis.js?v=66",
  "./js/goal-cards.js?v=66",
  "./js/friends-ui.js?v=66",
  "./js/i18n.js?v=66",
  "./js/ingest.js?v=66",
  "./js/key-pool.js?v=66",
  "./js/knowledge.js?v=66",
  "./js/languages.js?v=66",
  "./js/question-copy.js?v=66",
  "./js/avatars.js?v=66",
  "./js/replies.js?v=66",
  "./js/translations-core.js?v=66",
  "./js/link-reader.js?v=66",
  "./js/llm.js?v=66",
  "./js/local-ai-worker.js?v=66",
  "./js/local-ai.js?v=66",
  "./js/model-paper.js?v=66",
  "./js/memory.js?v=66",
  "./js/model-router.js?v=66",
  "./js/notes.js?v=66",
  "./js/offline-check.js?v=66",
  "./js/offline-mode.js?v=66",
  "./js/motion.js?v=66",
  "./js/password-policy.js?v=66",
  "./js/play-ui.js?v=66",
  "./js/premium-ui.js?v=66",
  "./js/pro-mode.js?v=66",
  "./js/pro-ui.js?v=66",
  "./js/progress.js?v=66",
  "./js/providers.js?v=66",
  "./js/quiz.js?v=66",
  "./js/reader.js?v=66",
  "./js/retrieval.js?v=66",
  "./js/settings.js?v=66",
  "./js/shell.js?v=66",
  "./js/social.js?v=66",
  "./js/startup.js?v=66",
  "./js/starter-shelf.js?v=66",
  "./js/student-keys.js?v=66",
  "./js/study-decks.js?v=66",
  "./js/updates.js?v=66",
  "./js/viewport.js?v=66",
  "./js/voice.js?v=66",
  "./js/viva.js?v=66",
  "./js/study-sheet.js?v=66",
  "./js/themes.js?v=66",
  "./js/theme-paint.js?v=66",
  "./js/revision-plan.js?v=66",
  "./js/text.js?v=66",
  "./js/ui.js?v=66",
  "./js/util.js?v=66",
  "./js/vector.js?v=66",
  "./js/web.js?v=66",
  "./vendor/qr/qrcode.js?v=66",
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
