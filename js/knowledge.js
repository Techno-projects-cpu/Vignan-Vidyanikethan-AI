/**
 * Built-in knowledge for questions about this school, this project and a few
 * evergreen outside-world facts.
 *
 * This is not a textbook and not a trained model: it is a small, hand-written
 * reference that lets the assistant answer the questions a visitor asks first
 * ("what is this school?", "who made this?") without searching anywhere. Every
 * answer is labelled, and anything outside this pack still goes to the
 * clearly-marked web fallback instead of being invented.
 */

import { tokenize } from "./text.js?v=29";

const SCHOOL_EN = [
  "**Vignan Vidyanikethan English Medium High School** is an English-medium school in India. Teaching, exams and daily conversation there happen in English, with Indian languages used alongside in the classroom and at home.",
  "This assistant is a student project from that school. It was built by a student of Vignan Vidyanikethan English Medium High School for the **INSPIRE-MANAK** science fair — a Government of India programme that encourages school students to solve real problems with science and technology.",
  "The project treats the school's own books as the knowledge base. Classes 1–10 material can be added in **Library** (state-board and CBSE/NCERT books both work), and answers always point back to the page they came from.",
  "I do not hold verified details such as the school's address, phone number, fee structure, timings or admission dates. For those, ask the school office or a teacher — I will not guess them.",
];

const SCHOOL_HI = [
  "**विग्नान विद्यानिकेतन इंग्लिश मीडियम हाई स्कूल** भारत का एक अंग्रेज़ी माध्यम विद्यालय है। पढ़ाई, परीक्षा और रोज़ की बातचीत वहाँ अंग्रेज़ी में होती है, साथ ही भारतीय भाषाएँ भी कक्षा और घर में प्रयोग होती हैं।",
  "यह सहायक उसी विद्यालय के एक विद्यार्थी का प्रोजेक्ट है, जो **INSPIRE-MANAK** विज्ञान मेले के लिए बनाया गया है — यह भारत सरकार का कार्यक्रम है जो स्कूली विद्यार्थियों को विज्ञान और तकनीक से वास्तविक समस्याएँ हल करने के लिए प्रोत्साहित करता है।",
  "यह प्रोजेक्ट विद्यालय की अपनी किताबों को ज्ञान का आधार मानता है। **Library** में कक्षा 1–10 की सामग्री जोड़ी जा सकती है (राज्य बोर्ड और CBSE/NCERT दोनों चलते हैं), और हर उत्तर उसी पृष्ठ को दिखाता है जहाँ से वह आया।",
  "विद्यालय का पता, फ़ोन नंबर, फ़ीस, समय या प्रवेश तिथियाँ मेरे पास सत्यापित रूप से नहीं हैं। इनके लिए स्कूल कार्यालय या शिक्षक से पूछें — मैं अनुमान नहीं लगाऊँगा।",
];

const SCHOOL_TE = [
  "**విజ్ఞాన్ విద్యానికేతన్ ఇంగ్లీష్ మీడియం హై స్కూల్** భారతదేశంలోని ఒక ఇంగ్లీష్ మీడియం పాఠశాల. బోధన, పరీక్షలు, రోజువారీ సంభాషణ అంతా ఇంగ్లీషులోనే జరుగుతుంది; తరగతి గదిలో, ఇంట్లో భారతీయ భాషలు కూడా వాడుతారు.",
  "ఈ సహాయకుడు ఆ పాఠశాల విద్యార్థి చేసిన ప్రాజెక్ట్. **INSPIRE-MANAK** సైన్స్ ఫెయిర్ కోసం — విద్యార్థులు విజ్ఞానం, సాంకేతికతతో నిజమైన సమస్యలను పరిష్కరించేలా ప్రోత్సహించే భారత ప్రభుత్వ కార్యక్రమం.",
  "ఈ ప్రాజెక్ట్ పాఠశాల పుస్తకాలనే జ్ఞాన ఆధారంగా తీసుకుంటుంది. **Library** లో 1–10 తరగతుల పుస్తకాలు చేర్చవచ్చు (రాష్ట్ర బోర్డు, CBSE/NCERT రెండూ పనిచేస్తాయి). ప్రతి సమాధానం తీసుకున్న పేజీని చూపిస్తుంది.",
  "పాఠశాల చిరునామా, ఫోన్ నంబర్, ఫీజులు, సమయాలు, ప్రవేశ తేదీలు నా వద్ద ధృవీకరించబడిన సమాచారం లేదు. వాటి కోసం పాఠశాల కార్యాలయాన్ని లేదా ఉపాధ్యాయుడిని అడగండి — నేను ఊహించను.",
];

