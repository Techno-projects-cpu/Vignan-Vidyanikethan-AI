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

test("the language board lists the thirty-three languages, all of them visible at once", () => {
  // This used to be a marquee: the list was duplicated and slid sideways forever,
  // so half the languages were off-screen and moving when nobody asked. It is a
  // static board now — one list, complete, readable without waiting.
  const lists = [...page.matchAll(/<ul class="wl-langs"(?: aria-hidden="true")?>([\s\S]*?)<\/ul>/g)].map((match) => match[1]);
  assert.equal(lists.length, 1, "one list, shown once — nothing is duplicated to fake a loop");
  const names = [...lists[0].matchAll(/<li[^>]*>([^<]+)<\/li>/g)].map((match) => match[1]);
  assert.equal(names.length, 33, `thirty-three languages on the board, got ${names.length}`);
  assert.deepEqual(
    names.slice(0, 4),
    ["English", "हिन्दी", "বাংলা", "मराठी"],
    "the board is ordered the way the picker is",
  );
  for (const name of ["اردو", "తెలుగు", "日本語", "Kiswahili"]) {
    assert.ok(names.includes(name), `${name} is in the board`);
  }
  assert.doesNotMatch(page, /wl-marquee|wl-scroll/, "no scrolling strip is left in the page");
  assert.doesNotMatch(css, /wl-marquee|@keyframes wl-drift/, "and none of its motion is left in the CSS");
});

test("the language board keeps every language in a copyable, translated element", () => {
  // The board is the one place a visitor can see their own script before signing
  // up, so the names stay real text (not an image) and right-to-left scripts keep
  // their direction.
  const items = [...page.matchAll(/<li[^>]*>([^<]+)<\/li>/g)].filter((match) =>
    /हिन्दी|বাংলা|اردو|తెలుగు|日本語/.test(match[1]),
  );
  assert.ok(items.length >= 5, "scripts other than Latin are real text on the page");
  assert.match(page, /lang="ur" dir="rtl"|dir="rtl"[^>]*lang="ur"/, "Urdu keeps its right-to-left direction");
});

test("an illustration is labelled as an illustration", () => {
  assert.match(page, /class="wl-badge">Illustration</, "the badge says what it is, in the page's voice");
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
  // Only the two entrances are left. The marquee drift and the bobbing arrow were
  // removed with the marquee itself; the list below is what this page still animates.
  for (const animation of ["wl-rise", "wl-turn-in"]) {
    assert.ok(css.includes(`@keyframes ${animation}`), `${animation} is defined`);
  }
  for (const gone of ["wl-drift", "wl-bob", "wl-marquee-track"]) {
    assert.ok(!css.includes(gone), `${gone} is gone, not merely switched off`);
  }
  assert.match(reduced, /animation: none !important;/);
  assert.match(reduced, /opacity: 1 !important;/);
  // Every element that starts hidden through `animation-fill-mode: both` has to be
  // restored in the reduced-motion block, or a reader who dislikes motion is left
  // with a blank hero. Read the list out of the stylesheet rather than keeping a
  // second copy of it here: a selector added above cannot be forgotten below.
  const animated = [];
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const rule of withoutComments.matchAll(/([^{}]+)\{([^{}]*animation:[^{}]*\bboth\b[^{}]*)\}/g)) {
    if (rule[1].includes("prefers-reduced-motion")) continue;
    for (const selector of rule[1].split(",")) {
      const name = selector.trim();
      if (name && !animated.includes(name)) animated.push(name);
    }
  }
  assert.ok(animated.length >= 3, `the entrances are found (${animated.length})`);
  for (const selector of animated) {
    assert.ok(reduced.includes(selector), `${selector} starts hidden, so it must be restored`);
  }
});

test("the page speaks like a person, not like a template", () => {
  // Four tells that survive every palette change, because they are habits rather
  // than styles: an arrow glued to the end of every link, a tracked-out all-caps
  // label over every heading, a headline with one phrase tinted grey for effect,
  // and meta text joined with middle dots. Each is legitimate somewhere; none of
  // them means anything here, and a page that uses all four reads as generated.
  assert.doesNotMatch(page, /↗|→/, "no arrow is glued to the end of a link or a button");
  assert.doesNotMatch(visible, /·/, "no meta string is joined with a middle dot");
  // The display voice is shouted on purpose — the title, the section headings and
  // the closing line. Anything else in caps is a label wearing a uniform.
  const notHeadlines = body
    .replace(/<h1[\s\S]*?<\/h1>/g, " ")
    .replace(/<h2[\s\S]*?<\/h2>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/VIGNAN \/ AI/g, " ")
    .replace(/\s+/g, " ");
  assert.doesNotMatch(notHeadlines, /[A-Z]{3,}(?: [A-Z]{2,})+/, "no line outside a headline is shouted in caps");
  // The display headlines are set in caps on purpose — that is the identity voice,
  // declared once on `.wl-title` and the three section headings, not sprinkled on
  // labels. Nothing else may transform its case.
  const upper = [...css.matchAll(/([^{}]+)\{[^{}]*text-transform:\s*uppercase/g)].map((m) => m[1].trim());
  assert.ok(upper.length > 0, "the display voice is still set in caps");
  for (const selector of upper) {
    assert.ok(
      /\.wl-(title|section-head h2|close-title)$/.test(selector),
      `${selector} is not a display headline, so it should not be set in caps`,
    );
  }
  // A headline may not tint one phrase to make its point; the words have to do it.
  // Spans that wrap a whole animated line are structure, not emphasis, so the
  // check looks for the emphasis itself: a changed colour, a swapped face, or a
  // highlight behind part of the sentence.
  assert.doesNotMatch(css, /(?:\.wl-title|\.wl-section-head h2|\.wl-close-title)[^{}]*\b(?:span|em|i|b|strong)\b[^{}]*\{[^}]*(?:color|background)/,
    "no phrase inside a display headline is given its own colour");
  for (const heading of page.matchAll(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/g)) {
    assert.doesNotMatch(heading[1], /<(?:em|i|b|strong|mark)\b/, "a headline is set in one voice");
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
  const judgeLink = /<a href="\.\/judge\.html">Judge mode<\/a>/.test(page);
  assert.ok(judgeLink, "the page can be checked, not just admired");
  assert.match(judge, /welcome\.html/, "and the judge page can reach the landing page");
});
