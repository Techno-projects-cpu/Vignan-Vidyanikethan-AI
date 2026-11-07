/**
 * The writing section.
 *
 * Six pages were added for one reason: someone searching for how to revise a
 * chapter should be able to find one useful page without an advertisement in
 * front of it. That only works if the pages are real. So these tests hold the
 * things a blog quietly gets wrong:
 *
 * 1. A post that is a stub with a keyword in the title (a word floor, and every
 *    section has to say something).
 * 2. A dead link, or a link to a page that never existed.
 * 3. Two posts with the same slug, or a slug that disagrees with its filename.
 * 4. Structured data that disagrees with the page a search engine will read.
 * 5. A reading time typed by hand that drifts from the real word count.
 * 6. Any claim the rest of the site does not make — "guaranteed", "#1", made-up
 *    statistics. The project's whole argument is that claims are checkable.
 * 7. A page that only works online, on a laptop, or with JavaScript.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (file) => readFileSync(`${root}/${file}`, "utf8");
const BLOG = `${root}/blog`;
const css = read("styles-blog.css");
const landingCss = read("styles-welcome.css");
const index = read("blog/index.html");
const feed = read("blog/feed.xml");
const sitemap = read("sitemap.xml");
const worker = read("sw.js");
const server = read("serve.mjs");
const app = read("index.html");
const landing = read("welcome.html");

const posts = readdirSync(BLOG)
  .filter((name) => name.endsWith(".html") && name !== "index.html")
  .sort();
const source = (file) => read(`blog/${file}`);
const bodyOf = (html) => {
  const start = html.indexOf('<article class="bl-body">');
  return html.slice(start, html.indexOf("</article>", start));
};
const textOf = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const wordCount = (text) => (text.match(/[A-Za-z0-9'’₹%+-]+/g) || []).length;
const bodyText = (html) => textOf(bodyOf(html));
const meta = (html, name) =>
  new RegExp(`<meta (?:name|property)="${name}" content="([^"]*)"`).exec(html)?.[1] || "";
const jsonLd = (html) => {
  const found = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
  assert.ok(found, "the page carries structured data");
  return JSON.parse(found[1]);
};

test("there are ten pieces, and ten is the number the pages say", () => {
  assert.equal(posts.length, 10, `posts on disk: ${posts.join(", ")}`);
  assert.equal((index.match(/class="bl-card"/g) || []).length, 10, "the index links every one");
  assert.match(index, /<p class="bl-bar-note">WRITING &nbsp;\/&nbsp; <span>10 PIECES<\/span><\/p>/);
  assert.match(index, /<h1 class="bl-title" id="bl-title">TEN PIECES/, "the archive counts itself");
  assert.equal((feed.match(/<item>/g) || []).length, 10, "and the feed carries every one");
  assert.equal((feed.match(/<link>/g) || []).length, 11, "one channel link and one per item");
});

test("every piece is long enough to be worth a click", () => {
  for (const file of posts) {
    const html = source(file);
    const body = textOf(bodyOf(html));
    assert.ok(wordCount(body) >= 520, `${file} has ${wordCount(body)} words of body`);
    const sections = (bodyOf(html).match(/<section>/g) || []).length;
    assert.ok(sections >= 5, `${file} is divided into ${sections} sections`);
    // A stub is a heading and a sentence. Every section has to carry a paragraph.
    for (const section of bodyOf(html).split("<section>").slice(1)) {
      assert.ok(wordCount(textOf(section)) >= 60, `${file} has a section thinner than sixty words`);
    }
  }
});

test("the reading time is the reading time", () => {
  for (const file of posts) {
    const html = source(file);
    const declared = Number(/<span>(\d+) min read<\/span>/.exec(html)?.[1]);
    // The dek, the numbered body and the closing line are what a reader actually
    // reads. Navigation, the page furniture and the footer are not on the clock.
    const dek = textOf(/<p class="bl-dek">([\s\S]*?)<\/p>/.exec(html)[1]);
    const check = textOf(/<aside class="bl-check">([\s\S]*?)<\/aside>/.exec(html)[1]);
    const read = wordCount(dek) + wordCount(bodyText(html)) + wordCount(check);
    const expected = Math.max(3, Math.round(read / 200));
    assert.equal(declared, expected, `${file} claims ${declared} minutes for ${read} words`);
  }
});

test("a piece never promises what the rest of the site cannot back", () => {
  const banned = [
    /guarantee/i,
    /\b#1\b/,
    /\bbest AI\b/i,
    /\brank(?:s|ed)? (?:number|first)\b/i,
    /\b(?:10|100)\s*(?:x|times) (?:more|faster|better)\b/i,
    /\bstudies (?:show|prove)\b/i,
    /\bexperts say\b/i,
    /\bthousands of students\b/i,
  ];
  for (const file of posts) {
    const text = textOf(source(file));
    for (const pattern of banned) {
      assert.doesNotMatch(text, pattern, `${file} makes an unbacked claim: ${pattern}`);
    }
    // Every number a piece uses has to be a number it can show, so a bare
    // percentage is the shape of an invented statistic.
    const percentages = [...text.matchAll(/(\d+(?:\.\d+)?)\s?%/g)].map((match) => match[1]);
    assert.deepEqual(percentages, [], `${file} quotes a percentage it cannot show: ${percentages.join(", ")}`);
  }
});

test("no piece shows a student developer text", () => {
  const CODE_SHAPES = /=>|<\/|\bundefined\b|\bNaN\b|\bnull\b|function\s*\(|\{q\}/;
  for (const file of [...posts, "index.html"]) {
    const text = textOf(source(file));
    assert.doesNotMatch(text, CODE_SHAPES, `${file} shows a code shape`);
    for (const word of ["API", "JSON", "endpoint", "LLM", "embeddings", "front-end"]) {
      assert.ok(!new RegExp(`\\b${word}\\b`).test(text), `${file} uses the builder's word "${word}"`);
    }
  }
});

test("every link in the section goes somewhere real", () => {
  for (const file of [...posts, "index.html"]) {
    const html = source(file);
    const links = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
    const missing = [];
    for (const link of links) {
      if (/^(?:https?:)?\/\//.test(link)) continue;
      if (link.startsWith("#")) continue;
      const path = link.split("?")[0].split("#")[0];
      // Three shapes are allowed: a path from the site root (/blog/x.html), a
      // path inside the section (./x.html) and a path up one level (../judge.html).
      const target = path.startsWith("/")
        ? path.replace(/^\//, "")
        : path.startsWith("../")
          ? path.replace(/^\.\.\//, "")
          : `blog/${path}`;
      if (!existsSync(`${root}/${target}`)) missing.push(`${file} → ${link}`);
    }
    assert.deepEqual(missing, [], `dead links: ${missing.join(", ")}`);
  }
  // The only outward host is the one the project was asked to credit.
  const remote = [...read("blog/index.html").matchAll(/href="(https?:\/\/[^"]+)"/g)].map((match) => match[1]);
  for (const url of remote) {
    assert.ok(/zero-vast\.vercel\.app|vignanvidyanikethanai\.onrender\.com/.test(url), `unexpected outward link: ${url}`);
  }
});

test("every piece is a complete page a search engine can index", () => {
  for (const file of posts) {
    const html = source(file);
    const slug = file.replace(/\.html$/, "");
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, `${file} has exactly one h1`);
    assert.match(html, /<html lang="en">/);
    assert.match(html, /<title>[^<]{20,}<\/title>/, `${file} has a real title`);
    const description = meta(html, "description");
    assert.ok(description.length >= 60 && description.length <= 200, `${file} description is ${description.length} characters`);
    assert.match(meta(html, "og:title"), /[A-Za-z]/);
    assert.ok(html.includes(`<link rel="canonical" href="https://vignanvidyanikethanai.onrender.com/blog/${slug}.html">`));
    assert.ok(html.includes('<link rel="alternate" type="application/rss+xml"'), "the feed is discoverable");

    const data = jsonLd(html);
    assert.equal(data["@type"], "BlogPosting");
    assert.equal(data.headline, /<h1>([^<]+)<\/h1>/.exec(html)[1].replace(/&amp;/g, "&"));
    assert.equal(data.description, description);
    assert.equal(data.mainEntityOfPage, `https://vignanvidyanikethanai.onrender.com/blog/${slug}.html`);
    assert.match(data.datePublished, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(data.author?.name, "the author is named");
    assert.ok(!/AI (?:model|agent)$/.test(data.author.name), "the credit is to the student, not to a model");
  }
});

test("the section has a way in, from the app and from the landing page", () => {
  assert.equal((index.match(/class="bl-card"/g) || []).length, posts.length);
  // Absolute links in the index, because /blog, /blog/, /writing and
  // /blog/index.html all serve it and a relative card link only works for one.
  for (const file of posts) {
    assert.ok(index.includes(`href="/blog/${file}"`), `the index links ${file} absolutely`);
  }
  assert.match(app, /<a class="app-menu-item" href="\.\/blog\/index\.html">/, "the drawer links the writing");
  assert.match(landing, /<a href="\.\/blog\/index\.html">Writing<\/a>/, "the landing page links it in the top bar");
  assert.equal((landing.match(/class="wl-cell wl-cell-article"/g) || []).length, posts.length, "and lists all ten pieces");
  assert.match(index, /href="\/">Open the app/, "every page leads back into the app");
  for (const file of posts) assert.match(source(file), /<a class="bl-bar-open" href="\.\.\/">/, `${file} leads back into the app`);
});

test("the clean addresses are served, and the pages work offline", () => {
  // /blog without a trailing slash must redirect, not serve the index: served in
  // place, every relative link in it resolves one level too high and the cards
  // point at pages that do not exist. This was a real defect on the live site.
  assert.match(server, /const DIRECTORY_ALIASES = \{ blog: "\/blog\/", writing: "\/blog\/" \};/);
  assert.match(server, /response\.writeHead\(308, \{ Location: DIRECTORY_ALIASES\[requested\] \}\)/);
  assert.match(server, /"blog\/": "blog\/index\.html"/);
  assert.ok(worker.includes("./blog/index.html"), "the worker caches the index");
  assert.ok(worker.includes("./blog/feed.xml"), "and the feed");
  assert.ok(worker.includes("./styles-blog.css?v="), "and the stylesheet");
  // The posts come from precache.json, which generate-precache walks: a blog file
  // that is not in the manifest is a link that dies with the network off.
  const manifest = JSON.parse(read("precache.json"));
  for (const file of posts) {
    assert.ok(manifest.urls.includes(`./blog/${file}`), `${file} is in the offline manifest`);
  }
  assert.ok(manifest.urls.includes("./blog/index.html"));
  assert.ok(manifest.urls.includes("./blog/feed.xml"));
  assert.ok(manifest.urls.includes("./styles-blog.css"));
});

test("the sitemap and the feed agree with the files", () => {
  for (const file of posts) {
    assert.ok(sitemap.includes(`<loc>https://vignanvidyanikethanai.onrender.com/blog/${file}</loc>`), `${file} is in the sitemap`);
    assert.ok(feed.includes(`https://vignanvidyanikethanai.onrender.com/blog/${file}`), `${file} is in the feed`);
  }
  assert.ok(sitemap.includes("<loc>https://vignanvidyanikethanai.onrender.com/blog/</loc>"));
  // The feed is valid XML with one channel and one item per post.
  assert.match(feed, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.equal((feed.match(/<channel>/g) || []).length, 1);
  assert.equal((feed.match(/<\/item>/g) || []).length, posts.length);
});

test("the reading page is designed, not default", () => {
  // The same design language as the rest of the site: greys only, square, no
  // shadows, and one measure for the text so a long line never runs 120
  // characters across a laptop.
  const colours = [...new Set([...css.matchAll(/#([0-9a-f]{6})\b/gi)].map((match) => match[1].toLowerCase()))];
  for (const hex of colours) {
    const [r, g, b] = hex.match(/.{2}/g).map((pair) => parseInt(pair, 16));
    assert.ok(r === g && g === b, `#${hex} is a colour, not a grey`);
  }
  assert.doesNotMatch(css, /border-radius:\s*(?!0)/);
  assert.doesNotMatch(css, /box-shadow:/);
  assert.match(css, /\.bl-body \{ max-width: 68ch; \}/, "the article has a measure");
  assert.match(css, /\.bl-body h2 \{[\s\S]*?grid-template-columns: 52px/, "numbered section headings, like the rest of the site");
  // The palette must be the landing page's palette, or the two halves of the
  // project drift apart one release at a time.
  const tokens = (sheet) => Object.fromEntries(
    [...sheet.matchAll(/--(?:wl|bl)-([a-z-]+):\s*(#[0-9a-f]{6});/gi)].map((match) => [match[1], match[2].toLowerCase()]),
  );
  const blog = tokens(css);
  const page = tokens(landingCss);
  for (const key of ["bg", "ink", "soft", "quiet", "line"]) {
    assert.equal(blog[key], page[key], `--${key} matches the landing page`);
  }
});

test("the pages are readable on a phone and by a screen reader", () => {
  assert.match(css, /@media \(max-width: 720px\) \{[\s\S]*?body\.bl \{ font-size: 16\.5px; \}/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/, "motion can be switched off");
  for (const file of [...posts, "index.html"]) {
    const html = source(file);
    assert.match(html, /<a class="bl-skip" href="#bl-main">/, `${file} has a skip link`);
    assert.match(html, /<main id="bl-main"/);
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(ids.length, new Set(ids).size, `${file} has no duplicate ids`);
    // The sections that structure the page need a name; the numbered sections
    // inside the article are already named by their own headings.
    const outside = html.replace(bodyOf(html), " ");
    for (const section of [...outside.matchAll(/<section\b([^>]*)>/g)]) {
      assert.ok(/aria-label(?:ledby)?="/.test(section[1]), `${file} names every page section`);
    }
    const images = [...html.matchAll(/<img\b([^>]*)>/g)];
    for (const image of images) assert.match(image[1], /\balt="[^"]*"/, `${file} gives every image alt text`);
  }
});

test("each piece says it was written by a student, and links the proof", () => {
  for (const file of posts) {
    const html = source(file);
    assert.match(html, /WRITTEN BY A STUDENT/);
    assert.match(html, /INSPIRE-MANAK/);
    assert.match(html, /Vignan Vidyanikethan English Medium High School/);
    assert.ok(html.includes('href="../judge.html"'), `${file} links the page where the claims can be checked`);
    assert.ok(html.includes('href="./index.html"'), `${file} links back to the list`);
    assert.match(html, /No analytics|no analytics|There is no analytics/i, "the privacy promise is on the page");
  }
  assert.match(index, /no analytics, no cookie, no email box/i);
});
