// Optional browser gate; install puppeteer-core and @sparticuz/chromium outside
// the repo and provide their entry-point URLs in the two MODULE variables.
import assert from "node:assert/strict";
const { default: puppeteer } = await import(process.env.PUPPETEER_MODULE || "puppeteer-core");
const { default: chromium } = await import(process.env.CHROMIUM_MODULE || "@sparticuz/chromium");
const origin = (process.env.CHAT_URL || "http://localhost:4173/").replace(/\/$/, "");

async function layout() {
const browser=await puppeteer.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:'shell'});
try{
const p=await browser.newPage(); const errors=[];p.on('pageerror',e=>errors.push(e.message));
for(const width of [390,768,1024,1366]){
 await p.setViewport({width,height:900});await p.goto(origin + "/presentation.html",{waitUntil:'networkidle0'});
 const layout=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,slides:document.querySelectorAll('.slide').length,images:[...document.images].filter(i=>!i.complete||!i.naturalWidth).length}));assert.equal(layout.overflow,false);assert.equal(layout.slides,7);
 await p.click('#present-next');await new Promise(r=>setTimeout(r,900));assert.match(await p.$eval('#present-progress',e=>e.textContent),/^02/);
 
 console.log('Presentation',width, 'no overflow + navigation PASS');
}
await p.setViewport({width:1024,height:768});
await p.evaluateOnNewDocument(()=>localStorage.setItem('vignan.firstRun.v3','done'));
await p.goto(origin + "/",{waitUntil:'networkidle0'});await p.evaluate(()=>document.querySelector('#startup-skip')?.click());await p.waitForFunction(()=>document.querySelector('.view.active')?.getBoundingClientRect().height || (!document.querySelector('#gate-guest-button').disabled && document.querySelector('#gate-guest-button').getBoundingClientRect().height));await p.evaluate(()=>{if(!document.querySelector('.view.active')?.getBoundingClientRect().height)document.querySelector('#gate-guest-button').click()});
await p.waitForFunction(()=>document.querySelector('#view-start.active') && !document.body.classList.contains('auth-locked'));
await new Promise(r=>setTimeout(r,600));
assert.ok(await p.$eval('#start-title', n => n.getBoundingClientRect().height > 0), 'Start heading must actually be visible');
assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth), false, 'Start horizontal overflow');
for(const view of ['studio','library','quiz','exam','flashcards','code','progress','friends','chat','play','settings','ask']){
 await p.evaluate(view=>document.querySelector(`.start-tools [data-view="${view}"]`).click(),view);
 assert.ok(await p.$eval(`#view-${view}`,e=>e.classList.contains('active')));
 // Return via the drawer's action, not a global setView test hook.
 await p.evaluate(()=>{document.querySelector('#home-logo').click();document.querySelector('[data-menu-view="start"]').click()});
}
console.log('Start navigation: all 12 destinations + return PASS');
await p.evaluate(()=>document.querySelector('.start-tools [data-view="settings"]').click());await new Promise(r=>setTimeout(r,500));
for(const width of [390,768,1024,1366]){
 await p.setViewport({width,height:900});await new Promise(r=>setTimeout(r,250));
 const result=await p.$$eval('.language-tile',nodes=>{const boxes=nodes.map(n=>n.getBoundingClientRect()).filter(r=>r.width);const rows=new Map();for(const b of boxes)rows.set(Math.round(b.top),(rows.get(Math.round(b.top))||0)+1);return {count:boxes.length,rows:[...rows.values()],width:document.documentElement.scrollWidth,viewport:innerWidth}});
 assert.equal(result.count,33);assert.ok(result.rows.every(n=>n===3),JSON.stringify(result));assert.ok(result.width<=result.viewport, 'overflow');console.log('Language grid',width,JSON.stringify(result.rows));
}
// Submit through the new Start form; no parallel chat engine.
await p.evaluate(()=>{document.querySelector('#home-logo').click();document.querySelector('[data-menu-view="start"]').click()});
await p.type('#start-question','Hello');await p.click('#start-question-form button');await p.waitForFunction(()=>document.querySelector('#view-ask.active'));await p.waitForFunction(()=>[...document.querySelectorAll('.message.user')].some(e=>e.textContent.includes('Hello')));
console.log('Start prompt → real Chat submission PASS');
assert.deepEqual(errors,[]);console.log('No browser page errors');
}finally{await browser.close()}

}

