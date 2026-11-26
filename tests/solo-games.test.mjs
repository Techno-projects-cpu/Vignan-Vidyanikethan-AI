import test from 'node:test';
import assert from 'node:assert/strict';
import { SOLO_QUIZ, SOLO_WORDS, makeSoloQuestions, mathQuestions, checkSoloAnswer, recordSoloResult, soloSeed, localDateKey } from '../js/solo-games.js';
import { chooseComputerMove } from '../js/solo-chess.js';
import { initialPosition, fromFen, legalMoves, playMove, gameStatus } from '../js/chess.js';

test('solo bank has unique IDs, unambiguous choices and original explanations',()=>{
 assert.equal(SOLO_QUIZ.length,24);assert.equal(new Set(SOLO_QUIZ.map(q=>q.id)).size,24);
 for(const q of SOLO_QUIZ){assert.equal(new Set(q.options).size,4);assert.ok(q.options.includes(q.answer));assert.ok(q.explanation.length>25);}
 assert.equal(SOLO_WORDS.length,16);
});
test('daily seeds are reproducible and change with day, game and difficulty',()=>{
 const args={daily:true,kind:'math',day:'2026-10-27'};assert.equal(soloSeed(args),soloSeed({...args,nonce:999}));
 assert.notEqual(soloSeed(args),soloSeed({...args,day:'2026-10-28'}));assert.notEqual(soloSeed(args),soloSeed({...args,kind:'word'}));assert.notEqual(soloSeed(args),soloSeed({...args,difficulty:'hard'}));
 assert.equal(localDateKey(new Date(2026,0,2,1)),'2026-01-02');
});
test('quiz selects a bounded non-repeating subject pool without mutating bank',()=>{
 const original=JSON.stringify(SOLO_QUIZ),q=makeSoloQuestions({seed:6,count:15,subject:'science'});assert.equal(q.length,8);assert.ok(q.every(q=>q.subject==='science'));assert.equal(new Set(q.map(q=>q.id)).size,q.length);assert.equal(JSON.stringify(SOLO_QUIZ),original);
});
test('math generator produces valid integer arithmetic with explanations',()=>{
 for(let seed=0;seed<30;seed++)for(const q of mathQuestions(seed,20,'hard')){const [a,op,b]=q.prompt.split(' ');const expected=op==='+'?+a+ +b:op==='−'?+a- +b:op==='×'?+a* +b:+a/ +b;assert.equal(Number(q.answer),expected);assert.ok(Number.isInteger(expected));assert.ok(q.hint);}
});
test('word scrambles retain exactly the answer letters and do not expose answer order',()=>{
 for(const q of makeSoloQuestions({kind:'word',seed:9,count:15})){assert.equal([...q.letters].sort().join(''),[...q.answer].sort().join(''));assert.notEqual(q.letters,q.answer);assert.ok(q.hint.includes(q.answer[0].toUpperCase()));}
});
test('solo answer grading handles zero, numeric formatting and case without accepting blanks',()=>{
 assert.equal(checkSoloAnswer({answer:'0'},'', 'math'),false);assert.equal(checkSoloAnswer({answer:'12'},'12junk','math'),false);assert.equal(checkSoloAnswer({answer:'12'},'012.0','math'),true);assert.equal(checkSoloAnswer({answer:'cell'},' CELL ','word'),true);assert.equal(checkSoloAnswer({answer:'B'},'a','quiz'),false);
});
test('local records separate settings, retain best and count completed games',()=>{
 let records=recordSoloResult(null,'math|easy|5',{correct:4,total:5,assisted:1});records=recordSoloResult(records,'math|easy|5',{correct:2,total:5});records=recordSoloResult(records,'math|hard|5',{correct:1,total:5});assert.equal(records['math|easy|5'].best,4);assert.equal(records['math|easy|5'].played,2);assert.equal(records['math|hard|5'].best,1);
});
test('computer chooses a legal opening for either colour within its search budget',()=>{
 const white=initialPosition();for(const level of ['easy','normal']){const result=chooseComputerMove(white,{level,maxNodes:100});assert.ok(legalMoves(white).some(m=>m.from===result.move.from&&m.to===result.move.to));assert.ok(result.nodes<=100);const black=playMove(white,result.move).state;const reply=chooseComputerMove(black,{level,maxNodes:100});assert.doesNotThrow(()=>playMove(black,reply.move));}
});
test('local computer takes an undefended queen in a simple material position',()=>{
 const state=fromFen('4k3/8/8/8/8/8/q7/R3K3 w Q - 0 1');const {move}=chooseComputerMove(state,{level:'easy'});assert.equal(move.from,56);assert.equal(move.to,48);
});
test('computer never returns a move when checkmated',()=>{
 const state=fromFen('7k/6Q1/6K1/8/8/8/8/8 b - - 0 1');assert.equal(gameStatus(state).result,'checkmate');assert.equal(chooseComputerMove(state).move,null);
});
test('computer handles a promotion through existing legal rules',()=>{
 const state=fromFen('7k/P7/8/8/8/8/8/7K w - - 0 1');const result=chooseComputerMove(state,{level:'easy'});assert.equal(result.move.promotion,'q');const next=playMove(state,result.move).state;assert.equal(next.board[result.move.to],'wq');
});
test('same daily settings generate exactly the same shuffled quiz and word challenge',()=>{
 for(const kind of ['quiz','word','math']){const seed=soloSeed({daily:true,kind,day:'2026-10-27'});assert.deepEqual(makeSoloQuestions({kind,seed,count:10}),makeSoloQuestions({kind,seed,count:10}));}
});

test('hidden setup fields do not change daily sets for unrelated game types',()=>{
 assert.equal(soloSeed({daily:true,kind:'word',subject:'science',difficulty:'hard'}),soloSeed({daily:true,kind:'word',subject:'english',difficulty:'easy'}));
 assert.equal(soloSeed({daily:true,kind:'math',subject:'science'}),soloSeed({daily:true,kind:'math',subject:'all'}));
});
