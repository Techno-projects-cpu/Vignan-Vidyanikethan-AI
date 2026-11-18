/**
 * The painted edition.
 *
 * The landing page and the app's opening are built on four painted plates in
 * `assets/paint/` — a library at dusk, the open book with the brush still in its
 * gutter, a band of sumi ink and a lantern-lit room at night — with brushed
 * ornaments drawn in the markup itself.
 *
 * Pictures are the easiest thing on a web page to get wrong quietly: a hero image
 * that is four megabytes on a school connection, an `alt` that says "image", a
 * plate that is missing from the offline cache so the page arrives blank when the
 * Wi-Fi dies, or a caption sitting on the busiest part of the painting. So these
 * tests check the pictures the way the rest of the suite checks the claims:
 *
 * 1. Every plate is real, is WebP, is inside a size budget, and is precached —
 *    because a painted page that cannot paint offline is worse than a plain one.
 * 2. Every `<img>` carries its true pixel size (so nothing jumps while it loads),
 *    real alt text, and lazy loading.
 * 3. Text is never set directly on a painting: there is a scrim between them, and
 *    the ink on that scrim clears 4.5:1.
 * 4. The ornaments are decoration: `aria-hidden`, drawn in `currentColor`, and
 *    the seal appears once.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (file) => readFileSync(path.join(root, file), "utf8");
const bytes = (file) => readFileSync(path.join(root, file));

const page = read("welcome.html");
const css = read("styles-welcome.css");
const appCss = read("styles-next.css");
const index = read("index.html");
const precache = JSON.parse(read("precache.json"));

// The set is data now: `assets/paint/manifest.json` is written by
// tools/optimise-paint.mjs and records every plate's real dimensions and bytes.
// Typing them here again is how the map drifted from the files last time.
const MANIFEST = JSON.parse(read("assets/paint/manifest.json"));
const PLATES = Object.fromEntries(
  MANIFEST.plates.map((plate) => [`assets/paint/${plate.name}.webp`, [plate.width, plate.height]]),
);

/** WebP is a RIFF container whose form type is WEBP; the first 12 bytes say so. */
function isWebp(buffer) {
  return buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
}

/** The dimensions out of the VP8, VP8L or VP8X header. */
function webpSize(buffer) {
  const chunk = buffer.toString("ascii", 12, 16);
  if (chunk === "VP8X") {
    const width = 1 + buffer.readUIntLE(24, 3);
    const height = 1 + buffer.readUIntLE(27, 3);
    return [width, height];
  }
  if (chunk === "VP8L") {
    const packed = buffer.readUInt32LE(21);
    return [(packed & 0x3fff) + 1, ((packed >> 14) & 0x3fff) + 1];
  }
  // Lossy VP8: the size is a 14-bit pair after the 3-byte start code.
  const start = buffer.indexOf(Buffer.from([0x9d, 0x01, 0x2a]));
  return [buffer.readUInt16LE(start + 3) & 0x3fff, buffer.readUInt16LE(start + 5) & 0x3fff];
}