async function routing() {
const browser=await puppeteer.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:'shell'});
try {
const p=await browser.newPage();await p.setViewport({width:1024,height:768});
await p.evaluateOnNewDocument(()=>localStorage.setItem('vignan.firstRun.v3','done'));
let calls=0;
await p.setRequestInterception(true);
p.on('request', r=>{
 if(r.url().includes('/api/health'))r.respond({status:200,contentType:'application/json',body:JSON.stringify({ok:true,ai:true,aiProviders:['openrouter','bytez'],freeRouter:true,keyPool:{serverKeys:2},accounts:false})});
 else if(r.url().endsWith('/api/ai')){calls++;assert.ok(!r.postData().includes('sk-or-'));r.respond({status:200,contentType:'application/json',body:JSON.stringify({content:'Photosynthesis uses light to make food from carbon dioxide and water. [1]',model:'test-cloud'})});}
 else r.continue();
});
await p.goto(origin + "/",{waitUntil:'networkidle0'});await p.evaluate(()=>document.querySelector('#startup-skip')?.click());await p.waitForFunction(()=>document.querySelector('.view.active')?.getBoundingClientRect().height || (!document.querySelector('#gate-guest-button').disabled && document.querySelector('#gate-guest-button').getBoundingClientRect().height));await p.evaluate(()=>{if(!document.querySelector('.view.active')?.getBoundingClientRect().height)document.querySelector('#gate-guest-button').click()});await p.waitForFunction(()=>document.querySelector('#view-start.active') && !document.body.classList.contains('auth-locked'));
await new Promise(r=>setTimeout(r,1200));await p.type('#start-question','What is photosynthesis?');await p.click('#start-question-form button');
await p.waitForFunction(()=>[...document.querySelectorAll('.message.assistant')].some(n=>n.textContent.includes('Photosynthesis uses light to make food')),{timeout:10000});assert.ok(calls>0);console.log('Configured health → untouched defaults → same-origin /api/ai answer PASS (mocked provider)');
const access = async (action)=>p.evaluate(async action=>{const boot=new URL(document.querySelector('script[src*="js/boot.js"]').src);const db=await import('/js/db.js'+boot.search);const settings=await db.getSetting('settings');if(action==='local'){settings.routing.answer='webllm';settings.activeProvider='webllm';settings.freeRouterDismissed=true;await db.setSetting('settings',settings);}return settings;},action);
await access('local');await p.reload({waitUntil:'networkidle0'});await p.waitForFunction(()=>document.querySelector('#view-ask.active'));
await p.type('#ask-input','I am Nezaad');await p.keyboard.press('Enter');await p.waitForFunction(()=>!document.querySelector('#pro-overlay').hidden,{timeout:10000});await new Promise(r=>setTimeout(r,1100));await p.evaluate(()=>{if(!document.querySelector('#pro-overlay').hidden)document.querySelector('#pro-skip').click()});
await p.waitForFunction(()=>!document.body.classList.contains('pro-booting'));
let settings=await access('get');assert.equal(settings.routing.answer,'server');assert.equal(settings.proRoutingBefore.routing.answer,'webllm');
await new Promise(r=>setTimeout(r,700));await p.click('#home-logo');await p.click('#pro-menu-powerdown');await new Promise(r=>setTimeout(r,500));settings=await access('get');assert.equal(settings.routing.answer,'webllm');console.log('Local selection → Nezaad → hosted route → power-down restores local PASS');
}finally{await browser.close()}

}

await layout();
await routing();
