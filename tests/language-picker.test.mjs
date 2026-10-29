import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { LANGUAGE_CATALOGUE, languageGlyph, languageGroups, languageMeta } from "../js/languages.js";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(fileURLToPath(new URL(path, root)), "utf8");
const html = read("index.html");
const css = read("styles.css");
const app = read("js/app.js");
const i18n = read("js/i18n.js");

/** The same rule the app uses, so the test is about behaviour, not markup. */
function matchesLanguage(language, term) {
  const needle = String(term || "").trim().toLowerCase();
  if (!needle) return true;
  const meta = languageMeta(language.code);
  return [meta.native, meta.name, meta.code, language.code]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(needle));
}

test("the picker is a screen of tiles, not a dropdown", () => {
  assert.match(html, /id="language-grid" role="radiogroup"/);
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
  assert.match(app, /No language matches that search\. Clear it to see all 33\./);
  assert.match(app, /`\$\{shown\} OF \$\{total\}`/, "the count tells you what the filter did");
});

test("choosing a tile is the same action as choosing from the select", () => {
  assert.match(app, /tile\.addEventListener\("click", \(\) => \{[\s\S]*?select\.value = language\.code;[\s\S]*?handleLanguageChange\(\)/);
  assert.match(app, /tile\.setAttribute\("role", "radio"\)/);
  assert.match(app, /tile\.setAttribute\("aria-checked"/, "screen readers hear which one is chosen");
  assert.match(app, /if \(meta\.dir === "rtl"\) tile\.dir = "rtl"/, "Urdu and Arabic read the right way round");
  assert.match(app, /\$\("#language-filter"\)\?\.addEventListener\("input", \(event\) => \{[\s\S]*?renderLanguageGrid\(\)/);
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
