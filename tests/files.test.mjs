import test from "node:test";
import assert from "node:assert/strict";
import { extractHtmlText, inspectFileBytes, MAX_TEXT_BYTES } from "../js/files.js";
import { firstLink, hasLinkCredentials } from "../js/link-reader.js";

const bytes = (value) => new TextEncoder().encode(value);

test("accepts a broad range of actual readable text files, including UTF-16", () => {
  for (const name of ["notes.txt", "class.md", "data.csv", "formulae.tex", "notes.rst", "subjects.yaml", "my_notes", "chapter.unknown"]) {
    const result = inspectFileBytes(bytes("Plants make food using sunlight.\nWater is important."), { name });
    assert.equal(result.kind, "text", name);
    assert.match(result.text, /Plants make food/);
  }
  const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("తెలుగు text in a UTF-16 note.", "utf16le")]);
  assert.match(inspectFileBytes(utf16, { name: "lesson.txt" }).text, /తెలుగు/);
  assert.equal(inspectFileBytes(bytes("%PDF-1.7\ncontent"), { name: "book.pdf", mime: "application/pdf" }).kind, "pdf");
});

test("blocks executable/script/archive extensions and binary signatures even when renamed", () => {
  for (const name of ["setup.exe", "command.sh", "file.PS1", "script.js", "binary.wasm", "archive.zip", "book.docx", "file.rar", "app.apk"]) {
    assert.throws(() => inspectFileBytes(bytes("this is disguised readable text"), { name }), /not accepted/i, name);
  }
  for (const data of [
    [0x4d, 0x5a, 0x41, 0x41], [0x7f, 0x45, 0x4c, 0x46], [0x50, 0x4b, 3, 4], [0x50, 0x4b, 5, 6],
    [0x1f, 0x8b, 8, 0], [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c], [0x00, 0x61, 0x73, 0x6d],
  ]) assert.throws(() => inspectFileBytes(Uint8Array.from(data), { name: "innocent.txt" }), /archive|executable/i);
  assert.throws(() => inspectFileBytes(bytes("#!/bin/sh\necho bad"), { name: "notes.txt" }), /script/i);
  assert.throws(() => inspectFileBytes(Uint8Array.from([65, 66, 0, 67]), { name: "notes.txt" }), /binary|non-text/i);
  assert.throws(() => inspectFileBytes(Uint8Array.from([0xff, 0x00, 0x42]), { name: "notes.txt" }), /UTF-8|UTF-16/i);
  assert.throws(() => inspectFileBytes(bytes("not a PDF"), { name: "fake.pdf" }), /not a valid PDF/i);
  assert.throws(() => inspectFileBytes(bytes("plain text"), { name: "notes.txt", mime: "application/zip" }), /archive/i);
});

test("size caps and empty files are enforced before indexing", () => {
  assert.throws(() => inspectFileBytes(new Uint8Array(), { name: "blank.txt" }), /empty/i);
  assert.throws(() => inspectFileBytes(new Uint8Array(MAX_TEXT_BYTES + 1).fill(65), { name: "huge.txt" }), /4 MB/i);
});

test("webpage extraction is inert, strips active content and preserves readable words", () => {
  const html = `<!doctype html><html><head><title>Science &amp; Nature</title><script>throw 'head'</script></head><body>
    <h1>Photosynthesis</h1><p>Plants use light &amp; water &#x2600; to make food.</p>
    <img src="https://tracker.invalid/pixel" onerror="alert(1)"><iframe src="https://evil.invalid">Hidden</iframe>
    <script>fetch('https://evil.invalid'); alert('XSS')</script><style>body {display:none}</style>
    <form action="https://evil.invalid"><input value="secret"></form><p>More facts.</p></body></html>`;
  const result = extractHtmlText(html);
  assert.equal(result.title, "Science & Nature");
  assert.match(result.text, /Plants use light & water ☀ to make food/);
  assert.match(result.text, /More facts/);
  assert.doesNotMatch(result.text, /tracker|evil|alert|display:none|secret/);
  const inspected = inspectFileBytes(bytes(html), { name: "lesson.html", mime: "text/html" });
  assert.equal(inspected.kind, "html");
  assert.equal(inspected.title, result.title);
  assert.equal(inspected.text, result.text);
});

test("pasted public URLs retain balanced parentheses and ignore trailing punctuation", () => {
  assert.equal(firstLink("Read https://en.wikipedia.org/wiki/Mercury_(planet) please"), "https://en.wikipedia.org/wiki/Mercury_(planet)");
  assert.equal(firstLink("(https://example.org/file.pdf)."), "https://example.org/file.pdf");
  assert.equal(firstLink("No links here"), "");
  assert.equal(hasLinkCredentials("https://reader:password@example.org/page"), true);
  assert.equal(hasLinkCredentials("https://example.org/page?token=secret"), true);
  assert.equal(hasLinkCredentials("https://example.org/page?X-Amz-Signature=secret"), true);
  assert.equal(hasLinkCredentials("https://example.org/page?id=123"), false);
});
