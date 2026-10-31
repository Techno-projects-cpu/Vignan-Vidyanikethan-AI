import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  LANGUAGE_CATALOGUE,
  languageGlyph,
  languageGlyphFor,
  languageGlyphs,
  languageGroups,
  matchesLanguageQuery,
} from "../js/languages.js";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(fileURLToPath(new URL(path, root)), "utf8");
const html = read("index.html");
const css = read("styles.css");
const app = read("js/app.js");
const i18n = read("js/i18n.js");

/**
 * The app's own rule, not a copy of it.
 *
 * This file used to re-implement the search so it could test "behaviour, not
 * markup" — and the copy drifted: it stayed accent-sensitive while the app
 * needed accent folding, so the defect could never fail a test.
 */
const matchesLanguage = (language, term) => matchesLanguageQuery(language.code, term);

test("the picker is a screen of tiles, not a dropdown", () => {
  assert.match(html, /id="language-grid" role="group"/);
  assert.match(html, /id="language-filter"/);
  assert.match(html, /id="language-count"/);
  assert.match(html, /data-i18n="settings.languageChoose"/);
  assert.match(i18n, /"settings.languageChoose": "Choose your language"/);
  // The select stays, for keyboards and screen readers, and stays out of sight.
  assert.match(html, /<label class="language-select-row sr-only">[\s\S]*?<select id="settings-language">/);
});

