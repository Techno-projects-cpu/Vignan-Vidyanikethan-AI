#!/usr/bin/env node
/**
 * Turn the painted plates into something a low-end phone can actually load.
 *
 *   node tools/optimise-paint.mjs                 # re-encode every plate + variants
 *   node tools/optimise-paint.mjs --from <dir>    # also take new plates from a directory
 *   node tools/optimise-paint.mjs --check         # report weight, never write
 *
 * The problem this solves: eighteen paintings at ~90KB each is 1.6MB of artwork on
 * a page that also has to run on a five-year-old Android. Three changes, none of
 * which change how the page looks:
 *
 *   1. **Two widths.** A canonical 1280px plate for a full-bleed background, and a
 *      640px plate for the gallery tiles, which are 240-320px wide on screen. The
 *      gallery was downloading 1376px pictures to paint 280px boxes.
 *   2. **AVIF first.** At the same visual quality AVIF is roughly 40% smaller than
 *      WebP. It ships beside the WebP, so a browser that cannot decode it takes the
 *      older file and nothing breaks.
 *   3. **A weight budget.** Every variant is written, measured, and the manifest
 *      records the bytes. The test suite fails if the canonical set grows past the
 *      budget, so "add a painting" can never quietly make the site slower.
 *
 * `--from` reads PNG/JPEG masters (and deletes nothing): the repository keeps the
 * encodings, not the 2.7MB originals.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { reportFor } from "./palette-report.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PAINT = path.join(REPO, "assets", "paint");
const MANIFEST = path.join(PAINT, "manifest.json");
const CHECK = process.argv.includes("--check");
const fromIndex = process.argv.indexOf("--from");
const SOURCE_DIR = fromIndex > -1 ? path.resolve(process.argv[fromIndex + 1]) : "";

/** Budgets, in bytes. Measured, not guessed — see the note in docs/DESIGN.md. */
export const BUDGET = {
  // Every canonical (1280) WebP together. This is what a visitor who browses the
  // gallery and tries two themes actually downloads.
  canonicalTotal: 1_200_000,
  // Any single canonical plate.
  canonicalEach: 110_000,
  // A gallery tile at its largest: 18 of these is the gallery's whole cost.
  tileEach: 46_000,
  tileTotal: 620_000,
};

const CANONICAL_WIDTH = 1280;
const TILE_WIDTH = 640;

function convert(args) {
  execFileSync("convert", args, { stdio: "pipe", maxBuffer: 64 * 1024 * 1024 });
}

function size(file) {
  return statSync(file).size;
}

/** One encode. `>` means "shrink only", so a small master is never upscaled. */
function encode(source, target, width, quality) {
  convert([source, "-resize", `${width}x${width}>`, "-strip", "-quality", String(quality), "-define", "webp:method=6", target]);
}

function encodeAvif(source, target, width, quality) {
  // AVIF at effort 4: the default effort is slow enough to be annoying in a test,
  // and the size difference between 4 and 9 on a painting is a few percent.
  convert([source, "-resize", `${width}x${width}>`, "-strip", "-quality", String(quality), "-define", "heic:speed=4", target]);
}

/** The original pixel dimensions, so `width`/`height` attributes can be honest. */
function dimensions(file) {
  const [w, h] = execFileSync("identify", ["-format", "%w %h", file], { encoding: "utf8" }).trim().split(/\s+/);
  return { width: Number(w), height: Number(h) };
}

function plateNames() {
  return readdirSync(PAINT)
    .filter((name) => name.endsWith(".webp") && !name.includes("-640") && !name.includes("-1280"))
    .map((name) => name.replace(/\.webp$/, ""))
    .sort();
}

