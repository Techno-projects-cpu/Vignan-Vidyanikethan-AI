import test from "node:test";
import assert from "node:assert/strict";
import { pdfItemsToText } from "../js/ingest.js";

test("PDF extraction preserves baseline-separated lines even without EOL markers", () => {
  const item = (str, y, hasEOL = false) => ({ str, height: 12, transform: [1, 0, 0, 12, 10, y], hasEOL });
  const text = pdfItemsToText([item("1.", 100), item("What is a plant?", 100), item("2.", 80), item("Explain sunlight.", 80)]);
  assert.equal(text, "1. What is a plant?\n2. Explain sunlight.");
});

test("explicit EOL markers and text limits are respected", () => {
  assert.equal(pdfItemsToText([{ str: "first", hasEOL: true }, { str: "second" }]), "first\nsecond");
  assert.throws(() => pdfItemsToText([{ str: "excessively long" }], 5), /too much extracted text/);
});
