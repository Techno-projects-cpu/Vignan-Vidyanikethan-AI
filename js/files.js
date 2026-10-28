/**
 * Classify untrusted local and downloaded files before indexing. Nothing here
 * runs uploaded content, opens archives, or inserts HTML into the document.
 */
export const MAX_PDF_BYTES = 40 * 1024 * 1024;
export const MAX_TEXT_BYTES = 4 * 1024 * 1024;
export const MAX_REMOTE_BYTES = 12 * 1024 * 1024;

// Textual scripts are excluded too: students may import notes, not programs.
const BLOCKED_EXTENSIONS = new Set(`exe com dll sys scr msi msp app apk aab bat cmd ps1 psm1 sh bash zsh fish py pyw js mjs cjs jse vbs vbe wsf hta jar class wasm so dylib bin elf o a deb rpm dmg iso img zip zipx 7z rar tar gz tgz bz bz2 tbz tbz2 xz txz zst lz lz4 cab ar docx xlsx pptx odt ods odp epub svg`.split(" "));
const BLOCKED_MIME = /^(?:application\/(?:zip|x-zip-compressed|gzip|x-gzip|x-7z-compressed|vnd\.rar|x-rar-compressed|x-tar|x-bzip2|x-xz|x-executable|x-dosexec|x-msdownload|x-msdos-program|x-sh|javascript|wasm|java-archive)|text\/(?:javascript|x-shellscript)|image\/svg\+xml)$/i;

export function checkFileName(name = "", mime = "") {
  const clean = String(name || "").split(/[\\/]/).pop().trim();
  const extension = clean.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || "";
  if (BLOCKED_EXTENSIONS.has(extension) || BLOCKED_MIME.test(String(mime).split(";")[0].trim())) {
    throw new Error("Executable files, scripts, archives and packaged documents are not accepted. Use a PDF or readable text file instead.");
  }
  return clean || "notes";
}

function starts(bytes, signature) {
  return signature.every((value, index) => bytes[index] === value);
}

function looksLikeBlockedBinary(bytes) {
  return [
    [0x50, 0x4b, 0x03, 0x04], [0x50, 0x4b, 0x05, 0x06], [0x50, 0x4b, 0x07, 0x08], // ZIP, incl. empty/spanned
    [0x1f, 0x8b], [0x42, 0x5a, 0x68], [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00], // gzip, bzip2, xz
    [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c], [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07], // 7z, RAR
    [0x28, 0xb5, 0x2f, 0xfd], [0x04, 0x22, 0x4d, 0x18], // zstd, lz4
    [0x7f, 0x45, 0x4c, 0x46], [0x4d, 0x5a], [0x00, 0x61, 0x73, 0x6d], // ELF, PE, wasm
    [0xfe, 0xed, 0xfa, 0xce], [0xce, 0xfa, 0xed, 0xfe], [0xfe, 0xed, 0xfa, 0xcf], [0xcf, 0xfa, 0xed, 0xfe], // Mach-O
    [0x21, 0x3c, 0x61, 0x72, 0x63, 0x68, 0x3e, 0x0a], // ar archive
  ].some((signature) => starts(bytes, signature));
}

function decodeText(bytes) {
  let encoding = "utf-8";
  if (starts(bytes, [0xff, 0xfe])) encoding = "utf-16le";
  else if (starts(bytes, [0xfe, 0xff])) encoding = "utf-16be";
  let text;
  try { text = new TextDecoder(encoding, { fatal: true }).decode(bytes); }
  catch { throw new Error("This is not readable UTF-8 or UTF-16 text. Export it as text or PDF and try again."); }
  if (/^[\uFEFF\s]*#!/.test(text)) throw new Error("Executable scripts are not accepted. Use a PDF or plain notes instead.");
  // Do not index arbitrary binary files merely because they decode as UTF-8.
  if (/[\u0000-\u0008\u000b\u000e-\u001f\u007f]/.test(text)) {
    throw new Error("That file contains binary or non-text data. Use a PDF or readable text file.");
  }
  if (!text.trim()) throw new Error("That file does not contain readable text.");
  return text;
}

const ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
  hellip: "…", middot: "·", bull: "•", copy: "©", reg: "®", times: "×", divide: "÷",
};
function decodeEntities(text) {
  return text.replace(/&(#x[\da-f]{1,6}|#\d{1,7}|[a-z]{2,10});/gi, (match, key) => {
    if (key[0] === "#") {
      const number = key[1]?.toLowerCase() === "x" ? parseInt(key.slice(2), 16) : parseInt(key.slice(1), 10);
      return number > 0 && number <= 0x10ffff && !(number >= 0xd800 && number <= 0xdfff) ? String.fromCodePoint(number) : " ";
    }
    return ENTITIES[key.toLowerCase()] ?? match;
  });
}

