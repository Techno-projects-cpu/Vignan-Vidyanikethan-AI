/**
 * Glass Morphism: the default, and the one theme with no painting.
 *
 * Because there is no photograph to measure, every claim about this theme has to
 * be checked against the numbers in `js/theme-glass.js` instead of against a
 * palette report. The interesting one is contrast: text sits on a 36% tint over a
 * background that is *four different colours in different places*, and it is
 * moving. So the test composites the tint over every field and takes the worst —
 * which is the only number that means anything.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { chroma, composite, contrast, hue, lightness } from "../js/colour.js";
import { GLASS_THEME, auroraColour, auroraHex8, glassTint, tintHex8 } from "../js/theme-glass.js";
import { DEFAULT_STYLE, THEMES, isGlassTheme, isPaintedStyle, themeById } from "../js/themes.js";
import { SUPPORTED_LANGUAGES } from "../js/i18n.js";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const css = read("styles-glass.css");

/** The tint over each field, which is what a panel actually sits on. */
function surfaces() {
  return GLASS_THEME.aurora.map((field) => {
    const backdrop = composite(auroraHex8(field), GLASS_THEME.bg);
    return { id: field.id, hex: composite(tintHex8(), backdrop) };
  });
}

test("glass is the default, the first tile, and it is not painted", () => {
  assert.equal(DEFAULT_STYLE, "glass");
  assert.equal(THEMES[0].id, "glass", "the first thing in the picker is what the app opens on");
  assert.equal(themeById("glass").name, "Glass Morphism");
  assert.equal(isGlassTheme("glass"), true);
  assert.equal(isGlassTheme("rain"), false);
  assert.equal(isPaintedStyle("glass"), false, "there is no plate to measure");
  assert.equal(themeById("glass").painted, false);
  // The tile shows the page, the accent and a field — the three colours someone
  // is choosing between, not three shades of the same white.
  assert.deepEqual(themeById("glass").swatches, [GLASS_THEME.bg, GLASS_THEME.accent, GLASS_THEME.aurora[0].hex]);
  // And the two older looks are still in the list, by name.
  assert.ok(THEMES.some((theme) => theme.id === "minimal"), "Minimal is still a style");
  assert.ok(THEMES.some((theme) => theme.id === "legacy"), "Legacy is still a style");
});

test("it is a light theme, and the ink is dark on light glass", () => {
  assert.equal(GLASS_THEME.scheme, "light");
  assert.ok(lightness(GLASS_THEME.bg) > 92, "the page is near-white");
  assert.ok(lightness(GLASS_THEME.ink) < 30, "and the ink is dark");
  // Pink, beige and turquoise are the brief — checked as hues, not as hex codes.
  const hues = GLASS_THEME.aurora.map((field) => ({ id: field.id, hue: hue(field.hex), chroma: chroma(field.hex) }));
  const pink = hues.find((entry) => entry.id === "blush");
  const sand = hues.find((entry) => entry.id === "sand");
  const lagoon = hues.find((entry) => entry.id === "lagoon");
  assert.ok(pink.hue > 320 || pink.hue < 12, `blush is pink (${pink.hue.toFixed(0)}°)`);
  assert.ok(sand.hue > 20 && sand.hue < 95, `sand is beige (${sand.hue.toFixed(0)}°)`);
  assert.ok(lagoon.hue > 150 && lagoon.hue < 195, `lagoon is turquoise (${lagoon.hue.toFixed(0)}°)`);
  for (const field of hues) assert.ok(field.chroma > 8, `${field.id} is actually a colour, not a grey`);
  // The accent is the one dark saturated colour on the screen.
  assert.ok(contrast(GLASS_THEME.accent, GLASS_THEME.bg) >= 4.5, "accent as text on the page");
  assert.ok(contrast(GLASS_THEME.accentInk, GLASS_THEME.accent) >= 4.5, "white label on the accent");
});

test("the text clears 7:1 over every field, not just the average one", () => {
  const surfacesUnder = surfaces();
  for (const surface of surfacesUnder) {
    const ink = contrast(GLASS_THEME.ink, surface.hex);
    assert.ok(ink >= 7, `${surface.id}: ink on the sheet is ${ink.toFixed(2)}:1, below the 7:1 this theme promises`);
    const muted = contrast(GLASS_THEME.muted, surface.hex);
    assert.ok(muted >= 4.5, `${surface.id}: muted ink is ${muted.toFixed(2)}:1, below AA`);
    const accent = contrast(GLASS_THEME.accent, surface.hex);
    assert.ok(accent >= 4.5, `${surface.id}: the accent as text is ${accent.toFixed(2)}:1, below AA`);
  }
  // The filled button's own label.
  assert.ok(contrast(GLASS_THEME.accentInk, GLASS_THEME.accent) >= 4.5, "ink on the accent is readable");
  // On the page itself, before any glass.
  assert.ok(contrast(GLASS_THEME.ink, GLASS_THEME.bg) >= 12, "the page ink is comfortable");
});

