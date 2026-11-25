import { debateApi } from './social.js?v=92';
import { transcriptText } from './studio-core.js?v=92';

const node = (tag, text = '') => { const n = document.createElement(tag); n.textContent = text; return n; };
const button = (text, handler) => { const n = node('button', text); n.type = 'button'; n.className = 'button ghost'; n.addEventListener('click', handler); return n; };
const field = (root, label, control) => { const n=node('label');n.className='studio-field';n.append(node('span',label),control);root.append(n);return control; };
const select = (id, values) => {const n=node('select');n.id=id;for(const [v,t] of values){const o=node('option',t);o.value=v;n.append(o);}return n;};
export function initOnlineDebate(root, { getUser, getSettings }) {
  let room = null, busy = false, reading = false, lastUser = '', generation = 0, lastRead = 0;
  root.append(node('h3','Online debate — private text rooms'),node('p','Sign in to create or join. Share the invitation privately; anyone with it and an account can join the lobby. Up to six humans and four AI roles. One hosted AI plays all AI speakers. No voice/video or public room listing. Rooms expire after 24 hours; export before then.'));
  const setup=node('div');root.append(setup);
  const topic=field(setup,'Debate motion',node('input'));topic.id='online-motion';topic.maxLength=240;topic.placeholder='Schools should reduce single-use plastic';
  const rounds=field(setup,'Rounds per speaker',select('online-rounds',[[2,'2 rounds'],[3,'3 rounds'],[4,'4 rounds'],[5,'5 rounds']]));rounds.value='3';
  const seconds=field(setup,'Seconds per human turn',select('online-seconds',[[60,'60 seconds'],[120,'120 seconds'],[180,'180 seconds'],[300,'300 seconds']]));seconds.value='120';
  const ais=field(setup,'AI speakers (hosted server AI required)',select('online-ais',[[0,'No AI — humans only'],[1,'1 AI role'],[2,'2 AI roles'],[3,'3 AI roles'],[4,'4 AI roles']]));ais.value='1';
  setup.append(button('Create online room',()=>request('create',{topic:topic.value,rounds:Number(rounds.value),seconds:Number(seconds.value),ais:Number(ais.value),language:getSettings().language})));
  const invite=field(setup,'Invitation code from the host',node('input'));invite.id='online-invite';invite.maxLength=100;invite.autocomplete='off';
  setup.append(button('Join private room',()=>request('join',{invite:invite.value})));
  const status=node('p');status.id='online-status';status.setAttribute('role','status');root.append(status);
  const details=node('div');details.id='online-room';root.append(details);
  const compose=node('div');compose.hidden=true;
  const speech=field(compose,'Your speech — sent to everyone in this room',node('textarea'));speech.id='online-speech';speech.rows=6;speech.maxLength=2500;
  const count=node('p','0 / 2500 characters');speech.addEventListener('input',()=>count.textContent=`${speech.value.length} / 2500 characters`);compose.append(count,button('Send my debate speech',()=>{if(speech.value.trim())request('act',{action:'speech',text:speech.value});else status.textContent='Write a speech first.';}));root.append(compose);
  const controls=node('div');controls.className='studio-actions';root.append(controls);
  const clock=node('p');clock.id='online-clock';clock.setAttribute('aria-live','off');root.append(clock);
  const signedIn=()=>Boolean(getUser()?.id);
  const storageKey=()=>`vignan.debate.room.${getUser()?.id || 'guest'}`;
  function remember(id){try{if(id)sessionStorage.setItem(storageKey(),id);else sessionStorage.removeItem(storageKey());}catch{/* optional */}}
  function accept(next){if(room&&next.id===room.id&&next.revision<room.revision)return;room=next;lastRead=Date.now();remember(room.id);render();}
  async function request(action,data){
    if(busy)return;
    if(!signedIn()){status.textContent='Log in with a student account first. Guest mode cannot join private rooms.';return;}
    busy=true;root.dataset.busy='1';const epoch=generation;
    status.textContent=action==='ai'||action==='coach'?'The server AI is writing. The turn stays reserved until it finishes or fails…':'Saving room…';
    try{const result=await debateApi.post(action,{...data,...(room&& !['create','join'].includes(action)?{id:room.id,revision:room.revision}:{})});if(epoch!==generation)return;accept(result.room);if(action==='act'&&data.action==='speech'){speech.value='';count.textContent='0 / 2500 characters';}status.textContent='Room synchronised.';}
    catch(error){if(epoch!==generation)return;status.textContent=error.message;if(room)await refresh(false);}
    finally{if(epoch===generation){busy=false;delete root.dataset.busy;}}
  }
  async function refresh(report=true){
    if(reading||!room||!signedIn())return;reading=true;const epoch=generation,id=room.id;
    try{const result=await debateApi.get(id);if(epoch!==generation||room?.id!==id)return;accept(result.room);if(report)status.textContent='Connected — room synchronised.';}
    catch(error){if(epoch!==generation)return;if(error.status===401||error.status===403||error.status===404){room=null;remember(null);render();}status.textContent=`${error.message} Your unsent speech has not been sent or erased.`;}
    finally{reading=false;}
  }
  function render(){
    details.replaceChildren();controls.replaceChildren();compose.hidden=true;setup.hidden=Boolean(room);
    if(!room){clock.textContent='';return;}
    const host=room.hostId===room.me;
    details.append(node('h4',room.topic),node('p',`Room ${room.status} · revision ${room.revision} · expires ${new Date(room.expiresAt).toLocaleString()}`));
    if(room.invite){const code=field(details,'Private invitation — copy and share with classmates',node('input'));code.id='online-room-code';code.value=room.invite;code.readOnly=true;code.addEventListener('focus',()=>code.select());controls.append(button('Replace invitation code',()=>request('act',{action:'rotate'})));}
    const list=node('ul');
    for(const p of room.roster){const row=node('li',`${p.name} · ${p.kind==='ai'?'AI role-play':'human'} · ${p.team}`);
      if(host&&room.status==='lobby'){const side=select(`online-side-${p.id}`,[['for','For'],['against','Against']]);side.value=p.team;side.setAttribute('aria-label',`${p.name} team`);side.addEventListener('change',()=>request('act',{action:'team',memberId:p.id,team:side.value}));row.append(side);if(p.id!==room.hostId)row.append(button(`Remove ${p.name}`,()=>request('act',{action:'remove',memberId:p.id})));}list.append(row);}
    details.append(list);
    if(room.status==='active'){const p=room.roster[room.turn%room.roster.length];details.append(node('h4',`Round ${Math.floor(room.turn/room.roster.length)+1}/${room.rounds} · ${p.name} (${p.team}) to speak`));compose.hidden=!(p.kind==='human'&&p.id===room.me);if(host){if(p.kind==='ai')controls.append(button(room.pending?'AI speech pending — refresh':'Generate AI turn',()=>request('ai',{})));controls.append(button('Skip current speaker',()=>{if(confirm('Skip this speaker? This is recorded in the transcript.'))request('act',{action:'skip'});}));}}
    if(host&&room.status==='lobby')controls.append(button('Start online debate',()=>request('act',{action:'start'})));
    if(host&&room.status==='complete')controls.append(button('Generate shared AI coaching',()=>request('coach',{})));
    if(host&&!['closed'].includes(room.status))controls.append(button('Close room',()=>{if(confirm('Close this room for everyone?'))request('act',{action:'close'});}));
    controls.append(button('Refresh room',()=>refresh()),button('Export transcript',()=>{
      const url=URL.createObjectURL(new Blob([`${transcriptText(room)}\n\nAI coaching\n${room.coaching||''}`],{type:'text/plain;charset=utf-8'}));const a=node('a');a.href=url;a.download='online-debate.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }),button('Leave room on this device',()=>{if(busy)return;generation++;room=null;render();status.textContent='Disconnected on this device. Membership remains. Reload to reconnect to the saved room.';}));
    const transcript=node('div');transcript.id='online-transcript';
    for(const entry of room.transcript){const article=node('article');article.className='card';article.append(node('h4',`${entry.name} · ${entry.kind==='ai'?'AI role-play':'human'} · ${entry.team} · ${entry.phase}`),node('p',entry.text));transcript.append(article);}details.append(transcript);
    if(room.coaching){const pre=node('pre',room.coaching);pre.className='studio-output';details.append(node('h4','AI coaching — verify factual claims'),pre);}
  }
  function reset(){generation++;room=null;busy=false;reading=false;delete root.dataset.busy;speech.value='';invite.value='';topic.value='';count.textContent='0 / 2500 characters';render();}
  function syncAccount(){const id=getUser()?.id||'';if(id===lastUser)return;lastUser=id;reset();if(id){try{const saved=sessionStorage.getItem(storageKey());if(saved){room={id:saved,revision:-1};refresh();}}catch{/* optional */}}}
  document.addEventListener('vignan:account-changed',syncAccount);
  // One timer, no overlapping reads, no polling while hidden/offline/outside tab.
  setInterval(()=>{syncAccount();if(document.hidden||navigator.onLine===false||root.getBoundingClientRect().height===0)return;if(room&&!busy)refresh();if(room?.status==='active'){const left=Math.max(0,Math.ceil((room.deadline-Date.now())/1000));clock.textContent=`Human speaking time remaining: ${left}s${left===0?' — host can skip the turn.':''}${Date.now()-lastRead>15000?' · Connection may be stale':''}`;}else clock.textContent='';},4000);
  syncAccount();
}
