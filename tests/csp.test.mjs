// The Content-Security-Policy is a promise made in a header, so it can only be
// checked by reading the header. Until 2.32.0 `connect-src` was `https: http:
// wss: ws:` — every address on the internet — which meant a script that got into
// the page could post anything it could read to anyone it liked. These tests pin
// the policy down: the wide instruction stays gone, our own inline scripts still
// run because their hashes are listed, and no inline script in the repository is
// quietly missing from that list.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const serveSource = readFileSync(new URL("../serve.mjs", import.meta.url), "utf8");

/** Every inline <script> in the repository's own HTML, hashed the way a browser does. */
function inlineHashes() {
  const hashes = new Set();
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "vendor") continue;
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith(".html")) {
        const html = readFileSync(full, "utf8");
        for (const [, attributes, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
          if (/\bsrc\s*=/.test(attributes) || !body.trim()) continue;
          hashes.add(createHash("sha256").update(body, "utf8").digest("base64"));
        }
      }
    }
  };
  walk(ROOT);
  return hashes;
}

/** Boot the server on a spare port and read one response's headers. */
async function headersFor(pathname, port) {
  const child = spawn(process.execPath, ["serve.mjs"], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), NODE_ENV: "test" },
    stdio: "ignore",
  });
  try {
    for (let attempt = 0; attempt < 80; attempt += 1) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}${pathname}`, { redirect: "manual" });
        return { status: response.status, headers: response.headers };
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    throw new Error("server did not start");
  } finally {
    child.kill("SIGKILL");
  }
}

const port = 4300 + Math.floor(Math.random() * 400);
const page = await headersFor("/", port);
const policy = page.headers.get("content-security-policy") || "";
const directives = new Map(
  policy
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [name, ...values] = part.split(/\s+/);
      return [name, values];
    }),
);

test("no directive opens the page to the whole internet", () => {
  assert.ok(policy, "a policy is actually sent");
  for (const [name, values] of directives) {
    // `https:` on its own is the scheme-wide wildcard. A host such as
    // `https://api.openai.com` is fine; bare `https:` is not.
    for (const wildcard of ["https:", "http:", "wss:", "ws:", "*", "data:", "blob:"]) {
      if (!values.includes(wildcard)) continue;
      assert.ok(
        ["img-src", "font-src", "media-src", "worker-src", "frame-src"].includes(name),
        `${name} may not allow ${wildcard}`,
      );
    }
  }
  assert.ok(!directives.get("script-src").includes("'unsafe-inline'"), "inline script needs a hash, not a blanket");
  assert.ok(!directives.get("script-src").includes("'unsafe-eval'"), "no eval");
  assert.equal(directives.get("object-src")[0], "'none'");
  assert.deepEqual(directives.get("base-uri"), ["'self'"]);
  assert.deepEqual(directives.get("frame-ancestors"), undefined, "framing stays open for the live preview");
});

test("the connect list is exactly the app's real traffic", () => {
  const connect = directives.get("connect-src");
  assert.deepEqual(connect[0], "'self'", "the app talks to its own origin first");
  // Only the endpoints the app actually calls. The same file also links to the
  // providers' dashboards, and a documentation link is not a request.
  const providers = readFileSync(new URL("../js/providers.js", import.meta.url), "utf8");
  const endpoints = [...providers.matchAll(/endpoint:\s*"(https:\/\/[a-z0-9.-]+)/g)].map((match) => match[1]);
  assert.ok(endpoints.length >= 6, `expected the provider endpoints, found ${endpoints.length}`);
  for (const host of endpoints.map((value) => [value])) {
    assert.ok(
      connect.some((allowed) => host[0] === allowed || host[0].startsWith(`${allowed}/`)),
      `${host[0]} is used by js/providers.js but missing from connect-src`,
    );
  }
  assert.ok(connect.includes("https://en.wikipedia.org"), "the search fallback is allowed");
  assert.ok(connect.every((source) => source !== "https:"), "no blanket https");
  // A random unrelated host is not in the list; that is the point of the list.
  assert.ok(!connect.some((source) => source.includes("example.com")));
});

test("every inline script in the repository is hashed into the policy", () => {
  const hashes = inlineHashes();
  assert.ok(hashes.size >= 8, `expected the app's inline scripts, found ${hashes.size}`);
  const allowed = (directives.get("script-src") || []).filter((value) => value.startsWith("'sha256-"));
  for (const hash of hashes) {
    assert.ok(allowed.includes(`'sha256-${hash}'`), `inline script ${hash} would be refused`);
  }
  assert.equal(allowed.length, hashes.size, "and nothing else is allowed to run");
});

test("the hash list is computed, not typed", () => {
  // A hand-written list silently rots the first time somebody edits a boot script;
  // a computed one cannot. The source must read the HTML, not carry base64.
  assert.match(serveSource, /function inlineScriptHashes/);
  assert.match(serveSource, /createHash\("sha256"\)\.update\(body/);
  assert.doesNotMatch(serveSource, /'sha256-[A-Za-z0-9+/=]{20,}'/, "no hard-coded hashes");
});

test("the same policy is on every route that returns a document", async () => {
  for (const pathname of ["/welcome.html", "/privacy.html", "/blog/index.html"]) {
    const { headers } = await headersFor(pathname, port + 1);
    assert.equal(headers.get("content-security-policy"), policy, `${pathname} gets the policy`);
    assert.equal(headers.get("x-content-type-options"), "nosniff");
    // The app deliberately allows an origin on same-origin navigations so the
    // share links and the preview keep working; what must never happen is a full
    // referrer leaving the site with a path on it.
    assert.match(headers.get("referrer-policy") || "", /^(no-referrer|strict-origin-when-cross-origin|same-origin)$/);
    assert.match(headers.get("cross-origin-opener-policy") || "", /same-origin/);
    assert.match(headers.get("cross-origin-resource-policy") || "", /same-origin/);
    assert.match(headers.get("permissions-policy") || "", /camera=\(\)/);
  }
});

test("the policy is documented where an operator will look", () => {
  const threat = readFileSync(new URL("../docs/THREAT-MODEL.md", import.meta.url), "utf8");
  assert.match(threat, /Content-Security-Policy/);
  assert.match(threat, /frame-ancestors/, "the open framing is a decision, and it says so");
  assert.match(threat, /sha256/, "and it explains where the script hashes come from");
});
