import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { withNetworkDeadline } from "../js/util.js";
import { parseChatIntent } from "../js/chat-intents.js";
import { searchWeb } from "../js/web.js";
import { downloadPublicLink } from "../js/link-reader.js";

test("a stalled transport rejects and aborts within the deadline", async () => {
  let requestSignal;
  await assert.rejects(withNetworkDeadline(signal => {
    requestSignal = signal;
    return new Promise(() => {});
  }, { timeoutMs: 20 }), { name: "TimeoutError" });
  assert.equal(requestSignal.aborted, true);
});

test("deadline includes a stalled response body, not only headers", async () => {
  await assert.rejects(withNetworkDeadline(async () => {
    const response = { text: () => new Promise(() => {}) };
    return await response.text();
  }, { timeoutMs: 20 }), { name: "TimeoutError" });
});

test("successful operations return normally and caller cancellation propagates", async () => {
  assert.equal(await withNetworkDeadline(async () => 42, { timeoutMs: 20 }), 42);
  const controller = new AbortController();
  const pending = withNetworkDeadline(() => new Promise(() => {}), { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
});

test("search and link APIs recover even if fetch ignores cancellation", async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = () => new Promise(() => {});
  try {
    for (const run of [signal => searchWeb("plants", { webEnabled: true }, { signal }),
      signal => downloadPublicLink("https://example.com", { signal })]) {
      const controller = new AbortController();
      const pending = run(controller.signal);
      controller.abort();
      await assert.rejects(pending, { name: "AbortError" });
    }
  } finally { globalThis.fetch = previous; }
});

test("web-search setting commands are deterministic and do not search themselves", () => {
  for (const text of ["turn on web search", "Please enable web search", "can you turn web search on?"]) {
    assert.equal(parseChatIntent(text)?.action, "web-search");
    assert.equal(parseChatIntent(text)?.enabled, true);
  }
  for (const text of ["turn off web search", "disable web search", "turn web search off"]) {
    assert.equal(parseChatIntent(text)?.enabled, false);
  }
  assert.equal(parseChatIntent("How does web search work?"), null);
});

test("Judge citation steps place prose in the wide column and omit comparisons", () => {
  const css = readFileSync(new URL("../styles-judge.css", import.meta.url), "utf8");
  const html = readFileSync(new URL("../judge.html", import.meta.url), "utf8");
  assert.match(css, /\.steps li > b, \.steps li > span \{ grid-column: 2;/);
  assert.match(css, /\.steps li::before \{ grid-column: 1; grid-row: 1 \/ span 2;/);
  assert.doesNotMatch(html, /eklavya|hackathon repository|Malpani Ventures/i);
});
