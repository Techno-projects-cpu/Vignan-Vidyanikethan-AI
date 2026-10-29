/**
 * The language catalogue for Vignan Vidyanikethan AI.
 *
 * Every entry is a language the interface can switch to. `code` is the BCP-47
 * primary tag used for the interface, the connected-model instruction and the
 * Wikipedia edition used by the web fallback. English strings always remain a
 * safety net: any key a language has not translated yet falls back to English.
 */

export const LANGUAGE_CATALOGUE = [
  { code: "en", name: "English", native: "English", group: "indian" },
  { code: "hi", name: "Hindi", native: "हिन्दी", group: "indian" },
  { code: "bn", name: "Bengali", native: "বাংলা", group: "indian" },
  { code: "mr", name: "Marathi", native: "मराठी", group: "indian" },
  { code: "te", name: "Telugu", native: "తెలుగు", group: "indian" },
  { code: "ta", name: "Tamil", native: "தமிழ்", group: "indian" },
  { code: "gu", name: "Gujarati", native: "ગુજરાતી", group: "indian" },
  { code: "kn", name: "Kannada", native: "ಕನ್ನಡ", group: "indian" },
  { code: "ml", name: "Malayalam", native: "മലയാളം", group: "indian" },
  { code: "pa", name: "Punjabi", native: "ਪੰਜਾਬੀ", group: "indian" },
  { code: "or", name: "Odia", native: "ଓଡ଼ିଆ", group: "indian" },
  { code: "as", name: "Assamese", native: "অসমীয়া", group: "indian" },
  { code: "ur", name: "Urdu", native: "اردو", group: "indian", dir: "rtl" },
  { code: "ne", name: "Nepali", native: "नेपाली", group: "indian" },
  { code: "ar", name: "Arabic", native: "العربية", group: "world", dir: "rtl" },
  { code: "fa", name: "Persian", native: "فارسی", group: "world", dir: "rtl" },
  { code: "fr", name: "French", native: "Français", group: "world" },
  { code: "de", name: "German", native: "Deutsch", group: "world" },
  { code: "es", name: "Spanish", native: "Español", group: "world" },
  { code: "pt", name: "Portuguese", native: "Português", group: "world" },
  { code: "it", name: "Italian", native: "Italiano", group: "world" },
  { code: "nl", name: "Dutch", native: "Nederlands", group: "world" },
  { code: "pl", name: "Polish", native: "Polski", group: "world" },
  { code: "ru", name: "Russian", native: "Русский", group: "world" },
  { code: "uk", name: "Ukrainian", native: "Українська", group: "world" },
  { code: "tr", name: "Turkish", native: "Türkçe", group: "world" },
  { code: "zh", name: "Chinese", native: "中文", group: "world" },
  { code: "ja", name: "Japanese", native: "日本語", group: "world" },
  { code: "ko", name: "Korean", native: "한국어", group: "world" },
  { code: "id", name: "Indonesian", native: "Bahasa Indonesia", group: "world" },
  { code: "vi", name: "Vietnamese", native: "Tiếng Việt", group: "world" },
  { code: "th", name: "Thai", native: "ไทย", group: "world" },
  { code: "sw", name: "Swahili", native: "Kiswahili", group: "world" },
];

export const LANGUAGE_CODES = LANGUAGE_CATALOGUE.map((language) => language.code);
export const LANGUAGE_BY_CODE = Object.fromEntries(LANGUAGE_CATALOGUE.map((language) => [language.code, language]));

export function languageMeta(code) {
  return LANGUAGE_BY_CODE[code] || LANGUAGE_BY_CODE.en;
}

export function isRtlLanguage(code) {
  return languageMeta(code).dir === "rtl";
}

/**
 * Native name first, then the English name. Both runs are wrapped in Unicode
 * isolates so an RTL option ("اردو — Urdu") keeps the intended order instead of
 * having the Latin half jump to the wrong side.
 */
export function languageLabel(code) {
  const meta = languageMeta(code);
  if (!meta.native || meta.native === meta.name) return meta.name;
  return meta.dir === "rtl" ? `\u2068${meta.native}\u2069 — ${meta.name}` : `${meta.native} — ${meta.name}`;
}

/** Grouped <optgroup> data for the language picker. */
export function languageGroups() {
  return [
    {
      label: "Indian languages",
      labelKey: "settings.languageIndian",
      languages: LANGUAGE_CATALOGUE.filter((language) => language.group === "indian"),
    },
    {
      label: "World languages",
      labelKey: "settings.languageWorld",
      languages: LANGUAGE_CATALOGUE.filter((language) => language.group === "world"),
    },
  ];
}

/**
 * One character to stand for a language on a card.
 *
 * A row of names in a dropdown looks like a setting; a grid of characters looks
 * like care. We show the first real character of the language's own name —
 * ত for Bengali, ت for Telugu's neighbour Urdu, E for English — because a student
 * recognises their own script from across the screen, not the word "Telugu".
 *
 * Combining marks are skipped so the glyph is never an accent floating on its
 * own, and a language with no name still gets a visible placeholder.
 */
export function languageGlyph(native) {
  const characters = [...String(native || "").trim()];
  const letter = characters.find((character) => !/^\p{M}$/u.test(character)) || "";
  return letter ? letter.toUpperCase() : "•";
}

/** Wikipedia editions that exist for the interface languages we ship. */
export const WIKIPEDIA_LANGUAGES = new Set(LANGUAGE_CODES);

/** Map an interface language to a Wikipedia edition, falling back to English. */
export function wikipediaLanguage(code) {
  return WIKIPEDIA_LANGUAGES.has(String(code || "").toLowerCase()) ? String(code).toLowerCase() : "en";
}
