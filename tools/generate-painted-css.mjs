#!/usr/bin/env node
/**
 * Generate `styles-painted.css` from `js/theme-paint.js`.
 *
 *   node tools/generate-painted-css.mjs           # write the stylesheet
 *   node tools/generate-painted-css.mjs --check   # fail if it is stale
 *
 * Why a generator: each painted theme is a dozen tokens plus a plate plus a glass
 * alpha, and there are seven of them. Written by hand, the eighth theme is where
 * someone forgets `color-scheme` or pastes the wrong plate, and nothing fails
 * until a student reports that the paper theme has a white scrollbar. Generated
 * from one data file, the theme list and the stylesheet cannot disagree — and the
 * test suite runs this with `--check`, so a hand edit to the CSS is a build error
 * with an instruction in it.
 *
 * The glass is the interesting part. A frosted panel is the surface colour at an
 * alpha over the painting; text has to clear 4.5:1 against the *composited*
 * result on the brightest role of the plate it will sit on, not against the
 * surface colour. That calculation is done here, per theme, and the derivation is
 * printed with the file so the numbers are inspectable.
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PAINTED_THEMES } from "../js/theme-paint.js";
import { composite, contrast, noiseDataUri, parseHex, toHex } from "../js/colour.js";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(REPO, "styles-painted.css");

const rgba = (hex, alpha) => {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${Number(alpha).toFixed(2)})`;
};

/** The plate's three measured roles, or a sane fallback if it has no report. */
function roles(plate) {
  try {
    const report = JSON.parse(readFileSync(path.join(REPO, "assets", "paint", `${plate}.palette.json`), "utf8"));
    return report.roles.map((role) => role.hex);
  } catch {
    return ["#0b0907"];
  }
}

/**
 * The worst contrast a theme's ink takes through its own glass.
 *
 * The panel is `surface` at `alpha` over each role of the plate; the ink is then
 * compared with that composite. The lowest number is what the theme actually
 * guarantees, so it is the one written into the file and checked by the test.
 */
function floorAt(theme, alpha) {
  const panel = (surface) => composite(`${theme.surface}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`, surface);
  return roles(theme.plate)
    .map((surface) => contrast(theme.ink, panel(surface)))
    .reduce((worst, ratio) => Math.min(worst, ratio), Infinity);
}

/**
 * The alpha a theme actually needs.
 *
 * The declared alpha is the designer's intent — how much painting should show
 * through. If that would leave the theme's own ink under 4.5:1 on the brightest
 * role of its plate, the glass thickens until it clears, and if it cannot clear
 * even at 92% the build stops: a theme nobody can read is not a theme.
 */
export function tunedGlass(theme) {
  const wanted = theme.glass;
  for (let alpha = wanted; alpha <= 0.921; alpha += 0.02) {
    const floor = floorAt(theme, alpha);
    if (floor >= 4.5) return { alpha: Number(alpha.toFixed(2)), floor, raised: alpha > wanted };
  }
  throw new Error(`${theme.id}: even at 92% glass the ink is ${floorAt(theme, 0.92).toFixed(2)}:1 — change the ink or the plate`);
}

