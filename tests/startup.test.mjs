import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { STARTUP_SEEN_KEY, setupStartup } from "../js/startup.js";

function fixture(storage) {
  const activeDocument = { activeElement: null };
  function node() {
    const listeners = {};
    return {
      hidden: false, inert: false, listeners,
      addEventListener(type, handler) { listeners[type] = handler; },
      focus() { activeDocument.activeElement = this; },
      getClientRects() { return [{}]; },
      dispatch(type, properties = {}) {
        const event = { ...properties, prevented: false, preventDefault() { this.prevented = true; } };
        listeners[type]?.(event);
        return event;
      },
    };
  }
  const screen = node();
  const gate = node();
  const skip = node();
  const enter = node();
  const link = node();
  const username = node();
  screen.hidden = true;
  screen.ownerDocument = activeDocument;
  screen.contains = (element) => [skip, enter, link].includes(element);
  screen.querySelectorAll = () => [skip, enter, link];
  const startup = setupStartup({ screen, gate, enter, skip, focusTarget: () => username, storage, schedule: (callback) => callback() });
  return { screen, gate, skip, enter, link, username, startup, activeDocument };
}

test("startup traps focus, can be skipped, and is only shown once in a tab", () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) };
  const f = fixture(storage);
  assert.equal(f.startup.show(), true);
  assert.equal(f.screen.hidden, false);
  assert.equal(f.gate.inert, true);
  assert.equal(f.activeDocument.activeElement, f.enter);
  f.skip.focus();
  assert.equal(f.screen.dispatch("keydown", { key: "Tab", shiftKey: true }).prevented, true);
  assert.equal(f.activeDocument.activeElement, f.link);
  f.enter.dispatch("click");
  assert.equal(f.gate.inert, false);
  assert.equal(f.screen.hidden, true);
  assert.equal(f.activeDocument.activeElement, f.username);
  assert.equal(values.get(STARTUP_SEEN_KEY), "1");
  assert.equal(f.startup.show(), false);
  assert.equal(fixture(storage).startup.show(), false);
});

test("Escape dismisses the intro even when session storage throws", () => {
  const storage = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  const f = fixture(storage);
  assert.equal(f.startup.show(), true);
  assert.equal(f.screen.dispatch("keydown", { key: "Escape" }).prevented, true);
  assert.equal(f.screen.hidden, true);
  assert.equal(f.gate.inert, false);
  assert.equal(f.startup.show(), false);
});

test("branding, legal links and reduced-motion styles are present before entry", () => {
  const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const html = read("index.html");
  const css = read("styles-identity.css");
  assert.ok(html.indexOf('id="startup-screen"') < html.indexOf('id="auth-gate"'));
  assert.match(html, /id="startup-skip"/);
  assert.match(html, /Vignan Vidyanikethan English Medium High School/);
  assert.match(html, /INSPIRE-MANAK/);
  assert.match(html, /assets\/brand\/nezaad-mark\.png/);
  assert.match(html, /href="https:\/\/zero-vast\.vercel\.app\/"/);
  assert.match(html, /href="\.\/privacy\.html"/);
  assert.match(html, /href="\.\/terms\.html"/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(read("privacy.html"), /not independently verified/i);
  assert.match(read("privacy.html"), /does not currently offer self-service account deletion/i);
  assert.match(read("terms.html"), /not a newly trained model/i);
});
