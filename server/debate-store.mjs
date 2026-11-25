import fs from 'node:fs/promises';
import path from 'node:path';

// Single-process local development store; writes and compare-and-swap serialize.
export function createLocalDebateStore(file) {
  let queue = Promise.resolve();
  const transaction = fn => { const task = queue.then(async()=>{ let rows=[]; try { rows=JSON.parse(await fs.readFile(file,'utf8')); } catch(e){ if(e.code!=='ENOENT')throw e; } const result=await fn(rows); if(result.write){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file+'.tmp',JSON.stringify(rows));await fs.rename(file+'.tmp',file);}return result.value; });queue=task.catch(()=>{});return task; };
  return {
    get: id=>transaction(rows=>({value:rows.find(r=>r.id===id)||null})),
    create: room=>transaction(rows=>{for(let i=rows.length-1;i>=0;i--)if(rows[i].expiresAt<Date.now())rows.splice(i,1);if(rows.length>=500)throw new Error('Room storage full');rows.push(room);return {write:true};}),
    cas: (id, revision, room)=>transaction(rows=>{const i=rows.findIndex(r=>r.id===id&&r.revision===revision);if(i<0)return {value:false};rows[i]=room;return {write:true,value:true};}),
  };
}

export function createSupabaseDebateStore({ url, serviceRoleKey, fetchImpl = fetch }) {
  async function rest(query, method='GET', body) {
    const response = await fetchImpl(`${url.replace(/\/$/,'')}/rest/v1/debate_rooms${query}`, { method, headers: { apikey:serviceRoleKey, Authorization:`Bearer ${serviceRoleKey}`, 'Content-Type':'application/json', Prefer:'return=representation' }, ...(body?{body:JSON.stringify(body)}:{}), signal:AbortSignal.timeout(10000) });
    if(!response.ok) throw new Error('Online debate storage unavailable. Apply the debate_rooms migration if this is a new deployment.');
    return response.status===204?[]:await response.json();
  }
  return {
    async get(id){ const rows=await rest(`?id=eq.${encodeURIComponent(id)}&select=payload`);return rows[0]?.payload||null; },
    async create(room){await rest(`?expires_at=lt.${encodeURIComponent(new Date().toISOString())}`,'DELETE');await rest('','POST',{id:room.id,revision:room.revision,payload:room,expires_at:new Date(room.expiresAt).toISOString()});},
    async cas(id,revision,room){const rows=await rest(`?id=eq.${encodeURIComponent(id)}&revision=eq.${revision}`,'PATCH',{revision:room.revision,payload:room});return rows.length===1;},
  };
}
