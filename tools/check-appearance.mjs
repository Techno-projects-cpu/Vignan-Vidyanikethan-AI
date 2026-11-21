// Optional rendered gate: external Puppeteer/Chromium modules, as in check-study-start.
import assert from 'node:assert/strict';
const { default: puppeteer } = await import(process.env.PUPPETEER_MODULE || 'puppeteer-core');
const { default: chromium } = await import(process.env.CHROMIUM_MODULE || '@sparticuz/chromium');
const browser = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: chromium.args, headless: 'shell' });
try {
  const page = await browser.newPage();
  const errors = [], missing = [];
  page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
  page.on('response', response => { if (response.status() >= 400 && /assets\/(paint|walls)\//.test(response.url())) missing.push(response.url()); });
  await page.evaluateOnNewDocument(() => localStorage.setItem('vignan.firstRun.v3', 'done'));
  await page.setViewport({ width: 1024, height: 768 });
  await page.goto(process.env.CHAT_URL || 'http://localhost:4173/', { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.querySelector('#startup-skip')?.click());
  await page.waitForFunction(() => !document.querySelector('#gate-guest-button').disabled);
  await page.click('#gate-guest-button');
  await page.waitForFunction(() => document.querySelector('#view-start.active'));
  await new Promise(resolve => setTimeout(resolve, 700));
  await page.evaluate(() => document.querySelector('.start-tools [data-view="settings"]').click());
  await page.waitForFunction(() => document.querySelector('#view-settings.active'));
  const themes = await page.$$eval('#style-grid [data-style]', nodes => nodes.map(node => node.dataset.style));
  assert.equal(themes.length, 17);
  // Decode the exact preview files requested by CSS, not just the asset registry.
  const previews = await page.$$eval('.style-preview', async nodes => Promise.all(nodes.map(async node => {
    const url = getComputedStyle(node).backgroundImage.match(/url\("?([^"\)]+)/)?.[1];
    if (!url) return true;
    const image = new Image(); image.src = url;
    try { await image.decode(); return image.naturalWidth > 0; } catch { return false; }
  })));
  assert.ok(previews.every(Boolean), 'all actual artwork thumbnails decode');
  const painted = [];
  for (const id of themes) {
    await page.evaluate(id => document.querySelector(`#style-grid [data-style="${id}"]`).click(), id);
    const appearance = await page.evaluate(() => ({
      style: document.documentElement.dataset.style || 'minimal',
      painted: document.documentElement.dataset.paint === '1',
      background: getComputedStyle(document.body).backgroundImage,
      wall: getComputedStyle(document.querySelector('.wall-art')).display,
      ink: getComputedStyle(document.body).color,
    }));
    assert.equal(appearance.style, id);
    if (appearance.painted) {
      assert.match(appearance.background, /assets\/paint\//, `${id}: actual computed artwork must survive CSS`);
      painted.push(appearance.background);
      assert.equal(appearance.wall, 'none', 'classroom cannot cover painted themes');
    } else if (id === 'glass') assert.equal(appearance.wall, 'block');
    else assert.equal(appearance.background, 'none');
  }
  assert.equal(new Set(painted).size, 10, 'all ten painted looks have distinct visible backgrounds');
  for (const width of [390, 768, 1366]) {
    await page.setViewport({ width, height: 900 });
    await page.select('#settings-artwork', 'glass');
    const wall = await page.$eval('.wall-art img', async image => { await image.decode(); return { width: image.naturalWidth, src: image.currentSrc }; });
    assert.ok(wall.width > 0); assert.match(wall.src, /study-afternoon/);
    await page.select('#settings-artwork', 'rain');
    assert.match(await page.evaluate(() => getComputedStyle(document.body).backgroundImage), /rain-window/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  }
  // Deliberate Minimal must survive both early paint and async settings restoration.
  await page.select('#settings-artwork', 'minimal');
  await page.evaluate(() => document.querySelector('#theme-toggle').click());
  const mode = await page.evaluate(() => document.documentElement.dataset.theme);
  await new Promise(resolve => setTimeout(resolve, 400));
  await page.reload({ waitUntil: 'networkidle0' });
  await page.evaluate(() => document.querySelector('#startup-skip')?.click());
  await page.waitForFunction(() => document.querySelector('.view.active') || (!document.querySelector('#gate-guest-button').disabled && document.querySelector('#gate-guest-button').getBoundingClientRect().height));
  await page.evaluate(() => { if (!document.querySelector('.view.active')) document.querySelector('#gate-guest-button').click(); });
  await page.waitForFunction(() => document.querySelector('.view.active'));
  await new Promise(resolve => setTimeout(resolve, 700));
  assert.equal(await page.evaluate(() => document.documentElement.dataset.style || 'minimal'), 'minimal');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), mode);
  assert.deepEqual(errors, []); assert.deepEqual(missing, []);
  console.log('17 theme switches; ten distinct computed paintings; all thumbnails decode; anime/painting selector at three widths; Minimal/mode reload persistence: PASS');
} finally { await browser.close(); }
