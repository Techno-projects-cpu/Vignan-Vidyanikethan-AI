// Fresh profiles deliberately do NOT dismiss onboarding in localStorage.
import assert from 'node:assert/strict';
const { default: puppeteer } = await import(process.env.PUPPETEER_MODULE || 'puppeteer-core');
const { default: chromium } = await import(process.env.CHROMIUM_MODULE || '@sparticuz/chromium');
const browser = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: chromium.args, headless: 'shell' });
try {
  for (const width of [390, 768, 1024, 1366]) {
    const page = await browser.newPage();
    const session = await page.createCDPSession();
    await session.send('Storage.clearDataForOrigin', { origin: new URL(process.env.CHAT_URL || 'http://localhost:4173/').origin, storageTypes: 'all' });
    await session.detach();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewport({ width, height: 1024 });
    await page.goto(process.env.CHAT_URL || 'http://localhost:4173/', { waitUntil: 'networkidle0' });
    await page.evaluate(() => document.querySelector('#startup-skip')?.click());
    await page.waitForFunction(() => !document.querySelector('#gate-guest-button').disabled);
    const intro = await page.$eval('.auth-gate-intro', element => ({ color: getComputedStyle(element).backgroundColor, overflow: document.documentElement.scrollWidth > innerWidth }));
    assert.notEqual(intro.color, 'rgba(0, 0, 0, 0)', 'login copy needs a readable backing');
    assert.equal(intro.overflow, false);
    await page.click('#gate-guest-button');
    await page.waitForFunction(() => !document.querySelector('#first-run').hidden);
    for (let step = 0; step < 8; step++) {
      await page.waitForFunction(step => document.querySelector('#first-run').dataset.step === String(step), {}, step);
      // Allow highlight scrolling/animations to settle before inspecting hit areas.
      await new Promise(resolve => setTimeout(resolve, 450));
      const boxes = await page.evaluate(() => {
        const card = document.querySelector('#first-run');
        const target = document.querySelector('.tour-target');
        const a = card.getBoundingClientRect(), b = target.getBoundingClientRect();
        return { overlap: a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top,
          inView: card.closest('.view')?.classList.contains('active'), overflow: document.documentElement.scrollWidth > innerWidth };
      });
      assert.equal(boxes.overlap, false, `${width}: step ${step + 1} guide must not cover its target`);
      assert.equal(boxes.inView, true);
      assert.equal(boxes.overflow, false);
      await page.click('#first-run-next');
    }
    await page.waitForFunction(() => document.querySelector('#first-run').hidden && document.querySelector('#view-start.active'));
    await page.type('#start-question', 'Hello');
    await page.click('#start-question-form button');
    await page.waitForFunction(() => document.querySelector('#view-ask.active'));
    assert.deepEqual(errors, []);
    console.log(`${width}: fresh login backing, eight unobscured tour steps, finish and submit: PASS`);
    await page.close();
  }
} finally { await browser.close(); }