const PROJECT_EN = [
  "Vignan Vidyanikethan AI is an **orchestrator around existing AI**, not a newly trained model. It finds page-level passages in your own books, then either runs a real open model on your device, sends only those short passages to a free-tier AI provider, or quotes them with the built-in offline engine.",
  "Textbooks come first. Every book-based answer carries a numbered citation that opens the cited page. When the books have no match, the assistant searches outside sources and labels them **outside your textbooks · not independently verified**.",
  "It costs ₹0 to run: a local WebLLM model, the offline engine, keyless web search and free-tier keys you create yourself. No shared or leaked API keys are ever used.",
  "Privacy: books and chats stay in this browser. Search queries, links you paste and any connected AI leave the device only when you use them. Your own API keys stay in this browser, are excluded from exports and accounts, and are used only after the school's key pool.",
];

const PROJECT_HI = [
  "विग्नान विद्यानिकेतन AI **पहले से मौजूद AI का संयोजक** है, नया प्रशिक्षित मॉडल नहीं। यह आपकी किताबों में पृष्ठ-स्तर के अंश ढूँढता है, फिर या तो आपके डिवाइस पर खुला मॉडल चलाता है, या केवल वही छोटे अंश किसी मुफ़्त AI सेवा को भेजता है, या अंतर्निहित ऑफ़लाइन इंजन से उन्हें उद्धृत करता है।",
  "किताबें सबसे पहले। हर किताब-आधारित उत्तर के साथ क्रमांकित उद्धरण होता है जो उसी पृष्ठ को खोलता है। किताबों में उत्तर न मिलने पर यह बाहरी स्रोत खोजता है और उन्हें **आपकी किताबों से बाहर · स्वतंत्र रूप से सत्यापित नहीं** बताता है।",
  "खर्च ₹0 है: स्थानीय WebLLM मॉडल, ऑफ़लाइन इंजन, बिना कुंजी वाली वेब खोज और आपकी बनाई मुफ़्त कुंजियाँ। कोई साझा या लीक हुई API कुंजी कभी नहीं।",
  "गोपनीयता: किताबें और चैट इसी ब्राउज़र में रहते हैं। खोज प्रश्न, चिपकाए गए लिंक और जुड़ा AI केवल तभी बाहर जाते हैं जब आप उन्हें इस्तेमाल करें। आपकी कुंजियाँ इसी ब्राउज़र में रहती हैं और निर्यात से बाहर रहती हैं।",
];

