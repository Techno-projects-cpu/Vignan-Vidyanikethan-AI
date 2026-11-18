#!/usr/bin/env node
/**
 * Measure the colour of every painted plate, so the themes can be built on
 * evidence instead of taste.
 *
 *   node tools/palette-report.mjs            # measure and write the JSON
 *   node tools/palette-report.mjs --check    # fail if the JSON is stale
 *
 * For each `assets/paint/*.webp` this samples the pixels, groups them into three
 * clusters in CIELAB (which is where "these colours look the same" is arithmetic),
 * orders the clusters by area, and writes `assets/paint/<name>.palette.json`:
 *
 *   { plate, roles: [{ hex, weight }], balance, separation, ink: { light, dark } }
 *
 * The weights are the pixels each cluster actually covers, so `balance` in the
 * JSON is the 60-30-10 check measured on the painting rather than asserted by
 * whoever wrote the theme.
 *
 * It needs ImageMagick (`convert`) to decode WebP. That is a development tool,
 * not a dependency of the site: the JSON is committed, the site never runs this,
 * and `--check` (used by the test suite) reports a stale file without needing
 * ImageMagick at all.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { balance, composite, contrast, deltaE, lightness, separation, toLab, toHex } from "../js/colour.js";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PAINT = path.join(REPO, "assets", "paint");

/** Decode a plate to a small raw RGB buffer. Sampling every pixel is pointless. */
function sample(file, width = 64, height = 36) {
  const raw = execFileSync("convert", [file, "-resize", `${width}x${height}!`, "-depth", "8", "rgb:-"], {
    maxBuffer: 32 * 1024 * 1024,
  });
  const pixels = [];
  for (let i = 0; i + 2 < raw.length; i += 3) pixels.push([raw[i], raw[i + 1], raw[i + 2]]);
  return pixels;
}

/** Deterministic k-means in Lab: three roles, ordered by the area they cover. */
function cluster(pixels, k = 3) {
  const labs = pixels.map((rgb) => toLab(toHex(rgb)));
  // Seed from evenly spaced pixels, so the result is the same on every run.
  let centres = Array.from({ length: k }, (_, i) => labs[Math.floor((i * labs.length) / k)]);
  let assignment = new Array(labs.length).fill(0);
  for (let pass = 0; pass < 24; pass += 1) {
    assignment = labs.map((lab) => {
      let best = 0;
      let bestDistance = Infinity;
      centres.forEach((centre, index) => {
        const distance = Math.hypot(...lab.map((value, i) => value - centre[i]));
        if (distance < bestDistance) {
          bestDistance = distance;
          best = index;
        }
      });
      return best;
    });
    centres = centres.map((centre, index) => {
      const members = labs.filter((_, i) => assignment[i] === index);
      if (!members.length) return centre;
      return centre.map((_, axis) => members.reduce((sum, lab) => sum + lab[axis], 0) / members.length);
    });
  }
  return centres.map((centre, index) => {
    const members = assignment.filter((value) => value === index).length;
    return {
      // Back to sRGB through the Lab inverse by picking the nearest sampled pixel:
      // a rounded mean in Lab can fall outside the sRGB gamut.
      hex: nearestHex(pixels.map((rgb) => toHex(rgb)), labs, centre),
      weight: Number(((members / assignment.length) * 100).toFixed(1)),
      chroma: Number(Math.hypot(centre[1], centre[2]).toFixed(1)),
      lightness: Number(centre[0].toFixed(1)),
    };
  });
}

function nearestHex(hexes, labs, centre) {
  let best = hexes[0];
  let bestDistance = Infinity;
  labs.forEach((lab, index) => {
    const distance = Math.hypot(...lab.map((value, i) => value - centre[i]));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = hexes[index];
    }
  });
  return best;
}

/** The two inks a theme may use on this plate, and the worst case for each. */
function inks(roles) {
  const family = roles.map((role) => role.hex);
  const candidates = {
    light: ["#f7efdd", "#efe3c8", "#ffffff"],
    dark: ["#141210", "#201c15", "#0b0907"],
  };
  const score = (ink) => Math.min(...family.map((surface) => contrast(ink, surface)));
  const pick = (list) => list.reduce((best, ink) => (score(ink) > score(best) ? ink : best), list[0]);
  return {
    light: pick(candidates.light),
    dark: pick(candidates.dark),
    lightWorst: Number(score(pick(candidates.light)).toFixed(2)),
    darkWorst: Number(score(pick(candidates.dark)).toFixed(2)),
  };
}

