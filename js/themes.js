/**
 * The look of the app, as data.
 *
 * Why this file exists: the app used to have exactly one appearance, spread over
 * six stylesheets with hard-coded colours. Adding a second look that way would
 * have meant a seventh stylesheet that fights the other six. Instead each style
 * below is a small set of tokens — background, surface, ink, line, accent, corner
 * radius, typeface, border weight — and `styles-custom.css` maps those tokens onto
 * the variables the app already uses. One new style is then a dozen lines and
 * cannot break the others.
 *
 * Rules that keep these honest:
 *   1. Every style must keep text readable: the contrast of `ink` on `surface` is
 *      checked by a test, not by eye.
 *   2. Every style is complete. A style never relies on another style's tokens.
 *   3. A style is a preference, not a mode: switching it never changes what the app
 *      does, only how it looks, and it is saved per device.
 */

/** Six styles, ordered from quietest to loudest. */
export const THEMES = [
  {
    id: "minimal",
    name: "Minimal",
    note: "Black, grey and white. The original — sharp edges, nothing shouting.",
    tags: ["minimal", "monochrome"],
    scheme: "dark",
    switchable: true,
    bg: "#080808", surface: "#101010", ink: "#f8f8f8", accent: "#f8f8f8",
    swatches: ["#080808", "#101010", "#f8f8f8"],
  },
  {
    id: "soft",
    name: "Soft",
    note: "Cool light greys with a single indigo accent and gentle corners.",
    tags: ["minimal", "light"],
    scheme: "light",
    switchable: false,
    bg: "#eef2f7", surface: "#ffffff", ink: "#1a1d22", accent: "#4f5bd5",
    swatches: ["#eef2f7", "#ffffff", "#4f5bd5"],
  },
  {
    id: "editorial",
    name: "Editorial",
    note: "Paper white, serif headings, a deep red rule. Reads like a printed chapter.",
    tags: ["editorial", "serif", "light"],
    scheme: "light",
    switchable: false,
    bg: "#fbfaf7", surface: "#ffffff", ink: "#12100e", accent: "#b32d1f",
    swatches: ["#fbfaf7", "#ffffff", "#b32d1f"],
  },
  {
    id: "luxury",
    name: "Luxury",
    note: "Warm ivory, thin gold hairlines, letterspaced small capitals.",
    tags: ["luxury", "serif", "light"],
    scheme: "light",
    switchable: false,
    bg: "#f6f2ea", surface: "#fffdf8", ink: "#14110d", accent: "#8a6a1e",
    swatches: ["#f6f2ea", "#fffdf8", "#8a6a1e"],
  },
  {
    id: "terminal",
    name: "Terminal",
    note: "Near-black, monospace everywhere, phosphor green for anything live.",
    tags: ["terminal", "mono", "dark"],
    scheme: "dark",
    switchable: false,
    bg: "#05070a", surface: "#0b0f14", ink: "#d7ffe9", accent: "#35ff9e",
    swatches: ["#05070a", "#0b0f14", "#35ff9e"],
  },
  {
    id: "brutal",
    name: "Neo-brutalism",
    note: "Cream paper, 3px black borders, hard offset shadows, no rounding at all.",
    tags: ["brutalism", "bold", "light"],
    scheme: "light",
    switchable: false,
    bg: "#f2efe6", surface: "#fffdf5", ink: "#0b0b0b", accent: "#ffe14d",
    swatches: ["#f2efe6", "#fffdf5", "#ffe14d"],
  },
];

export const DEFAULT_STYLE = "minimal";

/**
 * The look a brand-new device starts in, before the student has chosen one.
 *
 * The school can set this once (the `SCHOOL_DEFAULT_STYLE` environment variable
 * on the server, reported by `/api/health`); a student who picks a style keeps
 * it on that device. Deliberately per device and not per account: the same
 * student may use a projector laptop and a phone, and a shared classroom tablet
 * should not carry one student's taste to the next.
 */
export const SCHOOL_DEFAULT_STYLE = DEFAULT_STYLE;

/** A style by id, falling back to the default instead of throwing. */
export function themeById(id) {
  return THEMES.find((theme) => theme.id === id) || THEMES.find((theme) => theme.id === DEFAULT_STYLE);
}

/** Is this a style we ship? Used before saving a preference. */
export function isKnownStyle(id) {
  return THEMES.some((theme) => theme.id === id);
}

/** Only keep a style that exists, so a stale saved value cannot blank the app. */
export function normalizeStyle(id) {
  return isKnownStyle(String(id || "")) ? String(id) : DEFAULT_STYLE;
}

/**
 * Can the light/dark switch do anything in this style?
 *
 * Four styles pin their own fixed palette — a light theme has no dark twin, and
 * Terminal is dark on purpose. Offering a switch there would be a control that
 * does nothing, so the app greys it out and says why instead of pretending.
 */
export function themeSupportsSwitch(id) {
  return Boolean(themeById(id).switchable);
}

/** One plain sentence explaining the greyed-out switch, for that style. */
export function switchLockedReason(id) {
  const theme = themeById(id);
  if (themeSupportsSwitch(theme.id)) return "";
  return `${theme.name} sets its own fixed palette, so light/dark does not apply here. Choose Minimal to switch themes.`;
}

/**
 * Which style this device should paint.
 *
 * Order: what the student chose on this device, then the school's default, then
 * Minimal. A stored value always wins — a school default is a starting point,
 * never something that overwrites a choice someone already made.
 */
export function resolveStyle({ stored = "", schoolDefault = "" } = {}) {
  if (isKnownStyle(String(stored || ""))) return String(stored);
  if (isKnownStyle(String(schoolDefault || ""))) return String(schoolDefault);
  return SCHOOL_DEFAULT_STYLE;
}

/**
 * Relative luminance and contrast, so "is this readable?" is a measurement.
 * WCAG 2.2 AA wants 4.5:1 for body text and 3:1 for large text.
 */
export function luminance(hex) {
  const value = String(hex || "").replace("#", "");
  const full = value.length === 3 ? value.split("").map((part) => part + part).join("") : value;
  const channels = [0, 2, 4].map((start) => parseInt(full.slice(start, start + 2), 16) / 255);
  const linear = channels.map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

export function contrast(bg, ink) {
  const first = luminance(bg);
  const second = luminance(ink);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Ink on surface, and ink on background, for one style — the two pairs that matter.
 *
 * These read the named `bg`/`surface`/`ink` fields rather than the preview
 * swatches, because the third swatch is the accent: a colour chosen to be seen in
 * small amounts, never to carry body text. (The first version of this file made
 * that mistake, and the test caught the gold on ivory at 3.9:1.)
 */
export function themeContrast(theme) {
  return {
    onSurface: Math.round(contrast(theme.surface, theme.ink) * 100) / 100,
    onBackground: Math.round(contrast(theme.bg, theme.ink) * 100) / 100,
    accentOnSurface: Math.round(contrast(theme.surface, theme.accent) * 100) / 100,
  };
}
