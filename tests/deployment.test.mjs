/**
 * "Is the live site the site in this repository?"
 *
 * The bug this guards against cannot be caught by testing the code, because the
 * code was never wrong: a host was pointed at a pull-request branch, the branch
 * stopped moving when the pull request merged, and every later release went to
 * `main` and nowhere else. Build logs were green and every request answered 200.
 *
 * So the check is on the release, not the code: the health endpoint now reports
 * the commit and branch the host built, and this tool compares them with the
 * checkout. The comparison is pure, so it is tested here without a network.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { compareRelease, describeGap, formatReport, localRelease } from "../tools/check-deployed.mjs";

const read = (path) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), "utf8");

test("the local release is read from the files that ship it", () => {
  const local = localRelease();
  assert.match(local.version, /^\d+\.\d+\.\d+$/);
  assert.match(local.cache, /^v\d+$/);
  // The cache name and the package version are bumped together by hand, and
  // this is the assertion that notices when only one of them was bumped.
  const worker = read("sw.js");
  assert.ok(worker.includes(`vignan-vidyanikethan-ai-${local.cache}`), "sw.js agrees with itself");
});

test("a host on an older release is reported as behind, with the gap named", () => {
  const result = compareRelease({ version: "2.25.1" }, { version: "2.26.0", cache: "v59" });
  assert.equal(result.ok, false);
  assert.equal(result.behind, "1 minor release(s) behind");
  assert.match(formatReport(result, "https://example.test"), /NOT this repository/);
  // The report has to tell a person what to click, not just that it is wrong.
  assert.match(formatReport(result, "https://example.test"), /Branch → main/);
});

test("a matching host is reported plainly, with the commit it built", () => {
  const result = compareRelease(
    { version: "2.26.0", cache: "v59", build: { branch: "main", commit: "80a821859b332ed11e859f59d0545a677b4f309d" } },
    { version: "2.26.0", cache: "v59" },
  );
  assert.equal(result.ok, true);
  assert.equal(result.branch, "main");
  assert.equal(result.commit.slice(0, 7), "80a8218");
  const report = formatReport(result, "https://example.test");
  assert.match(report, /The live site is this repository\./);
  assert.match(report, /main @ 80a8218/);
});

test("gaps are described in releases, not in words like 'stale'", () => {
  assert.equal(describeGap("2.25.1", "2.26.0"), "1 minor release(s) behind");
  assert.equal(describeGap("2.25.0", "2.25.1"), "1 patch release(s) behind");
  assert.equal(describeGap("1.9.0", "2.0.0"), "1 major release(s) behind");
  assert.equal(describeGap("2.26.0", "2.26.0"), "the versions match");
  assert.equal(describeGap("", "2.26.0"), "the host reports no version at all");
});

test("the health endpoint says which commit and branch the host built", () => {
  const server = read("serve.mjs");
  // Without this, a deploy pointed at the wrong branch is invisible from
  // outside: every request answers correctly from three releases ago.
  assert.match(server, /RENDER_GIT_COMMIT/);
  assert.match(server, /RENDER_GIT_BRANCH/);
  assert.match(server, /build: buildInfo\(\)/, "the payload carries it");
  assert.match(server, /commit: commit \? commit\.slice\(0, 40\) : null/, "and truncates it honestly");
});

test("the check is one command, and it is documented where a deployer looks", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.scripts.deployed, "node tools/check-deployed.mjs");
  const deploy = read("docs/DEPLOY.md");
  assert.match(deploy, /npm run deployed/, "DEPLOY.md names the command");
  assert.match(deploy, /branch: main/, "and the branch the host must build");
});

test("the version can be read off the page, without opening a menu", () => {
  // The user's question was "is this the new version or the old one?", and the
  // honest answer is that the page should not make them guess. The landing page
  // has no JavaScript, so its stamp is literal text tied to the worker's cache
  // name here; the app fills its drawer stamp from the same `?v=` the release
  // bump rewrites everywhere else.
  const worker = read("sw.js");
  const cache = (worker.match(/CACHE_NAME = "vignan-vidyanikethan-ai-v(\d+)"/) || [])[1];
  assert.ok(cache, "the worker names its release");

  const landing = read("welcome.html");
  assert.match(landing, new RegExp(`class="wl-foot-release">Release v${cache}<`), "the footer states the release");

  const app = read("index.html");
  assert.match(app, /class="app-release" id="app-release"/, "the drawer has a release row");
  const script = read("js/app.js");
  assert.match(script, /stamp\.textContent = `Release \$\{RELEASE\}`/, "and it is filled from the release, not typed twice");
});