const relative = (value) => value.replace(/^\.\//, "").split("?")[0];

test("every painted plate is a real WebP, and the whole set fits an offline budget", () => {
  let total = 0;
  for (const [file, [width, height]] of Object.entries(PLATES)) {
    assert.ok(existsSync(path.join(root, file)), `${file} exists`);
    const data = bytes(file);
    assert.ok(isWebp(data), `${file} is WebP, not a renamed JPEG`);
    assert.deepEqual(webpSize(data), [width, height], `${file} is ${width}x${height}`);
    total += statSync(path.join(root, file)).size;
  }
  // Eighteen paintings on a school connection. The budget is the manifest's, so
  // adding a plate is a deliberate decision rather than a silent regression.
  assert.ok(
    total <= MANIFEST.budget.canonicalTotal,
    `the plates weigh ${Math.round(total / 1024)}KB, budget is ${Math.round(MANIFEST.budget.canonicalTotal / 1024)}KB`,
  );
  // The gallery never downloads the canonical file on a phone: a 640 tile must
  // exist, be WebP, and be a fraction of the size.
  for (const plate of MANIFEST.plates) {
    const tile = bytes(`assets/paint/${plate.name}-640.webp`);
    assert.ok(isWebp(tile), `${plate.name}-640 is WebP`);
    assert.equal(webpSize(tile)[0], 640, `${plate.name}-640 is 640px wide`);
    assert.ok(tile.length < plate.bytes.canonical, `${plate.name}: the tile is smaller than the plate`);
  }
});

test("nothing paints offline that is not in the cache", () => {
  // The worker installs `precache.json`; a plate missing from it would leave a
  // grey rectangle on an aeroplane, which is exactly the failure this app exists
  // to avoid.
  const urls = new Set(precache.urls);
  for (const file of Object.keys(PLATES)) {
    assert.ok(urls.has(`./${file}`), `${file} is precached so it survives the Wi-Fi going off`);
  }
  // And every image the two stylesheets name is one of those plates.
  for (const sheet of [css, appCss]) {
    for (const [, target] of sheet.matchAll(/url\((['"]?)([^'")]+)\1\)/g)) {
      if (!target.startsWith("./assets/paint/")) continue;
      assert.ok(Object.keys(PLATES).includes(relative(target)), `${target} in a stylesheet is a plate we ship`);
    }
  }
});

test("a painted image carries its true size, real alt text and lazy loading", () => {
  // Only the paintings are checked here: the brand mark in the header is an SVG
  // icon, and it has its own test in branding.test.mjs.
  const images = [...page.matchAll(/<img\b[^>]*class="wl-paint"[^>]*>/g)].map((match) => match[0]);
  assert.ok(images.length >= 1, "the page shows its painting as an image");
  for (const tag of images) {
    const src = tag.match(/src="\.\/(assets\/paint\/[^"?]+)(?:\?[^"]*)?"/);
    assert.ok(src, "the image is a plate from this repository, not another host");
    const [width, height] = PLATES[src[1]] || [];
    assert.ok(width, `${src[1]} is one of the plates`);
    assert.match(tag, new RegExp(`width="${width}"`), "the width is the file's width");
    assert.match(tag, new RegExp(`height="${height}"`), "the height is the file's height");
    const alt = tag.match(/alt="([^"]*)"/)?.[1] ?? "";
    assert.ok(alt.length > 25, "the alt text describes the painting rather than naming the file");
    assert.doesNotMatch(alt, /\.webp|^image$|^picture$|screenshot/i, "alt text is written for a reader");
    assert.match(tag, /loading="lazy"/, "a picture below the fold does not hold up the page");
    assert.match(tag, /decoding="async"/, "and it decodes off the main thread");
  }
  // Nothing is fetched from another host: the page still works on a dead Wi-Fi.
  // The canonical link names this site and the footer credits Zero Vast; neither
  // is a request for a file.
  const withoutCanonical = page.replace(/<link rel="canonical"[^>]*>/, "");
  assert.doesNotMatch(withoutCanonical, /(?:src|href)="https?:\/\/(?!zero-vast)/, "no remote images");
});

test("text is never set directly on a painting", () => {
  // The hero puts a wash of ink between the plate and the type, and the type sits
  // above both. Without this the title lands on a busy bookshelf.
  assert.match(css, /\.wl-hero-paint \{[\s\S]*?z-index: 0;/, "the painting is the back layer");
  assert.match(css, /\.wl-hero::after \{[\s\S]*?linear-gradient\([\s\S]*?z-index: 1;/, "a scrim sits over it");
  assert.match(css, /\.wl-hero-copy \{[\s\S]*?z-index: 2;/, "the words sit above the scrim");
  assert.match(css, /\.wl-night::before \{[\s\S]*?linear-gradient/, "the closing room gets the same treatment");

  // The inks on those two surfaces have to stay readable. Ratios are computed
  // from the tokens, so a repaint cannot quietly dim the body copy.
  const token = (name) => {
    const hex = new RegExp(`--wl-${name}:\\s*(#[0-9a-f]{6})`, "i").exec(css)?.[1];
    assert.ok(hex, `--wl-${name} is declared`);
    return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  };
  const luminance = (rgb) => {
    const [r, g, b] = rgb.map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a, b) => {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (light + 0.05) / (dark + 0.05);
  };
  for (const [ink, paper, floor] of [
    ["ink", "bg", 4.5],
    ["soft", "bg", 4.5],
    ["quiet", "bg", 4.5],
    ["paper-ink", "paper", 4.5],
    ["paper-ink-quiet", "paper", 4.5],
  ]) {
    const ratio = contrast(token(ink), token(paper));
    assert.ok(ratio >= floor, `${ink} on ${paper} is ${ratio.toFixed(2)}:1, needs ${floor}`);
  }
});

test("the ornaments are drawn, not pasted, and they are only decoration", () => {
  // The ensō, the two brush sweeps and the seal are inline SVG: they take the
  // page's ink through `currentColor`, so they cannot introduce a colour of their
  // own, and they need no request.
  for (const [name, pattern] of [
    ["the ensō", /<svg class="wl-enso"[\s\S]*?<\/svg>/],
    ["the brush stroke", /<svg class="wl-stroke"[\s\S]*?<\/svg>/],
    ["the seal", /<svg class="wl-seal"[\s\S]*?<\/svg>/],
  ]) {
    const svg = page.match(pattern)?.[0];
    assert.ok(svg, `${name} is in the page`);
    assert.match(svg, /aria-hidden="true"/, `${name} is hidden from a screen reader`);
    assert.match(svg, /focusable="false"/, `${name} is not a tab stop`);
    assert.match(svg, /<path\b/, `${name} is drawn with a path`);
  }
  assert.match(css, /\.wl-enso path \{[\s\S]*?stroke: currentColor;/, "the ring takes the page's ink");
  assert.match(css, /\.wl-stroke path \{ fill: currentColor; \}/, "the sweep does too");
  assert.match(css, /\.wl-seal \{[\s\S]*?color: var\(--wl-vermilion\);/, "the seal is the one red mark");

  // One seal per page. A second would stop being a signature and start being a
  // motif.
  assert.equal((page.match(/class="wl-seal"/g) || []).length, 1, "one seal, in one place");
  // And a brush under every section heading, so the page keeps the same hand.
  assert.equal((page.match(/class="wl-brush"/g) || []).length, 4, "a brush stroke under each section head");
  for (const match of page.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)) {
    assert.doesNotMatch(match[1], /<em|<i\b|<b\b|<strong|<mark/, "a heading is still set in one voice");
  }
});

test("the app opens on the same painting, and it gets out of the way", () => {
  assert.match(index, /<div class="ask-paint" aria-hidden="true"><\/div>/, "the opening is painted");
  assert.match(appCss, /\.ask-paint \{[\s\S]*?assets\/paint\/library-dusk\.webp/, "with the same plate as the hero");
  assert.match(appCss, /mask-image: linear-gradient/, "fading into the app's own surface");
  // Once there is a conversation, the chat is the screen. The painting is an
  // opening, not wallpaper behind a scroll of answers.
  assert.match(appCss, /#view-ask\.has-conversation \.ask-paint \{ display: none; \}/);
  // The strip is allowed to drift and to do nothing else: the keyframes that
  // drive it may not touch size, colour or position of the box, which is what a
  // ken-burns-into-a-glitch usually starts with.
  const drift = appCss.match(/@keyframes ask-paint-drift \{([\s\S]*?)\n\}/)?.[1] ?? "";
  assert.ok(drift, "the drift is a named animation");
  const properties = [...new Set([...drift.matchAll(/([a-z-]+)\s*:/g)].map((match) => match[1]))];
  assert.deepEqual(properties, ["background-position"], "only the crop moves, nothing resizes or fades");
  assert.equal((drift.match(/background-position/g) || []).length, 2, "two stops, both a crop");
  // And the conversation itself never moves: no infinite loop names the chat.
  const appRules = appCss.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const [, selector] of appRules.matchAll(/([^{}]+)\{[^{}]*animation:[^{}]*infinite[^{}]*\}/g)) {
    assert.doesNotMatch(selector, /chat-log|composer|chat-column/, "the chat does not loop");
  }
});
