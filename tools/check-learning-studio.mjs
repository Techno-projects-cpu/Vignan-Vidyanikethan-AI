// Optional Chromium gate: uses a mocked same-origin AI, never live API keys.
import assert from 'node:assert/strict';
const { default: puppeteer } = await import(process.env.PUPPETEER_MODULE || 'puppeteer-core');
const { default: chromium } = await import(process.env.CHROMIUM_MODULE || '@sparticuz/chromium');
const browser = await puppeteer.launch({ executablePath: await chromium.executablePath(), args: chromium.args, headless: 'shell' });
try {
 const page = await browser.newPage(); const errors=[]; let calls=0, fail=false;
 page.on('pageerror',e=>errors.push(e.message));
 await page.setRequestInterception(true);
 page.on('request',r=>{
  if(r.url().includes('/api/health')) return r.respond({status:200,contentType:'application/json',body:JSON.stringify({ok:true,ai:true,aiProviders:['openrouter'],freeRouter:true,accounts:true,keyPool:{serverKeys:1}})});
  if(new URL(r.url()).pathname==='/api/ai'){calls++;return r.respond({status:fail?503:200,contentType:'application/json',body:JSON.stringify(fail?{error:'Test outage'}:{content:'Mock practice: consider the evidence and address the opposing argument. <img src=x onerror=alert(1)>',model:'mock'})});}
  r.continue();
 });
 await page.evaluateOnNewDocument(()=>localStorage.setItem('vignan.firstRun.v3','done'));
 await page.setViewport({width:768,height:1024});
 await page.goto(process.env.CHAT_URL || 'http://localhost:4173/',{waitUntil:'networkidle0'});
 await page.evaluate(()=>document.querySelector('#startup-skip')?.click());
 await page.waitForFunction(()=>!document.querySelector('#gate-guest-button').disabled);
 await page.click('#gate-guest-button');
 await page.waitForFunction(()=>!document.body.classList.contains('auth-locked'));
 await page.click('.start-tools [data-view="studio"]');
 await page.type('#essay-topic','Should schools reduce plastic?');
 await page.evaluate(()=>[...document.querySelectorAll('#studio-essay button')].find(b=>b.textContent==='Offline outline').click());
 assert.match(await page.$eval('#essay-output',n=>n.textContent),/Offline writing scaffold/);
 await page.select('#essay-kind','feedback');
 await page.evaluate(()=>[...document.querySelectorAll('#studio-essay button')].find(b=>b.textContent==='Generate with AI').click());
 assert.match(await page.$eval('#studio-status',n=>n.textContent),/Add your writing/);assert.equal(calls,0);
 await page.type('#essay-draft','Plastic waste is a serious concern. We should compare alternatives.');
 await page.evaluate(()=>[...document.querySelectorAll('#studio-essay button')].find(b=>b.textContent==='Generate with AI').click());
 await page.waitForFunction(()=>document.querySelector('#essay-output').textContent.includes('Mock practice'));
 assert.equal(await page.$('#essay-output img'),null,'AI text is never parsed as HTML');
 await page.click('[data-studio-tab="debate"]');
 await page.type('#debate-topic','Schools should reduce plastic');
 await page.select('#debate-humans','2');await page.select('#debate-ais','2');await page.select('#debate-rounds','2');
 await page.select('#debate-side-1','against');await page.select('#debate-side-2','for');
 await page.evaluate(()=>[...document.querySelectorAll('#studio-debate button')].find(b=>b.textContent==='Start debate').click());
 for(let turn=0;turn<8;turn++){
  if(turn%4<2){await page.type('#debate-speech',`Human argument ${turn}`);await page.evaluate(()=>[...document.querySelectorAll('#studio-debate button')].find(b=>b.textContent==='Save human speech').click());}
  else {if(turn===2){fail=true;await page.evaluate(()=>[...document.querySelectorAll('#studio-debate button')].find(b=>b.textContent==='Generate this AI speaker’s turn').click());await page.waitForFunction(()=>document.querySelector('#learning-studio').dataset.busy!=='1');assert.equal(await page.$$eval('#debate-transcript article',n=>n.length),2,'failed AI must not advance or erase human turns');fail=false;}await page.evaluate(()=>[...document.querySelectorAll('#studio-debate button')].find(b=>b.textContent==='Generate this AI speaker’s turn').click());}
  await page.waitForFunction(n=>document.querySelectorAll('#debate-transcript article').length===n,{},turn+1);
 }
 assert.match(await page.$eval('#debate-turn',n=>n.textContent),/complete/);
 await page.evaluate(()=>[...document.querySelectorAll('#studio-debate button')].find(b=>b.textContent==='Get AI coaching on this debate').click());
 await page.waitForFunction(()=>document.querySelector('#debate-feedback').textContent.includes('Mock practice'));
 assert.equal(await page.$('#debate-transcript img'),null);
 await page.click('[data-studio-tab="events"]');
 assert.equal(await page.$$eval('#studio-events fieldset',n=>n.length),4);
 await page.click('#studio-events fieldset button');
 assert.match(await page.$eval('#studio-events fieldset [role="status"]',n=>n.textContent),/Correct/);
 for(const width of [390,768,1024,1366]){
  await page.setViewport({width,height:900});
  for(const tab of ['essay','debate','events']){await page.click(`[data-studio-tab="${tab}"]`);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${width} ${tab} overflow`);}
 }
 // Exercise the actual offline quiz screen, not just the pure writer.
 const open = async view => { await page.evaluate(view=>{document.querySelector('#home-logo').click();document.querySelector(`[data-menu-view="${view}"]`).click();},view); await page.waitForFunction(view=>document.querySelector(`#view-${view}`).classList.contains('active'),{},view); };
 await open('library');
 if(await page.$eval('#starter-add',n=>!n.hidden)) await page.click('#starter-add');
 await page.waitForFunction(()=>!document.querySelector('#starter-remove').hidden);
 await open('quiz');
 assert.equal(await page.$eval('#quiz-type',n=>n.value),'mix');
 await page.select('#quiz-type','mix');
 await page.$eval('#quiz-use-model',n=>{n.checked=false;});
 await page.$eval('#quiz-count',n=>{n.value='4';});
 await page.click('#quiz-generate');
 await page.waitForFunction(()=>!document.querySelector('#quiz-runner').classList.contains('hidden'));
 const types=[];
 for(let i=0;i<4;i++){
  const question=await page.$eval('#quiz-question',n=>({type:n.querySelector('.question-type').textContent,prompt:n.querySelector('.question-prompt').textContent,choices:n.querySelectorAll('.option').length}));
  types.push(question.type.split(' · ')[0]);
  if(question.choices){assert.equal(question.choices,4);assert.doesNotMatch(question.prompt,/____|complete the sentence/i);}
  if(i<3)await page.click('#quiz-next');
 }
 assert.ok(types.includes('Multiple choice') && types.includes('Fill in the blank') && types.includes('Short answer'),JSON.stringify(types));
 console.log('Actual offline Mixed quiz from installed starter pages: MCQ + fill + explanation, four statement choices: PASS');
 assert.deepEqual(errors,[]);
 console.log('Essay validation, offline scaffold, mocked AI feedback, two humans/two AI teams across eight turns, literal output safety, science quiz, four-width layout: PASS');
 console.log('AI responses mocked; no live inference or remote multiplayer claimed.');
} finally { await browser.close(); }
