/**
 * Social domain rules: friends, notifications, chat and games.
 *
 * This layer validates everything a student sends, decides who may see what,
 * and writes the notifications the other person receives. Routes stay thin.
 */

import {
  GAME_KINDS,
  GameError,
  createGame,
  gameResultText,
  gameSummary,
  joinGame,
  playGameTurn,
  publicGame,
  resignGame,
} from "./games.mjs";
import { STUDY_HALL_ID } from "./social-store.mjs";

const MAX_MESSAGE = 500;
const MAX_SEARCH = 40;
const ONLINE_MS = 120_000;
const REMATCH_LIMIT = 5;

export class SocialError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "SocialError";
    this.status = status;
  }
}

/** Keep chat text readable on a phone and strip invisible junk. */
export function cleanMessage(value) {
  const text = String(value ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u202a-\u202e]/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!text) throw new SocialError("Write a message first.");
  if (text.length > MAX_MESSAGE) throw new SocialError(`Keep messages under ${MAX_MESSAGE} characters.`);
  return text;
}

export function cleanSearch(value) {
  const text = String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, MAX_SEARCH);
  if (text.length < 2) throw new SocialError("Type at least two letters of a username.");
  return text;
}

const iso = (value) => (value ? new Date(value).toISOString() : null);
const isOnline = (profile) => Boolean(profile?.last_seen) && Date.now() - Date.parse(profile.last_seen) < ONLINE_MS;
const score = (profile) => ({ xp: Number(profile?.xp) || 0, streak: Number(profile?.streak) || 0 });

