/**
 * Ingestion pipeline for PDFs, readable text and pasted notes.
 * PDF text extraction uses a vendored copy of PDF.js so it also works offline.
 */

import { buildBookIndex } from "./retrieval.js?v=32";
import { cleanPageText, detectHeading } from "./text.js?v=32";
import { uid } from "./util.js?v=32";

const PDF_BASE = new URL("../vendor/pdfjs/", import.meta.url).href;
const MAX_PDF_PAGES = 800;
const MAX_PDF_TEXT_CHARS = 4 * 1024 * 1024;
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

export function pdfItemsToText(items, maxChars = MAX_PDF_TEXT_CHARS) {
  const lines = [];
  let current = "";
  let characters = 0;
  let previousY = null;
  let previousHeight = 0;
  const flush = () => {
    if (current.trim()) lines.push(current.trim());
    current = "";
    previousY = null;
    previousHeight = 0;
  };
  for (const item of items) {
    const value = typeof item.str === "string" ? item.str : "";
    if (!value) { if (item.hasEOL) flush(); continue; }
    characters += value.length + 1;
    if (characters > maxChars) throw new Error("This PDF contains too much extracted text. Split it into smaller chapters first.");
    const y = Number(item.transform?.[5]);
    const height = Number(item.height) || Math.abs(Number(item.transform?.[3])) || 10;
    // Some PDFs never set hasEOL. Detect substantial baseline changes so
    // numbered past-paper questions do not collapse into one long sentence.
    if (current && Number.isFinite(y) && previousY !== null && Math.abs(y - previousY) > Math.max(2, Math.min(previousHeight || height, height) * 0.55)) flush();
    current += value;
    if (item.hasEOL) flush();
    else {
      if (!/\s$/.test(current)) current += " ";
      if (Number.isFinite(y)) previousY = y;
      previousHeight = height;
    }
  }
  flush();
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
  let document;
  try { document = await task.promise; }
  catch (error) { await task.destroy().catch(() => {}); throw error; }
  const originalPageCount = document.numPages;
  const pageCount = Math.min(originalPageCount, MAX_PDF_PAGES);
  const pages = [];
  let totalCharacters = 0;
  try {
    let lastHeading = "Notes";
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = cleanPageText(pdfItemsToText(content.items, MAX_PDF_TEXT_CHARS - totalCharacters));
      totalCharacters += text.length;
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
    sourceUrl: meta.sourceUrl || "",
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
