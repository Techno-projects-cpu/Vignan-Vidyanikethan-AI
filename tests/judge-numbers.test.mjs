/**
 * The judge page makes claims a judge can re-run. Two of them are numbers, and a
 * stale number on that page is worse than no number: 2.13.0 still advertised
 * "Release v33" and "372 files" two releases after the fact, because the sample
 * output had been pasted by hand.
 *
 * This test runs the real offline simulator and compares its output with what the
 * page tells a judge.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const judge = readFileSync(new URL("../judge.html", import.meta.url), "utf8");
const worker = readFileSync(new URL("../sw.js", import.meta.url), "utf8");

test("the cached file count on the judge page is the real count", () => {
  const output = execFileSync("node", ["tools/offline-sim.mjs"], { cwd: root, encoding: "utf8" });
  const cached = output.match(/Cached after install: (\d+) files in (\S+)/);
  assert.ok(cached, "the simulator reports how many files it cached");
  const [, count, cacheName] = cached;
  assert.match(judge, new RegExp(`<strong>${count}</strong><span>files precached</span>`), `the page says ${count} files`);
  assert.ok(judge.includes(`Cached after install: ${count} files in ${cacheName}`), `the page shows the simulator's own line (${count} in ${cacheName})`);
});

test("the release on the judge page is the release in the worker", () => {
  const release = worker.match(/vignan-vidyanikethan-ai-v(\d+)/)?.[1];
  assert.ok(release, "the worker names its cache version");
  assert.ok(judge.includes(`Release v${release}`), `the page shows Release v${release}`);
  assert.ok(judge.includes(`vignan-vidyanikethan-ai-v${release}`), `the page names the cache of this release`);
});

test("the test count on the judge page is the count the suite runs", () => {
  const declared = Number(judge.match(/<strong>(\d+)<\/strong><span>automated tests<\/span>/)?.[1]);
  assert.ok(Number.isFinite(declared) && declared > 0, "the page states a test count");
  // The suite is this file included, so the claim is checked at one remove: every
  // other mention of a test count on the page has to agree with the headline.
  const mentions = [...judge.matchAll(/(\d+) (?:automated )?tests/g)].map((match) => Number(match[1]));
  assert.ok(mentions.length >= 1);
  for (const mention of mentions) assert.equal(mention, declared, `every test count on the page says ${declared}`);
});
