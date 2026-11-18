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
 *   ink     8.4:1 through the sheet, over the darkest pixel of the wall
 *   muted   5.3:1                                     (floor: 4.5:1)
 *   accent  5.1:1                                     (floor: 4.5:1)
 *
 * Those are measured by `tools/backdrop-report.mjs`, which composites the real
 * stack — painting, four fields, veil, sheet — pixel by pixel and takes the worst.
 * The veil is 20% rather than 36% because the wall is a *detailed* painting now:
 * more veil is what made the old plate disappear, and the deeper accent pays for
 * the thinner pane.
 *
 * The sheet is white at **34%**. 58% was opaque paper: over a light painting it
 * rendered the panel about 85% white, which is why the glass read as a milky card
 * with the room only visible in the margins. 34% is the compromise measured by
 * `tools/backdrop-report.mjs` — thin enough that the classroom, the blackboard and
 * the window frames are all legible *through* a panel, thick enough that the ink
 * still clears 7:1 over the darkest pixel of the wall.
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
  ink: "#221b28",
  accent: "#063a35",
  /** Ink that sits *on* the accent (the filled button's label). */
  accentInk: "#ffffff",
  /** The quiet ink: captions, meta, anything that is not the sentence itself. */
  muted: "#3a323f",

  /**
   * The four fields: the 30%. Light, saturated, and deliberately unequal in area —
   * a field that covers a third of the screen is a second background, not a glow.
   */
  aurora: [
    { id: "blush", hex: "#f4b9c5", alpha: 0.26, at: ["14%", "22%"], r: ["46%", "42%"] },
    { id: "sand", hex: "#f0d9b6", alpha: 0.26, at: ["86%", "14%"], r: ["40%", "36%"] },
    { id: "lagoon", hex: "#8fd9d0", alpha: 0.26, at: ["72%", "90%"], r: ["48%", "42%"] },
    { id: "peach", hex: "#f8c9ae", alpha: 0.26, at: ["10%", "86%"], r: ["38%", "38%"] },
  ],

  /** White glass, as an alpha over whatever is behind it. */
  glass: 0.34,
  /**
   * Blur radius of the frosted sheet, in px.
   *
   * 24px was a milky sheet: it turned the four fields into a grey wash and made
   * the interface read as frosted *plastic*. The glasswork recipe (see
   * `js/glass-lens.js`) blurs only 2px and does the real work with a displacement
   * lens in `backdrop-filter` — but that lens is Chromium-only, and on the other
   * browsers a 2px blur is no blur at all, so the type would sit on a moving field.
   *
   * 8px is the compromise that keeps both promises: soft enough that a moving
   * field cannot get between a letter and its background (worst-case ink is still
   * 12.9:1 over the strongest field), thin enough that the pastels stay pastel
   * instead of turning grey. The refraction, the rim and the dispersion are what
   * make it read as glass; the blur is only the safety net under them.
   */
  blur: 8,
  /**
   * Saturation lift, at the top of the glasswork range: frosted glass concentrates
   * colour, it does not wash it out. At 180% the blush and the lagoon stay pink and
   * turquoise through the sheet instead of drifting towards beige.
   */
  saturate: 180,
  /** Brightness lift — the 6% that reads as "lit from behind". */
  bright: 1.06,
  /** The colour the glass is made of. Light glass is white with a warm cast. */
  glassColour: "#fffaf6",

  /**
   * The wall: one full-screen painting of a sunlit classroom, painted for this
   * project, behind everything. It replaced a set of 1280x714 *plates* — pictures
   * made to sit behind a panel, with a cream paper margin — which read as a blank
   * wall once they were stretched across the whole screen. There is one wall, not a
   * picker: the theme is the design, not a choice of four nearly identical
   * pastels.
   *
   * Two framings, because `cover` crops a 16:9 picture down to its middle third on
   * a phone and throws the composition away: a 1920x1080 landscape and a
   * 1080x1920 portrait, chosen by `<picture>` media queries so only one is fetched.
   */
  wall: {
    room: "study-afternoon",
    /** The veil between painting and glass. Measured: see tools/backdrop-report.mjs. */
    veil: 0.26,
    /** The alpha the four pastel fields are washed over the painting at. */
    fieldAlpha: 0.26,
  },
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
