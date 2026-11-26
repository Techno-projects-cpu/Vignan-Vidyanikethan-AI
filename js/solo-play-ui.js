import { makeSoloQuestions, soloSeed, localDateKey, checkSoloAnswer, recordSoloResult } from './solo-games.js?v=94';
import { initialPosition, legalMoves, playMove, gameStatus, squareName, toFen } from './chess.js?v=94';
import { chooseComputerMove } from './solo-chess.js?v=94';
const el=(tag,text='')=>{const n=document.createElement(tag);n.textContent=text;return n;};
const button=(text,fn)=>{const n=el('button',text);n.type='button';n.className='button ghost';n.addEventListener('click',fn);return n;};
function select(id,values){const n=el('select');n.id=id;for(const [value,text]of values){const o=el('option',text);o.value=value;n.append(o);}return n;}
function field(root,text,input){const n=el('label');n.className='studio-field';n.append(el('span',text),input);root.append(n);return input;}
const KEY='vignan.solo.records.v1';
export function initSoloPlay(){
 const root=document.querySelector('#solo-play');if(!root||root.dataset.ready)return;root.dataset.ready='1';root.className='card solo-play';
 let session=null,worker=null,job=0,records={};
 try{const value=JSON.parse(localStorage.getItem(KEY)||'{}');if(value&&typeof value==='object'&&!Array.isArray(value))records=value;}catch{/* storage may be blocked */}
 root.append(el('h3','Play solo — no waiting for opponents'),el('p','Free local games for guests, even offline after the app is cached. The chess computer is a small rules-based opponent, not a person or a cloud AI. Sessions stay in this tab; export your answer review before reloading. Best scores stay in this browser and do not award multiplayer XP. Includes 24 original quiz questions and 16 word clues; filtered subjects can produce shorter sets.'));
 const setup=el('div');root.append(setup);
 const kind=field(setup,'Solo game',select('solo-kind',[['chess','Chess vs computer'],['quiz','Quiz explorer'],['math','Maths challenge'],['word','Word scramble']]));
 const difficulty=field(setup,'Difficulty',select('solo-difficulty',[['easy','Casual / addition & subtraction'],['hard','Stronger chess / all four arithmetic operations']]));
 const subject=field(setup,'Quiz subject',select('solo-subject',[['all','Mixed subjects'],['science','Science'],['maths','Maths'],['english','English'],['logic','Logic & reasoning']]));
 const count=field(setup,'Challenge length',select('solo-count',[[5,'5 rounds'],[10,'10 rounds'],[15,'15 rounds']]));count.value='10';
 const daily=field(setup,'Question selection',select('solo-daily',[['practice','New practice set'],['daily','Daily set — same settings, same local day']]));
 const color=field(setup,'Your chess side',select('solo-color',[['w','White — move first'],['b','Black — computer moves first']]));
 const opponent=field(setup,'Chess opponent',select('solo-opponent',[['computer','Local computer'],['human','Two people sharing this device']]));
 function settings(){const chess=kind.value==='chess';color.parentElement.hidden=!chess||opponent.value==='human';opponent.parentElement.hidden=!chess;difficulty.parentElement.hidden=!chess&&kind.value!=='math';subject.parentElement.hidden=kind.value!=='quiz';count.parentElement.hidden=chess;daily.parentElement.hidden=chess;}
 kind.addEventListener('change',settings);opponent.addEventListener('change',settings);settings();
 const best=el('p');best.id='solo-best';setup.append(best);const bestText=()=>{const entries=Object.values(records).filter(r=>Number.isFinite(r.best)&&Number.isFinite(r.total));best.textContent=entries.length?`Local records: ${entries.reduce((n,r)=>n+(Number(r.played)||0),0)} completed challenges. Best results are shown for matching settings after a challenge.`:'No local scores yet. Finish a challenge to set your first record.';};bestText();
 const status=el('p');status.id='solo-status';status.setAttribute('role','status');root.append(status);
 const stage=el('div');stage.id='solo-stage';root.append(stage);
 function stopWorker(){job++;worker?.terminate();worker=null;}
 function persist(key,result){records=recordSoloResult(records,key,result);try{localStorage.setItem(KEY,JSON.stringify(records));}catch{status.textContent='Your result is shown, but this browser blocked saving local records.';}bestText();}
 function exit(){stopWorker();session=null;delete root.dataset.active;stage.replaceChildren();setup.hidden=false;status.textContent='Choose a game. Multiplayer is still available below.';}
 function start(review=null){
  stopWorker();status.textContent='';setup.hidden=true;root.dataset.active='1';
  if(kind.value==='chess'&&!review){session={kind:'chess',state:initialPosition(),history:[],labels:[],human:color.value,opponent:opponent.value,level:difficulty.value==='hard'?'normal':'easy',selected:null,hint:'',busy:false,promotion:'q',focusSquare:color.value==='b'?12:52};renderChess();resumeComputer();return;}
  const seed=soloSeed({daily:daily.value==='daily',kind:kind.value,subject:subject.value,difficulty:difficulty.value,nonce:globalThis.crypto?.getRandomValues?crypto.getRandomValues(new Uint32Array(1))[0]:Date.now()});
  const questions=review||makeSoloQuestions({kind:kind.value,seed,count:Number(count.value),subject:subject.value,difficulty:difficulty.value});
  session={kind:kind.value,questions,index:0,responses:[],hints:new Set(),done:false,review:Boolean(review),key:`${kind.value}|${kind.value==='quiz'?subject.value:'all'}|${kind.value==='math'?difficulty.value:'easy'}|${questions.length}`,daily:daily.value==='daily'};
  if(!questions.length){exit();status.textContent='No questions match those settings. Try Mixed subjects.';return;}renderQuestion();
 }
 setup.append(button('Start solo game',()=>start()),button('Clear local solo records',()=>{if(confirm('Clear solo challenge records in this browser? Multiplayer and study progress are not affected.')){records={};try{localStorage.removeItem(KEY);}catch{}bestText();}}));
 function answer(value){if(!session||session.kind==='chess'||session.done||session.responses.length>session.index)return;const q=session.questions[session.index];if(!String(value).trim()){status.textContent='Enter an answer or choose Skip.';return;}const correct=checkSoloAnswer(q,value,session.kind);session.responses.push({question:q,answer:String(value),correct,assisted:session.hints.has(session.index)});renderQuestion();}
 function renderQuestion(){
  const s=session;if(!s||s.kind==='chess')return;stage.replaceChildren();status.textContent='';
  if(s.index>=s.questions.length){finish();return;}
  const q=s.questions[s.index],response=s.responses[s.index];
  stage.append(el('h4',`${s.review?'Mistake review':s.daily?`Daily set · ${localDateKey()}`:'Practice'} · Round ${s.index+1}/${s.questions.length}`));
  const prompt=el('p',q.prompt);prompt.className='solo-prompt';prompt.id='solo-prompt';stage.append(prompt);
  if(s.kind==='word'){const letters=el('p',q.letters.toUpperCase().split('').join(' '));letters.className='solo-letters';stage.append(letters);}
  if(q.options){const group=el('div');group.className='solo-options';for(const option of q.options){const b=button(option,()=>answer(option));b.disabled=Boolean(response);group.append(b);}stage.append(group);}
  else {const form=el('form');const input=el('input');input.id='solo-answer';input.maxLength=80;input.autocomplete='off';input.setAttribute('aria-label',s.kind==='math'?'Your numeric answer':'Unscrambled word');if(s.kind==='math')input.inputMode='decimal';input.disabled=Boolean(response);input.value=response?.answer||'';const submit=el('button','Check answer');submit.type='submit';submit.className='button primary';submit.disabled=Boolean(response);form.append(input,submit);form.addEventListener('submit',event=>{event.preventDefault();answer(input.value);});stage.append(form);}
  const actions=el('div');actions.className='studio-actions';
  if(response){const feedback=el('p',`${response.correct?'Correct.':'Not quite.'} Answer: ${q.answer}. ${q.explanation}${response.assisted?' Hint used.':''}`);feedback.id='solo-feedback';feedback.setAttribute('role','status');stage.append(feedback);actions.append(button(s.index===s.questions.length-1?'See my results':'Next round',()=>{if(session!==s||s.responses.length!==s.index+1)return;s.index++;renderQuestion();}));}
  else {actions.append(button('Hint',()=>{s.hints.add(s.index);status.textContent=q.hint||'Think about what each option means before choosing.';}),button('Skip — show answer',()=>{if(session!==s||s.responses.length>s.index)return;s.responses.push({question:q,answer:'[Skipped]',correct:false,assisted:s.hints.has(s.index)});renderQuestion();}));}
  actions.append(button('End solo session',()=>{if(confirm('End this unfinished challenge? Only completed challenges set local records.'))exit();}));stage.append(actions);
 }
 function finish(){
  const s=session;const correct=s.responses.filter(r=>r.correct).length,assisted=s.responses.filter(r=>r.assisted).length;
  if(!s.done&&!s.review)persist(s.key,{correct,total:s.questions.length,assisted});s.done=true;delete root.dataset.active;
  stage.append(el('h4',`${s.review?'Review complete':'Challenge complete'} · ${correct}/${s.questions.length}`));
  stage.append(el('p',`${assisted} rounds used a hint. ${s.review?'Review practice does not change your records.':`Best for these settings: ${records[s.key]?.best||0}/${s.questions.length}.`} No online leaderboard or XP is affected.`));
  const review=el('ol');for(const r of s.responses){const li=el('li',`${r.correct?'Correct':'Revise'}: ${r.question.prompt} — your answer: ${r.answer}; answer: ${r.question.answer}. ${r.question.explanation}`);review.append(li);}stage.append(review);
  const actions=el('div');actions.className='studio-actions';const wrong=s.responses.filter(r=>!r.correct).map(r=>r.question);
  if(wrong.length)actions.append(button('Practise my mistakes',()=>start(wrong)));
  actions.append(button('Play another solo game',exit),button('Export answer review',()=>{const url=URL.createObjectURL(new Blob([review.textContent],{type:'text/plain;charset=utf-8'}));const a=el('a');a.href=url;a.download='solo-practice-review.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}));stage.append(actions);
 }
 const glyph={wp:'♙',wn:'♘',wb:'♗',wr:'♖',wq:'♕',wk:'♔',bp:'♟',bn:'♞',bb:'♝',br:'♜',bq:'♛',bk:'♚'};
 function outcome(s){const key=state=>toFen(state).split(' ').slice(0,4).join(' ');const current=key(s.state);if([...s.history,s.state].filter(p=>key(p)===current).length>=3)return {over:true,result:'threefold repetition',winner:''};return gameStatus(s.state);}
 function moveChess(move){stopWorker();const s=session;try{const result=playMove(s.state,move);s.history.push(s.state);s.labels.push(result.move.label);s.state=result.state;s.focusSquare=Number(move.to);s.selected=null;s.hint='';s.busy=false;renderChess();resumeComputer();}catch(error){status.textContent=error.message;}}
 function renderChess(){
  const s=session;if(!s||s.kind!=='chess')return;const boardFocused=Boolean(document.activeElement?.closest?.('#solo-chess-board'));stage.replaceChildren();const result=outcome(s);if(result.over)delete root.dataset.active;else root.dataset.active='1';
  stage.append(el('h4',result.over?`${result.winner?(result.winner==='w'?'White':'Black')+' wins':'Draw'} · ${result.result}`:`${s.state.turn==='w'?'White':'Black'} to move${result.check?' · check':''}`));
  stage.append(el('p',s.opponent==='computer'?`You play ${s.human==='w'?'White':'Black'}. ${s.level==='easy'?'Casual':'Two-ply'} local computer; no cloud AI or rating.`:'Two humans share this device. Turns follow the rules, without accounts.'));
  const promotion=field(stage,'Promote a pawn to',select('solo-promotion',[['q','Queen'],['r','Rook'],['b','Bishop'],['n','Knight']]));promotion.value=s.promotion;promotion.addEventListener('change',()=>s.promotion=promotion.value);
  const board=el('div');board.id='solo-chess-board';board.className='solo-chess-board';board.setAttribute('role','group');board.setAttribute('aria-label','Chess board. Select a piece then a highlighted destination.');
  const possible=s.selected===null?[]:legalMoves(s.state,s.selected);const reversed=s.opponent==='computer'&&s.human==='b';
  for(let offset=0;offset<64;offset++){const index=reversed?63-offset:offset,piece=s.state.board[index];const cell=button(glyph[piece]||'',()=>{if(result.over||s.busy||(s.opponent==='computer'&&s.state.turn!==s.human))return;const legal=possible.find(m=>m.to===index);if(legal){moveChess({from:s.selected,to:index,promotion:promotion.value});return;}s.focusSquare=index;s.selected=piece?.[0]===s.state.turn?index:null;renderChess();});cell.className=`solo-square ${(Math.floor(index/8)+index%8)%2?'dark':'light'}${s.selected===index?' selected':''}${possible.some(m=>m.to===index)?' legal':''}`;cell.dataset.square=squareName(index);cell.tabIndex=index===s.focusSquare?0:-1;cell.addEventListener('keydown',event=>{const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-8,ArrowDown:8}[event.key];if(!delta)return;event.preventDefault();const offset=(reversed?63-index:index)+delta;if(offset<0||offset>=64)return;const target=reversed?63-offset:offset;s.focusSquare=target;for(const other of board.children)other.tabIndex=-1;const next=board.querySelector(`[data-square="${squareName(target)}"]`);if(next){next.tabIndex=0;next.focus();}});cell.setAttribute('aria-label',`${squareName(index)} ${piece||'empty'}${possible.some(m=>m.to===index)?', legal destination':''}`);cell.setAttribute('aria-pressed',String(s.selected===index));cell.disabled=result.over||s.busy||(s.opponent==='computer'&&s.state.turn!==s.human);board.append(cell);}stage.append(board);if(boardFocused)board.querySelector(`[data-square="${squareName(s.focusSquare)}"]`)?.focus({preventScroll:true});
  const help=el('p',s.busy?'Local computer thinking…':s.hint||'Tap/click a piece, then a highlighted square. White starts at the bottom unless you play Black.');help.id='solo-chess-note';stage.append(help);
  const actions=el('div');actions.className='studio-actions';const undo=button('Undo last turn',()=>{stopWorker();if(!s.history.length)return;do{s.state=s.history.pop();s.labels.pop();}while(s.opponent==='computer'&&s.history.length&&s.state.turn!==s.human);s.busy=false;s.selected=null;s.hint='';renderChess();resumeComputer();});undo.disabled=!s.history.length||(s.opponent==='computer'&&!s.history.some(p=>p.turn===s.human));actions.append(undo);
  const hint=button('Suggest a legal move',()=>{if(!result.over&&!s.busy&&(s.opponent==='human'||s.state.turn===s.human))compute(true);});hint.disabled=result.over||s.busy||(s.opponent==='computer'&&s.state.turn!==s.human);actions.append(hint,button('New solo game',()=>{if(result.over||confirm('Leave this chess game? The current board is not saved across reloads.'))exit();}));const log=el('p',`Moves: ${s.labels.join(' · ')||'None yet'}`);log.id='solo-chess-moves';stage.append(actions,log);
 }
 function compute(hint=false){
  const s=session;if(!s||s.kind!=='chess')return;stopWorker();const id=job,fen=toFen(s.state);s.busy=true;renderChess();
  const apply=result=>{if(session!==s||id!==job||toFen(s.state)!==fen)return;worker?.terminate();worker=null;s.busy=false;if(result.error){status.textContent=result.error;renderChess();return;}if(result.move){if(hint){s.hint=`Try ${squareName(result.move.from)} to ${squareName(result.move.to)}. This is a local suggestion, not a guaranteed best move.`;renderChess();}else moveChess(result.move);}else renderChess();};
  try{worker=new Worker(new URL('./solo-chess-worker.js?v=94',import.meta.url),{type:'module'});worker.onmessage=event=>apply(event.data);worker.onerror=()=>{status.textContent='Using a basic local move because this browser could not load the worker.';apply(chooseComputerMove(s.state,{level:'easy',maxNodes:100}));};worker.postMessage({id,state:s.state,level:s.level});}
  catch{apply(chooseComputerMove(s.state,{level:'easy',maxNodes:100}));}
 }
 function resumeComputer(){const s=session;if(document.hidden||document.body.dataset.view!=='play'||!s||s.kind!=='chess'||s.busy||s.opponent!=='computer'||s.state.turn===s.human||outcome(s).over)return;compute();}
 function visibility(){if(document.hidden||document.body.dataset.view!=='play'){if(worker){stopWorker();if(session?.kind==='chess')session.busy=false;}}else{if(session?.kind==='chess')renderChess();resumeComputer();}}
 document.addEventListener('visibilitychange',visibility);
 new MutationObserver(visibility).observe(document.body,{attributes:true,attributeFilter:['data-view']});
}
