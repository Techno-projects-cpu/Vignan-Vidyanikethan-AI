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
  assert.match(reader, /aria-label", "Smaller text"/);
  assert.match(reader, /aria-label", "Larger text"/);
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
