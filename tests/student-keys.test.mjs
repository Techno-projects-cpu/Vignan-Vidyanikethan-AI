import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanStudentEndpoint,
  cleanStudentKeyVault,
  defaultStudentKeyVault,
  maskStudentKeyVault,
  STUDENT_KEY_PROVIDERS,
  studentKeyPayload,
  studentKeySummary,
} from "../js/student-keys.js";
import { buildStudentUpstreams } from "../server/student-keys.mjs";
import { DEFAULT_SETTINGS, normalizeSettings } from "../js/settings.js";
import * as db from "../js/db.js";

test("student key catalogue covers the official free-tier providers", () => {
  const ids = STUDENT_KEY_PROVIDERS.map((provider) => provider.id);
  for (const id of ["gemini", "groq", "cloudflare", "openrouter", "mistral", "cohere", "arena"]) {
    assert.ok(ids.includes(id));
  }
  assert.ok(ids.length >= 10);
  assert.equal(Object.keys(defaultStudentKeyVault()).length, ids.length);
});

test("cleanStudentKeyVault strips endpoint query secrets and deduplicates keys", () => {
  const vault = cleanStudentKeyVault({
    gemini: {
      endpoint: "https://generativelanguage.googleapis.com/v1beta/openai?key=DO-NOT-STORE#frag",
      model: "gemini-test",
      keys: "KEY-ALPHA,KEY-BETA\nKEY-ALPHA",
    },
  });
  assert.equal(vault.gemini.endpoint, "https://generativelanguage.googleapis.com/v1beta/openai");
  assert.equal(vault.gemini.model, "gemini-test");
  assert.deepEqual(vault.gemini.keys, ["KEY-ALPHA", "KEY-BETA"]);
  assert.equal(cleanStudentEndpoint("http://localhost:1234/v1", "https://api.openai.com/v1"), "https://api.openai.com/v1");
});

test("studentKeyPayload respects the fallback switch and summary counts", () => {
  const settings = normalizeSettings({
    ...DEFAULT_SETTINGS,
    studentKeyFallback: true,
    studentKeys: {
      gemini: { keys: "KEY-A\nKEY-B" },
      groq: { keys: "KEY-C" },
    },
  });
  const payload = studentKeyPayload(settings);
  assert.deepEqual(payload.map((entry) => entry.providerId), ["gemini", "groq"]);
  assert.deepEqual(payload[0].keys, ["KEY-A", "KEY-B"]);
  assert.deepEqual(studentKeyPayload({ ...settings, studentKeyFallback: false }), []);
  const summary = studentKeySummary(settings);
  assert.equal(summary.keys, 3);
  assert.equal(summary.providers, 2);
  assert.equal(summary.enabled, true);
});

test("maskStudentKeyVault preserves counts but never exports key values", () => {
  const masked = maskStudentKeyVault({ gemini: { keys: ["KEY-ALPHA", "KEY-BETA"] } });
  assert.deepEqual(masked.gemini.keys, ["[stored locally]", "[stored locally]"]);
  assert.ok(!JSON.stringify(masked).includes("KEY-ALPHA"));
  assert.ok(!JSON.stringify(masked).includes("KEY-BETA"));
});

test("buildStudentUpstreams rejects arbitrary endpoints and hides student key values", () => {
  const upstreams = buildStudentUpstreams([
    {
      providerId: "gemini",
      keys: ["STUDENT-ONE", "STUDENT-TWO"],
      endpoint: "https://evil.example/v1",
      model: "<script>alert(1)</script>",
    },
    { providerId: "not-allowed", keys: "BAD-KEY" },
  ]);
  assert.equal(upstreams.length, 2);
  assert.equal(upstreams[0].id, "gemini");
  assert.equal(upstreams[0].source, "student");
  assert.equal(upstreams[0].endpoint, "https://generativelanguage.googleapis.com/v1beta/openai");
  assert.equal(upstreams[0].model, "gemini-3.5-flash-lite");
  assert.deepEqual(upstreams.map((item) => item.apiKey), ["STUDENT-ONE", "STUDENT-TWO"]);
  assert.ok(upstreams.every((item) => item.keyId.startsWith("student:gemini:")));
  assert.ok(upstreams.every((item) => !item.keyId.includes("STUDENT-")));
  assert.ok(upstreams.every((item) => !item.label.includes("STUDENT-")));
  assert.ok(!JSON.stringify(upstreams).includes("BAD-KEY"));
});

test("buildStudentUpstreams allows an official Cloudflare account path on the official host", () => {
  const upstreams = buildStudentUpstreams([
    {
      providerId: "cloudflare",
      keys: "CF-STUDENT",
      endpoint: "https://api.cloudflare.com/client/v4/accounts/abc123/ai/v1?token=SECRET",
    },
  ]);
  assert.equal(upstreams.length, 1);
  assert.equal(upstreams[0].endpoint, "https://api.cloudflare.com/client/v4/accounts/abc123/ai/v1");
  assert.equal(upstreams[0].apiKey, "CF-STUDENT");
});

test("db.exportData masks provider keys, student keys and search tokens", async () => {
  await db.clearAllData();
  const settings = normalizeSettings({
    ...DEFAULT_SETTINGS,
    providers: { openai: { apiKey: "PROVIDER-SECRET", apiKeys: ["PROVIDER-SECRET"] } },
    studentKeys: { gemini: { keys: "STUDENT-SECRET" } },
    searchToken: "SEARCH-SECRET",
  });
  await db.setSetting("settings", settings);
  const exported = await db.exportData();
  const text = JSON.stringify(exported);
  assert.ok(!text.includes("PROVIDER-SECRET"));
  assert.ok(!text.includes("STUDENT-SECRET"));
  assert.ok(!text.includes("SEARCH-SECRET"));
  const stored = exported.settings.find((entry) => entry.key === "settings");
  assert.equal(stored.value.providers.openai.apiKey, "[stored locally]");
  assert.deepEqual(stored.value.providers.openai.apiKeys, ["[stored locally]"]);
  assert.deepEqual(stored.value.studentKeys.gemini.keys, ["[stored locally]"]);
  assert.equal(stored.value.searchToken, "");
});
