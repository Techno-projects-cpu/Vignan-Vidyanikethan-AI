/**
 * Small, dependency-free helpers shared by the Vignan Vidyanikethan AI modules.
 * Everything in this file is safe to import in a browser or in Node.
 */

export const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export const unique = (items) => [...new Set(items)];

export function uid(prefix = "id") {
  const random = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\u00a0/g, " ")
    .replace(/[‐-―]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Loose equality for short student answers: case, punctuation and spacing tolerant. */
export function normalizeAnswer(value) {
  return normalizeText(value)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\b(a|an|the|of|to|is|are|was|were|in|on|for|and)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function titleCase(value) {
  return String(value ?? "").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function plural(count, singular, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export function formatDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function localDay(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const offset = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
}

export function truncate(value, max = 220) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

export function safeUrl(value) {
  try {
    const url = new URL(value, globalThis.location?.href || "https://example.invalid");
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function debounce(fn, wait = 180) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), wait);
  };
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Could not read file"));
    reader.readAsText(file);
  });
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Linear interpolation with a smooth ease-out curve. */
export function easeOut(t) {
  return 1 - Math.pow(1 - clamp(t), 3);
}

export function levenshtein(a, b) {
  const left = normalizeAnswer(a);
  const right = normalizeAnswer(b);
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  let previous = Array.from({ length: right.length + 1 }, (_, i) => i);
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= right.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[right.length];
}

export function wordOverlap(a, b) {
  const left = new Set(normalizeAnswer(a).split(/\s+/).filter((w) => w.length > 2));
  const right = new Set(normalizeAnswer(b).split(/\s+/).filter((w) => w.length > 2));
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return (2 * shared) / (left.size + right.size);
}