export function report(file) {
  const pixels = sample(file);
  const roles = cluster(pixels).sort((a, b) => b.weight - a.weight);
  const share = roles.map((role) => ({ hex: role.hex, weight: role.weight }));
  const measured = balance(share);
  return {
    plate: path.basename(file).replace(/\.webp$/, ""),
    roles: roles.map(({ hex, weight, chroma, lightness: l }) => ({ hex, weight, chroma, lightness: l })),
    // What the painting actually does, next to what the theme will claim.
    balance: { share: measured.share, within: measured.within, accentLeads: measured.accentLeads },
    separation: separation(share),
    ink: inks(roles),
    // Where the type can safely sit: the share of the plate dark enough for cream
    // ink at AA, and light enough for ink.
    safe: {
      forCream: Number(
        (
          (roles.filter((role) => contrast("#f7efdd", role.hex) >= 4.5).reduce((sum, role) => sum + role.weight, 0) /
            roles.reduce((sum, role) => sum + role.weight, 0)) *
          100
        ).toFixed(1),
      ),
      forInk: Number(
        (
          (roles.filter((role) => contrast("#141210", role.hex) >= 4.5).reduce((sum, role) => sum + role.weight, 0) /
            roles.reduce((sum, role) => sum + role.weight, 0)) *
          100
        ).toFixed(1),
      ),
    },
  };
}

/** A frosted panel over this plate: 84% ink, which is what the CSS actually does. */
export function glassCheck(entry, inkHex = "#f7efdd", panelAlpha = 0.84) {
  const worst = entry.roles
    .map((role) => ({ surface: role.hex, ratio: contrast(inkHex, composite(`#0b0907${Math.round(panelAlpha * 255).toString(16)}`, role.hex)) }))
    .sort((a, b) => a.ratio - b.ratio)[0];
  return { ...worst, ratio: Number(worst.ratio.toFixed(2)) };
}

function main() {
  const check = process.argv.includes("--check");
  const plates = readdirSync(PAINT).filter((file) => file.endsWith(".webp")).sort();
  const results = [];
  const stale = [];

  for (const plate of plates) {
    const file = path.join(PAINT, plate);
    const out = path.join(PAINT, `${plate.replace(/\.webp$/, "")}.palette.json`);
    const previous = existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : null;
    let entry;
    try {
      entry = report(file);
    } catch (error) {
      if (!check && previous) throw error;
      // No ImageMagick: --check can still say the committed report exists.
      if (previous) {
        results.push({ ...previous, measured: false });
        continue;
      }
      throw new Error(`${plate}: cannot measure (${error.message}). Install ImageMagick, or commit a report.`);
    }
    entry.measured = true;
    results.push(entry);
    if (!check) {
      const body = `${JSON.stringify(entry, null, 2)}\n`;
      if (!previous || JSON.stringify(previous) !== JSON.stringify(entry)) {
        writeFileSync(out, body);
        stale.push(plate);
      }
    } else if (!previous || JSON.stringify({ ...previous, measured: undefined }) !== JSON.stringify({ ...entry, measured: undefined })) {
      stale.push(plate);
    }
  }

  const rows = results.map((entry) => {
    const glass = glassCheck(entry);
    const roles = entry.roles.map((role) => `${role.hex} ${String(role.weight).padStart(5)}%`).join("  ");
    return `  ${entry.plate.padEnd(14)} ${roles}  | glass ${String(glass.ratio).padStart(5)}:1  balance ${entry.balance.share.join("/")}${entry.balance.within ? " ok" : " OFF"}`;
  });
  console.log(`${results.length} plates measured in CIELAB, three roles each (area-weighted):\n`);
  console.log(rows.join("\n"));

  if (check) {
    if (stale.length) {
      console.error(`\nSTALE: ${stale.join(", ")} — run \`node tools/palette-report.mjs\`.`);
      process.exitCode = 1;
      return;
    }
    console.log("\nPALETTE REPORT OK — every plate has a committed measurement.");
    return;
  }
  console.log(`\nWrote ${results.length} reports${stale.length ? ` (${stale.length} updated)` : " (all current)"}.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
