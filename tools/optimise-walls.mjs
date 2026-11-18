#!/usr/bin/env node
/**
 * Turn the full-screen wall art into files a phone can download.
 *
 *   node tools/optimise-walls.mjs            # encode every master in assets/walls
 *   node tools/optimise-walls.mjs --check    # report weight and staleness, write nothing
 *
 * The glass theme used to stand in front of a *plate*: a 1280x714 painting with a
 * cream paper margin, made to sit behind a panel. Full-bleed it read as a blank
 * wall — which is exactly what the theme then looked like. So the wall is its own
 * asset with its own rules:
 *
 *   - **Two framings per room**, a landscape 1920x1080 and a portrait 1080x1920,
 *     because `cover` on a phone crops a 16:9 picture down to its middle third and
 *     throws the composition away. One file per orientation, only one fetched.
 *   - **AVIF, then WebP.** AVIF is ~40% smaller at the same quality; WebP is the
 *     fallback in the `<picture>` element, so a browser that cannot decode AVIF
 *     still gets a wall.
 *   - **A budget, measured.** Each wall is capped at 220 KB in both formats. A
 *     full-screen background that is heavier than that is a background a student
 *     on a metered connection pays for.
 *   - **Masters are not committed.** The PNGs in the repository are what the
 *     pipeline runs from; the encoded files and `walls.json` are what ship.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WALLS = path.join(REPO, "assets", "walls");
const MANIFEST = path.join(WALLS, "walls.json");
const CHECK = process.argv.includes("--check");

/** Measured budgets, in bytes. A wall is the first paint of the app. */
export const BUDGET = {
  /** Any single encoded wall, in either format. */
  each: 220_000,
  /** Everything the app can load for one room (one wide + one tall, worst case). */
  room: 380_000,
};

/** The frame each master is cropped to. `!` = exactly this, centre-cropped. */
const FRAMES = {
  wide: { width: 1920, height: 1080 },
  tall: { width: 1080, height: 1920 },
};

const convert = (args) => execFileSync("convert", args, { stdio: "pipe", maxBuffer: 128 * 1024 * 1024 });
const size = (file) => statSync(file).size;

/** Masters are `<room>-<frame>.png`; anything else in the folder is ignored. */
function masters() {
  if (!existsSync(WALLS)) return [];
  return readdirSync(WALLS)
    .map((name) => /^(?<room>[a-z0-9-]+?)-(?<frame>wide|tall)\.(?:png|jpe?g)$/.exec(name))
    .filter(Boolean)
    .map((match) => ({ room: match.groups.room, frame: match.groups.frame, file: path.join(WALLS, match[0]) }));
}

function dimensions(file) {
  const [w, h] = execFileSync("identify", ["-format", "%w %h", file], { encoding: "utf8" }).trim().split(/\s+/);
  return { width: Number(w), height: Number(h) };
}

/**
 * Crop to the frame (centre-biased slightly high, which keeps the ceiling and the
 * horizon a classroom composition depends on), then encode both formats.
 */
function encode(source, target, frame, quality) {
  const { width, height } = frame;
  convert([
    source,
    "-resize", `${width}x${height}^`,
    "-gravity", "north",
    "-crop", `${width}x${height}+0+${Math.round((height - frame.height) / 2) || 0}`,
    "+repage",
    "-strip",
    "-quality", String(quality),
    target,
  ]);
}

/**
 * `--check` with no masters: the PNGs are not committed (the repository keeps the
 * encodings), so the check reads what shipped and compares it with the manifest.
 * A wall that is missing, or that has changed size since the manifest was written,
 * fails here rather than in a browser.
 */
