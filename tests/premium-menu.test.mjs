import test from "node:test";
import assert from "node:assert/strict";
import { closeCommandMenu, openCommandMenu, toggleCommandMenu } from "../js/premium-ui.js";

test("command menu can reopen while closing and ignores a stale opening frame", async () => {
  const oldDocument = globalThis.document;
  const oldFrame = globalThis.requestAnimationFrame;
  const frames = [];
  const attrs = new Map([["aria-hidden", "true"]]);
  const classes = new Set();
  const overlay = {
    hidden: true,
    setAttribute: (name, value) => attrs.set(name, value),
    getAttribute: (name) => attrs.get(name),
    classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name) },
  };
  globalThis.document = { querySelector: (selector) => selector === "#command-overlay" ? overlay : null };
  globalThis.requestAnimationFrame = (callback) => frames.push(callback);
  try {
    openCommandMenu();
    closeCommandMenu();
    frames.shift()(); // the first, now stale opening animation frame
    assert.equal(classes.has("open"), false);
    toggleCommandMenu(); // tap again while the close animation is running
    frames.shift()();
    assert.equal(overlay.hidden, false);
    assert.equal(attrs.get("aria-hidden"), "false");
    assert.equal(classes.has("open"), true);
    await new Promise((resolve) => setTimeout(resolve, 180));
    assert.equal(overlay.hidden, false, "the old close timer must not hide the reopened menu");
  } finally {
    // Close without letting the cleanup timer use the fake DOM after the test.
    overlay.hidden = true;
    globalThis.document = oldDocument;
    globalThis.requestAnimationFrame = oldFrame;
  }
});

test("command menu restores background inert states and the original focus", async () => {
  const oldDocument = globalThis.document;
  const oldFrame = globalThis.requestAnimationFrame;
  const frames = [];
  const attrs = new Map([["aria-hidden", "true"]]);
  const workspace = { inert: false, id: "workspace", tagName: "DIV" };
  const alreadyInert = { inert: true, id: "other", tagName: "DIV" };
  const overlay = {
    hidden: true, inert: true, id: "command-overlay", tagName: "DIV",
    setAttribute: (name, value) => attrs.set(name, value),
    getAttribute: (name) => attrs.get(name),
    classList: { add() {}, remove() {} },
    querySelectorAll: () => [],
    contains: (node) => node === search,
  };
  const previous = { isConnected: true, focus() { doc.activeElement = previous; } };
  const search = { value: "", focus() { doc.activeElement = search; } };
  const doc = {
    activeElement: previous,
    body: { children: [workspace, alreadyInert, overlay] },
    querySelector: (selector) => selector === "#command-overlay" ? overlay : selector === "#command-search" ? search : null,
  };
  globalThis.document = doc;
  globalThis.requestAnimationFrame = (callback) => frames.push(callback);
  try {
    openCommandMenu();
    assert.equal(workspace.inert, true);
    assert.equal(alreadyInert.inert, true);
    frames.shift()();
    assert.equal(doc.activeElement, search);
    closeCommandMenu();
    assert.equal(workspace.inert, false);
    assert.equal(alreadyInert.inert, true);
    assert.equal(doc.activeElement, previous);
    await new Promise((resolve) => setTimeout(resolve, 180));
  } finally {
    globalThis.document = oldDocument;
    globalThis.requestAnimationFrame = oldFrame;
  }
});
