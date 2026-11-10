import test from "node:test";
import assert from "node:assert/strict";
import {
  duckDuckGoUrl,
  mergeSearchResults,
  parseDuckDuckGo,
  parseWikipediaResults,
  searchOutside,
  searchWikipedia,
  wikipediaSearchUrl,
} from "../server/web-search.mjs";

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

test("DuckDuckGo abstracts, nested related topics and duplicates are handled safely", async () => {
  const payload = {
    Heading: "Photosynthesis",
    AbstractText: "Photosynthesis is the process by which plants convert light energy into chemical energy.",
    AbstractURL: "https://en.wikipedia.org/wiki/Photosynthesis",
    RelatedTopics: [
      { Text: "Chlorophyll - the green pigment", FirstURL: "https://en.wikipedia.org/wiki/Chlorophyll" },
      { Topics: [{ Text: "Leaf - plant organ", FirstURL: "https://en.wikipedia.org/wiki/Leaf" }, { Text: "", FirstURL: "" }] },
      { Text: "Unsafe", FirstURL: "javascript:alert(1)" },
    ],
  };
  const results = parseDuckDuckGo(payload);
  assert.equal(results.length, 3);
  assert.equal(results[0].domain, "en.wikipedia.org");
  assert.ok(results.every((result) => result.url.startsWith("https://")));
  assert.equal(parseDuckDuckGo({}).length, 0);
  assert.match(duckDuckGoUrl("a b"), /q=a(%20|\+)b/);
  assert.match(duckDuckGoUrl("x"), /format=json/);
  assert.equal(new URL(duckDuckGoUrl("x")).hostname, "api.duckduckgo.com");
});

test("provider results merge without duplicates and keep the best order", () => {
  const merged = mergeSearchResults([
    [{ url: "https://a.example/1", title: "A" }, { url: "https://b.example/2", title: "B" }],
    [{ url: "https://b.example/2#part", title: "B again" }, { url: "https://c.example/3", title: "C" }],
  ], 6);
  assert.deepEqual(merged.map((result) => result.title), ["A", "B", "C"]);
  assert.equal(mergeSearchResults([[], null, undefined]).length, 0);
  assert.equal(mergeSearchResults([[{ url: "https://a.example/1", title: "A" }, { url: "https://b.example/2", title: "B" }]], 1).length, 1);
});

test("outside search asks several keyless providers and survives one of them failing", async () => {
  const wiki = { query: { pages: [{ title: "Photosynthesis", index: 1, extract: "Plants make food from light, water and carbon dioxide." }] } };
  const ddg = { Heading: "Photosynthesis", AbstractText: "Photosynthesis turns light into chemical energy in plants.", AbstractURL: "https://en.wikipedia.org/wiki/Photosynthesis_extra" };
  const seen = [];
  const combined = await searchOutside("photosynthesis", {
    fetchImpl: async (target) => {
      seen.push(String(target));
      if (String(target).includes("duckduckgo")) return new Response(JSON.stringify(ddg), { headers: { "content-type": "application/json" } });
      return new Response(JSON.stringify(wiki), { headers: { "content-type": "application/json" } });
    },
  });
  assert.ok(seen.some((url) => url.includes("wikipedia.org")));
  assert.ok(seen.some((url) => url.includes("duckduckgo")));
  assert.ok(combined.results.length >= 2);
  assert.ok(combined.providers.includes("Wikipedia"));
  assert.ok(combined.providers.includes("DuckDuckGo"));

  const partial = await searchOutside("photosynthesis", {
    fetchImpl: async (target) => {
      if (String(target).includes("duckduckgo")) return new Response("down", { status: 502 });
      return new Response(JSON.stringify(wiki), { headers: { "content-type": "application/json" } });
    },
  });
  assert.equal(partial.results.length, 1);
  assert.ok(partial.errors.some((error) => /DuckDuckGo/.test(error)));

  const failed = await searchOutside("photosynthesis", { fetchImpl: async () => new Response("no", { status: 500 }) });
  assert.equal(failed.results.length, 0);
  assert.ok(failed.errors.length >= 2);
  assert.deepEqual((await searchOutside("   ")).results, []);
});

test("non-English questions also try the matching Wikipedia edition", async () => {
  const hosts = [];
  await searchOutside("विद्यालय", {
    language: "hi",
    fetchImpl: async (target) => {
      hosts.push(new URL(String(target)).hostname);
      if (String(target).includes("duckduckgo")) return new Response("{}", { headers: { "content-type": "application/json" } });
      return new Response(JSON.stringify({ query: { pages: [{ title: "परीक्षण", index: 1, extract: "परीक्षण पाठ जो पर्याप्त लंबा है ताकि परिणाम मान्य हो सके।" }] } }), { headers: { "content-type": "application/json" } });
    },
  });
  assert.ok(hosts.includes("hi.wikipedia.org"), hosts.join(","));
  assert.ok(hosts.includes("en.wikipedia.org"), "an English article is tried as a second opinion");
});

test("Simple English is used only when nothing else returned", async () => {
  const hosts = [];
  const result = await searchOutside("volcano", {
    fetchImpl: async (target) => {
      const host = new URL(String(target)).hostname;
      hosts.push(host);
      if (host.includes("duckduckgo")) return new Response("{}", { headers: { "content-type": "application/json" } });
      if (host.startsWith("en.")) return new Response(JSON.stringify({ query: { pages: [] } }), { headers: { "content-type": "application/json" } });
      return new Response(JSON.stringify({ query: { pages: [{ title: "Volcano", index: 1, extract: "A volcano is a mountain that can erupt with hot rock." }] } }), { headers: { "content-type": "application/json" } });
    },
  });
  assert.ok(hosts.includes("simple.wikipedia.org"));
  assert.equal(result.results.length, 1);
  assert.ok(result.providers.includes("Simple English Wikipedia"));
});

test("each provider gets the query shape it handles best", async () => {
  const asked = [];
  await searchOutside("vignan vidyanikethan school", {
    natural: "Can you tell me more about Vignan Vidyanikethan school?",
    fetchImpl: async (target) => {
      const url = new URL(String(target));
      if (url.hostname.includes("duckduckgo")) asked.push(["ddg", url.searchParams.get("q")]);
      else asked.push(["wiki", url.searchParams.get("gsrsearch")]);
      return new Response(JSON.stringify({ query: { pages: [] } }), { headers: { "content-type": "application/json" } });
    },
  });
  const ddg = asked.find(([source]) => source === "ddg");
  const wiki = asked.find(([source]) => source === "wiki");
  assert.equal(wiki[1], "vignan vidyanikethan school");
  assert.equal(ddg[1], "Can you tell me more about Vignan Vidyanikethan school?");
});
