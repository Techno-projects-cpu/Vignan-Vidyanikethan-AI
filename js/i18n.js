/**
 * Interface localisation.
 *
 * English, Telugu and Hindi have the long tail of help text. Every other
 * language in `js/languages.js` ships the core strings in
 * `js/translations-core.js` (navigation, screen titles, the ask composer,
 * appearance settings and outside-source labels). Anything a language has not
 * translated yet falls back to English, so the interface is never blank.
 * Offline textbook excerpts stay in the source language — citations always
 * point at the original passage.
 */

import { CORE_STRINGS } from "./translations-core.js?v=34";
import { LANGUAGE_CATALOGUE, LANGUAGE_CODES, isRtlLanguage, languageMeta } from "./languages.js?v=34";

const LANGUAGE_KEY = "vignan-study-ai.language";

const EN = {
  "nav.ask": "Ask",
  "nav.library": "Library",
  "nav.quiz": "Quiz",
  "nav.exam": "Exams",
  "nav.flashcards": "Flashcards",
  "nav.progress": "Progress",
  "nav.settings": "Settings",
  "nav.friends": "Friends",
  "nav.chat": "Chat",
  "nav.play": "Play",
  "app.tagline": "Your books stay on this device.",
  "app.schoolSite": "Home",
  "app.offlineReady": "Offline ready",
  "app.online": "Online",
  "app.offline": "Offline",
  "app.private": "Private by default",
  "common.cancel": "Cancel",
  "common.close": "Close",
  "common.save": "Save",
  "common.delete": "Delete",
  "common.generate": "Generate",
  "common.tryAgain": "Try again",
  "common.loading": "Working…",
  "common.pages": "pages",
  "common.page": "Page",
  "common.allBooks": "All textbooks",
  "common.of": "of",
  "common.offlineQuiz": "Offline quiz writer",
  "common.source": "Source",
  "common.download": "Download",
  "common.reset": "Reset",
  "view.ask.kicker": "GROUND ANSWERS",
  "view.ask.title": "Ask your textbooks",
  "view.ask.subtitle": "Every answer points back to a page you can open.",
  "paper.title": "Make a model question paper",
  "paper.help": "Upload readable past papers above, then select the documents to analyse. Bolt assembles a practice paper from identifiable questions; it may reuse them and cannot predict an exam.",
  "paper.sources": "Documents to analyse", "paper.empty": "Upload a past paper first.", "paper.topic": "Topic (optional)", "paper.count": "Questions",
  "paper.generate": "Build paper", "paper.preview": "PRACTICE ONLY", "paper.download": "Download text", "paper.print": "Print / save PDF",
  "paper.disclaimer": "Questions may be reused from the selected material. This is not an exam prediction. No answer key is inferred; check questions and marks with a teacher.",
  "paper.selectSources": "Select at least one uploaded document first. Readable PDFs or text files work best.",
  "paper.noQuestions": "No identifiable questions were found. Upload a text-selectable past paper or paste numbered questions. Scanned images need OCR first.",
  "paper.noTopic": "No identifiable questions matching “{topic}” were found. Try another topic or select different past papers.",
  "paper.built": "Built {selected} practice questions from the selected documents.",
  "paper.builtFewer": "Built {selected} of {requested} requested questions from the selected documents.",
  "paper.stats": "{found} identifiable questions found · {duplicates} repeated · {selected} selected ({choices} with lettered options, {other} other){limited}.",
  "paper.limited": " · analysis limited for performance",
  "view.library.kicker": "YOUR LIBRARY",
  "view.library.title": "Add your class books",
  "view.library.subtitle": "PDFs, readable text, public links or pasted notes. Indexed and kept locally.",
  "view.quiz.kicker": "PRACTICE",
  "view.quiz.title": "Quiz yourself",
  "view.quiz.subtitle": "Custom questions from your chapters, graded with a revise list.",
  "view.exam.kicker": "EXAM SHAPE",
  "view.exam.title": "Practise like the real paper",
  "view.exam.subtitle": "JEE, NEET and AP EAPCET timings, marking and pace - practised on your own textbook pages.",
  "view.flashcards.kicker": "RECALL",
  "view.flashcards.title": "Flashcards",
  "view.flashcards.subtitle": "Review with spaced repetition, one card at a time.",
  "view.progress.kicker": "MOMENTUM",
  "view.progress.title": "Your progress",
  "view.progress.subtitle": "Streaks, topic mastery, squad invites and a live class leaderboard.",
  "view.friends.kicker": "CLASSMATES",
  "view.friends.title": "Friends",
  "view.friends.subtitle": "Study together, message privately and challenge each other to a duel.",
  "view.chat.kicker": "TALK IT THROUGH",
  "view.chat.title": "Chat",
  "view.chat.subtitle": "The Study Hall for everyone, and private chats with friends.",
  "view.play.kicker": "PLAY & LEARN",
  "view.play.title": "Play",
  "view.play.subtitle": "Chess, quiz duels and maths races with classmates. Every answer is checked on the school server.",
  "view.settings.kicker": "CONTROL",
  "view.settings.title": "Settings",
  "view.settings.subtitle": "Choose a local model, free keys, fallback and privacy options.",
  "settings.advanced": "Advanced settings",
  "settings.hideAdvanced": "Hide advanced",
  "mode.answer": "Answer",
  "mode.explain": "Explain",
  "mode.summarize": "Summary",
  "mode.practice": "Practice",
  "mode.flashcards": "Flashcards",
  "ask.placeholder": "Ask, paste a link, or say ‘quiz me on…’",
  "ask.inputLabel": "Ask, paste a public link, or request a quiz",
  "ask.send": "Send question",
  "ask.clear": "Clear chat",
  "ask.webFallback": "Search the web if needed",
  "ask.webOn": "On", "ask.webOff": "Off",
  "ask.webPrivacy": "Books first. If there's no match, your question goes to Wikipedia, DuckDuckGo (or your chosen search provider) and the top result pages may be read. Don't share private information.",
  "ask.answerStyle": "Answer style",
  "ask.sources": "Sources & verification",
  "ask.sourcesEmpty": "Ask a question and the cited pages will appear here.",
  "ask.suggestions": "Try asking",
  "goal.heading": "Where are you stuck?",
  "goal.lead": "Pick a sentence. You can edit it before it is sent.",
  "soon.badge": "Coming soon",
  "soon.title": "Your school's SCERT and NCERT books, built in",
  "soon.body": "These stay out until the publisher gives written permission. When that arrives they will appear here and work exactly like the pages you add yourself: searchable, cited by page, usable offline. Until then your own uploads and the starter pages do the same job.",
  "soon.button": "Waiting for publisher permission",
  "settings.languageKicker": "Language",
  "style.kicker": "Customize",
  "style.title": "Choose a look",
  "style.note": "Six styles. The same app underneath — only the surface, the type and the corners change. Saved on this device.",
  "style.hint": "The light / dark switch above only changes the Minimal and Terminal styles; the other four are designed to be read as they are.",
  "settings.languageChoose": "Choose your language",
  "settings.languageSearch": "Search languages",
  "settings.languageFilterPlaceholder": "Search 33 languages…",
  "settings.languageCount": "{count} languages",
  "settings.languageCountFiltered": "{shown} of {total}",
  "settings.languageEmpty": "No language matches that search. Clear it to see all 33.",
  "settings.languageIndian": "Indian languages",
  "settings.languageWorld": "World languages",
  "ask.openPage": "Open page",
  "ask.reader": "Read page",
  "ask.modelNote": "Connected model",
  "ask.offlineNote": "Offline answer — direct excerpts from your books.",
  "library.uploadTitle": "Upload a book",
  "library.dropzone": "Drop a PDF or text file here, or click to choose",
  "library.dropHint": "PDF or readable UTF-8/UTF-16 text · no executables, scripts or archives",
  "library.titleLabel": "Title",
  "library.subjectLabel": "Subject",
  "library.gradeLabel": "Class",
  "library.boardLabel": "Board",
  "library.addBook": "Add to library",
  "library.pasteTitle": "Or paste notes",
  "library.pastePlaceholder": "Paste a chapter here. Use [[page:1]], [[page:2]] to keep page numbers.",
  "library.addNotes": "Add notes",
  "library.yourBooks": "Books in this device",
  "library.empty": "No books yet. Add a PDF or notes you have permission to use.",
  "library.rights": "No publisher's textbook is preinstalled. The starter pages are written for this project and behave like any note you add. Telangana SCERT and NCERT books need the publisher's permission before they can be included here.",
  "library.askThis": "Ask from this book",
  "library.quizThis": "Make a quiz",
  "library.openReader": "Reader",
  "library.deleteBook": "Remove",
  "quiz.topicLabel": "Chapter or topic",
  "quiz.topicPlaceholder": "e.g. photosynthesis, forces, linear equations",
  "quiz.typeLabel": "Question type",
  "quiz.typeMcq": "Multiple choice",
  "quiz.typeFill": "Fill in the blank",
  "quiz.typeShort": "Short answer",
  "quiz.typeMix": "Mixed",
  "quiz.difficultyLabel": "Difficulty",
  "quiz.easy": "Easy",
  "quiz.medium": "Medium",
  "quiz.hard": "Hard",
  "quiz.countLabel": "Questions",
  "quiz.timed": "Timed quiz",
  "quiz.generate": "Generate quiz",
  "quiz.submit": "Submit quiz",
  "quiz.next": "Next",
  "quiz.previous": "Previous",
  "quiz.question": "Question",
  "quiz.resultsTitle": "Your result",
  "quiz.revise": "Revise these",
  "quiz.perQuestion": "Question review",
  "quiz.topicBreakdown": "Topic breakdown",
  "quiz.newQuiz": "New quiz",
  "quiz.retake": "Retake",
  "quiz.card": "Make my edit",
  "flashcards.topicLabel": "Topic",
  "flashcards.generate": "Make flashcards",
  "flashcards.flip": "Tap to flip",
  "flashcards.again": "Again",
  "flashcards.gotIt": "Got it",
  "flashcards.empty": "Generate a deck from your books to start reviewing.",
  "flashcards.due": "due now",
  "progress.streak": "Quiz streak",
  "progress.xp": "XP earned",
  "progress.quizzes": "Quizzes finished",
  "progress.accuracy": "Accuracy",
  "progress.mastery": "Topic mastery",
  "progress.leaderboard": "Leaderboard on this device",
  "progress.recent": "Recent results",
  "progress.profileName": "Your name on this device",
  "settings.aiTitle": "AI engine",
  "settings.aiHelp": "Offline is the default. A connected model is optional.",
  "settings.offline": "Offline extractive engine (private)",
  "settings.server": "Local model server (recommended)",
  "settings.custom": "OpenAI-compatible endpoint",
  "settings.ollama": "Ollama direct (advanced)",
  "settings.endpoint": "Endpoint",
  "settings.model": "Model name",
  "settings.apiKey": "API keys (stored only in this browser)",
  "settings.test": "Test connection",
  "settings.webTitle": "Web search (Wikipedia + DuckDuckGo)",
  "settings.webEnable": "Enable web search when books have no answer",
  "settings.webMode": "Search source",
  "settings.webServer": "Built-in Wikipedia + DuckDuckGo / server provider",
  "settings.webCustom": "Custom JSON endpoint",
  "settings.webEndpoint": "Endpoint with {q} placeholder",
  "settings.webToken": "Optional bearer token",
  "settings.privacyTitle": "Privacy & data",
  "settings.privacyHelp": "Books and chats are stored in this browser. Search queries, requested links, connected AIs and account features can contact outside services.",
  "settings.export": "Export data (JSON)",
  "settings.deleteAll": "Delete all local data",
  "settings.language": "Interface language",
  "settings.languageNote": "Core interface and chat commands support English, Telugu and Hindi. Offline Bolt quotes source text as written; it does not translate. Connected AI translation can be inaccurate.",
  "settings.theme": "Theme",
  "settings.themeLight": "Light",
  "settings.themeDark": "Dark",
  "settings.helpTitle": "How this works",
  "settings.helpBody": "Your books are split into page-preserving passages. A local hybrid search finds evidence; the offline engine quotes it with citations. If you connect a model, only those short passages are sent. Web results are labelled as outside your textbooks.",
  "knowledge.notFound": "I could not find this in your textbooks. I will not invent an answer.",
  "knowledge.notFoundHint": "Try different words, add the chapter in Library, or keep web search on for a clearly labelled outside answer.",
  "knowledge.webEmpty": "Web search returned nothing this time. Check your connection and try again.",
  "knowledge.outsideHelp": "I could not reach an outside source for this one. You can search it directly:",
  "knowledge.keepReading": "More sources:",
};

