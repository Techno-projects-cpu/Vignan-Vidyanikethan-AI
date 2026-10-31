import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { findHighlight, pageIndexForCitation } from "../js/reader.js";

const reader = readFileSync(fileURLToPath(new URL("../js/reader.js", import.meta.url)), "utf8");

test("reader resolves explicit and non-contiguous page numbers", () => {
  const pages = [{ page: 12 }, { page: 14 }, { page: 19 }];
  assert.equal(pageIndexForCitation(pages, 12), 0);
  assert.equal(pageIndexForCitation(pages, 14), 1);
  assert.equal(pageIndexForCitation(pages, 19), 2);
  assert.equal(pageIndexForCitation(pages, 18), 0, "missing pages must not point to a different citation");
});

test("reader supports old unlabeled pages and an empty book", () => {
  assert.equal(pageIndexForCitation([{}, {}, {}], 2), 1);
  assert.equal(pageIndexForCitation([{}, {}, {}], 99), 2);
  assert.equal(pageIndexForCitation([], 12), 0);
});

test("reader highlights literal searches, including regex punctuation", () => {
  const found = findHighlight("Voltage\n [V] measures potential difference.", "[v]");
  assert.ok(found);
  assert.equal(found.source.slice(found.index, found.index + found.length), "[V]");
  assert.ok(findHighlight("Force (N) is measured in newtons.", "(N)"));
  assert.equal(findHighlight("No square brackets here.", "["), null);
  assert.equal(findHighlight("Any passage", "  "), null);
});

test("the reader can be made readable on a phone and on a projector", () => {
  assert.match(reader, /const SIZES = \[13, 14, 16, 18, 21\]/);
  assert.match(reader, /const SIZE_KEY = "vignan\.reader\.size"/, "the size is remembered on this device");
  assert.match(reader, /pageText\.style\.fontSize/, "and applied to the page text itself");
  assert.match(reader, /sizeDown\.disabled = size <= SIZES\[0\]/, "the ends of the range are disabled, not silent");
  // The labels are translated now, so the key is what the test can rely on.
  assert.match(reader, /sizeDown\.setAttribute\("aria-label", t\("reader\.smaller"\)\)/);
  assert.match(reader, /sizeUp\.setAttribute\("aria-label", t\("reader\.larger"\)\)/);
});

test("opening a citation offers only the pages that hold the passage", () => {
  assert.match(reader, /let matchOnly = false;/);
  assert.match(reader, /if \(String\(highlight \|\| ""\)\.trim\(\)\)/, "the filter only exists when there is a passage");
  assert.match(reader, /setAttribute\("aria-pressed", matchOnly \? "true" : "false"\)/);
  assert.match(reader, /const hiddenByMatch = matchOnly && quote && !text\.includes\(quote\)/);
  assert.match(reader, /render\(target \+ 1, search\.value\)/, "it jumps to the page rather than making the student hunt");
  assert.doesNotMatch(reader, /matchOnly && target >= 0 && !pageButtons\[current - 1\]\?\.hidden/, "no dead branch is left behind");
});

test("arrow keys page through the book, and the listener is removed on close", () => {
  assert.match(reader, /event\.key === "ArrowLeft"/);
  assert.match(reader, /event\.key === "ArrowRight"/);
  assert.match(reader, /if \(event\.target === search \|\| event\.metaKey \|\| event\.ctrlKey \|\| event\.altKey\) return;/, "typing in search is not paging");
  assert.match(reader, /document\.addEventListener\("keydown", onKey\)/);
  assert.match(reader, /document\.removeEventListener\("keydown", onKey\)/);
});

test("reading resumes where it stopped, but a citation never moves", () => {
  assert.match(reader, /const LAST_PAGE_PREFIX = "vignan\.reader\.page\."/);
  assert.match(reader, /const citedPage = Number\(initialPage\) \|\| 0;/, "a cited page is explicit");
  assert.match(reader, /const resumed = citedPage \? 0 : lastReadPage\(bookId\)/, "only a plain read resumes");
  assert.match(reader, /rememberReadPage\(bookId, page\.page \|\| current\)/, "the page is remembered as it is read");
  assert.match(reader, /showToast\(t\("reader\.continueFrom"/, "and the student is told why it opened there");
  const app = readFileSync(fileURLToPath(new URL("../js/app.js", import.meta.url)), "utf8");
  assert.match(app, /openReader\(\{ book, pages: book\.pages \|\| \[\] \}\)/, "opening from Library resumes");
  assert.match(app, /initialPage: source\.page \|\| 1/, "a citation still pins its page");
});

test("an unsaved note survives turning the page, and still is not a note", () => {
  assert.match(reader, /const drafts = new Map\(\);/);
  assert.match(reader, /if \(shownPage && shownPage !== pageNumber\) drafts\.set\(shownPage, noteInput\.value\)/);
  assert.match(reader, /noteInput\.value = drafts\.has\(pageNumber\) \? drafts\.get\(pageNumber\) : existing \? existing\.text : ""/);
  assert.match(reader, /drafts\.delete\(pageNumber\)/, "saving or deleting clears the draft");
});

test("the reader can hand the page to Ask without sending anything", () => {
  assert.match(reader, /const askPage = element\("button", "button ghost small", t\("reader\.askPage"\)\)/);
  assert.match(reader, /controls\.append\(previous, pageLabel, next, sizeDown, sizeUp, askPage, openPdf\)/);
  assert.match(reader, /window\.dispatchEvent\(new window\.CustomEvent\("vignan:ask-page"/);
  assert.match(reader, /closeModal\(\);/, "the reader closes so the composer is visible");
  const app = readFileSync(fileURLToPath(new URL("../js/app.js", import.meta.url)), "utf8");
  assert.match(app, /window\.addEventListener\("vignan:ask-page"/);
  const start = app.indexOf('window.addEventListener("vignan:ask-page"');
  const handler = app.slice(start, start + 700);
  assert.match(handler, /input\.value = String\(event\.detail\?\.question \|\| ""\)/);
  assert.match(handler, /setView\("ask"\)/);
  assert.doesNotMatch(handler, /requestSubmit|handleAsk/, "nothing is sent without a tap on Send");
});
