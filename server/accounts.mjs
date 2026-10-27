/**
 * Privacy-conscious student accounts for Vignan Vidyanikethan AI.
 *
 * This is a small, dependency-free account store for a school demo/LAN server.
 * Passwords are salted + hashed with scrypt; plaintext is never written to disk.
 * Exact age is converted to an age band, and gender is optional and private.
 *
 * For a public production deployment, replace this with a managed auth provider
 * (for example Supabase Auth) and keep the same public profile shape.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEY_LENGTH = 64;

export const GENDERS = ["prefer-not", "girl", "boy", "other"];
export const DEFAULT_DATA_FILE = path.resolve("server/data/accounts.json");

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
    this.status = 400;
  }
}

export function cleanUsername(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function validateUsername(value) {
  const username = cleanUsername(value);
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    throw new ValidationError("Username must be 3–20 characters: letters, numbers or underscore.");
  }
  return username;
}

export function validatePassword(value) {
  const password = String(value ?? "");
  if (password.length < 8 || password.length > 128) {
    throw new ValidationError("Password must be between 8 and 128 characters.");
  }
  return password;
}

export function validateAge(value) {
  const age = Number(value);
  if (!Number.isInteger(age) || age < 5 || age > 25) {
    throw new ValidationError("Enter an age between 5 and 25.");
  }
  return age;
}

export function ageBand(age) {
  if (age < 13) return "under-13";
  if (age <= 15) return "13-15";
  if (age <= 18) return "16-18";
  return "19+";
}

export function validateGender(value) {
  const gender = String(value ?? "prefer-not").trim().toLowerCase();
  return GENDERS.includes(gender) ? gender : "prefer-not";
}

export function validateReferral(value) {
  const referral = cleanUsername(value);
  return /^[a-z0-9_]{3,20}$/.test(referral) ? referral : "";
}

export function validateRegistration(payload = {}) {
  const username = validateUsername(payload.username);
  const password = validatePassword(payload.password);
  const age = validateAge(payload.age);
  const gender = validateGender(payload.gender);
  if (age < 13 && payload.guardianConsent !== true) {
    throw new ValidationError("Students under 13 need parent or guardian permission.");
  }
  return {
    username,
    password,
    age,
    ageBand: ageBand(age),
    gender,
    referral: validateReferral(payload.referral),
  };
}

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(String(password), salt, KEY_LENGTH, SCRYPT_OPTIONS);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyPassword(password, stored) {
  try {
    const [algorithm, saltHex, hashHex] = String(stored || "").split("$");
    if (algorithm !== "scrypt" || !saltHex || !hashHex) return false;
    const expected = Buffer.from(hashHex, "hex");
    const actual = await scrypt(String(password), Buffer.from(saltHex, "hex"), expected.length, SCRYPT_OPTIONS);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function avatarSeed(username) {
  let hash = 2166136261;
  for (const char of String(username || "")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

export function publicUser(account) {
  if (!account) return null;
  return {
    id: account.id,
    username: account.username,
    ageBand: account.ageBand,
    gender: account.gender,
    avatarSeed: account.avatarSeed,
    xp: account.xp || 0,
    streak: account.streak || 0,
    bestStreak: account.bestStreak || account.streak || 0,
    best: account.best || 0,
    quizzes: account.quizzes || 0,
    totalCorrect: account.totalCorrect || 0,
    totalQuestions: account.totalQuestions || 0,
    average: account.totalQuestions ? Math.round((account.totalCorrect / account.totalQuestions) * 100) : 0,
    referrals: account.referrals || 0,
    refCode: `VIGNAN-${String(account.username).toUpperCase()}`,
    createdAt: account.createdAt,
    history: (account.history || []).slice(0, 10),
  };
}

function newAccount({ username, passwordHash, ageBand: band, gender, referral }) {
  return {
    id: `usr_${randomBytes(12).toString("hex")}`,
    username,
    passwordHash,
    ageBand: band,
    gender,
    avatarSeed: avatarSeed(username),
    xp: 0,
    streak: 0,
    best: 0,
    quizzes: 0,
    totalCorrect: 0,
    totalQuestions: 0,
    referrals: 0,
    referredBy: referral || "",
    lastDay: null,
    history: [],
    createdAt: new Date().toISOString(),
  };
}

function dayDifference(a, b) {
  return Math.round((new Date(`${a}T12:00:00`) - new Date(`${b}T12:00:00`)) / 86400000);
}

export function cleanProgressResult(result = {}) {
  const total = Math.min(50, Math.max(0, Math.round(Number(result.total) || 0)));
  const score = Math.min(total, Math.max(0, Number(result.score) || 0));
  const percent = total ? Math.round((score / total) * 100) : Math.round(Number(result.percent) || 0);
  return {
    topic: String(result.topic || "Chapter quiz").slice(0, 80),
    percent: Math.min(100, Math.max(0, percent)),
    score,
    total,
    xp: Math.min(500, Math.max(0, Math.round(Number(result.xp) || 0))),
    day: /^\d{4}-\d{2}-\d{2}$/.test(result.day) ? result.day : new Date().toISOString().slice(0, 10),
  };
}

/** Apply one quiz result to an account. Returns a new account object. */
export function applyResultToAccount(account, rawResult) {
  const result = cleanProgressResult(rawResult);
  if (!result.total) return account;
  const difference = account.lastDay ? dayDifference(result.day, account.lastDay) : Infinity;
  let streak = account.streak || 0;
  if (!account.lastDay || difference <= 0) streak = Math.max(1, streak);
  else if (difference === 1) streak += 1;
  else streak = 1;
  return {
    ...account,
    xp: (account.xp || 0) + result.xp,
    quizzes: (account.quizzes || 0) + 1,
    totalCorrect: (account.totalCorrect || 0) + result.score,
    totalQuestions: (account.totalQuestions || 0) + result.total,
    best: Math.max(account.best || 0, result.percent),
    streak,
    bestStreak: Math.max(account.bestStreak || 0, account.streak || 0, streak),
    lastDay: account.lastDay && difference <= 0 ? account.lastDay : result.day,
    history: [
      { topic: result.topic, percent: result.percent, day: result.day, date: new Date().toISOString() },
      ...(account.history || []),
    ].slice(0, 30),
  };
}

