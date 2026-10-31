/** Small, bounded conversational helpers for Bolt's extractive engine. */
import { tokenize } from "./text.js?v=40";
import { LOCALE_REPLIES } from "./replies.js?v=40";

export const CREATOR_ANSWER = "I was made by a student of Vignan Vidyanikethan English Medium High School for the INSPIRE-MANAK science fair. I use existing AI tools and textbook search; I am not a newly trained model.";

/** The localised line for a short conversational reply, or "" if missing. */
function localised(language, key) {
  const entry = LOCALE_REPLIES[language];
  return entry?.[key] ? entry : null;
}

export function creatorAnswer(language = "en") {
  if (language === "te") return "నన్ను Vignan Vidyanikethan English Medium High School విద్యార్థి INSPIRE-MANAK సైన్స్ ఫెయిర్ కోసం రూపొందించారు. నేను ఇప్పటికే ఉన్న AI సాధనాలు మరియు పాఠ్యపుస్తకాల శోధనను ఉపయోగిస్తాను; కొత్తగా శిక్షణ పొందిన మోడల్‌ను కాదు.";
  if (language === "hi") return "मुझे Vignan Vidyanikethan English Medium High School के एक छात्र ने INSPIRE-MANAK विज्ञान मेले के लिए बनाया। मैं मौजूदा AI टूल और पाठ्यपुस्तक खोज का उपयोग करता हूँ; मैं नया प्रशिक्षित मॉडल नहीं हूँ।";
  return CREATOR_ANSWER;
}

