/** Deterministic, bounded chat commands. No model or network is used here. */
import { asksAboutCreator, casualReply, conversationReply, isFollowUp, safetyReply } from "./conversation.js?v=29";
import { chapterReference } from "./text.js?v=29";

const CONTEXT_REFERENCE = /\b(?:this|that|it|these|those|above|previous|last answer)\b|(?:^|\s)(?:इस|इसे|इसके|इसका|उस|उसे|उसके|उसी)(?=\s|$)|(?:దీని|దాని|ఇది|అది|ఈ అంశం|ఆ అంశం)/iu;

function asciiDigits(value) {
  return value.replace(/[०-९౦-౯]/g, (digit) => {
    const code = digit.codePointAt(0);
    return String(code >= 0x0c66 ? code - 0x0c66 : code - 0x0966);
  });
}

function cleanTopic(value) {
  return value
    .replace(/\b(?:please|can|could|would|will|you|i|want|like|to|me|my|a|an|the|make|create|generate|start|prepare|build|write|give|take|test|quiz|quizzes|flashcards?|cards?|mcqs?|questions?|multiple|choice|short|answer|fill|blanks?|mixed|easy|medium|hard|difficult|timed|untimed|on|about|for|from|of|based|using|with|this|that|it|these|those|above|previous|last|new|one|some|exam|exams|paper|papers|model|sample|practice|old|past|year|years|question|topic|topics|uploaded|provided|material|materials|document|documents|pdf|pdfs|thank|thanks)\b/gi, " ")
    .replace(/\b\d+\b/g, " ")
    // Indic helper words must be whole words: e.g. do not remove "पर"
    // from परमाणु or "ఒక" from an unrelated Telugu topic.
    .replace(/[?,!।:;]+/g, " ")
    .replace(/(?<!\S)(?:बनाओ|बनाइए|बनाएं|बनाएँ|बना|तैयार|कीजिए|करो|करें|करिए|चाहिए|देना|दीजिए|दे|मेरे|मुझे|एक|प्रश्नों|प्रश्न|सवालों|सवाल|क्विज़|क्विज|फ़्लैश\s*कार्ड|फ्लैश\s*कार्ड|कार्ड|मॉडल|नमूना|पेपर|पत्र|परीक्षा|पुराने|पिछले|विषय|अध्याय|पर|के लिए|से|इस|इसे|इसके|इसका|उस|उसे|उसके|उसी|की|का|के|में)(?=\s|$)/gu, " ")
    .replace(/(?<!\S)(?:తయారు|చేయండి|చేయి|చేయు|చెయ్యి|చెయ్యండి|ఇవ్వండి|ఇవ్వు|ఇవ్వవా|కావాలి|నాకు|ఒక|ప్రశ్నలు|ప్రశ్నల|ప్రశ్న|క్విజ్|ఫ్లాష్\s*కార్డులు|ఫ్లాష్\s*కార్డ్స్|కార్డులు|మోడల్|నమూనా|పేపర్|ప్రశ్నాపత్రం|పాత|గత|గురించి|కోసం|మీద|దీనిపై|దానిపై|దీని|దాని|ఇది|అది|ఈ అంశం|ఆ అంశం)(?=\s|$)/gu, " ")
    .replace(/పై(?=\s|$)/gu, " ")
    .replace(/[?,!।:;]+/g, " ")
    .replace(/(?:^|\s)[-–—]+(?=\s|$)/g, " ")
    .replace(/\s+/g, " ").trim().slice(0, 160);
}

