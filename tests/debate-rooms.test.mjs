import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createDebateService } from '../server/debate-rooms.mjs';
import { createLocalDebateStore, createSupabaseDebateStore } from '../server/debate-store.mjs';
const A={id:'a',username:'Asha'},B={id:'b',username:'Bharat'},C={id:'c',username:'Charu'};
function harness(generateAI=async()=> 'A respectful AI rebuttal.') {
 const rows=new Map();let clock=1000000;
 const store={async create(r){rows.set(r.id,structuredClone(r));},async get(id){return structuredClone(rows.get(id)||null);},async cas(id,revision,r){if(rows.get(id)?.revision!==revision)return false;rows.set(id,structuredClone(r));return true;}};
 return {service:createDebateService({store,generateAI,now:()=>clock}),rows,store,tick:n=>clock+=n};
}
const action=(service,user,room,action,extra={})=>service.act(user,room.id,{revision:room.revision,action,...extra});
test('private rooms require membership and do not disclose the invitation to guests',async()=>{
 const {service:s}=harness();const a=await s.create(A,{topic:'Schools should reduce waste',ais:0});
 await assert.rejects(()=>s.get(B,a.id),e=>e.status===403);
 await assert.rejects(()=>s.join(B,a.id+'.'+'0'.repeat(32)),e=>e.status===403);
 const b=await s.join(B,a.invite);assert.equal(b.roster.length,2);assert.equal(b.invite,undefined);assert.equal(b.inviteSecret,undefined);assert.equal(b.me,'b');
 await assert.rejects(()=>action(s,B,b,'start'),e=>e.status===403);
 const rotated=await action(s,A,await s.get(A,a.id),'rotate');
 await assert.rejects(()=>s.join(C,a.invite),e=>e.status===403);assert.notEqual(rotated.invite,a.invite);
});
test('server assigns speaker identity, rejects forged turns and prevents duplicate submissions',async()=>{
 const {service:s}=harness();let room=await s.create(A,{topic:'Science needs evidence',ais:0,rounds:2});await s.join(B,room.invite);room=await s.get(A,room.id);room=await action(s,A,room,'start');
 await assert.rejects(()=>action(s,B,room,'speech',{text:'Out of turn',memberId:'a'}),e=>e.status===403);
 const outcomes=await Promise.allSettled([action(s,A,room,'speech',{text:'My real speech',name:'Fake AI',kind:'ai'}),action(s,A,room,'speech',{text:'Duplicate'})]);
 assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);
 let current=await s.get(B,room.id);assert.equal(current.transcript.length,1);assert.equal(current.transcript[0].name,'Asha');assert.equal(current.transcript[0].kind,'human');
 current=await action(s,B,current,'speech',{text:'B response'});current=await action(s,A,current,'speech',{text:'A closing'});current=await action(s,B,current,'speech',{text:'B closing'});assert.equal(current.status,'complete');
 await assert.rejects(()=>action(s,B,current,'speech',{text:'Extra'}),e=>e.status===409);
 current=await s.ai(A,current.id,current.revision,true);assert.match(current.coaching,/respectful/);assert.equal(current.transcript.length,4);
});
test('AI turn reservation prevents duplicate generation and ignores host-skipped late results',async()=>{
 let resolveAI,calls=0;const {service:s}=harness(()=>{calls++;return new Promise(resolve=>resolveAI=resolve);});
 let r=await s.create(A,{topic:'Practice with AI'});r=await action(s,A,r,'start');r=await action(s,A,r,'speech',{text:'Opening'});
 const task=s.ai(A,r.id,r.revision);await new Promise(resolve=>setImmediate(resolve));let pending=await s.get(A,r.id);assert.equal(pending.pending,true);
 await assert.rejects(()=>s.ai(A,r.id,pending.revision),e=>e.status===409);assert.equal(calls,1);
 const skipped=await action(s,A,pending,'skip');resolveAI('Late AI speech');await assert.rejects(()=>task,e=>e.status===409);
 const after=await s.get(A,r.id);assert.equal(after.turn,skipped.turn);assert.equal(after.transcript.length,2);assert.equal(after.transcript[1].skipped,true);
});
test('AI failure clears reservation without advancing; nonhost cannot generate',async()=>{
 const {service:s}=harness(async()=>{throw new Error('secret upstream details');});let r=await s.create(A,{topic:'A useful school motion'});await s.join(B,r.invite);r=await s.get(A,r.id);r=await action(s,A,r,'start');r=await action(s,A,r,'speech',{text:'Opening'});
 await assert.rejects(()=>s.ai(B,r.id,r.revision),e=>e.status===403);
 await assert.rejects(()=>s.ai(A,r.id,r.revision),e=>e.status===503&&!e.message.includes('secret'));
 const next=await s.get(A,r.id);assert.equal(next.turn,1);assert.equal(next.pending,false);assert.equal(next.transcript.length,1);
});
test('room deadlines, expiry, locked lobby and closed state are enforced',async()=>{
 const {service:s,tick}=harness();let r=await s.create(A,{topic:'A useful motion',seconds:30});const invite=r.invite;r=await action(s,A,r,'start');
 await assert.rejects(()=>s.join(B,invite),e=>e.status===409);
 await assert.rejects(()=>action(s,A,r,'team',{memberId:'a',team:'against'}),e=>e.status===409);
 tick(31000);await assert.rejects(()=>action(s,A,r,'speech',{text:'Too late'}),e=>e.status===409);
 r=await action(s,A,r,'close');await assert.rejects(()=>action(s,A,r,'speech',{text:'Closed'}),e=>e.status===409);
 tick(86400000);await assert.rejects(()=>s.get(A,r.id),e=>e.status===404);
});
test('concurrent joins preserve both members and lobby capacity is bounded',async()=>{
 const {service:s}=harness();const r=await s.create(A,{topic:'Concurrent room join',ais:4});await Promise.all([s.join(B,r.invite),s.join(C,r.invite)]);assert.equal((await s.get(A,r.id)).roster.length,7);
 for(let i=0;i<3;i++)await s.join({id:`u${i}`,username:`User${i}`},r.invite);
 await assert.rejects(()=>s.join({id:'overflow',username:'Extra'},r.invite),e=>e.status===409);
});
test('local store persists rooms and compare-and-swap survives recreation',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'debate-'));
 try{const file=path.join(dir,'rooms.json'),store=createLocalDebateStore(file);const r={id:'room',revision:0,expiresAt:Date.now()+10000};await store.create(r);const outcomes=await Promise.all([store.cas('room',0,{...r,revision:1}),store.cas('room',0,{...r,revision:1})]);assert.deepEqual(outcomes,[true,false]);assert.equal((await createLocalDebateStore(file).get('room')).revision,1);}finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('Supabase updates use an atomic revision condition, not last-write-wins',async()=>{
 const calls=[];const store=createSupabaseDebateStore({url:'https://project.example',serviceRoleKey:'test-server-only',fetchImpl:async(url,options)=>{calls.push({url,options});return new Response('[]',{status:200});}});
 assert.equal(await store.cas('room-id',7,{id:'room-id',revision:8}),false);assert.match(calls[0].url,/revision=eq.7/);assert.equal(calls[0].options.method,'PATCH');assert.equal(JSON.parse(calls[0].options.body).revision,8);
});
