// Optional Chromium gate: guest-only local gameplay, real chess worker, no AI mock.
import assert from 'node:assert/strict';
const {default:puppeteer}=await import(process.env.PUPPETEER_MODULE||'puppeteer-core');
const {default:chromium}=await import(process.env.CHROMIUM_MODULE||'@sparticuz/chromium');
const browser=await puppeteer.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:'shell'});
try{
 const page=await browser.newPage();const errors=[];let gameRequests=0;
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/games/'))gameRequests++;});
 page.on('dialog',d=>d.accept());await page.setViewport({width:768,height:1024});
 await page.evaluateOnNewDocument(()=>localStorage.setItem('vignan.firstRun.v3','done'));
 await page.goto(process.env.CHAT_URL||'http://localhost:4173/',{waitUntil:'networkidle0'});await page.evaluate(()=>document.querySelector('#startup-skip')?.click());await page.waitForFunction(()=>!document.querySelector('#gate-guest-button').disabled);await page.click('#gate-guest-button');await page.waitForFunction(()=>!document.body.classList.contains('auth-locked'));
 await page.click('.start-tools [data-view="play"]');await page.waitForSelector('#solo-kind');
 const click=text=>page.evaluate(text=>[...document.querySelectorAll('#solo-play button')].find(n=>n.textContent===text)?.click(),text);
 await click('Start solo game');await page.waitForSelector('#solo-chess-board');assert.equal(await page.$$eval('#solo-chess-board button',n=>n.length),64);
 await page.click('[data-square="e2"]');assert.ok(await page.$$eval('.solo-square.legal',n=>n.length)>0);await page.click('[data-square="e4"]');
 await page.waitForFunction(()=>document.querySelector('#solo-chess-moves').textContent.includes(' · '),{timeout:15000});
 await click('Undo last turn');assert.equal(await page.$eval('#solo-chess-moves',n=>n.textContent),'Moves: None yet');
 await click('Suggest a legal move');await page.waitForFunction(()=>document.querySelector('#solo-chess-note').textContent.includes('Try '));
 for(const width of [390,768,1366]){await page.setViewport({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`chess overflow ${width}`);}
 await click('New solo game');await page.select('#solo-kind','quiz');await page.select('#solo-count','5');await page.select('#solo-daily','daily');await click('Start solo game');const dailyPrompt=await page.$eval('#solo-prompt',n=>n.textContent);
 for(let i=0;i<5;i++){await click('Skip — show answer');assert.match(await page.$eval('#solo-feedback',n=>n.textContent),/Answer:/);await click(i===4?'See my results':'Next round');}
 assert.match(await page.$eval('#solo-stage',n=>n.textContent),/Challenge complete · 0\/5/);
 await click('Practise my mistakes');assert.match(await page.$eval('#solo-stage',n=>n.textContent),/Mistake review/);await click('End solo session');await click('Start solo game');assert.equal(await page.$eval('#solo-prompt',n=>n.textContent),dailyPrompt,'daily settings recreate identical question');await click('End solo session');
 await page.select('#solo-kind','math');await click('Start solo game');
 for(let i=0;i<5;i++){const result=await page.$eval('#solo-prompt',n=>{const[a,op,b]=n.textContent.split(' ');return String(op==='+'?+a+ +b:op==='−'?+a- +b:op==='×'?+a* +b:+a/ +b);});await page.type('#solo-answer',result);await page.click('#solo-stage form button');assert.match(await page.$eval('#solo-feedback',n=>n.textContent),/^Correct/);await click(i===4?'See my results':'Next round');}
 assert.match(await page.$eval('#solo-stage',n=>n.textContent),/Challenge complete · 5\/5/);await click('Play another solo game');
 await page.select('#solo-kind','word');await click('Start solo game');
 const answer=await page.evaluate(async()=>{const boot=new URL(document.querySelector('script[src*="js/boot.js"]').src);const {SOLO_WORDS}=await import('/js/solo-games.js'+boot.search);return SOLO_WORDS.find(q=>q.prompt===document.querySelector('#solo-prompt').textContent).answer;});
 await click('Hint');await page.type('#solo-answer',answer.toUpperCase());await page.click('#solo-stage form button');assert.match(await page.$eval('#solo-feedback',n=>n.textContent),/Correct.*Hint used/);await click('End solo session');
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('vignan.solo.records.v1')));assert.ok(Object.values(saved).some(r=>r.best===5));assert.equal(gameRequests,0,'solo actions never call multiplayer games API');
 // Prove new workers and modules load from the real app cache, not just memory.
 await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller),{timeout:60000});await page.evaluate(()=>navigator.serviceWorker.ready);await page.setOfflineMode(true);await page.reload({waitUntil:'domcontentloaded'});await page.evaluate(()=>document.querySelector('#startup-skip')?.click());await page.waitForFunction(()=>!document.body.classList.contains('auth-locked'));
 await page.evaluate(()=>{document.querySelector('#home-logo').click();document.querySelector('[data-menu-view="play"]').click();});await page.waitForSelector('#solo-kind');await page.select('#solo-kind','chess');await page.select('#solo-color','b');await click('Start solo game');
 await page.waitForFunction(()=>Boolean(document.querySelector('#solo-chess-moves'))&&document.querySelector('#solo-chess-moves').textContent!=='Moves: None yet',{timeout:15000});
 assert.doesNotMatch(await page.$eval('#solo-status',n=>n.textContent),/could not load the worker/);
 assert.ok(await page.$eval('#solo-best',n=>n.textContent.includes('completed challenges')),'records survive offline reload');assert.deepEqual(errors,[]);
 console.log('Guest: four solo games, real legal chess worker/reply/undo/hint, daily repeatability, review, maths scoring, word hint, local bests, no game API, three widths and OFFLINE reload + computer opening: PASS');
}finally{await browser.close();}
