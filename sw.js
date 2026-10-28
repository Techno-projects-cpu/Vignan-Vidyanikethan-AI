/* Offline service worker for Vignan Vidyanikethan AI, release 1.9.0.
 * Versioned modules prevent an older active worker mixing code across releases. */

const CACHE_NAME = "vignan-vidyanikethan-ai-v15";
const CORE = [
  "./",
  "./index.html",
  "./privacy.html",
  "./terms.html",
  "./styles.css",
  "./styles-premium.css?v=15",
  "./styles-identity.css?v=15",
  "./styles-legal.css?v=15",
  "./manifest.webmanifest?v=15",
  "./precache.json",
  "./favicon.ico?v=15",
  "./icons/icon.svg?v=15",
  "./icons/icon-48.png?v=15",
  "./icons/icon-192.png?v=15",
  "./icons/icon-512.png?v=15",
  "./icons/icon-maskable-192.png?v=15",
  "./icons/icon-maskable-512.png?v=15",
  "./assets/brand/vignan-ai-mark.svg",
  "./assets/brand/nezaad-mark.png",
  "./assets/fonts/space-grotesk-latin.woff2",
  "./assets/fonts/manrope-latin.woff2",
  "./js/ai-nicknames.js?v=15",
  "./js/answer.js?v=15",
  "./js/app.js?v=15",
  "./js/auth.js?v=15",
  "./js/boot.js?v=15",
  "./js/card.js?v=15",
  "./js/chat-intents.js?v=15",
  "./js/context.js?v=15",
  "./js/conversation.js?v=15",
  "./js/db.js?v=15",
  "./js/edit-audio.js?v=15",
  "./js/edit-studio.js?v=15",
  "./js/external-answer.js?v=15",
  "./js/files.js?v=15",
  "./js/flashcards.js?v=15",
  "./js/free-apis.js?v=15",
  "./js/i18n.js?v=15",
  "./js/ingest.js?v=15",
  "./js/key-pool.js?v=15",
  "./js/link-reader.js?v=15",
  "./js/llm.js?v=15",
  "./js/local-ai-worker.js?v=15",
  "./js/local-ai.js?v=15",
  "./js/model-paper.js?v=15",
  "./js/model-router.js?v=15",
  "./js/motion.js?v=15",
  "./js/password-policy.js?v=15",
  "./js/premium-ui.js?v=15",
  "./js/progress.js?v=15",
  "./js/providers.js?v=15",
  "./js/quiz.js?v=15",
  "./js/reader.js?v=15",
  "./js/retrieval.js?v=15",
  "./js/settings.js?v=15",
  "./js/startup.js?v=15",
  "./js/student-keys.js?v=15",
  "./js/study-decks.js?v=15",
  "./js/text.js?v=15",
  "./js/ui.js?v=15",
  "./js/util.js?v=15",
  "./js/vector.js?v=15",
  "./js/web.js?v=15",
  "./vendor/qr/qrcode.js?v=15",
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