/**
 * Linear, inert HTML-to-text conversion. It does not construct a DOM: even
 * tracking images, iframes, forms, scripts and active attributes cannot load
 * or run. This is intentionally an excerpt, not a full browser renderer.
 */
export function extractHtmlText(html) {
  const input = String(html || "");
  const titleMatch = input.match(/<title\b[^>]*>([\s\S]{0,500}?)<\/title\s*>/i);
  const title = decodeEntities((titleMatch?.[1] || "").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim().slice(0, 120);
  const skipTags = new Set(["head", "script", "style", "noscript", "template", "svg", "canvas", "iframe", "object", "embed", "form"]);
  const voidTags = new Set(["embed", "img", "br", "hr", "meta", "link", "input", "source", "area", "base", "wbr", "col"]);
  const blocks = new Set(["p", "br", "hr", "div", "article", "section", "main", "header", "footer", "nav", "h1", "h2", "h3", "h4", "li", "tr", "td", "th", "blockquote", "pre"]);
  const skipped = [];
  const output = [];
  let cursor = 0;
  while (cursor < input.length) {
    const open = input.indexOf("<", cursor);
    if (open < 0) { if (!skipped.length) output.push(input.slice(cursor)); break; }
    if (!skipped.length && open > cursor) output.push(input.slice(cursor, open));
    if (input.startsWith("<!--", open)) {
      const end = input.indexOf("-->", open + 4);
      cursor = end < 0 ? input.length : end + 3;
      continue;
    }
    const end = input.indexOf(">", open + 1);
    if (end < 0) { if (!skipped.length) output.push(input.slice(open)); break; }
    const tag = input.slice(open, end + 1);
    const match = tag.match(/^<\s*(\/?)\s*([a-z][\w:-]*)/i);
    if (match) {
      const closing = Boolean(match[1]);
      const name = match[2].toLowerCase();
      if (skipped.length) {
        if (closing && name === skipped[skipped.length - 1]) skipped.pop();
        else if (!closing && skipTags.has(name) && !voidTags.has(name) && !/\/\s*>$/.test(tag)) skipped.push(name);
      } else if (!closing && skipTags.has(name)) {
        if (!voidTags.has(name) && !/\/\s*>$/.test(tag)) skipped.push(name);
      } else if (blocks.has(name)) output.push("\n");
      else output.push(" ");
    }
    cursor = end + 1;
  }
  const text = decodeEntities(output.join("")).replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return { title, text };
}

/** Return a PDF classification or decoded plain text. Files are never executed. */
export function inspectFileBytes(input, { name = "notes", mime = "" } = {}) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const cleanName = checkFileName(name, mime);
  if (!bytes.length) throw new Error("That file is empty.");
  if (looksLikeBlockedBinary(bytes)) throw new Error("Executable and archive files are not accepted, even if renamed.");
  const isPdf = starts(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]);
  if (isPdf) {
    if (bytes.length > MAX_PDF_BYTES) throw new Error("That PDF is larger than 40 MB. Split it into chapters first.");
    return { kind: "pdf", name: cleanName };
  }
  if (/\.pdf$/i.test(cleanName) || /^application\/pdf(?:;|$)/i.test(mime)) {
    throw new Error("This file is not a valid PDF. Choose a readable PDF or text file.");
  }
  if (bytes.length > MAX_TEXT_BYTES) throw new Error("Text files and webpages are limited to 4 MB. Split the material into chapters first.");
  const raw = decodeText(bytes);
  const isHtml = /\.html?$/i.test(cleanName) || /^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i.test(mime) || /^\s*(?:<!doctype\s+html|<html\b)/i.test(raw);
  if (isHtml) {
    const article = extractHtmlText(raw);
    if (!article.text) throw new Error("This webpage has no readable text. It may need JavaScript or a login.");
    return { kind: "html", name: cleanName, ...article };
  }
  return { kind: "text", name: cleanName, text: raw };
}

export async function inspectFile(file) {
  if (!file || typeof file.arrayBuffer !== "function") throw new Error("Choose a PDF or readable text file.");
  checkFileName(file.name, file.type);
  if (file.size > MAX_PDF_BYTES) throw new Error("That file is larger than 40 MB. Split it into chapters first.");
  return inspectFileBytes(new Uint8Array(await file.arrayBuffer()), { name: file.name, mime: file.type });
}
