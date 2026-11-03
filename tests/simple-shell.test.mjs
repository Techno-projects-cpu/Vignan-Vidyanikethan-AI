/**
 * The simple shell.
 *
 * A student came here to study, not to learn a workspace. So the app opens as
 * one chat — greeting, question box on the bottom edge, and a small logo in the
 * top-left corner — and the ten screens live behind that logo, in a drawer that
 * slides in from the left. These tests hold both halves of that promise: the
 * conversation is the only thing on screen, and nothing was actually taken away.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  badgeText,
  bindEdgeSwipe,
  chatStarters,
  edgeSwipeIntent,
  hasConversation,
  historyItems,
  timestampLabel,
  viewportBox,
} from "../js/shell.js";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const html = read("index.html");
const css = read("styles-next.css");
const app = read("js/app.js");

/** The element names a bare selector may legitimately start with. */
const TAGS = new Set(("a abbr address area article aside audio b base bdi bdo blockquote body br button canvas " +
  "caption cite code col colgroup data datalist dd del details dfn dialog div dl dt em embed fieldset " +
  "figcaption figure footer form h1 h2 h3 h4 h5 h6 head header hgroup hr html i iframe img input ins kbd " +
  "label legend li link main map mark menu meta meter nav noscript object ol optgroup option output p " +
  "param picture pre progress q rp rt ruby s samp script section select slot small source span strong " +
  "style sub summary sup table tbody td template textarea tfoot th thead time title tr track u ul var " +
  "video wbr svg path use circle g text tspan").split(" "));

