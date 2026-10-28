/**
 * Persistence for the social layer: friends, notifications, chat and games.
 *
 * Two interchangeable implementations behind one async interface:
 *   - createLocalSocialStore(filePath): a single JSON file, serialized writes.
 *   - createSupabaseSocialStore({...}): PostgREST tables, service-role only.
 *
 * Records are plain JSON so both backends behave the same. Nothing here knows
 * about HTTP or about how a student is authenticated.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const HALL_THREAD_ID = "00000000-0000-4000-8000-000000000001";
export const STUDY_HALL_ID = HALL_THREAD_ID;

const emptyState = () => ({
  version: 1,
  profiles: [],
  requests: [],
  friendships: [],
  notifications: [],
  threads: [],
  messages: [],
  games: [],
});

const byNewest = (a, b) => String(b.created_at || b.createdAt || "").localeCompare(String(a.created_at || a.createdAt || ""));

function normalizePair(a, b) {
  return a < b ? [a, b] : [b, a];
}

/* ------------------------------------------------------------------ local */

export function createLocalSocialStore(filePath) {
  let queue = Promise.resolve();
  const directory = path.dirname(filePath);

  async function loadNow() {
    try {
      const raw = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(raw);
      const state = { ...emptyState(), ...parsed };
      for (const key of Object.keys(emptyState())) {
        if (key !== "version" && !Array.isArray(state[key])) state[key] = [];
      }
      return state;
    } catch (error) {
      if (error.code === "ENOENT") return emptyState();
      throw error;
    }
  }

  async function writeNow(state) {
    await fs.mkdir(directory, { recursive: true });
    const temp = `${filePath}.${process.pid}.tmp`;
    await fs.writeFile(temp, `${JSON.stringify(state)}\n`, { mode: 0o600 });
    await fs.rename(temp, filePath);
  }

  function mutate(operation) {
    const result = queue.then(async () => {
      const state = await loadNow();
      const value = await operation(state);
      await writeNow(state);
      return value;
    });
    queue = result.then(() => undefined, () => undefined);
    return result;
  }

  const read = async (operation) => operation(await loadNow());

  return {
    backend: "local",

    async upsertProfile(profile) {
      return mutate((state) => {
        const index = state.profiles.findIndex((row) => row.user_id === profile.user_id);
        if (index >= 0) state.profiles[index] = { ...state.profiles[index], ...profile };
        else state.profiles.push({ ...profile });
        return state.profiles[index >= 0 ? index : state.profiles.length - 1];
      });
    },

    async getProfiles(ids) {
      if (!ids.length) return [];
      return read((state) => state.profiles.filter((row) => ids.includes(row.user_id)));
    },

    async searchProfiles(query, limit = 12) {
      const term = String(query || "").toLowerCase();
      return read((state) =>
        state.profiles
          .filter((row) => !term || String(row.username).toLowerCase().includes(term))
          .sort((a, b) => Number(b.xp || 0) - Number(a.xp || 0))
          .slice(0, limit),
      );
    },

    /* friends */
    async listRequests(userId) {
      return read((state) => state.requests.filter((row) => row.status === "pending" && (row.to_id === userId || row.from_id === userId)));
    },

    async createRequest(request) {
      return mutate((state) => {
        const existing = state.requests.find((row) => row.status === "pending" && row.from_id === request.from_id && row.to_id === request.to_id);
        if (existing) return existing;
        state.requests = state.requests.filter(
          (row) => !(row.status === "pending" && row.from_id === request.to_id && row.to_id === request.from_id),
        );
        const row = { id: randomUUID(), status: "pending", created_at: new Date().toISOString(), ...request };
        state.requests.push(row);
        return row;
      });
    },

    async getRequest(id) {
      return read((state) => state.requests.find((row) => row.id === id) || null);
    },

    async setRequestStatus(id, status) {
      return mutate((state) => {
        const row = state.requests.find((item) => item.id === id);
        if (!row) return null;
        row.status = status;
        row.answered_at = new Date().toISOString();
        return row;
      });
    },

    async listFriendships(userId) {
      return read((state) => state.friendships.filter((row) => row.user_a === userId || row.user_b === userId));
    },

    async getFriendship(a, b) {
      const [first, second] = normalizePair(a, b);
      return read((state) => state.friendships.find((row) => row.user_a === first && row.user_b === second) || null);
    },

    async addFriendship(friendship) {
      return mutate((state) => {
        const [user_a, user_b] = normalizePair(friendship.user_a, friendship.user_b);
        const [name_a, name_b] = user_a === friendship.user_a ? [friendship.name_a, friendship.name_b] : [friendship.name_b, friendship.name_a];
        const existing = state.friendships.find((row) => row.user_a === user_a && row.user_b === user_b);
        if (existing) return existing;
        const row = { id: randomUUID(), user_a, user_b, name_a, name_b, created_at: new Date().toISOString() };
        state.friendships.push(row);
        return row;
      });
    },

    async removeFriendship(a, b) {
      const [first, second] = normalizePair(a, b);
      return mutate((state) => {
        state.friendships = state.friendships.filter((row) => !(row.user_a === first && row.user_b === second));
        return true;
      });
    },

    /* notifications */
    async addNotification(notification) {
      return mutate((state) => {
        const row = { id: randomUUID(), read_at: null, created_at: new Date().toISOString(), ...notification };
        state.notifications.push(row);
        // Keep the file from growing without bound.
        state.notifications = state.notifications.slice(-4000);
        return row;
      });
    },

    async listNotifications(userId, limit = 30) {
      return read((state) => state.notifications.filter((row) => row.user_id === userId).sort(byNewest).slice(0, limit));
    },

    async unreadNotificationCount(userId) {
      return read((state) => state.notifications.filter((row) => row.user_id === userId && !row.read_at).length);
    },

    async markNotificationsRead(userId, ids = null) {
      return mutate((state) => {
        let changed = 0;
        for (const row of state.notifications) {
          if (row.user_id !== userId || row.read_at) continue;
          if (Array.isArray(ids) && ids.length && !ids.includes(row.id)) continue;
          row.read_at = new Date().toISOString();
          changed += 1;
        }
        return changed;
      });
    },

    /* chat */
    async ensureHallThread() {
      return mutate((state) => {
        let thread = state.threads.find((row) => row.id === HALL_THREAD_ID);
        if (!thread) {
          thread = {
            id: HALL_THREAD_ID,
            kind: "hall",
            title: "Study Hall",
            member_a: null,
            member_b: null,
            name_a: "",
            name_b: "",
            last_at: new Date().toISOString(),
            last_preview: "Everyone signed in can talk here. Keep it academic.",
          };
          state.threads.push(thread);
        }
        return thread;
      });
    },

    async ensureDirectThread(a, b) {
      const [first, second] = normalizePair(a.user_id, b.user_id);
      return mutate((state) => {
        const existing = state.threads.find(
          (row) => row.kind === "dm" && row.member_a === first && row.member_b === second,
        );
        if (existing) return existing;
        const [name_a, name_b] = first === a.user_id ? [a.username, b.username] : [b.username, a.username];
        const thread = {
          id: randomUUID(),
          kind: "dm",
          title: "",
          member_a: first,
          member_b: second,
          name_a,
          name_b,
          last_at: new Date().toISOString(),
          last_preview: "",
        };
        state.threads.push(thread);
        return thread;
      });
    },

    async listThreads(userId) {
      return read((state) =>
        state.threads
          .filter((row) => row.kind === "hall" || row.member_a === userId || row.member_b === userId)
          .sort(byNewest),
      );
    },

    async getThread(id) {
      return read((state) => state.threads.find((row) => row.id === id) || null);
    },

    async touchThread(id, preview, at) {
      return mutate((state) => {
        const row = state.threads.find((item) => item.id === id);
        if (!row) return null;
        row.last_at = at || new Date().toISOString();
        row.last_preview = String(preview || "").slice(0, 140);
        return row;
      });
    },

    async addMessage(message) {
      return mutate((state) => {
        const row = {
          id: randomUUID(),
          created_at: new Date().toISOString(),
          ...message,
          body: String(message.body).slice(0, 500),
        };
        state.messages.push(row);
        if (state.messages.length > 20_000) state.messages = state.messages.slice(-20_000);
        return row;
      });
    },

    async listMessages(threadId, { after = "", limit = 60 } = {}) {
      return read((state) => {
        const rows = state.messages
          .filter((row) => row.thread_id === threadId && (!after || row.created_at > after))
          .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
        return rows.slice(-Math.min(200, Math.max(1, limit)));
      });
    },

    async countMessages(threadId) {
      return read((state) => state.messages.filter((row) => row.thread_id === threadId).length);
    },

    /* games */
    async createGame(record) {
      return mutate((state) => {
        // A student's older waiting game is replaced by the new one.
        state.games = state.games.filter((row) => !(row.status === "waiting" && row.hostId === record.hostId));
        state.games.push({ ...record });
        if (state.games.length > 600) {
          state.games = state.games.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 400);
        }
        return record;
      });
    },

    async getGame(id) {
      return read((state) => state.games.find((row) => row.id === id) || null);
    },

    async saveGame(record) {
      return mutate((state) => {
        const index = state.games.findIndex((row) => row.id === record.id);
        if (index >= 0) state.games[index] = { ...record };
        else state.games.push({ ...record });
        return record;
      });
    },

    async listGames(userId, statuses = ["waiting", "active", "finished"], limit = 20) {
      return read((state) =>
        state.games
          .filter(
            (row) =>
              statuses.includes(row.status) &&
              (row.hostId === userId || row.guestId === userId || (row.status === "waiting" && row.inviteFor === userId)),
          )
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .slice(0, limit),
      );
    },

    async listWaiting({ kind = "", excludeUserId = "", inviteFor = "", includeInvites = false, maxAgeMs = 15 * 60_000 } = {}) {
      const cutoff = Date.now() - maxAgeMs;
      return read((state) =>
        state.games
          .filter(
            (row) =>
              row.status === "waiting" &&
              (!kind || row.kind === kind) &&
              (!excludeUserId || row.hostId !== excludeUserId) &&
              (inviteFor ? row.inviteFor === inviteFor || !row.inviteFor : includeInvites ? true : !row.inviteFor) &&
              Number(row.createdAt) > cutoff,
          )
          .sort((a, b) => a.createdAt - b.createdAt),
      );
    },
  };
}

