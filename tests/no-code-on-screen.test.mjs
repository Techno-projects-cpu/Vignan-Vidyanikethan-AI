import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(fileURLToPath(new URL(path, root)), "utf8");
const html = read("index.html");
const app = read("js/app.js");
const i18n = read("js/i18n.js");
const css = read("styles.css");

/**
 * A student should never read a developer's note.
 *
 * The site once showed "Endpoint with {q} placeholder" and a URL full of braces
 * in a Settings card that was open to everyone, because two optional fields were
 * printed whether or not they could do anything. This file keeps that from
 * coming back: no visible label may contain a template marker or a code shape.
 */
const VISIBLE_LABEL = /data-i18n="([^"]+)"[^>]*>([^<]*)</g;

/**
 * Code shapes a student should never read. Template variables such as {count}
 * are not included: those are filled before the text reaches the page, and the
 * test below proves every one of them has a filler.
 */
const CODE_SHAPES = /=>|<\/|\bundefined\b|\bNaN\b|\bnull\b|function\s*\(|\{q\}/;

test("no visible label in index.html looks like code", () => {
  const offenders = [];
  const hiddenStart = html.indexOf('<div id="web-custom-fields" hidden>');
  const hiddenEnd = html.indexOf("</div>", hiddenStart);
  for (const match of html.matchAll(VISIBLE_LABEL)) {
    const [whole, key, text] = match;
    if (!text.trim()) continue;
    // The optional search-address fields are inside a wrapper that starts
    // hidden, and are covered by their own test.
    const at = html.indexOf(whole);
    if (hiddenStart >= 0 && at > hiddenStart && at < hiddenEnd) continue;
    if (CODE_SHAPES.test(text)) offenders.push(`${key}: ${text.trim()}`);
  }
  assert.deepEqual(offenders, [], `code-like labels on screen: ${offenders.join(" | ")}`);
});

test("the English dictionary has no code-like student text either", () => {
  const start = i18n.indexOf("const EN = {");
  const end = i18n.indexOf("const TE = {");
  const block = i18n.slice(start, end);
  const offenders = [];
  for (const match of block.matchAll(/"([^"]+)":\s*"((?:[^"\\]|\\.)*)"/g)) {
    const [, key, value] = match;
    // The one allowed exception: the search-address help, which has to name the
    // marker the student types into a URL. It is a full sentence, and the field
    // only appears when "My own search service" is chosen.
    if (key === "settings.webEndpointHelp") continue;
    if (CODE_SHAPES.test(value) || /\[object/.test(value)) offenders.push(`${key} = ${value}`);
  }
  assert.deepEqual(offenders, [], `code-like text: ${offenders.join(" | ")}`);
});

test("every {variable} is a plain word that the app passes in", () => {
  const start = i18n.indexOf("const EN = {");
  const end = i18n.indexOf("const TE = {");
  const block = i18n.slice(start, end);
  const appSource = `${app}\n${i18n}`;
  const problems = [];
  for (const match of block.matchAll(/"([^"]+)":\s*"((?:[^"\\]|\\.)*)"/g)) {
    const [, key, value] = match;
    if (key === "settings.webEndpointHelp") continue;
    const names = [...value.matchAll(/\{([^{}]+)\}/g)].map((entry) => entry[1]);
    if (!names.length) continue;
    // A placeholder must be a lowercase word, not a code fragment like {q} or
    // {a.b} — the latter is how a template leaks onto the page.
    for (const name of names) {
      if (!/^[a-z]+$/.test(name)) problems.push(`${key} has a non-variable placeholder {${name}}`);
    }
    // And the key has to be called with an object, or the braces stay on screen.
    if (!appSource.includes(`t("${key}", {`)) problems.push(`${key} is never called with its values`);
  }
  assert.deepEqual(problems, [], problems.join(" | "));
});

test("the custom search fields are hidden until they can do something", () => {
  assert.match(html, /<div id="web-custom-fields" hidden>/);
  assert.match(html, /id="settings-web-mode"/);
  // Both fields live inside the wrapper, so neither is on screen by default.
  const wrapper = html.slice(html.indexOf('<div id="web-custom-fields" hidden>'));
  const close = wrapper.indexOf("</div>");
  const inside = wrapper.slice(0, close);
  assert.match(inside, /id="settings-web-endpoint"/);
  assert.match(inside, /id="settings-web-token"/);
  assert.match(app, /function syncCustomSearchFields\(\)/);
  assert.match(app, /fields\.hidden = mode !== "custom"/);
  assert.match(app, /syncCustomSearchFields\(\);/, "and it runs when Settings is drawn");
  assert.match(app, /\$\("#settings-web-mode"\)\.addEventListener\("change", syncCustomSearchFields\)/);
  // The label says what the field is for, not what its syntax is.
  assert.match(i18n, /"settings\.webEndpoint": "Search address"/);
  assert.match(i18n, /"settings\.webEndpointHelp": "Your question is inserted where the address contains \{q\}\."/);
  assert.match(i18n, /"settings\.webToken": "Access password, if your service needs one"/);
  assert.match(i18n, /"settings\.webCustom": "My own search service"/);
});

test("the card that explains outside search is written for a student", () => {
  assert.match(html, /data-i18n="settings\.searchSourceTitle"/);
  assert.match(html, /data-i18n="settings\.searchSourceHelp"/);
  assert.match(html, /data-i18n="settings\.webSave"/);
  const title = /"settings\.searchSourceTitle": "([^"]+)"/.exec(i18n)[1];
  assert.doesNotMatch(title, /JSON|endpoint|API|provider/i, `plain words only, got "${title}"`);
  const help = /"settings\.searchSourceHelp": "([^"]+)"/.exec(i18n)[1];
  assert.ok(help.length > 40 && help.endsWith("."), "the help is a sentence");
});

test("the hidden wrapper really hides, in every style", () => {
  // The attribute alone is not enough: the shell sets its own display rules, so
  // the stylesheet has to win with !important.
  const premium = read("styles-premium.css");
  assert.match(premium, /body\.premium-ui \[hidden\] \{ display: none !important; \}/);
  assert.ok(css.includes("[hidden]") || premium.includes("[hidden]"), "something styles the attribute");
  assert.match(app, /fields\.hidden = mode !== "custom"/, "and the app sets it from the chosen source");
});
