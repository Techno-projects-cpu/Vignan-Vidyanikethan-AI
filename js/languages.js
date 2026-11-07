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
 * ত for Bengali, ا for Urdu, E for English — because a student recognises their
 * own script from across the screen, not the word "Telugu".
 *
 * Combining marks are skipped so the glyph is never an accent floating on its
 * own, and a language with no name still gets a visible placeholder.
 */
export function languageGlyph(native) {
  const characters = [...String(native || "").trim()];
  const letter = characters.find((character) => !/^\p{M}$/u.test(character)) || "";
  return letter ? letter.toUpperCase() : "•";
}

/** Letters of a name, without the combining marks that cannot stand alone. */
function glyphLetters(native) {
  return [...String(native || "").trim()].filter((character) => !/^\p{M}$/u.test(character));
}

const LATIN = /^[A-Za-z]$/;

function glyphOf(letters, width) {
  const slice = letters.slice(0, Math.max(1, width)).join("");
  if (!slice) return "•";
  // Latin names are shortened to capitals; other scripts keep their own case.
  return LATIN.test(letters[0] || "") ? slice.toUpperCase() : slice;
}

/**
 * A glyph for every language that is unique on the whole board.
 *
 * The first version of this took one letter each, and four pairs collided:
 * English and Español both showed "E", Urdu and Arabic both "ا", Português and
 * Polski both "P", Türkçe and Tiếng Việt both "T". Two identical tiles side by
 * side is not a shortcut — it is a bug, because the glyph is the thing a student
 * is supposed to recognise. So the width grows only where it has to: "EN" and
 * "ES", "POR" and "POL", and everything else keeps its single character.
 *
 * A test asserts that no two languages share a glyph, so a language added later
 * cannot reintroduce the collision.
 */
export function languageGlyphs(catalogue = LANGUAGE_CATALOGUE) {
  const entries = catalogue.map((language) => ({
    code: language.code,
    letters: glyphLetters(language.native),
    width: 1,
  }));
  const keyOf = (entry) => glyphOf(entry.letters, entry.width).toLowerCase();
  // Widening one member of a collision can create another, so repeat until the
  // whole board is unique or every name is spelled out.
  for (let round = 0; round < 12; round += 1) {
    const buckets = new Map();
    for (const entry of entries) {
      const key = keyOf(entry);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(entry);
    }
    let changed = false;
    for (const group of buckets.values()) {
      if (group.length < 2) continue;
      for (const entry of group) {
        if (entry.width < entry.letters.length) {
          entry.width += 1;
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  return Object.fromEntries(entries.map((entry) => [entry.code, glyphOf(entry.letters, entry.width)]));
}

/** The unique glyph for one language, by code. */
export function languageGlyphFor(code) {
  return languageGlyphs()[languageMeta(code).code] || languageGlyph(languageMeta(code).native);
}

/**
 * Fold a search term so "francais" finds Français and "turkce" finds Türkçe.
 *
 * Students type on a phone keyboard without accents, and an accented name was
 * unfindable unless it was spelled exactly. Case and decorative marks are not
 * part of a language's identity for the purpose of a search box.
 */
export function foldLanguageSearch(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .trim();
}

/** Does a language match what was typed? Native name, English name or code. */
export function matchesLanguageQuery(code, term) {
  const needle = foldLanguageSearch(term);
  if (!needle) return true;
  const meta = languageMeta(code);
  return [meta.native, meta.name, meta.code]
    .filter(Boolean)
    .some((value) => foldLanguageSearch(value).includes(needle));
}

/** Wikipedia editions that exist for the interface languages we ship. */
export const WIKIPEDIA_LANGUAGES = new Set(LANGUAGE_CODES);

/** Map an interface language to a Wikipedia edition, falling back to English. */
export function wikipediaLanguage(code) {
  return WIKIPEDIA_LANGUAGES.has(String(code || "").toLowerCase()) ? String(code).toLowerCase() : "en";
}