export function leaderboardFromAccounts(accounts, limit = 20) {
  return (accounts || [])
    .filter((account) => (account.quizzes || 0) > 0)
    .sort((a, b) => (b.best || 0) - (a.best || 0) || (b.xp || 0) - (a.xp || 0) || (b.streak || 0) - (a.streak || 0))
    .slice(0, limit)
    .map((account, index) => {
      const { history, gender, ageBand, id, createdAt, refCode, ...safe } = publicUser(account);
      return { rank: index + 1, ...safe };
    });
}

/**
 * Create an account store backed by a JSON file.
 * All writes are queued so parallel requests cannot clobber each other.
 */
export function createAccountStore(filePath = DEFAULT_DATA_FILE) {
  let queue = Promise.resolve();
  const directory = path.dirname(filePath);

  async function load() {
    try {
      const raw = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(raw);
      return { version: 1, users: Array.isArray(parsed.users) ? parsed.users : [] };
    } catch (error) {
      if (error.code === "ENOENT") return { version: 1, users: [] };
      throw error;
    }
  }

  async function writeNow(data) {
    await fs.mkdir(directory, { recursive: true });
    const temp = `${filePath}.${process.pid}.tmp`;
    await fs.writeFile(temp, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
    await fs.rename(temp, filePath);
  }

  function save(data) {
    queue = queue.then(() => writeNow(data)).catch(() => {});
    return queue;
  }

  async function find(username) {
    const data = await load();
    const key = cleanUsername(username);
    return data.users.find((user) => user.username === key) || null;
  }

  async function findById(id) {
    const data = await load();
    return data.users.find((user) => user.id === id) || null;
  }

  async function mutate(id, updater) {
    const data = await load();
    const index = data.users.findIndex((user) => user.id === id);
    if (index < 0) return null;
    const updated = updater(data.users[index]);
    if (!updated) return null;
    data.users[index] = updated;
    await save(data);
    return updated;
  }

  async function register(payload) {
    const clean = validateRegistration(payload);
    const data = await load();
    if (data.users.some((user) => user.username === clean.username)) {
      throw new ValidationError("That username is already taken.");
    }
    const passwordHash = await hashPassword(clean.password);
    const account = newAccount({
      username: clean.username,
      passwordHash,
      ageBand: clean.ageBand,
      gender: clean.gender,
      referral: clean.referral,
    });
    data.users.push(account);
    if (clean.referral && clean.referral !== clean.username) {
      const referrer = data.users.find((user) => user.username === clean.referral);
      if (referrer) referrer.referrals = (referrer.referrals || 0) + 1;
    }
    await save(data);
    return account;
  }

  async function authenticate(username, password) {
    const account = await find(username);
    if (!account) return null;
    const valid = await verifyPassword(String(password ?? ""), account.passwordHash);
    return valid ? account : null;
  }

  async function recordResult(id, result) {
    const updated = await mutate(id, (account) => applyResultToAccount(account, result));
    return updated ? publicUser(updated) : null;
  }

  async function leaderboard(limit = 20) {
    const data = await load();
    return leaderboardFromAccounts(data.users, limit);
  }

  return { load, save, find, findById, mutate, register, authenticate, recordResult, leaderboard, filePath };
}
