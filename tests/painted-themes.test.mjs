/**
 * The painted themes: seven appearances, each one measured.
 *
 * A theme gallery is where a site usually stops being designed and starts being
 * decorated. This one is checkable, because every colour in it came from a
 * measurement rather than from a mood:
 *
 * 1. `tools/palette-report.mjs` samples each plate, clusters its pixels in CIELAB
 *    and records the area of each cluster. Those areas are the painting's own
 *    60-30-10, and a theme may only be *full-bleed* if its painting is balanced
 *    that way within a painterly tolerance. A picture does not have to be
 *    balanced; a ground does.
 * 2. The theme's three roles must be recognisably the painting's three roles
 *    (ΔE, not eyeballing), and its accent must be the most chromatic of the
 *    three, or it is not an accent.
 * 3. Its ink must clear 4.5:1 against its own surface, against its own page, and
 *    — the case that catches glass — against the *composited* panel over the
 *    brightest role of the plate it stands on.
 * 4. The generated stylesheet must be exactly what the data produces, so a theme
 *    cannot half-exist.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { balance, composite, contrast, deltaE, hueDelta, lightness, separation } from "../js/colour.js";
import { PAINTED_THEMES, asTheme } from "../js/theme-paint.js";
import { stylesheet } from "../tools/generate-painted-css.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (file) => readFileSync(path.join(root, file), "utf8");
const report = (plate) => JSON.parse(read(`assets/paint/${plate}.palette.json`));

// A painting is not a poster: it spends what it needs on the subject. The rule is
// applied with a painterly tolerance and only to the two large roles and the
// accent, and the alternative — pretending a 44/43/13 still life is 60-30-10 — is
// the sort of claim this project exists to avoid.
const TOLERANCE = [15, 15, 6];

test("seven painted themes, each complete and each on a real plate", () => {
  assert.equal(PAINTED_THEMES.length, 7);
  const ids = PAINTED_THEMES.map((theme) => theme.id);
  assert.equal(new Set(ids).size, ids.length, "ids are unique");
  assert.ok(ids.includes("legacy"), "the painted edition of this round is kept as Legacy");
  for (const theme of PAINTED_THEMES) {
    assert.match(theme.id, /^[a-z]{3,10}$/);
    assert.ok(theme.note.length > 40, `${theme.id} explains where it comes from`);
    for (const colour of [theme.bg, theme.surface, theme.ink, theme.accent]) {
      assert.match(colour, /^#[0-9a-f]{6}$/, `${theme.id}: ${colour} is a hex`);
    }
    // The plate exists, is in the cache, and has a measurement committed.
    const file = `assets/paint/${theme.plate}.webp`;
    assert.match(read("precache.json"), new RegExp(file.replace(/\./g, "\\.")), `${file} is precached`);
    const measured = report(theme.plate);
    assert.equal(measured.plate, theme.plate);
    assert.equal(measured.roles.length, 3, `${theme.plate} has three measured roles`);
    assert.ok([46, 48, 50, 52, 54, 56, 58].includes(theme.drift), "the drift is slow");
    assert.ok(theme.glass >= 0.5 && theme.glass <= 0.92, "the glass is within its range");
  }
});

test("a theme is only full-bleed if its painting is balanced 60-30-10", () => {
  for (const theme of PAINTED_THEMES) {
    const measured = report(theme.plate);
    const [dominant, secondary, accent] = measured.roles;
    const check = balance([dominant, secondary, accent]);
    const off = [
      Math.abs(check.share[0] - 60),
      Math.abs(check.share[1] - 30),
      Math.abs(check.share[2] - 10),
    ];
    const failing = off.map((value, index) => (value > TOLERANCE[index] ? `${["dominant", "secondary", "accent"][index]} is ${value.toFixed(1)} points off` : ""));
    assert.deepEqual(failing.filter(Boolean), [], `${theme.plate} measured ${check.share.join("/")}`);
  }
});

test("the theme's colours are the painting's colours, and the accent is the accent", () => {
  for (const theme of PAINTED_THEMES) {
    const [dominant, secondary, accent] = report(theme.plate).roles;
    // Same family as the painting, not a palette invented next to it.
    assert.ok(deltaE(theme.bg, dominant.hex) < 22, `${theme.id}: page colour is the painting's ground (${deltaE(theme.bg, dominant.hex).toFixed(1)} apart)`);
    assert.ok(deltaE(theme.surface, secondary.hex) < 22, `${theme.id}: surface is the painting's middle`);
    if (theme.accentSource === "seal") {
      // The house seal is the one accent that predates the paintings, so it keeps
      // its relationship with the landing page's vermilion instead of with this
      // plate — but it still has to be recognisably the same red.
      assert.ok(deltaE(theme.accent, "#b23a29") < 18, `${theme.id}: the accent is still the seal (${deltaE(theme.accent, "#b23a29").toFixed(1)} apart)`);
      assert.ok(contrast(theme.accent, "#b23a29") < 4, `${theme.id}: and it is a lift of it, not a different colour`);
    } else if (theme.accentSource === "secondary") {
      // Some paintings highlight in near-white. Their accent then comes from the
      // middle tone, lifted — the same hue, more light.
      const lifted = lightness(theme.accent) > lightness(secondary.hex);
      assert.ok(lifted, `${theme.id}: the accent is the mid-tone lifted, not darkened`);
      assert.ok(hueDelta(theme.accent, secondary.hex) < 26, `${theme.id}: accent keeps the painting's hue (${hueDelta(theme.accent, secondary.hex).toFixed(0)}°)`);
    } else {
      assert.ok(deltaE(theme.accent, accent.hex) < 26, `${theme.id}: accent comes out of the painting`);
    }

    // And the three roles have to be three, not one colour three times.
    const spread = separation([{ hex: theme.bg }, { hex: theme.surface }, { hex: theme.accent }]);
    for (const [pair, distance] of Object.entries(spread)) {
      assert.ok(distance > 8, `${theme.id}: ${pair} only ${distance} apart`);
    }
    // The accent is the liveliest of the three, or it is a third background.
    const measured = balance([
      { hex: theme.bg, weight: 60 },
      { hex: theme.surface, weight: 30 },
      { hex: theme.accent, weight: 10 },
    ]);
    assert.ok(measured.accentLeads, `${theme.id}: the accent is the most chromatic colour`);
  }
});

test("the ink clears AA on its page, its panel, and through its own glass", () => {
  for (const theme of PAINTED_THEMES) {
    assert.ok(contrast(theme.ink, theme.bg) >= 4.5, `${theme.id}: ink on page`);
    assert.ok(contrast(theme.ink, theme.surface) >= 4.5, `${theme.id}: ink on panel`);
    assert.ok(contrast(theme.accent, theme.bg) >= 4.5, `${theme.id}: accent as text on page`);
    assert.ok(contrast(theme.accent, theme.surface) >= 4.5, `${theme.id}: accent as text on panel`);

    // The glass: the panel at its alpha over every role of its plate, worst case.
    const alpha = Math.round(theme.glass * 255).toString(16).padStart(2, "0");
    for (const role of report(theme.plate).roles) {
      const panel = composite(`${theme.surface}${alpha}`, role.hex);
      const ratio = contrast(theme.ink, panel);
      assert.ok(ratio >= 4.5, `${theme.id}: ink on its glass over ${role.hex} is ${ratio.toFixed(2)}:1`);
    }
  }
});

test("the generated stylesheet is exactly what the data produces", () => {
  const onDisk = read("styles-painted.css");
  assert.equal(onDisk, stylesheet(), "styles-painted.css is stale — run node tools/generate-painted-css.mjs");
  assert.match(onDisk, /GENERATED FILE, do not edit/, "and it says so at the top");

  for (const theme of PAINTED_THEMES) {
    const block = onDisk.slice(onDisk.indexOf(`html[data-style="${theme.id}"] {`));
    assert.ok(block.startsWith(`html[data-style="${theme.id}"] {`), `${theme.id} has a token block`);
    assert.match(block, new RegExp(`--tp-plate: url\\("\\./assets/paint/${theme.plate}\\.webp"\\)`), `${theme.id} points at its plate`);
    assert.match(block, /--tp-glass: rgba\(/, `${theme.id} has its glass`);
    // The theme also maps onto the app's own tokens in the same file.
    assert.match(block, new RegExp(`html\\[data-style="${theme.id}"\\] body\\.premium-ui \\{`), `${theme.id} maps the app tokens`);
    assert.match(block, /--p-ink:/);
    assert.match(block, /--brand-ink:/);
  }
  // Whole-panel treatment, declared once for every painted theme.
  assert.match(onDisk, /html\[data-paint="1"\] body\.premium-ui \{/);
  assert.match(onDisk, /backdrop-filter: blur\(/, "the panels are frosted");
  assert.match(onDisk, /-webkit-backdrop-filter: blur\(/, "and Safari gets its own prefix");
  assert.match(onDisk, /mix-blend-mode: overlay/, "the glass has a tooth");
  assert.match(onDisk, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation: none !important/, "the drift stops on request");
});

test("the theme published to settings carries its plate and its three swatches", () => {
  for (const theme of PAINTED_THEMES) {
    const published = asTheme(theme);
    assert.equal(published.id, theme.id);
    assert.deepEqual(published.swatches, [theme.bg, theme.surface, theme.accent], "the swatch order is the 60-30-10 order");
    assert.equal(published.painted, true);
    assert.equal(published.plate, `assets/paint/${theme.plate}.webp`);
    assert.ok(published.note.length > 40);
    assert.ok(published.tags.includes("painted"), "the tile is labelled with what it is");
  }
});

test("the app switches the painted treatment on with one attribute", () => {
  const app = read("js/app.js");
  assert.match(app, /if \(isPaintedStyle\(style\)\) root\.dataset\.paint = "1";/);
  assert.match(app, /else root\.removeAttribute\("data-paint"\)/, "and takes it off again for a flat style");
  // The first frame is painted too, before the module boots.
  assert.match(read("index.html"), /dataset\.paint = "1"/);
  assert.match(read("index.html"), /styles-painted\.css/);
  assert.match(read("js/themes.js"), /\.\.\.PAINTED_THEMES\.map\(asTheme\)/, "one list, not two");
});

test("no painting is shipped without a place on the site", () => {
  // Twelve plates were painted for this release. A plate that no page shows and no
  // theme uses is 100KB of the offline cache spent on nothing, and it is exactly
  // what happens when a set grows quickly. Every plate must be either a theme's
  // ground (through js/theme-paint.js) or hung as a framed picture on the landing
  // page; the accent plates are the framed ones, and they say so on the page.
  const plates = readdirSync(new URL("../assets/paint/", import.meta.url))
    .filter((name) => name.endsWith(".webp"))
    .map((name) => name.replace(/\.webp$/, ""));
  assert.ok(plates.length >= 12, `expected the twelve painted plates, found ${plates.length}`);

  const themes = readFileSync(new URL("../js/theme-paint.js", import.meta.url), "utf8");
  const landing = readFileSync(new URL("../welcome.html", import.meta.url), "utf8");
  const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
  const gallery = landing.slice(landing.indexOf('class="wl-rooms"'));

  for (const plate of plates) {
    const asGround = themes.includes(`plate: "${plate}"`);
    const asPicture = gallery.includes(`assets/paint/${plate}.webp`);
    assert.ok(asGround || asPicture, `${plate} is neither a theme ground nor a framed picture`);
    // And either way it carries its measurement: a report exists for every plate.
    assert.ok(existsSync(new URL(`../assets/paint/${plate}.palette.json`, import.meta.url)), `${plate} has a palette report`);
  }

  // The theme picker shows the painting itself, not only three rectangles.
  assert.match(app, /style-preview\$\{theme\.painted \? " painted" : ""\}/);
  assert.match(app, /preview\.style\.backgroundImage/);

  // The two roles the page describes: seven grounds, five pictures.
  assert.equal((landing.match(/class="wl-room"/g) || []).length, 7, "seven rooms are shown");
  assert.equal((landing.match(/class="wl-picture"/g) || []).length, 5, "five plates are framed");
});
