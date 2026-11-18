/**
 * Glass Morphism: the default, and the one theme with no painting.
 *
 * Because there is no photograph to measure, every claim about this theme has to
 * be checked against the numbers in `js/theme-glass.js` instead of against a
 * palette report. The interesting one is contrast: text sits on a 36% tint over a
 * background that is *four different colours in different places*, and it is
 * moving. So the test composites the tint over every field and takes the worst —
 * which is the only number that means anything.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { composite, contrast } from "../js/colour.js";
import { GLASS_THEME, auroraColour, auroraHex8, glassTint, tintHex8 } from "../js/theme-glass.js";
import { DEFAULT_STYLE, THEMES, isGlassTheme, isPaintedStyle, themeById } from "../js/themes.js";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const css = read("styles-glass.css");

/** The tint over each field, which is what a panel actually sits on. */
function surfaces() {
  return GLASS_THEME.aurora.map((field) => {
    const backdrop = composite(auroraHex8(field), GLASS_THEME.bg);
    return { id: field.id, hex: composite(tintHex8(), backdrop) };
  });
}

test("glass is the default, the first tile, and it is not painted", () => {
  assert.equal(DEFAULT_STYLE, "glass");
  assert.equal(THEMES[0].id, "glass", "the first thing in the picker is what the app opens on");
  assert.equal(themeById("glass").name, "Glass Morphism");
  assert.equal(isGlassTheme("glass"), true);
  assert.equal(isGlassTheme("rain"), false);
  assert.equal(isPaintedStyle("glass"), false, "there is no plate to measure");
  assert.equal(themeById("glass").painted, false);
  assert.deepEqual(themeById("glass").swatches, [GLASS_THEME.bg, GLASS_THEME.surface, GLASS_THEME.accent]);
  // And the two older looks are still in the list, by name.
  assert.ok(THEMES.some((theme) => theme.id === "minimal"), "Minimal is still a style");
  assert.ok(THEMES.some((theme) => theme.id === "legacy"), "Legacy is still a style");
});

test("the text clears 7:1 over every field, not just the average one", () => {
  const surfacesUnder = surfaces();
  for (const surface of surfacesUnder) {
    const ink = contrast(GLASS_THEME.ink, surface.hex);
    assert.ok(ink >= 7, `${surface.id}: ink on the sheet is ${ink.toFixed(2)}:1, below the 7:1 this theme promises`);
    const muted = contrast(GLASS_THEME.muted, surface.hex);
    assert.ok(muted >= 4.5, `${surface.id}: muted ink is ${muted.toFixed(2)}:1, below AA`);
    const accent = contrast(GLASS_THEME.accent, surface.hex);
    assert.ok(accent >= 4.5, `${surface.id}: the accent as text is ${accent.toFixed(2)}:1, below AA`);
  }
  // The filled button's own label.
  assert.ok(contrast(GLASS_THEME.accentInk, GLASS_THEME.accent) >= 4.5, "ink on the accent is readable");
  // On the page itself, before any glass.
  assert.ok(contrast(GLASS_THEME.ink, GLASS_THEME.bg) >= 12, "the page ink is comfortable");
});

test("the thinnest sheet that still works — the tint alpha is not decoration", () => {
  // One step thinner than the shipped value must actually be worse, or the number
  // in the file is arbitrary and the next person can lower it without noticing.
  const thinner = GLASS_THEME.glass - 0.08;
  const worstAt = (alpha) => {
    const tint = tintHex8(alpha);
    return Math.min(
      ...GLASS_THEME.aurora.map((field) => {
        const backdrop = composite(auroraHex8(field), GLASS_THEME.bg);
        return contrast(GLASS_THEME.ink, composite(tint, backdrop));
      }),
    );
  };
  assert.ok(worstAt(thinner) < worstAt(GLASS_THEME.glass), "a thinner sheet reads worse");
  assert.ok(worstAt(GLASS_THEME.glass) >= 7, "and the shipped one still clears the floor");
});

