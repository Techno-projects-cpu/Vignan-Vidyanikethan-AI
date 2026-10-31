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