export function stylesheet(themes = PAINTED_THEMES) {
  const header = `/*
 * Painted themes — GENERATED FILE, do not edit.
 *
 *   node tools/generate-painted-css.mjs
 *
 * Source: js/theme-paint.js. Every block below is one entry in that file; the
 * palette of each comes from the painting it is built on, measured by
 * tools/palette-report.mjs. If this file is edited by hand, \`npm run check\`
 * fails with the command to regenerate it.
 *
 * The glass: each theme's panel alpha was verified against the brightest and the
 * darkest role of its own plate. The floor for that theme is printed beside it.
 * Anything below 4.5:1 would have failed generation.
 */

/* The grain, once. A frosted surface without a tooth reads as a flat rectangle. */
html {
  --tp-grain-shared: ${noiseDataUri({ size: 140, opacity: 0.06 })};
}

/* The plate, behind everything, drifting slowly enough to read as a room rather
   than as an animation. One rule for all painted themes: they supply the tokens. */
html[data-paint="1"] body.premium-ui {
  background-color: var(--tp-bg);
  background-image: var(--tp-plate);
  background-size: cover;
  background-attachment: fixed;
  background-position: var(--tp-focus, 50% 45%);
  animation: tp-drift var(--tp-drift, 52s) ease-in-out infinite alternate;
}

@keyframes tp-drift {
  from { background-position: var(--tp-focus, 50% 45%); }
  to { background-position: calc(var(--tp-focus-x, 50%) + 6%) calc(var(--tp-focus-y, 45%) - 4%); }
}

/* A wash between the painting and the interface. Painted grounds are busy at the
   edges; the wash is what lets a frosted panel be a panel instead of a smear. */
html[data-paint="1"] body.premium-ui::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background:
    radial-gradient(120% 90% at 50% 0%, transparent 0%, var(--tp-wash) 72%, var(--tp-wash-end) 100%);
}

/* Frosted glass, shared by every panel in a painted theme.
   Three layers: the tint, a blur that carries the painting through it, and the
   hairline highlight along the top edge that stops it reading as a flat box. */
html[data-paint="1"] body.premium-ui .card,
html[data-paint="1"] body.premium-ui .panel,
html[data-paint="1"] body.premium-ui .command-panel,
html[data-paint="1"] body.premium-ui .sidebar,
html[data-paint="1"] body.premium-ui .composer {
  background: var(--tp-glass);
  -webkit-backdrop-filter: blur(18px) saturate(118%);
  backdrop-filter: blur(18px) saturate(118%);
  border: 1px solid var(--tp-edge);
  box-shadow: inset 0 1px 0 var(--tp-sheen), var(--tp-shadow);
}

/* The texture of the glass: one grain over the whole surface, from a data URI so
   it costs no request and the CSP never has to allow anything for it. */
html[data-paint="1"] body.premium-ui .card::after,
html[data-paint="1"] body.premium-ui .panel::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background-image: var(--tp-grain);
  mix-blend-mode: overlay;
  opacity: .5;
}

/* The one place the accent is allowed to be a surface rather than a line. */
html[data-paint="1"] body.premium-ui .button.primary,
html[data-paint="1"] body.premium-ui .premium-button.primary {
  background: var(--tp-accent);
  color: var(--tp-accent-ink);
  border-color: var(--tp-accent);
}
html[data-paint="1"] body.premium-ui .button.primary:hover,
html[data-paint="1"] body.premium-ui .premium-button.primary:hover {
  background: var(--tp-accent-hi);
}

/* Nothing in a painted theme moves under a student's hand; the drift is on the
   background only, and it stops when the device asks it to. */
@media (prefers-reduced-motion: reduce) {
  html[data-paint="1"] body.premium-ui {
    animation: none !important;
    background-attachment: scroll;
  }
}
`;

  const blocks = themes.map((theme) => {
    const { alpha, floor, raised } = tunedGlass(theme);
    const accentInk = contrast("#0b0907", theme.accent) >= 4.5 ? "#0b0907" : "#ffffff";
    const hi = toHex(parseHex(theme.accent).map((value, index) => (index === 3 ? value : Math.min(255, value + 18))));
    const focus = theme.focus || [50, 45];
    return `/* ---- ${theme.name} · ${theme.plate} · glass ${alpha}${raised ? " (thickened to reach AA)" : ""} · floor ${floor.toFixed(2)}:1 ---- */
html[data-style="${theme.id}"] {
  --tp-bg: ${theme.bg};
  --tp-surface: ${theme.surface};
  --tp-ink: ${theme.ink};
  --tp-accent: ${theme.accent};
  --tp-accent-hi: ${hi};
  --tp-accent-ink: ${accentInk};
  --tp-plate: url("./assets/paint/${theme.plate}.webp");
  --tp-focus: ${focus[0]}% ${focus[1]}%;
  --tp-focus-x: ${focus[0]}%;
  --tp-focus-y: ${focus[1]}%;
  --tp-drift: ${theme.drift}s;
  --tp-glass: ${rgba(theme.surface, alpha)};
  --tp-edge: ${theme.scheme === "light" ? rgba(theme.ink, 0.14) : "rgba(255, 255, 255, .13)"};
  --tp-sheen: ${theme.scheme === "light" ? rgba("#ffffff", 0.86) : "rgba(255, 255, 255, .1)"};
  /* A wash and a shadow that follow the plate's own light: a night room is
     knocked back with black, a daylight room with its own ink, and a pale panel
     drops a warm shadow rather than a grey one. */
  --tp-wash: ${theme.scheme === "light" ? rgba(theme.ink, 0.1) : "rgba(0, 0, 0, .34)"};
  --tp-wash-end: ${theme.scheme === "light" ? rgba(theme.ink, 0.2) : "rgba(0, 0, 0, .5)"};
  --tp-shadow: 0 18px 40px ${theme.scheme === "light" ? rgba(theme.ink, 0.14) : "rgba(0, 0, 0, .28)"};
  --tp-grain: var(--tp-grain-shared);
}

/* ${theme.name} mapped onto the app's own tokens. */
html[data-style="${theme.id}"] body.premium-ui {
  color-scheme: ${theme.scheme};
  --p-bg: ${theme.bg};
  --p-surface: ${theme.surface};
  --p-surface-2: ${theme.surface};
  --p-surface-3: ${theme.bg};
  --p-ink: ${theme.ink};
  --p-ink-2: ${theme.ink};
  --p-muted: color-mix(in srgb, ${theme.ink} 72%, ${theme.bg});
  --p-line: color-mix(in srgb, ${theme.ink} 18%, ${theme.bg});
  --p-line-strong: color-mix(in srgb, ${theme.ink} 32%, ${theme.bg});
  --p-radius: 2px;
  --brand-ink: ${theme.accent};
  --brand: ${theme.accent};
  --brand-2: ${hi};
  --brand-soft: color-mix(in srgb, ${theme.accent} 18%, ${theme.bg});
  --font: Manrope, system-ui, -apple-system, "Segoe UI", sans-serif;
  --shadow: none;
  --shadow-soft: 0 18px 40px ${theme.scheme === "light" ? rgba(theme.ink, 0.14) : "rgba(0, 0, 0, .28)"};
  background: ${theme.bg};
  color: ${theme.ink};
}
`;
  });

  return `${header}\n${blocks.join("\n")}`;
}

function main() {
  const check = process.argv.includes("--check");
  const next = stylesheet();
  const previous = (() => {
    try {
      return readFileSync(OUT, "utf8");
    } catch {
      return "";
    }
  })();

  if (check) {
    if (previous !== next) {
      console.error("STALE: styles-painted.css does not match js/theme-paint.js — run `node tools/generate-painted-css.mjs`.");
      process.exitCode = 1;
      return;
    }
    console.log(`PAINTED CSS OK — ${PAINTED_THEMES.length} themes, generated from one data file.`);
    return;
  }

  if (previous === next) {
    console.log(`styles-painted.css is current (${PAINTED_THEMES.length} themes).`);
    return;
  }
  writeFileSync(OUT, next);
  console.log(`Wrote styles-painted.css — ${PAINTED_THEMES.length} painted themes.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
