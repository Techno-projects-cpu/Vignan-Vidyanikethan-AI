/**
 * The simple shell.
 *
 * A student came here to study, not to learn a workspace. So the app opens as
 * one chat — greeting, question box, and a logo in the corner — and the ten
 * screens live behind that logo. These tests hold both halves of that promise:
 * the chat is the only thing on screen, and nothing was actually taken away.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { badgeText, chatStarters, hasConversation, historyItems, timestampLabel } from "../js/shell.js";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const html = read("index.html");
const css = read("styles-next.css");
const app = read("js/app.js");

test("the page opens on a chat, with a logo in the corner", () => {
  assert.match(html, /<button[^>]*class="home-logo"[^>]*id="home-logo"[^>]*aria-haspopup="dialog"[^>]*aria-controls="app-menu"/);
  assert.match(html, /id="home-logo"[\s\S]{0,200}<img src="\.\/icons\/icon\.svg\?v=\d+"/);
  // The advanced chrome is folded away, not deleted: the sidebar and the tab
  // bar are still in the page for the menu and for screen readers.
  assert.match(html, /<aside class="sidebar">/);
  assert.match(html, /class="mobile-nav"/);
  assert.match(css, /body\.premium-ui \.sidebar,\s*\nbody\.premium-ui \.topbar,\s*\nbody\.premium-ui \.mobile-nav,/);
  assert.match(css, /body\.premium-ui \.premium-hero,\s*\nbody\.premium-ui \.goal-cards \{/);
  // The chat is one centred column with the composer pinned to the bottom.
  assert.match(css, /body\.premium-ui \.chat-column \{[^}]*max-width: 760px/);
  assert.match(css, /body\.premium-ui \.composer \{[^}]*position: sticky;[^}]*bottom: 0/);
  assert.match(css, /body\.premium-ui\[data-view="ask"\] \.page-head \{\s*\n\s*display: none;/);
});

test("the logo opens a menu with every screen in it", () => {
  const menu = html.slice(html.indexOf('id="app-menu"'), html.indexOf('id="history-overlay"'));
  for (const view of ["library", "quiz", "exam", "flashcards", "progress", "friends", "chat", "play", "settings"]) {
    assert.match(menu, new RegExp(`data-menu-view="${view}"`), `${view} is reachable from the menu`);
  }
  for (const action of ["new-chat", "history", "upload", "install", "theme"]) {
    assert.match(menu, new RegExp(`data-menu-action="${action}"`), `${action} is in the menu`);
  }
  // Account is in the menu, because the top bar that used to hold it is gone.
  assert.match(menu, /id="app-menu-account"/);
  assert.match(app, /function renderMenuAccount\(\)/);
  assert.match(app, /window\.dispatchEvent\(new CustomEvent\("vignan:auth-required", \{ detail: \{ mode: "login" \} \}\)/);
  // The menu is a real dialog: it traps nothing silently, but it says what it is.
  assert.match(html, /id="app-menu-panel"|class="app-menu-panel" role="dialog" aria-modal="true"/);
  assert.match(html, /aria-expanded="false" aria-label="Menu/);
  assert.match(app, /logo\?\.setAttribute\("aria-expanded", "true"\)/);
  assert.match(app, /if \(closeAppMenu\(\)\) \{ event\.preventDefault\(\); return; \}/, "Escape closes it first");
});

test("a textbook can be added without opening Settings", () => {
  // The "+" beside the question box.
  assert.match(html, /class="attach-button" id="ask-attach"/);
  assert.match(html, /id="attach-overlay"[\s\S]{0,900}data-attach="upload"/);
  assert.match(app, /if \(kind === "upload"\) \{ setView\("library"\); \$\("#file-input"\)\?\.click\(\); return; \}/);
  // And the same menu can start the practice tools.
  for (const kind of ["quiz", "flashcards", "exam"]) {
    assert.match(html, new RegExp(`data-attach="${kind}"`));
  }
  assert.match(app, /if \(kind === "quiz"\) \{ void prepareQuizFromText\(\); return; \}/);
});

test("a website can be fetched and asked about, through the guarded fetcher", () => {
  assert.match(html, /data-attach="link"[\s\S]{0,200}Fetch a website/);
  assert.match(html, /id="attach-link-url" type="url"|type="url" id="attach-link-url"/);
  // The browser never fetches the page: the request goes through the import
  // path that already blocks private addresses, scripts and archives.
  assert.match(app, /function fetchWebsiteForChat\(url\)/);
  assert.match(app, /input\.value = url;\s*\n\s*button\.click\(\);/);
  assert.match(app, /Explain this page in simple words, then tell me how it works: \$\{url\}/);
  assert.match(html, /Public pages only\. It is saved as a web source/);
});

test("history is the device's own questions, newest first", () => {
  const messages = [
    { role: "assistant", content: "welcome", createdAt: "2026-01-01T10:00:00Z" },
    { role: "user", content: "what is pH", createdAt: "2026-01-02T10:00:00Z" },
    { role: "assistant", content: "an answer" },
    { role: "user", content: "explain the water cycle", createdAt: "2026-01-03T10:00:00Z" },
    { role: "user", content: "   " },
  ];
  const items = historyItems(messages);
  assert.deepEqual(items.map((item) => item.full), ["explain the water cycle", "what is pH"]);
  assert.match(items[0].when, /2026/);
  assert.equal(items.length, 2, "blank questions and answers are not history");

  // A long question is shortened for the list but kept whole for the composer.
  const long = historyItems([{ role: "user", content: "x".repeat(400) }], { maxLength: 40 });
  assert.equal(long[0].text.length, 40);
  assert.ok(long[0].text.endsWith("…"));
  assert.equal(long[0].full.length, 400);

  assert.deepEqual(historyItems([]), []);
  assert.deepEqual(historyItems(null), []);
  assert.equal(historyItems(messages, { limit: 1 }).length, 1, "the list is capped");
  assert.equal(timestampLabel("not a date"), "");
  assert.match(app, /const items = historyItems\(state\.messages, \{ limit: 40 \}\)/);
});

test("a badge is only printed when there is something behind it", () => {
  assert.equal(badgeText("3"), "3");
  assert.equal(badgeText(0), "");
  assert.equal(badgeText("0"), "");
  assert.equal(badgeText(""), "");
  assert.equal(badgeText(null), "");
  assert.equal(badgeText(undefined), "");
  assert.match(app, /target\.textContent = badgeText\(/);
});

test("suggestions look like every other chat, and disappear once you ask", () => {
  const cards = [{ title: "a" }, { title: "b" }, { title: "c" }, { title: "d" }, { title: "e" }];
  assert.equal(chatStarters(cards).length, 4);
  assert.deepEqual(chatStarters(cards, { hasConversation: true }), []);
  assert.equal(hasConversation([{ role: "user", content: "hi" }]), true);
  assert.equal(hasConversation([{ role: "assistant", content: "hello" }]), false);
  assert.match(app, /const cards = chatStarters\(/);
  assert.match(css, /\.chat-starter \{[^}]*min-height: 40px/);
});

test("the phone keeps the logo reachable without covering the question box", () => {
  const mobile = css.slice(css.indexOf("@media (max-width: 640px)", css.indexOf("16. The simple shell")));
  assert.match(mobile, /body\.premium-ui \.composer \{\s*\n\s*bottom: calc\(56px \+ env\(safe-area-inset-bottom\)\)/, "the box sits above the logo");
  assert.match(mobile, /body\.premium-ui \.chat-column \{\s*\n\s*padding-bottom: 150px/);
  assert.match(mobile, /\.app-menu-panel \{[\s\S]{0,200}width: 100%/, "the menu is a bottom sheet on a phone");
  assert.match(css, /\.home-logo \{[^}]*width: 44px;[^}]*height: 44px;/, "a thumb-sized target");
});

test("the sheets are honest about what the app is", () => {
  const install = html.slice(html.indexOf('id="install-overlay"'), html.indexOf('id="command-overlay"'));
  assert.match(install, /id="install-now" hidden/);
  // No pretend installer: the sheet says what can be installed today and what
  // needs a build machine, rather than offering a download that does not exist.
  assert.match(app, /A real \.apk or \.exe/);
  assert.match(app, /PACKAGING\.md/);
  assert.match(app, /addEventListener\("beforeinstallprompt"/);
});

test("the keyboard cannot walk out of an open menu or sheet", () => {
  assert.match(app, /if \(event\.key !== "Tab"\) return;/);
  assert.match(app, /const open = !\$\("#app-menu"\)\?\.hidden/);
  assert.match(app, /nextFocusTarget\(\{\s*\n\s*items: focusableWithin\(open\),/);
  // Escape closes the menu first, then the attach sheet, then the other sheets.
  const esc = app.slice(app.indexOf('// Escape closes the menu first'), app.indexOf('// Escape closes the menu first') + 600);
  assert.match(esc, /if \(closeAppMenu\(\)\)/);
  assert.match(esc, /if \(closeAttach\(\)\)/);
  assert.match(esc, /"history-overlay", "install-overlay"/);
});