const PROJECT_TE = [
  "విజ్ఞాన్ విద్యానికేతన్ AI **ఇప్పటికే ఉన్న AI లను సమన్వయపరిచే వ్యవస్థ**, కొత్తగా శిక్షణ పొందిన మోడల్ కాదు. ఇది మీ పుస్తకాల్లో పేజీ స్థాయి భాగాలను వెతికి, మీ పరికరంలోనే ఓపెన్ మోడల్ నడిపిస్తుంది, లేదా ఆ చిన్న భాగాలను ఉచిత AI సేవకు పంపుతుంది, లేదా ఆఫ్‌లైన్ ఇంజన్‌తో అవే వాక్యాలను ఉదహరిస్తుంది.",
  "మొదట పుస్తకాలే. పుస్తక ఆధారిత ప్రతి సమాధానంలో ఆ పేజీని తెరిచే క్రమ సంఖ్య ఉంటుంది. పుస్తకాల్లో సమాధానం లేకపోతే బయటి మూలాలను వెతికి **మీ పుస్తకాల వెలుపల · స్వతంత్రంగా ధృవీకరించబడలేదు** అని స్పష్టంగా చెబుతుంది.",
  "ఖర్చు ₹0: స్థానిక WebLLM మోడల్, ఆఫ్‌లైన్ ఇంజన్, కీ అవసరం లేని వెబ్ శోధన, మీరే సృష్టించే ఉచిత కీలు. పంచుకున్న లేదా లీక్ అయిన API కీలు ఎప్పుడూ వాడబడవు.",
  "గోప్యత: పుస్తకాలు, చాట్‌లు ఈ బ్రౌజర్‌లోనే ఉంటాయి. మీరు వాడినప్పుడే శోధన ప్రశ్నలు, లింకులు, కనెక్ట్ చేసిన AI బయటికి వెళ్తాయి. మీ కీలు ఈ బ్రౌజర్‌లోనే ఉండి ఎగుమతుల నుంచి మినహాయించబడతాయి.",
];

const HELP_EN = [
  "**Add books:** Library → upload a PDF, readable text file, public link or pasted notes. Books stay on this device and are split into page-preserving passages.",
  "**Ask:** type a question, paste a public link, or say “quiz me on photosynthesis”. Answers quote your books with [1], [2] citations you can open.",
  "**Practise:** Quiz builds custom questions from a chapter; Flashcards schedule revision; Progress tracks streaks and topic mastery.",
  "**Study together:** Friends, private Chat, the shared Study Hall and four academic mini games (chess, quiz duel, equation race, word lab).",
  "**Go further:** connect a free-tier key or download the local WebLLM model in Settings → Advanced settings for fuller explanations.",
];

const HELP_HI = [
  "**किताबें जोड़ें:** Library → PDF, पढ़ने योग्य टेक्स्ट फ़ाइल, सार्वजनिक लिंक या चिपकाए नोट्स अपलोड करें। किताबें इसी डिवाइस पर रहती हैं और पृष्ठ जैसे अंशों में बँटती हैं।",
  "**पूछें:** प्रश्न लिखें, सार्वजनिक लिंक चिपकाएँ, या “प्रकाश संश्लेषण पर क्विज़ बनाओ” कहें। उत्तर आपकी किताबों से [1], [2] उद्धरणों के साथ आते हैं।",
  "**अभ्यास:** Quiz अध्याय से प्रश्न बनाता है; Flashcards दोहराव तय करते हैं; Progress स्ट्रीक और विषय-दक्षता दिखाता है।",
  "**साथ पढ़ें:** दोस्त, निजी चैट, साझा स्टडी हॉल और चार शैक्षणिक मिनी गेम (शतरंज, क्विज़ ड्यूअल, समीकरण दौड़, शब्द लैब)।",
  "**आगे बढ़ें:** अधिक विस्तृत व्याख्या के लिए Settings → Advanced settings में मुफ़्त कुंजी जोड़ें या स्थानीय WebLLM मॉडल डाउनलोड करें।",
];

