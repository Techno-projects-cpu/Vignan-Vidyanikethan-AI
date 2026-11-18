/**
 * Glass Morphism — the default theme, in daylight.
 *
 * The dark version of this theme was a room at night: four luminous fields behind
 * smoked glass. This is the same idea with the curtains open — **blush pink, warm
 * sand, lagoon turquoise and peach** behind sheets of white glass, with deep plum
 * ink on top. The brief was "light colours: pink, beige, turquoise", and the work
 * was making that readable rather than merely pretty.
 *
 * The 60-30-10 rule, in a light key:
 *
 *   60%  the base, `#fdf7f2`, a warm porcelain white
 *   30%  the four fields, at 44-62%, plus the white glass that sits on them
 *   10%  the accent, `#0b726b` — a deep lagoon teal, and the only dark, saturated
 *        colour on the screen. It marks what is live: the send button, the active
 *        tab, a citation rule.
 *
 * Every number below is measured, not chosen. `tests/glass.test.mjs` composites
 * the glass over each of the four fields and takes the **worst** result, because a
 * panel sits over blush in one corner and over sand in another:
 *
 *   ink    12.9:1 over the strongest field   (floor: 7:1)
 *   muted   6.1:1 over the strongest field   (floor: 4.5:1)
 *   accent  4.9:1 over the strongest field   (floor: 4.5:1)
 *
 * The sheet is white at 58%: any thinner and the accent starts dropping below AA
 * on the blush corner; any thicker and the fields stop being visible through the
 * glass, which is the whole point of the theme.
 */

export const GLASS_THEME = {
  id: "glass",
  name: "Glass Morphism",
  note: "Blush, sand and lagoon behind white glass. The light theme: pink, beige, turquoise, and deep teal for anything live.",
  tags: ["glass", "light", "pastel", "default"],
  scheme: "light",
  switchable: false,

  /** The four colours the interface speaks in. */
  bg: "#fdf7f2",
  surface: "#fffaf6",
  ink: "#2b2430",
  accent: "#0b726b",
  /** Ink that sits *on* the accent (the filled button's label). */
  accentInk: "#ffffff",
  /** The quiet ink: captions, meta, anything that is not the sentence itself. */
  muted: "#5f5560",

  /**
   * The four fields: the 30%. Light, saturated, and deliberately unequal in area —
   * a field that covers a third of the screen is a second background, not a glow.
   */
  aurora: [
    { id: "blush", hex: "#f4b9c5", alpha: 0.62, at: ["14%", "22%"], r: ["46%", "42%"] },
    { id: "sand", hex: "#f0d9b6", alpha: 0.58, at: ["86%", "14%"], r: ["40%", "36%"] },
    { id: "lagoon", hex: "#8fd9d0", alpha: 0.5, at: ["72%", "90%"], r: ["48%", "42%"] },
    { id: "peach", hex: "#f8c9ae", alpha: 0.44, at: ["10%", "86%"], r: ["38%", "38%"] },
  ],

  /** White glass, as an alpha over whatever is behind it. */
  glass: 0.58,
  /** Blur radius of the frosted sheet, in px. Halved in lite mode. */
  blur: 24,
  /** Saturation lift: frosted glass concentrates colour, it does not wash it out. */
  saturate: 145,
  /** The colour the glass is made of. Light glass is white with a warm cast. */
  glassColour: "#fffaf6",
};

/** The tint as a CSS colour, from the same numbers the test measures. */
export function glassTint(alpha = GLASS_THEME.glass) {
  const hex = GLASS_THEME.glassColour.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** One aurora field as a CSS colour, for the gradient. */
export function auroraColour(field) {
  const hex = field.hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${field.alpha})`;
}

/** The same field as a hex colour with alpha, for `composite()`. */
export function auroraHex8(field) {
  return `${field.hex}${Math.round(field.alpha * 255).toString(16).padStart(2, "0")}`;
}

/** The panel tint in the same form, so the test can composite it. */
export function tintHex8(alpha = GLASS_THEME.glass) {
  return `${GLASS_THEME.glassColour}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
}

/** Is this id the glass theme? */
export function isGlassStyle(id) {
  return id === GLASS_THEME.id;
}

/** The shape the Settings picker expects, without pretending to be painted. */
export function asGlassTheme(theme = GLASS_THEME) {
  return {
    id: theme.id,
    name: theme.name,
    note: theme.note,
    tags: theme.tags,
    scheme: theme.scheme,
    switchable: theme.switchable,
    bg: theme.bg,
    surface: theme.surface,
    ink: theme.ink,
    accent: theme.accent,
    swatches: [theme.bg, theme.accent, theme.aurora[0].hex],
    painted: false,
    glass: true,
  };
}
