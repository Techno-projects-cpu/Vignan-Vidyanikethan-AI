/** Original solo practice content. Local scores are never multiplayer ranks/XP. */
export const SOLO_QUIZ = [
 ['Which plant tissue carries water upward?',['Xylem','Phloem','Petals','Pollen'],0,'Xylem transports water and dissolved minerals from the roots.','science'],
 ['Why does a bicycle slow down after you stop pedalling?',['Gravity disappears','Friction and air resistance oppose motion','Its mass increases','The wheels lose all force instantly'],1,'Resistive forces oppose motion and transfer kinetic energy to the surroundings.','science'],
 ['Which change produces a new substance?',['Melting ice','Cutting paper','Rusting iron','Boiling water'],2,'Rusting is a chemical reaction that forms iron oxides; the other examples are physical changes.','science'],
 ['What should stay the same in a fair plant-growth experiment?',['Every variable','Nothing','The measured result','Conditions other than the variable being tested'],3,'Change one independent variable and control other relevant conditions.','science'],
 ['What is the main role of chlorophyll?',['Absorb light energy','Transport blood','Make roots longer','Release nitrogen'],0,'Chlorophyll absorbs light used in photosynthesis.','science'],
 ['Which circuit material is usually an electrical insulator?',['Copper','Dry rubber','Aluminium','Iron'],1,'Dry rubber has high electrical resistance compared with these metals.','science'],
 ['Why do we see lightning before hearing thunder?',['Thunder starts much later','Sound travels faster','Light travels much faster than sound','Light needs no energy'],2,'Light reaches us much sooner than sound travelling through air.','science'],
 ['Which action best reduces waste?',['Burn all plastic','Mix all rubbish','Use a new bottle every day','Reuse a durable bottle'],3,'Reusing durable items can reduce the amount of disposable material consumed.','science'],
 ['A triangle has angles 50° and 60°. What is its third angle?',['70°','90°','110°','60°'],0,'The interior angles total 180°: 180 − 50 − 60 = 70.','maths'],
 ['What is 25% of 80?',['25','20','40','15'],1,'25% is one quarter, and 80 ÷ 4 = 20.','maths'],
 ['Which number is prime?',['21','27','29','33'],2,'29 has only two positive factors: 1 and 29.','maths'],
 ['A square has side 7 cm. What is its area?',['14 cm²','28 cm²','21 cm²','49 cm²'],3,'Area of a square is side × side: 7 × 7 = 49 cm².','maths'],
 ['Solve 3x = 24.',['8','6','12','21'],0,'Divide both sides by 3 to obtain x = 8.','maths'],
 ['Which fraction equals 0.5?',['1/5','1/2','2/5','5/2'],1,'One half is 0.5 in decimal notation.','maths'],
 ['Which word is an adverb in “She spoke calmly”?',['She','spoke','calmly','None'],2,'“Calmly” describes how she spoke.','english'],
 ['Which sentence uses the correct subject–verb agreement?',['They walks home.','He walk home.','We walks home.','She walks home.'],3,'A singular third-person subject in the simple present takes “walks”.','english'],
 ['Which is a synonym of “careful”?',['Cautious','Reckless','Hasty','Careless'],0,'Cautious means taking care to avoid mistakes or danger.','english'],
 ['Choose the correct plural of “child”.',['Childs','Children','Childes','Childrens'],1,'“Children” is the irregular plural of “child”.','english'],
 ['What comes next: 2, 4, 8, 16, …?',['18','24','32','30'],2,'Each number is double the previous number.','logic'],
 ['All squares are rectangles. Which must be true?',['All rectangles are squares','No square is a rectangle','All rectangles have equal sides','Every square has four right angles'],3,'A rectangle has four right angles; a square is a special rectangle with equal sides.','logic'],
 ['A fair coin is tossed once. What is the probability of heads?',['1/2','1','0','1/4'],0,'There are two equally likely outcomes, with one head outcome.','logic'],
 ['What is the best way to check a surprising scientific claim?',['Count likes','Look for reliable evidence and reproducible tests','Accept the loudest opinion','Ignore all disagreement'],1,'Evidence quality and reproducibility matter more than popularity.','logic'],
 ['What comes next: 3, 6, 9, 12, …?',['13','14','15','18'],2,'The sequence increases by 3 at each step: 12 + 3 = 15.','logic'],
 ['Which is the strongest support for an argument?',['A rumour','An insult','A repeated assertion','Relevant, checkable evidence'],3,'Evidence should be relevant to the claim and independently checkable.','logic'],
].map(([prompt,options,answer,explanation,subject],id)=>({id:`solo-q${id}`,prompt,options,answer:options[answer],explanation,subject}));
export const SOLO_WORDS = [
 ['A force that opposes motion between surfaces','friction'],['Green pigment involved in photosynthesis','chlorophyll'],['The basic structural unit of life','cell'],['Change from liquid to gas at a surface','evaporation'],['A number with exactly two positive factors','prime'],['The distance around a shape','perimeter'],['A push or pull','force'],['A prediction that can be tested','hypothesis'],['The path of a planet around a star','orbit'],['An animal that eats plants','herbivore'],['The process by which plants make food using light','photosynthesis'],['A word that describes a noun','adjective'],['A word with the opposite meaning','antonym'],['A substance made from only one type of atom','element'],['A shape with three sides','triangle'],['A measure of how hot or cold something is','temperature'],
].map(([prompt,answer],id)=>({id:`solo-w${id}`,prompt,answer,explanation:`${answer[0].toUpperCase()+answer.slice(1)}: ${prompt.toLowerCase()}.`}));
export function hashSeed(value){let seed=2166136261;for(const c of String(value)){seed=Math.imul(seed^c.charCodeAt(0),16777619);}return seed>>>0;}
export function randomFrom(seed){let n=Number(seed)>>>0||1;return()=>{n^=n<<13;n^=n>>>17;n^=n<<5;return(n>>>0)/4294967296;};}
export function shuffleSolo(list,random){const items=[...list];for(let i=items.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[items[i],items[j]]=[items[j],items[i]];}return items;}
export function localDateKey(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export function soloSeed({daily=false,kind,subject='all',difficulty='easy',day=localDateKey(),nonce=Date.now()}){return hashSeed(`${daily?day:nonce}|${kind}|${kind==='quiz'?subject:'all'}|${kind==='math'||kind==='chess'?difficulty:'easy'}`);}
export function mathQuestions(seed,count=10,difficulty='easy'){
 const random=randomFrom(seed),number=(min,max)=>min+Math.floor(random()*(max-min+1));
 return Array.from({length:Math.min(20,Math.max(1,count))},(_,i)=>{
  const operation=number(0,difficulty==='hard'?3:1);let a,b,answer,prompt,explanation;
  if(operation===0){a=number(10,difficulty==='hard'?199:49);b=number(10,49);answer=a+b;prompt=`${a} + ${b}`;explanation=`Add by place value: ${a} + ${b} = ${answer}.`;}
  else if(operation===1){a=number(40,99);b=number(10,39);answer=a-b;prompt=`${a} − ${b}`;explanation=`Subtract ${b} from ${a}: ${answer}. Check by adding ${b} back.`;}
  else if(operation===2){a=number(3,12);b=number(3,12);answer=a*b;prompt=`${a} × ${b}`;explanation=`${a} groups of ${b} make ${answer}.`;}
  else {b=number(2,12);answer=number(2,12);a=b*answer;prompt=`${a} ÷ ${b}`;explanation=`${b} × ${answer} = ${a}, so ${a} ÷ ${b} = ${answer}.`;}
  return {id:`solo-m${i}`,prompt,answer:String(answer),explanation,hint:operation===3?'Use the inverse multiplication fact.':operation===2?'Split a factor into smaller parts.':'Work with tens and ones separately.'};
 });
}
export function makeSoloQuestions({kind='quiz',seed=1,count=10,subject='all',difficulty='easy'}={}){
 const random=randomFrom(seed),limit=Math.min(20,Math.max(1,Number(count)||10));
 if(kind==='math')return mathQuestions(seed,limit,difficulty);
 if(kind==='word')return shuffleSolo(SOLO_WORDS,random).slice(0,limit).map(q=>{let letters=shuffleSolo([...q.answer],random).join('');if(letters===q.answer)letters=letters.slice(1)+letters[0];return {...q,letters,hint:`Starts with ${q.answer[0].toUpperCase()} · ${q.answer.length} letters.`};});
 return shuffleSolo(SOLO_QUIZ.filter(q=>subject==='all'||q.subject===subject),random).slice(0,limit).map(q=>({...q,options:shuffleSolo(q.options,random),hint:'Eliminate options that do not fit the question. Explain why before choosing.'}));
}
export function checkSoloAnswer(question,value,kind){const answer=String(value??'').trim();if(kind==='math')return answer!==''&&/^[+-]?\d+(?:\.\d+)?$/.test(answer)&&Number(answer)===Number(question.answer);return answer.toLocaleLowerCase()===String(question.answer).trim().toLocaleLowerCase();}
export function recordSoloResult(records,key,{correct,total,assisted=0}){
 const safe=records&&typeof records==='object'&&!Array.isArray(records)?records:{};const previous=safe[key]||{};
 return {...safe,[key]:{played:Math.min(99999,Math.max(0,Number(previous.played)||0)+1),best:Math.max(Math.max(0,Number(previous.best)||0),Math.max(0,Math.min(total,correct))),total,last:correct,assisted}};
}