const HELP_TE = [
  "**పుస్తకాలు చేర్చండి:** Library → PDF, చదవగల టెక్స్ట్ ఫైల్, పబ్లిక్ లింక్ లేదా నోట్స్ అప్‌లోడ్ చేయండి. పుస్తకాలు ఈ పరికరంలోనే ఉంటాయి, పేజీల వారీగా విభజించబడతాయి.",
  "**అడగండి:** ప్రశ్న టైప్ చేయండి, పబ్లిక్ లింక్ ఇవ్వండి, లేదా “కిరణజన్య సంయోగక్రియపై క్విజ్ చేయి” అనండి. సమాధానాలు [1], [2] ఉదాహరణలతో మీ పుస్తకాల నుంచి వస్తాయి.",
  "**సాధన:** Quiz అధ్యాయం నుంచి ప్రశ్నలు తయారు చేస్తుంది; Flashcards పునశ్చరణను ఏర్పాటు చేస్తుంది; Progress స్ట్రీక్, అంశాల పట్టును చూపుతుంది.",
  "**కలిసి చదవండి:** స్నేహితులు, ప్రైవేట్ చాట్, ఉమ్మడి స్టడీ హాల్, నాలుగు విద్యా మినీ ఆటలు (చెస్, క్విజ్ డ్యూయల్, సమీకరణ రేస్, వర్డ్ ల్యాబ్).",
  "**మరింత:** పూర్తి వివరణల కోసం Settings → Advanced settings లో ఉచిత కీ చేర్చండి లేదా స్థానిక WebLLM మోడల్ డౌన్‌లోడ్ చేయండి.",
];

const TOPICS = [
  {
    id: "project",
    titleKey: "settings.aiTitle",
    test: (text) => /\b(?:vignan\s+ai|this (?:ai|app|assistant|site|website|project)|how does (?:it|this|the (?:ai|app)) work|what can you do|who made|creator|inspire|manak|zero\s*vast|nezaad|bolt)\b/i.test(text)
      || /(?:किसने बनाया|यह ऐप|यह एआई|ఎవరు తయారు|ఈ యాప్|ఈ ఏఐ)/u.test(text),
    bodies: { en: PROJECT_EN, hi: PROJECT_HI, te: PROJECT_TE },
  },
  {
    id: "school",
    titleKey: "knowledge.schoolTitle",
    test: (text) => /\b(?:vignan|vidyanikethan|vidya\s*nikethan|school|schools|institution|campus)\b/i.test(text)
      && !/\b(?:school\s+(?:bus|bag|uniform|fee|fees)|schools?\s+of\s+(?:thought|law|art|philosophy|medicine))\b/i.test(text),
    bodies: { en: SCHOOL_EN, hi: SCHOOL_HI, te: SCHOOL_TE },
  },
  {
    id: "help",
    titleKey: "settings.helpTitle",
    test: (text) => /\b(?:how (?:do|can) i|how to|help|guide|tutorial|get started|start using|features?|what is this|instructions?)\b/i.test(text),
    bodies: { en: HELP_EN, hi: HELP_HI, te: HELP_TE },
  },
];

