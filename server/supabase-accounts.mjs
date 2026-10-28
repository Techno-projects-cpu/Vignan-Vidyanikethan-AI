/**
 * Supabase-backed account store for Vignan Vidyanikethan AI.
 *
 * Uses Supabase Auth for passwords and Postgres for profiles, progress,
 * referrals, sessions and the leaderboard. The service-role key is used only
 * on the server (Render), never in the browser. This module intentionally has
 * no npm dependencies: it talks to Supabase over its REST/Auth HTTP APIs.
 *
 * Apply supabase/migrations/20261027000000_vignan_ai.sql before enabling
 * STUDY_AI_ACCOUNTS_BACKEND=supabase.
 */

import {
  ValidationError,
  avatarSeed,
  cleanProgressResult,
  cleanUsername,
  leaderboardFromAccounts,
  publicUser,
  validateLoginPassword,
  validateRegistration,
  validateUsername,
} from "./accounts.mjs";

function safeMessage(data, fallback) {
  const value =
    (typeof data?.error === "string" && data.error) ||
    (typeof data?.error?.message === "string" && data.error.message) ||
    (typeof data?.message === "string" && data.message) ||
    (typeof data?.msg === "string" && data.msg) ||
    fallback;
  return String(value).replace(/\s+/g, " ").trim().slice(0, 300);
}

export function rowToAccount(row = {}) {
  return {
    id: row.id,
    username: row.username,
    ageBand: row.age_band,
    gender: row.gender,
    guardianConsent: Boolean(row.guardian_consent),
    avatarSeed: Number(row.avatar_seed) || 0,
    xp: Number(row.xp) || 0,
    streak: Number(row.streak) || 0,
    bestStreak: Number(row.best_streak) || 0,
    best: Number(row.best) || 0,
    quizzes: Number(row.quizzes) || 0,
    totalCorrect: Number(row.total_correct) || 0,
    totalQuestions: Number(row.total_questions) || 0,
    average: Number(row.average) || 0,
    referrals: Number(row.referrals) || 0,
    referredBy: row.referred_by || "",
    refCode: `VIGNAN-${String(row.username || "STUDENT").toUpperCase()}`,
    createdAt: row.created_at,
    history: Array.isArray(row.history) ? row.history.slice(0, 10) : [],
  };
}

