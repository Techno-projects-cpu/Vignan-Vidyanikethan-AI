// The legal set is the part of the site that is easiest to let rot: a page gets
// added, linked from nowhere, never precached, and quietly 404s a year later.
// These tests treat the documents as a set — reachable from the index, reachable
// from every footer, listed in the offline cache and the sitemap, dated, and
// linking only to addresses that exist.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), "utf8");

const DOCUMENTS = [
  "legal.html",
  "privacy.html",
  "terms.html",
  "security.html",
  "copyright.html",
  "acceptable-use.html",
  "cookies.html",
  "accessibility.html",
  "subprocessors.html",
  "disclaimer.html",
];

test("every legal document exists, is dated and says what it is", () => {
  for (const name of DOCUMENTS) {
    assert.ok(existsSync(new URL(`../${name}`, import.meta.url)), `${name} exists`);
    const html = read(name);
    assert.match(html, /^<!doctype html>/i, `${name} starts like a document`);
    assert.match(html, /<html lang="en">/, `${name} declares its language`);
    assert.match(html, /<meta name="description" content="[^"]{60,}">/, `${name} has a real description`);
    assert.match(html, /Last updated \d{1,2} \w+ 202\d/, `${name} is dated`);
    assert.match(html, /rel="canonical" href="https:\/\/vignan-vidyanikethan-ai-1\.onrender\.com\//, `${name} has a canonical address`);
    assert.match(html, /<link rel="stylesheet" href="\.\/styles-legal\.css\?v=\d+">/, `${name} uses the legal sheet`);
    assert.match(html, /class="skip" href="#content"/, `${name} is skippable`);
    assert.match(html, /<main id="content"/, `${name} has the skip target`);
    // Balanced sections: an unclosed one swallows the next chapter silently.
    assert.equal(
      (html.match(/<section>/g) || []).length,
      (html.match(/<\/section>/g) || []).length,
      `${name} closes every section`,
    );
  }
});

test("the index links every document, and every document links the index", () => {
  const index = read("legal.html");
  for (const name of DOCUMENTS.filter((name) => name !== "legal.html")) {
    assert.ok(index.includes(`href="./${name}"`), `legal.html links ${name}`);
    const html = read(name);
    assert.ok(html.includes('href="./legal.html"'), `${name} links the index`);
  }
});

test("every document is in the offline cache and the sitemap", () => {
  const precache = JSON.parse(read("precache.json"));
  const urls = Array.isArray(precache) ? precache : precache.urls || precache.assets || [];
  const flat = JSON.stringify(urls);
  const sitemap = read("sitemap.xml");
  for (const name of DOCUMENTS) {
    assert.ok(flat.includes(name), `${name} is precached, so it opens offline`);
    assert.ok(sitemap.includes(name), `${name} is in the sitemap`);
  }
});

test("no legal page links to a page that is not there", () => {
  for (const name of DOCUMENTS) {
    const html = read(name);
    for (const [, href] of html.matchAll(/href="\.\/([a-z0-9-]+\.html)"/g)) {
      assert.ok(existsSync(new URL(`../${href}`, import.meta.url)), `${name} links ${href}, which exists`);
    }
  }
});

test("the new documents cover the questions a school actually asks", () => {
  const at = (name) => read(name).toLowerCase();
  // Acceptable use must name academic integrity explicitly, and must not pretend
  // to be a detection system it does not have.
  const use = at("acceptable-use.html");
  assert.match(use, /academic integrity/);
  assert.match(use, /hand in work you did not do|submitting generated text as your own/);
  assert.doesNotMatch(use, /detects plagiarism|guarantees originality/);

  // Cookies: the two claims that matter are "no advertising" and "here is the
  // switch". A cookie page without the removal instructions is a brochure.
  const cookies = at("cookies.html");
  assert.match(cookies, /no advertising cookies/);
  assert.match(cookies, /delete all local data|site-data/);
  assert.match(cookies, /vv_session/);

  // Sub-processors must not claim completeness it cannot keep: the CSP is the
  // machine-checkable version of that promise, and the page says so.
  const subs = at("subprocessors.html");
  assert.match(subs, /content security policy/);
  for (const host of ["render", "supabase", "wikipedia", "duckduckgo", "hugging face"]) {
    assert.ok(subs.includes(host), `sub-processors names ${host}`);
  }

  // Accessibility must publish a standard and a gap list, in that order.
  assert.match(at("accessibility.html"), /wcag 2\.2 level aa/);
  assert.match(at("accessibility.html"), /known gaps/);

  // The disclaimer has to be blunt about being wrong.
  assert.match(at("disclaimer.html"), /can be wrong/);
  assert.match(at("disclaimer.html"), /medical, legal, financial or psychological advice/);
  assert.match(at("disclaimer.html"), /crisis service|trusted adult/);
});

test("the security page describes the policy that is actually served", () => {
  const security = read("security.html");
  assert.match(security, /sha256|SHA-256/, "the hash-based script list is documented");
  assert.match(security, /subprocessors\.html/, "the connect list points at the sub-processor page");
  assert.doesNotMatch(security, /blocks outside scripts/i, "the old, vaguer claim is gone");
});

test("the legal pages are not part of the app shell, and the app does not load them", () => {
  // A legal page must survive the app being broken: no scripts, no app stylesheet.
  for (const name of DOCUMENTS) {
    const html = read(name);
    assert.doesNotMatch(html, /<script\b/, `${name} needs no script to be read`);
    assert.doesNotMatch(html, /styles-next\.css|styles-premium\.css/, `${name} does not depend on the shell`);
  }
});