const TE = {
  "settings.languageKicker": "భాష",
  "settings.languageChoose": "మీ భాషను ఎంచుకోండి",
  "settings.languageSearch": "భాషల్లో వెతకండి",
  "settings.languageFilterPlaceholder": "33 భాషల్లో వెతకండి…",
  "settings.languageCount": "{count} భాషలు",
  "settings.languageCountFiltered": "{total}లో {shown}",
  "settings.languageEmpty": "ఆ వెతుకుడుకు ఏ భాషా సరిపోలలేదు. అన్నీ చూడాలంటే దాన్ని తొలగించండి.",
  "settings.languageIndian": "భారతీయ భాషలు",
  "settings.languageWorld": "ప్రపంచ భాషలు",
  "nav.ask": "అడగండి",
  "nav.library": "గ్రంథాలయం",
  "nav.quiz": "క్విజ్",
  "nav.flashcards": "ఫ్లాష్ కార్డులు",
  "nav.progress": "పురోగతి",
  "nav.settings": "సెట్టింగులు",
  "nav.friends": "స్నేహితులు",
  "nav.chat": "చాట్",
  "nav.play": "ఆటలు",
  "view.friends.title": "స్నేహితులు",
  "view.friends.subtitle": "కలిసి చదవండి, ప్రైవేట్‌గా మాట్లాడండి, ఆటల్లో పోటీ పడండి.",
  "view.chat.title": "చాట్",
  "view.chat.subtitle": "అందరికీ స్టడీ హాల్, స్నేహితులతో ప్రైవేట్ చాట్.",
  "view.play.title": "ఆటలు",
  "view.play.subtitle": "చెస్, క్విజ్ డ్యూయల్, గణిత పోటీలు — ప్రతి సమాధానం సర్వర్‌లో తనిఖీ అవుతుంది.",
  "app.tagline": "మీ పుస్తకాలు ఈ పరికరంలోనే ఉంటాయి.",
  "app.schoolSite": "హోమ్",
  "app.offlineReady": "ఆఫ్\u200cలైన్\u200cకు సిద్ధం",
  "app.online": "ఆన్\u200cలైన్",
  "app.offline": "ఆఫ్\u200cలైన్",
  "app.private": "సాధారణంగా ప్రైవేట్",
  "common.cancel": "రద్దు",
  "common.close": "మూసివేయి",
  "common.save": "భద్రపరుచు",
  "common.delete": "తొలగించు",
  "common.generate": "రూపొందించు",
  "common.tryAgain": "మళ్లీ ప్రయత్నించండి",
  "common.loading": "పని చేస్తోంది…",
  "common.pages": "పేజీలు",
  "common.page": "పేజీ",
  "common.allBooks": "అన్ని పుస్తకాలు",
  "common.of": "లో",
  "common.offlineQuiz": "ఆఫ్\u200cలైన్ క్విజ్ రచయిత",
  "common.source": "మూలం",
  "common.download": "డౌన్\u200cలోడ్",
  "common.reset": "రీసెట్",
  "view.ask.kicker": "పుస్తక ఆధారిత సమాధానాలు",
  "view.ask.title": "మీ పుస్తకాలను అడగండి",
  "view.ask.subtitle": "ప్రతి సమాధానానికీ తెరవగల పేజీ ఉంటుంది.",
  "paper.title": "మోడల్ ప్రశ్నాపత్రం తయారు చేయండి",
  "paper.help": "చదవగల పాత ప్రశ్నాపత్రాలను అప్‌లోడ్ చేసి, విశ్లేషించాల్సిన ఫైళ్లను ఎంచుకోండి. కనిపించిన ప్రశ్నలతో Bolt సాధన పత్రాన్ని రూపొందిస్తుంది; పరీక్షలో ఇవే వస్తాయని చెప్పలేము.",
  "paper.sources": "విశ్లేషించాల్సిన ఫైళ్లు", "paper.empty": "ముందుగా పాత ప్రశ్నాపత్రాన్ని అప్‌లోడ్ చేయండి.", "paper.topic": "అంశం (ఐచ్ఛికం)", "paper.count": "ప్రశ్నలు",
  "paper.generate": "ప్రశ్నాపత్రం తయారు చేయి", "paper.preview": "సాధన కోసం మాత్రమే", "paper.download": "టెక్స్ట్ డౌన్‌లోడ్", "paper.print": "ప్రింట్ / PDF గా సేవ్",
  "paper.disclaimer": "ఎంచుకున్న ఫైళ్లలోని ప్రశ్నలు తిరిగి వాడవచ్చు. ఇది పరీక్ష అంచనా కాదు. సమాధానాలు ఊహించబడవు; ప్రశ్నలు, మార్కులను ఉపాధ్యాయుడితో తనిఖీ చేయండి.",
  "paper.selectSources": "ముందుగా కనీసం ఒక ఫైల్‌ను ఎంచుకోండి. చదవగల PDF లేదా టెక్స్ట్ ఫైల్ ఉపయోగించండి.",
  "paper.noQuestions": "ప్రశ్నలు గుర్తించలేకపోయాను. టెక్స్ట్ ఎంచుకోగల పాత పత్రాన్ని అప్‌లోడ్ చేయండి లేదా నంబర్లతో ప్రశ్నలు అతికించండి. స్కాన్ చేసిన చిత్రాలకు ముందుగా OCR అవసరం.",
  "paper.noTopic": "“{topic}” కు సరిపోయే ప్రశ్నలు దొరకలేదు. వేరే అంశం లేదా పత్రం ఎంచుకోండి.",
  "paper.built": "ఎంచుకున్న పత్రాల నుండి {selected} సాధన ప్రశ్నలు తయారయ్యాయి.",
  "paper.builtFewer": "కోరిన {requested} ప్రశ్నలలో {selected} తయారయ్యాయి.",
  "paper.stats": "{found} ప్రశ్నలు గుర్తించాం · {duplicates} పునరావృతాలు · {selected} ఎంపిక ({choices} ఎంపికలతో, {other} ఇతర){limited}.",
  "paper.limited": " · పనితీరు కోసం విశ్లేషణ పరిమితం",
  "view.library.kicker": "మీ గ్రంథాలయం",
  "view.library.title": "మీ తరగతి పుస్తకాలను చేర్చండి",
  "view.library.subtitle": "PDFలు, టెక్స్ట్, పబ్లిక్ లింకులు లేదా గమనికలను ఈ పరికరంలో జోడించండి.",
  "view.quiz.kicker": "సాధన",
  "view.quiz.title": "మిమ్మల్ని మీరు పరీక్షించుకోండి",
  "view.quiz.subtitle": "మీ పాఠ్యాంశాల నుంచి ప్రశ్నలు, వెంటనే ఫలితం మరియు పునశ్చరణ జాబితా.",
  "view.flashcards.kicker": "గుర్తింపు",
  "view.flashcards.title": "ఫ్లాష్ కార్డులు",
  "view.flashcards.subtitle": "ఒక్కో కార్డుతో క్రమబద్ధంగా పునరావృతం చేయండి.",
  "view.progress.kicker": "ప్రోత్సాహం",
  "view.progress.title": "మీ పురోగతి",
  "view.progress.subtitle": "స్ట్రీక్\u200cలు, అంశాల పట్టు, స్క్వాడ్ ఆహ్వానాలు మరియు లైవ్ తరగతి లీడర్\u200cబోర్డ్.",
  "view.settings.kicker": "నియంత్రణ",
  "view.settings.title": "సెట్టింగులు",
  "view.settings.subtitle": "స్థానిక మోడల్, ఉచిత కీలు, ఫాల్\u200cబ్యాక్ మరియు గోప్యతా ఎంపికలు.",
  "settings.advanced": "అధునాతన సెట్టింగులు",
  "settings.hideAdvanced": "అధునాతనతను దాచు",
  "mode.answer": "సమాధానం",
  "mode.explain": "వివరణ",
  "mode.summarize": "సారాంశం",
  "mode.practice": "సాధన",
  "mode.flashcards": "కార్డులు",
  "ask.placeholder": "ప్రశ్న అడగండి, లింక్ ఇవ్వండి లేదా క్విజ్ అడగండి…",
  "ask.inputLabel": "ప్రశ్న అడగండి, పబ్లిక్ లింక్ ఇవ్వండి లేదా క్విజ్ అడగండి",
  "ask.send": "ప్రశ్న పంపు",
  "ask.clear": "చాట్ తొలగించు",
  "ask.webFallback": "అవసరమైతే వెబ్‌లో వెతుకు",
  "ask.webOn": "ఆన్", "ask.webOff": "ఆఫ్",
  "ask.webPrivacy": "ముందుగా పుస్తకాలను చూస్తాం. సమాధానం లేకపోతే మీ ప్రశ్న వికీపీడియా లేదా ఎంచుకున్న శోధన సేవకు వెళుతుంది. వ్యక్తిగత వివరాలు పంచుకోవద్దు.",
  "ask.answerStyle": "సమాధాన శైలి",
  "ask.sources": "మూలాలు & ధృవీకరణ",
  "ask.sourcesEmpty": "ప్రశ్న అడిగితే ఉదహరించిన పేజీలు ఇక్కడ కనిపిస్తాయి.",
  "ask.suggestions": "ఇలా అడగండి",
  "ask.openPage": "పేజీ తెరవండి",
  "ask.reader": "పేజీ చదవండి",
  "library.uploadTitle": "పుస్తకాన్ని అప్\u200cలోడ్ చేయండి",
  "library.dropzone": "PDF లేదా టెక్స్ట్ ఫైల్ ఇక్కడ వదలండి లేదా ఎంచుకోండి",
  "library.dropHint": "PDF లేదా UTF-8/UTF-16 టెక్స్ట్ · executable, script, archive ఫైళ్లు వద్దు",
  "library.titleLabel": "పేరు",
  "library.subjectLabel": "విషయం",
  "library.gradeLabel": "తరగతి",
  "library.boardLabel": "బోర్డు",
  "library.addBook": "గ్రంథాలయంలో చేర్చు",
  "library.pasteTitle": "లేదా గమనికలు అతికించండి",
  "library.pastePlaceholder": "ఇక్కడ పాఠ్యాంశం అతికించండి. పేజీల కోసం [[page:1]], [[page:2]] వాడండి.",
  "library.addNotes": "గమనికలు చేర్చు",
  "library.yourBooks": "ఈ పరికరంలోని పుస్తకాలు",
  "library.empty": "ఇంకా పుస్తకాలు లేవు. ఉపయోగించడానికి అనుమతి ఉన్న PDF లేదా నోట్స్ జోడించండి.",
  "library.rights": "ప్రచురణకర్తల పాఠ్యపుస్తకం ముందుగానే లేదు. స్టార్టర్ పేజీలు ఈ ప్రాజెక్ట్ కోసం రాసినవి, అవి మీరు జోడించే నోట్స్ లాగానే పనిచేస్తాయి. తెలంగాణ SCERT, NCERT పుస్తకాలను చేర్చడానికి ప్రచురణకర్తల అనుమతి అవసరం.",
  "quiz.topicLabel": "పాఠ్యాంశం లేదా అంశం",
  "quiz.topicPlaceholder": "ఉదా. కిరణజన్య సంయోగక్రియ, బలాలు",
  "quiz.typeLabel": "ప్రశ్న రకం",
  "quiz.difficultyLabel": "కష్ట స్థాయి",
  "quiz.easy": "సులభం",
  "quiz.medium": "మధ్యమం",
  "quiz.hard": "కష్టం",
  "quiz.countLabel": "ప్రశ్నలు",
  "quiz.timed": "సమయంతో క్విజ్",
  "quiz.generate": "క్విజ్ రూపొందించు",
  "quiz.submit": "క్విజ్ సమర్పించు",
  "quiz.next": "తదుపరి",
  "quiz.previous": "మునుపటి",
  "quiz.question": "ప్రశ్న",
  "quiz.resultsTitle": "మీ ఫలితం",
  "quiz.revise": "ఇవి పునశ్చరణ చేయండి",
  "quiz.perQuestion": "ప్రశ్నల సమీక్ష",
  "quiz.topicBreakdown": "అంశాల వివరం",
  "quiz.newQuiz": "కొత్త క్విజ్",
  "quiz.retake": "మళ్లీ రాయండి",
  "quiz.card": "నా ఎడిట్ తయారు చేయి",
  "flashcards.topicLabel": "అంశం",
  "flashcards.generate": "ఫ్లాష్ కార్డులు తయారు చేయి",
  "flashcards.flip": "తిప్పడానికి నొక్కండి",
  "flashcards.again": "మళ్లీ",
  "flashcards.gotIt": "అర్థమైంది",
  "flashcards.empty": "సమీక్ష కోసం మీ పుస్తకాల నుంచి కార్డులు తయారు చేయండి.",
  "flashcards.due": "ఇప్పుడు చేయాల్సినవి",
  "progress.streak": "క్విజ్ స్ట్రీక్",
  "progress.xp": "సంపాదించిన XP",
  "progress.quizzes": "పూర్తి చేసిన క్విజ్\u200cలు",
  "progress.accuracy": "ఖచ్చితత్వం",
  "progress.mastery": "అంశాల పట్టు",
  "progress.leaderboard": "తరగతి లీడర్\u200cబోర్డ్",
  "progress.recent": "ఇటీవలి ఫలితాలు",
  "settings.aiTitle": "AI ఇంజన్",
  "settings.aiHelp": "ఆఫ్\u200cలైన్ మోడ్ సాధారణ ఎంపిక. కనెక్టెడ్ మోడల్ ఐచ్ఛికం.",
  "settings.offline": "ఆఫ్\u200cలైన్ ఇంజన్ (ప్రైవేట్)",
  "settings.server": "స్థానిక మోడల్ సర్వర్ (సిఫార్సు)",
  "settings.custom": "OpenAI-అనుకూల ఎండ్\u200cపాయింట్",
  "settings.ollama": "Ollama ప్రత్యక్షం (అధునాతనం)",
  "settings.endpoint": "ఎండ్\u200cపాయింట్",
  "settings.model": "మోడల్ పేరు",
  "settings.apiKey": "API కీలు (ఈ బ్రౌజర్\u200cలో మాత్రమే)",
  "settings.test": "కనెక్షన్ పరీక్షించు",
  "settings.webTitle": "వెబ్ శోధన",
  "settings.webEnable": "పుస్తకాల్లో సమాధానం లేకపోతే వెబ్ శోధనను అనుమతించు",
  "settings.privacyTitle": "గోప్యత & డేటా",
  "settings.export": "డేటా ఎగుమతి (JSON)",
  "settings.deleteAll": "స్థానిక డేటా అంతా తొలగించు",
  "settings.language": "ఇంటర్\u200cఫేస్ భాష",
  "settings.languageNote": "ఇంటర్‌ఫేస్ లేబుళ్లు, చాట్ ఆదేశాలు, AI సమాధానాలు ఈ భాషను అనుసరిస్తాయి. ఆఫ్‌లైన్ Bolt మూల పాఠ్యాన్ని అనువదించదు. కనెక్ట్ చేసిన AI అనువాదంలో తప్పులు ఉండవచ్చు.",
  "settings.theme": "థీమ్",
  "settings.themeLight": "లైట్",
  "settings.themeDark": "డార్క్",
  "settings.helpTitle": "ఇది ఎలా పనిచేస్తుంది",
  "knowledge.notFound": "మీ పుస్తకాలలో దీనికి సమాధానం దొరకలేదు. నేను సమాధానాన్ని కల్పించను.",
  "knowledge.notFoundHint": "వేరే పదాలతో అడగండి, Library లో ఆ అధ్యాయాన్ని చేర్చండి, లేదా స్పష్టంగా గుర్తించిన బయటి సమాధానం కోసం వెబ్ శోధన ఆన్‌లో ఉంచండి.",
  "knowledge.webEmpty": "ఈసారి వెబ్ శోధనలో ఫలితాలు రాలేదు. కనెక్షన్‌ను తనిఖీ చేసి మళ్లీ ప్రయత్నించండి.",
  "knowledge.outsideHelp": "దీనికి బయటి మూలం అందుబాటులో లేదు. మీరే నేరుగా వెతకవచ్చు:",
  "knowledge.keepReading": "మరిన్ని మూలాలు:",
};