test("the stylesheet uses the numbers the module exports", () => {
  const block = css.slice(css.indexOf('html[data-style="glass"] body.premium-ui {'));
  const tokens = block.slice(0, block.indexOf("}"));
  for (const token of ["--p-bg", "--p-surface", "--p-ink", "--p-muted"]) {
    assert.ok(tokens.includes(token), `${token} is defined`);
  }
  assert.match(tokens, new RegExp(`--p-bg: ${GLASS_THEME.bg};`));
  assert.match(tokens, new RegExp(`--p-surface: ${GLASS_THEME.surface};`));
  assert.match(tokens, new RegExp(`--p-ink: ${GLASS_THEME.ink};`));
  assert.match(tokens, new RegExp(`--brand: ${GLASS_THEME.accent};`));
  // The four fields, as the gradient the browser paints.
  for (const field of GLASS_THEME.aurora) {
    // CSS writes `.58`, the module writes `0.58`; the numbers are what matter.
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(field.hex.slice(i, i + 2), 16));
    const pattern = new RegExp(`rgba\\(\\s*${r},\\s*${g},\\s*${b},\\s*0?\\.${String(Math.round(field.alpha * 100)).padStart(2, "0")}\\s*\\)`);
    assert.match(css, pattern, `${field.id} appears in the aurora with its measured alpha`);
  }
  const tintAlpha = `0?\\.${String(Math.round(GLASS_THEME.glass * 100)).padStart(2, "0")}`;
  assert.match(css, new RegExp(`rgba\\(22, 40, 46, ${tintAlpha}\\)`), "the tint is the exported alpha");
  assert.ok(css.includes(`--tg-blur: ${GLASS_THEME.blur}px`), "the blur is the exported radius");
  assert.ok(css.includes(`--tg-saturate: ${GLASS_THEME.saturate}%`), "the saturation is exported too");
});

test("the default screen makes no image request", () => {
  // The whole point of a theme made of light: nothing to download. The only url()
  // in the sheet is the inline SVG grain, which is a data URI and costs no request.
  const urls = [...css.matchAll(/url\((["']?)([^)"']+)\1\)/g)].map((match) => match[2]);
  assert.ok(urls.length > 0, "the grain is there");
  for (const url of urls) {
    // Either the inline SVG itself, or a fragment reference inside that SVG.
    assert.match(url, /^(data:image\/svg\+xml|%23)/, `${url} is an inline asset, not a request`);
  }
  assert.doesNotMatch(css, /assets\/paint/, "glass does not use a painting");
  // ...and the app links this sheet before the app bundle, so the first frame has it.
  const html = read("index.html");
  assert.match(html, /<link rel="stylesheet" href="\.\/styles-glass\.css\?v=\d+">/);
  assert.ok(html.indexOf("styles-glass.css") < html.indexOf("js/boot.js"), "painted before boot");
});

test("a slow device gets the glass without the blur pass", () => {
  // Lite mode is the performance story of this theme, so it is a test, not a note.
  assert.match(css, /html\[data-style="glass"\]\[data-lite="1"\] body\.premium-ui \{/);
  const lite = css.slice(css.indexOf('html[data-style="glass"][data-lite="1"] body.premium-ui {'));
  assert.match(lite.slice(0, 400), /--tg-blur: 8px/, "the blur drops to 8px");
  assert.match(css, /html\[data-lite="1"\] body\.premium-ui::before \{[^}]*animation: none/s, "the aurora stops");
  assert.match(css, /html\[data-lite="1"\] \.card::before[\s\S]{0,120}display: none/, "the specular is removed");

  const app = read("js/app.js");
  assert.match(app, /function preferLiteGlass\(\)/, "the decision is made in one place");
  assert.match(app, /cores <= 4 \|\| memory <= 4/, "few cores or little memory means lite");
  assert.match(app, /saveData === true/, "so does a metered connection");
  assert.match(app, /root\.dataset\.lite = "1"/);
  // The first frame decides too, before any module has loaded.
  assert.match(read("index.html"), /navigator\.hardwareConcurrency \|\| 8/);
});

test("motion is ambient, and it stops when it is asked to", () => {
  const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
  for (const selector of ["body.premium-ui::before", ".app-shell::before", ".sidebar::before"]) {
    assert.ok(reduced.includes(selector), `${selector} loops, so the reduced block must stop it`);
  }
  // Nothing that carries a word is animated: the moving things are the two
  // background layers and a decorative flare.
  const animated = [...css.matchAll(/animation:\s*([a-z-]+)/g)]
    .map((match) => match[1])
    .filter((name) => name !== "none");
  assert.deepEqual([...new Set(animated)].sort(), ["tg-aurora", "tg-flare", "tg-sheen"]);
  for (const name of new Set(animated)) {
    assert.ok(css.includes(`@keyframes ${name}`), `${name} is defined`);
  }
});

test("the theme is documented where a reader will look", () => {
  const design = read("docs/DESIGN.md");
  assert.match(design, /Glass Morphism/);
  assert.match(design, /60-30-10|60 \/ 30 \/ 10/);
  assert.ok(existsSync(new URL("../styles-glass.css", import.meta.url)));
});