/** Handle a few everyday conversational turns locally instead of searching them. */
export function conversationReply(query = "", language = "en") {
  const text = String(query).toLowerCase().trim().replace(/[!.?।]+$/g, "").trim();
  const greetingPattern = /^(?:hi+|hello+|hey+|good morning|good afternoon|good evening|नमस्ते|नमस्कार|हैलो|హాయ్|హలో|నమస్కారం|নমস্কার|নমস্কাৰ|ਸਤ ਸ੍ਰੀ ਅਕਾਲ|നമസ്കാരം|ನಮಸ್ಕಾರ|નમસ્તે|வணக்கம்|ନମସ୍କାର|नमस्ते|سلام|مرحبًا|مرحبا|bonjour|salut|hallo|hola|olá|ciao|hoi|cześć|привет|привіт|merhaba|你好|こんにちは|안녕하세요|halo|chào|สวัสดี|habari)$/iu;
  if (greetingPattern.test(text)) {
    const entry = localised(language, "greeting");
    if (entry) return entry.greeting;
  }
  const thanksPattern = /^(?:thanks|thank you|thank you so much|thank u|thx|धन्यवाद|शुक्रिया|ధన్యవాదాలు|ধন্যবাদ|ধন্যবাদ|ਸ਼ੁਕਰੀਆ|നന്ദി|ಧನ್ಯವಾದ|આભાર|நன்றி|ଧନ୍ୟବାଦ|شکریہ|شكرا|merci|danke|gracias|obrigado|obrigada|grazie|bedankt|dziękuję|спасибо|дякую|teşekkürler|谢谢|ありがとう|감사합니다|terima kasih|cảm ơn|ขอบคุณ|asante)$/iu;
  if (thanksPattern.test(text)) {
    const entry = localised(language, "thanks");
    if (entry) return entry.thanks;
  }
  if (/^(?:who are you|what are you|what is your name|what's your name|आप कौन हैं|तुम कौन हो|तुम्हारा नाम क्या है|నువ్వు ఎవరు|మీ పేరు ఏమిటి)$/u.test(text)) {
    const entry = localised(language, "identity");
    if (entry) return `${entry.identity} ${creatorAnswer(language)}`;
  }
  return "";
}

/** Short "let's get back to studying" lines, used after a friendly break. */
const BACK_TO_STUDY = {
  en: "That was a nice little break. Let’s return to studying: name a chapter or ask me for a quiz.",
  hi: "छोटा ब्रेक अच्छा रहा! अब पढ़ाई पर लौटें: कोई अध्याय बताएँ या क्विज़ माँगें।",
  te: "చిన్న విరామం బాగుంది! ఇప్పుడు చదువుపై దృష్టి పెడదాం: ఒక అధ్యాయం చెప్పండి లేదా క్విజ్ అడగండి.",
  bn: "ছোট্ট বিরতি ভালো হলো! এবার পড়ায় ফিরি: একটি অধ্যায় বলো বা কুইজ চাও।",
  mr: "छोटा विरंगुळा झाला! आता अभ्यासाकडे परतू: एखादा धडा सांग किंवा क्विझ माग.",
  ta: "சிறிய இடைவேளை நன்றாக இருந்தது! இப்போது படிப்புக்குத் திரும்புவோம்: ஒரு பாடத்தைச் சொல்லுங்கள் அல்லது வினாடி வினா கேளுங்கள்.",
  gu: "થોડો વિરામ સરસ રહ્યો! હવે ભણવા પર પાછા ફરીએ: કોઈ પ્રકરણ કહો અથવા ક્વિઝ માગો.",
  kn: "ಸಣ್ಣ ವಿರಾಮ ಚೆನ್ನಾಗಿತ್ತು! ಈಗ ಓದಿಗೆ ಹಿಂತಿರುಗೋಣ: ಒಂದು ಪಾಠ ಹೇಳಿ ಅಥವಾ ರಸಪ್ರಶ್ನೆ ಕೇಳಿ.",
  ml: "ചെറിയ വിശ്രമം നന്നായി! ഇനി പഠനത്തിലേക്ക് മടങ്ങാം: ഒരു പാഠം പറയൂ അല്ലെങ്കിൽ ക്വിസ് ആവശ്യപ്പെടൂ.",
  pa: "ਥੋੜ੍ਹਾ ਵਿਰਾਮ ਚੰਗਾ ਰਿਹਾ! ਹੁਣ ਪੜ੍ਹਾਈ ਵੱਲ ਮੁੜੀਏ: ਕੋਈ ਅਧਿਆਇ ਦੱਸੋ ਜਾਂ ਕੁਇਜ਼ ਮੰਗੋ।",
  or: "ଛୋଟ ବିରତି ଭଲ ରହିଲା! ଏବେ ପାଠ ଆଡ଼କୁ ଫେରିବା: ଏକ ଅଧ୍ୟାୟ କୁହନ୍ତୁ କିମ୍ବା କୁଇଜ୍ ମାଗନ୍ତୁ।",
  as: "সৰু জিৰণি ভাল লাগিল! এতিয়া পঢ়াত ঘূৰি যাওঁ: এটা অধ্যায় কোৱা বা কুইজ বিচৰা।",
  ur: "چھوٹا وقفہ اچھا رہا! اب پڑھائی کی طرف لوٹیں: کوئی باب بتائیں یا کوئز مانگیں۔",
  ne: "सानो विश्राम राम्रो भयो! अब पढाइमा फर्कौं: एउटा पाठ भन्नुहोस् वा क्विज माग्नुहोस्।",
  ar: "كان الاستراحة القصيرة جيدة! لنعد إلى الدراسة: اذكر فصلًا أو اطلب اختبارًا.",
  fa: "استراحت کوتاه خوب بود! برگردیم به درس: یک فصل بگو یا آزمون بخواه.",
  fr: "Cette petite pause était agréable ! Revenons au travail : nommez un chapitre ou demandez un quiz.",
  de: "Die kleine Pause war schön! Zurück zum Lernen: Nenne ein Kapitel oder verlange ein Quiz.",
  es: "¡Ese descanso corto estuvo bien! Volvamos al estudio: nombra un capítulo o pide un cuestionario.",
  pt: "Essa pausa curta foi boa! Voltemos aos estudos: diga um capítulo ou peça um questionário.",
  it: "È stata una bella pausa! Torniamo allo studio: indica un capitolo o chiedi un quiz.",
  nl: "Dat was een leuke korte pauze! Terug naar studeren: noem een hoofdstuk of vraag een quiz.",
  pl: "Miła krótka przerwa! Wracajmy do nauki: podaj rozdział albo poproś o quiz.",
  ru: "Хороший был перерыв! Возвращаемся к учёбе: назовите главу или попросите тест.",
  uk: "Гарна була перерва! Повертаємося до навчання: назвіть розділ або попросіть тест.",
  tr: "Güzel bir kısa mola oldu! Derse dönelim: bir bölüm söyle ya da test iste.",
  zh: "短暂休息不错！回到学习吧：说出一个章节，或让我出题。",
  ja: "いい息抜きでした！勉強に戻りましょう：章を指定するか、クイズを頼んでください。",
  ko: "짧은 휴식이 좋았어요! 다시 공부로 돌아가요: 단원을 말하거나 퀴즈를 요청하세요.",
  id: "Istirahat singkatnya menyenangkan! Kembali belajar: sebutkan bab atau minta kuis.",
  vi: "Nghỉ một chút thật dễ chịu! Quay lại học nhé: nêu một chương hoặc yêu cầu trắc nghiệm.",
  th: "พักสั้น ๆ ดีนะ! กลับมาเรียนกันต่อ: บอกบทเรียนหรือขอแบบทดสอบ",
  sw: "Mapumziko hayo mafupi yalifurahisha! Turudi kusoma: taja sura au omba jaribio.",
};

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
  return localised(language, "safety")?.safety
    || "I’m sorry you’re dealing with this. You don’t have to face it alone. Please tell a trusted adult, teacher or family member now. If you may be in immediate danger, call local emergency services or move to a safe place. I’m not a substitute for emergency support.";
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
    return localised(language, "mood")?.mood
      || "That sounds difficult. A short break may help, and you can talk to someone you trust. When you’re ready, we can pick one small study goal together.";
  }
  if (turns >= 3) {
    return localised(language, "identity")?.identity
      ? `${localised(language, "identity").identity} — ${BACK_TO_STUDY[language] || "That was a nice little break. Let’s return to studying: name a chapter or ask me for a quiz."}`
      : "That was a nice little break. Let’s return to studying: name a chapter or ask me for a quiz.";
  }
  if (kind === "joke") {
    // A pun does not translate well; the English joke is followed by a
    // localised invitation to get back to studying.
    const joke = "A little joke: why was the maths book worried? It had too many problems!";
    return `${joke} — ${BACK_TO_STUDY[language] || "When you’re ready, we can return to your studies."}`;
  }
  const entry = localised(language, "identity");
  return entry
    ? `${entry.identity} — ${BACK_TO_STUDY[language] || "We can take a short break and then get back to a topic you want to learn."}`
    : "It’s nice to chat! I’m Bolt, a study assistant. We can take a short break and then get back to a topic you want to learn.";
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
