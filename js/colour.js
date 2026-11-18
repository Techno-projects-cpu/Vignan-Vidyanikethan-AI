/**
 * Colour, as arithmetic.
 *
 * The painted edition gave this site six pigments and one rule: a colour outside
 * the palette fails the build. That was enough for one page. It is not enough for
 * a theme gallery, where every appearance is built from a different painting and
 * the claim being made is "these look right together" — which is either measured
 * or it is a matter of taste dressed up as a rule.
 *
 * So this module is the measurement, with no DOM and no dependencies:
 *
 *   hex → sRGB → linear → XYZ → CIELAB, and back
 *   WCAG contrast, and the larger-text threshold
 *   the 60-30-10 balance of a palette, with the use it needs
 *   which colour a white label must be on to stay legible over a glass panel
 *   alpha compositing twice, which is what `backdrop-filter` actually does
 *
 * Everything here is checked in `tests/colour.test.mjs` against published values:
 * known Lab coordinates for pure primaries, and contrast ratios anyone can
 * confirm in a browser inspector. If this file is wrong, every theme is wrong in
 * the same direction, so it is worth being boring about.
 */

/** Parse `#rgb`, `#rrggbb` (and with alpha) into [r, g, b, a] with 0-255 / 0-1. */
export function parseHex(input) {
  const value = String(input || "").trim().replace(/^#/, "");
  // `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa` — and nothing else.
  if (!/^(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value)) {
    throw new Error(`not a hex colour: ${input}`);
  }
  const pairs =
    value.length === 3 || value.length === 4
      ? [...value].map((char) => char + char)
      : value.match(/../g) || [];
  const [r, g, b, a] = pairs.map((pair) => parseInt(pair, 16));
  return [r, g, b, a === undefined ? 1 : Number((a / 255).toFixed(3))];
}

/** [r, g, b] 0-255 → `#rrggbb`. */
export function toHex([r, g, b]) {
  return `#${[r, g, b].map((channel) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, "0")).join("")}`;
}

/** sRGB transfer function, the real one — not a gamma of 2.2. */
export function toLinear(channel) {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function fromLinear(value) {
  const clamped = Math.max(0, Math.min(1, value));
  const srgb = clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055;
  return srgb * 255;
}

/** D65 relative luminance, the quantity WCAG contrast is defined on. */
export function luminance(hex) {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** WCAG 2.2 contrast ratio between two opaque colours: 1 to 21. */
export function contrast(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** Does this pair clear the threshold for its use? Body text needs 4.5:1. */
export function passesContrast(a, b, { large = false, level = "AA" } = {}) {
  const floor = level === "AAA" ? (large ? 4.5 : 7) : large ? 3 : 4.5;
  return contrast(a, b) >= floor;
}

/** sRGB → CIEXYZ (D65, 2° observer), scaled 0-100. */
export function toXyz(hex) {
  const [r, g, b] = parseHex(hex).slice(0, 3).map(toLinear);
  return [
    (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) * 100,
    (0.2126729 * r + 0.7151522 * g + 0.072175 * b) * 100,
    (0.0193339 * r + 0.119192 * g + 0.9503041 * b) * 100,
  ];
}

const WHITE_D65 = [95.047, 100.0, 108.883];

/** CIELAB, the space where "these two colours look 20 apart" is meaningful. */
export function toLab(hex) {
  const [x, y, z] = toXyz(hex);
  const f = (value) => (value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116);
  const [fx, fy, fz] = [x / WHITE_D65[0], y / WHITE_D65[1], z / WHITE_D65[2]].map(f);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/**
 * CIEDE2000, on two Lab triples.
 *
 * Kept separate from `deltaE` so it can be checked against the published test
 * data (Sharma, Wu & Dalal 2005), which is stated in Lab. A formula that is only
 * ever compared with itself is not tested.
 */
export function deltaEFromLab([L1, a1, b1], [L2, a2, b2]) {
  const rad = (deg) => (deg * Math.PI) / 180;
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cbar = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cbar ** 7 / (Cbar ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const h1p = (Math.atan2(b1, a1p) * 180) / Math.PI + (a1p < 0 || b1 < 0 ? 360 : 0);
  const h2p = (Math.atan2(b2, a2p) * 180) / Math.PI + (a2p < 0 || b2 < 0 ? 360 : 0);
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(rad(dhp / 2));
  const Lbar = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;
  let hbarp = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) hbarp += h1p + h2p < 360 ? 360 : -360;
    hbarp /= 2;
  }
  const T =
    1 -
    0.17 * Math.cos(rad(hbarp - 30)) +
    0.24 * Math.cos(rad(2 * hbarp)) +
    0.32 * Math.cos(rad(3 * hbarp + 6)) -
    0.2 * Math.cos(rad(4 * hbarp - 63));
  const dTheta = 30 * Math.exp(-(((hbarp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbarp ** 7 / (Cbarp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbar - 50) ** 2) / Math.sqrt(20 + (Lbar - 50) ** 2);
  const Sc = 1 + 0.045 * Cbarp;
  const Sh = 1 + 0.015 * Cbarp * T;
  const Rt = -Math.sin(rad(2 * dTheta)) * Rc;
  return Math.sqrt(
    (dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh),
  );
}

/** CIEDE2000 between two colours: under 2 is invisible, 10 is obvious. */
export function deltaE(a, b) {
  return deltaEFromLab(toLab(a), toLab(b));
}

/** Perceived lightness 0-100, for checking that a theme's steps are even. */
export function lightness(hex) {
  return toLab(hex)[0];
}

/**
 * Composite a translucent colour over an opaque one.
 *
 * This is what the eye does through a frosted panel: the plate behind survives at
 * the panel's alpha. Text is only legible if it clears the threshold against the
 * *composited* result, not against the panel's nominal colour, which is the
 * mistake that makes a glass card look fine in isolation and unreadable on a
 * bright painting.
 */
export function composite(over, under) {
  const [r1, g1, b1, a] = parseHex(over);
  const [r2, g2, b2] = parseHex(under);
  return toHex([r1 * a + r2 * (1 - a), g1 * a + g2 * (1 - a), b1 * a + b2 * (1 - a)]);
}

/**
 * Does this ink clear the threshold over every opaque colour it might land on?
 *
 * `surfaces` is the list of plates' dominant colours a panel can sit over. The
 * worst case is the one that matters: a label that is legible on the dark shelf
 * and invisible on the lamp needs to be changed, not averaged.
 */
export function worstContrast(ink, surfaces, options = {}) {
  let worst = { surface: "", ratio: Infinity };
  for (const surface of surfaces) {
    const ratio = contrast(ink, surface);
    if (ratio < worst.ratio) worst = { surface, ratio };
  }
  return worst;
}

/**
 * The 60-30-10 rule, measured.
 *
 * A palette passes when one colour carries roughly 60% of the area, a second
 * roughly 30%, and a third roughly 10%, with a tolerance that keeps the check
 * from being a straightjacket: ±8 points on the two large roles and ±5 on the
 * accent, and the accent must be the most saturated of the three, because an
 * accent that is not the most saturated colour is just a third background.
 *
 * `weights` are the areas you actually paint with. In this repository they come
 * from the plates themselves (`assets/paint/*.palette.json`), measured by
 * `tools/palette-report.mjs`, so they are evidence rather than a claim.
 */
export function balance([dominant, secondary, accent]) {
  const weights = [dominant.weight, secondary.weight, accent.weight];
  const total = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  const share = weights.map((weight) => (weight / total) * 100);
  const off = [
    Math.abs(share[0] - 60),
    Math.abs(share[1] - 30),
    Math.abs(share[2] - 10),
  ];
  const tolerance = [8, 8, 5];
  const chroma = [dominant, secondary, accent].map(({ hex }) => Math.hypot(...toLab(hex).slice(1)));
  return {
    share: share.map((value) => Number(value.toFixed(1))),
    within: off.every((value, index) => value <= tolerance[index]),
    // The accent has to be the liveliest colour, or it is not an accent.
    accentLeads: chroma[2] >= Math.max(chroma[0], chroma[1]),
    chroma: chroma.map((value) => Number(value.toFixed(1))),
  };
}

/** Lab chroma: how colourful a colour is, 0 for a neutral grey. */
export function chroma(hex) {
  return Math.hypot(...toLab(hex).slice(1));
}

/** Lab hue angle in degrees, 0-360. Meaningless for a near-neutral, hence chroma. */
export function hue(hex) {
  const [, a, b] = toLab(hex);
  return ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
}

/**
 * The circular difference between two hues, in degrees (0-180).
 *
 * This is the measurement a theme needs and CIEDE2000 cannot give: a glass panel
 * is the same pigment as the painting's mid-tone with less light behind it, so it
 * is far away in ΔE and identical in hue. Comparing hue is how "same colour,
 * darker" is distinguished from "a different colour".
 */
export function hueDelta(a, b) {
  const difference = Math.abs(hue(a) - hue(b)) % 360;
  return difference > 180 ? 360 - difference : difference;
}

/** How far apart the three roles are, perceptually. A palette needs contrast. */
export function separation([a, b, c]) {
  return {
    dominantSecondary: Number(deltaE(a.hex, b.hex).toFixed(1)),
    secondaryAccent: Number(deltaE(b.hex, c.hex).toFixed(1)),
    dominantAccent: Number(deltaE(a.hex, c.hex).toFixed(1)),
  };
}

/**
 * Inline-SVG grain, as a data URI, so a frosted panel can have a tooth without a
 * request. Returns the URL only — the markup lives in the stylesheet as a token
 * so the CSP never has to allow anything for it.
 */
export function noiseDataUri({ size = 140, opacity = 0.05, seed = 7 } = {}) {
  let state = seed;
  const random = () => {
    // A tiny deterministic PRNG: same grain every build, so screenshots and
    // tests do not drift.
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
  const dots = Array.from({ length: 180 }, () => {
    const x = (random() * size).toFixed(1);
    const y = (random() * size).toFixed(1);
    const r = (0.4 + random() * 0.9).toFixed(2);
    return `<circle cx="${x}" cy="${y}" r="${r}"/>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><g fill="%23fff" opacity="${opacity}">${dots}</g></svg>`;
  return `url("data:image/svg+xml,${svg.replace(/#/g, "%23").replace(/</g, "%3C").replace(/>/g, "%3E").replace(/"/g, "'")}")`;
}
