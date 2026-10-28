/**
 * Ingestion pipeline for PDF, TXT, Markdown and pasted notes.
 * PDF text extraction uses a vendored copy of PDF.js so it also works offline.
 */

import { buildBookIndex } from "./retrieval.js?v=13";
import { cleanPageText, detectHeading } from "./text.js?v=13";
import { uid } from "./util.js?v=13";

const PDF_BASE = new URL("../vendor/pdfjs/", import.meta.url).href;
const MAX_PDF_PAGES = 800;
const MAX_STORED_PDF_BYTES = 20 * 1024 * 1024;

let pdfLibraryPromise;

/** Load the patched, vendored PDF.js legacy build only when a PDF is opened. */
async function pdfLibrary() {
  if (!pdfLibraryPromise) {
    pdfLibraryPromise = import(new URL("pdf.min.mjs", PDF_BASE).href).catch((error) => {
      pdfLibraryPromise = null;
      throw new Error(`The PDF reader could not load. Check your connection and try again. (${error.name})`);
    });
  }
  const library = await pdfLibraryPromise;
  library.GlobalWorkerOptions.workerSrc = new URL("pdf.worker.min.mjs", PDF_BASE).href;
  return library;
}

function itemsToText(items) {
  const lines = [];
  let current = "";
  for (const item of items) {
    const value = typeof item.str === "string" ? item.str : "";
    if (!value) continue;
    current += value;
    if (item.hasEOL) {
      if (current.trim()) lines.push(current.trim());
      current = "";
    } else if (!/\s$/.test(current)) {
      current += " ";
    }
  }
  if (current.trim()) lines.push(current.trim());
  return lines.join("\n");
}

export async function extractPdfPages(file, onProgress = () => {}) {
  const library = await pdfLibrary();
  const data = new Uint8Array(await file.arrayBuffer());
  const task = library.getDocument({
    data,
    cMapUrl: new URL("cmaps/", PDF_BASE).href,
    cMapPacked: true,
    standardFontDataUrl: new URL("standard_fonts/", PDF_BASE).href,
    useSystemFonts: true,
    disableFontFace: false,
    // Defense in depth for untrusted textbooks: never dynamically compile PDF fonts.
    isEvalSupported: false,
    enableXfa: false,
  });
  const document = await task.promise;
  const originalPageCount = document.numPages;
  const pageCount = Math.min(originalPageCount, MAX_PDF_PAGES);
  const pages = [];
  try {
    let lastHeading = "Notes";
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = cleanPageText(itemsToText(content.items));
      const firstLines = text.split("\n").slice(0, 4);
      const heading = firstLines.map(detectHeading).find(Boolean) || lastHeading;
      if (heading !== lastHeading) lastHeading = heading;
      pages.push({ page: pageNumber, text, heading });
      onProgress({ phase: "reading", current: pageNumber, total: pageCount });
      page.cleanup();
      // Yield to the UI every few pages so large books do not freeze the tab.
      if (pageNumber % 8 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
    }
  } finally {
    await document.destroy();
  }
  const totalCharacters = pages.reduce((sum, page) => sum + page.text.length, 0);
  if (totalCharacters < 80) {
    throw new Error(
      "This PDF appears to be scanned images, not selectable text. Run OCR on it first, or upload a TXT version of the notes.",
    );
  }
  if (originalPageCount > MAX_PDF_PAGES) {
    onProgress({ phase: "notice", message: `Only the first ${MAX_PDF_PAGES} pages were indexed.` });
  }
  return pages;
}

function normalizeMeta(meta, fallbackTitle, type) {
  return {
    id: meta.id || uid("book"),
    title: (meta.title || fallbackTitle || "Untitled book").trim(),
    subject: (meta.subject || "General").trim(),
    grade: (meta.grade || "").trim(),
    board: (meta.board || "").trim(),
    language: (meta.language || "English").trim(),
    fileName: meta.fileName || "",
    type,
    demo: Boolean(meta.demo),
  };
}

export async function ingestPdf(file, meta = {}, onProgress = () => {}) {
  const fallbackTitle = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
  const pages = await extractPdfPages(file, onProgress);
  onProgress({ phase: "indexing", current: 0, total: pages.length });
  const index = buildBookIndex(normalizeMeta(meta, fallbackTitle, "pdf"), pages);
  index.book.fileBlob = file.size <= MAX_STORED_PDF_BYTES ? file : null;
  onProgress({ phase: "done", current: pages.length, total: pages.length });
  return index;
}

export function ingestText(rawText, meta = {}, onProgress = () => {}) {
  const fallbackTitle = (rawText || "").split("\n").find((line) => line.trim())?.slice(0, 60) || "Pasted notes";
  onProgress({ phase: "indexing", current: 0, total: 1 });
  const index = buildBookIndex(
    normalizeMeta({ ...meta, fileName: meta.fileName || "notes.txt" }, fallbackTitle, "text"),
    rawText,
  );
  onProgress({ phase: "done", current: 1, total: 1 });
  return index;
}

export async function ingestDemoPack(rawText, meta = {}) {
  return ingestText(rawText, { ...meta, demo: true, type: "demo" }, () => {});
}
