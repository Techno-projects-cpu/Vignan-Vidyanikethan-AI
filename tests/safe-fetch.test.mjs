import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { fetchPublicResource, isPublicAddress, validatePublicUrl } from "../server/safe-fetch.mjs";

const publicLookup = async () => [{ address: "93.184.216.34", family: 4 }];

function fakeRequester(routes, seen = []) {
  return (url, options, respond) => {
    const request = new EventEmitter();
    request.end = () => {
      options.lookup(url.hostname, { all: false }, (_error, address, family) => {
        seen.push({ url: url.href, address, family, headers: options.headers });
        const entry = routes[url.href];
        if (!entry) { queueMicrotask(() => request.emit("error", new Error("unreachable"))); return; }
        if (entry.hang) return;
        queueMicrotask(() => {
          const response = new PassThrough();
          response.statusCode = entry.status || 200;
          response.headers = entry.headers || {};
          respond(response);
          response.end(Buffer.from(entry.body || ""));
        });
      });
    };
    options.signal.addEventListener("abort", () => request.emit("error", new Error("aborted")), { once: true });
    return request;
  };
}

test("only globally routable IPv4 and IPv6 addresses are accepted", () => {
  for (const address of ["8.8.8.8", "1.1.1.1", "93.184.216.34", "2606:4700:4700::1111", "2001:4860:4860::8888"]) {
    assert.equal(isPublicAddress(address), true, address);
  }
  for (const address of [
    "0.0.0.0", "10.1.2.3", "100.64.0.1", "127.0.0.1", "169.254.169.254", "172.16.0.1", "192.168.1.1",
    "192.0.2.1", "198.18.0.1", "198.51.100.1", "203.0.113.1", "224.0.0.1", "255.255.255.255",
    "::", "::1", "::ffff:127.0.0.1", "::ffff:8.8.8.8", "fe80::1", "fc00::1", "ff02::1", "2001:db8::1", "2001::1", "2002:7f00:1::1", "3fff::1", "not-an-ip",
  ]) assert.equal(isPublicAddress(address), false, address);
});

test("URL validation rejects local targets, odd ports, credentials and signed links", () => {
  for (const url of [
    "file:///etc/passwd", "http://localhost/", "http://test.local/", "http://metadata.google.internal/",
    "http://127.1/", "http://0x7f000001/", "http://[::1]/", "http://[::ffff:7f00:1]/",
    "https://example.com:444/", "https://user:secret@example.com/", "https://example.com/a?access_token=secret",
    "https://example.com/a?X-Amz-Signature=secret",
  ]) assert.throws(() => validatePublicUrl(url), url);
  assert.equal(validatePublicUrl("https://example.com/file.pdf?id=123#page=2").href, "https://example.com/file.pdf?id=123");
  assert.equal(validatePublicUrl("https://example.com:443/").href, "https://example.com/");
});

test("fetch pins the socket to the checked DNS result and forwards no caller credentials", async () => {
  const seen = [];
  const url = "https://example.com/notes.txt";
  const result = await fetchPublicResource(url, {
    lookup: publicLookup,
    requestImpl: fakeRequester({ [url]: { body: "A public textbook excerpt.", headers: { "content-type": "text/plain; charset=utf-8" } } }, seen),
  });
  assert.equal(result.bytes.toString(), "A public textbook excerpt.");
  assert.equal(result.contentType, "text/plain");
  assert.equal(result.finalUrl, url);
  assert.equal(seen[0].address, "93.184.216.34");
  assert.equal(seen[0].headers["Accept-Encoding"], "identity");
  assert.equal(Object.keys(seen[0].headers).some((key) => /cookie|authorization/i.test(key)), false);
});

