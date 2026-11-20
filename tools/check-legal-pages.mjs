// Optional rendered gate: install browser dependencies outside the repository.
const { default: puppeteer } = await import(process.env.PUPPETEER_MODULE || 'puppeteer-core');
const { default: chromium } = await import(process.env.CHROMIUM_MODULE || '@sparticuz/chromium');
import assert from 'node:assert/strict';
const origin = (process.env.CHAT_URL || 'http://localhost:4173').replace(/\/$/, '');
const browser=await puppeteer.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:'shell'});
try {
const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
for (const width of [390,768,1366]) {
await page.setViewport({width,height:900});
for (const file of ['legal','privacy','terms','security','copyright','acceptable-use','cookies','accessibility','subprocessors','disclaimer']) {
const response=await page.goto(`${origin}/${file}.html`,{waitUntil:'networkidle0'});
assert.equal(response.status(),200);
assert.ok(response.headers()['content-security-policy']);
const result=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,main:document.querySelector('main').getBoundingClientRect().width,headings:document.querySelectorAll('h1').length}));
assert.equal(result.overflow,false,`${file} at ${width}`);assert.ok(result.main>0);assert.equal(result.headings,1);
}
console.log(`All 10 legal pages: ${width}px, no overflow, readable main, headers PASS`);
}
assert.deepEqual(errors,[]);console.log('No browser page errors');
} finally {await browser.close();}
