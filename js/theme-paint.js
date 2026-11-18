/**
 * The painted themes, as data.
 *
 * Each one is an appearance built on a plate in `assets/paint/`: the plate is the
 * page's ground, a frosted panel carries the working surfaces, and one accent
 * colour comes out of the painting. `styles-painted.css` is generated from this
 * file by `tools/generate-painted-css.mjs`, so a theme cannot exist here without
 * existing there — and `npm run check` fails if the two disagree.
 *
 * ## Why the colours are these colours
 *
 * They are not chosen by eye. `tools/palette-report.mjs` samples every plate,
 * groups its pixels into three clusters in CIELAB, and writes the area each one
 * covers to `assets/paint/<plate>.palette.json`. Those percentages are the
 * painting's own 60-30-10: what the picture actually spends on its ground, its
 * middle and its accent.
 *
 * A theme may only be used **full-bleed** — as the ground of the whole app — if
 * the painting it is built on is within tolerance of 60-30-10 (see
 * `tests/painted-themes.test.mjs`). A painting outside that tolerance (the open
 * book, the frost, the dawn desk, the library at dusk) is still used, as an
 * **accent plate**: a framed picture on a band of the landing page, where the
 * subject of the picture is the point and the interface is not being read on top
 * of it. That distinction is the whole colour theory of this edition in one line:
 * a ground must be balanced, a picture need not be.
 *
 * The surface rule, which is the part that is easy to get wrong: a frosted panel
 * is the painting's mid-tone with less light behind it. It keeps the hue (within a
 * degree, checked) and gives up lightness until cream ink clears 8.6:1 on it, so
 * the glass reads as glass over the room rather than as a grey box placed on top.
 * The glass alpha is the same kind of number: it is the smallest alpha at which
 * that theme's ink clears 4.6:1 over *every* role of its plate, solved in
 * `tools/generate-painted-css.mjs` and written back here. Panels over a bright
 * corner of a painting are thicker than panels over a dark one, which is what a
 * real pane of frosted glass does too.
 *
 * Every value here was produced by that rule, not by opening a colour picker.
 *
 * The roles map to the picture:
 *   ground   — the 60%: the plate, dimmed a little, and the page behind it
 *   surface  — the 30%: frosted panels, the composer, the drawer
 *   accent   — the 10%: the one colour that means "this is live" — the send
 *              button, the active tab, the streak, the citation rule
 * and `ink` is chosen to clear 4.5:1 against the accent-composited glass, which
 * is measured in the test rather than hoped for.
 */

