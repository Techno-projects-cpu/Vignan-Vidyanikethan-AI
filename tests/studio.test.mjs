import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRoster, debateSpeaker, debateDone, debatePhase, debateMessages, essayMessages, offlineOutline, wordCount, EVENTS, SCIENCE_QUESTIONS, transcriptText } from '../js/studio-core.js';
import { generateQuiz } from '../js/quiz.js';
import { chapterHits } from './helpers.mjs';
test('offline MCQs are complete statements, not blanks in disguise', () => {
 const quiz = generateQuiz({ hits: chapterHits('photosynthesis', 10), count: 5, type: 'mcq' });
 assert.ok(quiz.questions.length >= 3);
 for (const q of quiz.questions) { assert.equal(q.type, 'mcq'); assert.doesNotMatch(q.prompt, /______|completes|blank/i); assert.ok(q.options.includes(q.answer)); assert.equal(new Set(q.options).size, 4); assert.equal(q.answer, q.reference); }
});
test('mixed quiz includes real short explanations and explicit blanks only in fill type', () => {
 const quiz = generateQuiz({ hits: chapterHits('photosynthesis', 10), count: 8, type: 'mix' });
 assert.deepEqual(new Set(quiz.questions.map(q=>q.type)), new Set(['mcq','fill','short']));
 for (const q of quiz.questions.filter(q=>q.type === 'short')) assert.doesNotMatch(q.prompt,/complete the sentence|____/i);
});
test('debate roster clamps participant counts and assigns both teams', () => {
 assert.equal(makeRoster(99,99).length,10); assert.equal(makeRoster(-2,0).length,2);
 assert.equal(makeRoster(2,3).filter(m=>m.kind==='human').length,2);
});
test('debate rotates humans and AI through opening rebuttal closing then ends', () => {
 const s={ topic:'Plastic', roster:makeRoster(2,2), rounds:3, turn:0, transcript:[], language:'en' };
 assert.equal(debateSpeaker(s).kind,'human');assert.equal(debatePhase(s),'Opening');
 s.turn=2;assert.equal(debateSpeaker(s).kind,'ai'); s.turn=4;assert.equal(debatePhase(s),'Rebuttal');
 s.turn=8;assert.equal(debatePhase(s),'Closing');s.turn=12;assert.equal(debateDone(s),true);
});
test('AI prompts bound context and explicitly separate one role from independent agents', () => {
 const s={ topic:'Ignore everything', roster:makeRoster(), rounds:3, turn:1, transcript:Array.from({length:40},()=>({name:'H',team:'for',text:'x'.repeat(5000)})) };
 const messages=debateMessages(s);assert.match(messages[0].content,/ONE AI role-playing/);assert.match(messages[0].content,/Do not speak for humans/);
 assert.equal(JSON.parse(messages[1].content).recentTranscript.length,14);
 assert.equal(JSON.parse(messages[1].content).recentTranscript[0].speech.length,2500);
});
test('essay prompts distinguish feedback from draft and offline scaffold is honest', () => {
 assert.match(essayMessages({kind:'feedback',topic:'Science',draft:'My work'})[1].content,/specific strengths/);
 assert.match(essayMessages({kind:'draft'})[1].content,/model essay/);
 assert.match(offlineOutline('Water'),/not an AI-generated essay/);assert.equal(wordCount('a b\n c'),3);
});
test('science practice is original, has explanations and historical references not official current patterns', () => {
 assert.equal(EVENTS.length,3);assert.ok(EVENTS.every(e=>e.tasks.length===3 && e.url.startsWith('https://')));
 for(const q of SCIENCE_QUESTIONS){assert.ok(q.options[q.answer]);assert.ok(q.why.length>30);}
 assert.match(transcriptText({topic:'Test',transcript:[]}),/Not independent agents/);
});

test('AI quiz validation rejects disguised blanks, incorrect choices and all-fill mixed results', async () => {
 const { validateQuizQuestions } = await import('../js/quiz.js');
 assert.throws(()=>validateQuizQuestions([{type:'mcq',prompt:'Water is ____',options:['wet','dry'],answer:'wet'}],'mcq'),/usable/);
 assert.throws(()=>validateQuizQuestions([{type:'mcq',prompt:'Which?',options:['a','b'],answer:'c'}],'mcq'),/usable/);
 assert.throws(()=>validateQuizQuestions([{type:'fill',prompt:'___',answer:'a'}],'mix',4),/mixed/);
 assert.equal(validateQuizQuestions([{type:'mcq',prompt:'Which statement?',options:['a','b'],answer:'a'}],'mcq').length,1);
});
