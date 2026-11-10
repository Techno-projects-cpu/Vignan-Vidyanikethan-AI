/**
 * The design law, checked instead of remembered.
 *
 * Round 20 ran `impeccable detect` over the site (409 findings at the start) and
 * fixed what it found: nothing below the 11px text floor, no tracked-caps chip
 * above a headline, no thick bar down one side of a card, no decorative grid or
 * stripe field, no glow shadow, no marquee. A tool cannot enforce any of that
 * once it is uninstalled, so the rules live here as ordinary assertions over the
 * real stylesheets and the real pages.
 *
 * The detector's own triage file is checked too: every suppressed finding has to
 * carry a written reason, so a suppression can never be silent.
 */

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const sheets = readdirSync(fileURLToPath(new URL("../", import.meta.url)))
  .filter((name) => /^styles(-[a-z]+)?\.css$/.test(name))
  .sort();


/** True when the line paints a colour that is not black, white or grey. */
function chromatic(line) {
  for (const match of line.matchAll(/#([0-9a-f]{3}|[0-9a-f]{6})\b/gi)) {
    let hex = match[1];
    if (hex.length === 3) hex = hex.split("").map((part) => part + part).join("");
    const [r, g, b] = [0, 2, 4].map((at) => parseInt(hex.slice(at, at + 2), 16));
    if (r !== g || g !== b) return true;
  }
  for (const match of line.matchAll(/rgba?\(([^)]+)\)/gi)) {
    const [r, g, b] = match[1].split(",").slice(0, 3).map((part) => Number(part.trim()));
    if (r !== g || g !== b) return true;
  }
  return false;
}

test("every stylesheet is found, so the rules below cannot pass on an empty list", () => {
  assert.ok(sheets.length >= 11, `expected at least 11 stylesheets, saw ${sheets.length}`);
  assert.ok(sheets.includes("styles.css") && sheets.includes("styles-pro.css"));
});

test("no stylesheet sets text below the 11px floor", () => {
  const small = [];
  for (const sheet of sheets) {
    for (const line of read(sheet).split("\n")) {
      // `font-size: 10px` and the shorthand `font: 700 10px var(--mono)`.
      const sizes = [...line.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => Number(m[1]));
      const shorthand = [...line.matchAll(/font:\s*[^;]*?\b([\d.]+)px/g)].map((m) => Number(m[1]));
      for (const size of [...sizes, ...shorthand]) {
        if (size < 11) small.push(`${sheet}: ${line.trim()}`);
      }
    }
  }
  assert.deepEqual(small, [], "functional text under 11px is a legibility failure");
});

test("no card wears a thick accent bar down one side", () => {
  const bars = [];
  for (const sheet of sheets) {
    for (const line of read(sheet).split("\n")) {
      if (/border-(left|right):\s*[2-9]px\s+solid(?!\s+transparent)/.test(line)) {
        bars.push(`${sheet}: ${line.trim()}`);
      }
      if (/box-shadow:[^;]*inset\s+[2-9]px\s+0\s+0/.test(line)) {
        bars.push(`${sheet}: ${line.trim()}`);
      }
    }
  }
  assert.deepEqual(bars, [], "the side-tab accent is the most recognisable generated-UI tell");
});

test("no decorative stripe field or tiled two-axis grid", () => {
  const fields = [];
  for (const sheet of sheets) {
    const css = read(sheet);
    for (const line of css.split("\n")) {
      assert.doesNotMatch(line, /repeating-linear-gradient|repeating-radial-gradient/, `${sheet} stripes`);
    }
    // A hairline grid is two linear-gradient layers tiled by a fixed cell.
    const grid = /linear-gradient\([^)]*\)\s*1px[^;]*,\s*linear-gradient\(90deg[^)]*\)\s*1px/s;
    if (grid.test(css)) fields.push(sheet);
  }
  assert.deepEqual(fields, [], "a decorative grid wash is a background, not structure");
});