test("every language is one tile with its own script, big enough to read", () => {
  const block = css.slice(css.indexOf("/* Language selection"), css.indexOf(".soon-card {"));
  assert.match(block, /min-height: 96px/, "tiles are large targets, not chips");
  assert.match(block, /\.language-glyph \{ font-size: 31px/, "the character leads");
  assert.match(block, /border-radius: 0/, "sharp corners");
  assert.match(block, /\.language-tile\.active \{[\s\S]*?box-shadow: inset 0 0 0 1px var\(--brand\)/, "the choice is visibly held");
  assert.match(block, /\.language-tile\.active::after \{[\s\S]*?content: "✓"/, "and carries a tick");
  assert.match(block, /\.language-latin \{/, "the English name is there for anyone searching in English");
  assert.equal(languageGroups().reduce((sum, group) => sum + group.languages.length, 0), LANGUAGE_CATALOGUE.length);
});

test("searching finds a language by any of its names, and says when it found none", () => {
  const telugu = LANGUAGE_CATALOGUE.find((language) => language.code === "te");
  assert.ok(matchesLanguage(telugu, ""), "an empty search shows everything");
  assert.ok(matchesLanguage(telugu, "tel"));
  assert.ok(matchesLanguage(telugu, "తెలు"), "the native script searches too");
  assert.ok(matchesLanguage(telugu, "TE"), "case does not matter");
  assert.ok(matchesLanguage(LANGUAGE_CATALOGUE.find((l) => l.code === "ur"), "urdu"));
  assert.equal(LANGUAGE_CATALOGUE.filter((language) => matchesLanguage(language, "zzz")).length, 0);
  // Every language can be found by typing its English name.
  for (const language of LANGUAGE_CATALOGUE) {
    const found = LANGUAGE_CATALOGUE.filter((entry) => matchesLanguage(entry, language.name));
    assert.ok(found.some((entry) => entry.code === language.code), `${language.name} is findable`);
  }
  // The number in these sentences comes from the catalogue, never typed twice.
  assert.match(i18n, /"settings\.languageEmpty": "No language matches “\{term\}”\."/);
  assert.match(app, /t\("settings\.languageCountFiltered", \{ shown, total \}\)/, "the count tells you what the filter did");
  assert.match(app, /t\("settings\.languageEmpty", \{ term: languageFilterText\.trim\(\), count: total \}\)/, "and the empty state names what was typed");
  assert.match(app, /t\("settings\.languageFilterPlaceholder", \{ count: total \}\)/, "the placeholder counts the catalogue too");
  assert.doesNotMatch(i18n, /all 33\./, "no sentence hard-codes the catalogue size");
});

test("choosing a tile is the same action as choosing from the select", () => {
  assert.match(app, /tile\.addEventListener\("click", \(\) => \{[\s\S]*?select\.value = language\.code;[\s\S]*?handleLanguageChange\(\)/);
  assert.match(app, /tile\.setAttribute\("aria-pressed"/, "screen readers hear which one is chosen");
  assert.match(app, /if \(meta\.dir === "rtl"\) tile\.dir = "rtl"/, "Urdu and Arabic read the right way round");
  assert.match(app, /languageFilter\?\.addEventListener\("input", \(event\) => \{[\s\S]*?renderLanguageGrid\(\)/);
});

test("a class the markup relies on is actually defined", () => {
  // The language select is hidden with .sr-only. That class was used in the markup
  // for years of this project without ever being defined, so the "hidden" select
  // and its label were on screen. A missing utility class fails silently; this
  // test makes it fail loudly.
  assert.match(css, /\.sr-only \{/, ".sr-only must exist");
  const block = css.slice(css.indexOf(".sr-only {"), css.indexOf(".sr-only {") + 400);
  for (const rule of ["position: absolute", "width: 1px", "clip-path: inset(50%)", "white-space: nowrap"]) {
    assert.ok(block.includes(rule), `.sr-only hides with ${rule}`);
  }
  for (const used of [...html.matchAll(/class="[^"]*\bsr-only\b[^"]*"/g)].length ? ["sr-only"] : []) {
    assert.ok(css.includes(`.${used}`), `${used} is used in index.html and must be styled`);
  }
});

test("the picker speaks the student's language, not just English", async () => {
  const { LANGUAGES, setLanguage, t } = await import("../js/i18n.js");
  const keys = [
    "settings.languageKicker",
    "settings.languageChoose",
    "settings.languageSearch",
    "settings.languageFilterPlaceholder",
    "settings.languageCount",
    "settings.languageCountFiltered",
    "settings.languageEmpty",
    "settings.languageShowAll",
    "settings.languageAlready",
    "settings.languageIndian",
    "settings.languageWorld",
  ];
  for (const code of ["en", "te", "hi"]) {
    for (const key of keys) {
      assert.ok(LANGUAGES[code][key], `${code} translates ${key}`);
    }
  }
  setLanguage("te");
  assert.match(t("settings.languageCount", { count: 33 }), /33/);
  assert.equal(t("settings.languageCountFiltered", { shown: 3, total: 33 }), "33లో 3");
  assert.match(t("settings.languageEmpty", { term: "zzz" }), /zzz/);
  assert.ok(LANGUAGES.te["settings.languageShowAll"].includes("{count}"));
  assert.ok(LANGUAGES.te["settings.languageAlready"].includes("{language}"));
  setLanguage("hi");
  assert.match(t("settings.languageEmpty", { term: "zzz" }), /भाषा/);
  setLanguage("en");
  assert.equal(t("settings.languageCountFiltered", { shown: 3, total: 33 }), "3 of 33");
  setLanguage("en");
});

test("Escape clears the search, and a chosen tile stays marked", () => {
  const start = app.indexOf("const languageFilter = $");
  const bind = app.slice(start, start + 700);
  assert.match(bind, /event\.key !== "Escape"/);
  assert.match(bind, /languageFilterText = "";/);
  assert.match(app, /tile\.setAttribute\("aria-pressed", active \? "true" : "false"\)/);
  assert.match(css, /\.language-tile\[dir="rtl"\]\.active::after \{ right: auto; left: 8px; \}/, "the tick moves for right-to-left tiles");
});

test("the design check page shows both components without logging in, and stays out of the release", () => {
  const page = read("tools/design-check.html");
  assert.match(page, /Starting blocks|starting blocks/);
  assert.match(page, /Choose your language/);
  assert.match(page, /from "\.\.\/js\/goal-cards\.js"/);
  assert.match(page, /from "\.\.\/js\/languages\.js"/);
  assert.match(page, /\.\.\/styles\.css/);
  // tools/ is never precached and never served by the app server.
  const precache = JSON.parse(read("precache.json"));
  assert.equal(precache.urls.filter((url) => url.includes("tools/")).length, 0, "tooling stays out of the offline cache");
  assert.match(read("serve.mjs"), /\^\(\\\.git\|server\|supabase\|node_modules\|tools\|tests\)/, "and out of the app server's reach");
});

test("no two languages share a glyph", () => {
  // The first version took one letter each, and four pairs collided: English and
  // Español both showed "E", Urdu and Arabic both "ا", Português and Polski both
  // "P", Türkçe and Tiếng Việt both "T". Two identical tiles is not a shortcut.
  const glyphs = languageGlyphs();
  const seen = new Map();
  for (const language of LANGUAGE_CATALOGUE) {
    const glyph = glyphs[language.code];
    assert.ok(glyph && glyph.length > 0, `${language.code} has a glyph`);
    assert.equal(seen.has(glyph), false, `${language.code} and ${seen.get(glyph)} both show "${glyph}"`);
    seen.set(glyph, language.code);
    assert.equal(languageGlyphFor(language.code), glyph, `${language.code} resolves the same glyph`);
  }
  assert.equal(seen.size, LANGUAGE_CATALOGUE.length);
  // Single characters stay single wherever they can: only the collisions widen.
  const wide = Object.entries(glyphs).filter(([, glyph]) => [...glyph].length > 1).map(([code]) => code);
  assert.deepEqual(wide.sort(), ["ar", "en", "es", "pl", "pt", "tr", "ur", "vi"]);
  assert.equal(glyphs.en, "EN");
  assert.equal(glyphs.es, "ES");
  assert.equal(glyphs.pt, "POR");
  assert.equal(glyphs.pl, "POL");
  assert.equal(glyphs.ur, "ار");
  assert.equal(glyphs.ar, "ال");
});

test("a search without accents still finds the language", () => {
  // A phone keyboard has no ç, and an accented name used to be unfindable.
  const cases = {
    fr: ["francais", "Français", "french"],
    es: ["espanol", "Español", "spanish"],
    tr: ["turkce", "Türkçe", "turkish"],
    pt: ["portugues", "Português", "portuguese"],
    te: ["telugu", "తెలుగు", "te"],
    ur: ["urdu", "اردو"],
  };
  for (const [code, terms] of Object.entries(cases)) {
    for (const term of terms) {
      assert.equal(matchesLanguageQuery(code, term), true, `${code} is found by "${term}"`);
    }
  }
  assert.equal(matchesLanguageQuery("te", "zzz"), false);
  assert.equal(matchesLanguageQuery("te", "   "), true, "an empty search shows everything");
});

test("the empty state offers a way out instead of only telling you to type", () => {
  assert.match(app, /const showAll = ui\.element\("button", "button ghost small", t\("settings\.languageShowAll", \{ count: total \}\)\)/);
  assert.match(app, /showAll\.addEventListener\("click", \(\) => \{[\s\S]*?languageFilterText = "";[\s\S]*?renderLanguageGrid\(\)/);
  assert.match(css, /\.language-empty \{ display: grid/, "the message and its button stack");
});

test("tapping the language you already use says so instead of doing nothing", () => {
  // There are two tile handlers in app.js (style tiles and language tiles), so
  // anchor on the language one by the glyph line that precedes it.
  const start = app.indexOf('tile.addEventListener("click", () => {', app.indexOf("languageGlyphFor(language.code)"));
  const handler = app.slice(start, start + 700);
  assert.match(handler, /if \(select\.value === language\.code\) \{/);
  assert.match(handler, /ui\.showToast\(t\("settings\.languageAlready", \{ language: meta\.native \}\)/);
  assert.match(handler, /return;/, "and it stops before re-applying the same language");
});

test("the glyph is still a glyph on a phone", () => {
  // A later media query used to crush it to 17px, barely larger than the name.
  const sizes = [...css.matchAll(/\.language-glyph \{ font-size: (\d+)px/g)].map((match) => Number(match[1]));
  assert.ok(sizes.length >= 3, "the sizes are declared at each breakpoint");
  assert.ok(sizes.every((size) => size >= 22), `every glyph size is a glyph, saw ${sizes.join(", ")}`);
  assert.match(css, /\.language-glyph\.wide \{ font-size: 21px/, "two-letter glyphs are smaller, not squashed");
});