const HI = {
  "settings.languageKicker": "भाषा",
  "settings.languageChoose": "अपनी भाषा चुनें",
  "settings.languageSearch": "भाषाओं में खोजें",
  "settings.languageFilterPlaceholder": "33 भाषाओं में खोजें…",
  "settings.languageCount": "{count} भाषाएँ",
  "settings.languageCountFiltered": "{total} में से {shown}",
  "settings.languageEmpty": "उस खोज से कोई भाषा नहीं मिली। सभी देखने के लिए उसे मिटाएँ।",
  "settings.languageIndian": "भारतीय भाषाएँ",
  "settings.languageWorld": "विश्व भाषाएँ",
  "nav.ask": "पूछें", "nav.library": "पुस्तकालय", "nav.quiz": "क्विज़",
  "nav.flashcards": "फ़्लैशकार्ड", "nav.progress": "प्रगति", "nav.settings": "सेटिंग्स",
  "nav.friends": "दोस्त", "nav.chat": "चैट", "nav.play": "खेल",
  "view.friends.title": "दोस्त",
  "view.friends.subtitle": "साथ पढ़ें, निजी बात करें और खेल में मुकाबला करें।",
  "view.chat.title": "चैट",
  "view.chat.subtitle": "सबके लिए स्टडी हॉल और दोस्तों से निजी बातचीत।",
  "view.play.title": "खेल",
  "view.play.subtitle": "शतरंज, क्विज़ ड्यूअल और गणित की दौड़ — हर जवाब सर्वर पर जाँचा जाता है।",
  "app.tagline": "आपकी किताबें इसी उपकरण में रहती हैं।", "app.schoolSite": "मुख्य पृष्ठ",
  "app.offlineReady": "ऑफ़लाइन तैयार", "app.online": "ऑनलाइन", "app.offline": "ऑफ़लाइन", "app.private": "निजता पहले",
  "common.cancel": "रद्द करें", "common.close": "बंद करें", "common.save": "सहेजें", "common.delete": "हटाएँ",
  "common.generate": "बनाएँ", "common.tryAgain": "फिर कोशिश करें", "common.loading": "कार्य जारी है…",
  "common.pages": "पृष्ठ", "common.page": "पृष्ठ", "common.allBooks": "सभी पाठ्यपुस्तकें", "common.of": "में से",
  "common.source": "स्रोत", "common.download": "डाउनलोड", "common.reset": "रीसेट",
  "view.ask.kicker": "स्रोत सहित जवाब", "view.ask.title": "अपनी किताबों से पूछें",
  "view.ask.subtitle": "हर उत्तर में पढ़ने योग्य पृष्ठ का स्रोत है।",
  "paper.title": "मॉडल प्रश्नपत्र बनाएँ", "paper.help": "पढ़ने योग्य पुराने प्रश्नपत्र अपलोड करें और विश्लेषण के लिए फ़ाइलें चुनें। Bolt मिले हुए प्रश्नों से अभ्यास पत्र बनाता है; वह परीक्षा की भविष्यवाणी नहीं करता।",
  "paper.sources": "विश्लेषण के लिए फ़ाइलें", "paper.empty": "पहले पुराना प्रश्नपत्र अपलोड करें।", "paper.topic": "विषय (वैकल्पिक)", "paper.count": "प्रश्न", "paper.generate": "प्रश्नपत्र बनाएँ", "paper.preview": "सिर्फ अभ्यास के लिए", "paper.download": "टेक्स्ट डाउनलोड", "paper.print": "प्रिंट / PDF सहेजें",
  "paper.disclaimer": "चुनी हुई सामग्री के प्रश्न दोबारा इस्तेमाल हो सकते हैं। यह परीक्षा की भविष्यवाणी नहीं है। उत्तरमाला का अनुमान नहीं लगाया गया है; प्रश्न और अंक शिक्षक से जाँचें।",
  "paper.selectSources": "पहले कम से कम एक फ़ाइल चुनें। पढ़ने योग्य PDF या टेक्स्ट फ़ाइल इस्तेमाल करें।",
  "paper.noQuestions": "पहचाने जाने योग्य प्रश्न नहीं मिले। टेक्स्ट वाला पुराना पेपर अपलोड करें या क्रमांकित प्रश्न चिपकाएँ। स्कैन की गई छवियों के लिए पहले OCR चाहिए।",
  "paper.noTopic": "“{topic}” से मेल खाते प्रश्न नहीं मिले। कोई दूसरा विषय या पेपर चुनें।",
  "paper.built": "चुनी हुई फ़ाइलों से {selected} अभ्यास प्रश्न बनाए गए।",
  "paper.builtFewer": "माँगे गए {requested} में से {selected} प्रश्न बनाए गए।",
  "paper.stats": "{found} प्रश्न पहचाने · {duplicates} दोहराए गए · {selected} चुने गए ({choices} विकल्पों वाले, {other} अन्य){limited}।",
  "paper.limited": " · गति के लिए विश्लेषण सीमित",
  "view.library.kicker": "आपकी लाइब्रेरी", "view.library.title": "अपनी किताबें जोड़ें",
  "view.library.subtitle": "PDF, पठनीय टेक्स्ट, सार्वजनिक लिंक या नोट्स। सामग्री इसी उपकरण में रखी जाती है।",
  "view.quiz.kicker": "अभ्यास", "view.quiz.title": "खुद को परखें",
  "view.quiz.subtitle": "अपने अध्यायों से प्रश्न बनाएँ और समीक्षा करें।",
  "view.flashcards.kicker": "याद करें", "view.flashcards.title": "फ़्लैशकार्ड",
  "view.flashcards.subtitle": "एक-एक कार्ड से दोहराएँ।", "view.progress.kicker": "आगे बढ़ें",
  "view.progress.title": "आपकी प्रगति", "view.progress.subtitle": "स्ट्रीक, विषय और लीडरबोर्ड देखें।",
  "view.settings.kicker": "नियंत्रण", "view.settings.title": "सेटिंग्स",
  "view.settings.subtitle": "भाषा, गोपनीयता और AI विकल्प चुनें।",
  "settings.advanced": "उन्नत सेटिंग्स", "settings.hideAdvanced": "उन्नत विकल्प छिपाएँ",
  "mode.answer": "उत्तर", "mode.explain": "समझाएँ", "mode.summarize": "सारांश",
  "mode.practice": "अभ्यास", "mode.flashcards": "कार्ड",
  "ask.placeholder": "प्रश्न पूछें, लिंक दें या क्विज़ माँगें…", "ask.inputLabel": "प्रश्न पूछें, सार्वजनिक लिंक दें या क्विज़ माँगें", "ask.send": "प्रश्न भेजें",
  "ask.clear": "चैट साफ़ करें", "ask.webFallback": "ज़रूरत पर वेब खोजें",
  "ask.webOn": "चालू", "ask.webOff": "बंद",
  "ask.webPrivacy": "पहले किताबें देखी जाती हैं। उत्तर न मिलने पर आपका प्रश्न विकिपीडिया या चुनी हुई खोज सेवा को भेजा जाता है। निजी जानकारी साझा न करें।",
  "ask.answerStyle": "उत्तर की शैली",
  "ask.sources": "स्रोत और जाँच", "ask.sourcesEmpty": "प्रश्न पूछने पर स्रोत यहाँ दिखेंगे।",
  "ask.suggestions": "ऐसा पूछें", "ask.openPage": "पृष्ठ खोलें", "ask.reader": "पृष्ठ पढ़ें",
  "library.uploadTitle": "किताब अपलोड करें", "library.dropzone": "PDF या टेक्स्ट फ़ाइल यहाँ छोड़ें या चुनें",
  "library.dropHint": "PDF या UTF-8/UTF-16 टेक्स्ट · executable, script या archive नहीं",
  "library.titleLabel": "शीर्षक", "library.subjectLabel": "विषय", "library.gradeLabel": "कक्षा",
  "library.boardLabel": "बोर्ड", "library.addBook": "लाइब्रेरी में जोड़ें",
  "library.pasteTitle": "या नोट्स चिपकाएँ", "library.pastePlaceholder": "यहाँ नोट्स चिपकाएँ। पृष्ठों के लिए [[page:1]], [[page:2]] लिखें।",
  "library.addNotes": "नोट्स जोड़ें", "library.yourBooks": "इस उपकरण की किताबें",
  "library.empty": "अभी किताबें नहीं हैं। इस्तेमाल की अनुमति वाले PDF या नोट्स जोड़ें।",
  "library.rights": "किसी प्रकाशक की किताब पहले से नहीं है। स्टार्टर पेज इस प्रोजेक्ट के लिए लिखे गए हैं और आपके जोड़े नोट्स की तरह काम करते हैं। तेलंगाना SCERT और NCERT किताबों के लिए प्रकाशक की अनुमति आवश्यक है.",
  "quiz.topicLabel": "अध्याय या विषय", "quiz.topicPlaceholder": "जैसे प्रकाश संश्लेषण, बल",
  "quiz.typeLabel": "प्रश्न का प्रकार", "quiz.difficultyLabel": "कठिनाई", "quiz.easy": "आसान",
  "quiz.medium": "मध्यम", "quiz.hard": "कठिन", "quiz.countLabel": "प्रश्न", "quiz.timed": "समयबद्ध क्विज़",
  "quiz.generate": "क्विज़ बनाएँ", "quiz.submit": "क्विज़ जमा करें", "quiz.next": "आगे", "quiz.previous": "पीछे",
  "quiz.question": "प्रश्न", "quiz.resultsTitle": "आपका परिणाम", "quiz.revise": "इन्हें दोहराएँ",
  "quiz.perQuestion": "प्रश्न समीक्षा", "quiz.topicBreakdown": "विषय विवरण", "quiz.newQuiz": "नई क्विज़",
  "quiz.retake": "फिर से करें", "quiz.card": "मेरा वीडियो बनाएँ",
  "flashcards.topicLabel": "विषय", "flashcards.generate": "फ़्लैशकार्ड बनाएँ", "flashcards.flip": "पलटने के लिए दबाएँ",
  "flashcards.again": "फिर से", "flashcards.gotIt": "समझ गया", "flashcards.empty": "किताबों से कार्ड बनाकर दोहराएँ।", "flashcards.due": "आज की समीक्षा",
  "progress.streak": "क्विज़ स्ट्रीक", "progress.xp": "अर्जित XP", "progress.quizzes": "पूरी की गई क्विज़",
  "progress.accuracy": "सटीकता", "progress.mastery": "विषय में दक्षता", "progress.leaderboard": "कक्षा लीडरबोर्ड", "progress.recent": "हाल के परिणाम",
  "settings.aiTitle": "AI इंजन", "settings.webTitle": "वेब खोज", "settings.webEnable": "किताबों में उत्तर न मिले तो वेब खोजें",
  "settings.privacyTitle": "निजता और डेटा", "settings.export": "डेटा निर्यात (JSON)", "settings.deleteAll": "स्थानीय डेटा हटाएँ",
  "settings.language": "इंटरफ़ेस भाषा", "settings.theme": "थीम", "settings.themeLight": "हल्का", "settings.themeDark": "गहरा",
  "settings.languageNote": "इंटरफ़ेस लेबल, चैट आदेश और AI उत्तर इस भाषा का अनुसरण करते हैं। ऑफ़लाइन Bolt मूल स्रोत का अनुवाद नहीं करता। जुड़े AI का अनुवाद गलत हो सकता है।",
  "settings.helpTitle": "यह कैसे काम करता है",
  "knowledge.notFound": "मुझे यह आपकी किताबों में नहीं मिला। मैं उत्तर बनाकर नहीं बताऊँगा।",
  "knowledge.notFoundHint": "दूसरे शब्दों में पूछें, Library में अध्याय जोड़ें, या स्पष्ट रूप से चिह्नित बाहरी उत्तर के लिए वेब खोज चालू रखें।",
  "knowledge.webEmpty": "इस बार वेब खोज से कुछ नहीं मिला। कनेक्शन जाँचकर फिर कोशिश करें।",
  "knowledge.outsideHelp": "इसके लिए कोई बाहरी स्रोत नहीं मिला। आप सीधे खोज सकते हैं:",
  "knowledge.keepReading": "अधिक स्रोत:",
};

