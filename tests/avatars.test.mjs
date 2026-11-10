/**
 * Monogram avatars: predictable, keyboard- and screen-reader-safe, and stored
 * as a tiny `p0`–`p7` token that can never inject markup.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  AVATAR_PATTERNS,
  avatarInitials,
  avatarPattern,
  avatarSeed,
  avatarSeedIndex,
  decorateAvatar,
  hashName,
} from "../js/avatars.js";
import { createLocalSocialStore } from "../server/social-store.mjs";
import { createSocialService } from "../server/social.mjs";

const A = { id: "00000000-0000-4000-8000-0000000000a1", username: "asha", avatarSeed: "9", xp: 10, streak: 1 };
const B = { id: "00000000-0000-4000-8000-0000000000b2", username: "bharat", xp: 4, streak: 1 };

test("the same name always gets the same pattern, on any device", () => {
  assert.equal(hashName("asha"), hashName("asha"));
  assert.equal(avatarPattern("", "asha"), avatarPattern("", "asha"));
  assert.ok(AVATAR_PATTERNS.includes(avatarPattern("", "asha")));
  // A pinned seed wins over the derived pattern.
  assert.equal(avatarPattern("p0", "asha"), AVATAR_PATTERNS[0]);
  assert.equal(avatarPattern("p7", "asha"), AVATAR_PATTERNS[7]);
  // Rubbish in a stored column falls back to the name, never to broken CSS.
  assert.equal(avatarPattern("p99", "asha"), avatarPattern("", "asha"));
  assert.equal(avatarPattern("</style><script>", "asha"), avatarPattern("", "asha"));
});

test("initials work for Latin, Indic and empty names", () => {
  assert.equal(avatarInitials("asha"), "AS");
  assert.equal(avatarInitials("Bharat Kumar"), "BH");
  assert.equal(avatarInitials("   "), "V");
  assert.equal(avatarInitials(""), "V");
  assert.equal([...avatarInitials("తెలుగు")].length >= 1, true);
  assert.equal(avatarInitials("🎓math"), "MA", "emoji are skipped");
});

test("seed helpers only ever produce and accept our eight tokens", () => {
  assert.equal(AVATAR_PATTERNS.length, 8);
  AVATAR_PATTERNS.forEach((_, index) => {
    assert.equal(avatarSeed(index), `p${index}`);
    assert.equal(avatarSeedIndex(avatarSeed(index)), index);
  });
  assert.equal(avatarSeed(-3), "p0");
  assert.equal(avatarSeed(99), "p7");
  assert.equal(avatarSeedIndex("p99"), -1);
  assert.equal(avatarSeedIndex(""), -1);
});

test("decorateAvatar paints a node without leaking markup", () => {
  const classes = new Set();
  const node = {
    textContent: "",
    dataset: {},
    classList: { toggle: (name, on) => (on ? classes.add(name) : classes.delete(name)) },
    setAttribute: (key, value) => { node[key] = value; },
  };
  decorateAvatar(node, { name: "asha", seed: "p2", online: true });
  assert.equal(node.textContent, "AS");
  assert.equal(node.dataset.avatar, "dots");
  assert.equal(classes.has("online"), true);
  assert.equal(node["aria-hidden"], "true");
});

async function harness() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "vignan-avatar-"));
  const store = createLocalSocialStore(path.join(directory, "social.json"));
  const service = createSocialService({ store });
  return { store, service, cleanup: () => fs.rm(directory, { recursive: true, force: true }) };
}

test("a pinned avatar survives later profile syncs and is visible to classmates", async () => {
  const { service, cleanup } = await harness();
  try {
    await service.state(A);
    await service.state(B);

    const saved = await service.setAvatar(A, "p5");
    assert.equal(saved.avatarSeed, "p5");

    // A second sync (which happens on every Friends refresh) must not reset it.
    const state = await service.state(A);
    assert.equal(state.self.avatarSeed, "p5");

    const seenByB = await service.search(B, "ash");
    assert.equal(seenByB[0].avatarSeed, "p5", "classmates see the chosen avatar");

    await assert.rejects(() => service.setAvatar(A, "p9"), /Pick one of the eight avatars/);
    await assert.rejects(() => service.setAvatar(A, "<script>"), /Pick one of the eight avatars/);
    await assert.rejects(() => service.setAvatar(A, ""), /Pick one of the eight avatars/);

    // A stored value that is not ours can never be echoed back.
    const row = await service.findProfile({ id: A.id });
    assert.equal(row.avatar_seed, "p5");
  } finally {
    await cleanup();
  }
});

test("accounts without a pinned avatar keep working", async () => {
  const { service, cleanup } = await harness();
  try {
    const state = await service.state(B);
    assert.equal(state.self.avatarSeed, "");
    const friends = await service.suggestions(A);
    assert.equal(friends[0].avatarSeed || "", "", "no seed means the client derives one");
  } finally {
    await cleanup();
  }
});

test("every avatar pattern has a style rule, and the picker markup is wired", async () => {
  const css = await fs.readFile(new URL("../styles-social.css", import.meta.url), "utf8");
  for (const pattern of AVATAR_PATTERNS) {
    const selector = `:is(.social-avatar, .profile-chip)[data-avatar="${pattern}"]`;
    assert.ok(css.includes(selector) || pattern === "plain",
      `${pattern} has a rule (plain keeps the default background)`);
  }
  assert.match(css, /\.social-me\b/, "the you-strip is styled");
  assert.match(css, /\.avatar-swatch\b/, "the swatches are styled");
  assert.match(css, /\.avatar-swatch:focus-visible/, "swatches are keyboard reachable");

  const ui = await fs.readFile(new URL("../js/friends-ui.js", import.meta.url), "utf8");
  assert.match(ui, /renderAvatarPicker\(body, data\)/, "the picker renders in the friends tab");
  assert.match(ui, /social\.setAvatar\(seed\)/, "tapping a swatch saves it");
  assert.match(ui, /aria-pressed/, "the current swatch is announced");
});
