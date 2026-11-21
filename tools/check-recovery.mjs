// Optional Chromium regression gate; cloud calls and inference are deliberately mocked.
import assert from 'node:assert/strict';
const { default: puppeteer } = await import(process.env.PUPPETEER_MODULE || 'puppeteer-core');
const { default: chromium } = await import(process.env.CHROMIUM_MODULE || '@sparticuz/chromium');
const browser = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: chromium.args, headless: 'shell' });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewport({ width: 768, height: 1024 });
  await page.evaluateOnNewDocument(() => localStorage.setItem('vignan.firstRun.v3', 'done'));
  let cloudCalls = 0;
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/api/ai') {
      cloudCalls++;
      return request.respond({ status: 503, contentType: 'application/json', body: '{"error":"Test service unavailable"}' });
    }
    return request.continue();
  });
  await page.goto(process.env.CHAT_URL || 'http://localhost:4173/', { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.querySelector('#startup-skip')?.click());
  await page.waitForFunction(() => !document.querySelector('#gate-guest-button').disabled);
  await page.click('#gate-guest-button');
  await page.waitForFunction(() => document.querySelector('#view-start.active'));
  await new Promise(resolve => setTimeout(resolve, 700));
  await page.evaluate(() => document.querySelector('.start-tools [data-view="settings"]').click());
  await page.waitForFunction(() => document.querySelector('#view-settings.active'));
  await new Promise(resolve => setTimeout(resolve, 600));
  await page.click('[data-settings-tab="ai"]');
  const results = await page.evaluate(async () => {
    const query = new URL(document.querySelector('script[src*="?v="]').src).search;
    const local = await import(`./js/local-ai.js${query}`);
    const { normalizeSettings } = await import(`./js/settings.js${query}`);
    const { callRoutedModel } = await import(`./js/model-router.js${query}`);
    const recovery = await import(`./js/recovery.js${query}`);
    recovery.resetRecovery();
    local.resetLocalAIForTests();
    local.setLocalAICapabilities({ webgpu: true, worker: true });
    const posted = [];
    local.setLocalAIWorkerFactory(() => ({
      terminate() {},
      postMessage(message) {
        posted.push(message.type);
        if (message.type === 'load') this.onmessage({ data: { type: 'result', id: message.id, data: { modelId: message.payload.modelId } } });
        if (message.type === 'generate') this.onmessage({ data: { type: 'result', id: message.id, data: { modelId: message.payload.modelId, content: 'Mock local answer' } } });
      },
    }));
    await local.loadLocalModel(local.DEFAULT_LOCAL_MODEL_ID);
    const settings = normalizeSettings({ routing: { answer: 'server' } });
    const routed = [];
    for (let i = 0; i < 3; i++) routed.push((await callRoutedModel({ settings, messages: [{ role: 'user', content: 'Test recovery' }] })).providerId);
    return { routed, loads: posted.filter(type => type === 'load').length, status: document.querySelector('#ai-recovery-status').textContent, query };
  });
  assert.deepEqual(results.routed, ['webllm', 'webllm', 'webllm']);
  assert.equal(cloudCalls, 2, 'third question bypasses cooled cloud route');
  assert.equal(results.loads, 1, 'no recovery download');
  assert.match(results.status, /Recovered with Nova/);
  assert.ok(await page.$eval('#recovery-heading', element => element.getBoundingClientRect().height > 0), 'panel visible on tablet');
  await page.click('#recovery-reset');
  assert.match(await page.$eval('#ai-recovery-status', element => element.textContent), /Automatic recovery is ready/);
  await page.click('#settings-auto-recovery');
  assert.match(await page.$eval('#ai-recovery-status', element => element.textContent), /are off/);
  for (const width of [390, 768, 1366]) {
    await page.setViewport({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `settings overflow at ${width}`);
  }
  assert.deepEqual(errors, []);
  console.log('Cloud 503 → ready Nova; repeated failure cooldown; no extra load; visible Settings controls and reset/opt-out; three widths: PASS (mock inference)');
} finally { await browser.close(); }