/** Short, stable facts that are true for years, for offline outside-the-book questions. */
const QUICK_FACTS = [
  { keys: ["capital", "india"], match: /\bcapital (?:city )?of india\b/i, answer: "The capital of India is **New Delhi**. Parliament, the Supreme Court and the central government are there." },
  { keys: ["capital", "australia"], match: /\bcapital (?:city )?of australia\b/i, answer: "The capital of Australia is **Canberra** (not Sydney)." },
  { keys: ["capital", "usa", "united", "america"], match: /\bcapital (?:city )?of (?:the )?(?:usa|united states|america)\b/i, answer: "The capital of the United States is **Washington, D.C.**" },
  { keys: ["capital", "japan"], match: /\bcapital (?:city )?of japan\b/i, answer: "The capital of Japan is **Tokyo**." },
  { keys: ["capital", "france"], match: /\bcapital (?:city )?of france\b/i, answer: "The capital of France is **Paris**." },
  { keys: ["largest", "planet"], match: /\blargest planet\b|\bbiggest planet\b/i, answer: "**Jupiter** is the largest planet in the Solar System; Mercury is the smallest, and Earth is third from the Sun." },
  { keys: ["sun", "star"], match: /\bis the sun a (?:star|planet)\b/i, answer: "The Sun is a **star** — a medium-sized, middle-aged star made mostly of hydrogen and helium." },
  { keys: ["water", "boil", "100"], match: /\bwater boil\b|\bboiling point of water\b/i, answer: "Pure water boils at **100 °C (212 °F) at sea level**; the boiling point drops as you go higher, where air pressure is lower." },
  { keys: ["speed", "light"], match: /\bspeed of light\b/i, answer: "Light travels at about **299,792,458 metres per second** in a vacuum, roughly 3 × 10⁸ m/s." },
  { keys: ["photosynthesis", "chlorophyll"], match: /\bphotosynthesis\b/i, answer: "Photosynthesis is how green plants, algae and some bacteria turn light energy into food: carbon dioxide + water + light → glucose + oxygen, using **chlorophyll** in chloroplasts." },
  { keys: ["constitution", "india", "adopted"], match: /\bconstitution of india\b/i, answer: "The Constitution of India was adopted on **26 November 1949** and came into force on **26 January 1950**. Dr B. R. Ambedkar chaired the drafting committee." },
  { keys: ["largest", "ocean"], match: /\blargest ocean\b|\bbiggest ocean\b/i, answer: "The **Pacific Ocean** is the largest and deepest ocean; the Mariana Trench in it is the deepest known point on Earth." },
  { keys: ["longest", "river", "india"], match: /\blongest river (?:in|of) india\b/i, answer: "The **Ganga** is India's longest river, flowing about 2,525 km from the Gangotri glacier to the Bay of Bengal." },
  { keys: ["national", "bird", "india"], match: /\bnational bird of india\b/i, answer: "India's national bird is the **Indian peafowl (peacock)**, declared in 1963." },
  { keys: ["national", "animal", "india"], match: /\bnational animal of india\b/i, answer: "India's national animal is the **Bengal tiger** (since 1972); the national aquatic animal is the Ganges river dolphin." },
  { keys: ["periodic", "table", "elements"], match: /\bhow many elements\b/i, answer: "The periodic table currently lists **118 elements**, from hydrogen (1) to oganesson (118)." },
  { keys: ["dna"], match: /\bwhat is dna\b/i, answer: "DNA (deoxyribonucleic acid) is the molecule that stores genetic instructions. Its double helix has four bases — A, T, G and C — and A pairs with T, G with C." },
  { keys: ["gravity", "newton"], match: /\bwhat is gravity\b|\bwho discovered gravity\b/i, answer: "Gravity is the mutual attraction between masses. On Earth it accelerates falling objects at about **9.8 m/s²**. Isaac Newton described it in 1687; Einstein's general relativity refined it in 1915." },
  { keys: ["greenhouse", "climate"], match: /\bgreenhouse effect\b/i, answer: "The greenhouse effect is the trapping of outgoing heat by gases such as carbon dioxide, methane and water vapour. It keeps Earth warm enough for life; too much of it causes global warming." },
  { keys: ["vitamin", "c", "scurvy"], match: /\bvitamin c\b|\bscurvy\b/i, answer: "Vitamin C (ascorbic acid) is found in citrus fruits, amla and guava. A lack of it causes **scurvy** — bleeding gums, slow healing and weakness." },
];

const SOURCE_NOTE = {
  en: "Built-in study notes · not from your library",
  hi: "अंतर्निहित अध्ययन नोट्स · आपकी लाइब्रेरी से नहीं",
  te: "అంతర్నిర్మిత అధ్యయన నోట్స్ · మీ గ్రంథాలయం నుండి కాదు",
};

function pick(copy, language) {
  return copy[language] || copy.en;
}

/** Is this question about the school, the project or how to use it? */
export function knowledgeTopic(query = "") {
  const text = String(query).toLowerCase().replace(/\s+/g, " ").trim();
  if (!text || text.length > 400) return null;
  for (const topic of TOPICS) {
    if (topic.id === "help" && !tokenize(text).length) continue;
    if (topic.test(text)) return topic;
  }
  return null;
}

