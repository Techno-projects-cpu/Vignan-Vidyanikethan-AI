// Optional rendered gate; uses only local test data, not actual model weights/accounts.
import assert from 'node:assert/strict';
const { default: puppeteer } = await import(process.env.PUPPETEER_MODULE || 'puppeteer-core');
const { default: chromium } = await import(process.env.CHROMIUM_MODULE || '@sparticuz/chromium');
const browser = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: chromium.args, headless: 'shell' });
const markerCache = 'webllm/browser-resilience-test';
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewport({ width: 768, height: 1024 });
  await page.evaluateOnNewDocument(() => localStorage.setItem('vignan.firstRun.v3', 'done'));
  const origin = new URL(process.env.CHAT_URL || 'http://localhost:4173/').origin;
  await page.goto(origin, { waitUntil: 'networkidle0' });
  // Before app initialization registers its worker, create an unrelated cache.
  await page.evaluate(async name => {
    const cache = await caches.open(name);
    await cache.put('/synthetic-model-marker', new Response('synthetic cached model marker'));
  }, markerCache);
  await page.evaluate(() => document.querySelector('#startup-skip')?.click());
  await page.waitForFunction(() => !document.querySelector('#gate-guest-button').disabled);
  await page.click('#gate-guest-button');
  await page.waitForFunction(() => document.querySelector('#view-start.active'));
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), { timeout: 60000 });
  await new Promise(resolve => setTimeout(resolve, 700));
  assert.equal(await page.evaluate(async name => (await caches.keys()).includes(name), markerCache), true,
    'real worker activation preserves unrelated/model caches');
  await page.type('#start-question', 'Keep this unsent draft');
  const before = await page.evaluate(() => performance.timeOrigin);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    delete document.visibilityState;
  });
  await new Promise(resolve => setTimeout(resolve, 500));
  assert.equal(await page.evaluate(() => performance.timeOrigin), before, 'hiding a tab alone must not reload');
  assert.equal(await page.$eval('#start-question', input => input.value), 'Keep this unsent draft');
  for (const path of ['/setup', '/admin']) {
    await page.goto(origin + path, { waitUntil: 'networkidle0' });
  }
  const cachedPrivatePages = await page.evaluate(async () => {
    const names = await caches.keys(), privateUrls = [];
    for (const name of names.filter(name => /^vignan-vidyanikethan-ai-v\d+$/.test(name))) {
      for (const request of await (await caches.open(name)).keys()) {
        if (/^\/(admin|setup)(\/|$|\.html$)/.test(new URL(request.url).pathname)) privateUrls.push(request.url);
      }
    }
    return privateUrls;
  });
  assert.deepEqual(cachedPrivatePages, []);
  await page.evaluate(name => caches.delete(name), markerCache);
  assert.deepEqual(errors, []);
  console.log('Real worker preserves synthetic model cache; tab-hide preserves draft without reload; operator pages absent from app cache: PASS');
} finally { await browser.close(); }