/** Return an action only for an explicit command, not a question about quizzes. */
export function parseChatIntent(input = "") {
  const original = String(input).trim().slice(0, 600);
  if (!original || /https?:\/\//i.test(original)) return null;
  const text = asciiDigits(original.toLowerCase());
  const navigation = text.match(/^(?:please\s+)?(?:open|show)(?:\s+me)?(?:\s+my|\s+the)?\s+(library|progress|settings|flashcards|quiz)\s*[?.!]*$/iu);
  if (navigation) return { action: "navigate", view: navigation[1].toLowerCase(), topic: "", contextual: false };
  const actionWords = /\b(?:make|create|generate|start|prepare|build|write|give|take|test)\b|\bquiz\s+(?:me|us)\b|(?:बनाओ|बनाइए|बनाएं|बनाएँ|बना|तैयार|कीजिए|करो|करें|करिए|चाहिए|दीजिए)|(?:తయారు|చేయండి|చేయి|చేయు|చెయ్యి|చెయ్యండి|ఇవ్వండి|ఇవ్వు|ఇవ్వవా|కావాలి)/iu;
  const quizNoun = /\b(?:quiz|quizzes|mcqs?)\b|\btest\s+me\b|(?:क्विज़|क्विज|పరీక్షించు|క్విజ్)/iu;
  const cardNoun = /\b(?:flash\s*cards?|flashcards?|revision\s+cards?)\b|(?:फ़्लैश\s*कार्ड|फ्लैश\s*कार्ड|ఫ్లాష్\s*కార్డులు|ఫ్లాష్\s*కార్డ్స్)/iu;
  const paperNoun = /\b(?:(?:model|sample|practice)\s+(?:question\s+)?(?:paper|exam)|(?:question|exam)\s+papers?)\b|(?:मॉडल\s*(?:प्रश्न\s*)?(?:पेपर|पत्र)|नमूना\s*(?:प्रश्न\s*)?(?:पेपर|पत्र)|మోడల్\s*(?:ప్రశ్న)?(?:పేపర్|పత్రం)|నమూనా\s*(?:ప్రశ్న)?(?:పేపర్|పత్రం)|ప్రశ్నాపత్రం)/iu;
  const nounFirst = /^(?:please\s+)?(?:quiz|flash\s*cards?|flashcards?|model\s+(?:question\s+)?paper)\s+(?:on|about|for|from)\b/iu;
  if (!actionWords.test(text) && !nounFirst.test(text)) return null;
  let action = "";
  if (paperNoun.test(text)) action = "paper";
  else if (cardNoun.test(text)) action = "flashcards";
  else if (quizNoun.test(text)) action = "quiz";
  if (!action) return null;
  const countMatch = text.match(/\b(\d{1,2})\s*(?:-\s*)?(?:questions?|mcqs?|flash\s*cards?|flashcards?|cards?|प्रश्न|सवाल|कार्ड|ప్రశ్నలు|ప్రశ్నల|కార్డులు)/iu);
  const limit = action === "paper" ? 30 : action === "flashcards" ? 15 : 10;
  const count = countMatch ? Math.max(action === "paper" ? 1 : 3, Math.min(limit, Number(countMatch[1]))) : null;
  const difficulty = /\b(?:hard|difficult)\b|कठिन|కష్టం/iu.test(text) ? "hard" : /\beasy\b|आसान|సులభ/iu.test(text) ? "easy" : /\bmedium\b|मध्यम|మధ్యమ/iu.test(text) ? "medium" : null;
  const type = /\b(?:mcq|mcqs|multiple choice)\b/iu.test(text) ? "mcq" : /\b(?:fill(?: in)? (?:the )?blanks?|fill in)\b/iu.test(text) ? "fill" : /\bshort answers?\b/iu.test(text) ? "short" : /\bmixed\b/iu.test(text) ? "mix" : null;
  const chapter = chapterReference(text);
  let topic = cleanTopic(text);
  if (chapter) {
    topic = topic.replace(/(?:\b(?:chapter|ch\.?)\b|अध्याय|అధ్యాయం|పాఠం)/giu, " ").replace(/\s+/g, " ").trim();
    topic = `${chapter.text}${topic ? ` ${topic}` : ""}`;
  }
  return { action, topic, contextual: CONTEXT_REFERENCE.test(text), count, difficulty, type };
}

/** Recognise a requested answer format without turning an ordinary question into an action. */
export function requestedChatMode(input = "") {
  const text = String(input).toLowerCase().trim();
  if (/^(?:please\s+)?(?:summari[sz]e|give (?:me )?(?:a )?summary)\b|(?:सारांश|సారాంశం)/u.test(text)) return "summarize";
  if (/^(?:please\s+)?(?:explain|teach me)\b|(?:समझाइए|समझाओ|వివరించండి|వివరించు)/u.test(text)) return "explain";
  if (/\bpractice questions?\b|(?:अभ्यास प्रश्न|అభ్యాస ప్రశ్నలు)/u.test(text)) return "practice";
  return "";
}

/** Latest study answer only: do not fall back through a newer failed/web answer. */
export function lastCitedStudyContext(history = []) {
  const recent = history.slice(-16);
  for (let index = recent.length - 1; index >= 0; index -= 1) {
    const message = recent[index];
    if (message?.role !== "assistant") continue;
    if (message.meta === "Bolt · conversation" || message.meta === "Bolt · casual" || message.meta === "About Vignan AI") continue;
    if (!message.sources?.length) return null;
    let topic = "";
    for (let previous = index - 1; previous >= 0; previous -= 1) {
      if (recent[previous]?.role !== "user") continue;
      const value = String(recent[previous].content || "").trim();
      const intent = parseChatIntent(value);
      if (intent?.topic && !intent.contextual) { topic = intent.topic; break; }
      if (intent || isFollowUp(value) || asksAboutCreator(value) || conversationReply(value) || casualReply(value) || safetyReply(value) || /https?:\/\//i.test(value)) continue;
      topic = value.slice(0, 160);
      break;
    }
    return { topic: topic || "Recent study topic", sources: message.sources };
  }
  return null;
}
