/** Page-level textbook reader used by every citation. */

import { closeModal, element, openModal, qs, showToast } from "./ui.js?v=39";
import { t } from "./i18n.js?v=39";
import { downloadBlob, safeUrl, truncate } from "./util.js?v=39";
import {
  addNote,
  notesFor,
  notesForBook,
  notesMarkdown,
  notesStorage,
  readNotes,
  removeNote,
  writeNotes,
} from "./notes.js?v=39";

const LAST_PAGE_PREFIX = "vignan.reader.page.";

/** Where this device stopped reading a book. Citations never use this. */
export function lastReadPage(bookId, storage = globalThis.localStorage) {
  try {
    const value = Number(storage?.getItem(`${LAST_PAGE_PREFIX}${bookId}`));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function rememberReadPage(bookId, page, storage = globalThis.localStorage) {
  try {
    storage?.setItem(`${LAST_PAGE_PREFIX}${bookId}`, String(Number(page) || 1));
  } catch {
    /* private mode: reading still works, it just does not resume */
  }
}

/** Resolve a cited page number, which may not equal its position in pasted notes. */
export function pageIndexForCitation(pages = [], pageNumber = 1) {
  if (!pages.length) return 0;
  const requested = Number(pageNumber) || 1;
  const match = pages.findIndex((page) => Number(page.page) === requested);
  if (match >= 0) return match;
  // Legacy pages without labels use their position; a missing explicit page
  // must not silently open a different page at the end of the book.
  if (pages.some((page) => page.page != null)) return 0;
  return Math.min(Math.max(0, requested - 1), pages.length - 1);
}

export function findHighlight(text, highlight) {
  const target = String(highlight || "").replace(/\s+/g, " ").trim().slice(0, 140);
  if (!target) return null;
  const source = String(text || "").replace(/\s+/g, " ");
  const index = source.toLocaleLowerCase().indexOf(target.toLocaleLowerCase());
  return index < 0 ? null : { source, index, length: target.length };
}

function appendHighlighted(container, text, highlight) {
  const found = findHighlight(text, highlight);
  if (!found) {
    container.textContent = text;
    return;
  }
  const { source, index, length } = found;
  container.append(document.createTextNode(source.slice(0, index)));
  container.appendChild(element("mark", "", source.slice(index, index + length)));
  container.append(document.createTextNode(source.slice(index + length)));
}

export function openReader({ book, pages = [], initialPage = 0, highlight = "" } = {}) {
  const pageList = pages.length ? pages : (book?.pages || []).map((page) => ({ ...page }));
  if (!pageList.length) {
    showToast(t("reader.noText"), "warning");
    return;
  }
  const bookId = String(book?.id || book?.title || "book");
  // A citation must open the page it cites. Opening a book to *read* has no
  // page in mind, so it continues where this device stopped.
  const citedPage = Number(initialPage) || 0;
  const resumed = citedPage ? 0 : lastReadPage(bookId);
  const startPage = citedPage || resumed || 1;
  const initialIndex = pageIndexForCitation(pageList, startPage);
  let current = initialIndex + 1;
  let pdfUrl = null;
  if (book?.fileBlob) {
    try {
      pdfUrl = URL.createObjectURL(book.fileBlob);
    } catch {
      pdfUrl = null;
    }
  }

  const wrapper = element("div", "reader");
  const sidebar = element("aside", "reader-pages");
  const content = element("section", "reader-content");
  const toolbar = element("div", "reader-toolbar");
  const title = element("div", "reader-title");
  const controls = element("div", "reader-controls");
  const previous = element("button", "button ghost small", t("reader.prev"));
  const next = element("button", "button ghost small", t("reader.next"));
  const pageLabel = element("span", "reader-page-label", "");
  // Reading happens on phones in bright rooms and on a projector at the back of
  // a classroom. One fixed size cannot serve both, so the reader keeps its own.
  const SIZES = [13, 14, 16, 18, 21];
  const SIZE_KEY = "vignan.reader.size";
  const readSize = () => {
    try {
      const stored = Number(localStorage.getItem(SIZE_KEY));
      return SIZES.includes(stored) ? stored : 14;
    } catch {
      return 14;
    }
  };
  const sizeDown = element("button", "button ghost small", "A−");
  const sizeUp = element("button", "button ghost small", "A+");
  sizeDown.type = "button";
  sizeUp.type = "button";
  sizeDown.setAttribute("aria-label", t("reader.smaller"));
  sizeUp.setAttribute("aria-label", t("reader.larger"));
  // Turn reading into asking without retyping: the question is built from the
  // page in front of the student, so it retrieves that page and nothing else.
  const askPage = element("button", "button ghost small", t("reader.askPage"));
  askPage.type = "button";
  askPage.addEventListener("click", () => {
    const current$ = pageList[current - 1];
    const text = String(current$?.text || "").replace(/\s+/g, " ").trim();
    const lead = truncate((text.split(/(?<=\.)\s+/)[0] || current$?.heading || "").trim(), 110);
    const topic = lead || current$?.heading || book?.title || "";
    const question = `Explain this from my book: "${topic}"`;
    closeModal();
    window.dispatchEvent(new window.CustomEvent("vignan:ask-page", {
      detail: { question, book: book?.title || "", page: current$?.page || current },
    }));
  });
  const openPdf = element("a", "button ghost small", t("reader.openPdf"));
  openPdf.target = "_blank";
  openPdf.rel = "noopener noreferrer";
  if (!pdfUrl) openPdf.classList.add("hidden");
  controls.append(previous, pageLabel, next, sizeDown, sizeUp, askPage, openPdf);
  const origin = safeUrl(book?.sourceUrl);
  if (origin) {
    const openOrigin = element("a", "button ghost small", t("reader.openSource"));
    openOrigin.href = origin;
    openOrigin.target = "_blank";
    openOrigin.rel = "noopener noreferrer";
    controls.appendChild(openOrigin);
  }
  toolbar.append(title, controls);
  const searchWrap = element("label", "reader-search");
  const search = document.createElement("input");
  search.type = "search";
  search.placeholder = t("reader.find");
  search.setAttribute("aria-label", t("reader.find"));
  const searchStatus = element("span", "reader-search-status", "");
  searchStatus.setAttribute("role", "status");
  searchWrap.append(search, searchStatus);
  // Opening a citation should answer "where is that passage?" in one click.
  // The filter is only offered when there is a passage to look for.
  let matchOnly = false;
  let onlyMatch = null;
  if (String(highlight || "").trim()) {
    onlyMatch = element("button", "button ghost small reader-only-match", t("reader.onlyMatch"));
    onlyMatch.type = "button";
    onlyMatch.setAttribute("aria-pressed", "false");
    searchWrap.appendChild(onlyMatch);
  }
  const pageText = element("div", "reader-page-text");
  const sourceNote = element("div", "reader-note");

  /* ---- My note on this page ------------------------------------------- */
  // Reading and writing belong on one screen: the sentence a student wants to
  // remember is on screen when they decide to write it down.
  const storage = notesStorage();
  let notes = readNotes(storage);
  const notesBlock = element("section", "reader-notes");
  const notesHead = element("div", "reader-notes-head");
  notesHead.appendChild(element("strong", "", t("reader.notesTitle")));
  const notesCount = element("span", "reader-notes-count", "");
  notesHead.appendChild(notesCount);
  const noteInput = document.createElement("textarea");
  noteInput.className = "reader-note-input";
  noteInput.rows = 2;
  noteInput.maxLength = 280;
  noteInput.placeholder = t("reader.notesPlaceholder");
  noteInput.setAttribute("aria-label", t("reader.notesTitle"));
  const noteRow = element("div", "reader-note-row");
  const noteSave = element("button", "button small", t("reader.noteSave"));
  noteSave.type = "button";
  const noteDelete = element("button", "button ghost small", t("reader.noteDelete"));
  noteDelete.type = "button";
  const noteHint = element("p", "reader-note-hint", t("reader.noteHint"));
  noteRow.append(noteSave, noteDelete);
  const noteList = element("ul", "reader-note-list");
  const exportNotes = element("button", "button ghost small", t("reader.notesExport"));
  exportNotes.type = "button";
  notesBlock.append(notesHead, noteInput, noteRow, noteHint, noteList, exportNotes);
  content.append(toolbar, searchWrap, pageText, sourceNote, notesBlock);
  wrapper.append(sidebar, content);

  const pageButtons = pageList.map((page, index) => {
    const button = element(
      "button",
      "reader-page-button",
      `${book?.sourceUrl && book?.type !== "pdf" ? t("reader.section") : t("reader.page")} ${page.page || index + 1}${page.heading && page.heading !== "Notes" ? ` · ${truncate(page.heading, 28)}` : ""}`,
    );
    button.type = "button";
    button.dataset.page = String(index + 1);
    button.addEventListener("click", () => render(index + 1, search.value));
    sidebar.appendChild(button);
    return button;
  });

  // Typing a note and then turning the page used to throw the sentence away
  // silently. A draft per page survives until the reader is closed, and never
  // outlives it — a draft is not a note.
  const drafts = new Map();
  let shownPage = 0;

  function paintNotes(page) {
    const pageNumber = page.page || current;
    if (shownPage && shownPage !== pageNumber) drafts.set(shownPage, noteInput.value);
    shownPage = pageNumber;
    const existing = notesFor(notes, bookId, pageNumber)[0];
    noteInput.value = drafts.has(pageNumber) ? drafts.get(pageNumber) : existing ? existing.text : "";
    noteSave.textContent = t(existing ? "reader.noteUpdate" : "reader.noteSave");
    noteDelete.hidden = !existing;
    noteList.replaceChildren();
    for (const note of notesFor(notes, bookId, pageNumber)) {
      const item = element("li", "reader-note-item", note.text);
      const drop = element("button", "reader-note-drop", "×");
      drop.type = "button";
      drop.setAttribute("aria-label", `${t("reader.noteDelete")} · ${t("reader.page")} ${note.page}`);
      drop.addEventListener("click", () => {
        notes = writeNotes(removeNote(notes, note.id), storage);
        drafts.delete(pageNumber);
        paintNotes(page);
      });
      item.appendChild(drop);
      noteList.appendChild(item);
    }
    const total = notesForBook(notes, bookId).length;
    notesCount.textContent = total ? t("reader.notesOnBook", { count: total }) : "";
    exportNotes.hidden = total === 0;
  }

  function saveNote() {
    if (!noteInput.value.trim()) {
      showToast(t("reader.noteEmpty"), "warning");
      return;
    }
    const page = pageList[current - 1];
    const pageNumber = page.page || current;
    const wasThere = Boolean(notesFor(notes, bookId, pageNumber)[0]);
    notes = writeNotes(addNote(notes, { bookId, page: pageNumber, text: noteInput.value }), storage);
    drafts.delete(pageNumber);
    paintNotes(page);
    showToast(t(wasThere ? "reader.noteUpdated" : "reader.noteSaved"), "success", 2200);
  }

  noteSave.addEventListener("click", saveNote);
  noteInput.addEventListener("keydown", (event) => {
    // Ctrl/Cmd+Enter saves without leaving the keyboard.
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      saveNote();
    }
  });
  noteDelete.addEventListener("click", () => {
    const page = pageList[current - 1];
    const existing = notesFor(notes, bookId, page.page || current)[0];
    if (!existing) return;
    notes = writeNotes(removeNote(notes, existing.id), storage);
    paintNotes(page);
    showToast(t("reader.noteDeleted"), "info", 1800);
  });
  exportNotes.addEventListener("click", () => {
    const mine = notesForBook(notes, bookId);
    if (!mine.length) return;
    const name = String(book?.title || "notes").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "notes";
    downloadBlob(new Blob([notesMarkdown(mine, { title: book?.title || "My book" })], { type: "text/markdown;charset=utf-8" }), `${name}-notes.md`);
    showToast(t("reader.notesExported"), "success");
  });

  function render(pageNumber, searchText = "") {
    current = Math.min(Math.max(1, pageNumber), pageList.length);
    const page = pageList[current - 1];
    title.textContent = `${book?.title || t("reader.untitled")} · ${page.heading && page.heading !== "Notes" ? page.heading : t("reader.page")}`.slice(0, 90);
    pageLabel.textContent = t("reader.position", {
      label: book?.sourceUrl && book?.type !== "pdf" ? t("reader.section") : t("reader.page"),
      page: page.page || current,
      current,
      total: pageList.length,
    });
    previous.disabled = current <= 1;
    next.disabled = current >= pageList.length;
    pageText.replaceChildren();
    appendHighlighted(pageText, page.text || "", searchText || (current === initialIndex + 1 ? highlight : ""));
    sourceNote.textContent = book?.sourceUrl
      ? `${t("reader.imported")}${book?.type !== "pdf" ? ` ${t("reader.approx")}` : ""}`
      : `${book?.subject || "Textbook"}${book?.board ? ` · ${book.board}` : ""}${book?.grade ? ` · Class ${book.grade}` : ""}`;
    paintNotes(page);
    rememberReadPage(bookId, page.page || current);
    if (pdfUrl) openPdf.href = `${pdfUrl}#page=${page.page || current}`;
    pageButtons.forEach((button, index) => button.classList.toggle("active", index + 1 === current));
    qs(".reader-pages", wrapper)?.querySelector(".active")?.scrollIntoView({ block: "nearest" });
  }

  function applyFilters() {
    const query = search.value.trim().toLocaleLowerCase();
    const quote = String(highlight || "").replace(/\s+/g, " ").trim().toLocaleLowerCase();
    let matches = 0;
    pageButtons.forEach((button, index) => {
      const page = pageList[index];
      const haystack = `${page.page || index + 1} ${page.heading || ""} ${page.text || ""}`.toLocaleLowerCase();
      const text = String(page.text || "").replace(/\s+/g, " ").toLocaleLowerCase();
      const hiddenBySearch = Boolean(query) && !haystack.includes(query);
      const hiddenByMatch = matchOnly && quote && !text.includes(quote);
      button.hidden = Boolean(hiddenBySearch || hiddenByMatch);
      if (!button.hidden) matches += 1;
    });
    if (query) {
      searchStatus.textContent = t(matches === 1 ? "reader.foundOne" : "reader.foundMany", { count: matches });
    } else if (matchOnly) {
      searchStatus.textContent = t(matches === 1 ? "reader.holdsOne" : "reader.holdsMany", { count: matches });
    } else {
      searchStatus.textContent = "";
    }
    onlyMatch?.setAttribute("aria-pressed", matchOnly ? "true" : "false");
    onlyMatch?.classList.toggle("active", matchOnly);
  }

  search.addEventListener("input", applyFilters);
  search.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const firstMatch = pageButtons.findIndex((button) => !button.hidden);
    if (firstMatch >= 0) render(firstMatch + 1, search.value);
  });
  onlyMatch?.addEventListener("click", () => {
    matchOnly = !matchOnly;
    applyFilters();
    // Jump to the page that actually holds the passage rather than making the
    // student hunt through a filtered list.
    if (!matchOnly) return;
    const target = pageButtons.findIndex((button) => !button.hidden);
    if (target >= 0 && pageButtons[current - 1]?.hidden) render(target + 1, search.value);
  });

  let size = readSize();
  function applySize() {
    pageText.style.fontSize = `${size}px`;
    sizeDown.disabled = size <= SIZES[0];
    sizeUp.disabled = size >= SIZES[SIZES.length - 1];
    try {
      localStorage.setItem(SIZE_KEY, String(size));
    } catch {
      /* storage can be blocked; the size still applies for this visit */
    }
  }
  sizeDown.addEventListener("click", () => {
    size = SIZES[Math.max(0, SIZES.indexOf(size) - 1)];
    applySize();
  });
  sizeUp.addEventListener("click", () => {
    size = SIZES[Math.min(SIZES.length - 1, SIZES.indexOf(size) + 1)];
    applySize();
  });

  previous.addEventListener("click", () => render(current - 1, search.value));
  next.addEventListener("click", () => render(current + 1, search.value));
  // Arrow keys page through the book, the way every reader a student has used
  // does — except while they are typing in the search box.
  function onKey(event) {
    if (event.target === search || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === "ArrowLeft" && current > 1) {
      event.preventDefault();
      render(current - 1, search.value);
    } else if (event.key === "ArrowRight" && current < pageList.length) {
      event.preventDefault();
      render(current + 1, search.value);
    }
  }
  document.addEventListener("keydown", onKey);
  render(current);
  applySize();
  if (resumed && current > 1) {
    showToast(t("reader.continueFrom", { page: pageList[current - 1]?.page || current }), "info", 2600);
  }

  openModal({
    title: t("reader.title", { title: book?.title || t("reader.untitled") }),
    content: wrapper,
    wide: true,
    className: "reader-modal",
    onClose: () => {
      document.removeEventListener("keydown", onKey);
      if (pdfUrl) setTimeout(() => URL.revokeObjectURL(pdfUrl), 60_000);
    },
  });
}
