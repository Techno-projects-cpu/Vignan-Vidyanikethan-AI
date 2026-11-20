// Optional Chromium gate. Supply external browser module URLs as in check-study-start.
const { default: puppeteer } = await import(process.env.PUPPETEER_MODULE || 'puppeteer-core');
const { default: chromium } = await import(process.env.CHROMIUM_MODULE || '@sparticuz/chromium');
import assert from 'node:assert/strict';
const origin = process.env.CHAT_URL || 'http://localhost:4173/';
const browser = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: chromium.args, headless: 'shell' });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin, { waitUntil: 'networkidle0' });
  const result = await page.evaluate(async () => {
    const { DEFAULT_LOCAL_MODEL_ID } = await import('./js/local-ai.js');
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL('./js/local-ai-worker.js', location.href), { type: 'module' });
      const timer = setTimeout(() => { worker.terminate(); reject(new Error('Real runtime worker failed to answer')); }, 15000);
      worker.onerror = event => { clearTimeout(timer); worker.terminate(); reject(new Error(event.message)); };
      worker.onmessage = ({ data }) => { clearTimeout(timer); worker.terminate(); resolve(data); };
      // Cache status imports the real runtime but does not download model weights.
      worker.postMessage({ id: 1, type: 'status', payload: { modelId: DEFAULT_LOCAL_MODEL_ID } });
    });
  });
  assert.equal(result.type, 'status');
  assert.equal(typeof result.cached, 'boolean');
  assert.deepEqual(errors, []);
  console.log('Real bundled WebLLM worker imports under served CSP and answers cache status: PASS');
  console.log('This does not test a model download, GPU inference or a live cloud provider.');
} finally { await browser.close(); }
