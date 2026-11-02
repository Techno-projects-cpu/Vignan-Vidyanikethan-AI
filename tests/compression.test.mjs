/**
 * Response compression.
 *
 * The app ships about 460 kB of text before the service worker is involved. On a
 * phone in a school corridor that is the whole difference between "fast" and
 * "is it broken?", so the server compresses — and, more importantly, these tests
 * prove it does so correctly: the right encoding, the right length, the right
 * Vary header, and never a broken body.
 */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { request } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";
import test from "node:test";

import { MIN_BYTES, compress, createCompressionCache, isCompressible, pickEncoding } from "../server/compress.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));

test("the encoding is negotiated the way browsers ask for it", () => {
  assert.equal(pickEncoding("gzip, deflate, br, zstd"), "br");
  assert.equal(pickEncoding("gzip, deflate"), "gzip");
  assert.equal(pickEncoding(""), "identity");
  assert.equal(pickEncoding(undefined), "identity");
  assert.equal(pickEncoding("identity"), "identity");
  // An explicit refusal is honoured.
  assert.equal(pickEncoding("br;q=0, gzip"), "gzip");
  assert.equal(pickEncoding("gzip;q=0, deflate"), "gzip", "deflate is served as gzip");
  assert.equal(pickEncoding("br;q=0, gzip;q=0"), "identity");
  // Weights decide between two acceptable encodings.
  assert.equal(pickEncoding("br;q=0.4, gzip;q=0.9"), "gzip");
  assert.equal(pickEncoding("*"), "br");
  assert.equal(pickEncoding("nonsense;q=abc"), "identity");
});

test("only text worth compressing is compressed", () => {
  for (const extension of [".html", ".css", ".js", ".json", ".svg", ".txt", ".webmanifest"]) {
    assert.equal(isCompressible(extension, 5000), true, `${extension} compresses`);
  }
  for (const extension of [".woff2", ".png", ".jpg", ".ico", ".pdf", ".gz"]) {
    assert.equal(isCompressible(extension, 5000), false, `${extension} is already packed`);
  }
  assert.equal(isCompressible(".js", MIN_BYTES - 1), false, "tiny files are left alone");
  assert.equal(isCompressible(".js", MIN_BYTES), true);
});

test("both encodings round-trip to the original bytes", () => {
  const source = Buffer.from("const answer = 42; // ".repeat(400));
  assert.deepEqual(zlib.gunzipSync(compress(source, "gzip")), source);
  assert.deepEqual(zlib.brotliDecompressSync(compress(source, "br")), source);
  assert.deepEqual(compress(source, "identity"), source);
  // Both really save something on repetitive code-like text.
  assert.ok(compress(source, "gzip").length < source.length / 4);
  assert.ok(compress(source, "br").length <= compress(source, "gzip").length);
});

test("the cache is keyed by file, release and encoding", () => {
  const cache = createCompressionCache({ limit: 1024 * 1024 });
  const body = Buffer.from("x".repeat(100));
  assert.equal(cache.get("/app.js", 100, "br"), null);
  cache.set("/app.js", 100, "br", body);
  assert.equal(cache.get("/app.js", 100, "br"), body);
  // A new mtime (a deploy) is a different entry, not a stale hit.
  assert.equal(cache.get("/app.js", 200, "br"), null);
  assert.equal(cache.get("/app.js", 100, "gzip"), null);
  assert.equal(cache.size, 1);
  assert.equal(cache.bytes, 100);
  cache.clear();
  assert.equal(cache.size, 0);
  assert.equal(cache.bytes, 0);
});

test("the cache never grows without limit", () => {
  const cache = createCompressionCache({ limit: 250 });
  cache.set("/a.js", 1, "br", Buffer.alloc(100));
  cache.set("/b.js", 1, "br", Buffer.alloc(100));
  assert.equal(cache.size, 2);
  cache.set("/c.js", 1, "br", Buffer.alloc(100));
  assert.equal(cache.size, 2, "the oldest entry is dropped");
  assert.equal(cache.bytes, 200);
  // A single file larger than the whole cache is simply not stored.
  cache.set("/huge.js", 1, "br", Buffer.alloc(400));
  assert.equal(cache.get("/huge.js", 1, "br"), null);
});

/* --------------------------------------------------------------- live server */