export function createSupabaseAccountStore({
  url,
  anonKey,
  serviceRoleKey,
  emailDomain = "students.vignanvidyanikethan.org",
  fetchImpl = fetch,
} = {}) {
  const base = String(url || "").replace(/\/$/, "");
  if (!base || !anonKey || !serviceRoleKey) {
    throw new Error("Supabase account store needs url, anonKey and serviceRoleKey.");
  }

  async function request(path, { method = "GET", body, service = true, prefer = "" } = {}) {
    const key = service ? serviceRoleKey : anonKey;
    // Opaque publishable/secret keys are not JWTs. Supabase's gateway accepts
    // them on apikey only; legacy JWT keys still need the Bearer header.
    const headers = { apikey: key };
    if (!/^sb_(?:publishable|secret)_/.test(key)) headers.Authorization = `Bearer ${key}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (prefer) headers.Prefer = prefer;
    const response = await fetchImpl(`${base}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    const raw = await response.text();
    let data;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { message: raw };
    }
    return { ok: response.ok, status: response.status, data };
  }

  const syntheticEmail = (username) => `${cleanUsername(username)}@${emailDomain}`;

  async function fetchProfileById(id) {
    const result = await request(
      `/rest/v1/profiles?id=eq.${encodeURIComponent(id)}&select=*&limit=1`,
    );
    if (!result.ok) throw new Error(safeMessage(result.data, `Could not load profile (${result.status})`));
    const row = Array.isArray(result.data) ? result.data[0] : result.data;
    return row ? rowToAccount(row) : null;
  }

  async function fetchProfileByUsername(username) {
    const result = await request(
      `/rest/v1/profiles?username=eq.${encodeURIComponent(cleanUsername(username))}&select=*&limit=1`,
    );
    if (!result.ok) throw new Error(safeMessage(result.data, `Could not load profile (${result.status})`));
    const row = Array.isArray(result.data) ? result.data[0] : result.data;
    return row ? rowToAccount(row) : null;
  }

  async function register(payload) {
    const clean = validateRegistration(payload);
    const email = syntheticEmail(clean.username);
    const created = await request("/auth/v1/admin/users", {
      method: "POST",
      body: {
        email,
        password: clean.password,
        email_confirm: true,
        user_metadata: {
          username: clean.username,
          age_band: clean.ageBand,
          gender: clean.gender,
          guardian_consent: clean.guardianConsent,
          avatar_seed: avatarSeed(clean.username),
          referred_by: clean.referral || null,
        },
      },
    });
    if (!created.ok) {
      const message = safeMessage(created.data, `Supabase signup failed (${created.status})`);
      if (/already|exists|duplicate|registered/i.test(message) || created.status === 422) {
        throw new ValidationError("That username is already taken.", 409);
      }
      throw new Error(message);
    }
    const authUser = created.data?.user || created.data;
    const account = authUser?.id
      ? await fetchProfileById(authUser.id)
      : await fetchProfileByUsername(clean.username);
    if (!account) throw new Error("The profile was not created. Apply the Supabase migration first.");
    return account;
  }

  async function authenticate(username, password) {
    let clean;
    try {
      clean = validateUsername(username);
      validateLoginPassword(password);
    } catch {
      return null;
    }
    const result = await request("/auth/v1/token?grant_type=password", {
      method: "POST",
      service: false,
      body: { email: syntheticEmail(clean), password: String(password) },
    });
    if (!result.ok) {
      if ([400, 401, 403].includes(result.status)) return null;
      throw new Error(safeMessage(result.data, `Supabase login failed (${result.status})`));
    }
    const userId = result.data?.user?.id;
    if (!userId) return null;
    return fetchProfileById(userId);
  }

  async function findById(id) {
    return fetchProfileById(id);
  }

  async function find(username) {
    return fetchProfileByUsername(username);
  }

  async function recordResult(id, rawResult) {
    const result = cleanProgressResult(rawResult);
    const rpc = await request("/rest/v1/rpc/record_vignan_result", {
      method: "POST",
      prefer: "return=representation",
      body: {
        p_user_id: id,
        p_topic: result.topic,
        p_percent: result.percent,
        p_score: result.score,
        p_total: result.total,
        p_xp: result.xp,
        p_day: result.day,
      },
    });
    if (!rpc.ok) throw new Error(safeMessage(rpc.data, `Could not save progress (${rpc.status})`));
    const row = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
    return row ? publicUser(rowToAccount(row)) : null;
  }

  async function leaderboard(limit = 20) {
    const result = await request(
      `/rest/v1/profiles?select=*&quizzes=gt.0&limit=100`,
    );
    if (!result.ok) throw new Error(safeMessage(result.data, `Could not load leaderboard (${result.status})`));
    const rows = Array.isArray(result.data) ? result.data : [];
    return leaderboardFromAccounts(rows.map(rowToAccount), limit);
  }

  async function createSession(userId, tokenHash, expiresAt) {
    const result = await request("/rest/v1/rpc/create_vignan_session", {
      method: "POST",
      body: { p_user_id: userId, p_token_hash: tokenHash, p_expires_at: expiresAt },
    });
    if (!result.ok) throw new Error(safeMessage(result.data, `Could not create session (${result.status})`));
  }

  async function getSession(tokenHash) {
    const result = await request("/rest/v1/rpc/get_vignan_session", {
      method: "POST",
      body: { p_token_hash: tokenHash },
    });
    if (!result.ok) throw new Error(safeMessage(result.data, `Could not read session (${result.status})`));
    const row = Array.isArray(result.data) ? result.data[0] : result.data;
    return row?.user_id ? row : null;
  }

  async function deleteSession(tokenHash) {
    await request("/rest/v1/rpc/delete_vignan_session", {
      method: "POST",
      body: { p_token_hash: tokenHash },
    });
  }

  return {
    register,
    authenticate,
    findById,
    find,
    recordResult,
    leaderboard,
    createSession,
    getSession,
    deleteSession,
    url: base,
  };
}
