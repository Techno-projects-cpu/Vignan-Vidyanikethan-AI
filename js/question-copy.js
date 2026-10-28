/**
 * Question scaffolding for the offline quiz and flashcard writers.
 *
 * The questions themselves always come from the student's own book text; only
 * these four short instructions are localised, so a Tamil or Japanese student
 * does not get an English "Fill in the blank" in the middle of their deck.
 * `en` is the fallback for any language a key is missing from.
 */

export const QUESTION_COPY = {
  en: { fill: "Fill in the blank", choose: "Choose the word or phrase that completes this textbook statement", whatIs: "What is “{subject}”?", complete: "Complete the sentence" },
  hi: { fill: "रिक्त स्थान भरें", choose: "वह शब्द या वाक्यांश चुनें जो इस पाठ्यपुस्तक कथन को पूरा करता है", whatIs: "“{subject}” क्या है?", complete: "वाक्य पूरा करें" },
  te: { fill: "ఖాళీని పూరించండి", choose: "ఈ పాఠ్యపుస్తక వాక్యాన్ని పూర్తి చేసే పదాన్ని ఎంచుకోండి", whatIs: "“{subject}” అంటే ఏమిటి?", complete: "వాక్యాన్ని పూర్తి చేయండి" },
  bn: { fill: "শূন্যস্থান পূরণ করুন", choose: "এই পাঠ্যবইয়ের বাক্যটি সম্পূর্ণ করে এমন শব্দ বা বাক্যাংশ বেছে নিন", whatIs: "“{subject}” কী?", complete: "বাক্যটি সম্পূর্ণ করুন" },
  mr: { fill: "रिकामी जागा भरा", choose: "ह्या पाठ्यपुस्तकातील विधान पूर्ण करणारा शब्द किंवा वाक्यांश निवडा", whatIs: "“{subject}” म्हणजे काय?", complete: "वाक्य पूर्ण करा" },
  ta: { fill: "கோடிட்ட இடத்தை நிரப்புக", choose: "இந்தப் பாடநூல் கூற்றை நிறைவு செய்யும் சொல் அல்லது தொடரைத் தேர்ந்தெடுக்கவும்", whatIs: "“{subject}” என்பது என்ன?", complete: "வாக்கியத்தை நிறைவு செய்யுங்கள்" },
  gu: { fill: "ખાલી જગ્યા ભરો", choose: "આ પાઠ્યપુસ્તકના વિધાનને પૂર્ણ કરતો શબ્દ કે શબ્દસમૂહ પસંદ કરો", whatIs: "“{subject}” શું છે?", complete: "વાક્ય પૂર્ણ કરો" },
  kn: { fill: "ಖಾಲಿ ಜಾಗ ತುಂಬಿ", choose: "ಈ ಪಠ್ಯಪುಸ್ತಕದ ಹೇಳಿಕೆಯನ್ನು ಪೂರ್ಣಗೊಳಿಸುವ ಪದ ಅಥವಾ ಪದಗುಚ್ಛವನ್ನು ಆರಿಸಿ", whatIs: "“{subject}” ಎಂದರೇನು?", complete: "ವಾಕ್ಯ ಪೂರ್ಣಗೊಳಿಸಿ" },
  ml: { fill: "ശൂന്യസ്ഥലം പൂരിപ്പിക്കുക", choose: "ഈ പാഠപുസ്തക വാക്യം പൂർത്തിയാക്കുന്ന പദമോ പദസമൂഹമോ തിരഞ്ഞെടുക്കുക", whatIs: "“{subject}” എന്നാൽ എന്ത്?", complete: "വാക്യം പൂർത്തിയാക്കുക" },
  pa: { fill: "ਖਾਲੀ ਥਾਂ ਭਰੋ", choose: "ਇਸ ਪਾਠ-ਪੁਸਤਕ ਦੇ ਵਾਕ ਨੂੰ ਪੂਰਾ ਕਰਨ ਵਾਲਾ ਸ਼ਬਦ ਜਾਂ ਵਾਕੰਸ਼ ਚੁਣੋ", whatIs: "“{subject}” ਕੀ ਹੈ?", complete: "ਵਾਕ ਪੂਰਾ ਕਰੋ" },
  or: { fill: "ଖାଲି ସ୍ଥାନ ପୂରଣ କରନ୍ତୁ", choose: "ଏହି ପାଠ୍ୟପୁସ୍ତକ ବାକ୍ୟ ପୂରଣ କରୁଥିବା ଶବ୍ଦ କିମ୍ବା ବାକ୍ୟାଂଶ ବାଛନ୍ତୁ", whatIs: "“{subject}” କ'ଣ?", complete: "ବାକ୍ୟ ପୂରଣ କରନ୍ତୁ" },
  as: { fill: "খালী ঠাই পূৰণ কৰক", choose: "এই পাঠ্যপুথিৰ বাক্যটো সম্পূৰ্ণ কৰা শব্দ বা বাক্যাংশ বাছনি কৰক", whatIs: "“{subject}” কি?", complete: "বাক্যটো সম্পূৰ্ণ কৰক" },
  ur: { fill: "خالی جگہ پُر کریں", choose: "وہ لفظ یا فقرہ چنیں جو اس درسی کتاب کے بیان کو مکمل کرے", whatIs: "“{subject}” کیا ہے؟", complete: "جملہ مکمل کریں" },
  ne: { fill: "खाली ठाउँ भर्नुहोस्", choose: "यो पाठ्यपुस्तकको वाक्य पूरा गर्ने शब्द वा वाक्यांश छान्नुहोस्", whatIs: "“{subject}” के हो?", complete: "वाक्य पूरा गर्नुहोस्" },
  ar: { fill: "أكمل الفراغ", choose: "اختر الكلمة أو العبارة التي تكمل هذه الجملة من الكتاب", whatIs: "ما هو “{subject}”؟", complete: "أكمل الجملة" },
  fa: { fill: "جای خالی را پر کن", choose: "واژه یا عبارتی را انتخاب کن که این جمله کتاب را کامل می‌کند", whatIs: "«{subject}» چیست؟", complete: "جمله را کامل کن" },
  fr: { fill: "Complétez la phrase", choose: "Choisissez le mot ou l’expression qui complète cette phrase du manuel", whatIs: "Qu’est-ce que « {subject} » ?", complete: "Complétez la phrase" },
  de: { fill: "Lücke füllen", choose: "Wähle das Wort oder die Wendung, die diesen Satz aus dem Buch vervollständigt", whatIs: "Was ist „{subject}“?", complete: "Ergänze den Satz" },
  es: { fill: "Completa el espacio", choose: "Elige la palabra o frase que completa este enunciado del libro", whatIs: "¿Qué es «{subject}»?", complete: "Completa la oración" },
  pt: { fill: "Preencha a lacuna", choose: "Escolha a palavra ou expressão que completa esta frase do livro", whatIs: "O que é “{subject}”?", complete: "Complete a frase" },
  it: { fill: "Completa lo spazio", choose: "Scegli la parola o la frase che completa questa affermazione del libro", whatIs: "Che cos’è «{subject}»?", complete: "Completa la frase" },
  nl: { fill: "Vul de lege plek in", choose: "Kies het woord of de zin die deze uitspraak uit het boek aanvult", whatIs: "Wat is ‘{subject}’?", complete: "Maak de zin af" },
  pl: { fill: "Uzupełnij lukę", choose: "Wybierz słowo lub wyrażenie, które uzupełnia to zdanie z podręcznika", whatIs: "Czym jest „{subject}”?", complete: "Uzupełnij zdanie" },
  ru: { fill: "Заполните пропуск", choose: "Выберите слово или выражение, которое завершает это предложение из учебника", whatIs: "Что такое «{subject}»?", complete: "Завершите предложение" },
  uk: { fill: "Заповніть пропуск", choose: "Виберіть слово або вираз, що завершує це речення з підручника", whatIs: "Що таке «{subject}»?", complete: "Завершіть речення" },
  tr: { fill: "Boşluğu doldur", choose: "Bu ders kitabı cümlesini tamamlayan sözcüğü veya ifadeyi seç", whatIs: "“{subject}” nedir?", complete: "Cümleyi tamamla" },
  zh: { fill: "填空", choose: "选出能补全此课本句子的词语", whatIs: "“{subject}”是什么？", complete: "补全句子" },
  ja: { fill: "空欄を埋めなさい", choose: "この教科書の文を完成させる語句を選びなさい", whatIs: "「{subject}」とは何ですか？", complete: "文を完成させなさい" },
  ko: { fill: "빈칸을 채우세요", choose: "이 교과서 문장을 완성하는 단어나 구를 고르세요", whatIs: "‘{subject}’은(는) 무엇인가요?", complete: "문장을 완성하세요" },
  id: { fill: "Isi bagian yang kosong", choose: "Pilih kata atau frasa yang melengkapi pernyataan buku ini", whatIs: "Apa itu “{subject}”?", complete: "Lengkapi kalimat" },
  vi: { fill: "Điền vào chỗ trống", choose: "Chọn từ hoặc cụm từ hoàn thành câu trong sách này", whatIs: "“{subject}” là gì?", complete: "Hoàn thành câu" },
  th: { fill: "เติมคำในช่องว่าง", choose: "เลือกคำหรือวลีที่ทำให้ประโยคจากหนังสือเรียนนี้สมบูรณ์", whatIs: "“{subject}” คืออะไร", complete: "เติมประโยคให้สมบูรณ์" },
  sw: { fill: "Jaza nafasi", choose: "Chagua neno au kifungu kinachokamilisha sentensi hii ya kitabu", whatIs: "“{subject}” ni nini?", complete: "Kamilisha sentensi" },
};

/** Safe getter with English fallback and a placeholder note for the subject. */
export function questionCopy(language = "en") {
  const chosen = QUESTION_COPY[language] || QUESTION_COPY.en;
  return { ...QUESTION_COPY.en, ...chosen };
}
