/**
 * The 2.0 design layer.
 *
 * A stylesheet is code, and it can regress like code: a stray 12px radius, a
 * 32px tap target on a phone, a headline that only exists for screen readers.
 * These tests are what "the redesign still holds" means, in a repository with no
 * browser to look at it with.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { THEMES } from "../js/themes.js";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const css = read("styles-next.css");
const html = read("index.html");
const app = read("js/app.js");

/* WCAG relative luminance and contrast. */
const channel = (value) => {
  const v = value / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex) => {
  const [r, g, b] = hex.replace("#", "").match(/.{2}/g).map((pair) => parseInt(pair, 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

const contrast = (a, b) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};

test("the new layer loads last, so it is the one that decides", () => {
  const sheets = [...html.matchAll(/<link rel="stylesheet" href="\.\/(styles-[a-z-]+\.css)/g)].map((m) => m[1]);
  assert.equal(sheets.at(-1), "styles-next.css", `load order: ${sheets.join(" → ")}`);
  assert.ok(sheets.length >= 6);
});

test("sharp corners: nothing in the new layer rounds a box", () => {
  const radii = [...css.matchAll(/border-radius:\s*([^;]+);/g)].map((m) => m[1].trim());
  assert.ok(radii.length > 0);
  const rounded = radii.filter((value) => value !== "0" && value !== "inherit");
  assert.deepEqual(rounded, [], `every corner is 0, found: ${rounded.join(", ")}`);
  // The token that older layers set to 22px is reset here.
  assert.match(css, /--radius:\s*0;/);
  assert.match(css, /--p-radius:\s*0;/);
});

test("one type scale, fluid where it needs to be", () => {
  for (const token of ["--vn-display", "--vn-h2", "--vn-h3", "--vn-body", "--vn-small", "--vn-meta", "--vn-label"]) {
    assert.match(css, new RegExp(`${token}:`), `${token} exists`);
  }
  assert.match(css, /--vn-display:\s*clamp\(/, "the display size scales with the screen");
  assert.match(css, /--vn-measure:\s*\d+ch/, "prose has a measure");
  assert.match(css, /font-family:\s*var\(--vn-font-display\)/, "headings have their own face");
  assert.match(css, /line-height:\s*1\.7/, "answer text is set for reading");
});

test("every theme keeps readable text under the new type sizes", () => {
  const failures = [];
  for (const theme of THEMES) {
    const ratio = contrast(theme.ink, theme.surface);
    if (ratio < 4.5) failures.push(`${theme.name}: ${ratio.toFixed(2)}:1`);
  }
  assert.deepEqual(failures, [], `themes below WCAG AA for body text:\n  ${failures.join("\n  ")}`);
});

test("the screen's own name is visible, not hidden for screen readers", () => {
  const head = html.match(/<div class="premium-view-meta page-head"[\s\S]*?<\/div>/);
  assert.ok(head, "the page head exists");
  assert.doesNotMatch(head[0], /sr-only/, "it is not visually hidden any more");
  assert.match(head[0], /id="view-index"/, "the section is numbered");
  for (const id of ["view-kicker", "view-title", "view-subtitle"]) {
    assert.match(head[0], new RegExp(`id="${id}"`), `${id} lives in the visible header`);
  }
  // It must be outside the fixed top bar, or it could never scroll away.
  const topbar = html.indexOf('class="topbar premium-topbar"');
  const header = html.indexOf('class="premium-view-meta page-head"');
  assert.ok(header > topbar, "the header sits after the top bar");
});

test("the header follows the screen you are on", () => {
  assert.match(app, /indexNode\.textContent = String\(index\)\.padStart\(2, "0"\)/);
  assert.match(app, /document\.body\.dataset\.view = view/);
  // The numbering comes from the same list the navigation is built from.
  assert.match(app, /const order = Object\.keys\(VIEW_META\);/);
});

test("a phone can reach every screen", () => {
  const mobile = html.match(/<nav class="mobile-nav"[\s\S]*?<\/nav>/)[0];
  const tabs = [...mobile.matchAll(/data-view="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(tabs, ["ask", "library", "quiz", "exam", "progress"], "five daily screens get a tab");
  assert.match(mobile, /id="mobile-more"/, "the rest of the app has a door");
  assert.match(app, /#mobile-more"\)\?\.addEventListener\("click"/, "the door opens the menu");
  // The menu lists all ten, so nothing is stranded.
  for (const view of ["flashcards", "friends", "chat", "play", "settings"]) {
    assert.ok(html.includes(`class="command-item" data-view="${view}"`), `${view} is in the menu`);
  }
});

test("nothing on a phone is smaller than a fingertip", () => {
  const mobile = css.slice(css.indexOf("@media (max-width: 860px)"));
  const block = mobile.slice(0, mobile.indexOf("@media (max-width: 400px)"));
  assert.match(block, /\.mobile-nav-item[\s\S]{0,200}min-height:\s*60px/, "tab targets are 60px");
  assert.match(block, /\.mobile-nav[\s\S]{0,300}env\(safe-area-inset-bottom\)/, "the bar clears the home indicator");
  assert.match(block, /\.goal-card \{ min-height: 78px; \}/);
  assert.match(block, /\.button,[\s\S]{0,120}min-height: 44px/, "buttons grow on touch");
  assert.match(css, /@media \(pointer: coarse\)[\s\S]{0,200}min-height: 44px/, "coarse pointers get 44px rows");
});

test("keyboard users can see where they are", () => {
  assert.match(css, /:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--vn-ink\)/);
  assert.match(css, /:focus:not\(:focus-visible\)\s*\{\s*outline:\s*none;/);
  assert.ok(html.includes('class="skip-link"'), "there is still a skip link");
});

test("motion is optional", () => {
  const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(reduced.slice(0, 600), /animation-duration:\s*0\.01ms !important/);
  assert.match(reduced.slice(0, 600), /transition-duration:\s*0\.01ms !important/);
  assert.match(css, /@media \(prefers-contrast: more\)/, "high contrast is honoured");
});

test("screens that are not on no longer cost anything to keep", () => {
  assert.match(css, /\.view:not\(\.active\)\s*\{[^}]*content-visibility:\s*auto/);
  assert.match(css, /contain-intrinsic-size:\s*auto 900px/);
});

test("the layer stays a surface layer", () => {
  // No script, no image, no external request: it can only restyle.
  assert.doesNotMatch(css, /url\((?!['"]?\.\/assets\/fonts)/, "no remote or image assets");
  assert.doesNotMatch(css, /@import/);
  // !important is a last resort; a handful for the legacy sr-only overrides is
  // acceptable, dozens would mean the layer is fighting itself.
  const important = (css.match(/!important/g) || []).length;
  assert.ok(important <= 20, `!important count is ${important}`);
});

test("the two faces are preloaded, not discovered late", () => {
  assert.match(html, /<link rel="preload" href="\.\/assets\/fonts\/space-grotesk-latin\.woff2" as="font"/);
  assert.match(html, /<link rel="preload" href="\.\/assets\/fonts\/manrope-latin\.woff2" as="font"/);
});

test("changing screen returns you to the top, and back to where you were", () => {
  // The window scrolls, not #main, so the old reset did nothing at all.
  assert.match(app, /function restoreScroll\(view\)/);
  assert.match(app, /scrollMemory\.set\(previous, currentScroll\(\)\)/);
  assert.match(app, /window\.scrollTo\(\{ top, left: 0, behavior: "auto" \}\)/);
  assert.doesNotMatch(app, /\$\("#main"\)\.scrollTop = 0;/, "the ineffective reset is gone");
});

test("navigation tells a screen reader which screen it is", () => {
  assert.match(app, /button\.setAttribute\("aria-current", "page"\)/);
  assert.match(app, /button\.removeAttribute\("aria-current"\)/);
});

test("the browser's own colour strip follows the palette", () => {
  assert.match(html, /<meta name="theme-color"/);
  assert.match(app, /function syncBrowserChrome\(\)/);
  assert.match(app, /getComputedStyle\(document\.body\)\.backgroundColor/);
  // Called when the theme flips and when the six styles change.
  assert.ok((app.match(/syncBrowserChrome\(\)/g) || []).length >= 2);
});

test("every colour and size the design layer uses actually exists", () => {
  // A `var(--vn-ink-3)` that nobody defines does not fall back to something
  // sensible: the whole declaration is dropped, and the rule silently does
  // nothing. That is how a "capped" border and a focus ring can ship invisible.
  const base = ["styles.css", "styles-premium.css", "styles-identity.css", "styles-legal.css"]
    .filter((file) => { try { readFileSync(new URL(`../${file}`, import.meta.url)); return true; } catch { return false; } })
    .map((file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8"))
    .join("\n");
  const defined = new Set([
    ...([...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((match) => match[1])),
    ...([...base.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((match) => match[1])),
  ]);
  const used = new Set([...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((match) => match[1]));
  const missing = [...used].filter((name) => !defined.has(name));
  assert.deepEqual(missing, [], `undefined custom properties: ${missing.join(", ")}`);
});

test("the composer ceiling is the same number in the script and the stylesheet", () => {
  const phoneRule = css.slice(css.indexOf("@media (max-width: 640px)", css.indexOf("15. The composer grows")));
  assert.match(phoneRule, /max-height: 150px/, "the stylesheet clamps a phone to five 24px rows plus border");
  assert.match(app, /matchMedia\("\(max-width: 640px\)"\)/, "the script uses the same breakpoint");
  assert.match(app, /maxRows: phone \? 5 : 8/);
  assert.match(css, /\.composer-input-row textarea \{[^}]*max-height: 210px/);
});

test("the hidden attribute still hides, whatever display this layer gives", () => {
  // `.to-top { display: inline-flex }` beat the UA's `[hidden]` rule, so the
  // back-to-top button was on screen from the first frame of every screen.
  // Two selectors, because a plain `[hidden]` loses to `.composer-input-row
// textarea` on specificity; `body.premium-ui [hidden]` outscores every rule in
// this layer that gives something a display, without an !important.
  assert.match(css, /\[hidden\],\s*\nbody\.premium-ui \[hidden\] \{\s*\n\s*display: none;/, "the guard is present");
  // Anything the app hides with the attribute renders no box, by construction.
  const hiddenInApp = [...app.matchAll(/([\w$]+)\.hidden = (true|false|![\w!]+)/g)].map((match) => match[1]);
  assert.ok(hiddenInApp.length >= 2, "the app does hide things this way");
  assert.match(html, /<button[^>]*id="to-top"[^>]*hidden/);
  assert.match(html, /id="shortcuts-overlay"[^>]*hidden/);
});