test("no glow shadows: zero offset with a blur is a halo, not elevation", () => {
  const glows = [];
  for (const sheet of sheets) {
    for (const line of read(sheet).split("\n")) {
      // A glow is a shadow that starts at zero offset with a blur. `inset 0 0 0
      // 1px` is a hairline drawn inside the box, and a spread-only shadow is an
      // outline; neither is a halo.
      const shadow = line.match(/(?:box-shadow|text-shadow):\s*([^;]+)/);
      if (!shadow) continue;
      const value = shadow[1].trim();
      // A halo is a zero-offset, blurred, *chromatic* shadow. A grey or black
      // outline behind a chess piece is legibility, not a glow.
      const zero = /(?:^|,\s*)0\s+0\s+[1-9]\d*px/.test(value);
      if (zero && chromatic(value)) glows.push(`${sheet}: ${line.trim()}`);
    }
  }
  assert.deepEqual(glows, [], "neutral, purposeful shadows only; the identity is hairlines");
});

test("pro mode is drawn in ink, not neon", () => {
  const pro = read("styles-pro.css");
  assert.match(pro, /--pro:\s*#f2f2f2/, "the pro accent is white, not cyan");
  const halo = pro.split("\n").filter((line) => /radial-gradient/.test(line) && !/mask/.test(line));
  assert.deepEqual(halo, [], "the lock-on flash is one white frame, not a halo");
  assert.doesNotMatch(pro, /pro-grid/, "the perspective grid is gone");
  assert.doesNotMatch(pro, /cubic-bezier\(0\.\d+,\s*1\.[1-9]/, "no overshoot easing");
  // The boot sequence itself is still there.
  for (const part of ["@keyframes pro-scan", "@keyframes pro-flash", "@keyframes pro-letter-in"]) {
    assert.ok(pro.includes(part), `${part} should survive the redraw`);
  }
});

test("the startup screen states its line without a chip, a glyph or a grid", () => {
  const page = read("index.html");
  assert.doesNotMatch(page, /BUILT TO LEARN DIFFERENTLY/, "no tracked-caps kicker above the h1");
  assert.doesNotMatch(page, /startup-kicker/, "the chip above the headline is gone entirely");
  assert.doesNotMatch(page, /✦/, "the decorative glyph is gone");
  assert.match(page, /<p class="project-attribution">Created by a student of/, "the credit is a sentence");
  assert.doesNotMatch(page, /class="pro-grid"/, "the grid element is gone with its rule");
});

test("the language band is a wrapped grid of all thirty-three, and nothing moves", () => {
  const page = read("welcome.html");
  const css = read("styles-welcome.css");
  assert.doesNotMatch(page, /wl-marquee/, "the band is a grid, not a marquee");
  assert.doesNotMatch(css, /wl-marquee|wl-drift/, "the animation and the track are gone");
  assert.match(page, /class="wl-langs"/);
  const list = page.match(/<ul class="wl-langs"[\s\S]*?<\/ul>/)?.[0] ?? "";
  assert.equal((list.match(/<li/g) ?? []).length, 33, "all thirty-three languages are listed");
});

test("every suppressed detector finding carries a written reason", () => {
  const config = JSON.parse(read(".impeccable/config.json"));
  const entries = config?.detector?.ignoreValues ?? [];
  assert.ok(entries.length >= 4, "the four triaged decisions are recorded");
  for (const entry of entries) {
    assert.ok(entry.rule && entry.value, "an ignore names its rule and value");
    assert.ok(
      typeof entry.reason === "string" && entry.reason.length >= 40,
      `${entry.rule}=${entry.value} needs a reason a reviewer can weigh`,
    );
  }
  const rules = entries.map((entry) => entry.rule);
  assert.ok(rules.includes("overused-font"), "the brand font is a decision, not an oversight");
  assert.ok(rules.includes("tight-leading"), "display leading is a decision, not an oversight");
});
