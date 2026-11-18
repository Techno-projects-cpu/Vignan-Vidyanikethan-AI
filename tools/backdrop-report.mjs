#!/usr/bin/env node
/**
 * Measure what the glass theme's backdrop costs the type that sits on it.
 *
 *   node tools/backdrop-report.mjs            # measure every plate and write the JSON
 *   node tools/backdrop-report.mjs --check    # fail if a committed report is stale
 *
 * The glass theme no longer floats over four soft radial fields: it floats over a
 * **full-screen painting** (`assets/walls/<room>-wide.webp`), with a warm veil and
 * four pastel fields washed over it, and a sheet of glass on top of that. Which
 * means the worst case for a label is no longer "the strongest field" — it is the
 * darkest pixel of an illustration seen through everything else.
 *
 * So this tool composites the real stack, pixel by pixel, and takes the *minimum*
 * contrast over the sampled painting:
 *
 *   painting pixel
 *     → each of the four pastel fields at its declared alpha (worst one wins)
 *     → the veil at its declared alpha
 *     → the sheet at its declared alpha
 *     → ink / muted / accent measured against that
 *
 * It also measures the raw painting (no sheet) for the type that sits straight on
 * the page, which is why the hero and the page head are sheets in the stylesheet.
 *
 * ImageMagick decodes the WebP, the same way `palette-report.mjs` does. That is a
 * development tool, not a dependency of the site: the JSON is committed and the
 * test suite reads it, so CI never needs ImageMagick.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { composite, contrast, luminance, toHex } from "../js/colour.js";
import { GLASS_THEME, auroraHex8, tintHex8 } from "../js/theme-glass.js";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WALLS = path.join(REPO, "assets", "walls");

/** The veil and the fields, as declared in `styles-glass.css` §2. */
export const STACK = {
  /** `--tg-veil`: the warm wash that turns a photograph into a room. */
  veil: { hex: GLASS_THEME.bg, alpha: GLASS_THEME.wall.veil },
  /** The four pastel fields, washed over the wall at this alpha. */
  fieldAlpha: GLASS_THEME.wall.fieldAlpha,
  /** The sheet (`--tg-tint`), which is the value the theme already exports. */
  sheetAlpha: GLASS_THEME.glass,
};

/** Decode a plate to a small raw RGB buffer. */
function sample(file, width = 96, height = 54) {
  const raw = execFileSync("convert", [file, "-resize", `${width}x${height}!`, "-depth", "8", "rgb:-"], {
    maxBuffer: 32 * 1024 * 1024,
  });
  const pixels = [];
  for (let i = 0; i + 2 < raw.length; i += 3) pixels.push(toHex([raw[i], raw[i + 1], raw[i + 2]]));
  return pixels;
}

const alpha8 = (alpha) => Math.round(alpha * 255).toString(16).padStart(2, "0");
const veilHex = `${STACK.veil.hex.replace("#", "")}${alpha8(STACK.veil.alpha)}`;

/** The four fields, as painted by `styles-glass.css` §2. */
const FIELD_HEXES = GLASS_THEME.aurora.map((field) => `${field.hex}${alpha8(STACK.fieldAlpha)}`);

/** The three inks the theme promises, and the floor each one has to clear. */
const INKS = [
  ["ink", GLASS_THEME.ink, 7],
  ["muted", GLASS_THEME.muted, 4.5],
  ["accent", GLASS_THEME.accent, 4.5],
];

/** The worst a painting pixel can be, once every translucent layer is over it. */
function worstOver(pixels, under) {
  let worst = Infinity;
  for (const pixel of pixels) {
    const value = under(pixel);
    if (value < worst) worst = value;
  }
  return worst;
}