/* --------------------------------------------------------------- supabase */

export function createSupabaseSocialStore({ url, serviceRoleKey }) {
  const base = `${String(url).replace(/\/+$/, "")}/rest/v1`;
  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };

  async function rest(table, { method = "GET", query = "", body, prefer = "", single = false } = {}) {
    const response = await fetch(`${base}/${table}${query}`, {
      method,
      headers: { ...headers, ...(prefer ? { Prefer: prefer } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const text = await response.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }
    if (!response.ok) {
      const error = new Error(`social store request failed (${response.status})`);
      error.status = response.status;
      error.detail = typeof data === "string" ? data : data?.message || "";
      throw error;
    }
    return single ? (Array.isArray(data) ? data[0] || null : data) : data;
  }

  const eq = (value) => `eq.${encodeURIComponent(value)}`;
  const inList = (values) => `in.(${values.map((value) => `"${String(value).replace(/"/g, "")}"`).join(",")})`;
  const profileFrom = (row) =>
    row && {
      user_id: row.user_id,
      username: row.username,
      avatar_seed: row.avatar_seed || "",
      xp: Number(row.xp) || 0,
      streak: Number(row.streak) || 0,
      last_seen: row.last_seen,
    };
  const requestFrom = (row) => ({
    id: row.id,
    from_id: row.from_id,
    from_name: row.from_name,
    to_id: row.to_id,
    to_name: row.to_name,
    status: row.status,
    created_at: row.created_at,
  });
  const threadFrom = (row) => ({
    id: row.id,
    kind: row.kind,
    title: row.title || "",
    member_a: row.member_a,
    member_b: row.member_b,
    name_a: row.name_a || "",
    name_b: row.name_b || "",
    last_at: row.last_at,
    last_preview: row.last_preview || "",
  });
  const messageFrom = (row) => ({
    id: row.id,
    thread_id: row.thread_id,
    from_id: row.from_id,
    from_name: row.from_name,
    body: row.body,
    created_at: row.created_at,
  });

  return {
    backend: "supabase",

    async upsertProfile(profile) {
      const rows = await rest("social_profiles", {
        method: "POST",
        query: "?on_conflict=user_id",
        prefer: "resolution=merge-duplicates,return=representation",
        body: [profile],
      });
      return profileFrom(Array.isArray(rows) ? rows[0] : rows);
    },

    async getProfiles(ids) {
      if (!ids.length) return [];
      const rows = await rest("social_profiles", { query: `?user_id=${inList(ids)}` });
      return (rows || []).map(profileFrom);
    },

    async searchProfiles(query, limit = 12) {
      const term = String(query || "").trim();
      const filter = term ? `&username=ilike.*${encodeURIComponent(term.replace(/[*%]/g, ""))}*` : "";
      const rows = await rest("social_profiles", { query: `?select=*${filter}&order=xp.desc&limit=${limit}` });
      return (rows || []).map(profileFrom);
    },

    async listRequests(userId) {
      const rows = await rest("friend_requests", {
        query: `?or=(and(to_id.${eq(userId)},status.eq.pending),and(from_id.${eq(userId)},status.eq.pending))&order=created_at.desc`,
      });
      return (rows || []).map(requestFrom);
    },

    async createRequest(request) {
      const mine = await rest("friend_requests", {
        query: `?from_id=${eq(request.from_id)}&to_id=${eq(request.to_id)}&status=eq.pending&limit=1`,
      });
      if (Array.isArray(mine) && mine[0]) return requestFrom(mine[0]);
      // A crossing request is replaced by this one, matching the local store.
      await rest("friend_requests", {
        method: "DELETE",
        query: `?from_id=${eq(request.to_id)}&to_id=${eq(request.from_id)}&status=eq.pending`,
        prefer: "return=minimal",
      });
      try {
        const rows = await rest("friend_requests", {
          method: "POST",
          prefer: "return=representation",
          body: [{ from_id: request.from_id, from_name: request.from_name, to_id: request.to_id, to_name: request.to_name, status: "pending" }],
        });
        return requestFrom(Array.isArray(rows) ? rows[0] : rows);
      } catch (error) {
        if (error.status !== 409) throw error;
        const rows = await rest("friend_requests", {
          query: `?from_id=${eq(request.from_id)}&to_id=${eq(request.to_id)}&status=eq.pending&limit=1`,
        });
        return Array.isArray(rows) && rows[0] ? requestFrom(rows[0]) : null;
      }
    },

    async getRequest(id) {
      const rows = await rest("friend_requests", { query: `?id=${eq(id)}&limit=1` });
      return Array.isArray(rows) && rows[0] ? requestFrom(rows[0]) : null;
    },

    async setRequestStatus(id, status) {
      const rows = await rest("friend_requests", {
        method: "PATCH",
        query: `?id=${eq(id)}`,
        prefer: "return=representation",
        body: { status, answered_at: new Date().toISOString() },
      });
      return Array.isArray(rows) && rows[0] ? requestFrom(rows[0]) : null;
    },

    async listFriendships(userId) {
      const rows = await rest("friendships", { query: `?or=(user_a.${eq(userId)},user_b.${eq(userId)})` });
      return (rows || []).map((row) => ({ ...row }));
    },

    async getFriendship(a, b) {
      const [first, second] = normalizePair(a, b);
      const rows = await rest("friendships", { query: `?user_a=${eq(first)}&user_b=${eq(second)}&limit=1` });
      return Array.isArray(rows) && rows[0] ? { ...rows[0] } : null;
    },

    async addFriendship(friendship) {
      const [user_a, user_b] = normalizePair(friendship.user_a, friendship.user_b);
      const [name_a, name_b] = user_a === friendship.user_a
        ? [friendship.name_a, friendship.name_b]
        : [friendship.name_b, friendship.name_a];
      const rows = await rest("friendships", {
        method: "POST",
        query: "?on_conflict=user_a,user_b",
        prefer: "resolution=merge-duplicates,return=representation",
        body: [{ user_a, user_b, name_a, name_b }],
      });
      const row = Array.isArray(rows) ? rows[0] : rows;
      return row ? { ...row } : null;
    },

    async removeFriendship(a, b) {
      const [first, second] = normalizePair(a, b);
      await rest("friendships", { method: "DELETE", query: `?user_a=${eq(first)}&user_b=${eq(second)}`, prefer: "return=minimal" });
      return true;
    },

    async addNotification(notification) {
      const rows = await rest("social_notifications", {
        method: "POST",
        prefer: "return=representation",
        body: [{
          user_id: notification.user_id,
          kind: notification.kind,
          title: notification.title,
          body: notification.body || "",
          data: notification.data || {},
        }],
      });
      return Array.isArray(rows) ? rows[0] : rows;
    },

    async listNotifications(userId, limit = 30) {
      const rows = await rest("social_notifications", {
        query: `?user_id=${eq(userId)}&order=created_at.desc&limit=${limit}`,
      });
      return (rows || []).map((row) => ({ ...row, read_at: row.read_at }));
    },

    async unreadNotificationCount(userId) {
      const rows = await rest("social_notifications", {
        query: `?user_id=${eq(userId)}&read_at=is.null&select=id`,
      });
      return Array.isArray(rows) ? rows.length : 0;
    },

    async markNotificationsRead(userId, ids = null) {
      const filter = Array.isArray(ids) && ids.length ? `&id=${inList(ids)}` : "";
      const rows = await rest("social_notifications", {
        method: "PATCH",
        query: `?user_id=${eq(userId)}&read_at=is.null${filter}`,
        prefer: "return=representation",
        body: { read_at: new Date().toISOString() },
      });
      return Array.isArray(rows) ? rows.length : 0;
    },

    async ensureHallThread() {
      const rows = await rest("chat_threads", {
        method: "POST",
        query: "?on_conflict=id",
        prefer: "resolution=merge-duplicates,return=representation",
        body: [{
          id: HALL_THREAD_ID,
          kind: "hall",
          title: "Study Hall",
          last_preview: "Everyone signed in can talk here. Keep it academic.",
        }],
      });
      const row = Array.isArray(rows) ? rows[0] : rows;
      return threadFrom(row);
    },

    async ensureDirectThread(a, b) {
      const [member_a, member_b] = normalizePair(a.user_id, b.user_id);
      const [name_a, name_b] = member_a === a.user_id ? [a.username, b.username] : [b.username, a.username];
      const existing = await rest("chat_threads", {
        query: `?kind=eq.dm&member_a=${eq(member_a)}&member_b=${eq(member_b)}&limit=1`,
      });
      if (Array.isArray(existing) && existing[0]) return threadFrom(existing[0]);
      try {
        const rows = await rest("chat_threads", {
          method: "POST",
          prefer: "return=representation",
          body: [{ kind: "dm", member_a, member_b, name_a, name_b }],
        });
        const row = Array.isArray(rows) ? rows[0] : rows;
        return threadFrom(row);
      } catch (error) {
        // A concurrent create won the unique index; read it back.
        if (error.status === 409) {
          const rows = await rest("chat_threads", {
            query: `?kind=eq.dm&member_a=${eq(member_a)}&member_b=${eq(member_b)}&limit=1`,
          });
          if (Array.isArray(rows) && rows[0]) return threadFrom(rows[0]);
        }
        throw error;
      }
    },

    async listThreads(userId) {
      const rows = await rest("chat_threads", {
        query: `?or=(kind.eq.hall,and(kind.eq.dm,member_a.${eq(userId)}),and(kind.eq.dm,member_b.${eq(userId)}))&order=last_at.desc&limit=40`,
      });
      return (rows || []).map(threadFrom);
    },

    async getThread(id) {
      const rows = await rest("chat_threads", { query: `?id=${eq(id)}&limit=1` });
      return Array.isArray(rows) && rows[0] ? threadFrom(rows[0]) : null;
    },

    async touchThread(id, preview, at) {
      const rows = await rest("chat_threads", {
        method: "PATCH",
        query: `?id=${eq(id)}`,
        prefer: "return=representation",
        body: { last_at: at || new Date().toISOString(), last_preview: String(preview || "").slice(0, 140) },
      });
      return Array.isArray(rows) && rows[0] ? threadFrom(rows[0]) : null;
    },

    async addMessage(message) {
      const rows = await rest("chat_messages", {
        method: "POST",
        prefer: "return=representation",
        body: [{
          thread_id: message.thread_id,
          from_id: message.from_id,
          from_name: message.from_name,
          body: String(message.body).slice(0, 500),
        }],
      });
      const row = Array.isArray(rows) ? rows[0] : rows;
      return messageFrom(row);
    },

    async listMessages(threadId, { after = "", limit = 60 } = {}) {
      const filter = after ? `&created_at=gt.${encodeURIComponent(after)}` : "";
      const rows = await rest("chat_messages", {
        query: `?thread_id=${eq(threadId)}${filter}&order=created_at.asc&limit=${Math.min(200, Math.max(1, limit))}`,
      });
      return (rows || []).map(messageFrom);
    },

    async countMessages(threadId) {
      const rows = await rest("chat_messages", { query: `?thread_id=${eq(threadId)}&select=id` });
      return Array.isArray(rows) ? rows.length : 0;
    },

    async createGame(record) {
      await rest("games", {
        method: "DELETE",
        query: `?status=eq.waiting&host_id=${eq(record.hostId)}`,
        prefer: "return=minimal",
      });
      const rows = await rest("games", {
        method: "POST",
        prefer: "return=representation",
        body: [{
          id: record.id,
          kind: record.kind,
          code: record.code,
          host_id: record.hostId,
          host_name: record.hostName,
          guest_id: record.guestId || null,
          guest_name: record.guestName || null,
          status: record.status,
          payload: record,
          created_at: new Date(record.createdAt).toISOString(),
          updated_at: new Date(record.updatedAt).toISOString(),
        }],
      });
      const row = Array.isArray(rows) ? rows[0] : rows;
      return row?.payload || record;
    },

    async getGame(id) {
      const rows = await rest("games", { query: `?id=${eq(id)}&limit=1` });
      return Array.isArray(rows) && rows[0] ? rows[0].payload : null;
    },

    async saveGame(record) {
      const rows = await rest("games", {
        method: "PATCH",
        query: `?id=${eq(record.id)}`,
        prefer: "return=representation",
        body: {
          guest_id: record.guestId || null,
          guest_name: record.guestName || null,
          status: record.status,
          payload: record,
          updated_at: new Date(record.updatedAt).toISOString(),
        },
      });
      const row = Array.isArray(rows) ? rows[0] : rows;
      return row?.payload || record;
    },

    async listGames(userId, statuses = ["waiting", "active", "finished"], limit = 20) {
      const statusFilter = `status=${inList(statuses)}`;
      const rows = await rest("games", {
        query: `?${statusFilter}&or=(host_id.${eq(userId)},guest_id.${eq(userId)})&order=updated_at.desc&limit=${limit}`,
      });
      return (rows || []).map((row) => row.payload).filter(Boolean);
    },

    async listWaiting({ kind = "", excludeUserId = "", inviteFor = "", includeInvites = false, maxAgeMs = 15 * 60_000 } = {}) {
      const cutoff = new Date(Date.now() - maxAgeMs).toISOString();
      const kindFilter = kind ? `&kind=${eq(kind)}` : "";
      const excludeFilter = excludeUserId ? `&host_id=neq.${encodeURIComponent(excludeUserId)}` : "";
      const rows = await rest("games", {
        query: `?status=eq.waiting&created_at=gt.${encodeURIComponent(cutoff)}${kindFilter}${excludeFilter}&order=created_at.asc&limit=20`,
      });
      return (rows || [])
        .map((row) => row.payload)
        .filter((payload) => payload && (inviteFor
          ? payload.inviteFor === inviteFor || !payload.inviteFor
          : includeInvites || !payload.inviteFor));
    },
  };
}
