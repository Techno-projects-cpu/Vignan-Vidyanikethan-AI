/**
 * The landing page.
 *
 * A landing page is where a project is most tempted to lie: the biggest number
 * gets typed by hand, "offline" becomes a word rather than a test, and the
 * screenshot of an answer is passed off as a live one. These tests keep this
 * page honest and keep it from quietly breaking:
 *
 * 1. Every number on it is the number on the judge page, which is checked
 *    against a real run of the offline simulator by judge-numbers.test.mjs. So
 *    the chain is: landing → judge page → actual command output.
 * 2. Every claim about a screen names a screen the app really has.
 * 3. Every link goes somewhere that exists, and nothing loads from another host.
 * 4. The page has no JavaScript, so it cannot produce a console error, and its
 *    motion is switchable off by the reader.
 * 5. It stays black, grey and white, and every corner stays square.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (file) => readFileSync(`${root}/${file}`, "utf8");

const page = read("welcome.html");
const css = read("styles-welcome.css");
const judge = read("judge.html");
const index = read("index.html");
const worker = read("sw.js");
const server = read("serve.mjs");
const body = page.slice(page.indexOf("<body"));
const visible = body
  .replace(/<script[\s\S]*?<\/script>/g, " ")
  .replace(/<style[\s\S]*?<\/style>/g, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/\s+/g, " ")
  .trim();

test("the landing page loads nothing from another host", () => {
  // Everything it needs is already in the repository, so it renders on a school
  // Wi-Fi that has just died — the same promise the app makes.
  const withoutCanonical = page.replace(/<link rel="canonical"[^>]*>/, "");
  const remote = [...withoutCanonical.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(
    remote,
    ["https://zero-vast.vercel.app/"],
    "the only outward link is the one the project was asked to credit",
  );
  assert.ok(!/<script\b/i.test(page), "no script tag: nothing here can throw a console error");
  assert.ok(!/\son[a-z]+="/i.test(page), "no inline event handlers either");
});

test("the landing page is served, and cached for offline use", () => {
  assert.ok(existsSync(`${root}/welcome.html`), "the file exists");
  assert.match(server, /welcome: "welcome\.html"/, "serve.mjs maps the clean /welcome address");
  assert.ok(worker.includes("./welcome.html"), "the worker caches the page");
  assert.ok(worker.includes("./styles-welcome.css?v="), "and its stylesheet");
  assert.match(page, /<link rel="stylesheet" href="\.\/styles-welcome\.css\?v=\d+">/);
  // The release in the page's own links must be the release the worker caches
  // under, or a judge with the app installed sees a stale landing page.
  const release = worker.match(/CACHE_NAME = "vignan-vidyanikethan-ai-v(\d+)"/)?.[1];
  const used = [...new Set([...page.matchAll(/\?v=(\d+)/g)].map((match) => match[1]))];
  assert.deepEqual(used, [release], `the page asks for v${release}, not v${used.join("/")}`);
});

test("every number on the landing page is the number on the judge page", () => {
  const numberOn = (source, label) => {
    const found = new RegExp(`<strong>([^<]+)</strong><span>${label}</span>`).exec(source);
    assert.ok(found, `the claim "${label}" is stated`);
    return found[1].replace(/[^\d.]/g, "");
  };
  assert.equal(
    numberOn(page, "automated tests"),
    numberOn(judge, "automated tests"),
    "the test count is copied from the page a judge re-runs, never typed twice",
  );
  assert.equal(
    numberOn(page, "files cached for offline"),
    numberOn(judge, "files precached"),
    "the file count is the simulator's own count",
  );
  assert.equal(numberOn(page, "languages"), numberOn(judge, "languages"));
});

test("the page names only screens the app actually has", () => {
  const views = [...index.matchAll(/<section class="view(?: active)?"[^>]*id="view-([a-z]+)"/g)].map((match) => match[1]);
  // Only the screens band: the writing band below it uses the same stacked card.
  const screensBand = page.slice(page.indexOf('id="wl-screens"'), page.indexOf('id="wl-proof"'));
  const cells = [...screensBand.matchAll(/<span class="wl-cell-title">([^<]+)<\/span>/g)].map((match) => match[1]);
  assert.equal(cells.length, views.length, `one card per screen: ${cells.length} cards, ${views.length} screens`);
  const navLabels = [...index.matchAll(/data-menu-view="([a-z]+)"><svg[^>]*>[\s\S]*?<span>([^<]+)<\/span>/g)].map((match) => match[2]);
  for (const cell of cells) {
    assert.ok(
      navLabels.some((label) => label.toLowerCase().includes(cell.toLowerCase().split(" ")[0])),
      `"${cell}" is a screen the drawer really offers`,
    );
  }
});

test("the language strip shows the thirty-three languages, and says nothing it cannot back", () => {
  const lists = [...page.matchAll(/<ul class="wl-langs"(?: aria-hidden="true")?>([\s\S]*?)<\/ul>/g)].map((match) => match[1]);
  assert.equal(lists.length, 2, "the strip is doubled so the loop has no seam");
  const names = [...lists[0].matchAll(/<li[^>]*>([^<]+)<\/li>/g)].map((match) => match[1]);
  assert.equal(names.length, 33, `thirty-three languages in the strip, got ${names.length}`);
  assert.deepEqual(
    names.slice(0, 4),
    ["English", "हिन्दी", "বাংলা", "मराठी"],
    "the strip is ordered the way the picker is",
  );
  for (const name of ["اردو", "తెలుగు", "日本語", "Kiswahili"]) {
    assert.ok(names.includes(name), `${name} is in the strip`);
  }
  const hidden = [...page.matchAll(/<ul class="wl-langs" aria-hidden="true">/g)];
  assert.equal(hidden.length, 1, "only the copy is hidden; the first list is read aloud");
});

test("an illustration is labelled as an illustration", () => {
  assert.match(page, /class="wl-badge">ILLUSTRATION</);
  assert.match(page, /An illustration of the real screen, not a recorded session/);
  // The correction the user made once, in writing: do not claim a feature works
  // from something that was never actually run.
  assert.doesNotMatch(visible, /recorded from the app|live answer from a model|captured from a real session/i);
});

test("the claims that matter are stated in plain words", () => {
  assert.match(visible, /It will not answer from nothing/);
  assert.match(visible, /declines instead of making something up/);
  assert.match(visible, /No past papers/);
  assert.match(visible, /Not a newly trained model/);
  assert.match(visible, /INSPIRE-MANAK/);
  assert.match(visible, /Vignan Vidyanikethan English Medium High School/);
  assert.match(visible, /Zero Vast/i);
  // No jargon and no code shapes in anything a visitor reads.
  const CODE_SHAPES = /=>|<\/|\bundefined\b|\bNaN\b|\bnull\b|function\s*\(|\{q\}/;
  assert.doesNotMatch(visible, CODE_SHAPES);
  for (const word of ["API", "JSON", "endpoint", "LLM", "embeddings", "RAG"]) {
    assert.ok(!new RegExp(`\\b${word}\\b`).test(visible), `"${word}" is a builder's word, not a visitor's`);
  }
});

test("every link on the page goes somewhere real", () => {
  const links = [...page.matchAll(/href="(\.\/[^"?#]*)(?:\?[^"#]*)?"/g)].map((match) => match[1]);
  const missing = [];
  for (const link of new Set(links)) {
    const file = link === "./" ? "index.html" : link.replace(/^\.\//, "");
    if (!existsSync(`${root}/${file}`)) missing.push(link);
  }
  assert.deepEqual(missing, [], `dead links: ${missing.join(", ")}`);
  // The two calls to action are the app and the judge page, in that order.
  const firstAction = /<a class="wl-button wl-button-solid" href="([^"]+)"/.exec(page)[1];
  assert.equal(firstAction, "./");
});

test("the page is accessible before it is pretty", () => {
  const ids = [...page.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(ids.length, new Set(ids).size, "no duplicate ids");
  assert.match(page, /<a class="wl-skip" href="#wl-main">Skip to the page<\/a>/, "a skip link comes first");
  assert.match(page, /<main id="wl-main">/);
  assert.match(page, /<html lang="en">/);
  assert.match(page, /<img src="\.\/icons\/icon\.svg\?v=\d+" alt="" /, "the logo is decorative and says so");
  for (const section of [...page.matchAll(/<section\b([^>]*)>/g)]) {
    assert.ok(/aria-label(?:ledby)?="/.test(section[1]), `every section is named: ${section[1].trim()}`);
  }
  // Tap targets: the buttons and rows are big enough on a phone.
  assert.match(css, /\.wl-button \{[\s\S]*?min-height: 52px/);
  assert.match(css, /@media \(max-width: 720px\) \{[\s\S]*?min-height: 54px/);
});

test("motion can be switched off, and nothing is stuck invisible when it is", () => {
  const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
  assert.ok(reduced, "there is a reduced-motion block");
  for (const animation of ["wl-rise", "wl-turn-in", "wl-drift", "wl-bob"]) {
    assert.ok(css.includes(`@keyframes ${animation}`), `${animation} is defined`);
  }
  assert.match(reduced, /animation: none !important;/);
  assert.match(reduced, /opacity: 1 !important;/);
  assert.match(reduced, /\.wl-marquee-track \{ animation: none !important; transform: none !important; \}/);
  // Every element that starts hidden through `both` must be listed in the block,
  // or a reader who dislikes motion sees an empty hero.
  for (const selector of [".wl-line-a", ".wl-specimen", ".wl-turn", ".wl-hero .wl-facts"]) {
    assert.ok(reduced.includes(selector), `${selector} is restored`);
  }
});

test("the design stays black, grey and white, with square corners", () => {
  const colours = [...new Set([...css.matchAll(/#([0-9a-f]{6})\b/gi)].map((match) => match[1].toLowerCase()))];
  assert.ok(colours.length > 8, "the palette is real");
  for (const hex of colours) {
    const [r, g, b] = hex.match(/.{2}/g).map((pair) => parseInt(pair, 16));
    assert.ok(r === g && g === b, `#${hex} is a grey, not a colour`);
  }
  const rgba = [...css.matchAll(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)];
  for (const [, r, g, b] of rgba) {
    assert.ok(r === g && g === b, `rgba(${r},${g},${b}) is a grey too`);
  }
  // Square, like the rest of the site. No rounded corners, no soft shadows.
  assert.doesNotMatch(css, /border-radius:\s*(?!0)/, "no rounded corners");
  assert.doesNotMatch(css, /box-shadow:/, "no shadows: the cards share borders instead");
  // And the boxes stick together: the stack is one bordered block with cells
  // divided by a single hairline, the way zero-vast stacks them.
  assert.match(css, /\.wl-stack \{ border: 1px solid var\(--wl-line\); \}/);
  assert.match(css, /\.wl-cell \{[\s\S]*?border-bottom: 1px solid var\(--wl-line\)/);
  assert.match(css, /\.wl-cell:last-child \{ border-bottom: 0; \}/);
});

test("the stylesheet is well formed, and every rule earns its place", () => {
  const open = (css.match(/\{/g) || []).length;
  const close = (css.match(/\}/g) || []).length;
  assert.equal(open, close, "braces balance");
  assert.match(css, /^\/\*/);
  // This page is its own document, so a bare `a` or `img` rule cannot leak into
  // the app. What can go wrong here is quieter: a class renamed in the markup
  // that leaves a dead rule behind, or a card with no styling at all.
  const defined = new Set([...css.matchAll(/\.(wl-[a-z0-9-]+)/g)].map((match) => match[1]));
  const used = new Set(
    [...page.matchAll(/class="([^"]+)"/g)].flatMap((match) => match[1].split(/\s+/)).filter((name) => name.startsWith("wl-")),
  );
  assert.deepEqual([...used].filter((name) => !defined.has(name)), [], "every class in the markup is styled");
  assert.deepEqual([...defined].filter((name) => !used.has(name)), [], "no rule is left over from an older version of the page");
  assert.ok(defined.size > 40, "the page has a real design, not a dozen rules");
  // The page has to survive a browser with no JavaScript and no network.
  assert.ok(!/url\((['"]?)https?:/i.test(css), "no remote font or image");
  assert.match(css, /@font-face[\s\S]*?assets\/fonts\/manrope-latin\.woff2/, "the fonts are the local files");
});

test("the app links to the page, and the page links back", () => {
  assert.match(index, /<a class="app-menu-item" href="\.\/welcome\.html">/, "the drawer has a way in");
  assert.match(index, /<a href="\.\/welcome\.html">About the project<\/a>/, "and the first screen's fine print does too");
  const judgeLink = /<a href="\.\/judge\.html">Judge mode ↗<\/a>/.test(page);
  assert.ok(judgeLink, "the page can be checked, not just admired");
  assert.match(judge, /welcome\.html/, "and the judge page can reach the landing page");
});
