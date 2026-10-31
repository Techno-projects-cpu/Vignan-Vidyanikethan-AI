/**
 * Offline mode, and the update banner that used to nag.
 *
 * Two complaints in one round: the app kept offering "A new version is ready"
 * (on every visit, because "Later" was forgotten on reload), and it had no way to
 * be *told* to work offline even though everything it needs is on the device.
 *
 * These tests cover both, at the level where the decisions are made.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  OFFLINE_MODE_KEY,
  UPDATE_DEFERRED_KEY,
  deferVersion,
  deferredVersion,
  isOfflineMode,
  networkAllowed,
  offlineRefusal,
  setOfflineMode,
  shouldAnnounceUpdate,
} from "../js/offline-mode.js";
import { DEFAULT_SETTINGS, normalizeSettings } from "../js/settings.js";
import { checkForUpdate } from "../js/updates.js";

const memoryStorage = () => {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    clear: () => map.clear(),
    get size() { return map.size; },
  };
};

const app = () => readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const html = () => readFileSync(new URL("../index.html", import.meta.url), "utf8");
const i18n = () => readFileSync(new URL("../js/i18n.js", import.meta.url), "utf8");

test("offline mode is off by default and is only ever a real true", () => {
  assert.equal(DEFAULT_SETTINGS.offlineMode, false);
  assert.equal(normalizeSettings({}).offlineMode, false);
  assert.equal(normalizeSettings({ offlineMode: true }).offlineMode, true);
  // A stored string must not switch a private mode on by accident.
  assert.equal(normalizeSettings({ offlineMode: "true" }).offlineMode, false);
  assert.equal(normalizeSettings({ offlineMode: 1 }).offlineMode, false);
});

test("the flag is written where the network modules can read it", () => {
  const storage = memoryStorage();
  assert.equal(isOfflineMode(storage), false);
  setOfflineMode(true, storage);
  assert.equal(storage.getItem(OFFLINE_MODE_KEY), "1");
  assert.equal(isOfflineMode(storage), true);
  setOfflineMode(false, storage);
  assert.equal(storage.getItem(OFFLINE_MODE_KEY), null);
  assert.equal(isOfflineMode(storage), false);
});

test("a browser that blocks storage does not break the switch", () => {
  const hostile = {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("blocked"); },
    removeItem() { throw new Error("blocked"); },
  };
  assert.equal(isOfflineMode(hostile), false);
  assert.equal(setOfflineMode(true, hostile), false);
  assert.equal(deferredVersion(hostile), "");
  assert.equal(deferVersion("41", hostile), false);
});

test("the update banner is silent in offline mode, offline, or after Later", () => {
  // Nothing to fetch, nothing to swap.
  assert.equal(shouldAnnounceUpdate({ remote: "41", release: "40", offlineMode: true }), false);
  // No connection: the check itself is what fails.
  assert.equal(shouldAnnounceUpdate({ remote: "41", release: "40", online: false }), false);
  // A release the student postponed stays postponed, on this visit and the next.
  assert.equal(shouldAnnounceUpdate({ remote: "41", release: "40", deferred: "41" }), false);
  // A genuinely newer release gets its own chance.
  assert.equal(shouldAnnounceUpdate({ remote: "42", release: "40", deferred: "41" }), true);
  // A waiting worker with no version is still worth mentioning, once.
  assert.equal(shouldAnnounceUpdate({ remote: "", release: "40" }), true);
});

test("Later is remembered for one release only", () => {
  const storage = memoryStorage();
  assert.equal(deferredVersion(storage), "");
  deferVersion("41", storage);
  assert.equal(storage.getItem(UPDATE_DEFERRED_KEY), "41");
  assert.equal(deferredVersion(storage), "41");
  deferVersion("", storage);
  assert.equal(deferredVersion(storage), "");
});

test("offline mode closes the network, not the study features", () => {
  assert.equal(networkAllowed({ offlineMode: true, webEnabled: true }), false);
  assert.equal(networkAllowed({ offlineMode: false, webEnabled: true }), true);
  assert.equal(networkAllowed({ offlineMode: false, webEnabled: false }), false);
  assert.equal(networkAllowed({ offlineMode: false, webEnabled: true, online: false }), false);
  // The refusal explains itself and says where to undo it.
  const sentence = offlineRefusal("Web search");
  assert.match(sentence, /Offline mode is on/);
  assert.match(sentence, /Settings/);
});

test("a background update check makes no request in offline mode", async () => {
  let called = false;
  const registration = { update: async () => { called = true; }, waiting: null, installing: null };
  const result = await checkForUpdate(registration, { offlineMode: true });
  assert.equal(result.status, "offline");
  assert.equal(called, false, "registration.update() is never reached");
  assert.equal(result.reason, "offline-mode");
});

test("the app actually uses these rules", () => {
  const source = app();
  // The ask path asks the shared rule, not its own copy of it.
  assert.match(source, /networkAllowed\(\{[\s\S]{0,160}offlineMode: state\.settings\.offlineMode/);
  // The banner consults offline mode, the deferral and the connection.
  assert.match(source, /shouldAnnounceUpdate\(\{[\s\S]{0,200}deferred: deferredVersion\(\)/);
  // "Later" writes the deferral instead of only hiding the banner.
  assert.match(source, /deferVersion\(state\.pendingUpdate \|\| RELEASE\)/);
  // Background checks stop when the mode is on.
  assert.match(source, /watchForUpdates[\s\S]{0,200}state\.settings\?\.offlineMode/);
  assert.match(source, /globalThis\.__vignanOfflineMode = \(\) =>/);
  // The switch is wired to the setter, and the setter persists.
  assert.match(source, /#offline-mode"\)\?\.addEventListener\("change"/);
  assert.match(source, /async function setOfflineModeOn\(on\)[\s\S]{0,300}setOfflineMode\(Boolean\(on\)\)/);
});

test("account and social calls refuse before any request", () => {
  for (const file of ["auth.js", "social.js"]) {
    const source = readFileSync(new URL(`../js/${file}`, import.meta.url), "utf8");
    assert.match(source, /blockInOfflineMode/, `${file} checks offline mode`);
    const gate = source.indexOf("blockInOfflineMode()");
    const request = source.indexOf("await fetch(");
    assert.ok(gate > -1 && request > gate, `${file} refuses before it fetches`);
  }
});

test("the switch is on screen, in plain language, in three languages", () => {
  const markup = html();
  assert.match(markup, /<input type="checkbox" id="offline-mode">/);
  assert.match(markup, /data-i18n="offline\.toggle"[^>]*>Offline mode — use only what is on this device</);
  assert.match(markup, /id="offline-mode-note"/);
  const strings = i18n();
  for (const key of ["offline.toggle", "offline.help", "app.offlineMode"]) {
    const hits = strings.split(`"${key}"`).length - 1;
    assert.equal(hits, 3, `${key} exists in English, Telugu and Hindi`);
  }
});

test("the page says what offline mode turns off, not what breaks", () => {
  const note = readFileSync(new URL("../js/offline-mode.js", import.meta.url), "utf8");
  assert.match(note, /no update checks, no web search, no friends or leaderboard/i);
  assert.match(i18n(), /No update checks, no web search, no friends or leaderboard/i);
  // The saved preference is not overwritten: turning the mode off restores it.
  const source = app();
  assert.match(source, /without erasing it|does not erase|restores exactly what the student had chosen/i);
});
