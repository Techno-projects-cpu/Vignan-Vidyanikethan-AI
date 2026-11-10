import test from "node:test";
import assert from "node:assert/strict";
import {
  fingerprintKey,
  isQuotaFailure,
  KeyCooldowns,
  parseApiKeys,
  providerKeyVariants,
} from "../js/key-pool.js";

test("parseApiKeys deduplicates comma/newline/semicolon lists and removes export placeholders", () => {
  assert.deepEqual(parseApiKeys("KEY-A, KEY-B\nKEY-A; 'KEY-C'"), ["KEY-A", "KEY-B", "KEY-C"]);
  assert.deepEqual(parseApiKeys(["KEY-A", "KEY-B,KEY-A"]), ["KEY-A", "KEY-B"]);
  assert.deepEqual(parseApiKeys("KEY-A\n[stored locally]"), ["KEY-A"]);
  assert.deepEqual(parseApiKeys(null), []);
});

test("fingerprintKey is stable and hides the original key", () => {
  const value = "very-secret-student-key";
  const fingerprint = fingerprintKey(value);
  assert.equal(fingerprint, fingerprintKey(value));
  assert.ok(!fingerprint.includes("secret"));
  assert.match(fingerprint, /^[a-z0-9]{1,7}$/);
});

test("providerKeyVariants expands multiple keys and keeps keyless providers usable", () => {
  const variants = providerKeyVariants(
    { id: "gemini", label: "Gemini", needsKey: true, apiKeys: ["KEY-A", "KEY-B"] },
    "server:gemini",
  );
  assert.equal(variants.length, 2);
  assert.deepEqual(variants.map((variant) => variant.apiKey), ["KEY-A", "KEY-B"]);
  assert.deepEqual(variants.map((variant) => variant.keyIndex), [0, 1]);
  assert.ok(variants.every((variant) => variant.keyCount === 2));
  assert.ok(variants.every((variant) => variant.keyId.startsWith("server:gemini:")));
  assert.ok(variants.every((variant) => !variant.keyId.includes("KEY-")));
  assert.equal(providerKeyVariants({ id: "gemini", needsKey: true, apiKeys: [] }).length, 0);
  assert.equal(providerKeyVariants({ id: "server", needsKey: false, apiKeys: [] }).length, 1);
});

test("isQuotaFailure recognises rate limits and quota wording", () => {
  assert.equal(isQuotaFailure(429, "rate limited"), true);
  assert.equal(isQuotaFailure(403, "quota exhausted"), true);
  assert.equal(isQuotaFailure(200, "RESOURCE_EXHAUSTED"), true);
  assert.equal(isQuotaFailure(500, "temporary server error"), false);
});

test("KeyCooldowns skips cooling keys and retries the whole pool if all are cooling", () => {
  const cooldowns = new KeyCooldowns({ cooldownMs: 60_000, now: () => 1000 });
  cooldowns.mark("key-a", 60_000, 1000);
  cooldowns.mark("key-b", 60_000, 1000);
  assert.deepEqual(cooldowns.select([{ keyId: "key-a" }], 1000), [{ keyId: "key-a" }]);
  assert.equal(cooldowns.status(1000).length, 0);
  cooldowns.mark("key-a", 60_000, 1000);
  assert.deepEqual(
    cooldowns.select([{ keyId: "key-a" }, { keyId: "key-b" }], 1000).map((item) => item.keyId),
    ["key-b"],
  );
  assert.equal(cooldowns.isCooling("key-a", 61_000), false);
});
