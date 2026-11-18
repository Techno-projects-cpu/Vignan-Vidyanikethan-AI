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
import { readFileSync, existsSync, statSync } from "node:fs";
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

test("the room behind the glass is one measured painting, not a mystery", () => {
  // This theme used to promise "no image request". It no longer can: the whole
  // point of the redesign is that there is something *behind* the glass to bend,
  // so the page loads one painting and hangs it on the wall. What replaces the
  // old promise is a stricter one — exactly one plate, from this repository, in
  // the offline cache, small enough for a phone, and measured against the ink
  // that sits on top of it.
  const urls = [...css.matchAll(/url\(([\"']?)([^)\"']+)\1\)/g)].map((match) => match[2]);
  assert.ok(urls.length > 0, "the grain and the rooms are there");
  for (const url of urls) {
    const inline = /^(data:image\/svg\+xml|%23)/.test(url);
    const plate = /^\.\/assets\/paint\/[a-z-]+(?:-640)?\.webp$/.test(url);
    assert.ok(inline || plate, `${url} is inline or a plate from this repository, nothing else`);
  }
  // The swatches in the room control use the 640 tiles, the rooms use the
  // canonical plate; both are covered below.
  const plates = [...new Set(urls.filter((url) => /assets\/paint\/[a-z-]+\.webp$/.test(url)))];
  assert.deepEqual(plates.sort(), [
    "./assets/paint/blush-hall.webp",
    "./assets/paint/mint-class.webp",
    "./assets/paint/sand-desk.webp",
  ], "three rooms, all paintings this repository already ships");

  // Each one is on disk, inside the tile budget, and in the offline cache: a room
  // that is not cached is a hole in the wall when the Wi-Fi is off.
  const precache = JSON.parse(read("precache.json"));
  const list = Array.isArray(precache) ? precache : precache.urls;
  for (const plate of plates) {
    const path = plate.replace("./", "");
    assert.ok(existsSync(new URL(`../${path}`, import.meta.url)), `${path} exists`);
    const bytes = statSync(new URL(`../${path}`, import.meta.url)).size;
    assert.ok(bytes <= 46 * 1024, `${path} is ${Math.round(bytes / 1024)} KB, inside the 46 KB tile budget`);
    assert.ok(list.includes(plate) || list.some((entry) => String(entry).includes(path)), `${path} is precached`);
  }

  // The measured promise: `tools/backdrop-report.mjs` composites painting →
  // fields → veil → sheet for every pixel and keeps the worst. The numbers it
  // wrote are what the test reads, so the claim cannot drift from the paint.
  for (const name of ["blush-hall", "mint-class", "sand-desk"]) {
    const report = JSON.parse(read(`assets/paint/${name}.backdrop.json`));
    assert.equal(report.measured, true, `${name} has been measured`);
    assert.ok(report.sheet.ink >= 7, `${name}: ink through the sheet is ${report.sheet.ink}:1`);
    assert.ok(report.sheet.muted >= 4.5, `${name}: muted ink is ${report.sheet.muted}:1`);
    assert.ok(report.sheet.accent >= 4.5, `${name}: the accent is ${report.sheet.accent}:1`);
    // ...and the reason the hero is a sheet rather than text on the page: on the
    // raw painting even the dark ink drops to 1.9:1 on the mint wall.
    assert.ok(report.raw.ink < 7, `${name}: text straight on the painting would not clear 7:1`);
  }
  assert.match(css, /html\[data-style="glass"\] body\.premium-ui \.premium-hero \{[^}]*background-color: var\(--tg-tint\)/, "the hero is a sheet");
  assert.match(css, /html\[data-style="glass"\] body\.premium-ui \.page-head \{[^}]*background-color: var\(--tg-tint\)/, "so is the page head");
  assert.match(css, /html\[data-style="glass"\] body\.premium-ui \.workspace,[\s\S]{0,200}background: transparent/, "the page is the room");

  // Also: the app links this sheet before the app bundle, so the first frame has it.
  const html = read("index.html");
  assert.match(html, /<link rel="stylesheet" href="\.\/styles-glass\.css\?v=\d+">/);
  assert.ok(html.indexOf("styles-glass.css") < html.indexOf("js/boot.js"), "painted before boot");
  // And the first frame already knows which room, before any module loads.
  assert.match(html, /localStorage\.getItem\("vignan\.room"\)/, "the room is read before the first paint");
});

test("a slow device gets the glass without the blur pass", () => {
  // Lite mode is the performance story of this theme, so it is a test, not a note.
  assert.match(css, /html\[data-style="glass"\]\[data-lite="1"\] body\.premium-ui \{/);
  const lite = css.slice(css.indexOf('html[data-style="glass"][data-lite="1"] body.premium-ui {'));
  assert.match(lite.slice(0, 400), /--tg-blur: 0px/, "the blur pass is dropped entirely, not halved");
  // ...and no other tier may be more expensive than the default, or "lite" lies.
  const phone = Number(/@media \(max-width: 640px\) \{[\s\S]*?--tg-blur: (\d+)px/.exec(css)?.[1]);
  assert.ok(phone > 0 && phone <= GLASS_THEME.blur, `a phone blurs ${phone}px, no more than the default`);
  assert.match(css, /html\[data-lite="1"\] body\.premium-ui::before \{[^}]*animation: none/s, "the aurora stops");
  assert.match(css, /html\[data-lite="1"\] \.card::before[\s\S]{0,120}display: none/, "the specular is removed");

  const app = read("js/app.js");
  assert.match(app, /function preferLiteGlass\(\)/, "the decision is made in one place");
  assert.match(app, /cores <= 4 \|\| memory <= 4/, "few cores or little memory means lite");
  assert.match(app, /saveData === true/, "so does a metered connection");
  assert.match(app, /root\.dataset\.lite = "1"/);
  // The first frame decides too, before any module has loaded.
  assert.match(read("index.html"), /navigator\.hardwareConcurrency \|\| 8/);
});

test("motion is ambient, and it stops when it is asked to", () => {
  const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
  for (const selector of ["body.premium-ui::before", ".app-shell::before", ".sidebar::before"]) {
    assert.ok(reduced.includes(selector), `${selector} loops, so the reduced block must stop it`);
  }
  // Nothing that carries a word is animated: the moving things are the two
  // background layers and a decorative flare.
  const animated = [...css.matchAll(/animation:\s*([a-z-]+)/g)]
    .map((match) => match[1])
    .filter((name) => name !== "none");
  assert.deepEqual([...new Set(animated)].sort(), ["tg-aurora", "tg-flare", "tg-sheen"]);
  for (const name of new Set(animated)) {
    assert.ok(css.includes(`@keyframes ${name}`), `${name} is defined`);
  }
});

test("the theme is documented where a reader will look", () => {
  const design = read("docs/DESIGN.md");
  assert.match(design, /Glass Morphism/);
  assert.match(design, /60-30-10|60 \/ 30 \/ 10/);
  assert.ok(existsSync(new URL("../styles-glass.css", import.meta.url)));
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

test("the room control really changes the room, and remembers it", () => {
  // Four swatches that do something. Each one is a painting, that painting's own
  // measured colours as a wash, and an accent taken from the same pigment — so a
  // tap changes the light, the accent and the picture together. The failure this
  // guards against is the one that prompted the rewrite: four anonymous blocks
  // that changed nothing anyone could see.
  const html = read("index.html");
  const app = read("js/app.js");
  const rooms = [...html.matchAll(/class="gg-room" data-room="([a-z-]+)"/g)].map((match) => match[1]);
  assert.deepEqual(rooms, GLASS_THEME.rooms.map((room) => room.id), "every room in the theme has a swatch");
  assert.deepEqual(rooms, ["blush-hall", "mint-class", "sand-desk", "plain"]);

  // 1. Every room is a plate we ship, at its own plate, wash and accent.
  const accents = new Set();
  for (const room of GLASS_THEME.rooms) {
    const rule = new RegExp(`\\[data-room="${room.id}"\\] body\\.premium-ui \\{([\\s\\S]*?)\\n\\}`).exec(css)?.[1];
    assert.ok(rule, `${room.id} has a rule`);
    assert.ok(rule.includes(`--tg-accent: ${room.accent};`), `${room.id} uses its own accent (${room.accent})`);
    accents.add(room.accent);
    if (room.fields) {
      assert.ok(existsSync(new URL(`../assets/paint/${room.id}.webp`, import.meta.url)), `${room.id} is a plate we ship`);
      assert.ok(rule.includes(`url("./assets/paint/${room.id}.webp")`), `${room.id} sets --tg-plate`);
      // The wash is the plate's own colours, not the theme's four again.
      for (const hex of room.fields) {
        const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
        assert.ok(rule.includes(`rgba(${r}, ${g}, ${b},`), `${room.id} washes with its own ${hex}`);
      }
      assert.ok(room.fields.some((hex) => !GLASS_THEME.aurora.some((field) => field.hex === hex)),
        `${room.id} is not just the theme's four fields under a different photo`);
    } else {
      assert.match(rule, /--tg-plate: none;/, "the painting can be turned off");
    }
  }
  assert.equal(accents.size, GLASS_THEME.rooms.length, "no two rooms share an accent");

  // 2. The control itself: the painting is the swatch, the name is written under
  //    it, and it was bound to something.
  for (const room of GLASS_THEME.rooms.filter((entry) => entry.fields)) {
    assert.match(html, new RegExp(`<button type="button" class="gg-room" data-room="${room.id}"[^>]*>\\s*<img src="\\./assets/paint/${room.id}-640\\.webp"`),
      `${room.id} shows its own painting`);
  }
  for (const label of ["Blush", "Mint", "Sand", "Fields"]) {
    assert.match(html, new RegExp(`<span class="gg-room-label">${label}<\\/span>`), `${label} is named under its swatch`);
  }
  assert.match(app, /const setRoom = \(room\) => \{/, "one function owns the room");
  assert.match(app, /document\.documentElement\.dataset\.room = room/, "the room is an attribute on the document");
  assert.match(app, /localStorage\.setItem\("vignan\.room", room\)/, "and it is remembered");
  assert.match(app, /swatch\.setAttribute\("aria-pressed", String\(active\)\)/, "the pressed state follows");
  assert.match(app, /swatch\.classList\.toggle\("active", active\)/, "and so does the ring");
  assert.match(app, /button\.addEventListener\("click", \(\) => setRoom\(button\.dataset\.room\)\)/, "a tap sets it");
  // A saved room is restored on load, so a reload does not silently revert.
  assert.match(app, /const savedRoom = localStorage\.getItem\("vignan\.room"\);/);
  // Before the first frame too, so the wall never flashes.
  assert.match(html, /document\.documentElement\.dataset\.room = room/);
  assert.match(html, /<link rel="preload" href="\.\/assets\/paint\/blush-hall\.webp" as="image" type="image\/webp">/);
  assert.match(css, /\.gg-room\.active img,[\s\S]{0,120}box-shadow/, "the selected swatch is ringed");

  // 3. Cheap mode keeps the room but stops paying for it.
  assert.match(css, /html\[data-lite="1"\] body\.premium-ui::before \{\s*animation: none;\s*\/\*[\s\S]{0,120}?\*\/\s*filter: none;\s*\}/, "lite drops the filter and the drift");
});

test("the room fills the screen, on a phone as much as on a desktop", () => {
  // The bug this pins: `.app-shell` was only made transparent inside the desktop
  // media query, so on a phone it painted an opaque cream wall over the painting
  // and the room showed as a strip in the margins. The transparency must not be
  // inside a breakpoint, and the plate must be a full-viewport fixed layer.
  const fullBleed = css.slice(css.indexOf("/* THE ROOM IS EDGE TO EDGE"), css.indexOf("@media (min-width: 861px) {"));
  for (const selector of [".app-shell", ".auth-gate"]) {
    assert.ok(fullBleed.includes(selector), `${selector} is transparent outside every breakpoint`);
  }
  assert.ok(!fullBleed.includes("@media"), "none of it is inside a media query");
  assert.match(fullBleed, /html\[data-style="glass"\] body\.premium-ui \.world|html\[data-style="glass"\] body\.premium-ui \.workspace/, "the workspace is in the same list");
  for (const selector of ["workspace", "main", "view"]) {
    assert.match(fullBleed, new RegExp(`body\\.premium-ui \\.${selector}`), `${selector} is transparent`);
  }

  const plate = /html\[data-style="glass"\] body\.premium-ui::before \{([\s\S]*?)\n\}/.exec(css)?.[1];
  assert.ok(plate, "the plate is a layer of its own");
  assert.match(plate, /position: fixed;/);
  assert.match(plate, /background-size: cover;/);
  assert.match(plate, /min-height: 100dvh;/, "a full dynamic viewport, so a phone's address bar cannot clip it");

  // On a phone the framing moves and the drift stops: a moving full-screen image
  // is a battery cost with nothing to show for it.
  const phone = css.slice(css.indexOf('@media (max-width: 720px) {\n  html[data-style="glass"] body.premium-ui::before'));
  const phoneBlock = phone.slice(0, phone.indexOf("}\n}") + 3);
  assert.ok(phoneBlock.length > 40, "there is a phone block for the plate");
  assert.match(phoneBlock, /background-position: center 34%/, "the plate is framed for a tall screen");
  assert.match(phoneBlock, /animation: none;/, "and it stops moving");
  assert.match(phoneBlock, /inset: 0;/, "with no bleed to crop against the viewport edge");

  // The stylesheet is loaded before the sheets that would paint over it.
  const html = read("index.html");
  assert.ok(html.indexOf("styles-glass.css") < html.indexOf("styles-next.css"), "glass is read before the sheet that sets an opaque canvas");
});
