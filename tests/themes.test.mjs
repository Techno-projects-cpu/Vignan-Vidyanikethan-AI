import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  CLASSIC_STYLE,
  DEFAULT_STYLE,
  STYLE_ERA,
  THEMES,
  isPaintedStyle,
  migrateStyleChoice,
  contrast,
  isKnownStyle,
  normalizeStyle,
  resolveStyle,
  switchLockedReason,
  themeById,
  themeContrast,
  themePalettes,
  themeSupportsSwitch,
} from "../js/themes.js";
import { DEFAULT_SETTINGS, normalizeSettings } from "../js/settings.js";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(fileURLToPath(new URL(path, root)), "utf8");
const html = read("index.html");
const css = read("styles-custom.css");
const paintedCss = read("styles-painted.css");
const glassCss = read("styles-glass.css");
// Painted themes are generated into their own sheet and glass has a hand-written
// one; together with the token map they are the app's whole look.
const everySheet = `${css}\n${glassCss}\n${paintedCss}`;
const app = read("js/app.js");

test("seventeen styles — glass, six classic and ten painted — complete and distinct", () => {
  // 2.32.0 added the painted edition; 2.46.0 put Glass Morphism in front of it and
  // made it the default; 2.46.0 added three daylight rooms (blush, sand, mint) so
  // the painted set is not a set of night rooms with a light default in front of
  // it. Glass has no painting (it is made of light), so it is the one theme that
  // is neither classic nor plate-backed.
  assert.equal(THEMES.length, 17);
  assert.equal(THEMES.filter((theme) => theme.painted).length, 10);
  assert.equal(THEMES.filter((theme) => theme.painted && theme.scheme === "light").length, 3);
  assert.equal(THEMES.filter((theme) => theme.glass === true).length, 1, "exactly one glass theme");
  assert.equal(THEMES.filter((theme) => !theme.painted && !theme.glass).length, 6);
  assert.equal(THEMES[0].id, "glass", "the default is the first tile in Settings");
  assert.equal(DEFAULT_STYLE, "glass");
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

test("a device that predates the painted themes is moved once, and only once", () => {
  // The old default was `minimal`, written before any painting existed, so an old
  // value of `minimal` cannot be told apart from "never chose" — and that is what
  // made a whole release look like it had not shipped: every returning device kept
  // the one theme that is not painted.
  const old = normalizeSettings({ style: "minimal" });
  assert.equal(old.style, DEFAULT_STYLE, "an old default moves to the painted default");
  assert.equal(old.styleEra, STYLE_ERA, "and the movement is recorded");

  // A choice is never overwritten, in either era.
  assert.equal(normalizeSettings({ style: "terminal", styleEra: 1 }).style, "terminal");
  assert.equal(normalizeSettings({ style: "luxury", styleEra: 1 }).style, "luxury");
  assert.equal(normalizeSettings({ style: "legacy" }).style, "legacy");
  // Once the era is current, `minimal` means what it says: a choice.
  assert.equal(normalizeSettings({ style: "minimal", styleEra: STYLE_ERA }).style, "minimal");
  assert.equal(normalizeSettings({ style: "minimal", styleEra: STYLE_ERA + 1 }).style, "minimal");

  // The helper is the single authority, and it reports whether it moved anything.
  assert.deepEqual(migrateStyleChoice({ style: "minimal", era: 0 }), { style: DEFAULT_STYLE, changed: true, era: STYLE_ERA });
  assert.deepEqual(migrateStyleChoice({ style: "", era: 0 }).changed, true);
  assert.deepEqual(migrateStyleChoice({ style: "minimal", era: STYLE_ERA }).changed, false);
});

test("a stale or unknown saved style can never blank the app", () => {
  assert.equal(normalizeStyle("luxury"), "luxury");
  assert.equal(normalizeStyle("nonsense"), DEFAULT_STYLE);
  assert.equal(normalizeStyle(""), DEFAULT_STYLE);
  assert.equal(normalizeStyle(undefined), DEFAULT_STYLE);
  assert.equal(normalizeStyle("__proto__"), DEFAULT_STYLE, "prototype keys are not styles");
  assert.equal(isKnownStyle("brutal"), true);
  assert.equal(themeById("nope").id, DEFAULT_STYLE);
  // Since 2.32.2 the app opens on a painted room, not on the classic base look.
  assert.equal(DEFAULT_SETTINGS.style, DEFAULT_STYLE);
  assert.equal(DEFAULT_STYLE, "glass", "the default is the glass theme");
  assert.equal(isPaintedStyle(DEFAULT_STYLE), false, "glass has no painting to be measured against");
  assert.equal(normalizeSettings({ style: "terminal" }).style, "terminal");
  assert.equal(normalizeSettings({ style: "made-up" }).style, DEFAULT_STYLE);
  assert.equal(normalizeSettings({}).style, DEFAULT_STYLE);
  // The classic look is still reachable by name, and still sets no attribute —
  // but only a device that has seen this era can mean it. Without an era, the
  // value is the old default and is moved (that case is its own test above).
  assert.equal(normalizeSettings({ style: "minimal", styleEra: STYLE_ERA }).style, "minimal");
});

test("the preview swatches and the stylesheet agree, colour for colour", () => {
  for (const theme of THEMES.filter((entry) => entry.id !== "minimal")) {
    const start = everySheet.indexOf(`html[data-style="${theme.id}"] body.premium-ui {`);
    const block = everySheet.slice(start, everySheet.indexOf("}", start));
    // Painted themes set their surface and ink through the app's tokens; their own
    // `--tp-` block carries the same three colours in the theme's own names.
    const tp = everySheet.slice(everySheet.indexOf(`html[data-style="${theme.id}"] {`));
    const own = tp.slice(0, tp.indexOf("}"));
    const read = (token) => (block.match(new RegExp(`${token}:\\s*(#[0-9a-f]{6})`, "i")) || [])[1];
    assert.equal(read("--p-bg"), theme.bg, `${theme.id}: background matches`);
    assert.equal(read("--p-surface\\b"), theme.surface, `${theme.id}: surface matches`);
    assert.equal(read("--p-ink\\b"), theme.ink, `${theme.id}: ink matches`);
    if (theme.painted) {
      assert.match(own, new RegExp(`--tp-bg: ${theme.bg};`), `${theme.id}: plate block background`);
      assert.match(own, new RegExp(`--tp-surface: ${theme.surface};`), `${theme.id}: plate block surface`);
      assert.match(own, new RegExp(`--tp-accent: ${theme.accent};`), `${theme.id}: plate block accent`);
    }
  }
});

test("every style has all its tokens, so none borrows from another", () => {
  const tokens = ["--p-bg", "--p-surface", "--p-surface-2", "--p-surface-3", "--p-ink", "--p-ink-2", "--p-muted", "--p-line", "--p-line-strong", "--p-radius", "--font"];
  for (const theme of THEMES.filter((entry) => entry.id !== "minimal")) {
    const start = everySheet.indexOf(`html[data-style="${theme.id}"] body.premium-ui {`);
    assert.ok(start > 0, `${theme.id} has its own block`);
    const block = everySheet.slice(start, everySheet.indexOf("}", start));
    for (const token of tokens) {
      assert.ok(block.includes(token), `${theme.id} sets ${token}`);
    }
  }
  // Minimal is the original look: it is the absence of the attribute, not a block.
  assert.ok(css.includes("minimal") === false || !css.includes('html[data-style="minimal"]'));
  // Glass, by contrast, is a block — it has its own sheet and its own tokens.
  assert.match(glassCss, /html\[data-style="glass"\] body\.premium-ui \{/);
});

test("a light style stays light even when the invert switch says dark", () => {
  assert.match(css, /html\[data-style="soft"\] body\.premium-ui,\s*\nhtml\[data-style="editorial"\] body\.premium-ui/);
  const lightStyles = THEMES.filter((theme) => theme.scheme === "light").map((theme) => theme.id);
  for (const id of lightStyles) {
    const start = everySheet.indexOf(`html[data-style="${id}"] body.premium-ui {`);
    assert.ok(everySheet.slice(start, start + 400).includes("color-scheme: light"), `${id} pins its colour scheme`);
  }
});

test("the style is applied by attribute, mirrored, and rendered as tiles", () => {
  assert.match(app, /root\.dataset\.style = style/);
  assert.match(app, /root\.removeAttribute\("data-style"\)/, "minimal is the absence of the attribute");
  assert.match(app, /localStorage\.setItem\(STYLE_MIRROR_KEY, style\)/, "the mirror is written synchronously");
  assert.match(app, /applyStyle\(bootStyle, \{ save: false, remember: false \}\)/, "the saved style is applied at boot, without becoming a fresh choice");
  // ...but the mirror loses to a migration, or a device that predates the painted
  // edition would be restored to the old default on every single load.
  assert.match(app, /const restoredOldDefault = mirroredStyle === CLASSIC_STYLE && state\.settings\.style !== CLASSIC_STYLE/);
  assert.match(app, /const bootStyle = isKnownStyle\(mirroredStyle\) && !restoredOldDefault \? mirroredStyle : state\.settings\.style/);
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
  // v3: the card was rewritten from eight real screens. The old key described a
  // product that no longer existed (five goal blocks that had been removed, six
  // styles the theme picker had dropped), so a device that saw the old one has to
  // see the honest one.
  assert.match(app, /const FIRST_RUN_KEY = "vignan\.firstRun\.v3"/);
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

test("the light/dark switch is only offered where it can work", () => {
  // Minimal is the original pair and Terminal now ships a paper companion, so
  // both have two palettes. The four paper styles fix their own palette.
  assert.equal(themeSupportsSwitch("minimal"), true);
  assert.equal(themeSupportsSwitch("terminal"), true, "Terminal has a light twin now");
  assert.ok(themeById("terminal").light, "and that twin is declared as data");
  for (const id of ["soft", "editorial", "luxury", "brutal"]) {
    assert.equal(themeSupportsSwitch(id), false, `${id} pins its own palette`);
    assert.match(switchLockedReason(id), /light\/dark does not apply here/, `${id} explains itself`);
    assert.match(switchLockedReason(id), /Minimal/, "and says what to pick instead");
  }
  assert.equal(switchLockedReason("minimal"), "", "nothing to explain on Minimal");
  // A style declaration is data, so every theme must state it explicitly.
  for (const theme of THEMES) assert.equal(typeof theme.switchable, "boolean", `${theme.id} declares switchable`);
  // The stylesheet really does pin those palettes.
  for (const id of ["soft", "editorial", "luxury", "brutal"]) {
    assert.match(css, new RegExp(`html\\[data-style="${id}"\\][^{]*\\{[^}]*color-scheme: light`), `${id} is pinned light`);
  }
  assert.match(css, /html\[data-style="terminal"\][^{]*\{[^}]*color-scheme: dark/, "Terminal defaults to dark");
});

test("Terminal's light twin is a real palette, measured like the others", () => {
  const terminal = themeById("terminal");
  assert.equal(themeContrast(terminal).onSurface >= 4.5, true, "dark terminal stays readable");
  const light = themeContrast(terminal, "light");
  assert.equal(light.onSurface >= 4.5, true, `light terminal ink on surface is ${light.onSurface}:1`);
  assert.equal(light.onBackground >= 4.5, true, `light terminal ink on background is ${light.onBackground}:1`);
  assert.equal(light.accentOnSurface >= 4.5, true, `light terminal accent is ${light.accentOnSurface}:1`);
  // The stylesheet and the data must agree, or the tile preview lies.
  assert.match(css, /html\[data-style="terminal"\]\[data-theme="light"\] body\.premium-ui \{[^}]*--p-bg: #f6f8f5/);
  assert.match(css, /html\[data-style="terminal"\]\[data-theme="light"\] body\.premium-ui \{[^}]*--p-ink: #08160f/);
  assert.match(css, /html\[data-style="terminal"\]\[data-theme="light"\] body\.premium-ui \{[^}]*--brand-ink: #067a46/);
  assert.equal(terminal.light.bg, "#f6f8f5");
  assert.equal(terminal.light.ink, "#08160f");
  // Every palette a style ships is measured, so a new twin cannot skip the check.
  for (const theme of THEMES) {
    for (const palette of themePalettes(theme)) {
      const measured = themeContrast(theme, palette.scheme === theme.scheme ? "" : palette.scheme);
      assert.ok(measured.onSurface >= 4.5, `${theme.id}/${palette.scheme} is ${measured.onSurface}:1`);
    }
  }
});

test("a locked switch is visible, disabled, and explained in one line", () => {
  assert.match(html, /id="theme-locked-note"[^>]*hidden/, "the reason line starts hidden");
  assert.match(app, /function syncThemeSwitchLock\(\)/);
  assert.match(app, /toggle\.disabled = locked/);
  assert.match(app, /select\.disabled = locked/, "the Settings select cannot pretend either");
  assert.match(app, /note\.hidden = !locked/);
  assert.match(app, /syncThemeSwitchLock\(\);/, "it is called when the style changes");
  // One guard in setTheme covers the header button, the select and the command.
  const setTheme = app.slice(app.indexOf("function setTheme("), app.indexOf("function setTheme(") + 700);
  assert.match(setTheme, /if \(!themeSupportsSwitch\(state\.settings\.style\)\)/);
  assert.match(setTheme, /ui\.showToast\(switchLockedReason\(state\.settings\.style\)/);
  assert.match(css, /#theme-toggle\[aria-disabled="true"\]/);
  assert.match(css, /\.settings-note \{/);
});

test("a new device starts in the school's style, and its own choice always wins", () => {
  assert.equal(resolveStyle({}), DEFAULT_STYLE, "nothing known: the default style");
  assert.equal(resolveStyle({ schoolDefault: "editorial" }), "editorial");
  assert.equal(resolveStyle({ stored: "luxury", schoolDefault: "soft" }), "luxury", "a choice beats a default");
  assert.equal(resolveStyle({ stored: "__proto__", schoolDefault: "soft" }), "soft");
  assert.equal(resolveStyle({ stored: "", schoolDefault: "comic-sans" }), DEFAULT_STYLE);
  // The server validates its own env var, so a typo cannot blank the app.
  const server = readFileSync(fileURLToPath(new URL("serve.mjs", root)), "utf8");
  // The list covers every shipped style, painted rooms included, and the server's
  // fallback is the same painted room the app defaults to — a tablet that painted
  // one style before boot and another after it would flicker between worlds.
  assert.match(server, /const STYLE_IDS = \[\s*"glass",\s*"minimal", "soft", "editorial", "luxury", "terminal", "brutal",\s*"legacy", "rain", "stair", "aurora", "ember", "moss", "indigo",\s*"blush", "sand", "mint",\s*\]/);
  for (const theme of THEMES) {
    assert.ok(server.includes(`"${theme.id}"`), `the school can choose ${theme.id}`);
  }
  assert.match(server, /: "glass";/, "the server's fallback is the app's default");
  assert.match(server, /SCHOOL_DEFAULT_STYLE = STYLE_IDS\.includes/);
  assert.match(server, /defaultStyle: SCHOOL_DEFAULT_STYLE/);
  // The app applies it once, only when the device has never chosen.
  const apply = app.slice(app.indexOf("function applySchoolDefaultStyle()"));
  assert.match(apply, /if \(isKnownStyle\(chosen\)\) return;/);
  assert.match(apply, /applyStyle\(school, \{ save: false, remember: false \}\)/, "a default is not a choice");
  // The first frame already paints it, so a classroom of tablets matches.
  assert.match(html, /localStorage\.getItem\("vignan\.style\.school"\)/);
});

test("the theme is mirrored, so a dark device does not flash white first", () => {
  assert.ok(app.includes('const THEME_MIRROR_KEY = "vignan.theme"'), "the mirror key exists");
  const setThemeAt = app.indexOf("function setTheme(");
  const setTheme = app.slice(setThemeAt, app.indexOf("function applyStyle(", setThemeAt));
  assert.ok(
    setTheme.includes('localStorage.setItem(THEME_MIRROR_KEY, theme === "dark" ? "dark" : "light")'),
    "the choice is mirrored synchronously",
  );
  // The inline script must accept only the two values this app writes, so a
  // tampered storage value cannot repaint the page.
  assert.ok(html.includes('const theme = localStorage.getItem("vignan.theme")'));
  assert.ok(html.includes('if (theme === "dark" || theme === "light") document.documentElement.dataset.theme = theme'));
});
