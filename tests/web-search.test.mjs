import test from "node:test";
import assert from "node:assert/strict";
import { parseWikipediaResults, searchWikipedia, wikipediaSearchUrl } from "../server/web-search.mjs";

const payload = {
  query: { pages: [
    { title: "Second article", index: 2, extract: "Second article is an example of a public encyclopedic page with readable text.", fullurl: "http://attacker.invalid/" },
    { title: "Quantum mechanics", index: 1, extract: "Quantum mechanics describes physics. ".repeat(25) },
    { title: "Missing", missing: true },
  ] },
};

test("Wikipedia search is fixed-host, keyless, ranked, and returns bounded plain snippets", async () => {
  const url = new URL(wikipediaSearchUrl("quantum mechanics"));
  assert.equal(url.origin, "https://en.wikipedia.org");
  assert.equal(url.searchParams.get("gsrsearch"), "quantum mechanics");
  assert.equal(url.searchParams.get("explaintext"), "1");
  const results = parseWikipediaResults(payload);
  assert.equal(results.length, 2);
  assert.equal(results[0].title, "Quantum mechanics");
  assert.equal(results[1].url, "https://en.wikipedia.org/wiki/Second_article");
  assert.ok(results[0].snippet.length > 220, "excerpts are not reduced to tiny search snippets");
  let options;
  const loaded = await searchWikipedia("quantum mechanics", { fetchImpl: async (target, init) => {
    assert.match(target, /^https:\/\/en\.wikipedia\.org\/w\/api\.php\?/);
    options = init;
    return new Response(JSON.stringify(payload), { headers: { "content-type": "application/json" } });
  } });
  assert.equal(loaded[0].title, "Quantum mechanics");
  assert.match(options.headers["User-Agent"], /VignanVidyanikethanAI/);
  assert.match(options.headers["User-Agent"], /github\.com/);
  assert.equal(options.redirect, "error");
  assert.ok(options.signal);
});

test("Wikipedia failures and oversized responses are rejected rather than fabricated", async () => {
  await assert.rejects(searchWikipedia("test", { fetchImpl: async () => new Response("busy", { status: 429 }) }), /429/);
  await assert.rejects(searchWikipedia("test", { fetchImpl: async () => new Response("{}", { headers: { "content-length": "2000000" } }) }), /too large/i);
  await assert.rejects(searchWikipedia("test", { fetchImpl: async () => new Response(JSON.stringify({ error: { code: "denied" } })) }), /unavailable/i);
  assert.deepEqual(parseWikipediaResults({ query: {} }), []);
});
