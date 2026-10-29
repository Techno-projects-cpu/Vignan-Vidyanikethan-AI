import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_STYLE,
  THEMES,
  contrast,
  isKnownStyle,
  normalizeStyle,
  themeById,
  themeContrast,
} from "../js/themes.js";
import { DEFAULT_SETTINGS, normalizeSettings } from "../js/settings.js";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(fileURLToPath(new URL(path, root)), "utf8");
const html = read("index.html");
const css = read("styles-custom.css");
const app = read("js/app.js");

test("six styles, complete and distinct", () => {
  assert.equal(THEMES.length, 6);
  const ids = THEMES.map((theme) => theme.id);
  assert.equal(new Set(ids).size, ids.length, "every id is unique");
  assert.ok(ids.includes(DEFAULT_STYLE));
  for (const theme of THEMES) {
    assert.ok(theme.name.length > 2, `${theme.id} has a name`);
    assert.ok(theme.note.length > 30, `${theme.id} explains itself`);
    assert.equal(theme.swatches.length, 3, `${theme.id} can be previewed in three colours`);
    for (const colour of theme.swatches) assert.match(colour, /^#[0-9a-f]{6}$/i, `${theme.id} uses plain hex`);
    assert.ok(theme.tags.length >= 1, `${theme.id} is tagged`);
    assert.ok(["light", "dark"].includes(theme.scheme));
  }
});

test("every style is readable, measured not assumed", () => {
  // WCAG 2.2 AA: 4.5:1 for body text.
  for (const theme of THEMES) {
    const { onSurface, onBackground } = themeContrast(theme);
    assert.ok(onSurface >= 4.5, `${theme.name}: ink on surface is ${onSurface}:1`);
    assert.ok(onBackground >= 4.5, `${theme.name}: ink on background is ${onBackground}:1`);
  }
  // Where the accent carries text, it must also pass AA. Neo-brutalism is exempt
  // because its yellow is a fill behind black text, never a text colour itself.
  for (const theme of THEMES.filter((entry) => entry.id !== "brutal")) {
    const { accentOnSurface } = themeContrast(theme);
    assert.ok(accentOnSurface >= 4.5, `${theme.name}: accent as text is ${accentOnSurface}:1`);
  }
  // ...and the fill case is checked the other way round: black on the yellow.
  assert.ok(contrast("#ffe14d", "#0b0b0b") > 12, "Neo-brutalism keeps black text on its yellow");

  // The maths itself is checked against known pairs.
  assert.ok(contrast("#000000", "#ffffff") > 20.9 && contrast("#000000", "#ffffff") < 21.1);
  assert.equal(Math.round(contrast("#777777", "#777777")), 1);
});

test("a stale or unknown saved style can never blank the app", () => {
  assert.equal(normalizeStyle("luxury"), "luxury");
  assert.equal(normalizeStyle("nonsense"), DEFAULT_STYLE);
  assert.equal(normalizeStyle(""), DEFAULT_STYLE);
  assert.equal(normalizeStyle(undefined), DEFAULT_STYLE);
  assert.equal(normalizeStyle("__proto__"), DEFAULT_STYLE, "prototype keys are not styles");
  assert.equal(isKnownStyle("brutal"), true);
  assert.equal(themeById("nope").id, DEFAULT_STYLE);
  assert.equal(DEFAULT_SETTINGS.style, "minimal", "the app starts as it always looked");
  assert.equal(normalizeSettings({ style: "terminal" }).style, "terminal");
  assert.equal(normalizeSettings({ style: "made-up" }).style, "minimal");
  assert.equal(normalizeSettings({}).style, "minimal");
});

test("the preview swatches and the stylesheet agree, colour for colour", () => {
  for (const theme of THEMES.filter((entry) => entry.id !== "minimal")) {
    const start = css.indexOf(`html[data-style="${theme.id}"] body.premium-ui {`);
    const block = css.slice(start, css.indexOf("}", start));
    const read = (token) => (block.match(new RegExp(`${token}:\\s*(#[0-9a-f]{6})`, "i")) || [])[1];
    assert.equal(read("--p-bg"), theme.bg, `${theme.id}: background matches`);
    assert.equal(read("--p-surface\\b"), theme.surface, `${theme.id}: surface matches`);
    assert.equal(read("--p-ink\\b"), theme.ink, `${theme.id}: ink matches`);
  }
});

test("every style has all its tokens, so none borrows from another", () => {
  const tokens = ["--p-bg", "--p-surface", "--p-surface-2", "--p-surface-3", "--p-ink", "--p-ink-2", "--p-muted", "--p-line", "--p-line-strong", "--p-radius", "--font"];
  for (const theme of THEMES.filter((entry) => entry.id !== "minimal")) {
    const start = css.indexOf(`html[data-style="${theme.id}"] body.premium-ui {`);
    assert.ok(start > 0, `${theme.id} has its own block`);
    const block = css.slice(start, css.indexOf("}", start));
    for (const token of tokens) {
      assert.ok(block.includes(token), `${theme.id} sets ${token}`);
    }
  }
  // Minimal is the original look: it is the absence of the attribute, not a block.
  assert.ok(css.includes("minimal") === false || !css.includes('html[data-style="minimal"]'));
});

test("a light style stays light even when the invert switch says dark", () => {
  assert.match(css, /html\[data-style="soft"\] body\.premium-ui,\s*\nhtml\[data-style="editorial"\] body\.premium-ui/);
  const lightStyles = THEMES.filter((theme) => theme.scheme === "light").map((theme) => theme.id);
  for (const id of lightStyles) {
    const start = css.indexOf(`html[data-style="${id}"] body.premium-ui {`);
    assert.ok(css.slice(start, start + 400).includes("color-scheme: light"), `${id} pins its colour scheme`);
  }
});

test("the style is applied by attribute, mirrored, and rendered as tiles", () => {
  assert.match(app, /root\.dataset\.style = style/);
  assert.match(app, /root\.removeAttribute\("data-style"\)/, "minimal is the absence of the attribute");
  assert.match(app, /localStorage\.setItem\(STYLE_MIRROR_KEY, style\)/, "the mirror is written synchronously");
  assert.match(app, /applyStyle\(state\.settings\.style, \{ save: false \}\)/, "the saved style is applied at boot");
  assert.match(app, /function renderStyleTiles\(/);
  assert.match(app, /tile\.setAttribute\("aria-pressed"/);
  assert.match(html, /<div class="style-grid" id="style-grid" role="group"/);
  // Painting before the first frame, from the mirror only.
  assert.match(html, /localStorage\.getItem\("vignan\.style"\)/);
  assert.match(html, /\^\[a-z\]\{3,12\}\$/, "the mirror value is validated before it reaches the DOM");
});

test("settings are split into three tabs, and an untagged card never vanishes", () => {
  const tabs = [...html.matchAll(/data-settings-tab="([a-z]+)"/g)].map((match) => match[1]);
  assert.deepEqual(tabs, ["appearance", "ai", "privacy"]);
  assert.match(html, /role="tablist"/);
  const groups = [...html.matchAll(/data-settings-group="([a-z]+)"/g)].map((match) => match[1]);
  assert.ok(groups.length >= 10, "the settings cards are tagged");
  for (const group of groups) assert.ok(tabs.includes(group), `${group} is a real tab`);
  for (const tab of tabs) assert.ok(groups.includes(tab), `the ${tab} tab has cards`);
  // The controller only hides tagged nodes, so an untagged one stays visible.
  assert.match(app, /node\.classList\.toggle\("settings-hidden", Boolean\(group\) && group !== chosen\)/);
  assert.match(app, /\[\"ArrowLeft", "ArrowRight", "Home", "End"\]/, "the tablist answers the keyboard");
});

test("the first-run tour shows once, and never traps the page", () => {
  assert.match(html, /id="first-run"/);
  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-modal="false"/, "it does not block the app");
  assert.match(html, /id="first-run-skip"/);
  assert.match(html, /id="first-run-next"/);
  assert.match(app, /const FIRST_RUN_KEY = "vignan\.firstRun\.v2"/);
  assert.equal((app.match(/firstRunStep\(/g) || []).length >= 3, true);
  assert.match(app, /localStorage\.setItem\(FIRST_RUN_KEY, "done"\)/);
  assert.match(app, /if \(localStorage\.getItem\(FIRST_RUN_KEY\)\) return;/, "it is not shown twice");
  assert.match(app, /maybeStartFirstRun\(\);/, "and it is actually started");
});

test("responsiveness covers phone, tablet, laptop and a 720p projector", () => {
  for (const query of ["max-width: 1024px", "max-width: 760px", "max-width: 480px", "max-width: 380px", "max-height: 460px", "min-width: 1100px) and (max-height: 780px"]) {
    assert.ok(css.includes(query), `${query} is handled`);
  }
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\) !important; height: auto !important/, "Ask becomes one column on a tablet");
  assert.match(css, /font-size: clamp\(26px, 3\.4vw, 44px\)/, "headings scale instead of jumping");
  assert.match(css, /min-height: 40px/, "phone targets stay thumb-sized");
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
