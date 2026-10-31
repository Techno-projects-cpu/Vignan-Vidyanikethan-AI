import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  NOTES_KEY,
  NOTE_LIMIT,
  NOTE_MAX_LENGTH,
  addNote,
  noteKey,
  normalizeNote,
  normalizeNotes,
  notesFor,
  notesForBook,
  notesMarkdown,
  readNotes,
  removeNote,
  writeNotes,
} from "../js/notes.js";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(fileURLToPath(new URL(path, root)), "utf8");
const reader = read("js/reader.js");

/** A storage stand-in, so the same code path as the browser is exercised. */
const makeStorage = () => {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    map,
  };
};

test("a note is one clean line, pinned to one page", () => {
  assert.equal(noteKey("book-1", 4), "book-1::4");
  assert.equal(noteKey("book-1", "x"), "book-1::1", "an unknown page falls back to the first");
  assert.equal(normalizeNote("  Moment   = force ×\ndistance  "), "Moment = force × distance");
  assert.equal(normalizeNote("x".repeat(400)).length, NOTE_MAX_LENGTH);
  assert.equal(normalizeNote("   "), "");
});

test("one note per page: saving again updates instead of piling up", () => {
  let notes = addNote([], { bookId: "b1", page: 4, text: "first" });
  notes = addNote(notes, { bookId: "b1", page: 4, text: "second" });
  assert.equal(notes.length, 1);
  assert.equal(notes[0].text, "second");
  notes = addNote(notes, { bookId: "b1", page: 9, text: "another page" });
  assert.equal(notesFor(notes, "b1", 4)[0].text, "second");
  assert.equal(notesFor(notes, "b1", 9)[0].text, "another page");
  assert.deepEqual(notesForBook(notes, "b1").map((note) => note.page), [4, 9]);
  assert.deepEqual(notesForBook(notes, "other-book"), []);
});

test("deleting and empty input never corrupt the store", () => {
  const notes = addNote([], { bookId: "b1", page: 4, text: "keep" });
  assert.equal(removeNote(notes, "b1::4").length, 0);
  assert.equal(removeNote(notes, "missing").length, 1);
  assert.deepEqual(addNote(notes, { bookId: "b1", page: 4, text: "   " }), notes, "blank text changes nothing");
  assert.deepEqual(addNote(notes, { bookId: "", page: 4, text: "no book" }), notes);
});

test("anything read back from storage is checked before it reaches the page", () => {
  const messy = [
    { bookId: "b1", page: 2, text: "good" },
    { bookId: "b1", page: "not a page", text: "bad page" },
    { bookId: "", page: 3, text: "no book" },
    { text: "no book at all" },
    null,
    "a string",
    { bookId: "b1", page: 2, text: "duplicate id, dropped" },
  ];
  const clean = normalizeNotes(messy);
  assert.equal(clean.length, 1);
  assert.equal(clean[0].text, "good");
  assert.deepEqual(normalizeNotes("nope"), []);
  const many = Array.from({ length: NOTE_LIMIT + 40 }, (_, i) => ({ bookId: "b1", page: i + 1, text: `note ${i}` }));
  assert.equal(normalizeNotes(many).length, NOTE_LIMIT, "the store has a ceiling");
});

test("notes survive a write and read, and a broken store never throws", () => {
  const storage = makeStorage();
  const saved = writeNotes([{ bookId: "b1", page: 5, text: "  pinned  " }], storage);
  assert.equal(saved.length, 1);
  assert.ok(storage.getItem(NOTES_KEY).includes("pinned"));
  assert.deepEqual(readNotes(storage).map((note) => note.text), ["pinned"]);
  const broken = { getItem: () => "{not json", setItem: () => { throw new Error("full"); }, removeItem() {} };
  assert.deepEqual(readNotes(broken), []);
  assert.equal(writeNotes([{ bookId: "b1", page: 1, text: "x" }], broken).length, 1, "the reader keeps working");
});

test("notes export as a page-ordered Markdown file", () => {
  const notes = [
    { bookId: "b1", page: 9, text: "later page" },
    { bookId: "b1", page: 2, text: "earlier page" },
  ];
  const markdown = notesMarkdown(notes, { title: "Physics Notes" });
  assert.match(markdown, /^# Physics Notes — my notes/);
  assert.ok(markdown.indexOf("p. 2") < markdown.indexOf("p. 9"), "pages are ordered");
  assert.match(markdown, /Saved on this device only/);
  assert.equal(notesMarkdown([]), "");
});

test("the reader offers a note box on the page, not a separate screen", () => {
  assert.match(reader, /import \{[^}]*notesFor[^}]*\} from "\.\/notes\.js\?v=\d+"/);
  assert.match(reader, /const notesBlock = element\("section", "reader-notes"\)/);
  assert.match(reader, /content\.append\(toolbar, searchWrap, pageText, sourceNote, notesBlock\)/);
  assert.match(reader, /const noteHint = element\("p", "reader-note-hint", t\("reader\.noteHint"\)\)/);
  assert.match(reader, /noteSave\.textContent = t\(existing \? "reader\.noteUpdate" : "reader\.noteSave"\)/);
  assert.match(reader, /event\.key === "Enter" && \(event\.metaKey \|\| event\.ctrlKey\)/, "Ctrl+Enter saves");
  assert.match(reader, /notesMarkdown\(mine, \{ title: book\?\.title \|\| "My book" \}\)/);
  assert.match(reader, /aria-label", `\$\{t\("reader\.noteDelete"\)\} · \$\{t\("reader\.page"\)\} \$\{note\.page\}`/, "each note has its own delete");
});
