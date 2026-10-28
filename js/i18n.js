/**
 * Tiny UI translation layer. English is the default; Telugu is included as a
 * starting point for localisation. Textbook content is never machine-translated
 * here — citations always point at the original passage.
 */

const LANGUAGE_KEY = "vignan-study-ai.language";

const EN = {
  "nav.ask": "Ask",
  "nav.library": "Library",
  "nav.quiz": "Quiz",
  "nav.flashcards": "Flashcards",
  "nav.progress": "Progress",
  "nav.settings": "Settings",
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
  "view.library.kicker": "YOUR LIBRARY",
  "view.library.title": "Add your class books",
  "view.library.subtitle": "PDF, TXT, Markdown or pasted notes. Indexed once, kept locally.",
  "view.quiz.kicker": "PRACTICE",
  "view.quiz.title": "Quiz yourself",
  "view.quiz.subtitle": "Custom questions from your chapters, graded with a revise list.",
  "view.flashcards.kicker": "RECALL",
  "view.flashcards.title": "Flashcards",
  "view.flashcards.subtitle": "Review with spaced repetition, one card at a time.",
  "view.progress.kicker": "MOMENTUM",
  "view.progress.title": "Your progress",
  "view.progress.subtitle": "Streaks, topic mastery, squad invites and a live class leaderboard.",
  "view.settings.kicker": "CONTROL",
  "view.settings.title": "Settings",
  "view.settings.subtitle": "Choose a local model, free keys, fallback and privacy options.",
  "mode.answer": "Answer",
  "mode.explain": "Explain",
  "mode.summarize": "Summary",
  "mode.practice": "Practice",
  "mode.flashcards": "Flashcards",
  "ask.placeholder": "Ask anything from your textbooks…",
  "ask.send": "Send question",
  "ask.clear": "Clear chat",
  "ask.webFallback": "Allow web fallback",
  "ask.sources": "Sources & verification",
  "ask.sourcesEmpty": "Ask a question and the cited pages will appear here.",
  "ask.suggestions": "Try asking",
  "ask.openPage": "Open page",
  "ask.reader": "Read page",
  "ask.modelNote": "Connected model",
  "ask.offlineNote": "Offline answer — direct excerpts from your books.",
  "library.uploadTitle": "Upload a book",
  "library.dropzone": "Drop a PDF or text file here, or click to choose",
  "library.dropHint": "PDF, TXT, MD · page markers like [[page:12]] are supported in text files",
  "library.titleLabel": "Title",
  "library.subjectLabel": "Subject",
  "library.gradeLabel": "Class",
  "library.boardLabel": "Board",
  "library.addBook": "Add to library",
  "library.pasteTitle": "Or paste notes",
  "library.pastePlaceholder": "Paste a chapter here. Use [[page:1]], [[page:2]] to keep page numbers.",
  "library.addNotes": "Add notes",
  "library.demoButton": "Load demo study pack",
  "library.yourBooks": "Books in this device",
  "library.empty": "No books yet. Upload a PDF or load the demo pack to begin.",
  "library.askThis": "Ask from this book",
  "library.quizThis": "Make a quiz",
  "library.openReader": "Reader",
  "library.deleteBook": "Remove",
  "library.demoNote": "Demo study pack: original sample notes, not an official board textbook.",
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
  "quiz.card": "Edit video",
  "flashcards.topicLabel": "Topic",
  "flashcards.generate": "Make flashcards",
  "flashcards.flip": "Tap to flip",
  "flashcards.again": "Again",
  "flashcards.gotIt": "Got it",
  "flashcards.empty": "Generate a deck from your books to start reviewing.",
  "flashcards.due": "due now",
  "progress.streak": "Study streak",
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
  "settings.webTitle": "Web fallback",
  "settings.webEnable": "Enable web search when books have no answer",
  "settings.webMode": "Search source",
  "settings.webServer": "Configured server endpoint",
  "settings.webCustom": "Custom JSON endpoint",
  "settings.webEndpoint": "Endpoint with {q} placeholder",
  "settings.webToken": "Optional bearer token",
  "settings.privacyTitle": "Privacy & data",
  "settings.privacyHelp": "Books, chats and results are stored in this browser only.",
  "settings.export": "Export data (JSON)",
  "settings.deleteAll": "Delete all local data",
  "settings.language": "Interface language",
  "settings.theme": "Theme",
  "settings.themeLight": "Light",
  "settings.themeDark": "Dark",
  "settings.helpTitle": "How this works",
  "settings.helpBody": "Your books are split into page-preserving passages. A local hybrid search finds evidence; the offline engine quotes it with citations. If you connect a model, only those short passages are sent. Web results are labelled as outside your textbooks.",
};

