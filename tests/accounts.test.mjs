import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  ValidationError,
  ageBand,
  applyResultToAccount,
  avatarSeed,
  createAccountStore,
  hashPassword,
  leaderboardFromAccounts,
  publicUser,
  validateRegistration,
  verifyPassword,
} from "../server/accounts.mjs";

async function tempStore(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "vignan-accounts-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return createAccountStore(path.join(directory, "accounts.json"));
}

test("registration validation keeps usernames clean and protects under-13 students", () => {
  const clean = validateRegistration({
    username: "  Ananya_08 ",
    password: "study-ai-2026",
    age: 14,
    gender: "girl",
    guardianConsent: false,
    referral: "KIRAN",
  });
  assert.equal(clean.username, "ananya_08");
  assert.equal(clean.ageBand, "13-15");
  assert.equal(clean.referral, "kiran");
  assert.throws(
    () => validateRegistration({ username: "ab", password: "long-enough", age: 14, gender: "girl" }),
    ValidationError,
  );
  assert.throws(
    () => validateRegistration({ username: "ananya", password: "short", age: 14, gender: "girl" }),
    ValidationError,
  );
  assert.throws(
    () => validateRegistration({ username: "ananya", password: "long-enough", age: 11, gender: "girl", guardianConsent: false }),
    /guardian/i,
  );
});

test("ageBand maps exact ages to private bands", () => {
  assert.equal(ageBand(10), "under-13");
  assert.equal(ageBand(14), "13-15");
  assert.equal(ageBand(17), "16-18");
  assert.equal(ageBand(21), "19+");
});

test("passwords are salted, hashed and verifiable without storing plaintext", async () => {
  const first = await hashPassword("correct horse battery");
  const second = await hashPassword("correct horse battery");
  assert.notEqual(first, second, "each password needs a unique salt");
  assert.match(first, /^scrypt\$[a-f0-9]+\$[a-f0-9]+$/);
  assert.equal(await verifyPassword("correct horse battery", first), true);
  assert.equal(await verifyPassword("wrong password", first), false);
  assert.equal(await verifyPassword("anything", "not-a-hash"), false);
});

test("account store registers, authenticates and rejects duplicates", async (t) => {
  const store = await tempStore(t);
  const account = await store.register({
    username: "Ananya",
    password: "study-ai-2026",
    age: 14,
    gender: "girl",
    guardianConsent: true,
  });
  assert.equal(account.username, "ananya");
  assert.equal(account.ageBand, "13-15");
  assert.equal(account.avatarSeed, avatarSeed("ananya"));
  assert.ok(!("password" in account));
  assert.ok(account.passwordHash.startsWith("scrypt$"));

  const raw = await fs.readFile(store.filePath, "utf8");
  assert.ok(!raw.includes("study-ai-2026"), "plaintext password must never touch disk");

  assert.equal((await store.authenticate("ANANYA", "study-ai-2026"))?.id, account.id);
  assert.equal(await store.authenticate("ananya", "wrong"), null);
  await assert.rejects(
    store.register({ username: "ananya", password: "another-pass", age: 15, gender: "prefer-not" }),
    /already taken/i,
  );
});

test("referral signup credits the referring student", async (t) => {
  const store = await tempStore(t);
  await store.register({ username: "kiran", password: "password1", age: 15, gender: "prefer-not" });
  await store.register({
    username: "meera",
    password: "password2",
    age: 14,
    gender: "prefer-not",
    referral: "kiran",
  });
  const referrer = await store.find("kiran");
  assert.equal(referrer.referrals, 1);
  const newUser = await store.find("meera");
  assert.equal(newUser.referredBy, "kiran");
});

test("progress sync updates XP, streak, best score and history", async (t) => {
  const store = await tempStore(t);
  const account = await store.register({ username: " streak ", password: "password1", age: 16, gender: "other" });
  const user = await store.recordResult(account.id, {
    topic: "Photosynthesis",
    percent: 80,
    score: 4,
    total: 5,
    xp: 50,
    day: "2026-10-27",
  });
  assert.equal(user.xp, 50);
  assert.equal(user.streak, 1);
  assert.equal(user.best, 80);
  assert.equal(user.quizzes, 1);
  assert.equal(user.average, 80);
  assert.equal(user.history.length, 1);

  const nextDay = await store.recordResult(account.id, {
    topic: "Forces",
    percent: 100,
    score: 5,
    total: 5,
    xp: 60,
    day: "2026-10-28",
  });
  assert.equal(nextDay.streak, 2);
  assert.equal(nextDay.best, 100);
  assert.equal(nextDay.xp, 110);
  assert.equal(nextDay.average, 90);

  const afterGap = await store.recordResult(account.id, {
    topic: "Algebra",
    percent: 50,
    score: 2,
    total: 4,
    xp: 20,
    day: "2026-11-05",
  });
  assert.equal(afterGap.streak, 1);
  assert.equal(afterGap.bestStreak, 2);
});

test("public profile and leaderboard never expose password hashes", async (t) => {
  const store = await tempStore(t);
  const a = await store.register({ username: "ananya", password: "password1", age: 14, gender: "girl" });
  const b = await store.register({ username: "kiran", password: "password2", age: 15, gender: "boy" });
  await store.recordResult(a.id, { percent: 90, score: 9, total: 10, xp: 90, day: "2026-10-27" });
  await store.recordResult(b.id, { percent: 70, score: 7, total: 10, xp: 70, day: "2026-10-27" });
  const board = await store.leaderboard(10);
  assert.equal(board[0].username, "ananya");
  assert.equal(board[0].best, 90);
  assert.ok(!("passwordHash" in board[0]));
  assert.ok(!("gender" in board[0]));
  assert.ok(!("ageBand" in board[0]));
  assert.ok(!("history" in board[0]));
  const refreshed = await store.find("ananya");
  assert.equal(leaderboardFromAccounts([publicUser(refreshed)], 5).length, 1);
  assert.equal(applyResultToAccount(a, { total: 0 }).xp, 0);
});