function factsFor(query) {
  const text = String(query).toLowerCase().replace(/\s+/g, " ").trim();
  return QUICK_FACTS.filter((fact) => fact.match.test(text));
}

function emptyAnswerBase() {
  return {
    sources: [], webSources: [], flashcards: [], grounded: false, confidence: 0,
    verification: { enabled: false },
  };
}

/**
 * Answer about the school, this project or how to use it. These topics are not
 * in any textbook, so they take precedence over library retrieval.
 */
export function knowledgeTopicAnswer(query = "", language = "en") {
  const topic = knowledgeTopic(query);
  if (!topic) return null;
  const blocks = [`**${plainTitle(topic.titleKey, language)}**`];
  blocks.push(...pick(topic.bodies, language).map((line) => `- ${line}`));
  blocks.push("", `_${verifyNote(language)}_`);
  return {
    ...emptyAnswerBase(),
    text: blocks.join("\n").trim(),
    title: plainTitle(topic.titleKey, language),
    meta: "Bolt · built-in knowledge",
    topics: [topic.id],
  };
}

/**
 * A short evergreen fact (capitals, constants, national symbols…). Used only
 * when the library and the web search produced nothing, so a textbook page
 * always wins over this pack.
 */
export function knowledgeFactAnswer(query = "", language = "en") {
  const facts = factsFor(query);
  if (!facts.length) return null;
  const blocks = [`**${SOURCE_NOTE[language] || SOURCE_NOTE.en}**`];
  facts.slice(0, 3).forEach((fact) => blocks.push(`- ${fact.answer}`));
  blocks.push("", `_${verifyNote(language)}_`);
  return {
    ...emptyAnswerBase(),
    text: blocks.join("\n").trim(),
    title: SOURCE_NOTE[language] || SOURCE_NOTE.en,
    meta: "Bolt · built-in knowledge",
    topics: facts.map((fact) => fact.keys.join("-")),
  };
}

/** Combined helper kept for callers that want either kind of built-in answer. */
export function knowledgeAnswer(query = "", language = "en") {
  const topic = knowledgeTopicAnswer(query, language);
  if (topic) return topic;
  return knowledgeFactAnswer(query, language);
}

/** Titles live in the i18n dictionary; fall back to English wording. */
function plainTitle(key, language) {
  const fallback = {
    "knowledge.schoolTitle": "About the school",
    "settings.aiTitle": "About Vignan Vidyanikethan AI",
    "settings.helpTitle": "How to use it",
  };
  return TITLES[language]?.[key] || fallback[key] || key;
}

const TITLES = {
  hi: {
    "knowledge.schoolTitle": "विद्यालय के बारे में",
    "settings.aiTitle": "विग्नान विद्यानिकेतन AI के बारे में",
    "settings.helpTitle": "इसका उपयोग कैसे करें",
  },
  te: {
    "knowledge.schoolTitle": "పాఠశాల గురించి",
    "settings.aiTitle": "విజ్ఞాన్ విద్యానికేతన్ AI గురించి",
    "settings.helpTitle": "ఇది ఎలా ఉపయోగించాలి",
  },
};

function verifyNote(language) {
  const notes = {
    en: "These are my own notes, not a textbook or a live web result. Check them against a current source or your teacher.",
    hi: "ये मेरे अपने नोट्स हैं, कोई पाठ्यपुस्तक या लाइव वेब परिणाम नहीं। किसी वर्तमान स्रोत या अपने शिक्षक से इन्हें जाँचें।",
    te: "ఇవి నా స్వంత నోట్స్, పాఠ్యపుస్తకం లేదా ప్రత్యక్ష వెబ్ ఫలితం కాదు. వాటిని ప్రస్తుత మూలం లేదా మీ ఉపాధ్యాయుడితో తనిఖీ చేయండి.",
  };
  return notes[language] || notes.en;
}

export { QUICK_FACTS, TOPICS };