const TE = {
  "nav.ask": "అడగండి",
  "nav.library": "గ్రంథాలయం",
  "nav.quiz": "క్విజ్",
  "nav.flashcards": "ఫ్లాష్ కార్డులు",
  "nav.progress": "పురోగతి",
  "nav.settings": "సెట్టింగులు",
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
  "view.library.kicker": "మీ గ్రంథాలయం",
  "view.library.title": "మీ తరగతి పుస్తకాలను చేర్చండి",
  "view.library.subtitle": "PDF, TXT, Markdown లేదా గమనికలు. ఒక్కసారి ఇండెక్స్, పరికరంలోనే భద్రం.",
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
  "mode.answer": "సమాధానం",
  "mode.explain": "వివరణ",
  "mode.summarize": "సారాంశం",
  "mode.practice": "సాధన",
  "mode.flashcards": "కార్డులు",
  "ask.placeholder": "మీ పుస్తకాల నుంచి ఏదైనా అడగండి…",
  "ask.send": "ప్రశ్న పంపు",
  "ask.clear": "చాట్ తొలగించు",
  "ask.webFallback": "వెబ్ ఫాల్\u200cబ్యాక్ అనుమతించు",
  "ask.sources": "మూలాలు & ధృవీకరణ",
  "ask.sourcesEmpty": "ప్రశ్న అడిగితే ఉదహరించిన పేజీలు ఇక్కడ కనిపిస్తాయి.",
  "ask.suggestions": "ఇలా అడగండి",
  "ask.openPage": "పేజీ తెరవండి",
  "ask.reader": "పేజీ చదవండి",
  "library.uploadTitle": "పుస్తకాన్ని అప్\u200cలోడ్ చేయండి",
  "library.dropzone": "PDF లేదా టెక్స్ట్ ఫైల్ ఇక్కడ వదలండి లేదా ఎంచుకోండి",
  "library.dropHint": "PDF, TXT, MD · టెక్స్ట్ ఫైళ్లలో [[page:12]] లాంటి గుర్తులు పనిచేస్తాయి",
  "library.titleLabel": "పేరు",
  "library.subjectLabel": "విషయం",
  "library.gradeLabel": "తరగతి",
  "library.boardLabel": "బోర్డు",
  "library.addBook": "గ్రంథాలయంలో చేర్చు",
  "library.pasteTitle": "లేదా గమనికలు అతికించండి",
  "library.pastePlaceholder": "ఇక్కడ పాఠ్యాంశం అతికించండి. పేజీల కోసం [[page:1]], [[page:2]] వాడండి.",
  "library.addNotes": "గమనికలు చేర్చు",
  "library.demoButton": "డెమో స్టడీ ప్యాక్ తీసుకోండి",
  "library.yourBooks": "ఈ పరికరంలోని పుస్తకాలు",
  "library.empty": "ఇంకా పుస్తకాలు లేవు. PDF అప్\u200cలోడ్ చేయండి లేదా డెమో ప్యాక్ తీసుకోండి.",
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
  "quiz.card": "ఎడిట్ వీడియో",
  "flashcards.topicLabel": "అంశం",
  "flashcards.generate": "ఫ్లాష్ కార్డులు తయారు చేయి",
  "flashcards.flip": "తిప్పడానికి నొక్కండి",
  "flashcards.again": "మళ్లీ",
  "flashcards.gotIt": "అర్థమైంది",
  "flashcards.empty": "సమీక్ష కోసం మీ పుస్తకాల నుంచి కార్డులు తయారు చేయండి.",
  "flashcards.due": "ఇప్పుడు చేయాల్సినవి",
  "progress.streak": "చదువు స్ట్రీక్",
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
  "settings.webTitle": "వెబ్ ఫాల్\u200cబ్యాక్",
  "settings.webEnable": "పుస్తకాల్లో సమాధానం లేకపోతే వెబ్ శోధనను అనుమతించు",
  "settings.privacyTitle": "గోప్యత & డేటా",
  "settings.export": "డేటా ఎగుమతి (JSON)",
  "settings.deleteAll": "స్థానిక డేటా అంతా తొలగించు",
  "settings.language": "ఇంటర్\u200cఫేస్ భాష",
  "settings.theme": "థీమ్",
  "settings.themeLight": "లైట్",
  "settings.themeDark": "డార్క్",
  "settings.helpTitle": "ఇది ఎలా పనిచేస్తుంది",
};

export const LANGUAGES = { en: EN, te: TE };
export const LANGUAGE_NAMES = { en: "English", te: "తెలుగు" };

let current = "en";

export function currentLanguage() {
  return current;
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

export function setLanguage(language, { storage = globalThis.localStorage, root = globalThis.document } = {}) {
  current = LANGUAGES[language] ? language : "en";
  if (root?.documentElement) root.documentElement.lang = current;
  try {
    storage?.setItem(LANGUAGE_KEY, current);
  } catch {
    // Ignore storage errors.
  }
  applyTranslations(root);
  return current;
}

export function initLanguage({ storage = globalThis.localStorage, root = globalThis.document } = {}) {
  let language = "en";
  try {
    language = storage?.getItem(LANGUAGE_KEY) || globalThis.navigator?.language?.slice(0, 2) || "en";
  } catch {
    language = "en";
  }
  return setLanguage(language, { storage, root });
}