test("the thinnest sheet that still works — the tint alpha is not decoration", () => {
  // One step thinner than the shipped value must actually be worse, or the number
  // in the file is arbitrary and the next person can lower it without noticing.
  const thinner = GLASS_THEME.glass - 0.08;
  const worstAt = (alpha) => {
    const tint = tintHex8(alpha);
    return Math.min(
      ...GLASS_THEME.aurora.map((field) => {
        const backdrop = composite(auroraHex8(field), GLASS_THEME.bg);
        return contrast(GLASS_THEME.ink, composite(tint, backdrop));
      }),
    );
  };
  assert.ok(worstAt(thinner) < worstAt(GLASS_THEME.glass), "a thinner sheet reads worse");
  assert.ok(worstAt(GLASS_THEME.glass) >= 7, "and the shipped one still clears the floor");
});

test("the stylesheet uses the numbers the module exports", () => {
  const block = css.slice(css.indexOf('html[data-style="glass"] body.premium-ui {'));
  const tokens = block.slice(0, block.indexOf("}"));
  for (const token of ["--p-bg", "--p-surface", "--p-ink", "--p-muted"]) {
    assert.ok(tokens.includes(token), `${token} is defined`);
  }
  assert.match(tokens, new RegExp(`--p-bg: ${GLASS_THEME.bg};`));
  assert.match(tokens, new RegExp(`--p-surface: ${GLASS_THEME.surface};`));
  assert.match(tokens, new RegExp(`--p-ink: ${GLASS_THEME.ink};`));
  assert.match(tokens, new RegExp(`--brand: ${GLASS_THEME.accent};`));
  // The four fields, as the gradient the browser paints. A light theme's fields
  // are painted at full colour and dimmed by the layer's opacity, so the hex is
  // what has to appear; the alphas live in the module and are measured there.
  for (const field of GLASS_THEME.aurora) {
    assert.ok(css.includes(field.hex), `${field.id} ${field.hex} appears in the aurora`);
  }
  const tintAlpha = `0?\\.${String(Math.round(GLASS_THEME.glass * 100)).padStart(2, "0")}`;
  assert.match(css, new RegExp(`rgba\\(255, 250, 246, ${tintAlpha}\\)`), "the tint is the exported alpha");
  assert.ok(css.includes(`--tg-blur: ${GLASS_THEME.blur}px`), "the blur is the exported radius");
  assert.ok(css.includes(`--tg-blur: ${GLASS_THEME.blur}px`), "the blur is the exported radius");
  assert.ok(css.includes(`--tg-saturate: ${GLASS_THEME.saturate}%`), "the saturation is exported too");
});