/** Paint the stack, then measure each ink against the result. */
function measure(pixels) {
  const measured = { withSheet: {}, raw: {}, field: {} };
  const fields = FIELD_HEXES;
  for (const [name, ink] of INKS) {
    // (1) through the sheet: the way a card, a panel or the drawer is read.
    measured.withSheet[name] = worstOver(pixels, (pixel) => {
      const worstField = fields
        .map((field) => composite(field, pixel))
        .sort((a, b) => luminance(a) - luminance(b))[0];
      const veil = composite(veilHex, worstField);
      return contrast(ink, composite(tintHex8(), veil));
    });
    // (2) straight on the page: the number that decided the hero is a sheet.
    measured.raw[name] = worstOver(pixels, (pixel) => contrast(ink, pixel));
    // (3) and over the fields with no sheet, for the caption under a picture.
    measured.field[name] = worstOver(pixels, (pixel) => {
      const worstField = fields
        .map((field) => composite(field, pixel))
        .sort((a, b) => luminance(a) - luminance(b))[0];
      return contrast(ink, composite(veilHex, worstField));
    });
  }
  return measured;
}

/** The wall, from the theme itself, so the tool cannot measure a stale file. */
const ROOMS = [GLASS_THEME.wall.room];

function run() {
  const check = process.argv.includes("--check");
  const plates = existsSync(WALLS) ? ROOMS.filter((room) => existsSync(path.join(WALLS, `${room}-wide.webp`))) : [];
  if (!plates.length) {
    console.error("No wall found. Expected assets/walls/<room>-wide.webp — run node tools/optimise-walls.mjs");
    process.exit(1);
  }
  const generated = [];
  let failed = 0;
  for (const name of plates) {
    const pixels = sample(path.join(WALLS, `${name}-wide.webp`));
    const measured = measure(pixels);
    const report = {
      plate: name,
      accent: GLASS_THEME.accent,
      stack: {
        veil: `${STACK.veil.hex}${alpha8(STACK.veil.alpha)}`,
        fields: FIELD_HEXES,
        sheet: tintHex8(),
      },
      sheet: {
        ink: Number(measured.withSheet.ink.toFixed(2)),
        muted: Number(measured.withSheet.muted.toFixed(2)),
        accent: Number(measured.withSheet.accent.toFixed(2)),
      },
      raw: {
        ink: Number(measured.raw.ink.toFixed(2)),
        muted: Number(measured.raw.muted.toFixed(2)),
        accent: Number(measured.raw.accent.toFixed(2)),
      },
      measured: true,
    };
    const file = path.join(WALLS, `${name}.backdrop.json`);
    const text = `${JSON.stringify(report, null, 2)}\n`;
    for (const [ink, , floor] of INKS) {
      const value = report.sheet[ink];
      if (value < floor) {
        failed += 1;
        console.error(`  ${name}: ${ink} through the sheet is ${value}:1, below the ${floor}:1 floor`);
      }
    }
    if (check) {
      const committed = existsSync(file) ? readFileSync(file, "utf8") : "";
      if (committed !== text) {
        failed += 1;
        console.error(`  ${name}: assets/walls/${name}.backdrop.json is stale — run node tools/backdrop-report.mjs`);
      }
    } else {
      writeFileSync(file, text);
    }
    generated.push(report);
    console.log(
      `  ${name.padEnd(12)} sheet  ink ${report.sheet.ink.toFixed(1)}:1  muted ${report.sheet.muted.toFixed(1)}:1  ` +
        `accent ${report.sheet.accent.toFixed(1)}:1   raw ink ${report.raw.ink.toFixed(1)}:1`,
    );
  }
  if (failed) {
    console.error(`\n${check ? "STALE" : "TOO THIN"} — ${failed} problem${failed === 1 ? "" : "s"}.`);
    process.exit(1);
  }
  console.log(`\nBACKDROP ${check ? "OK" : "WRITTEN"} — ${generated.length} plates, ${PLATES_NOTE}`);
}

const PLATES_NOTE = "ink clears 7:1 through the sheet over the darkest pixel of the wall";

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) run();