test("mixed DNS answers and redirects into a private network are rejected", async () => {
  let calls = 0;
  await assert.rejects(fetchPublicResource("https://example.com/", {
    lookup: async () => [{ address: "93.184.216.34", family: 4 }, { address: "127.0.0.1", family: 4 }],
    requestImpl: () => { calls += 1; },
  }), /private|local|reserved/i);
  assert.equal(calls, 0);
  const seen = [];
  await assert.rejects(fetchPublicResource("https://example.com/", {
    lookup: publicLookup,
    requestImpl: fakeRequester({ "https://example.com/": { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data/" } } }, seen),
  }), /private|local|reserved/i);
  assert.equal(seen.length, 1, "the private redirect is never requested");
  const final = await fetchPublicResource("https://example.com/start", {
    lookup: publicLookup,
    requestImpl: fakeRequester({
      "https://example.com/start": { status: 302, headers: { location: "/notes.txt" } },
      "https://example.com/notes.txt": { body: "Safe public text.", headers: { "content-type": "text/plain" } },
    }),
  });
  assert.equal(final.finalUrl, "https://example.com/notes.txt");
  assert.equal(final.bytes.toString(), "Safe public text.");
});

test("size, compression, redirects and total duration are bounded", async () => {
  const url = "https://example.com/";
  await assert.rejects(fetchPublicResource(url, {
    lookup: publicLookup, maxBytes: 8,
    requestImpl: fakeRequester({ [url]: { headers: { "content-length": "9" }, body: "123456789" } }),
  }), /larger/i);
  await assert.rejects(fetchPublicResource(url, {
    lookup: publicLookup, maxBytes: 8,
    requestImpl: fakeRequester({ [url]: { body: "123456789" } }),
  }), /larger/i);
  await assert.rejects(fetchPublicResource(url, {
    lookup: publicLookup, requestImpl: fakeRequester({ [url]: { headers: { "content-encoding": "gzip" }, body: "compressed" } }),
  }), /compressed/i);
  await assert.rejects(fetchPublicResource(url, {
    lookup: publicLookup, requestImpl: fakeRequester({ [url]: { status: 302, headers: { location: "/" } } }),
  }), /redirect/i);
  await assert.rejects(fetchPublicResource(url, {
    lookup: publicLookup, timeoutMs: 15, requestImpl: fakeRequester({ [url]: { hang: true } }),
  }), /too long/i);
});

test("repository roots map to the public README API without rewriting other URLs", async () => {
  const { githubReadmeTarget } = await import("../server/safe-fetch.mjs");
  assert.deepEqual(githubReadmeTarget("https://github.com/nodejs/node.git#readme"), {
    sourceUrl: "https://github.com/nodejs/node", repository: "nodejs/node",
    apiUrl: "https://api.github.com/repos/nodejs/node/readme",
  });
  for (const url of ["https://github.com.evil.example/nodejs/node", "https://example.com/nodejs/node", "https://github.com/nodejs/node/issues", "https://github.com/nodejs/node/blob/main/README.md"]) {
    assert.equal(githubReadmeTarget(url), null);
  }
  assert.throws(() => githubReadmeTarget("https://github.com/nodejs/node?token=private"), /token|credentials/);
});

test("repository reading decodes README rather than GitHub chrome and preserves provenance", async () => {
  const { fetchReadableResource } = await import("../server/safe-fetch.mjs");
  const url = "https://api.github.com/repos/nodejs/node/readme";
  const seen = [];
  const result = await fetchReadableResource("https://github.com/nodejs/node", {
    lookup: publicLookup,
    requestImpl: fakeRequester({ [url]: { body: JSON.stringify({ encoding: "base64", content: Buffer.from("# Node.js\nA JavaScript runtime with public documentation.").toString("base64"), download_url: "http://127.0.0.1/secret" }) } }, seen),
  });
  assert.match(result.bytes.toString(), /# Node.js/);
  assert.match(result.bytes.toString(), /README only/);
  assert.equal(result.finalUrl, "https://github.com/nodejs/node");
  assert.equal(result.contentType, "text/plain");
  assert.equal(seen.length, 1, "never follows the API's download_url");
  assert.equal(seen[0].url, url);
  assert.equal(seen[0].headers.Authorization, undefined, "no sandbox/server GitHub credentials forwarded");
});

test("GitHub errors explain missing README and rate limits rather than pretending to read", async () => {
  const { fetchReadableResource } = await import("../server/safe-fetch.mjs");
  for (const [status, message] of [[404, /public README/], [403, /rate-limiting/], [429, /rate-limiting/]]) {
    await assert.rejects(fetchReadableResource("https://github.com/nodejs/node", {
      lookup: publicLookup,
      requestImpl: fakeRequester({ "https://api.github.com/repos/nodejs/node/readme": { status } }),
    }), message);
  }
});

test("README API output is validated and bounded", async () => {
  const { fetchReadableResource } = await import("../server/safe-fetch.mjs");
  for (const payload of ["not json", JSON.stringify({ encoding: "none", content: "" }), JSON.stringify({ encoding: "base64", content: "%%%=" }), JSON.stringify({ encoding: "base64", content: "AA==" })]) {
    await assert.rejects(fetchReadableResource("https://github.com/nodejs/node", {
      lookup: publicLookup,
      requestImpl: fakeRequester({ "https://api.github.com/repos/nodejs/node/readme": { body: payload } }),
    }), /README|GitHub/);
  }
  await assert.rejects(fetchReadableResource("https://github.com/nodejs/node", {
    maxBytes: 8, lookup: publicLookup,
    requestImpl: fakeRequester({ "https://api.github.com/repos/nodejs/node/readme": { body: "123456789" } }),
  }), /larger/);
});

test("ordinary public websites still use the guarded generic reader", async () => {
  const { fetchReadableResource } = await import("../server/safe-fetch.mjs");
  const result = await fetchReadableResource("https://example.com/lesson", {
    lookup: publicLookup,
    requestImpl: fakeRequester({ "https://example.com/lesson": { headers: { "content-type": "text/html" }, body: "<p>A lesson on plants.</p>" } }),
  });
  assert.equal(result.contentType, "text/html");
  assert.equal(result.finalUrl, "https://example.com/lesson");
});
