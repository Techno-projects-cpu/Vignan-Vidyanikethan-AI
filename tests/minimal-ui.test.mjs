import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(fileURLToPath(new URL(path, root)), "utf8");
const html = read("index.html");
const css = read("styles.css");
const app = read("js/app.js");
const i18n = read("js/i18n.js");

test("minimal UI keeps one compact top navigation and a short Ask banner", () => {
  assert.match(html, /<body class="minimal-ui premium-ui(?:\s+[^"]+)?">/);
  const nav = html.match(/<nav class="top-nav[^"]*"[\s\S]*?<\/nav>/);
  assert.ok(nav, "top navigation exists");
  assert.equal((nav[0].match(/data-view="/g) || []).length, 6);

  const banner = html.match(/<div class="connect-banner"[\s\S]*?<\/div>\s*<div class="chat-log"/);
  assert.ok(banner, "connect banner exists");
  assert.equal((banner[0].match(/<button/g) || []).length, 3);
  assert.match(banner[0], /id="use-local-ai-button"/);
  assert.match(banner[0], /id="use-free-ai-button"/);
  assert.match(banner[0], /id="connect-model-button"/);
});

test("advanced settings stay in the DOM behind a disclosure control", () => {
  const start = html.indexOf('<div class="advanced-settings" id="advanced-settings">');
  const end = html.indexOf('            </div>\n          </div>\n        </section>', start);
  assert.ok(start > 0 && end > start, "advanced wrapper boundaries exist");
  const advanced = html.slice(start, end);
  for (const id of ["free-api-card", "student-key-card", "provider-editor", "settings-theme", "settings-web-enabled"]) {
    assert.ok(advanced.includes(`id="${id}"`), `${id} remains available`);
  }
  assert.ok(!advanced.includes('id="local-ai-panel"'), "local model controls stay visible by default");
  assert.match(html, /id="toggle-advanced-settings"[^>]*aria-controls="advanced-settings"/);
  assert.match(css, /\.minimal-ui \.advanced-settings \{ display: none; \}/);
  assert.match(css, /#view-settings\.show-advanced \.advanced-settings \{ display: contents; \}/);
});

test("removed banner buttons no longer have hard unconditional event hooks", () => {
  for (const id of ["free-keys-button", "add-my-key-button", "dismiss-banner"]) {
    assert.ok(!html.includes(`id="${id}"`), `${id} was intentionally removed`);
    assert.ok(!app.includes(`$("#${id}").addEventListener`), `${id} has no unconditional listener`);
  }
  assert.match(
    app,
    /\$\("#toggle-advanced-settings"\)\?\.addEventListener\("click", toggleAdvancedSettings\)/,
  );
  assert.match(app, /function syncAdvancedSettingsButton\(\)/);
  assert.match(i18n, /"settings.advanced":/);
  assert.match(i18n, /"settings.hideAdvanced":/);
});

test("minimal styles avoid external assets and keep a mobile fallback", () => {
  assert.match(css, /body\.minimal-ui \{/);
  assert.match(css, /:root\[data-theme="light"\] body\.minimal-ui \{/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.ok(!css.includes("@import"), "no external stylesheet imports");
  assert.ok(!css.includes("https://fonts."), "no hosted font imports");
});