const FULL_DICTIONARIES = { en: EN, te: TE, hi: HI };

/** Every catalogue language, with its core strings merged over English. */
export const LANGUAGES = Object.fromEntries(
  LANGUAGE_CATALOGUE.map(({ code }) => {
    const core = CORE_STRINGS[code] || {};
    const full = FULL_DICTIONARIES[code] || {};
    return [code, code === "en" ? { ...core, ...full } : { ...core, ...full }];
  }),
);

export const LANGUAGE_NAMES = Object.fromEntries(
  LANGUAGE_CATALOGUE.map(({ code, native }) => [code, native]),
);

export const SUPPORTED_LANGUAGES = LANGUAGE_CODES;

let current = "en";

export function currentLanguage() {
  return current;
}

export function currentLanguageMeta() {
  return languageMeta(current);
}

/** Language names for prompts and pickers. */
export function languageName(code, { native = false } = {}) {
  const meta = languageMeta(code);
  return native ? meta.native : meta.name;
}

/** Apply `lang`/`dir` to the document element (RTL for Urdu, Arabic, Persian). */
export function applyLanguageDirection(root = globalThis.document) {
  if (!root?.documentElement) return;
  root.documentElement.lang = current;
  root.documentElement.dir = isRtlLanguage(current) ? "rtl" : "ltr";
}

