import test from "node:test";
import assert from "node:assert/strict";
import { findHighlight, pageIndexForCitation } from "../js/reader.js";

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
