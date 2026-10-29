/**
 * Page notes — the student's own words, pinned to a page.
 *
 * Why this exists: the reader opens at exactly the page a student needs, and
 * then there was nowhere to write "this is the line the examiner wants". The
 * notes stay on this device, next to the page, and can leave the app as a
 * Markdown file. Nothing here is sent to a server or to a model.
 *
 * The storage functions take the storage object as an argument, so the same
 * code runs in a browser and in a test without a window.
 */

export const NOTES_KEY = "vignan.reader.notes";
export const NOTE_LIMIT = 300;
export const NOTE_MAX_LENGTH = 280;

/** One note per page plus the page it sits on; stable across reloads. */
export function noteKey(bookId, page) {
  return `${String(bookId || "")}::${Number(page) || 1}`;
}

/** A note is one clean line: newlines and runs of spaces are not information. */
export function normalizeNote(text = "") {
  return String(text || "").replace(/\s+/g, " ").trim().slice(0, NOTE_MAX_LENGTH);
}

/** Anything read from disk is checked before it reaches the page. */
export function normalizeNotes(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const notes = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const text = normalizeNote(entry.text);
    const bookId = String(entry.bookId || "");
    const page = Number(entry.page);
    if (!text || !bookId || !Number.isFinite(page)) continue;
    const id = String(entry.id || noteKey(bookId, page));
    if (seen.has(id)) continue;
    seen.add(id);
    notes.push({
      id,
      bookId,
      page,
      text,
      createdAt: typeof entry.createdAt === "string" ? entry.createdAt : "",
    });
  }
  return notes.slice(0, NOTE_LIMIT);
}

/** Add or replace the note on one page. Returns a new list. */
export function addNote(notes = [], { bookId, page, text, createdAt = "" } = {}) {
  const clean = normalizeNote(text);
  if (!clean || !bookId) return normalizeNotes(notes);
  const key = noteKey(bookId, page);
  const without = normalizeNotes(notes).filter((note) => note.id !== key);
  return normalizeNotes([
    ...without,
    { id: key, bookId, page: Number(page) || 1, text: clean, createdAt: createdAt || new Date().toISOString() },
  ]);
}

/** Remove one note by id. Returns a new list. */
export function removeNote(notes = [], id = "") {
  return normalizeNotes(notes).filter((note) => note.id !== String(id));
}

export function notesFor(notes = [], bookId = "", page = 1) {
  const key = noteKey(bookId, page);
  return normalizeNotes(notes).filter((note) => note.id === key);
}

export function notesForBook(notes = [], bookId = "") {
  return normalizeNotes(notes)
    .filter((note) => note.bookId === String(bookId))
    .sort((a, b) => (Number(a.page) || 0) - (Number(b.page) || 0));
}

/**
 * A note file that reads like a list of pages, not like a database dump.
 * Page numbers lead, because that is how a student finds them again in the book.
 */
export function notesMarkdown(notes = [], { title = "Notes" } = {}) {
  const rows = normalizeNotes(notes).sort((a, b) => (Number(a.page) || 0) - (Number(b.page) || 0));
  if (!rows.length) return "";
  const head = [`# ${title} — my notes`, "", "_Written by me in the Vignan AI reader. Saved on this device only._", ""];
  for (const note of rows) {
    head.push(`- **p. ${note.page}** — ${note.text}`);
  }
  return `${head.join("\n")}\n`;
}

const memory = { value: null };

/** localStorage, or an in-memory stand-in when the browser blocks storage. */
export function notesStorage(scope = globalThis) {
  try {
    const storage = scope?.localStorage;
    if (storage) {
      const probe = "__vignan_notes_probe__";
      storage.setItem(probe, "1");
      storage.removeItem(probe);
      return storage;
    }
  } catch {
    /* private mode or a blocked origin */
  }
  return {
    getItem: () => memory.value,
    setItem: (_key, value) => { memory.value = value; },
    removeItem: () => { memory.value = null; },
  };
}

export function readNotes(storage = notesStorage()) {
  try {
    return normalizeNotes(JSON.parse(storage.getItem(NOTES_KEY) || "[]"));
  } catch {
    return [];
  }
}

/** Writes are best-effort: a full disk must not break the reader. */
export function writeNotes(notes = [], storage = notesStorage()) {
  const clean = normalizeNotes(notes);
  try {
    storage.setItem(NOTES_KEY, JSON.stringify(clean));
    return clean;
  } catch {
    return clean;
  }
}