export const PAINTED_THEMES = [
  {
    id: "legacy",
    name: "Legacy",
    note: "The painted edition itself: sumi black, washi cream, one vermilion seal. The look the site launched this round with.",
    tags: ["painted", "ink", "dark", "legacy"],
    scheme: "dark",
    switchable: false,
    plate: "paper-night",
    // The lantern room: 67.8 / 20.4 / 11.8 measured, the most balanced dark plate.
    bg: "#08090c",
    // A panel has to be visibly a panel (8.5 ΔE off the page) and dark enough that
    // the seal red can still be a label on it (4.71:1).
    surface: "#251d14",
    ink: "#f7efdd",
    // The seal itself is #b23a29, but a seal is a mark, not a label. The theme's
    // accent also carries text (the active tab, the streak figure), so it is
    // lifted one step along the same hue until it clears 4.5:1 on both grounds —
    // 5.63:1 on the page and 4.71:1 on a panel, ΔE 14.7 from the seal — far enough
    // to read as a label, close enough to still read as the same red.
    accent: "#d9664b",
    // Not from this plate: the lantern room is neutral, and its third cluster is a
    // shadow. This accent is the house seal (`--wl-vermilion` on the landing page),
    // lifted for text. The test accepts `accentSource: "seal"` and then requires it
    // to keep that relationship instead.
    accentSource: "seal",
    glass: 0.62,
    drift: 46,
  },
  {
    id: "rain",
    name: "Rain window",
    note: "A rainy library window, teal glass and one amber lamp. Measured 59.4 / 32.3 / 8.2 — the closest to a textbook 60-30-10 of any plate.",
    tags: ["painted", "rain", "teal", "dark"],
    scheme: "dark",
    switchable: false,
    plate: "rain-window",
    bg: "#1b1a16",
    surface: "#3f4339",
    ink: "#f2ece0",
    accent: "#cbb28f",
    // Raised: this plate's accent role is a bright cream, and at 0.60 the ink fell
    // to 4.24:1 over it. 0.66 clears AA and still shows the painting.
    glass: 0.66,
    drift: 54,
  },
  {
    id: "stair",
    name: "Book stair",
    note: "A staircase of stacked books climbing into a skylight. Ochre on sumi, 67.3 / 24.4 / 8.3.",
    tags: ["painted", "ochre", "dark"],
    scheme: "dark",
    switchable: false,
    plate: "book-stair",
    bg: "#17130d",
    surface: "#433323",
    ink: "#f4ead6",
    accent: "#d2a066",
    glass: 0.6,
    drift: 58,
  },
  {
    id: "aurora",
    name: "Aurora hall",
    note: "A green light rising off the floor of a blurred hall. Mint on near-black teal, 71.2 / 20.4 / 8.5.",
    tags: ["painted", "green", "dark"],
    scheme: "dark",
    switchable: false,
    plate: "aurora-teal",
    bg: "#152b28",
    surface: "#264740",
    ink: "#eaf6ef",
    accent: "#7fd8b6",
    glass: 0.72,
    drift: 50,
  },
  {
    id: "ember",
    name: "Ember room",
    note: "A reading room painted in rose and ember. Brick on plum-black, 72.9 / 15.5 / 11.6.",
    tags: ["painted", "rose", "dark"],
    scheme: "dark",
    switchable: false,
    plate: "ember-rose",
    bg: "#261717",
    surface: "#5a382d",
    ink: "#f6e9e4",
    // This plate's third cluster is a highlight (near-white), so the accent is the
    // brick of its middle tone lifted for text — same hue, more light.
    accent: "#f09b76",
    accentSource: "secondary",
    glass: 0.76,
    drift: 52,
  },
  {
    id: "moss",
    name: "Moss corridor",
    note: "A dark corridor under moss and one butter lamp. 74.2 / 16.4 / 9.4.",
    tags: ["painted", "moss", "dark"],
    scheme: "dark",
    switchable: false,
    plate: "moss-hall",
    bg: "#1a1e14",
    surface: "#3e4631",
    ink: "#eef1e6",
    accent: "#d8c078",
    glass: 0.74,
    drift: 56,
  },
  {
    id: "indigo",
    name: "Indigo shelf",
    note: "A blue-ink library at night with moonlight down the aisle. 64.8 / 19.7 / 15.5, the coolest of the set.",
    tags: ["painted", "indigo", "dark"],
    scheme: "dark",
    switchable: false,
    plate: "indigo-shelf",
    bg: "#0e141b",
    surface: "#3f4246",
    ink: "#e8eef4",
    accent: "#a8c4e0",
    glass: 0.74,
    drift: 48,
  },
];

/**
 * The plates that are paintings rather than grounds.
 *
 * They are shown framed — the landing page's hero, its plate band, its brush
 * band — and no interface text is ever set across them. Kept in the same file so
 * the two roles of the same asset are described in one place.
 */
export const ACCENT_PLATES = [
  { plate: "library-dusk", where: "the landing hero, behind a wash of ink" },
  { plate: "open-book", where: "the plate band beside the claim" },
  { plate: "dawn-desk", where: "reserved for the light themes' plate band" },
  { plate: "frost-glass", where: "the texture behind a frosted panel" },
  { plate: "brush-band", where: "the band between the painted half and the paper half" },
];

/** A painted theme by id, or null. */
export function paintedThemeById(id) {
  return PAINTED_THEMES.find((theme) => theme.id === id) || null;
}

/** Is this id one of the painted themes? */
export function isPainted(id) {
  return Boolean(paintedThemeById(String(id || "")));
}

/**
 * The theme in the shape `js/themes.js` publishes to the settings screen.
 *
 * One theme, one row: the settings tile shows the three swatches in the order the
 * 60-30-10 rule uses them, so a student sees the balance before choosing it.
 */
export function asTheme(theme) {
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
    swatches: [theme.bg, theme.surface, theme.accent],
    painted: true,
    plate: `assets/paint/${theme.plate}.webp`,
    glass: theme.glass,
  };
}
