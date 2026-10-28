/** Page-level textbook reader used by every citation. */

import { element, openModal, qs, showToast } from "./ui.js?v=11";
import { truncate } from "./util.js";

function appendHighlighted(container, text, highlight) {
  const needle = String(highlight || "").replace(/\s+/g, " ").trim();
  if (!needle) {
    container.textContent = text;
    return;
  }
  const source = String(text || "").replace(/\s+/g, " ");
  const target = needle.slice(0, 140).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(target, "i"));
  if (!match || match.index === undefined) {
    container.textContent = text;
    return;
  }
  const before = source.slice(0, match.index);
  const after = source.slice(match.index + match[0].length);
  container.append(document.createTextNode(before));
  container.appendChild(element("mark", "", match[0]));
  container.append(document.createTextNode(after));
}

export function openReader({ book, pages = [], initialPage = 1, highlight = "" } = {}) {
  const pageList = pages.length ? pages : (book?.pages || []).map((page) => ({ ...page }));
  if (!pageList.length) {
    showToast("No page text is stored for this book.", "warning");
    return;
  }
  let current = Math.min(Math.max(1, Number(initialPage) || 1), pageList.length);
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
  toolbar.append(title, controls);
  const pageText = element("div", "reader-page-text");
  const sourceNote = element("div", "reader-note");
  content.append(toolbar, pageText, sourceNote);
  wrapper.append(sidebar, content);

  const pageButtons = pageList.map((page, index) => {
    const button = element(
      "button",
      "reader-page-button",
      `Page ${page.page || index + 1}${page.heading && page.heading !== "Notes" ? ` · ${truncate(page.heading, 28)}` : ""}`,
    );
    button.type = "button";
    button.dataset.page = String(index + 1);
    button.addEventListener("click", () => render(index + 1));
    sidebar.appendChild(button);
    return button;
  });

  function render(pageNumber) {
    current = Math.min(Math.max(1, pageNumber), pageList.length);
    const page = pageList[current - 1];
    title.textContent = `${book?.title || "Book"} · ${page.heading && page.heading !== "Notes" ? page.heading : "Page"}`.slice(0, 90);
    pageLabel.textContent = `${current} / ${pageList.length}`;
    previous.disabled = current <= 1;
    next.disabled = current >= pageList.length;
    pageText.replaceChildren();
    appendHighlighted(pageText, page.text || "", current === Number(initialPage) ? highlight : "");
    sourceNote.textContent = book?.demo
      ? "Demo study pack — original sample notes, not an official board textbook."
      : `${book?.subject || "Textbook"}${book?.board ? ` · ${book.board}` : ""}${book?.grade ? ` · Class ${book.grade}` : ""}`;
    if (pdfUrl) openPdf.href = `${pdfUrl}#page=${page.page || current}`;
    pageButtons.forEach((button, index) => button.classList.toggle("active", index + 1 === current));
    qs(".reader-pages", wrapper)?.querySelector(".active")?.scrollIntoView({ block: "nearest" });
  }

  previous.addEventListener("click", () => render(current - 1));
  next.addEventListener("click", () => render(current + 1));
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