function checkEncoded() {
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  let failed = 0;
  for (const room of manifest.rooms) {
    for (const [frame, data] of Object.entries(room.frames)) {
      for (const format of ["avif", "webp"]) {
        const file = path.join(WALLS, `${room.room}-${frame}.${format}`);
        if (!existsSync(file)) {
          failed += 1;
          console.error(`  ${path.basename(file)} is missing`);
          continue;
        }
        if (size(file) !== data[format]) {
          failed += 1;
          console.error(`  ${path.basename(file)} is ${size(file)} bytes, the manifest says ${data[format]} — re-encode`);
        }
        if (size(file) > BUDGET.each) {
          failed += 1;
          console.error(`  ${path.basename(file)} is over the ${Math.round(BUDGET.each / 1024)} KB wall budget`);
        }
      }
    }
  }
  if (failed) {
    console.error(`\nWALLS FAILED — ${failed} problem${failed === 1 ? "" : "s"}.`);
    process.exit(1);
  }
  console.log(`WALLS OK — ${manifest.rooms.length} room${manifest.rooms.length === 1 ? "" : "s"}, every framing on disk and inside budget.`);
}

function run() {
  const list = masters();
  if (!list.length) {
    if (CHECK) return checkEncoded();
    console.error("No masters in assets/walls. Expected <room>-wide.png and <room>-tall.png (they are not committed; they are the pipeline's input).");
    process.exit(1);
  }

  /** room -> { frame -> { avif, webp, width, height } } */
  const rooms = {};
  for (const { room, frame, file } of list) {
    const frameSize = FRAMES[frame];
    if (!frameSize) throw new Error(`unknown frame "${frame}" for ${room}`);
    const avif = path.join(WALLS, `${room}-${frame}.avif`);
    const webp = path.join(WALLS, `${room}-${frame}.webp`);
    if (!CHECK) {
      encode(file, avif, frameSize, 46);
      encode(file, webp, frameSize, 72);
    }
    if (!existsSync(avif) || !existsSync(webp)) {
      console.error(`  ${room}-${frame}: not encoded yet — run without --check`);
      continue;
    }
    const { width, height } = frameSize;
    rooms[room] ||= { room, frames: {} };
    rooms[room].frames[frame] = {
      width,
      height,
      avif: size(avif),
      webp: size(webp),
    };
  }

  const manifest = {
    generated: true,
    budget: BUDGET,
    note: "Encoded from the PNG masters by tools/optimise-walls.mjs. The app reads this file for sizes; tests fail if a wall is missing, stale or over budget.",
    rooms: Object.values(rooms).sort((a, b) => a.room.localeCompare(b.room)),
  };

  let failed = 0;
  for (const room of manifest.rooms) {
    const frames = Object.entries(room.frames);
    for (const [frame, data] of frames) {
      const worst = Math.max(data.avif, data.webp);
      if (worst > BUDGET.each) {
        failed += 1;
        console.error(`  ${room.room}-${frame}: ${Math.round(worst / 1024)} KB is over the ${Math.round(BUDGET.each / 1024)} KB wall budget`);
      }
      console.log(
        `  ${`${room.room}-${frame}`.padEnd(26)} ${data.width}x${data.height}  ` +
          `avif ${Math.round(data.avif / 1024)} KB  webp ${Math.round(data.webp / 1024)} KB`,
      );
    }
    const perRoom = frames.reduce((total, [, data]) => total + Math.max(data.avif, data.webp), 0);
    if (perRoom > BUDGET.room) {
      failed += 1;
      console.error(`  ${room.room}: ${Math.round(perRoom / 1024)} KB for a room is over the ${Math.round(BUDGET.room / 1024)} KB room budget`);
    }
  }

  if (CHECK) {
    const committed = existsSync(MANIFEST) ? readFileSync(MANIFEST, "utf8") : "";
    const text = `${JSON.stringify(manifest, null, 2)}\n`;
    if (committed !== text) {
      failed += 1;
      console.error("  assets/walls/walls.json is stale — run node tools/optimise-walls.mjs");
    }
  } else {
    writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  }

  if (failed) {
    console.error(`\nWALLS FAILED — ${failed} problem${failed === 1 ? "" : "s"}.`);
    process.exit(1);
  }
  console.log(`\nWALLS OK — ${manifest.rooms.length} room${manifest.rooms.length === 1 ? "" : "s"} encoded.`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href) run();
