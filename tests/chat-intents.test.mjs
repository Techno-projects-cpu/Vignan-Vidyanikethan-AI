import test from "node:test";
import assert from "node:assert/strict";
import { lastCitedStudyContext, parseChatIntent, requestedChatMode } from "../js/chat-intents.js";
import { asksAboutCreator, casualReply, consecutiveCasualTurns, conversationReply, safetyReply } from "../js/conversation.js";

const source = { bookId: "science", chunkId: "science:0", page: 2, text: "Photosynthesis is a process in plants." };

test("explicit English study commands parse topic, count, difficulty and type", () => {
  assert.deepEqual(parseChatIntent("Make a 5-question hard MCQ quiz on photosynthesis"), {
    action: "quiz", topic: "photosynthesis", contextual: false, count: 5, difficulty: "hard", type: "mcq",
  });
  assert.equal(parseChatIntent("make flashcards on that").contextual, true);
  assert.equal(parseChatIntent("quiz me on gravity").topic, "gravity");
  assert.equal(parseChatIntent("make a quiz on chapter 4").topic, "chapter 4");
  assert.equal(parseChatIntent("अध्याय ४ पर क्विज़ बनाओ").topic, "अध्याय 4");
  assert.equal(parseChatIntent("make a model paper based on uploaded past papers").action, "paper");
  assert.equal(parseChatIntent("make a model paper based on uploaded past papers").topic, "");
  assert.equal(parseChatIntent("make a 20 question model paper from past papers").count, 20);
  assert.equal(parseChatIntent("open my library").view, "library");
  assert.equal(parseChatIntent("make 99 questions for a quiz on gravity").count, 10);
  for (const question of ["What is a quiz?", "How do flashcards work?", "Who invented the paper?", "Read https://example.org/quiz"]) {
    assert.equal(parseChatIntent(question), null, question);
  }
  assert.equal(requestedChatMode("summarize that"), "summarize");
  assert.equal(requestedChatMode("Explain this please"), "explain");
  assert.equal(requestedChatMode("What is physics?"), "");
});

test("Telugu and Hindi commands retain the topic, vowel marks and native digits", () => {
  const telugu = parseChatIntent("కిరణజన్య సంయోగక్రియపై ౫ ప్రశ్నల క్విజ్ తయారు చేయండి");
  assert.equal(telugu.action, "quiz");
  assert.equal(telugu.topic, "కిరణజన్య సంయోగక్రియ");
  assert.equal(telugu.count, 5);
  assert.equal(parseChatIntent("దానిపై క్విజ్ చేయండి").contextual, true);
  const hindi = parseChatIntent("प्रकाश संश्लेषण पर ५ प्रश्नों की क्विज़ बनाओ");
  assert.equal(hindi.action, "quiz");
  assert.equal(hindi.topic, "प्रकाश संश्लेषण");
  assert.equal(hindi.count, 5);
  assert.equal(parseChatIntent("परमाणु पर क्विज़ बनाओ").topic, "परमाणु", "do not remove the word पर inside परमाणु");
  assert.equal(parseChatIntent("इस पर क्विज़ बनाओ").contextual, true);
  assert.equal(parseChatIntent("परमाणु पर फ्लैश कार्ड बनाओ").topic, "परमाणु");
  assert.equal(parseChatIntent("పదార్థం గురించి ఫ్లాష్ కార్డులు తయారు చేయండి").topic, "పదార్థం");
});

test("that means the latest cited study answer, not a stale result or web-only answer", () => {
  const history = [
    { role: "user", content: "What is photosynthesis?" },
    { role: "assistant", sources: [source], meta: "Bolt · cited library excerpts" },
    { role: "user", content: "hi" },
    { role: "assistant", meta: "Bolt · conversation", content: "Hello" },
    { role: "user", content: "I like cricket" },
    { role: "assistant", meta: "Bolt · casual", content: "Nice!" },
  ];
  assert.equal(lastCitedStudyContext(history).topic, "What is photosynthesis?");
  assert.equal(lastCitedStudyContext(history).sources[0], source);
  const failed = [...history, { role: "user", content: "What is the moon?" }, { role: "assistant", sources: [], webSources: [{ url: "https://example.org" }], meta: "Outside results" }];
  assert.equal(lastCitedStudyContext(failed), null);
  assert.equal(lastCitedStudyContext([]), null);
});

test("friendly chat is bounded, but urgent support always remains available", () => {
  assert.match(conversationReply("hello"), /Hi!/);
  assert.match(conversationReply("नमस्ते", "hi"), /नमस्ते/);
  assert.ok(casualReply("I like cricket"));
  assert.match(casualReply("tell me a joke", "en", 3), /return to studying/i);
  assert.match(casualReply("I am being bullied", "en", 6), /someone you trust/i, "support should not be blocked by the break limit");
  assert.equal(casualReply("What is photosynthesis?"), "");
  const history = [{ role: "assistant", meta: "Bolt · casual" }, { role: "assistant", meta: "Bolt · conversation" }, { role: "assistant", meta: "Bolt · casual" }];
  assert.equal(consecutiveCasualTurns(history), 2);
  assert.equal(consecutiveCasualTurns([...history, { role: "assistant", meta: "Bolt · cited library excerpts" }]), 0);
  assert.match(safetyReply("I want to kill myself"), /trusted adult/i);
  assert.match(safetyReply("मुझे आत्महत्या करनी है", "hi"), /भरोसेमंद/);
  assert.match(safetyReply("ఆత్మహత్య", "te"), /నమ్మకమైన/);
  assert.equal(safetyReply("I like cricket"), "");
  assert.equal(asksAboutCreator("तुम्हें किसने बनाया?"), true);
  assert.equal(asksAboutCreator("నిన్ను ఎవరు తయారు చేశారు?"), true);
  assert.equal(asksAboutCreator("किसने टेलीफोन बनाया?"), false);
});
