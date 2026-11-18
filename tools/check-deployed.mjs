#!/usr/bin/env node
/**
 * Is the live site the site in this repository?
 *
 *   npm run deployed
 *   npm run deployed -- https://vignan-vidyanikethan-ai-1.onrender.com
 *
 * With no argument it checks the address in index.html's canonical link.
 *
 * This exists because of a specific, expensive afternoon: a host was pointed at
 * a pull-request branch, that branch stopped moving when the pull request was
 * merged, and every later release went to `main` and nowhere else. The build
 * log was green, the requests all answered 200, and the site was three releases
 * old. Nothing in the code was wrong — so nothing in the tests could catch it.
 *
 * The check is deliberately blunt: read the version this checkout would deploy,
 * ask the live host what it is running, and say plainly which side is behind.
 * If the host reports a commit (Render does), name it.
 *
 * Exit code 0 when they agree, 1 when they do not, 2 when the host cannot be
 * reached at all. It is safe to run anywhere: it sends one GET and prints no
 * secrets.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalOrigin } from "../tests/canonical.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// The address the site claims for itself, read from index.html. Restating it
// here is how the checker ends up questioning a host nobody publishes to.
const DEFAULT_HOST = canonicalOrigin(REPO);

/** The version and cache name this checkout would deploy, read from the files. */
export function localRelease(root = REPO) {
  const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  const worker = readFileSync(path.join(root, "sw.js"), "utf8");
  const cache = (worker.match(/CACHE_NAME = "vignan-vidyanikethan-ai-v(\d+)"/) || [])[1] || "";
  return { version: pkg.version, cache: cache ? `v${cache}` : "" };
}

/**
 * Compare what the host says with what this checkout has.
 *
 * Kept pure so it can be tested without a network: the caller does the fetching.
 */
export function compareRelease(live, local) {
  const liveVersion = String(live?.version || "");
  const liveCache = String(live?.cache || "");
  const sameVersion = liveVersion === local.version;
  const sameCache = !liveCache || !local.cache || liveCache === local.cache;
  const behind = sameVersion ? "" : describeGap(liveVersion, local.version);
  return {
    ok: sameVersion && sameCache,
    liveVersion,
    localVersion: local.version,
    liveCache,
    localCache: local.cache,
    behind,
    commit: live?.build?.commit || null,
    branch: live?.build?.branch || null,
  };
}

/** `2.25.1` vs `2.26.0` → "one minor release behind"; equal → "". */
export function describeGap(liveVersion, localVersion) {
  const parse = (value) => String(value || "").split(".").map((part) => Number.parseInt(part, 10) || 0);
  const [liveMajor, liveMinor, livePatch] = parse(liveVersion);
  const [major, minor, patch] = parse(localVersion);
  if (!liveVersion) return "the host reports no version at all";
  if (liveMajor !== major) return `${major - liveMajor} major release(s) behind`;
  if (liveMinor !== minor) return `${minor - liveMinor} minor release(s) behind`;
  if (livePatch !== patch) return `${patch - livePatch} patch release(s) behind`;
  return "the versions match";
}

/** The report a person reads. */
export function formatReport(result, host) {
  const lines = [];
  lines.push(`host      ${host}`);
  lines.push(`live      ${result.liveVersion || "(none)"}${result.liveCache ? `  ${result.liveCache}` : ""}`);
  lines.push(`this repo ${result.localVersion}${result.localCache ? `  ${result.localCache}` : ""}`);
  if (result.branch || result.commit) {
    lines.push(`built     ${result.branch || "unknown branch"} @ ${result.commit ? result.commit.slice(0, 7) : "unknown commit"}`);
  }
  if (result.ok) {
    lines.push("", "The live site is this repository.");
    return lines.join("\n");
  }
  lines.push("", `The live site is NOT this repository — ${result.behind}.`);
  lines.push(
    "",
    "The code is fine; the deploy is building something else. In the host's dashboard:",
    "  Render → the service → Settings → Build & Deploy → Branch → main, then Manual Deploy.",
    "If the host reports the branch and commit above, that is the branch it built.",
  );
  return lines.join("\n");
}

async function main() {
  const host = (process.argv[2] || process.env.DEPLOY_HOST || DEFAULT_HOST).replace(/\/$/, "");
  let payload;
  try {
    const response = await fetch(`${host}/api/health`, { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    payload = await response.json();
  } catch (error) {
    console.error(`Could not reach ${host}/api/health — ${error.message}`);
    console.error("(A free Render service sleeps; the first request can take a minute. Try again.)");
    process.exit(2);
  }
  const local = localRelease();
  const result = compareRelease({ version: payload.version, cache: "", build: payload.build }, local);
  console.log(formatReport(result, host));
  process.exit(result.ok ? 0 : 1);
}

if (process.argv[1] && process.argv[1].endsWith("check-deployed.mjs")) {
  main();
}
