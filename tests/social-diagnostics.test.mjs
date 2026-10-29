/**
 * Friends/chat/games must fail with an honest, actionable sentence.
 *
 * The reported symptom was "The server could not complete that request" on the
 * Friends screen, which is what an unhandled store error looked like from the
 * browser. These tests pin the diagnosis: a missing Supabase migration says so,
 * a plain outage says so, and a genuine classroom error still passes through.
 */

import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

import {
  SOCIAL_TABLES,
  createLocalSocialStore,
  createSupabaseSocialStore,
  isMissingTable,
} from "../server/social-store.mjs";
import { createSocialRouter } from "../server/social-http.mjs";
import { SocialError } from "../server/social.mjs";

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("a missing social table is recognised in every shape PostgREST reports", () => {
  assert.equal(isMissingTable({ code: "PGRST205", status: 404 }), true);
  assert.equal(isMissingTable({ code: "42P01" }), true);
  assert.equal(isMissingTable({ detail: "Could not find the table 'public.games' in the schema cache" }), true);
  assert.equal(isMissingTable({ detail: 'relation "public.chat_messages" does not exist' }), true);
  assert.equal(isMissingTable({ detail: "duplicate key value violates unique constraint" }), false);
  assert.equal(isMissingTable({ detail: 'column "xp" does not exist' }), false);
  assert.equal(isMissingTable(null), false);
});

test("the Supabase probe names the tables an operator still has to create", async () => {
  const calls = [];
  const store = createSupabaseSocialStore({
    url: "https://example.supabase.co",
    serviceRoleKey: "service-role-placeholder-key",
    fetchImpl: async (target) => {
      const table = String(target).split("/").pop().split("?")[0];
      calls.push(table);
      return jsonResponse({ code: "PGRST205", message: `Could not find the table 'public.${table}' in the schema cache` }, 404);
    },
  });
  const check = await store.health();
  assert.equal(check.ok, false);
  assert.equal(check.code, "PGRST205");
  assert.deepEqual(check.missing, SOCIAL_TABLES);
  assert.ok(calls.length >= 1);
});

test("the Supabase probe passes when every table answers", async () => {
  const store = createSupabaseSocialStore({
    url: "https://example.supabase.co",
    serviceRoleKey: "service-role-placeholder-key",
    fetchImpl: async () => jsonResponse([]),
  });
  const check = await store.health();
  assert.equal(check.ok, true);
  assert.equal(check.backend, "supabase");
  assert.match(check.detail, /tables/);
});

test("the local store probe reports an unwritable file instead of pretending it is fine", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "vignan-social-"));
  const good = createLocalSocialStore(path.join(dir, "nested", "social.json"));
  assert.equal((await good.health()).ok, true, "creates its directory on demand");

  // A regular file used as a directory: mkdir fails instantly with ENOTDIR,
  // which is the same shape as a read-only mount.
  const blocker = path.join(dir, "not-a-directory");
  await fs.writeFile(blocker, "x");
  const bad = createLocalSocialStore(path.join(blocker, "social.json"));
  const check = await bad.health();
  assert.equal(check.ok, false);
  assert.ok(check.detail, "explains why the file cannot be used");
  await fs.rm(dir, { recursive: true, force: true });
});

function harness(service) {
  const sent = [];
  const router = createSocialRouter({
    service,
    accounts: { findById: async (id) => ({ id, username: "asha", avatarSeed: "", xp: 0, streak: 0 }) },
    accountsBackend: "local",
    currentSession: async () => ({ userId: "usr_1", expires: Date.now() + 60_000 }),
    sendJson: (response, status, payload) => sent.push({ status, payload }),
    sendError: (response, status, error) => sent.push({ status, error }),
    authOptions: () => ({ api: true }),
    readJson: async () => ({}),
    rateLimit: () => true,
  });
  return { router, sent };
}

const request = { method: "GET", headers: {}, socket: {} };
const response = { headersSent: false, writeHead() { return this; }, end() {} };
const url = new URL("http://localhost/api/social/state");

test("a missing migration becomes a 503 that says exactly what to run", async () => {
  const missing = Object.assign(new Error("social store request failed (404)"), {
    status: 404,
    code: "PGRST205",
    detail: "Could not find the table 'public.social_profiles' in the schema cache",
  });
  const { router, sent } = harness({ state: async () => { throw missing; } });
  await router({ request, response, apiPath: "/api/social/state", url });
  assert.equal(sent[0].status, 503);
  assert.match(sent[0].error, /20261028000000_vignan_social\.sql/);
  assert.match(sent[0].error, /not set up/i);
});

test("a database outage is a 503 anyone can understand", async () => {
  const { router, sent } = harness({ state: async () => { throw new Error("fetch failed"); } });
  await router({ request, response, apiPath: "/api/social/state", url });
  assert.equal(sent[0].status, 503);
  assert.match(sent[0].error, /try again in a minute/i);
  assert.doesNotMatch(sent[0].error, /PGRST|relation|schema/i);
});

test("a duplicate nickname is reported as something the student can fix", async () => {
  const conflict = Object.assign(new Error("social store request failed (409)"), {
    status: 409,
    code: "23505",
    table: "social_profiles",
    detail: "duplicate key value violates unique constraint",
  });
  const { router, sent } = harness({ state: async () => { throw conflict; } });
  await router({ request, response, apiPath: "/api/social/state", url });
  assert.equal(sent[0].status, 409);
  assert.match(sent[0].error, /nickname/i);
  assert.match(sent[0].error, /Progress/);
});

test("classroom errors keep their own wording and status", async () => {
  const { router, sent } = harness({ state: async () => { throw new SocialError("That username does not exist.", 404); } });
  await router({ request, response, apiPath: "/api/social/state", url });
  assert.equal(sent[0].status, 404);
  assert.equal(sent[0].error, "That username does not exist.");
});

test("a healthy call still answers 200", async () => {
  const { router, sent } = harness({ state: async () => ({ friends: [] }) });
  await router({ request, response, apiPath: "/api/social/state", url });
  assert.equal(sent[0].status, 200);
  assert.deepEqual(sent[0].payload.friends, []);
});