test("the wall is one painted, encoded, measured picture — edge to edge", () => {
  // The theme used to stand in front of a set of 1280x714 *plates*: pictures made
  // to sit behind a panel, with a cream paper margin. Stretched full-screen they
  // read as a blank wall, which is what the theme then looked like. The wall is
  // now its own asset with its own rules, and this test is those rules.
  const manifest = JSON.parse(read("assets/walls/walls.json"));
  assert.ok(manifest.rooms.length >= 1, "there is a wall");
  const room = manifest.rooms.find((entry) => entry.room === GLASS_THEME.wall.room);
  assert.ok(room, `${GLASS_THEME.wall.room} is the wall the theme names`);

  // 1. Two framings, both real files, both inside the measured budget. A phone
  //    gets the portrait one: `cover` on a 16:9 painting crops a tall screen to
  //    its middle third and throws the composition away.
  assert.deepEqual(Object.keys(room.frames).sort(), ["tall", "wide"], "a landscape and a portrait framing");
  for (const [frame, data] of Object.entries(room.frames)) {
    const portrait = frame === "tall";
    assert.equal(data.width > data.height, !portrait, `${frame} is framed ${portrait ? "portrait" : "landscape"}`);
    for (const format of ["avif", "webp"]) {
      const file = `assets/walls/${room.room}-${frame}.${format}`;
      assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `${file} exists`);
      const bytes = statSync(new URL(`../${file}`, import.meta.url)).size;
      assert.equal(bytes, data[format], `${file} is the size the manifest records`);
      assert.ok(bytes <= manifest.budget.each, `${file} is ${Math.round(bytes / 1024)} KB, inside the ${Math.round(manifest.budget.each / 1024)} KB wall budget`);
    }
  }

  // 2. The page carries it as a <picture>, so art direction is real: a phone's
  //    source comes first, and the fallback <img> is the landscape file.
  const html = read("index.html");
  const picture = /<picture class="wall-art"[\s\S]*?<\/picture>/.exec(html)?.[0];
  assert.ok(picture, "the wall is a picture element");
  assert.match(picture, /<source media="\(max-width: 720px\)" type="image\/avif" srcset="\.\/assets\/walls\/study-afternoon-tall\.avif/, "a phone gets the portrait AVIF");
  assert.match(picture, /<source type="image\/avif" srcset="\.\/assets\/walls\/study-afternoon-wide\.avif/, "everyone else gets the landscape AVIF");
  assert.match(picture, /<source media="\(max-width: 720px\)" type="image\/webp"/, "with a WebP portrait fallback");
  assert.match(picture, /<img src="\.\/assets\/walls\/study-afternoon-wide\.webp[^"]*" alt="" width="1920" height="1080"/, "and an honest, silent fallback image");
  assert.match(picture, /aria-hidden="true"/, "the room is decoration, not content");
  assert.match(picture, /fetchpriority="high"/, "it is the first paint on the app screen");

  // 3. Only one is fetched: a preload per viewport, with media queries.
  assert.match(html, /<link rel="preload" href="\.\/assets\/walls\/study-afternoon-wide\.avif" as="image" type="image\/avif" media="\(min-width: 721px\)">/);
  assert.match(html, /<link rel="preload" href="\.\/assets\/walls\/study-afternoon-tall\.avif" as="image" type="image\/avif" media="\(max-width: 720px\)">/);

  // 4. It fills the screen. `inset: -7%; width: 100%; height: 100%` was the bug:
  //    with width and height set, right/bottom are ignored, so the layer covered
  //    only the top-left 93% and left a cream band down the right and the bottom.
  const layer = /html\[data-style="glass"\] body\.premium-ui \.wall-art \{([\s\S]*?)\n\}/.exec(css)?.[1];
  assert.ok(layer, "the wall is a layer of its own");
  assert.match(layer, /position: fixed;/);
  assert.match(layer, /inset: 0;/, "no bleed that leaves a band");
  assert.doesNotMatch(layer, /inset: -/, "and no negative inset, which loses the right and bottom edges");
  assert.match(layer, /min-height: 100dvh;/, "a full dynamic viewport, so a phone's address bar cannot clip it");
  const image = /html\[data-style="glass"\] body\.premium-ui \.wall-art img \{([\s\S]*?)\n\}/.exec(css)?.[1];
  assert.match(image, /object-fit: cover;/, "the browser crops, not the layout");
  // ...and the phone framing keeps the composition.
  assert.match(css, /@media \(max-width: 720px\) \{\s*html\[data-style="glass"\] body\.premium-ui \.wall-art img \{\s*object-position: center 38%;/);

  // 5. The measured promise. `tools/backdrop-report.mjs` composites the real
  //    stack over the wall's darkest pixel and writes the numbers this reads.
  const report = JSON.parse(read(`assets/walls/${room.room}.backdrop.json`));
  assert.equal(report.measured, true, "the wall has been measured");
  assert.equal(report.stack.veil, "#fdf7f2" + Math.round(GLASS_THEME.wall.veil * 255).toString(16).padStart(2, "0"), "the veil is the exported alpha");
  assert.ok(report.sheet.ink >= 7, `ink through the sheet is ${report.sheet.ink}:1`);
  assert.ok(report.sheet.muted >= 4.5, `muted ink is ${report.sheet.muted}:1`);
  assert.ok(report.sheet.accent >= 4.5, `the accent is ${report.sheet.accent}:1`);
  // Text straight on a painting this detailed would be unreadable: 1.1:1.
  assert.ok(report.raw.ink < 2, `the raw ink on the wall is ${report.raw.ink}:1, so nothing but glass sits on it`);
  assert.match(css, /html\[data-style="glass"\] body\.premium-ui \.premium-hero \{[^}]*background-color: var\(--tg-tint\)/, "the hero is a sheet");
  assert.match(css, /html\[data-style="glass"\] body\.premium-ui \.page-head \{[^}]*background-color: var\(--tg-tint\)/, "so is the page head");

  // 6. The veil is thin on purpose: a thick one is what made the old picture
  //    disappear. If someone raises it, the painting stops being visible.
  assert.ok(GLASS_THEME.wall.veil <= 0.3, `the veil is ${GLASS_THEME.wall.veil}, thin enough to see the painting through`);

  // 6b. The other half of the same promise: the *sheet* that carries the text is
  //     thin enough to see the painting through too. 58% white over a light
  //     painting rendered a panel about 85% white — opaque paper with the room
  //     visible only in the margins, which is what the theme looked like before.
  assert.ok(GLASS_THEME.glass <= 0.38, `the sheet is ${GLASS_THEME.glass} white, thin enough to read the room through`);
  const tokens = /html\[data-style="glass"\] body\.premium-ui \{([\s\S]*?)\n\}/.exec(css)?.[1];
  const alpha = String(Math.round(GLASS_THEME.glass * 100)).padStart(2, "0");
  assert.match(tokens, new RegExp(`--tg-tint: rgba\\(255, 250, 246, \\.${alpha}\\);`), "the CSS tint is the exported alpha");
  // The gradient over the tint is a highlight, not a second coat of paint: if its
  // top stop is opaque the sheet is opaque again whatever the tint says.
  const sheet = /--tg-sheet: linear-gradient\(150deg, rgba\(255, 255, 255, \.(\d+)\)/.exec(css)?.[1];
  assert.ok(Number(`0.${sheet}`) <= 0.35, `the sheet's brightest stop is ${sheet}, not another layer of white`);

  // 7. There is no picker any more: one wall, not a choice of four pastels.
  assert.doesNotMatch(read("index.html"), /gg-room|data-room=|vignan\.room/, "the room picker is gone");
  assert.doesNotMatch(read("js/app.js"), /setRoom|vignan\.room/, "and so is its handler");
  assert.doesNotMatch(css, /data-room=/, "and its styles");

  // 8. The stylesheet is loaded before the sheet that would paint over it.
  assert.ok(html.indexOf("styles-glass.css") < html.indexOf("styles-next.css"), "glass is read before the sheet that sets an opaque canvas");
});

test("the glass kit is a control, not a picture of one", () => {
  // Two components, and both have to be real. The segmented rail is navigation:
  // every item carries a view the app already has, and the handler goes through
  // `setView`, so there is one definition of the open screen. The rail of tiles
  // carries numbers a reader can check — they are computed here, not typed into
  // the page and left to drift.
  const html = read("index.html");
  const app = read("js/app.js");
  const kit = html.slice(html.indexOf('class="gg-kit"'));
  assert.ok(kit, "the kit is in the page");
  const items = [...kit.matchAll(/class="gg-seg-item[^"]*" data-view="([a-z]+)"/g)].map((match) => match[1]);
  assert.deepEqual(items, ["ask", "quiz", "exam", "progress"], "the rail names four screens, in nav order");
  for (const view of items) assert.match(read("index.html"), new RegExp(`data-panel="${view}"`), `${view} is a screen the app has`);
  assert.match(app, /\$\$\("\.gg-seg-item"\)\.forEach/, "the kit is bound once, beside the sidebar");
  assert.match(app, /addEventListener\("click", \(\) => setView\(button\.dataset\.view\)\)/, "and it navigates");
  assert.match(app, /\$\$\("\.nav-item, \.mobile-nav-item, \.gg-seg-item"\)/, "the open screen is named in the kit too");

  // The three tiles: paintings, languages, trackers — each from its own source.
  const plates = JSON.parse(read("assets/paint/manifest.json")).plates.length;
  const tiles = [...kit.matchAll(/<li class="gg-stat"><strong>(\d+)<\/strong><span>([a-z]+)<\/span>/g)]
    .map((match) => [Number(match[1]), match[2]]);
  assert.deepEqual(tiles, [[plates, "paintings"], [SUPPORTED_LANGUAGES.length, "languages"], [0, "trackers"]]);

  // Hidden unless the glass theme is on, and the sheet that shows it is the glass
  // one — Minimal and Legacy keep their own screens.
  assert.match(css, /\.gg-kit \{ display: none; \}/, "the kit is off by default");
  assert.match(css, /html\[data-style="glass"\] body\.premium-ui \.gg-kit \{[\s\S]{0,200}display: grid/, "glass turns it on");
  assert.match(css, /\.gg-seg \{[\s\S]{0,600}backdrop-filter: var\(--tg-filter\) var\(--glass-lens,\)/, "the rail is a lensed surface");
  assert.match(css, /\.gg-seg-item\.active \{[\s\S]{0,400}box-shadow:/, "the selection is lifted, not just tinted");
  assert.match(css, /@media \(max-width: 720px\)[\s\S]{0,200}\.gg-seg \{ width: 100%/, "a phone gets the full-width row");
  assert.match(css, /\[data-lite="1"\][\s\S]{0,200}\.gg-seg[\s\S]{0,400}backdrop-filter: none/, "a slow device paints it flat");
  for (const item of kit.matchAll(/<button type="button" class="gg-seg-item"[^>]*>/g)) {
    assert.doesNotMatch(item[0], /tabindex="-1"/, "every item is reachable by keyboard");
  }
});

test("the refraction lens runs on glass only, and the credit travels with it", () => {
  // A displacement filter per panel is expensive, and on another theme it is
  // pointless — the sheet it refracts is gone. So it is built when glass is
  // chosen and torn down when anything else is, in the one function that decides
  // the style.
  const app = read("js/app.js");
  const applyStyle = app.slice(app.indexOf("function applyStyle("));
  const body = applyStyle.slice(0, applyStyle.indexOf("\n}\n") + 3);
  assert.match(body, /if \(style === "glass"\) void fitGlass\(/, "the lens is built for glass");
  assert.match(body, /else stopGlass\(\);/, "and every other style tears it down");
  assert.match(app, /import \{ fitGlass, stopGlass \} from "\.\/glass-lens\.js\?v=\d+"/, "the lens is a versioned module like every other");

  // It is a lens, not a lookalike: one filter, capped, torn down when it leaves.
  const lens = read("js/glass-lens.js");
  assert.match(lens, /isLensSupported\(\)/, "the browser is asked, not assumed");
  assert.match(lens, /MAX_LENSES/, "the count is capped");
  assert.match(lens, /prefers-reduced-transparency/, "and a reader can ask for solid glass");
  assert.match(lens, /IntersectionObserver/, "a surface out of view holds no filter");

  // The MIT notice is where a reader looks for it, and it names what was *not*
  // taken: the upstream WebGL renderer and its Safari/Firefox fallback.
  const credits = read("docs/OPEN_SOURCE_CREDITS.md");
  assert.match(credits, /glasswork/, "the upstream project is named");
  assert.match(credits, /MIT/, "and its licence");
  assert.match(credits, /WebGL/, "and the part deliberately left out");
  assert.ok(existsSync(new URL("../LICENSES/glasswork.txt", import.meta.url)), "the licence text ships with the code");
  assert.match(lens, /MIT/, "and the file says so at the top");
});


test("the wall is encoded, not committed as a master, and the check proves it", () => {
  // The PNG masters are the pipeline's input and stay out of the repository: the
  // encoded pair is what ships. So there is no `--check` that quietly passes
  // because nothing was measured — it reads what is on disk and compares it with
  // the manifest, and it fails if a file is missing, resized or over budget.
  const encoded = readdirSync(new URL("../assets/walls/", import.meta.url));
  assert.ok(!encoded.some((name) => /\.(png|jpe?g)$/i.test(name)), "no masters are committed");
  const manifest = JSON.parse(read("assets/walls/walls.json"));
  for (const room of manifest.rooms) {
    for (const [frame, data] of Object.entries(room.frames)) {
      const avif = statSync(new URL(`../assets/walls/${room.room}-${frame}.avif`, import.meta.url)).size;
      const webp = statSync(new URL(`../assets/walls/${room.room}-${frame}.webp`, import.meta.url)).size;
      assert.equal(avif, data.avif, `${room.room}-${frame}.avif matches the manifest`);
      assert.equal(webp, data.webp, `${room.room}-${frame}.webp matches the manifest`);
      assert.ok(avif < webp, "AVIF is the smaller of the two, which is why it is preferred");
    }
  }
  // And the app is told about the budget it must stay inside.
  assert.equal(manifest.budget.each, 220_000);
});

test("the app has the login screen's corner: none, anywhere", () => {
  // Round four's complaint was precise: the login screen looked right and the
  // workspace behind it did not, and the reason was geometric. The gate's panel is
  // squared by `styles-identity.css`, but the drawer, the sidebar, the top bar and
  // the composer were still 12–26px round, so the first screen and the app were two
  // products. This test is the rule that keeps them one.
  assert.match(css, /--tg-r-sheet: 0;/);
  assert.match(css, /--tg-r-slab: 0;/);
  assert.match(css, /--tg-r-control: 0;/);
  assert.doesNotMatch(css, /corner-shape:/, "a superellipse on a square is the same square");
  assert.doesNotMatch(css, /--tg-corner/, "the corner token went with the radius");

  // Every radius left in the sheet is either zero, inherited, or a circle: a dot, an
  // avatar, a scrollbar thumb. A stray 12px is the drift this catches.
  const radii = [...css.matchAll(/border-radius:\s*([^;]+);/g)].map((match) => match[1].trim());
  assert.ok(radii.length > 10);
  for (const value of radii) {
    assert.match(
      value,
      /^(?:0|inherit|50%|99px|var\(--(?:tg-r-sheet|tg-r-slab|tg-r-control|tg-r-pill)\))$/,
      `a radius is a token or a circle, found "${value}"`,
    );
  }
  // The pill token survives only for genuinely round things.
  const pillUses = radii.filter((value) => value.includes("tg-r-pill"));
  assert.ok(pillUses.length <= 2, `the pill is for dots now, found ${pillUses.length} uses`);

  // The shell is ruled rather than floated: no frame around the app, and a rule down
  // the sidebar and under the top bar instead of a shadow.
  const desktop = css.slice(css.indexOf("@media (min-width: 861px) {"), css.indexOf("/* THE PAGE ITSELF IS THE ROOM."));
  assert.ok(desktop.includes("min-width: 861px"), "the desktop shell is where these rules live");
  assert.doesNotMatch(desktop, /margin: 6px 6px 0/, "the top bar is not a floating pill in a frame");
  const desktopRule = (selector) => {
    const blocks = [...desktop.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
    return blocks.filter((match) => match[1].split(",").some((part) => part.trim().endsWith(selector))).map((match) => match[2]).join("\n");
  };
  const side = desktopRule(".sidebar");
  assert.match(side, /border-right: 1px solid var\(--tg-edge-dark\)/, "the sidebar is a ruled column");
  assert.match(side, /border-radius: 0/, "and it is square");
  const bar = desktopRule(".topbar");
  assert.match(bar, /border-bottom: 1px solid var\(--tg-edge-dark\)/, "the top bar is a strip, not a pill");
  assert.match(bar, /border-radius: 0/);
  const composer = desktopRule(".composer");
  assert.match(composer, /border-top: 1px solid var\(--tg-edge-dark\)/, "the composer ends the page instead of hovering");

  // The drawer, which is the one the reader called out.
  const drawer = /\.app-menu-panel \{([\s\S]*?)\n\}/.exec(css)?.[1] || "";
  assert.match(drawer, /border-radius: 0/, "the menu has corners, not curves");
  assert.match(drawer, /border-right: 1px solid/, "and a rule on the edge it opens on");

  // The two ornaments that had nothing to do with the gate are gone.
  assert.doesNotMatch(css, /tg-sheen|tg-flare/, "no looping sheen, no rotating flare");

  // The filled action is ink, as it is on the gate, not a second colour system.
  const primary = /\.premium-button\.primary,[\s\S]*?\{([\s\S]*?)\n\}/.exec(css)?.[1] || "";
  assert.match(primary, /background: var\(--tg-ink\)/, "the primary button is ink on porcelain");
});

test("small print sits on a sheet, never straight on the painting", () => {
  // The complaint on the login screen was legibility, and it was measurable: muted
  // 12.5px text on the wall is 3.3:1 (tools/backdrop-report.mjs, worst pixel), which
  // is why "Guest progress stays in this browser" was hard to read. The fix was to
  // stop putting small labels on the painting at all.
  const html = read("index.html");
  const report = JSON.parse(read("assets/walls/study-afternoon.backdrop.json"));
  assert.ok(report.raw.muted < 4.5, `muted on the painting is ${report.raw.muted}:1 — so it may not sit there`);

  // 1. The guest path moved inside the panel, so it is read through the sheet.
  const panel = html.indexOf('class="auth-gate-panel"');
  const guest = html.indexOf('class="auth-gate-guest"');
  assert.ok(panel > 0 && guest > panel, "the guest block lives inside the panel");
  assert.match(
    html.slice(panel, guest),
    /<form class="auth-card" id="gate-login-form"/,
    "after the forms, not before them",
  );

  // 2. The footer, which cannot live in the panel, gets its own strip.
  const foot = /\.auth-gate-foot \{([\s\S]*?)\n\}/.exec(css)?.[1] || "";
  assert.match(foot, /background-color: var\(--tg-tint-strong\)/, "the footer is a tinted strip");
  assert.match(foot, /box-shadow: none/, "a rule does the job a shadow was doing");

  // 3. Small print inside a sheet is ink-2, not muted: at 12px a colour that only
  //    just passes reads as grey.
  const ruleFor = (selector) => {
    const blocks = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
    const found = blocks.filter((match) => match[1].split(",").some((part) => part.trim().endsWith(selector)));
    return found.map((match) => match[2]).join("\n");
  };
  for (const selector of [".gate-form-note", ".gate-strength-label", ".auth-gate-guest p"]) {
    const block = ruleFor(selector);
    assert.ok(block, `${selector} has a rule in the glass layer`);
    assert.match(block, /color: var\(--p-ink-2\)/, `${selector} is ink-2, not muted`);
  }

  // 4. And what is left on the painting — the headline, its paragraph, the feature
  //    line — is ink, never the quiet grey.
  const preview = /\.auth-gate-intro > p \{([\s\S]*?)\n\}/.exec(css)?.[1] || "";
  assert.match(preview, /color: var\(--p-ink\)/, "the gate's own paragraph is ink");
});

test("the content that was still on the painting now sits on a tile", () => {
  // Field report: "just add a translucent tile and put the remaining contents on
  // them." The remaining contents were the ten screens that opened with a
  // `.section-toolbar` — eyebrow, screen name, one line — straight on the
  // painting, plus the library's rights note, the code screen's footer, the
  // settings rail and the assistant's answers.
  const html = read("index.html");
  const views = [...html.matchAll(/<section class="view[^"]*" id="(view-[a-z]+)"/g)].map((match) => match[1]);
  assert.ok(views.length >= 10, `the app has ${views.length} screens`);
  const untitled = views.filter((view) => !new RegExp(`id="${view}"[\\s\\S]*?class="section-toolbar`).test(html.slice(0, html.indexOf(`id="${view}"`) + 4000)));
  // Ask is the exception: its greeting is a `.premium-hero`, which is a tile too.
  assert.deepEqual(untitled.filter((view) => view !== "view-ask"), [], "every screen names itself inside a toolbar");

  const tile = (selector) => {
    const blocks = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
    return blocks
      .filter((match) => match[1].split(",").some((part) => part.trim().endsWith(selector)))
      .map((match) => match[2])
      .join("\n");
  };
  const toolbar = tile(".section-toolbar");
  assert.match(toolbar, /background-color: var\(--tg-tint\)/, "the toolbar is a tinted tile");
  assert.match(toolbar, /box-shadow: var\(--tg-rim\)/, "with the same rim as a card");
  assert.match(toolbar, /var\(--glass-lens,\)/, "and it can refract, where the browser can");
  assert.match(toolbar, /padding: 18px 22px 16px/, "with room inside it");

  assert.match(tile(".view > p"), /background-color: var\(--tg-tint\)/, "a loose paragraph is a tile");
  assert.match(tile(".settings-tabs"), /background-color: var\(--tg-tint\)/, "the settings rail is a bar, like the Ask rail");
  const answer = /\.message\.assistant \.message-body \{([\s\S]*?)\n\}/.exec(css)?.[1] || "";
  assert.match(answer, /background-color: var\(--tg-tint\)/, "an answer is glass, not an opaque block");
  assert.match(tile(".message.user .message-body"), /background: var\(--tg-ink\)/, "the student's own words are ink");

  // The tile material itself: a static reflection, a cut edge and a thickness, so
  // the pane reads as glass whether or not the browser draws the lens.
  const reflection = /\.composer::after \{([\s\S]*?)\n\}/.exec(css.slice(css.indexOf("§13")))?.[1] || "";
  assert.match(reflection, /linear-gradient\(122deg/, "the pane catches a reflection at rest");
  assert.match(css, /inset 0 0 0 1px rgba\(255, 255, 255, \.44\)/, "the edge is a cut, not a fade");
  assert.match(css, /inset 0 -2px 0 rgba\(120, 90, 96, \.05\)/, "and the tile has a thickness");
});

test("the lens is stronger, and the Ask screen fills the window", () => {
  // Two field reports in one: the panes did not visibly bend light, and the Ask
  // screen sat in an 820px column with the painting down both sides.
  const lens = read("js/glass-lens.js");
  assert.match(lens, /rim: 38, edge: 1\.3, power: 2\.2, dispersion: 0\.26/, "the rim is wide enough to see");
  for (const surface of [".section-toolbar", ".premium-hero", ".page-head", ".exam-panel"]) {
    assert.ok(lens.includes(`"${surface}"`), `${surface} can carry a lens`);
  }
  assert.match(lens, /MAX_LENSES/, "and the count is still capped");

  const hero = /#view-ask \.premium-hero \{([\s\S]*?)\n\}/.exec(css.slice(css.indexOf("§14")))?.[1] || "";
  assert.match(hero, /max-width: none/, "the greeting spans the window");
  const column = /#view-ask \.chat-column \{([\s\S]*?)\n\}/.exec(css.slice(css.indexOf("§14")))?.[1] || "";
  assert.match(column, /max-width: none/, "so does the conversation");
  assert.match(css, /#view-ask \.chat-column \.message-body,[\s\S]{0,120}max-width: var\(--vn-measure/, "but the reading stays narrow");

  // The cap is still in `styles-next.css` — it is right for Minimal and Legacy,
  // and the glass layer is loaded *before* that sheet. So the rule that removes it
  // has to win on specificity, not on order: an attribute, a class and two elements
  // more than the sheet that sets the cap.
  const next = read("styles-next.css");
  assert.match(next, /body\.premium-ui #view-ask \.premium-hero \{[\s\S]{0,200}max-width: 820px/, "the simple shell still caps its own greeting");
  const glassHero = /html\[data-style="glass"\] body\.premium-ui #view-ask \.premium-hero \{([\s\S]*?)\n\}/.exec(css);
  assert.ok(glassHero, "the glass layer names the same element with more weight");
  assert.match(glassHero[0], /html\[data-style="glass"\] body\.premium-ui #view-ask/, "with the attribute that out-specifies it");
});

test("the intro screen is the gate, not a black page from another product", () => {
  // "The Enter Study Space is still the normal one." It was an opaque #080808
  // page with a white button — the last screen of the old design, one second
  // before the gate.
  const intro = css.slice(css.indexOf("§15"));
  assert.match(intro, /\.startup-screen \{[\s\S]{0,120}background: transparent/, "the painting runs behind the intro");
  assert.match(intro, /\.startup-frame \{[\s\S]{0,400}background-color: var\(--tg-tint\)/, "the copy sits on one tall pane");
  assert.match(intro, /\.startup-frame \{[\s\S]{0,600}box-shadow: var\(--tg-rim\)/, "with the same rim");
  const button = /\.startup-enter \{([\s\S]*?)\n\}/.exec(intro)?.[1] || "";
  assert.match(button, /background: var\(--tg-ink\)/, "the button is ink on porcelain, like the gate's");
  assert.match(button, /color: var\(--p-bg\)/);
  assert.match(intro, /filter: none/, "the logo is no longer inverted for a black page");
  // And the behaviour is untouched: boot still shows, skips and remembers it.
  assert.match(read("js/boot.js"), /startup-enter|startup-skip/, "the intro still has its two controls");
});

test("every token this sheet reads is a token this sheet defines", () => {
  // The wash that makes the room (`body.premium-ui::after`: four pastel fields,
  // the warm veil, the light from above, the paper grain) mixed four
  // `--tg-wash-*` values that were never defined anywhere in the project. A
  // custom property with no fallback does not degrade to "no colour" — it makes
  // the *whole* `background` declaration invalid at computed-value time, so the
  // browser dropped the entire layer. No fields, no veil, no grain: the room was
  // the raw painting, and every pane on it was glass in front of nothing.
  //
  // Reading a token that is not written here is the bug; this catches the next one.
  // Comments talk about tokens that belong to other sheets; only declarations
  // count, and a token may legitimately be declared by another sheet the page
  // loads (`--display` comes from the identity layer). What is *not* allowed is a
  // token no sheet and no inline style ever defines — that is the wash bug.
  const code = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const defined = new Set([...code.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)].map((m) => m[1]));
  for (const sheet of readdirSync(new URL("..", import.meta.url)).filter((name) => name.endsWith(".css"))) {
    for (const match of read(sheet).matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)) defined.add(match[1]);
  }
  for (const match of read("index.html").matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)) defined.add(match[1]);
  const bare = [...code.matchAll(/var\((--[a-zA-Z0-9-]+)\)/g)].map((m) => m[1]);
  const missing = [...new Set(bare)].filter((name) => !defined.has(name));
  assert.deepEqual(missing, [], `undefined with no fallback: ${missing.join(", ")}`);
  // And the four fields are the theme module's own colours, not new ones.
  for (const [index, field] of GLASS_THEME.aurora.entries()) {
    const alpha = Math.round(GLASS_THEME.wall.fieldAlpha * 100);
    const line = new RegExp(`--tg-wash-${index + 1}: rgba\\(${field.hex.match(/\w\w/g).map((pair) => parseInt(pair, 16)).join(", ")}, \\.${alpha}\\)`);
    assert.match(css, line, `--tg-wash-${index + 1} is ${field.id} at ${alpha}%`);
  }
});

test("the Ask screen has the room behind it, not a cream sheet", () => {
  // The view is pinned with `position: fixed` and given `background:
  // var(--vn-canvas)` in `styles-next.css`. In this theme that resolves to the
  // opaque `--p-bg`, and it carries an id — so the `.view { background:
  // transparent }` rule here could never win, and the app's home screen was a
  // solid slab over the painting. This is the assertion that would have caught
  // "the transparent things aren't refracting light" the first time.
  const next = read("styles-next.css");
  assert.match(next, /#view-ask\.active \{[\s\S]{0,900}background: var\(--vn-canvas\)/, "the shell still paints the view opaque");
  assert.match(css, /#view-ask\.active \{[\s\S]{0,160}background: transparent/, "and glass takes it back at the same weight");
  // The question box had the same problem: a gradient to `--vn-canvas` behind it.
  assert.match(next, /\.composer \{[\s\S]{0,260}linear-gradient\(to bottom, transparent, var\(--vn-canvas\)/, "the shell fades the composer into the page");
  const composer = /html\[data-style="glass"\] body\.premium-ui #view-ask \.composer \{([\s\S]*?)\n\}/.exec(css)?.[1] || "";
  assert.match(composer, /background-color: var\(--tg-tint\)/, "so the bar is a tile of its own");
  assert.match(composer, /backdrop-filter: var\(--tg-filter\)/, "with the lens in it");
});
