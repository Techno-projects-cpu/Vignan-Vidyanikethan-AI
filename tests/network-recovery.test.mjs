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

test("configured hosted keys replace untouched offline defaults without copying secrets", async () => {
  const { normalizeSettings, connectHostedDefaults } = await import("../js/settings.js");
  const original = normalizeSettings({});
  const routed = connectHostedDefaults(original, { ai: true });
  assert.equal(routed.routing.answer, "server");
  assert.equal(routed.routing.quiz, "server");
  assert.equal(original.routing.answer, "offline", "no mutation");
  assert.equal(routed.providers.server.apiKey, "");
  for (const settings of [normalizeSettings({offlineMode:true}), normalizeSettings({freeRouterDismissed:true}), normalizeSettings({routing:{answer:"webllm"}})]) {
    assert.equal(connectHostedDefaults(settings, {ai:true}), settings, "respect explicit local/offline choices");
  }
  assert.equal(connectHostedDefaults(original, {ai:false}), original);
});

test("Nezaad switches local models to available hosted AI and restores them on exit", async () => {
  const { normalizeSettings, proCloudRouting, restoreProRouting } = await import("../js/settings.js");
  const original = normalizeSettings({routing:{answer:"webllm",quiz:"webllm"},activeProvider:"webllm"});
  const pro = proCloudRouting(original, {ai:true});
  assert.equal(pro.routing.answer, "server");
  assert.equal(proCloudRouting(pro, {ai:true}), pro, "repeated activation preserves original snapshot");
  assert.deepEqual(restoreProRouting(pro).routing, original.routing);
  assert.equal(restoreProRouting(pro).activeProvider, "webllm");
  assert.equal(proCloudRouting(original, {ai:false}), original, "do not invent available cloud keys");
  const offline = normalizeSettings({...original,offlineMode:true});
  assert.equal(proCloudRouting(offline,{ai:true}),offline);
});

test("Start links every study view and submits through the existing chat form", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
  const start = html.slice(html.indexOf('id="view-start"'), html.indexOf('id="view-ask"'));
  for (const view of ["ask","library","quiz","exam","flashcards","code","progress","friends","chat","play","settings"]) {
    assert.ok(start.includes(`data-view="${view}"`), view);
  }
  assert.match(start, /href="\.\/presentation\.html"/);
  assert.match(app, /requestedView : "start"/);
  assert.match(app, /\$\("#ask-form"\)\.requestSubmit\(\)/);
  assert.match(app, /\.start-tools \[data-view\]/);
});

test("presentation tells a complete nontechnical story and stays offline-ready", () => {
  const html = readFileSync(new URL("../presentation.html", import.meta.url), "utf8");
  const worker = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  assert.equal((html.match(/class="slide/g)||[]).length,7);
  assert.doesNotMatch(html, /API key|GitHub|Eklavya|automated tests|precache|repository|npm /i);
  assert.match(html, /Quizzes|quiz/);
  assert.match(html, /33 interface languages/);
  assert.match(html, /need a connection/);
  assert.match(worker, /presentation\.html/);
  assert.match(worker, /js\/presentation\.js\?v=/);
});

test("language wrappers share one three-column board instead of nested grids", () => {
  const css = readFileSync(new URL("../styles-next.css", import.meta.url), "utf8");
  assert.match(css, /#language-grid \{\s*display: grid; grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /#language-grid \.language-group,\s*body\.premium-ui #language-grid \.language-tiles \{ display: contents; \}/);
  assert.match(css, /@media \(max-width: 379px\) \{\s*body\.premium-ui #language-grid \{ grid-template-columns: repeat\(2,/);
});