test("the page opens on a chat, with a logo in the corner", () => {
  assert.match(html, /<button[^>]*class="home-logo"[^>]*id="home-logo"[^>]*aria-haspopup="dialog"[^>]*aria-controls="app-menu"/);
  assert.match(html, /id="home-logo"[\s\S]{0,200}<img src="\.\/icons\/icon\.svg\?v=\d+"/);
  // The advanced chrome is folded away, not deleted: the sidebar and the tab
  // bar are still in the page for the menu and for screen readers.
  assert.match(html, /<aside class="sidebar">/);
  assert.match(html, /class="mobile-nav"/);
  assert.match(css, /body\.premium-ui \.sidebar,\s*\nbody\.premium-ui \.topbar\.premium-topbar,\s*\nbody\.premium-ui \.topbar,\s*\nbody\.premium-ui \.mobile-nav,/);
  assert.match(css, /body\.premium-ui \.mobile-nav,\s*\nbody\.premium-ui \.goal-cards \{\s*\n\s*display: none;/);
  // The chat is one centred column with the question box on the bottom edge.
  assert.match(css, /body\.premium-ui #view-ask \.chat-column \{[^}]*max-width: 820px/);
  assert.match(css, /body\.premium-ui \.composer \{[^}]*flex: 0 0 auto/);
  // The base layer sets `display: grid !important` on this header, so the hide
  // has to carry the same weight or the numbered header stays above the chat.
  assert.match(css, /body\.premium-ui\[data-view="ask"\] \.page-head \{\s*\n\s*display: none !important;/);
  // An empty chat keeps a greeting: a blank screen with a box on the bottom
  // edge is what a broken app looks like.
  assert.match(css, /body\.premium-ui #view-ask\.has-conversation \.premium-hero \{\s*\n\s*display: none;/);
  assert.match(css, /body\.premium-ui #view-ask \.premium-hero \{[^}]*padding: 64px var\(--vn-space-5\) var\(--vn-space-4\)/);
});

test("the logo opens a menu with every screen in it", () => {
  const menu = html.slice(html.indexOf('id="app-menu"'), html.indexOf('id="history-overlay"'));
  for (const view of ["ask", "library", "quiz", "exam", "flashcards", "progress", "friends", "chat", "play", "settings"]) {
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

test("the question box sits on the bottom edge, in the middle, like a messaging tool", () => {
  // The ask screen owns the window. Its height does not come from the app
  // shell above it, so no ancestor can push the box down the page — this is
  // what was broken when the box floated up over the suggestion chips on an
  // empty chat.
  assert.match(css, /body\.premium-ui #view-ask\.active \{[^}]*position: fixed;/);
  assert.match(css, /body\.premium-ui #view-ask\.active \{[^}]*height: var\(--vn-viewport-height, 100dvh\);/);
  assert.match(css, /body\.premium-ui #view-ask\.active \{[^}]*display: flex;[^}]*flex-direction: column;/);
  // With no messages there is nothing to stretch, so the column itself has to
  // pack its children to the bottom.
  assert.match(css, /body\.premium-ui #view-ask \.chat-column \{[^}]*justify-content: flex-end;/);
  // Only the messages scroll.
  assert.match(css, /body\.premium-ui #view-ask \.chat-log \{[^}]*flex: 1 1 0;[^}]*overflow-y: auto;/);
  // The order on screen puts the box last, whatever order the markup is in.
  assert.match(css, /body\.premium-ui #view-ask \.composer \{ order: 5; flex-shrink: 0; \}/);
  assert.match(css, /body\.premium-ui \.composer \{[^}]*padding: var\(--vn-space-2\) 0 calc\(var\(--vn-space-4\) \+ env\(safe-area-inset-bottom\)\)/);
  // The old phone workaround — a box lifted 56px to clear a bottom-left logo —
  // is gone, because there is no longer a logo down there.
  assert.doesNotMatch(css, /bottom: calc\(56px \+ env\(safe-area-inset-bottom\)\)/);
});

test("the layer matches the visible window, so the keyboard cannot cover the box", () => {
  // A phone with the keyboard open: 640 of 844 pixels are visible.
  assert.deepEqual(
    viewportBox({ viewportHeight: 640, viewportOffset: 0, innerHeight: 844 }),
    { height: "640px", top: "0px", keyboard: 204 },
  );
  // Zoomed in a little, the visible slice starts part-way down the page.
  assert.deepEqual(
    viewportBox({ viewportHeight: 700, viewportOffset: 44, innerHeight: 844 }),
    { height: "700px", top: "44px", keyboard: 144 },
  );
  // Nonsense and absent numbers fall back to the whole window.
  assert.deepEqual(viewportBox({}), { height: "100dvh", top: "0px", keyboard: 0 });
  assert.equal(viewportBox({ viewportHeight: 0, innerHeight: 800 }).height, "800px");
  assert.equal(viewportBox({ viewportHeight: 40, innerHeight: 800 }).height, "800px", "a pinch-zoom sliver is ignored");
  assert.equal(viewportBox({ viewportHeight: 900, innerHeight: 800 }).height, "800px", "never taller than the window");
  assert.equal(viewportBox({ viewportHeight: 640, viewportOffset: -20, innerHeight: 844 }).top, "0px");
  // It is wired to the real viewport, not just exported.
  assert.match(app, /window\.visualViewport/);
  assert.match(app, /root\.setProperty\("--vn-viewport-height", box\.height\)/);
  assert.match(app, /root\.setProperty\("--vn-viewport-offset", box\.top\)/);
  assert.match(app, /viewport\.addEventListener\("resize", apply\)/);
});

test("clicking the logo actually opens the drawer", () => {
  // The bug that made the whole app feel broken: `$("home-logo")` — a bare
  // element name — matched nothing, so the only navigation in the app did
  // nothing at all when tapped. Assert the binding itself, not just the idea.
  assert.match(app, /\$\("#home-logo"\)\?\.addEventListener\("click", \(\) => toggleAppMenu\(\)\)/);
  assert.doesNotMatch(app, /\$\("home-logo"\)/);
  // And every selector in the app has to be a selector. A bare word is only
  // valid when it is a real element name.
  for (const [, selector] of app.matchAll(/\$\$?\("([^"]+)"\)/g)) {
    const first = selector.trim().split(/[\s>+~]/)[0];
    assert.ok(
      /^[#.[*:]/.test(first) || TAGS.has(first),
      `"${selector}" in js/app.js is not a selector and would silently match nothing`,
    );
  }
});

test("the menu is a drawer that slides in from the left edge", () => {
  assert.match(css, /\.app-menu-panel \{[^}]*inset-block: 0;[^}]*inset-inline-start: 0;/);
  assert.match(css, /\.app-menu-panel \{[^}]*width: min\(320px, 86vw\)/);
  assert.match(css, /@keyframes vn-drawer-in \{\s*\n\s*from \{ transform: translateX\(-100%\); \}/);
  // Right-to-left pages open from their own left, which is the right edge.
  assert.match(css, /\[dir="rtl"\] \.app-menu-panel[\s\S]{0,120}vn-drawer-in-rtl/);
  assert.match(css, /@keyframes vn-drawer-in-rtl \{\s*\n\s*from \{ transform: translateX\(100%\); \}/);
  // Nothing is left of the drop-up.
  assert.doesNotMatch(css, /\.app-menu-panel \{[^}]*max-height: min\(76vh, 640px\)/);
});

test("the logo is a small target in the top-left corner", () => {
  assert.match(css, /\.home-logo \{[^}]*top: calc\(var\(--vn-space-3\) \+ env\(safe-area-inset-top\)\)/);
  assert.match(css, /\.home-logo \{[^}]*width: 40px;[^}]*height: 40px;/);
  assert.match(css, /\.home-logo img \{[^}]*width: 24px/);
});

test("a swipe from the left edge opens the drawer, and a swipe back closes it", () => {
  const base = { startY: 400, y: 410, width: 400 };
  // Rightwards from the edge: open. Vertically: that was a scroll.
  assert.equal(edgeSwipeIntent({ ...base, startX: 10, x: 120 }), "open");
  assert.equal(edgeSwipeIntent({ ...base, startX: 10, x: 30 }), null, "not far enough");
  assert.equal(edgeSwipeIntent({ ...base, startX: 10, x: 30, y: 600 }), null, "a scroll, not a swipe");
  // Starting mid-page is a scroll gesture, not a menu gesture.
  assert.equal(edgeSwipeIntent({ ...base, startX: 200, x: 340 }), null);
  // An open drawer closes when pulled back towards its edge.
  assert.equal(edgeSwipeIntent({ ...base, startX: 200, x: 80, open: true }), "close");
  assert.equal(edgeSwipeIntent({ ...base, startX: 200, x: 340, open: true }), null);
  // Mirrored on a right-to-left page.
  assert.equal(edgeSwipeIntent({ ...base, startX: 390, x: 280, rtl: true }), "open");
  assert.equal(edgeSwipeIntent({ ...base, startX: 10, x: 120, rtl: true }), null);
  assert.equal(edgeSwipeIntent({ ...base, startX: 200, x: 320, rtl: true, open: true }), "close");
  // Nonsense numbers never open a menu.
  assert.equal(edgeSwipeIntent({ startX: Number.NaN, x: 10, y: 10, width: 400 }), null);
  assert.equal(edgeSwipeIntent({ ...base, startX: 5, x: 100, width: 0 }), null);
  // The app wires that decision to the real drawer.
  assert.match(app, /bindEdgeSwipe\(document, \{/);
  assert.match(app, /onOpen: \(\) => openAppMenu\(\)/);
  assert.match(app, /onClose: \(\) => closeAppMenu\(\)/);
});

test("the gesture is driven by real touch events, and can be unhooked", () => {
  const handlers = new Map();
  const target = {
    addEventListener: (type, fn) => handlers.set(type, fn),
    removeEventListener: (type) => handlers.delete(type),
  };
  const calls = [];
  let open = false;
  const unbind = bindEdgeSwipe(target, {
    width: () => 400,
    isOpen: () => open,
    onOpen: () => { calls.push("open"); open = true; },
    onClose: () => { calls.push("close"); open = false; },
  });
  const touch = (type, x, y) => handlers.get(type)({ touches: type === "touchend" ? [] : [{ clientX: x, clientY: y }] });

  touch("touchstart", 12, 300);
  touch("touchmove", 160, 306);
  assert.deepEqual(calls, ["open"], "a drag in from the edge opens it");

  touch("touchstart", 200, 300);
  touch("touchmove", 60, 304);
  assert.deepEqual(calls, ["open", "close"], "a drag back closes it");

  // Two fingers are a pinch, and a vertical drag is a scroll: neither opens it.
  handlers.get("touchstart")({ touches: [{ clientX: 10, clientY: 10 }, { clientX: 20, clientY: 10 }] });
  touch("touchmove", 200, 20);
  touch("touchstart", 10, 300);
  touch("touchmove", 20, 600);
  assert.deepEqual(calls, ["open", "close"]);

  unbind();
  assert.equal(handlers.size, 0, "the listeners come off again");
  // Something without listeners is not an error.
  assert.equal(typeof bindEdgeSwipe(null), "function");
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

test("going home keeps the conversation; starting a new one asks first", () => {
  // The menu has both: "Chat" returns, "New chat" clears — and only clearing
  // asks, because only clearing loses something.
  const menu = html.slice(html.indexOf('id="app-menu"'), html.indexOf('id="history-overlay"'));
  assert.match(menu, /data-menu-view="ask"[^>]*>[\s\S]{0,120}<span>Chat<\/span>/);
  assert.match(menu, /data-menu-action="new-chat"/);
  assert.match(app, /const asked = hasConversation\(state\.messages\);/);
  assert.match(app, /title: "Start a new chat\?"/);
  assert.match(app, /message: "The conversation on this device is cleared/);
});
