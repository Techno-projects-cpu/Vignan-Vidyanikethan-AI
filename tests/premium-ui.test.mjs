import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { AI_NICKNAMES, FEATURED_AI_IDS, aiOptionLabel, aiProfile } from "../js/ai-nicknames.js";
import { PROVIDERS } from "../js/providers.js";
import { FREE_API_PROVIDERS } from "../js/free-apis.js";
import * as motion from "../js/motion.js";
import * as premiumUI from "../js/premium-ui.js";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(fileURLToPath(new URL(path, root)), "utf8");
const html = read("index.html");
const css = read("styles-premium.css");

test("premium shell hides navigation in a command menu and foregrounds PDF + Bolt", () => {
  assert.match(html, /<body class="minimal-ui premium-ui(?:\s+[^"]+)?">/);
  assert.match(html, /<link rel="stylesheet" href="\.\/styles-premium\.css(?:\?v=\d+)?">/);
  assert.match(html, /id="command-overlay"[^>]*hidden/);
  assert.match(html, /id="command-menu-button"/);
  assert.match(html, /id="premium-ai-trigger"/);
  assert.match(html, /id="command-ai-list"/);
  assert.match(html, /data-premium-action="upload-pdf"/);
  assert.match(html, /data-premium-action="instant-ai"/);
  assert.match(html, /Built-in instant AI|BUILT-IN INSTANT AI/i);
  assert.match(html, /Upload a textbook PDF/);
  assert.match(html, /Nicknames hide provider names/);
  assert.match(html, /premium-settings-launcher/);
});

test("premium palette is strictly black, greys and white", () => {
  const hexes = [...new Set((css.match(/#[0-9a-fA-F]{3,8}\b/g) || []).map((value) => value.slice(1).toLowerCase()))];
  assert.ok(hexes.length >= 8);
  for (const hex of hexes) {
    let channels;
    if (hex.length === 3) channels = hex.split("").map((char) => parseInt(char + char, 16));
    else if (hex.length === 6) channels = [0, 2, 4].map((index) => parseInt(hex.slice(index, index + 2), 16));
    else continue; // 4/8-digit hex is alpha notation; not used in this stylesheet.
    assert.equal(channels[0], channels[1], `${hex} should be grayscale`);
    assert.equal(channels[1], channels[2], `${hex} should be grayscale`);
  }
  assert.ok(!css.includes("@import"));
  assert.ok(!css.includes("https://"));
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /body\.premium-ui \.command-overlay/);
  assert.match(css, /body\.premium-ui \.premium-hero/);
});

test("AI nicknames hide provider names and expose specialties", () => {
  assert.equal(AI_NICKNAMES.offline.nickname, "Bolt");
  assert.equal(AI_NICKNAMES.webllm.nickname, "Nova");
  assert.equal(AI_NICKNAMES.server.nickname, "Atlas");
  assert.equal(AI_NICKNAMES.groq.nickname, "Dash");
  assert.equal(AI_NICKNAMES.gemini.nickname, "Prism");
  assert.ok(FEATURED_AI_IDS.includes("offline"));
  for (const [id, profile] of Object.entries(AI_NICKNAMES)) {
    assert.ok(profile.nickname && profile.specialty, `${id} has a nickname and specialty`);
    assert.doesNotMatch(profile.nickname, /Gemini|Groq|OpenRouter|Cloudflare|OpenAI|Claude|Mistral|Cohere|DeepSeek|Arena/i);
  }
  assert.match(aiOptionLabel("offline"), /Bolt · Instant offline textbook lookup/);
  assert.equal(aiProfile(PROVIDERS.gemini).nickname, "Prism");
});

test("visible provider labels and official key cards use nicknames", () => {
  const realNames = /Google Gemini|Groq|OpenRouter|Cloudflare Workers AI|OpenAI|Anthropic Claude|Mistral AI|Cohere|DeepSeek|Together AI|Arena AI|Ollama/i;
  for (const provider of Object.values(PROVIDERS)) {
    assert.doesNotMatch(provider.label, realNames);
    assert.ok(provider.nickname && provider.specialty, `${provider.id} has nickname and specialty`);
  }
  for (const item of FREE_API_PROVIDERS) {
    assert.doesNotMatch(item.name, realNames);
    assert.ok(item.nickname && item.specialty, `${item.id} has nickname and specialty`);
  }
});

test("motion and premium UI modules expose reduced-motion aware helpers", () => {
  assert.equal(typeof motion.initMotion, "function");
  assert.equal(typeof motion.revealVisible, "function");
  assert.equal(typeof motion.pulseElement, "function");
  assert.equal(typeof premiumUI.initPremiumUI, "function");
  assert.equal(typeof premiumUI.openCommandMenu, "function");
  assert.equal(typeof premiumUI.setPremiumAI, "function");
  assert.equal(typeof premiumUI.setPremiumView, "function");
});
