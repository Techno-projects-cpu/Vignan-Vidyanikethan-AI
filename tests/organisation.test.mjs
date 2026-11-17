/**
 * The repository is organised, and stays organised.
 *
 * A project this size does not usually fall apart because a feature was written
 * badly; it falls apart because the root slowly fills with documents, and then
 * nobody can tell what the browser needs from what a person reads. So the shape
 * is stated here once and checked on every run: the root holds what the browser
 * and the worker ask for by name, `docs/` holds everything a person reads, and
 * every link between the two resolves.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(`${root}/${path}`, "utf8");
const exists = (path) => existsSync(`${root}/${path}`);

test("the root holds the product, and docs holds the paper", () => {
  const rootDocs = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name)
    .sort();
  // Three documents earn the root: what it is, what you may do with it, and how
  // to report a problem privately (GitHub looks for SECURITY.md in the root).
  assert.deepEqual(rootDocs, ["README.md", "SECURITY.md"]);
  assert.ok(exists("LICENSE"), "the licence stays where a reader looks for it");
  const docs = readdirSync(`${root}/docs`).filter((name) => name.endsWith(".md")).sort();
  for (const required of [
    "README.md", "STRUCTURE.md", "DESIGN.md", "SKILLS.md",
    "CHECKLIST.md", "DEPLOY.md", "LOCAL_AI.md", "PACKAGING.md", "OPEN_SOURCE_CREDITS.md",
  ]) {
    assert.ok(docs.includes(required), `docs/${required} is where it belongs`);
  }
});

test("every relative link in the documentation points at a file that exists", () => {
  const pages = ["README.md", "SECURITY.md", ...readdirSync(`${root}/docs`).filter((n) => n.endsWith(".md")).map((n) => `docs/${n}`)];
  const broken = [];
  for (const page of pages) {
    const where = page.startsWith("docs/") ? page.slice(5) : page;
    const from = page.startsWith("docs/") ? `docs/${where}` : page;
    for (const link of read(page).matchAll(/\]\((\.{1,2}\/[^)#\s]+)\)/g)) {
      const target = path.normalize(path.join(path.dirname(from), link[1]));
      if (!exists(target)) broken.push(`${page} → ${link[1]}`);
    }
  }
  assert.deepEqual(broken, [], "no documentation links a file that has moved");
});

test("the pages that the browser loads never link into docs", () => {
  // Documentation is not precached and is not served from the cache, so a page
  // that links into it would be a link that fails offline.
  for (const page of readdirSync(root).filter((name) => name.endsWith(".html"))) {
    const html = read(page);
    assert.doesNotMatch(html, /(?:href|src)="\.?\/?docs\//, `${page} does not send a reader to the docs folder`);
  }
  // The one exception is judge.html, which names the credits file as text so a
  // reader can find it in the repository. Text, not a link: asserted above.
  assert.match(read("judge.html"), /docs\/OPEN_SOURCE_CREDITS\.md/, "the judge page says where the credits are");
});

test("there is CI, and it runs the same command a person runs", () => {
  const workflow = read(".github/workflows/ci.yml");
  assert.match(workflow, /npm run check/, "CI runs the full check");
  assert.match(workflow, /npm run secrets/, "and the secret scan on its own, so a leak fails first");
  assert.match(workflow, /node-version: "22"/, "on the version the project is developed against");
  // No dependencies were added to run the checks; the workflow must not pretend
  // there are.
  assert.doesNotMatch(workflow, /^\s*-?\s*run:.*npm (?:ci|install)/m, "there is nothing to install");
});

test("the issue templates ask for the things that can actually be checked", () => {
  assert.match(read(".github/PULL_REQUEST_TEMPLATE.md"), /npm run check/);
  assert.match(read(".github/ISSUE_TEMPLATE/bug.md"), /Wi-Fi/);
  assert.match(read(".github/ISSUE_TEMPLATE/claim.md"), /re-runnable/);
});

test("the structure document matches the repository it describes", () => {
  const structure = read("docs/STRUCTURE.md");
  // The counts in the map are honest: if modules are added, the table is wrong
  // until somebody updates it, and this test says so.
  const modules = readdirSync(`${root}/js`).filter((name) => name.endsWith(".js")).length;
  assert.match(structure, new RegExp(`js/\\s+${modules} modules`), `the map says ${modules} modules`);
  const tests = readdirSync(`${root}/tests`).filter((name) => name.endsWith(".test.mjs")).length;
  assert.match(structure, new RegExp(`tests/\\s+${tests} files`), `the map says ${tests} test files`);
  const sheets = readdirSync(root).filter((name) => /^styles(-[a-z]+)?\.css$/.test(name)).length;
  assert.match(structure, new RegExp(`${sheets} stylesheets`), `the map says ${sheets} stylesheets`);
});
