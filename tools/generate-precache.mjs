#!/usr/bin/env node
/** Regenerate precache.json for the root-level Vignan Vidyanikethan AI PWA. */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(REPO, "precache.json");
const EXCLUDED_DIRS = new Set([".git", "node_modules", "server", "supabase", "tools", "tests", "__pycache__", ".cache"]);
const EXCLUDED_FILES = new Set([
  "precache.json", ".env", ".env.local", ".env.example", ".gitignore",
  "render.yaml", "package.json", "package-lock.json", "LICENSE", "README.md", "serve.mjs",
]);
const EXCLUDED_EXT = new Set([".log", ".mjs", ".py", ".sql", ".ts", ".yaml", ".yml", ".toml", ".md"]);

async function walk(directory, prefix = "") {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      files.push(...(await walk(path.join(directory, entry.name), relative)));
    } else if (entry.isFile()) {
      if (EXCLUDED_FILES.has(entry.name)) continue;
      if (entry.name.startsWith(".")) continue;
      if (EXCLUDED_EXT.has(path.extname(entry.name).toLowerCase()) && !relative.startsWith("vendor/pdfjs/")) continue;
      files.push(`./${relative}`);
    }
  }
  return files;
}

const files = (await walk(REPO)).sort();
const urls = [...new Set(["./", "./index.html", ...files])];
await fs.writeFile(OUT, `${JSON.stringify({ version: 31, generatedAt: new Date().toISOString(), urls }, null, 2)}\n`);
console.log(`Wrote ${urls.length} URLs to ${path.relative(REPO, OUT)}`);
