import test from "node:test";
import assert from "node:assert/strict";
import { createSupabaseAccountStore, rowToAccount } from "../server/supabase-accounts.mjs";

function mockResponse(ok, status, data) {
  return {
    ok,
    status,
    text: async () => JSON.stringify(data),
  };
}

const profileRow = {
  id: "11111111-1111-4111-8111-111111111111",
  username: "ananya",
  age_band: "13-15",
  gender: "girl",
  guardian_consent: false,
  avatar_seed: 12345,
  xp: 0,
  streak: 0,
  best_streak: 0,
  best: 0,
  quizzes: 0,
  total_correct: 0,
  total_questions: 0,
  average: 0,
  referrals: 0,
  referred_by: null,
  last_result_day: null,
  history: [],
  created_at: "2026-10-27T00:00:00Z",
  updated_at: "2026-10-27T00:00:00Z",
};

test("rowToAccount maps Supabase columns to the app's public shape", () => {
  const account = rowToAccount(profileRow);
  assert.equal(account.username, "ananya");
  assert.equal(account.ageBand, "13-15");
  assert.equal(account.refCode, "VIGNAN-ANANYA");
  assert.equal(account.xp, 0);
  assert.deepEqual(account.history, []);
});

test("Supabase register creates a confirmed auth user and returns a public profile", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body || "{}") });
    if (url.includes("/auth/v1/admin/users")) {
      return mockResponse(true, 201, { user: { id: profileRow.id } });
    }
    if (url.includes("/rest/v1/profiles")) {
      return mockResponse(true, 200, [profileRow]);
    }
    return mockResponse(false, 404, { error: "unexpected" });
  };
  const store = createSupabaseAccountStore({
    url: "https://demo.supabase.co",
    anonKey: "anon",
    serviceRoleKey: "service",
    fetchImpl,
  });
  const account = await store.register({
    username: "Ananya",
    password: "science-2026-safe",
    age: 11,
    gender: "girl",
    guardianConsent: true,
  });
  assert.equal(account.username, "ananya");
  assert.equal(calls[0].body.email, "ananya@students.vignanvidyanikethan.org");
  assert.equal(calls[0].body.email_confirm, true);
  assert.equal(calls[0].body.user_metadata.age_band, "under-13");
  assert.equal(calls[0].body.user_metadata.guardian_consent, true);
  assert.equal(calls[0].body.user_metadata.username, "ananya");
});

test("Supabase leaderboard strips private fields", async () => {
  const fetchImpl = async (url) => {
    if (url.includes("/rest/v1/profiles")) {
      return mockResponse(true, 200, [
        { ...profileRow, username: "kiran", xp: 90, quizzes: 2, best: 90, total_correct: 9, total_questions: 10, average: 90, streak: 2 },
        { ...profileRow, id: "22222222-2222-4222-8222-222222222222", username: "meera", xp: 50, quizzes: 1, best: 70, total_correct: 7, total_questions: 10, average: 70 },
      ]);
    }
    return mockResponse(false, 404, { error: "unexpected" });
  };
  const store = createSupabaseAccountStore({
    url: "https://demo.supabase.co",
    anonKey: "anon",
    serviceRoleKey: "service",
    fetchImpl,
  });
  const board = await store.leaderboard(10);
  assert.equal(board.length, 2);
  assert.equal(board[0].username, "kiran");
  assert.equal(board[0].rank, 1);
  assert.ok(!("gender" in board[0]));
  assert.ok(!("ageBand" in board[0]));
  assert.ok(!("history" in board[0]));
  assert.ok(!("id" in board[0]));
});

test("Supabase session helpers hash tokens and use RPC", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body || "{}") });
    if (url.includes("create_vignan_session")) return mockResponse(true, 200, {});
    if (url.includes("get_vignan_session")) {
      return mockResponse(true, 200, [{ user_id: profileRow.id, expires_at: "2026-11-03T00:00:00Z" }]);
    }
    if (url.includes("delete_vignan_session")) return mockResponse(true, 200, {});
    return mockResponse(false, 404, { error: "unexpected" });
  };
  const store = createSupabaseAccountStore({
    url: "https://demo.supabase.co",
    anonKey: "anon",
    serviceRoleKey: "service",
    fetchImpl,
  });
  await store.createSession(profileRow.id, "hash-123", "2026-11-03T00:00:00Z");
  const session = await store.getSession("hash-123");
  await store.deleteSession("hash-123");
  assert.equal(session.user_id, profileRow.id);
  assert.equal(calls[0].body.p_token_hash, "hash-123");
  assert.equal(calls[2].body.p_token_hash, "hash-123");
});

test("Supabase opaque API keys are sent only as apikey; legacy JWT keys retain Bearer headers", async () => {
  async function exercise(anonKey, serviceRoleKey) {
    const calls = [];
    const store = createSupabaseAccountStore({
      url: "https://demo.supabase.co", anonKey, serviceRoleKey,
      fetchImpl: async (url, options) => {
        calls.push({ url, headers: options.headers });
        if (url.includes("/auth/v1/token")) return mockResponse(true, 200, { user: { id: profileRow.id } });
        if (url.includes("/rest/v1/profiles")) return mockResponse(true, 200, [profileRow]);
        return mockResponse(false, 404, {});
      },
    });
    const user = await store.authenticate("ananya", "oldpass1");
    assert.equal(user.username, "ananya");
    return calls;
  }
  const modern = await exercise("sb_publishable_public_test", "sb_secret_private_test");
  assert.equal(modern[0].headers.apikey, "sb_publishable_public_test");
  assert.ok(!("Authorization" in modern[0].headers));
  assert.equal(modern[1].headers.apikey, "sb_secret_private_test");
  assert.ok(!("Authorization" in modern[1].headers));
  const legacy = await exercise("legacy-anon-jwt", "legacy-service-jwt");
  assert.equal(legacy[0].headers.Authorization, "Bearer legacy-anon-jwt");
  assert.equal(legacy[1].headers.Authorization, "Bearer legacy-service-jwt");
});
