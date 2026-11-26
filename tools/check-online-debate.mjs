// Optional REAL local-server, two-isolated-session multiplayer gate.
// Creates throwaway accounts on the chosen server. Do not point at production.
import assert from 'node:assert/strict';
const {default:puppeteer}=await import(process.env.PUPPETEER_MODULE||'puppeteer-core');
const {default:chromium}=await import(process.env.CHROMIUM_MODULE||'@sparticuz/chromium');
const origin=process.env.CHAT_URL||'http://localhost:4173/';
if(!['localhost','127.0.0.1'].includes(new URL(origin).hostname))throw new Error('Use a local throwaway-account server, not production.');
const browser=await puppeteer.launch({executablePath:await chromium.executablePath(),args:chromium.args.filter(a=>a!=='--single-process'),headless:'shell'});
try{
 const errors=[];
 async function student(suffix){
  const context=await browser.createBrowserContext();const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.setViewport({width:768,height:1024});
  await page.goto(new URL('/api/auth/me',origin).href,{waitUntil:'domcontentloaded'});
  const registered=await page.evaluate(async username=>{
   const session=await(await fetch('/api/auth/me')).json();const r=await fetch('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrfToken},body:JSON.stringify({username,password:'throwaway debate test passphrase',age:14})});return {status:r.status,body:await r.json()};
  },`db-${Date.now().toString(36)}-${suffix}`);assert.equal(registered.status,201,JSON.stringify(registered.body));
  await page.evaluate(()=>localStorage.setItem('vignan.firstRun.v3','done'));
  await page.goto(origin,{waitUntil:'networkidle0'});await page.evaluate(()=>document.querySelector('#startup-skip')?.click());
  await page.waitForFunction(()=>!document.body.classList.contains('auth-locked'));
  await page.click('.start-tools [data-view="studio"]');await page.click('[data-studio-tab="online"]');return page;
 }
 const a=await student('a'), b=await student('b');
 const click=async(page,text)=>page.evaluate(text=>[...document.querySelectorAll('#studio-online button')].find(n=>n.textContent===text)?.click(),text);
 await a.type('#online-motion','Schools should use less plastic');await a.select('#online-ais','0');await a.select('#online-rounds','2');await click(a,'Create online room');
 await a.waitForSelector('#online-room-code');const invite=await a.$eval('#online-room-code',n=>n.value);
 await a.evaluate(()=>{window.__codeNode=document.querySelector('#online-room-code');window.__codeNode.focus();window.__codeNode.select();});
 await new Promise(r=>setTimeout(r,4500));
 assert.equal(await a.evaluate(()=>window.__codeNode===document.querySelector('#online-room-code')&&document.activeElement===window.__codeNode),true,'unchanged polls preserve invitation selection/focus');
 let reads=0;a.on('request',r=>{if(r.url().includes('/api/social/debates/room?'))reads++;});
 await a.click('[data-studio-tab="essay"]');await new Promise(r=>setTimeout(r,500));const before=reads;
 await new Promise(r=>setTimeout(r,4500));assert.equal(reads,before,'no room reads while another studio tab is open');
 await a.click('[data-studio-tab="online"]');

 await b.type('#online-invite',invite);await click(b,'Join private room');
 await b.waitForFunction(()=>document.querySelector('#online-room').textContent.includes('revision 1'));
 await click(a,'Refresh room');await a.waitForFunction(()=>document.querySelector('#online-room').textContent.includes('revision 1'));
 await click(a,'Start online debate');await a.waitForFunction(()=>!document.querySelector('#online-speech').parentElement.parentElement.hidden);
 await a.type('#online-speech','Evidence and practical examples support my opening.');await click(a,'Send my debate speech');
 await b.waitForFunction(()=>document.querySelectorAll('#online-transcript article').length===1,{timeout:20000});
 assert.equal(await b.$('#online-room-code'),null,'nonhost never receives invitation display');
 await b.evaluate(()=>{window.__article=document.querySelector('#online-transcript article');});
 await b.type('#online-speech','My reply considers cost and the strongest counterargument.');
 // Poll while typing: a reconnect must not replace the composition textarea.
 await new Promise(r=>setTimeout(r,4500));assert.equal(await b.evaluate(()=>window.__article===document.querySelector('#online-transcript article')),true,'unchanged transcript is not rebuilt');assert.match(await b.$eval('#online-speech',n=>n.value),/My reply/);
 await click(b,'Send my debate speech');await a.waitForFunction(()=>document.querySelectorAll('#online-transcript article').length===2,{timeout:20000});
 await a.reload({waitUntil:'domcontentloaded'});await a.evaluate(()=>document.querySelector('#startup-skip')?.click());await a.waitForFunction(()=>!document.body.classList.contains('auth-locked'));
 // Return through the actual navigation after a fresh account-session restore.
 await a.evaluate(()=>{document.querySelector('#home-logo').click();document.querySelector('[data-menu-view="studio"]').click();});await a.click('[data-studio-tab="online"]');
 await a.waitForFunction(()=>document.querySelectorAll('#online-transcript article').length===2,{timeout:20000});
 await a.type('#online-speech','Closing argument from the host.');await click(a,'Send my debate speech');
 await b.waitForFunction(()=>document.querySelectorAll('#online-transcript article').length===3,{timeout:20000});await b.type('#online-speech','Closing argument <img src=x onerror=alert(1)> from the guest.');await click(b,'Send my debate speech');
 await a.waitForFunction(()=>document.querySelector('#online-room').textContent.includes('Room complete'),{timeout:20000});
 assert.equal(await a.$('#online-transcript img'),null,'room speeches are plain text, never HTML');
 for(const width of [390,768,1366]){await a.setViewport({width,height:900});assert.equal(await a.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${width} overflow`);}
 assert.deepEqual(errors,[]);
 console.log('REAL two-account room: invite/join, server turn order, cross-session polling, typed draft preserved, host reload/rejoin, four speeches to completion, 3 widths: PASS');
 console.log('AI generation tested separately with controlled domain tests; live providers and production Supabase not exercised.');
}finally{await browser.close();}
