/* Offline service worker for Vignan Vidyanikethan AI, release 2.2.0.
 * Versioned modules prevent an older active worker mixing code across releases. */

const CACHE_NAME = "vignan-vidyanikethan-ai-v58";
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
  "./styles-premium.css?v=58",
  "./styles-identity.css?v=58",
  "./styles-legal.css?v=58",
  "./styles-judge.css?v=58",
  "./styles-welcome.css?v=58",
  "./styles-blog.css?v=58",
  "./styles-social.css?v=58",
  "./styles-pro.css?v=58",
  "./styles-custom.css?v=58",
  "./styles-next.css?v=58",
  "./manifest.webmanifest?v=58",
  "./precache.json",
  "./favicon.ico?v=58",
  "./icons/icon.svg?v=58",
  "./icons/icon-48.png?v=58",
  "./icons/icon-192.png?v=58",
  "./icons/icon-512.png?v=58",
  "./icons/icon-maskable-192.png?v=58",
  "./icons/icon-maskable-512.png?v=58",
  "./assets/brand/vignan-ai-mark.svg",
  "./assets/brand/nezaad-mark.png",
  "./assets/fonts/space-grotesk-latin.woff2",
  "./assets/fonts/manrope-latin.woff2",
  "./js/ai-nicknames.js?v=58",
  "./js/answer-quality.js?v=58",
  "./js/answer.js?v=58",
  "./js/app.js?v=58",
  "./js/auth.js?v=58",
  "./js/boot.js?v=58",
  "./js/card.js?v=58",
  "./js/chat-intents.js?v=58",
  "./js/chat-scroll.js?v=58",
  "./js/chat-ui.js?v=58",
  "./js/code-mode.js?v=58",
  "./js/chess.js?v=58",
  "./js/context.js?v=58",
  "./js/conversation.js?v=58",
  "./js/db.js?v=58",
  "./js/edit-audio.js?v=58",
  "./js/edit-studio.js?v=58",
  "./js/exam-packs.js?v=58",
  "./js/external-answer.js?v=58",
  "./js/files.js?v=58",
  "./js/flashcards.js?v=58",
  "./js/free-apis.js?v=58",
  "./js/goal-cards.js?v=58",
  "./js/friends-ui.js?v=58",
  "./js/i18n.js?v=58",
  "./js/ingest.js?v=58",
  "./js/key-pool.js?v=58",
  "./js/knowledge.js?v=58",
  "./js/languages.js?v=58",
  "./js/question-copy.js?v=58",
  "./js/avatars.js?v=58",
  "./js/replies.js?v=58",
  "./js/translations-core.js?v=58",
  "./js/link-reader.js?v=58",
  "./js/llm.js?v=58",
  "./js/local-ai-worker.js?v=58",
  "./js/local-ai.js?v=58",
  "./js/model-paper.js?v=58",
  "./js/memory.js?v=58",
  "./js/model-router.js?v=58",
  "./js/notes.js?v=58",
  "./js/offline-check.js?v=58",
  "./js/offline-mode.js?v=58",
  "./js/motion.js?v=58",
  "./js/password-policy.js?v=58",
  "./js/play-ui.js?v=58",
  "./js/premium-ui.js?v=58",
  "./js/pro-mode.js?v=58",
  "./js/pro-ui.js?v=58",
  "./js/progress.js?v=58",
  "./js/providers.js?v=58",
  "./js/quiz.js?v=58",
  "./js/reader.js?v=58",
  "./js/retrieval.js?v=58",
  "./js/settings.js?v=58",
  "./js/shell.js?v=58",
  "./js/social.js?v=58",
  "./js/startup.js?v=58",
  "./js/starter-shelf.js?v=58",
  "./js/student-keys.js?v=58",
  "./js/study-decks.js?v=58",
  "./js/updates.js?v=58",
  "./js/viewport.js?v=58",
  "./js/voice.js?v=58",
  "./js/viva.js?v=58",
  "./js/study-sheet.js?v=58",
  "./js/themes.js?v=58",
  "./js/revision-plan.js?v=58",
  "./js/text.js?v=58",
  "./js/ui.js?v=58",
  "./js/util.js?v=58",
  "./js/vector.js?v=58",
  "./js/web.js?v=58",
  "./vendor/qr/qrcode.js?v=58",
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
