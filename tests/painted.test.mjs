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
import { composite, contrast } from "../js/colour.js";

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

test("every painting on the page carries its true size, real alt text and lazy loading", () => {
  // 2.40.0 rebuilt the page around the gallery, so the check is no longer "the
  // one hero plate": it is every plate the page shows, found by the path rather
  // than by a class. A picture that lies about its size is a layout shift, and a
  // page of twenty-four of them is a page that jumps while it loads.
  const images = [...page.matchAll(/<img\b[^>]*>/g)].map((match) => match[0])
    .filter((tag) => /src="\.\/assets\/paint\//.test(tag));
  assert.ok(images.length >= 20, `the page shows the paintings (${images.length} images)`);
  for (const tag of images) {
    const src = tag.match(/src="\.\/(assets\/paint\/[^"?]+)(?:\?[^"]*)?"/);
    assert.ok(src, "the image is a plate from this repository, not another host");
    const [width, height] = PLATES[src[1]] || [];
    assert.ok(width, `${src[1]} is one of the plates`);
    assert.match(tag, new RegExp(`width="${width}"`), `${src[1]}: the width is the file's width`);
    assert.match(tag, new RegExp(`height="${height}"`), `${src[1]}: the height is the file's height`);
    const alt = tag.match(/alt="([^"]*)"/)?.[1] ?? "";
    assert.ok(alt.length > 25, `${src[1]}: the alt text describes the painting`);
    assert.doesNotMatch(alt, /\.webp|^image$|^picture$|screenshot/i, "alt text is written for a reader");
    assert.match(tag, /loading="lazy"/, `${src[1]}: a picture below the fold does not hold up the page`);
    assert.match(tag, /decoding="async"/, `${src[1]}: and it decodes off the main thread`);
  }
  // Nothing is fetched from another host: the page still works on a dead Wi-Fi.
  // The canonical link names this site and the footer credits Zero Vast; neither
  // is a request for a file.
  const withoutCanonical = page.replace(/<link rel="canonical"[^>]*>/, "");
  assert.doesNotMatch(withoutCanonical, /(?:src|href)="https?:\/\/(?!zero-vast)/, "no remote images");
});

test("text is never set directly on a field: the sheet under it is measured", () => {
  // The 2.40.0 page has no photograph behind its type. It has four pastel fields
  // and sheets of glass, which is a harder promise to keep honestly: the reader is
  // looking through a translucent pane at a moving colour. So the promise is
  // computed rather than asserted — take the tinted sheet at its *thinnest*
  // declared value, composite it over each field at full strength, and require the
  // ink to clear 4.5:1 on all four.
  const token = (name) => {
    const hex = new RegExp(`--wl-${name}:\\s*(#[0-9a-f]{6})`, "i").exec(css)?.[1];
    assert.ok(hex, `--wl-${name} is declared`);
    return hex;
  };
  const thin = Number(/--wl-tint-thin: color-mix\(in srgb, var\(--wl-sheet\) (\d+)%/.exec(css)?.[1]);
  assert.ok(thin >= 40 && thin <= 60, `the thinnest sheet is declared (${thin}%)`);
  const alpha = Math.round((thin / 100) * 255).toString(16).padStart(2, "0");
  for (const field of ["blush", "dune", "lagoon", "peach"]) {
    // A field is painted at full colour and dimmed by the layer's opacity, so the
    // worst case is that field at full strength — which is what this composites.
    const under = composite(`${token(field)}ff`, token("bg"));
    const sheet = composite(`${token("sheet")}${alpha}`, under);
    for (const [ink, floor] of [["ink", 4.5], ["soft", 4.5], ["quiet", 4.5]]) {
      const ratio = contrast(token(ink), sheet);
      assert.ok(ratio >= floor, `${ink} on the ${field} field through glass is ${ratio.toFixed(2)}:1, needs ${floor}`);
    }
  }

  // And the page itself, before any glass: the numbers a reader actually reads.
  for (const [ink, paper, floor] of [["ink", "bg", 12], ["soft", "bg", 7], ["quiet", "bg", 4.5]]) {
    const ratio = contrast(token(ink), token(paper));
    assert.ok(ratio >= floor, `${ink} on ${paper} is ${ratio.toFixed(2)}:1, needs ${floor}`);
  }
  // Type sits on a sheet or on the page, never on a bare field: the hero's copy
  // column has no background of its own, and every card that holds a paragraph
  // does.
  assert.match(css, /\.wl-hero-copy \{ display: grid; gap: 20px; align-content: center; \}/, "the hero copy is on the page");
  assert.match(css, /\.wl-cell \{[\s\S]*?background: var\(--wl-tint\);/, "a card with a paragraph is a sheet");
  assert.match(css, /\.wl-steps li \{[\s\S]*?background: var\(--wl-tint\);/, "so is a step");
});

test("the decoration is drawn, not pasted, and it is only decoration", () => {
  // The page has no inline SVG at all now, and no ornament image: the ring, the
  // brush sweep and the seal were replaced by the material itself — four fields,
  // a haze, dust, and the rim light on every sheet. That is a stronger version of
  // the same rule, so it is checked more strictly: there is nothing to paste.
  assert.doesNotMatch(page, /<svg\b/, "no ornament is pasted into the page");
  const decorative = [...page.matchAll(/<(?:div|span)\b[^>]*class="(wl-hero-paint|wl-hero-mist|wl-motes)"[^>]*>/g)];
  assert.equal(decorative.length, 3, "the three decorative layers are in the page");
  for (const layer of decorative) assert.match(layer[0], /aria-hidden="true"/, "and each is hidden from a screen reader");
  for (const layer of ["wl-hero-paint", "wl-hero-mist", "wl-motes"]) {
    assert.match(css, new RegExp(`\\.${layer} \\{[\\s\\S]*?(?:position: fixed|inset: 0)`), `${layer} is a drawn layer`);
  }
  // No image is loaded as decoration: the only <img> tags are the brand mark and
  // the paintings themselves.
  for (const tag of page.matchAll(/<img\b[^>]*>/g)) {
    assert.match(tag[0], /src="\.\/(?:icons\/|assets\/paint\/)/, "an image is the mark or a painting");
  }
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
