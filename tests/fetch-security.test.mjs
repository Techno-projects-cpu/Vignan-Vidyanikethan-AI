import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

async function server(t, extra = {}) {
  const child = spawn(process.execPath, ["serve.mjs"], {
    cwd: root,
    env: { ...process.env, STUDY_AI_HOST: "127.0.0.1", STUDY_AI_PORT: "0", STUDY_AI_ACCOUNTS_BACKEND: "local", STUDY_AI_SEARCH_URL: "", STUDY_AI_WIKIPEDIA_SEARCH: "true", ...extra },
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
  return `http://127.0.0.1:${port}`;
}

test("public link endpoint enforces same-origin, SSRF checks, headers and rate limits", async (t) => {
  const base = await server(t);
  const health = await (await fetch(`${base}/api/health`)).json();
  assert.equal(health.search, true);
  assert.equal(health.searchProvider, "Wikipedia + DuckDuckGo");
  assert.deepEqual(health.searchSources, ["Wikipedia", "DuckDuckGo"]);
  assert.ok(health.languages.includes("ur"));
  assert.equal(health.linkReading, true);
  const post = (url, origin = base) => fetch(`${base}/api/fetch`, {
    method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ url }),
  });
  assert.equal((await post("https://example.org/", "https://evil.invalid")).status, 403);
  assert.equal((await fetch(`${base}/api/fetch`, { method: "POST", headers: { Origin: base, "Content-Type": "text/plain" }, body: "{}" })).status, 415);
  for (const target of ["http://127.0.0.1/", "http://169.254.169.254/latest/meta-data/", "http://[::1]/", "https://example.org:8443/", "https://u:p@example.org/", "file:///etc/passwd", "https://example.org/?access_token=secret"]) {
    const response = await post(target);
    assert.equal(response.status, 400, target);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
  assert.equal((await post("")).status, 400);
  // Eight requests used the per-client allowance above.
  for (let index = 0; index < 7; index += 1) await post("http://localhost/");
  assert.equal((await post("http://localhost/")).status, 429);
});

test("operators may disable the no-key search provider", async (t) => {
  const base = await server(t, { STUDY_AI_WIKIPEDIA_SEARCH: "false" });
  const health = await (await fetch(`${base}/api/health`)).json();
  assert.equal(health.search, false);
  const response = await fetch(`${base}/api/search`, {
    method: "POST", headers: { Origin: base, "Content-Type": "application/json" }, body: JSON.stringify({ query: "photosynthesis" }),
  });
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /disabled/i);
});

test("successful website and GitHub downloads traverse the real HTTP response handler", async (t) => {
  // Stub only external DNS/TLS. The real server route, byte conversion, response
  // headers and status must run: a missing header helper once made *every*
  // otherwise-successful fetch return 502 and escaped browser-only mocks.
  const preload = `
    import dns from 'node:dns/promises';
    import https from 'node:https';
    import { EventEmitter } from 'node:events';
    import { PassThrough } from 'node:stream';
    dns.lookup = async () => [{address:'93.184.216.34',family:4}];
    https.request = (url, options, respond) => {
      const request = new EventEmitter();
      request.end = () => queueMicrotask(() => {
        const response = new PassThrough();
        response.statusCode = 200;
        response.headers = {'content-type': url.hostname === 'api.github.com' ? 'application/json' : 'text/html'};
        respond(response);
        response.end(url.hostname === 'api.github.com'
          ? JSON.stringify({encoding:'base64',content:Buffer.from('# Public repository README\\nA public lesson about plants, light and photosynthesis.').toString('base64')})
          : '<html><title>Plant lesson</title><body><p>Plants use sunlight to make food through photosynthesis.</p></body></html>');
      });
      return request;
    };
  `;
  const base = await server(t, { NODE_OPTIONS: `--import=data:text/javascript,${encodeURIComponent(preload)}` });
  for (const url of ["https://example.com/lesson", "https://github.com/example/demo.js"]) {
    const response = await fetch(`${base}/api/fetch`, {
      method: "POST", headers: { Origin: base, "Content-Type": "application/json" }, body: JSON.stringify({ url }),
    });
    assert.equal(response.status, 200, `${url}: ${response.status}`);
    assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    const { inspectFileBytes } = await import("../js/files.js");
    const bytes = new Uint8Array(await response.arrayBuffer());
    const file = inspectFileBytes(bytes, {
      name: decodeURIComponent(response.headers.get("X-Vignan-File-Name") || "lesson.html"),
      mime: response.headers.get("X-Vignan-Content-Type"),
    });
    assert.match(file.text, /plants|Plants/);
    if (url.includes("github.com")) {
      assert.match(file.text, /README only/);
      assert.equal(response.headers.get("X-Vignan-File-Name"), "repository-README.txt");
    }
  }
});
