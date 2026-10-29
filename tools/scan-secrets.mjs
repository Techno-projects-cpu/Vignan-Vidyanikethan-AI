#!/usr/bin/env node
/**
 * Secret scanner for Vignan Vidyanikethan AI.
 *
 * The school runs on free tiers with the student's own keys, and a key that
 * reaches Git is a key that must be considered burned: this repository is
 * public. This script reads every tracked file and reports anything that has
 * the shape of a live credential, so a mistake is caught before a push rather
 * than after a bill.
 *
 *   node tools/scan-secrets.mjs           # tracked files
 *   node tools/scan-secrets.mjs --all     # also untracked, non-ignored files
 *   node tools/scan-secrets.mjs --staged  # only what `git add` has staged
 *
 * Exit code 1 means a finding. Documentation placeholders and the test suite's
 * deliberate dummy strings are allowed; see ALLOW below.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);

/**
 * Each pattern is a real credential format, not a guess. `why` is printed with
 * the finding so the fix is obvious to a student who has never rotated a key.
 */
const PATTERNS = [
  { name: "Supabase secret key", regex: /\bsb_secret_[A-Za-z0-9_-]{15,}/g, why: "Bypasses row-level security. Revoke it in Supabase → Settings → API Keys, then paste a new one only into Render → Environment." },
  { name: "Supabase publishable key", regex: /\bsb_publishable_[A-Za-z0-9_-]{15,}/g, why: "Public by design, but committing it ties this repository to one project. Keep it in Render → Environment instead." },
  { name: "Supabase / Firebase JWT", regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, why: "A signed token. If its payload says service_role, it is a master key; revoke and reissue either way." },
  { name: "Google AI Studio key", regex: /\bAIza[0-9A-Za-z_-]{30,}/g, why: "Delete it in Google AI Studio, create a new one, and paste it into Render only." },
  { name: "OpenAI-style key", regex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}/g, why: "Revoke it in the provider dashboard and issue a replacement." },
  { name: "GitHub token", regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}|\bgithub_pat_[A-Za-z0-9_]{30,}/g, why: "Revoke it in GitHub → Settings → Developer settings → Tokens." },
  { name: "Slack token", regex: /\bxox[abprs]-[A-Za-z0-9-]{20,}/g, why: "Revoke it in the Slack app configuration." },
  { name: "Private key block", regex: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g, why: "A private key must never be in a repository. Replace it and purge the file." },
  { name: "Cloudflare token", regex: /\bv1\.0-[A-Za-z0-9_-]{40,}/g, why: "Roll the token in the Cloudflare dashboard." },
  { name: "AWS access key", regex: /\bAKIA[0-9A-Z]{16}\b/g, why: "Deactivate the key in IAM and issue a new one." },
];

/** Files where a pattern is documentation rather than a secret. */
const SKIP_FILES = new Set([".env.example", "SECURITY.md", "DEPLOY.md", "README.md", "OPEN_SOURCE_CREDITS.md", "LICENSE"]);

/** Text that looks like a key but is a placeholder or a test fixture. */
const ALLOW = [
  /sb_secret_YOUR/i,
  /sb_publishable_YOUR/i,
  /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.example/i,
  /\beyJ[A-Za-z0-9_-]{10,}\.EXAMPLE\./,
  /AIzaSy\.\.\./,
  /x{8,}/i,
  /<[a-z-]+>/i,      // <your-key> style placeholders
  /\$\{/,
];

function isAllowed(match) {
  return ALLOW.some((pattern) => pattern.test(match));
}

function listFiles(mode) {
  const args = mode === "all"
    ? ["ls-files", "--cached", "--others", "--exclude-standard"]
    : mode === "staged"
      ? ["diff", "--cached", "--name-only", "--diff-filter=ACMR"]
      : ["ls-files"];
  const output = execFileSync("git", args, { cwd: ROOT, encoding: "utf8" });
  return [...new Set(output.split("\n").map((line) => line.trim()).filter(Boolean))]
    .filter((file) => !SKIP_FILES.has(path.basename(file)))
    .filter((file) => !/^(?:node_modules|vendor)\//.test(file))
    .filter((file) => !/\.(?:png|jpe?g|gif|webp|ico|woff2?|ttf|otf|mp4|webm|zip|pdf)$/i.test(file));
}

function scan(file) {
  let text;
  try {
    text = readFileSync(path.join(ROOT, file), "utf8");
  } catch {
    return [];
  }
  if (text.length > 2_000_000) return []; // binaries and bundles are filtered above; never stall
  const findings = [];
  for (const pattern of PATTERNS) {
    pattern.regex.lastIndex = 0;
    for (const match of text.matchAll(pattern.regex)) {
      if (isAllowed(match[0])) continue;
      const before = text.slice(0, match.index);
      const line = before.split("\n").length;
      findings.push({
        file,
        line,
        kind: pattern.name,
        // Never print the secret itself: a report is often pasted into a chat or an issue.
        preview: `${match[0].slice(0, 8)}…${match[0].slice(-4)} (${match[0].length} chars)`,
        why: pattern.why,
      });
    }
  }
  return findings;
}

const mode = process.argv.includes("--staged") ? "staged" : process.argv.includes("--all") ? "all" : "tracked";
const files = listFiles(mode);
const findings = files.flatMap(scan);

if (findings.length === 0) {
  console.log(`No credentials found in ${files.length} ${mode} files.`);
  process.exit(0);
}

console.error(`Found ${findings.length} possible credential${findings.length === 1 ? "" : "s"}:\n`);
for (const finding of findings) {
  console.error(`  ${finding.file}:${finding.line}`);
  console.error(`    ${finding.kind}  ${finding.preview}`);
  console.error(`    ${finding.why}\n`);
}
console.error("Remove the value, rotate it with the provider, and check `git log` for earlier commits.");
process.exit(1);
