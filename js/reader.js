/** Page-level textbook reader used by every citation. */

import { element, openModal, qs, showToast } from "./ui.js?v=31";
import { safeUrl, truncate } from "./util.js?v=31";

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

export function openReader({ book, pages = [], initialPage = 1, highlight = "" } = {}) {
  const pageList = pages.length ? pages : (book?.pages || []).map((page) => ({ ...page }));
  if (!pageList.length) {
    showToast("No page text is stored for this book.", "warning");
    return;
  }
  const initialIndex = pageIndexForCitation(pageList, initialPage);
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
  const previous = element("button", "button ghost small", "← Prev");
  const next = element("button", "button ghost small", "Next →");
  const pageLabel = element("span", "reader-page-label", "");
  const openPdf = element("a", "button ghost small", "Open PDF at page");
  openPdf.target = "_blank";
  openPdf.rel = "noopener noreferrer";
  if (!pdfUrl) openPdf.classList.add("hidden");
  controls.append(previous, pageLabel, next, openPdf);
  const origin = safeUrl(book?.sourceUrl);
  if (origin) {
    const openOrigin = element("a", "button ghost small", "Open original web source ↗");
    openOrigin.href = origin;
    openOrigin.target = "_blank";
    openOrigin.rel = "noopener noreferrer";
    controls.appendChild(openOrigin);
  }
  toolbar.append(title, controls);
  const searchWrap = element("label", "reader-search");
  const search = document.createElement("input");
  search.type = "search";
  search.placeholder = "Find words in this book";
  search.setAttribute("aria-label", "Find words in this book");
  const searchStatus = element("span", "reader-search-status", "");
  searchStatus.setAttribute("role", "status");
  searchWrap.append(search, searchStatus);
  const pageText = element("div", "reader-page-text");
  const sourceNote = element("div", "reader-note");
  content.append(toolbar, searchWrap, pageText, sourceNote);
  wrapper.append(sidebar, content);

  const pageButtons = pageList.map((page, index) => {
    const button = element(
      "button",
      "reader-page-button",
      `${book?.sourceUrl && book?.type !== "pdf" ? "Section" : "Page"} ${page.page || index + 1}${page.heading && page.heading !== "Notes" ? ` · ${truncate(page.heading, 28)}` : ""}`,
    );
    button.type = "button";
    button.dataset.page = String(index + 1);
    button.addEventListener("click", () => render(index + 1, search.value));
    sidebar.appendChild(button);
    return button;
  });

  function render(pageNumber, searchText = "") {
    current = Math.min(Math.max(1, pageNumber), pageList.length);
    const page = pageList[current - 1];
    title.textContent = `${book?.title || "Book"} · ${page.heading && page.heading !== "Notes" ? page.heading : "Page"}`.slice(0, 90);
    pageLabel.textContent = `${book?.sourceUrl && book?.type !== "pdf" ? "Section" : "Page"} ${page.page || current} · ${current} of ${pageList.length}`;
    previous.disabled = current <= 1;
    next.disabled = current >= pageList.length;
    pageText.replaceChildren();
    appendHighlighted(pageText, page.text || "", searchText || (current === initialIndex + 1 ? highlight : ""));
    sourceNote.textContent = book?.sourceUrl
      ? `Imported from a public website. Verify the original.${book?.type !== "pdf" ? " Text sections are approximate." : ""}`
      : `${book?.subject || "Textbook"}${book?.board ? ` · ${book.board}` : ""}${book?.grade ? ` · Class ${book.grade}` : ""}`;
    if (pdfUrl) openPdf.href = `${pdfUrl}#page=${page.page || current}`;
    pageButtons.forEach((button, index) => button.classList.toggle("active", index + 1 === current));
    qs(".reader-pages", wrapper)?.querySelector(".active")?.scrollIntoView({ block: "nearest" });
  }

  search.addEventListener("input", () => {
    const query = search.value.trim().toLocaleLowerCase();
    let matches = 0;
    pageButtons.forEach((button, index) => {
      const page = pageList[index];
      const haystack = `${page.page || index + 1} ${page.heading || ""} ${page.text || ""}`.toLocaleLowerCase();
      button.hidden = Boolean(query) && !haystack.includes(query);
      if (!button.hidden) matches += 1;
    });
    searchStatus.textContent = query ? `${matches} ${matches === 1 ? "page" : "pages"} found · press Enter to open the first` : "";
  });
  search.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const firstMatch = pageButtons.findIndex((button) => !button.hidden);
    if (firstMatch >= 0) render(firstMatch + 1, search.value);
  });
  previous.addEventListener("click", () => render(current - 1, search.value));
  next.addEventListener("click", () => render(current + 1, search.value));
  render(current);

  openModal({
    title: `Reader — ${book?.title || "Book"}`,
    content: wrapper,
    wide: true,
    className: "reader-modal",
    onClose: () => {
      if (pdfUrl) setTimeout(() => URL.revokeObjectURL(pdfUrl), 60_000);
    },
  });
}