const startServer = async (t) => {
  const child = spawn(process.execPath, ["serve.mjs"], {
    cwd: root,
    env: {
      ...process.env,
      STUDY_AI_HOST: "127.0.0.1",
      STUDY_AI_PORT: "0",
      STUDY_AI_ACCOUNTS_BACKEND: "unavailable",
      STUDY_AI_ALLOWED_ORIGINS: "",
      STUDY_AI_SEARCH_URL: "",
      STUDY_AI_WIKIPEDIA_SEARCH: "false",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stderr.on("data", (chunk) => { output += chunk; });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
      await Promise.race([once(child, "exit"), new Promise((resolve) => setTimeout(resolve, 2000))]);
    }
  });
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Server did not start: ${output}`)), 8000);
    child.stdout.on("data", (chunk) => {
      output += chunk;
      const match = output.match(/running at http:\/\/127\.0\.0\.1:(\d+)\//);
      if (match) { clearTimeout(timer); resolve(Number(match[1])); }
    });
    child.once("exit", (code) => { clearTimeout(timer); reject(new Error(`Server exited ${code}: ${output}`)); });
  });
  return { base: `http://127.0.0.1:${port}` };
};

/** Raw HTTP, so Node's fetch cannot quietly decode the body for us. */
const rawGet = (url, headers = {}) =>
  new Promise((resolve, reject) => {
    const req = request(url, { headers }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on("error", reject);
    req.end();
  });

test("a text asset arrives compressed, smaller, and byte-identical once decoded", async (t) => {
  const { base } = await startServer(t);
  const plain = await rawGet(`${base}/js/app.js`, { "Accept-Encoding": "identity" });
  const brotli = await rawGet(`${base}/js/app.js`, { "Accept-Encoding": "br" });
  const gzip = await rawGet(`${base}/js/app.js`, { "Accept-Encoding": "gzip" });

  assert.equal(plain.status, 200);
  assert.equal(plain.headers["content-encoding"], undefined);

  assert.equal(brotli.headers["content-encoding"], "br");
  assert.equal(gzip.headers["content-encoding"], "gzip");
  assert.equal(brotli.headers.vary, "Accept-Encoding", "caches must key on the encoding");

  // Smaller on the wire, and the same file once decoded.
  assert.ok(brotli.body.length < plain.body.length / 2, `${brotli.body.length} vs ${plain.body.length}`);
  assert.deepEqual(zlib.brotliDecompressSync(brotli.body), plain.body);
  assert.deepEqual(zlib.gunzipSync(gzip.body), plain.body);

  // The declared length matches what was actually sent.
  assert.equal(Number(brotli.headers["content-length"]), brotli.body.length);
  const onDisk = readFileSync(path.join(root, "js", "app.js"));
  assert.deepEqual(plain.body, onDisk);
});

test("a page that has no meaningful body is left alone", async (t) => {
  const { base } = await startServer(t);
  const favicon = await rawGet(`${base}/favicon.ico`, { "Accept-Encoding": "br, gzip" });
  if (favicon.status === 200) {
    assert.equal(favicon.headers["content-encoding"], undefined, "binary files are not re-compressed");
  }
  const html = await rawGet(`${base}/`, { "Accept-Encoding": "br" });
  assert.equal(html.status, 200);
  assert.equal(html.headers["content-encoding"], "br", "the page itself is compressed");
  assert.ok(html.body.length < 40000, `index.html over the wire: ${html.body.length} bytes`);
});

test("the security headers survive compression", async (t) => {
  const { base } = await startServer(t);
  const page = await rawGet(`${base}/`, { "Accept-Encoding": "br" });
  assert.ok(page.headers["content-security-policy"], "CSP is still sent");
  assert.equal(page.headers["x-content-type-options"], "nosniff");
  assert.equal(page.headers["content-type"], "text/html; charset=utf-8");
});

test("the server refuses nothing it used to serve", async (t) => {
  const { base } = await startServer(t);
  for (const route of ["/", "/judge.html", "/privacy.html", "/styles-next.css?v=1", "/js/viewport.js?v=1"]) {
    const response = await rawGet(`${base}${route}`, { "Accept-Encoding": "br, gzip" });
    assert.equal(response.status, 200, route);
    assert.ok(response.body.length > 0, `${route} has a body`);
  }
  // The blocked directories are still blocked, compressed or not.
  for (const route of ["/serve.mjs", "/tests/", "/.git/config"]) {
    const response = await rawGet(`${base}${route}`, { "Accept-Encoding": "br" });
    assert.ok([403, 404].includes(response.status), `${route} is not served (${response.status})`);
  }
});
