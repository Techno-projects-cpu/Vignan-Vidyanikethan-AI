import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { LANGUAGES, setLanguage, t } from "../js/i18n.js";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(fileURLToPath(new URL(path, root)), "utf8");
const reader = read("js/reader.js");

/** Every key the reader asks for. If a new one is used, add it here. */
const KEYS = [
  "reader.title", "reader.prev", "reader.next", "reader.openPdf", "reader.openSource",
  "reader.find", "reader.onlyMatch", "reader.smaller", "reader.larger", "reader.page",
  "reader.section", "reader.position", "reader.foundOne", "reader.foundMany",
  "reader.holdsOne", "reader.holdsMany", "reader.noText", "reader.imported",
  "reader.approx", "reader.untitled", "reader.continueFrom", "reader.askPage",
  "reader.notesTitle", "reader.notesPlaceholder", "reader.noteSave", "reader.noteUpdate",
  "reader.noteDelete", "reader.noteHint", "reader.notesExport", "reader.notesOnBook",
  "reader.noteSaved", "reader.noteUpdated", "reader.noteDeleted", "reader.notesExported",
  "reader.noteEmpty", "source.matched", "source.noSharedWords", "source.number",
];

test("every reader key is translated in English, Telugu and Hindi", () => {
  for (const code of ["en", "te", "hi"]) {
    const dictionary = LANGUAGES[code];
    for (const key of KEYS) {
      assert.equal(typeof dictionary[key], "string", `${code} is missing ${key}`);
      assert.ok(dictionary[key].trim().length > 0, `${code}/${key} is empty`);
    }
  }
  // Telugu and Hindi must be their own words, not the English sentence copied.
  for (const key of KEYS) {
    assert.notEqual(LANGUAGES.te[key], LANGUAGES.en[key], `te/${key} is still English`);
    assert.notEqual(LANGUAGES.hi[key], LANGUAGES.en[key], `hi/${key} is still English`);
  }
});

test("a language with no translation falls back to English, never to a key name", () => {
  setLanguage("fr");
  const value = t("reader.notesTitle");
  assert.equal(value, "My note on this page");
  assert.doesNotMatch(value, /^reader\./);
  setLanguage("en");
});

test("placeholders are replaced, and no key is left half-filled", () => {
  setLanguage("en");
  assert.equal(t("reader.position", { label: "Page", page: 4, current: 4, total: 9 }), "Page 4 · 4 of 9");
  assert.equal(t("reader.foundOne", { count: 1 }), "1 page found · press Enter to open the first");
  assert.equal(t("reader.foundMany", { count: 3 }), "3 pages found · press Enter to open the first");
  assert.equal(t("reader.notesOnBook", { count: 2 }), "2 on this book");
  assert.equal(t("source.matched", { terms: "lever, moments" }), "Matched: lever, moments");
  // Keys with a variable are filled by the caller; give every variable a value
  // and none should survive into the sentence.
  const vars = { title: "Physics", page: 2, current: 2, total: 7, count: 3, label: "Page", terms: "lever", n: 1 };
  for (const code of ["en", "te", "hi"]) {
    setLanguage(code);
    for (const key of KEYS) assert.doesNotMatch(t(key, vars), /\{[a-z]+\}/, `${code}/${key} has an unfilled placeholder`);
  }
  setLanguage("en");
});

test("the reader asks i18n for its words instead of hard-coding English", () => {
  // Anything the student reads in the reader has to come through t().
  for (const key of ["reader.prev", "reader.next", "reader.find", "reader.notesTitle", "reader.askPage"]) {
    assert.ok(reader.includes(`t("${key}"`), `${key} is not used`);
  }
  assert.match(reader, /import \{ t \} from "\.\/i18n\.js\?v=\d+"/);
  assert.doesNotMatch(reader, /"Save note"|"Update note"|"Only pages with your quote"/, "no raw English is left");
});