export function isCurrentLanguageRtl() {
  return isRtlLanguage(current);
}

export function t(key, vars = {}) {
  const dictionary = LANGUAGES[current] || EN;
  let value = dictionary[key] ?? EN[key] ?? key;
  for (const [name, replacement] of Object.entries(vars)) {
    value = value.replaceAll(`{${name}}`, String(replacement));
  }
  return value;
}

export function applyTranslations(root = globalThis.document) {
  if (!root) return;
  root.querySelectorAll?.("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  root.querySelectorAll?.("[data-i18n-placeholder]").forEach((element) => {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  });
  root.querySelectorAll?.("[data-i18n-title]").forEach((element) => {
    element.title = t(element.dataset.i18nTitle);
  });
  root.querySelectorAll?.("[data-i18n-aria]").forEach((element) => {
    element.setAttribute("aria-label", t(element.dataset.i18nAria));
  });
}

export function setLanguage(language, { storage, root = globalThis.document } = {}) {
  current = LANGUAGES[language] ? language : "en";
  applyLanguageDirection(root);
  try {
    const target = storage === undefined ? globalThis.localStorage : storage;
    target?.setItem(LANGUAGE_KEY, current);
  } catch {
    // Ignore storage errors.
  }
  applyTranslations(root);
  return current;
}

export function initLanguage({ storage, root = globalThis.document } = {}) {
  let language = "en";
  try {
    const target = storage === undefined ? globalThis.localStorage : storage;
    language = target?.getItem(LANGUAGE_KEY) || globalThis.navigator?.language?.slice(0, 2) || "en";
  } catch {
    language = "en";
  }
  return setLanguage(language, { storage, root });
}
