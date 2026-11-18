/**
 * Glass Morphism — the default theme, and the one that has no painting.
 *
 * The painted themes are built on a picture: the plate decides the palette. This
 * one is built on **light**, so it has the opposite constraint — every colour has
 * to survive being looked at through a translucent sheet, over a background that
 * is deliberately moving. That is the whole design, and it is the reason the
 * numbers below are measured rather than picked.
 *
 * Four colour fields sit behind the interface (emerald, amber, rose, cool glass)
 * on a deep teal-ink base. Three percentages do the work of the 60-30-10 rule:
 *
 *   60%  the base, `#071113`, which is most of the screen most of the time
 *   30%  the four fields, at 20-58% opacity, which is what makes the glass visible
 *   10%  the mint accent, `#5fd6b4`, which only ever marks "this is live"
 *
 * The panel tint is the base lifted toward teal (`#16282e`) at 36% opacity. That
 * number is not a mood: it is the smallest tint at which the ink still clears
 * **7:1** composited over the brightest field (emerald at 58%), and the accent
 * still clears 4.5:1 there. A thinner sheet looks better and reads worse; this is
 * where the two meet. `tests/glass.test.mjs` recomputes it from these values.
 */

export const GLASS_THEME = {
  id: "glass",
  name: "Glass Morphism",
  note: "Light through frosted sheets: four colour fields behind translucent panels, mint for anything live.",
  tags: ["glass", "translucent", "colour", "default"],
  scheme: "dark",
  switchable: false,

  /**
   * The colours the interface uses. `bg`, `surface`, `ink` and `accent` are the
   * four the app already speaks in; the rest are this theme's own.
   */
  bg: "#071113",
  surface: "#16282e",
  ink: "#eef6f3",
  accent: "#5fd6b4",
  /** Ink that sits *on* the accent (a filled button's label). */
  accentInk: "#04110d",
  /** The quiet ink: captions, meta, anything that is not the sentence itself. */
  muted: "#a7c4bf",

  /**
   * The four fields. `alpha` is how much of the colour is in the mix over `bg`,
   * `at` is where its centre sits, `r` is its radius. Kept as data because the
   * contrast test has to be able to composite the *brightest* one.
   */
  aurora: [
    { id: "emerald", hex: "#268a78", alpha: 0.58, at: ["16%", "24%"], r: ["42%", "38%"] },
    { id: "amber", hex: "#d69648", alpha: 0.42, at: ["84%", "16%"], r: ["38%", "34%"] },
    { id: "rose", hex: "#be5858", alpha: 0.36, at: ["68%", "92%"], r: ["46%", "40%"] },
    { id: "cool", hex: "#78bec8", alpha: 0.3, at: ["12%", "84%"], r: ["34%", "36%"] },
  ],

  /** Panel tint, as an alpha over whatever is behind it. */
  glass: 0.36,
  /** Blur radius of the frosted sheet, in px. Halved in lite mode. */
  blur: 26,
  /** Saturation lift: frosted glass concentrates colour, it does not wash it out. */
  saturate: 160,
};

/** The tint as a CSS colour, from the same numbers the test measures. */
export function glassTint(alpha = GLASS_THEME.glass) {
  const hex = GLASS_THEME.surface.replace("#", "");
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
  return `${GLASS_THEME.surface}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
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
    swatches: [theme.bg, theme.surface, theme.accent],
    painted: false,
    glass: true,
  };
}
