/** Small, bounded conversational helpers for Bolt's extractive engine. */
import { tokenize } from "./text.js?v=16";

export const CREATOR_ANSWER = "I was made by a student of Vignan Vidyanikethan English Medium High School for the INSPIRE-MANAK science fair. I use existing AI tools and textbook search; I am not a newly trained model.";

export function creatorAnswer(language = "en") {
  if (language === "te") return "నన్ను Vignan Vidyanikethan English Medium High School విద్యార్థి INSPIRE-MANAK సైన్స్ ఫెయిర్ కోసం రూపొందించారు. నేను ఇప్పటికే ఉన్న AI సాధనాలు మరియు పాఠ్యపుస్తకాల శోధనను ఉపయోగిస్తాను; కొత్తగా శిక్షణ పొందిన మోడల్‌ను కాదు.";
  if (language === "hi") return "मुझे Vignan Vidyanikethan English Medium High School के एक छात्र ने INSPIRE-MANAK विज्ञान मेले के लिए बनाया। मैं मौजूदा AI टूल और पाठ्यपुस्तक खोज का उपयोग करता हूँ; मैं नया प्रशिक्षित मॉडल नहीं हूँ।";
  return CREATOR_ANSWER;
}

/** Handle a few everyday conversational turns locally instead of searching them. */
export function conversationReply(query = "", language = "en") {
  const text = String(query).toLowerCase().trim().replace(/[!.?।]+$/g, "").trim();
  if (/^(?:hi+|hello+|hey+|good morning|good afternoon|good evening|नमस्ते|नमस्कार|हैलो|హాయ్|హలో|నమస్కారం)$/u.test(text)) {
    if (language === "te") return "నమస్కారం! మీ పుస్తకాల గురించి అడగండి, పబ్లిక్ లింక్ ఇవ్వండి లేదా క్విజ్ అడగండి.";
    if (language === "hi") return "नमस्ते! अपनी किताबों के बारे में पूछें, सार्वजनिक लिंक दें या क्विज़ बनाने को कहें।";
    return "Hi! Ask me about your books, paste a public link, or ask a follow-up question. I’ll show you where the information came from.";
  }
  if (/^(?:thanks|thank you|thank you so much|thank u|thx|धन्यवाद|शुक्रिया|ధన్యవాదాలు)$/u.test(text)) {
    if (language === "te") return "సంతోషం! సిద్ధమైనప్పుడు మరో ప్రశ్న అడగండి.";
    if (language === "hi") return "खुशी हुई! तैयार हों तो अगला सवाल पूछें।";
    return "You’re welcome! Ask a follow-up whenever you’re ready.";
  }
  if (/^(?:who are you|what are you|what is your name|what's your name|आप कौन हैं|तुम कौन हो|तुम्हारा नाम क्या है|నువ్వు ఎవరు|మీ పేరు ఏమిటి)$/u.test(text)) {
    if (language === "te") return `నేను Bolt, పుస్తకాలలో మూలాలను చూపించే స్టడీ అసిస్టెంట్‌ని. ${creatorAnswer(language)}`;
    if (language === "hi") return `मैं Bolt हूँ, किताबों के स्रोत दिखाने वाला स्टडी असिस्टेंट। ${creatorAnswer(language)}`;
    return `I’m Bolt, the built-in study assistant. I find and cite excerpts; optional connected AI models can provide fuller explanations. ${CREATOR_ANSWER}`;
  }
  return "";
}

/** Recognise questions about this assistant, not unrelated inventors in a book. */
export function asksAboutCreator(query = "") {
  const text = String(query).toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
  const target = "(?:you|yourself|bolt|vignan(?:\\s+vidyanikethan)?\\s+ai|(?:this|the|your)\\s+(?:ai|assistant|bot|app|website|site|project))";
  const verb = "(?:made|make|created|create|built|build|developed|develop|designed|design|invented|invent|programmed|wrote)";
  const noun = "(?:creator|creators|developer|developers|maker|makers|author|origin)";
  const related = new RegExp(`\\b(?:${verb}\\s+${target}|${target}\\s+(?:(?:was|were|is|are|being)\\s+)?${verb}|your\\s+${noun}|${noun}\\s+(?:of|behind|for)\\s+${target})\\b`);
  const asking = /\b(?:who|whose|which|did|was|is|what|tell|where)\b|\?$/.test(text);
  const hindi = /(?:तुम्हें|तुमको|आपको|तुम्हारा|आपका|इस एआई|इस ऐप|बोल्ट)/u.test(text) && /(?:किसने|कौन|किसका)/u.test(text) && /(?:बनाया|बनाई|निर्माता|निर्माण|विकसित)/u.test(text);
  const telugu = /(?:నిన్ను|మిమ్మల్ని|మీ|నువ్వు|ఈ ఏఐ|ఈ యాప్|బోల్ట్)/u.test(text) && /(?:ఎవరు|ఎవరి)/u.test(text) && /(?:తయారు|చేశారు|రూపొందించారు|సృష్టికర్త|సృష్టించారు)/u.test(text);
  return (related.test(text) && asking) || hindi || telugu;
}

/** Safety takes precedence over study search and the casual-chat limit. */
export function safetyReply(query = "", language = "en") {
  const text = String(query).toLowerCase();
  const urgent = /\b(?:suicid(?:e|al)|kill myself|end my life|want to die|hurt myself|self[ -]?harm|someone (?:is )?(?:hurting|abusing) me|being abused|not safe at home)\b|(?:आत्महत्या|खुद को मार|मरना चाहता|मरना चाहती|खुद को नुकसान|मेरे साथ दुर्व्यवहार)|(?:ఆత్మహత్య|నన్ను నేను చంపు|చనిపోవాలనుకుంటున్న|నన్ను కొడుతున్నారు)/u.test(text);
  if (!urgent) return "";
  if (language === "te") return "మీరు ఇలా అనుభవిస్తున్నందుకు బాధగా ఉంది. మీరు ఒంటరిగా దీన్ని ఎదుర్కోవాల్సిన అవసరం లేదు. వెంటనే నమ్మకమైన పెద్దవారికి, ఉపాధ్యాయుడికి లేదా కుటుంబ సభ్యుడికి చెప్పండి. తక్షణ ప్రమాదం ఉంటే స్థానిక అత్యవసర సేవలకు కాల్ చేయండి లేదా సురక్షితమైన చోటికి వెళ్లండి. నేను అత్యవసర సహాయానికి ప్రత్యామ్నాయం కాదు.";
  if (language === "hi") return "मुझे दुख है कि आप ऐसा महसूस कर रहे हैं। आपको इसका सामना अकेले नहीं करना है। अभी किसी भरोसेमंद वयस्क, शिक्षक या परिवार के सदस्य को बताइए। तुरंत खतरा हो तो स्थानीय आपातकालीन सेवाओं को कॉल करें या सुरक्षित जगह जाएँ। मैं आपातकालीन सहायता का विकल्प नहीं हूँ।";
  return "I’m sorry you’re dealing with this. You don’t have to face it alone. Please tell a trusted adult, teacher or family member now. If you may be in immediate danger, call local emergency services or move to a safe place. I’m not a substitute for emergency support.";
}

/** Count consecutive friendly turns; study answers reset the small break. */
export function consecutiveCasualTurns(history = []) {
  let count = 0;
  for (const message of history.slice(-16).reverse()) {
    if (message?.role !== "assistant") continue;
    if (message.meta === "Bolt · casual") count += 1;
    else if (message.meta === "Bolt · conversation" || message.meta === "About Vignan AI") continue;
    else break;
  }
  return count;
}

/** A few supportive templates, not an unrestricted generative chatbot. */
export function casualReply(query = "", language = "en", turns = 0) {
  const text = String(query).toLowerCase().trim();
  const kind = /\b(?:joke|make me laugh)\b|चुटकुला|मजाक|జోక్/u.test(text) ? "joke"
    : /\b(?:sad|lonely|bored|stressed|overwhelmed|tired|worried|anxious|depressed|depression|afraid|scared|bullied|bullying|panic)\b|(?:उदास|परेशान|थक गया|थक गई|चिंता|डर|धमका)|(?:బాధగా|ఒంటరిగా|బోర్|ఆందోళన|అలసిపోయా|భయంగా|వేధిస్తున్నారు)/u.test(text) ? "mood"
    : /\b(?:how are you|how's it going|how was your day|let'?s chat|talk to me|be my friend|your friend|what do you like|i (?:really )?(?:like|love|enjoy|play)|my favou?rite|talk about (?:music|movies|games|sports|cricket|football|hobbies))\b|(?:कैसे हो|बात करो|दोस्त बन|मुझे पसंद|मेरा पसंदीदा)|(?:ఎలా ఉన్నావు|మాట్లాడు|నా స్నేహితుడు|నాకు ఇష్టం)/u.test(text) ? "chat" : "";
  if (!kind) return "";
  if (kind === "mood") {
    if (language === "te") return "అలా అనిపించడం కష్టంగా ఉండవచ్చు. కాసేపు విరామం తీసుకోండి; నమ్మకమైన వ్యక్తితో మాట్లాడడం కూడా సహాయపడవచ్చు. సిద్ధమైనప్పుడు ఒక చిన్న స్టడీ లక్ష్యం ఎంచుకుందాం.";
    if (language === "hi") return "ऐसा महसूस करना मुश्किल हो सकता है। थोड़ा विराम लें; किसी भरोसेमंद व्यक्ति से बात करना भी मदद कर सकता है। तैयार हों तो पढ़ाई का छोटा लक्ष्य चुनें।";
    return "That sounds difficult. A short break may help, and you can talk to someone you trust. When you’re ready, we can pick one small study goal together.";
  }
  if (turns >= 3) {
    if (language === "te") return "చిన్న విరామం బాగుంది! ఇప్పుడు చదువుపై దృష్టి పెడదాం: ఒక అధ్యాయం చెప్పండి లేదా క్విజ్ అడగండి.";
    if (language === "hi") return "छोटा ब्रेक अच्छा रहा! अब पढ़ाई पर लौटें: कोई अध्याय बताएँ या क्विज़ माँगें।";
    return "That was a nice little break. Let’s return to studying: name a chapter or ask me for a quiz.";
  }
  if (kind === "joke") {
    if (language === "te") return "ఒక చిన్న నవ్వు: గణిత పుస్తకం ఎందుకు బాధపడింది? దానికి చాలా సమస్యలు ఉన్నాయి! సిద్ధమైనప్పుడు చదువుకి తిరిగి వెళ్దాం.";
    if (language === "hi") return "एक छोटा मज़ाक: गणित की किताब परेशान क्यों थी? उसके पास बहुत सारी समस्याएँ थीं! तैयार हों तो पढ़ाई पर लौटें।";
    return "A little joke: Why was the maths book worried? It had too many problems! When you’re ready, we can return to your studies.";
  }
  if (language === "te") return "మాట్లాడటం బాగుంది! నేను Bolt అనే స్టడీ అసిస్టెంట్‌ని. చిన్న విరామం తర్వాత మీకు నచ్చిన అంశంతో చదువు కొనసాగిద్దాం.";
  if (language === "hi") return "आपसे बात करके अच्छा लगा! मैं Bolt, एक स्टडी असिस्टेंट हूँ। छोटे ब्रेक के बाद अपने पसंद के विषय से पढ़ाई जारी रखें।";
  return "It’s nice to chat! I’m Bolt, a study assistant. We can take a short break and then get back to a topic you want to learn.";
}

/** Only carry a previous topic forward for an actual reference or vague follow-up. */
export function isFollowUp(query = "") {
  const text = String(query).trim().toLowerCase();
  if (!text || /https?:\/\//i.test(text)) return false;
  return /\b(?:it|its|itself|this|that|these|those|they|them|their|theirs|he|him|his|she|her|hers)\b/.test(text)
    || /(?:^|\s)(?:इस|इसे|इसके|इसका|उस|उसे|उसके|उसी)(?=\s|$)/u.test(text)
    || /(?:దీని|దాని|దీనిపై|దానిపై|ఈ అంశం|ఆ అంశం)/u.test(text)
    || /^(?:and\s+)?(?:why|how|when|where)\s*[?.!]*$/.test(text)
    || /^(?:tell|explain|say|show|give)\s+(?:me\s+)?(?:some\s+)?more\b/.test(text)
    || /^(?:more|continue|go on|explain again)[?.!\s]*$/.test(text);
}

/**
 * Reuse a recent student's topic, never generated assistant text or an
 * unrelated older conversation. The previous messages are bounded by count
 * and characters, and identity questions/URLs are not treated as topics.
 */
export function contextualQuery(query = "", history = []) {
  const current = String(query).trim().slice(0, 600);
  if (!isFollowUp(current)) return current;
  const recent = history.slice(-12).reverse();
  const previous = recent.find((message) => {
    if (message?.role !== "user") return false;
    const text = String(message.content || "").trim();
    return text && !isFollowUp(text) && !asksAboutCreator(text) && !conversationReply(text) && !casualReply(text) && !safetyReply(text) && !/https?:\/\//i.test(text) && tokenize(text).length;
  });
  const anchor = String(previous?.content || "").trim().slice(0, 350);
  return anchor ? `${current} ${anchor}`.slice(0, 900) : current;
}

/** Strip a pasted URL and generic reading instructions before searching a link. */
export function linkTopic(query = "") {
  return String(query)
    .replace(/https?:\/\/[^\s<>"'`]+/gi, " ")
    .replace(/\b(?:please|read|reading|open|visit|check|look|fetch|website|webpage|page|web|site|link|url|pdf|file|document|article|text|source|summari[sz]e|summary|overview|about|this|that|it|the|a|an)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Search with the topic rather than conversational filler; stay within API bounds. */
export function searchTopic(query = "") {
  const withoutUrl = String(query).replace(/https?:\/\/[^\s<>"'`]+/gi, " ");
  const cleaned = withoutUrl
    .replace(/\b(?:please|tell|explain|describe|define|show|give|me|about|what|who|where|when|why|how|does|did|is|are|was|were|can|could|would|should|the|a|an|it|its|this|that|they|their|them)\b/gi, " ")
    .replace(/[^\p{L}\p{M}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ").trim();
  return (cleaned || withoutUrl.trim()).slice(0, 300);
}