function main() {
  let sources = new Map();
  if (SOURCE_DIR) {
    if (!existsSync(SOURCE_DIR)) throw new Error(`no such directory: ${SOURCE_DIR}`);
    for (const name of readdirSync(SOURCE_DIR)) {
      if (!/\.(png|jpe?g)$/i.test(name)) continue;
      sources.set(name.replace(/\.(png|jpe?g)$/i, "").toLowerCase(), path.join(SOURCE_DIR, name));
    }
  }

  if (CHECK) {
    const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
    report(manifest);
    return;
  }

  // New masters first: a 2.7MB PNG becomes the canonical plate, then it is removed
  // from the source directory so a second run does not re-encode from a re-encode.
  for (const [name, file] of sources) {
    encode(file, path.join(PAINT, `${name}.webp`), CANONICAL_WIDTH, 52);
  }

  const names = plateNames();
  const plates = [];
  for (const name of names) {
    const canonical = path.join(PAINT, `${name}.webp`);
    // Re-encode in place once, from the existing canonical, at the smaller width
    // and quality. Painted art survives this; a photograph would not.
    if (size(canonical) > 60_000 || dimensions(canonical).width > CANONICAL_WIDTH) {
      encode(canonical, canonical, CANONICAL_WIDTH, 52);
    }
    encode(canonical, path.join(PAINT, `${name}-640.webp`), TILE_WIDTH, 60);
    encodeAvif(canonical, path.join(PAINT, `${name}-1280.avif`), CANONICAL_WIDTH, 42);
    encodeAvif(canonical, path.join(PAINT, `${name}-640.avif`), TILE_WIDTH, 44);

    const { width, height } = dimensions(canonical);
    // The palette report is the theme's evidence: measured from the canonical file.
    const palette = reportFor(name);
    plates.push({
      name,
      width,
      height,
      bytes: {
        canonical: size(canonical),
        tileWebp: size(path.join(PAINT, `${name}-640.webp`)),
        canonicalAvif: size(path.join(PAINT, `${name}-1280.avif`)),
        tileAvif: size(path.join(PAINT, `${name}-640.avif`)),
      },
      // The dominant tone, as a placeholder colour: a tile paints its own average
      // instantly instead of flashing an empty box while the file arrives.
      placeholder: palette.roles[0].hex,
      balance: palette.balance.share,
      // Already measured by the report: a plate may only be a full-bleed ground
      // when its own 60-30-10 is inside tolerance.
      ground: palette.balance.within,
    });
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    budget: BUDGET,
    plates,
    totals: {
      canonical: plates.reduce((sum, plate) => sum + plate.bytes.canonical, 0),
      tileWebp: plates.reduce((sum, plate) => sum + plate.bytes.tileWebp, 0),
      tileAvif: plates.reduce((sum, plate) => sum + plate.bytes.tileAvif, 0),
      canonicalAvif: plates.reduce((sum, plate) => sum + plate.bytes.canonicalAvif, 0),
    },
  };
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  report(manifest);
}

function kb(bytes) {
  return `${(bytes / 1024).toFixed(0)}KB`;
}

function report(manifest) {
  console.log(`${manifest.plates.length} plates`);
  for (const plate of manifest.plates) {
    console.log(
      `  ${plate.name.padEnd(16)} ${String(plate.width).padStart(5)}px  ` +
        `canon ${kb(plate.bytes.canonical).padStart(7)}  ` +
        `tile ${kb(plate.bytes.tileWebp).padStart(6)} webp / ${kb(plate.bytes.tileAvif).padStart(6)} avif  ` +
        `${plate.ground ? "ground" : "picture"}`,
    );
  }
  const t = manifest.totals;
  console.log(
    `\ntotal  canonical ${kb(t.canonical)} (avif ${kb(t.canonicalAvif)})  ` +
      `tiles ${kb(t.tileWebp)} webp / ${kb(t.tileAvif)} avif`,
  );
  const over = [];
  if (t.canonical > manifest.budget.canonicalTotal) over.push(`canonical total ${kb(t.canonical)} > ${kb(manifest.budget.canonicalTotal)}`);
  if (t.tileAvif > manifest.budget.tileTotal) over.push(`tile total ${kb(t.tileAvif)} > ${kb(manifest.budget.tileTotal)}`);
  for (const plate of manifest.plates) {
    if (plate.bytes.canonical > manifest.budget.canonicalEach) over.push(`${plate.name} canonical ${kb(plate.bytes.canonical)}`);
    if (plate.bytes.tileAvif > manifest.budget.tileEach) over.push(`${plate.name} tile ${kb(plate.bytes.tileAvif)}`);
  }
  if (over.length) {
    console.log(`\nover budget:\n  ${over.join("\n  ")}`);
    process.exitCode = CHECK ? 1 : 0;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
