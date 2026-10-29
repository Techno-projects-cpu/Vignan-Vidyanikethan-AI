/**
 * Small, deterministic monogram avatars.
 *
 * No uploads and no image hosting: the pattern comes from the student's own
 * name, so the same classmate looks the same on every device without storing
 * anything. A student can pin a favourite instead of the derived one, and that
 * choice is stored in their social profile (`avatar_seed`) so classmates see
 * it too.
 *
 * Eight patterns, all in the black/grey/white palette. Nothing here decides
 * gender, age or anything personal — it is decoration.
 */

export const AVATAR_PATTERNS = ["plain", "diagonal", "dots", "grid", "ring", "stripes", "corner", "split"];

const PATTERN_PREFIX = "p";

/** Stable 32-bit hash so the same name always maps to the same pattern. */
export function hashName(text = "") {
  let hash = 2166136261;
  for (const char of String(text)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** First visible character, which is a whole grapheme in Tamil or Devanagari. */
export function avatarInitials(name = "") {
  const trimmed = String(name || "").trim();
  if (!trimmed) return "V";
  const letters = [...trimmed.matchAll(/[\p{L}\p{N}]/gu)].map((match) => match[0]);
  if (!letters.length) return "V";
  // Two initials are easier to tell apart in a list of classmate names.
  const first = letters[0];
  const second = letters.find((letter, index) => index > 0 && /[\p{L}\p{N}]/u.test(letter));
  return (second ? `${first}${second}` : first).toUpperCase();
}

/** Turn a stored seed ("p3") or a name into the pattern key to render. */
export function avatarPattern(seedOrName = "", name = "") {
  const seed = String(seedOrName || "").trim().toLowerCase();
  if (seed.startsWith(PATTERN_PREFIX)) {
    const index = Number.parseInt(seed.slice(PATTERN_PREFIX.length), 10);
    if (Number.isInteger(index) && index >= 0 && index < AVATAR_PATTERNS.length) return AVATAR_PATTERNS[index];
  }
  return AVATAR_PATTERNS[hashName(name || seed) % AVATAR_PATTERNS.length];
}

/** The value to store when a student picks the swatch at `index`. */
export function avatarSeed(index) {
  const safe = Number.isInteger(index) ? Math.min(AVATAR_PATTERNS.length - 1, Math.max(0, index)) : 0;
  return `${PATTERN_PREFIX}${safe}`;
}

/** Index of a stored seed, or -1 when the seed is not one of ours. */
export function avatarSeedIndex(seed = "") {
  const text = String(seed || "").trim().toLowerCase();
  if (!text.startsWith(PATTERN_PREFIX)) return -1;
  const index = Number.parseInt(text.slice(PATTERN_PREFIX.length), 10);
  return Number.isInteger(index) && index >= 0 && index < AVATAR_PATTERNS.length ? index : -1;
}

/**
 * Paint an existing element. Passing `seed` wins over the derived pattern, so a
 * pinned choice survives everywhere the avatar is drawn.
 */
export function decorateAvatar(node, { name = "", seed = "", online = false } = {}) {
  if (!node) return node;
  node.textContent = avatarInitials(name);
  node.dataset.avatar = avatarPattern(seed, name);
  node.classList.toggle("online", Boolean(online));
  node.setAttribute("aria-hidden", "true");
  return node;
}
