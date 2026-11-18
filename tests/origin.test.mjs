/**
 * One site, one address.
 *
 * The project moved to a new Render service on 2026-11-17. The deploy was
 * correct within minutes; the repository was not. 126 absolute URLs across
 * 26 files still named the retired host — canonical tags, `og:url`,
 * `og:image`, the sitemap, the RSS feed, `robots.txt`, `security.txt`, the
 * JSON-LD blocks, the README and the deploy checker. Nothing failed, because
 * no test had ever asked whether the repository and the deploy agreed on
 * where the site lives.
 *
 * These tests ask exactly that, and they take the answer from `index.html`
 * rather than restating it, so `npm run set-origin <new address>` is the
 * whole move: rewrite, run the suite, commit.
 *
 * What is checked:
 *
 * 1. The canonical link in `index.html` is a real absolute address.
 * 2. Every page's canonical, `og:url` and preview image name that address.
 * 3. The sitemap, the feed, `robots.txt`, `security.txt` and the structured
 *    data name it too.
 * 4. No file anywhere still names a *different* project host — the half-done
 *    move is the failure this was written for.
 * 5. The rewriter itself works, including leaving documentation placeholders
 *    such as `<your-service>.onrender.com` alone.
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { canonicalOrigin } from "./canonical.mjs";
import { rewrite, validOrigin } from "../tools/set-origin.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (file) => readFileSync(path.join(root, file), "utf8");
const site = canonicalOrigin();

// Every project address that could be lying around, anywhere, in any file.
const PROJECT_HOST = /https:\/\/vignan[a-z0-9-]*\.onrender\.com/gi;
const TEXT = new Set([".html", ".xml", ".txt", ".md", ".mjs", ".json", ".webmanifest"]);
const SKIP = new Set([".git", "node_modules", "server", "supabase", "vendor", ".cache", "__pycache__"]);

function walk(directory, prefix = "", out = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && entry.name !== ".well-known") continue;
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (SKIP.has(entry.name)) continue;
      walk(path.join(directory, entry.name), relative, out);
    } else if (entry.isFile() && TEXT.has(path.extname(entry.name).toLowerCase())) {
      out.push(relative);
    }
  }
  return out;
}

// Files that exist to prove the rewrite: this test carries retired addresses
// on purpose, so it cannot be scanned for them.
const REWRITE_PROOF = new Set(["tests/origin.test.mjs", "tools/set-origin.mjs"]);

const files = walk(root);
// `tools/design-check.html` is a bench for checking the design by eye, served
// from the repository but not published, so it carries no canonical link.
const pages = files.filter((file) => file.endsWith(".html") && !file.startsWith("tools/"));

test("the site address is a real absolute address, read from the front page", () => {
  assert.match(site, /^https:\/\/[a-z0-9.-]+$/i, "index.html's canonical is a bare https origin");
  assert.equal(validOrigin(site), site, "the address has no path, query or port");
  assert.equal(validOrigin(`${site}/welcome.html`), "", "a page URL is not an origin");
  assert.match(read("index.html"), new RegExp(`<link rel="canonical" href="${site.replace(/\./g, "\\.")}/">`));
});

test("every page points its canonical, share card and image at that address", () => {
  assert.ok(pages.length >= 17, `expected the whole site, found ${pages.length} pages`);
  for (const page of pages) {
    const html = read(page);
    const canonical = html.match(/<link rel="canonical" href="([^"]+)">/);
    assert.ok(canonical, `${page} has a canonical link`);
    assert.ok(canonical[1].startsWith(`${site}/`), `${page} canonical names ${site}, found ${canonical[1]}`);

    for (const [, property, value] of html.matchAll(/<meta property="(og:url|og:image)" content="([^"]+)">/g)) {
      assert.ok(value.startsWith(`${site}/`), `${page} ${property} names ${site}, found ${value}`);
    }
    for (const [, value] of html.matchAll(/<meta name="twitter:image" content="([^"]+)">/g)) {
      assert.ok(value.startsWith(`${site}/`), `${page} twitter:image names ${site}, found ${value}`);
    }
  }
});

test("the sitemap, the feed, robots.txt and security.txt agree with the pages", () => {
  for (const [, loc] of read("sitemap.xml").matchAll(/<loc>([^<]+)<\/loc>/g)) {
    assert.ok(loc.startsWith(`${site}/`), `sitemap entry names ${site}, found ${loc}`);
  }
  assert.ok(read("robots.txt").includes(`Sitemap: ${site}/sitemap.xml`));

  const feed = read("blog/feed.xml");
  assert.ok(feed.includes(`<link>${site}/blog/</link>`) || feed.includes(`href="${site}/blog/"`), "feed links home");
  for (const [, href] of feed.matchAll(/<id>([^<]+)<\/id>/g)) {
    assert.ok(href.startsWith(`${site}/`), `feed id names ${site}, found ${href}`);
  }
  assert.ok(read(".well-known/security.txt").includes(`Policy: ${site}/security.html`));
});

test("the structured data names the same address as the page it sits on", () => {
  for (const page of pages) {
    const html = read(page);
    for (const [, json] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      const data = JSON.parse(json);
      const urls = [data.url, data["@id"], data.mainEntityOfPage?.toString()].filter(Boolean);
      for (const url of urls) {
        assert.ok(url.startsWith(`${site}/`), `${page} structured data names ${site}, found ${url}`);
      }
    }
  }
});

test("no file anywhere names a different address for this project", () => {
  const strays = [];
  for (const file of files) {
    if (REWRITE_PROOF.has(file)) continue;
    for (const [found] of read(file).matchAll(PROJECT_HOST)) {
      if (found !== site) strays.push(`${file}: ${found}`);
    }
  }
  assert.deepEqual(
    strays,
    [],
    `these files still name a retired host — run \`npm run set-origin -- ${site}\`:\n  ${strays.join("\n  ")}`,
  );
});

test("the deploy checker questions the address the site claims", () => {
  const checker = read("tools/check-deployed.mjs");
  assert.match(checker, /canonicalOrigin\(/, "the default host is read, not restated");
  assert.doesNotMatch(checker, /const DEFAULT_HOST = "http/, "no hardcoded address in the checker");
});

test("the rewriter moves a stale address and leaves instructions alone", () => {
  const stale = "https://vignanvidyanikethanai.onrender.com/blog/";
  assert.deepEqual(rewrite(stale, site), { text: `${site}/blog/`, count: 1 });

  // Already correct: a file that names the target has not changed, so running
  // the tool twice reports nothing rather than churning the whole tree.
  assert.deepEqual(rewrite(`${site}/judge.html`, site), { text: `${site}/judge.html`, count: 0 });

  // Documentation placeholders are instructions for a reader, not addresses.
  const placeholder = "curl -s https://<your-service>.onrender.com/api/health";
  assert.deepEqual(rewrite(placeholder, site), { text: placeholder, count: 0 });

  // Two addresses on one line: the stale one moves, the current one is left
  // alone and is not counted as a change.
  const both = rewrite(
    "https://vignanvidyanikethanai.onrender.com/a https://vignan-vidyanikethan-ai-1.onrender.com/b",
    site,
  );
  assert.deepEqual(both, { text: `${site}/a ${site}/b`, count: 1 });
});
