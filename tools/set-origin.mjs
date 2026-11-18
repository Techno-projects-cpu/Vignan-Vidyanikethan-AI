#!/usr/bin/env node
/**
 * Point every absolute URL in the repository at one host.
 *
 *   npm run set-origin https://vignan-vidyanikethan-ai-1.onrender.com
 *   npm run set-origin -- https://example.org --dry-run
 *
 * Why this exists: on 2026-11-17 the project moved from one Render service to
 * another. The code deployed fine, but 126 absolute URLs across 27 files —
 * canonical tags, `og:url`, `og:image`, the sitemap, the RSS feed, `robots.txt`,
 * `security.txt`, the JSON-LD blocks, the README and the deploy checker — still
 * named the retired host, so search engines and link previews were being sent
 * to the old address. Rewriting that by hand is how a repository ends up with
 * two of everything.
 *
 * The rewrite is deliberately narrow: only `https://vignan*.onrender.com`.
 * Documentation placeholders such as `<your-service>.onrender.com` and
 * `YOUR-SERVICE.onrender.com` are left alone, because they are instructions
 * for a reader, not an address.
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalOrigin } from "../tests/canonical.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Files that carry an absolute address, or record one. Kept explicit so the
// tool can never wander into a vendored bundle and rewrite somebody else's URL.
const EXTS = new Set([".html", ".xml", ".txt", ".md", ".mjs", ".json", ".webmanifest"]);
const SKIP_DIRS = new Set([".git", "node_modules", "server", "supabase", "vendor", ".cache", "__pycache__"]);

const PROJECT_HOST = /https:\/\/vignan[a-z0-9-]*\.onrender\.com/gi;

export function parseArgs(argv) {
  const args = argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const target = args.find((arg) => !arg.startsWith("--")) || "";
  return { target: target.replace(/\/+$/, ""), dryRun };
}

/** A bare `https://host`: refused if it has a path, a query or a port. */
export function validOrigin(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return "";
  }
  if (url.protocol !== "https:") return "";
  if (url.pathname !== "/" || url.search || url.hash) return "";
  return url.origin;
}

async function walk(directory, prefix = "", out = []) {
  const { readdir } = await import("node:fs/promises");
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && entry.name !== ".well-known") continue;
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await walk(path.join(directory, entry.name), relative, out);
    } else if (entry.isFile() && EXTS.has(path.extname(entry.name).toLowerCase())) {
      out.push(relative);
    }
  }
  return out;
}

/**
 * The pure part: rewrite every project URL in one file's text.
 * Returns the new text and how many URLs changed.
 */
export function rewrite(text, target) {
  let count = 0;
  const next = text.replace(PROJECT_HOST, (found) => {
    // A file that already names the target is not a file that changed — the
    // usage example inside this tool would otherwise report itself forever.
    if (found === target) return found;
    count += 1;
    return target;
  });
  return { text: next, count };
}

async function main() {
  const { target: raw, dryRun } = parseArgs(process.argv);
  if (!raw) {
    console.error("usage: npm run set-origin -- https://your-site.onrender.com [--dry-run]");
    console.error(`       currently: ${canonicalOrigin(REPO)}`);
    process.exitCode = 2;
    return;
  }
  const target = validOrigin(raw);
  if (!target) {
    console.error(`"${raw}" is not a bare https address. Expected something like https://name.onrender.com`);
    process.exitCode = 2;
    return;
  }

  const files = await walk(REPO);
  const changed = [];
  let total = 0;
  for (const file of files) {
    const absolute = path.join(REPO, file);
    const before = readFileSync(absolute, "utf8");
    const { text, count } = rewrite(before, target);
    if (!count) continue;
    total += count;
    changed.push({ file, count });
    if (!dryRun) writeFileSync(absolute, text);
  }

  if (!changed.length) {
    console.log(`Nothing to do — every absolute address already names ${target}.`);
    return;
  }
  console.log(`${dryRun ? "Would rewrite" : "Rewrote"} ${total} URL${total === 1 ? "" : "s"} in ${changed.length} file${changed.length === 1 ? "" : "s"} to ${target}:`);
  for (const { file, count } of changed.sort((a, b) => b.count - a.count)) {
    console.log(`  ${String(count).padStart(3)}  ${file}`);
  }
  if (dryRun) console.log("\nDry run: nothing was written.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
