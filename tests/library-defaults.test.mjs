import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DEFAULT_SETTINGS, normalizeSettings } from "../js/settings.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(`${root}/${path}`, "utf8");

test("web search is on for new students but preserves a previous opt-out", () => {
  assert.equal(DEFAULT_SETTINGS.webEnabled, true);
  assert.equal(normalizeSettings({}).webEnabled, true);
  assert.equal(normalizeSettings({ webEnabled: false }).webEnabled, false);
  const html = read("index.html");
  assert.match(html, /id="ask-web-fallback"[^>]*checked/);
  assert.match(html, /id="web-search-state"/);
  assert.match(html, /id="settings-web-enabled"/);
  assert.match(html, /id="web-search-help"/);
  assert.ok(html.indexOf('id="settings-web-enabled"') < html.indexOf('id="advanced-settings"'));
  const css = read("styles-premium.css");
  assert.doesNotMatch(css, /#view-settings \.settings-grid \{ display: none/);
  assert.match(css, /#view-settings \.settings-grid \{ display: grid/);
  assert.doesNotMatch(css, /display: none !important;[^}]*\}\s*body\.premium-ui #view-settings\.show-advanced \.premium-settings-launcher/);
});

test("sample and restricted board textbooks are not shipped as app content", () => {
  const html = read("index.html");
  const app = read("js/app.js");
  const worker = read("sw.js");
  const precache = JSON.parse(read("precache.json"));
  assert.ok(!existsSync(`${root}/data/demo-textbook.txt`));
  assert.doesNotMatch(html, /id="add-demo-book"/);
  assert.match(html, /id="book-list"/);
  assert.match(html, /Telangana SCERT and NCERT books require publisher permission/);
  assert.match(app, /item\.book\.demo === true/);
  assert.match(app, /db\.deleteBook\(index\.book\.id\)/);
  assert.doesNotMatch(worker, /demo-textbook/);
  assert.ok(precache.urls.every((url) => !/demo-textbook|tests\/fixtures/.test(url)));
});