export function createSocialService({ store, now = () => Date.now(), lookupByName = null, lookupById = null }) {
  /**
   * A student who has never opened the Friends screen has no social profile
   * row yet. Fall back to the account directory so a fresh classmate can still
   * be found and added by username.
   */
  async function findProfile({ username = "", id = "" } = {}) {
    if (username) {
      const rows = await store.searchProfiles(username, 10);
      const match = rows.find((row) => String(row.username).toLowerCase() === String(username).toLowerCase());
      if (match) return match;
      const account = lookupByName ? await lookupByName(username) : null;
      if (!account) return null;
      return {
        user_id: account.id,
        username: account.username,
        avatar_seed: account.avatarSeed || "",
        xp: account.xp || 0,
        streak: account.streak || 0,
        last_seen: null,
      };
    }
    if (id) {
      const rows = await store.getProfiles([id]);
      if (rows[0]) return rows[0];
      const account = lookupById ? await lookupById(id) : null;
      return account
        ? {
            user_id: account.id,
            username: account.username,
            avatar_seed: account.avatarSeed || "",
            xp: account.xp || 0,
            streak: account.streak || 0,
            last_seen: null,
          }
        : null;
    }
    return null;
  }

  /**
   * Which pattern a student has pinned, if any.
   *
   * Accepts only the tiny `p0`–`p7` tokens the picker emits. Anything else is
   * treated as "no choice" so a stored value can never inject markup or CSS.
   */
  function cleanAvatarSeed(value) {
    const text = String(value || "").trim().toLowerCase();
    if (!text) return "";
    const match = /^p([0-7])$/.exec(text);
    return match ? text : "";
  }

  /**
   * Refresh the searchable directory row for the signed-in student.
   *
   * A pinned avatar wins over the account default; the account value is only a
   * fallback for rows created before anyone chose one.
   */
  async function touchProfile(user) {
    const existing = (await store.getProfiles([user.id]))[0];
    const pinned = cleanAvatarSeed(existing?.avatar_seed);
    return store.upsertProfile({
      user_id: user.id,
      username: user.username,
      avatar_seed: pinned || cleanAvatarSeed(user.avatarSeed),
      xp: Number(user.xp) || 0,
      streak: Number(user.streak) || 0,
      last_seen: new Date(now()).toISOString(),
    });
  }

  /** Save the avatar a student tapped, and hand back the stored row. */
  async function setAvatar(user, seed) {
    const clean = cleanAvatarSeed(seed);
    if (!clean) throw new SocialError("Pick one of the eight avatars.");
    const profile = await touchProfile(user);
    const updated = await store.upsertProfile({ ...profile, avatar_seed: clean });
    return { avatarSeed: clean, me: person(updated) };
  }

  function person(profile, extra = {}) {
    return {
      id: profile.user_id,
      username: profile.username,
      avatarSeed: profile.avatar_seed || "",
      ...score(profile),
      online: isOnline(profile),
      ...extra,
    };
  }

  async function relationship(viewerId, otherId, { friendships, requests } = {}) {
    const friends = friendships || (await store.listFriendships(viewerId));
    if (friends.some((row) => row.user_a === otherId || row.user_b === otherId)) return "friend";
    const rows = requests || (await store.listRequests(viewerId));
    const mine = rows.find((row) => row.from_id === viewerId && row.to_id === otherId);
    if (mine) return "requested";
    const theirs = rows.find((row) => row.from_id === otherId && row.to_id === viewerId);
    if (theirs) return "incoming";
    return "none";
  }

  async function profilesByIds(ids) {
    if (!ids.length) return new Map();
    const rows = await store.getProfiles(ids);
    return new Map(rows.map((row) => [row.user_id, row]));
  }

  async function areFriends(a, b) {
    return Boolean(await store.getFriendship(a, b));
  }

  async function notify({ userId, kind, title, body = "", data = {}, dedupe = "" }) {
    if (!userId) return null;
    if (dedupe) {
      const existing = await store.listNotifications(userId, 6);
      if (existing.some((row) => !row.read_at && row.kind === kind && row.data?.dedupe === dedupe)) return null;
    }
    return store.addNotification({ user_id: userId, kind, title, body, data: { ...data, dedupe } });
  }

  async function friendList(user) {
    const friendships = await store.listFriendships(user.id);
    const others = friendships.map((row) => ({
      id: row.user_a === user.id ? row.user_b : row.user_a,
      name: row.user_a === user.id ? row.name_b : row.name_a,
      since: row.created_at,
    }));
    const profiles = await profilesByIds(others.map((row) => row.id));
    return others
      .map((row) => {
        const profile = profiles.get(row.id);
        return {
          id: row.id,
          username: profile?.username || row.name,
          avatarSeed: profile?.avatar_seed || "",
          ...score(profile),
          online: isOnline(profile),
          since: row.since,
        };
      })
      .sort((a, b) => Number(b.online) - Number(a.online) || a.username.localeCompare(b.username));
  }

  async function requestList(user) {
    const rows = await store.listRequests(user.id);
    const incoming = rows.filter((row) => row.to_id === user.id);
    const outgoing = rows.filter((row) => row.from_id === user.id);
    return {
      incoming: incoming.map((row) => ({
        id: row.id,
        from: { id: row.from_id, username: row.from_name },
        createdAt: row.created_at,
      })),
      outgoing: outgoing.map((row) => ({
        id: row.id,
        to: { id: row.to_id, username: row.to_name },
        createdAt: row.created_at,
      })),
    };
  }

  async function threadList(user) {
    const threads = await store.listThreads(user.id);
    const profiles = await profilesByIds(
      threads.flatMap((thread) => [thread.member_a, thread.member_b].filter((id) => id && id !== user.id)),
    );
    return threads.map((thread) => {
      if (thread.kind === "hall") {
        return { id: thread.id, kind: "hall", title: "Study Hall", preview: thread.last_preview, lastAt: thread.last_at, online: null };
      }
      const otherId = thread.member_a === user.id ? thread.member_b : thread.member_a;
      const otherName = thread.member_a === user.id ? thread.name_b : thread.name_a;
      const profile = profiles.get(otherId);
      return {
        id: thread.id,
        kind: "dm",
        title: profile?.username || otherName,
        friendId: otherId,
        avatarSeed: profile?.avatar_seed || "",
        preview: thread.last_preview,
        lastAt: thread.last_at,
        online: isOnline(profile),
      };
    });
  }

  async function myGames(user) {
    const rows = await store.listGames(user.id, ["waiting", "active", "finished"], 24);
    const label = (record) => {
      const other = record.hostId === user.id ? record.guestName : record.hostName;
      return other || "";
    };
    const games = rows.map((record) => ({ ...gameSummary(record, user.id), opponent: label(record) }));
    return {
      active: games.filter((row) => row.status === "active"),
      waiting: games.filter((row) => row.status === "waiting"),
      finished: games.filter((row) => row.status === "finished").slice(0, 6),
    };
  }

  async function state(user) {
    const me = await touchProfile(user);
    const [friends, requests, notifications, unread, threads, games] = await Promise.all([
      friendList(user),
      requestList(user),
      store.listNotifications(user.id, 24),
      store.unreadNotificationCount(user.id),
      threadList(user),
      myGames(user),
    ]);
    return {
      self: { id: user.id, username: user.username, avatarSeed: me?.avatar_seed || "" },
      friends,
      requests,
      notifications: notifications.map((row) => ({
        id: row.id,
        kind: row.kind,
        title: row.title,
        body: row.body || "",
        data: row.data || {},
        read: Boolean(row.read_at),
        createdAt: row.created_at,
      })),
      unread,
      threads,
      games,
      studyHallId: STUDY_HALL_ID,
      serverTime: new Date(now()).toISOString(),
    };
  }

  async function search(user, query) {
    const term = cleanSearch(query);
    await touchProfile(user);
    const [profiles, friendships, requests] = await Promise.all([
      store.searchProfiles(term, 16),
      store.listFriendships(user.id),
      store.listRequests(user.id),
    ]);
    if (!profiles.some((profile) => String(profile.username).toLowerCase() === term)) {
      const exact = await findProfile({ username: term });
      if (exact) profiles.unshift(exact);
    }
    const friendIds = new Set(friendships.map((row) => (row.user_a === user.id ? row.user_b : row.user_a)));
    const outgoing = new Set(requests.filter((row) => row.from_id === user.id).map((row) => row.to_id));
    const incoming = new Set(requests.filter((row) => row.to_id === user.id).map((row) => row.from_id));
    return profiles
      .filter((profile) => profile.user_id !== user.id)
      .map((profile) =>
        person(profile, {
          relationship: friendIds.has(profile.user_id)
            ? "friend"
            : outgoing.has(profile.user_id)
              ? "requested"
              : incoming.has(profile.user_id)
                ? "incoming"
                : "none",
        }),
      )
      .slice(0, 12);
  }

  /**
   * Students to suggest on the Add-a-friend screen.
   *
   * Typing a username first was a dead end for most students: nobody knows
   * anyone's handle when they open the tab. This returns the same `person`
   * shape as `search()` without needing a query, so the screen can offer a few
   * classmates with an Add button next to each one.
   */
  async function suggestions(user, limit = 6) {
    await touchProfile(user);
    const [profiles, friendships, requests] = await Promise.all([
      store.searchProfiles("", 24),
      store.listFriendships(user.id),
      store.listRequests(user.id),
    ]);
    const friendIds = new Set(friendships.map((row) => (row.user_a === user.id ? row.user_b : row.user_a)));
    const outgoing = new Set(requests.filter((row) => row.from_id === user.id).map((row) => row.to_id));
    const incoming = new Set(requests.filter((row) => row.to_id === user.id).map((row) => row.from_id));
    return profiles
      .filter((profile) => profile.user_id !== user.id && !friendIds.has(profile.user_id))
      .map((profile) =>
        person(profile, {
          relationship: outgoing.has(profile.user_id) ? "requested" : incoming.has(profile.user_id) ? "incoming" : "none",
        }),
      )
      .slice(0, limit);
  }

  async function requestFriend(user, username) {
    const handle = String(username || "").trim().replace(/^@/, "").toLowerCase();
    if (!handle) throw new SocialError("Type a username to add.");
    const profile = await findProfile({ username: handle });
    if (!profile) throw new SocialError("No student with that username yet.", 404);
    if (profile.user_id === user.id) throw new SocialError("That is your own username.");
    if (await areFriends(user.id, profile.user_id)) throw new SocialError("You are already friends.");
    const row = await store.createRequest({
      from_id: user.id,
      from_name: user.username,
      to_id: profile.user_id,
      to_name: profile.username,
    });
    if (!row) throw new SocialError("Could not send that request. Try again.", 500);
    if (row.status === "pending") {
      await notify({
        userId: profile.user_id,
        kind: "friend_request",
        title: "New friend request",
        body: `${user.username} wants to add you.`,
        data: { requestId: row.id, userId: user.id, username: user.username },
        dedupe: `friend:${user.id}:${profile.user_id}`,
      });
    }
    return { request: { id: row.id, to: { id: profile.user_id, username: profile.username } } };
  }

  async function respondToRequest(user, requestId, accept) {
    const request = await store.getRequest(String(requestId || ""));
    if (!request) throw new SocialError("That request no longer exists.", 404);
    if (request.to_id !== user.id) throw new SocialError("That request is not yours to answer.", 403);
    if (request.status !== "pending") throw new SocialError("That request was already answered.");
    await store.setRequestStatus(request.id, accept ? "accepted" : "declined");
    if (!accept) return { ok: true, accepted: false };
    await store.addFriendship({
      user_a: request.from_id,
      user_b: request.to_id,
      name_a: request.from_name,
      name_b: request.to_name,
    });
    await notify({
      userId: request.from_id,
      kind: "friend_accept",
      title: "Friend request accepted",
      body: `${user.username} is now on your friends list.`,
      data: { userId: user.id, username: user.username },
    });
    return { ok: true, accepted: true };
  }

  async function removeFriend(user, friendId) {
    if (!(await areFriends(user.id, friendId))) throw new SocialError("That student is not on your friends list.");
    await store.removeFriendship(user.id, friendId);
    return { ok: true };
  }

  async function openChat(user, { friendId = "", threadId = "" } = {}) {
    if (threadId === STUDY_HALL_ID) {
      const thread = await store.ensureHallThread();
      return { thread: await describeThread(user, thread) };
    }
    if (threadId) {
      const thread = await store.getThread(threadId);
      if (!thread) throw new SocialError("That conversation was not found.", 404);
      if (thread.kind !== "hall" && thread.member_a !== user.id && thread.member_b !== user.id) {
        throw new SocialError("That conversation is private.", 403);
      }
      return { thread: await describeThread(user, thread) };
    }
    if (!friendId) throw new SocialError("Choose a friend to message.");
    if (!(await areFriends(user.id, friendId))) throw new SocialError("You can only message friends.", 403);
    const profile = await findProfile({ id: friendId });
    if (!profile) throw new SocialError("That student's profile is not available yet.", 404);
    const thread = await store.ensureDirectThread(
      { user_id: user.id, username: user.username },
      { user_id: friendId, username: profile.username },
    );
    return { thread: await describeThread(user, thread) };
  }

  async function describeThread(user, thread) {
    if (thread.kind === "hall") {
      return { id: thread.id, kind: "hall", title: "Study Hall", friendId: "", online: false };
    }
    const otherId = thread.member_a === user.id ? thread.member_b : thread.member_a;
    const otherName = thread.member_a === user.id ? thread.name_b : thread.name_a;
    const profile = await findProfile({ id: otherId });
    return {
      id: thread.id,
      kind: "dm",
      title: profile?.username || otherName,
      friendId: otherId,
      online: isOnline(profile),
    };
  }

  async function messageList(user, threadId, after = "") {
    const thread = await store.getThread(String(threadId || ""));
    if (!thread) throw new SocialError("That conversation was not found.", 404);
    if (thread.kind !== "hall" && thread.member_a !== user.id && thread.member_b !== user.id) {
      throw new SocialError("That conversation is private.", 403);
    }
    const rows = await store.listMessages(thread.id, { after: after || "", limit: 80 });
    return {
      threadId: thread.id,
      messages: rows.map((row) => ({
        id: row.id,
        from: row.from_id,
        mine: row.from_id === user.id,
        name: row.from_name,
        body: row.body,
        at: iso(row.created_at),
      })),
      serverTime: new Date(now()).toISOString(),
    };
  }

  async function sendMessage(user, threadId, body) {
    const thread = await store.getThread(String(threadId || ""));
    if (!thread) throw new SocialError("That conversation was not found.", 404);
    if (thread.kind !== "hall" && thread.member_a !== user.id && thread.member_b !== user.id) {
      throw new SocialError("That conversation is private.", 403);
    }
    const text = cleanMessage(body);
    const created = await store.addMessage({
      thread_id: thread.id,
      from_id: user.id,
      from_name: user.username,
      body: text,
      created_at: new Date(now()).toISOString(),
    });
    await store.touchThread(thread.id, text, created.created_at);
    if (thread.kind === "dm") {
      const otherId = thread.member_a === user.id ? thread.member_b : thread.member_a;
      await notify({
        userId: otherId,
        kind: "message",
        title: `New message from ${user.username}`,
        body: text.slice(0, 120),
        data: { threadId: thread.id, userId: user.id, username: user.username },
        dedupe: `thread:${thread.id}`,
      });
    }
    return {
      message: {
        id: created.id,
        from: user.id,
        mine: true,
        name: user.username,
        body: text,
        at: iso(created.created_at),
      },
    };
  }

  async function markNotifications(user, ids = null) {
    const changed = await store.markNotificationsRead(user.id, Array.isArray(ids) ? ids.map(String) : null);
    return { ok: true, changed, unread: await store.unreadNotificationCount(user.id) };
  }

  async function startGame(user, { kind, friendId = "" } = {}) {
    const meta = GAME_KINDS[kind];
    if (!meta) throw new SocialError("Choose a game first.");
    let invited = null;
    if (friendId) {
      if (!(await areFriends(user.id, friendId))) throw new SocialError("You can only invite friends.", 403);
      const profile = await findProfile({ id: friendId });
      invited = { id: friendId, username: profile?.username || "Friend" };
    }
    const record = createGame({ kind, host: { id: user.id, username: user.username } });
    record.inviteFor = invited ? invited.id : "";
    if (invited) {
      await notify({
        userId: invited.id,
        kind: "game_invite",
        title: `${meta.title} invite`,
        body: `${user.username} invited you to play ${meta.title}.`,
        data: { gameId: record.id, kind, username: user.username },
        dedupe: `invite:${record.id}`,
      });
    }
    await store.createGame(record);
    return { game: publicGame(record, user.id) };
  }

  async function joinWaiting(user, record) {
    if (record.hostId === user.id) throw new SocialError("You are already waiting in this game.");
    if (record.inviteFor && record.inviteFor !== user.id) throw new SocialError("That game is waiting for a different player.", 403);
    joinGame(record, { id: user.id, username: user.username }, now());
    await store.saveGame(record);
    await notify({
      userId: record.hostId,
      kind: "game_start",
      title: `${GAME_KINDS[record.kind]?.title || "Game"} started`,
      body: `${user.username} joined your game.`,
      data: { gameId: record.id },
      dedupe: `start:${record.id}`,
    });
    return { game: publicGame(record, user.id) };
  }

  async function joinGameById(user, gameId) {
    const record = await store.getGame(String(gameId || ""));
    if (!record) throw new SocialError("That game was not found.", 404);
    if (record.guestId === user.id || record.hostId === user.id) return { game: publicGame(record, user.id) };
    return joinWaiting(user, record);
  }

  async function joinByCode(user, code) {
    const clean = String(code || "").replace(/\D/g, "").slice(0, 6);
    if (clean.length !== 6) throw new SocialError("A game code has six digits.");
    const waiting = await store.listWaiting({ maxAgeMs: 60 * 60_000, includeInvites: true });
    const record = waiting.find((row) => String(row.code) === clean);
    if (!record) throw new SocialError("No open game with that code. Ask again for a fresh code.", 404);
    return joinWaiting(user, record);
  }

  async function quickMatch(user, kind) {
    const meta = GAME_KINDS[kind];
    if (!meta) throw new SocialError("Choose a game first.");
    const waiting = await store.listWaiting({ kind, excludeUserId: user.id });
    const open = waiting.find((row) => !row.inviteFor);
    if (open) return joinWaiting(user, open);
    return startGame(user, { kind });
  }

  async function move(user, gameId, payload) {
    const record = await store.getGame(String(gameId || ""));
    if (!record) throw new SocialError("That game was not found.", 404);
    if (record.hostId !== user.id && record.guestId !== user.id) throw new SocialError("You are not in this game.", 403);
    let outcome;
    try {
      outcome = playGameTurn(record, user.id, payload || {}, now());
    } catch (error) {
      if (error instanceof GameError) throw new SocialError(error.message, error.status);
      throw error;
    }
    await store.saveGame(outcome.record);
    if (outcome.record.status === "finished") {
      for (const playerId of [outcome.record.hostId, outcome.record.guestId]) {
        if (!playerId) continue;
        await notify({
          userId: playerId,
          kind: "game_finish",
          title: `${GAME_KINDS[outcome.record.kind]?.title || "Game"} finished`,
          body: gameResultText(outcome.record),
          data: { gameId: outcome.record.id },
          dedupe: `finish:${outcome.record.id}:${playerId}`,
        });
      }
    }
    return {
      game: publicGame(outcome.record, user.id),
      feedback: outcome.feedback,
    };
  }

  async function resign(user, gameId) {
    const record = await store.getGame(String(gameId || ""));
    if (!record) throw new SocialError("That game was not found.", 404);
    if (record.hostId !== user.id && record.guestId !== user.id) throw new SocialError("You are not in this game.", 403);
    if (record.status === "waiting") {
      record.status = "finished";
      record.result = { winner: "", reason: "cancelled" };
      record.finishedAt = now();
      record.updatedAt = now();
    } else {
      resignGame(record, user.id, now());
    }
    await store.saveGame(record);
    if (record.status === "finished" && record.guestId) {
      const otherId = record.hostId === user.id ? record.guestId : record.hostId;
      await notify({
        userId: otherId,
        kind: "game_finish",
        title: "Game ended",
        body: gameResultText(record),
        data: { gameId: record.id },
        dedupe: `finish:${record.id}:${otherId}`,
      });
    }
    return { game: publicGame(record, user.id) };
  }

  async function game(user, gameId) {
    const record = await store.getGame(String(gameId || ""));
    if (!record) throw new SocialError("That game was not found.", 404);
    if (record.hostId !== user.id && record.guestId !== user.id && record.inviteFor !== user.id) {
      throw new SocialError("You are not in this game.", 403);
    }
    return { game: publicGame(record, user.id) };
  }

  async function recentResult(user) {
    const rows = await store.listGames(user.id, ["finished"], REMATCH_LIMIT);
    const record = rows.find((row) => row.kind && row.status === "finished");
    return { game: record ? { ...gameSummary(record, user.id), resultText: gameResultText(record) } : null };
  }

  return {
    touchProfile,
    setAvatar,
    findProfile,
    state,
    search,
    suggestions,
    requestFriend,
    respondToRequest,
    removeFriend,
    openChat,
    messageList,
    sendMessage,
    markNotifications,
    startGame,
    joinGameById,
    joinByCode,
    quickMatch,
    move,
    resign,
    game,
    recentResult,
  };
}
