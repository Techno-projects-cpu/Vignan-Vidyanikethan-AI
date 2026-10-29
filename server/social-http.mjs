/**
 * HTTP routes for the social layer.
 *
 * The router is handed the pieces it needs (session lookup, account lookup,
 * JSON helpers, rate limiter) so it reuses the exact same authentication and
 * CSRF path as the rest of the site instead of inventing a second one.
 */

import { SocialError } from "./social.mjs";
import { isMissingTable } from "./social-store.mjs";

const LOGIN_MESSAGE = "Log in with your student account to use friends, chat and games.";
const SETUP_MESSAGE =
  "Friends, chat and games are not set up on this server yet. An admin needs to run "
  + "supabase/migrations/20261028000000_vignan_social.sql in the Supabase SQL editor, then retry.";
const OUTAGE_MESSAGE =
  "Friends, chat and games could not reach the account database just now. Please try again in a minute.";

/**
 * Turn an unexpected store failure into one honest sentence.
 *
 * Without this, any PostgREST/disk error escaped to the top-level handler and a
 * student saw only "the server could not complete the request", which says
 * nothing about what to fix. The detail is logged once per distinct cause so a
 * Render log still has the full picture.
 */
function failure(error, scope) {
  if (error instanceof SocialError) return error;
  // A nickname clash is the student's to fix, not an outage.
  if (String(error?.code || "") === "23505" && String(error?.table || "").includes("social_profiles")) {
    return new SocialError("That nickname is already used by another student in Friends. Change your name in Progress, then try again.", 409);
  }
  const missing = isMissingTable(error);
  const message = missing ? SETUP_MESSAGE : OUTAGE_MESSAGE;
  const error$ = new SocialError(message, 503);
  error$.cause = error;
  error$.logged = { message: error?.message || String(error), code: error?.code || "", table: error?.table || scope };
  return error$;
}

export function createSocialRouter({ service, accounts, accountsBackend, currentSession, sendJson, sendError, authOptions, readJson, rateLimit }) {
  const options = (request) => authOptions(request);

  async function student(request, response) {
    if (accountsBackend === "unavailable" || !accounts) {
      sendError(response, 503, "Student accounts are temporarily unavailable. Please try again later.", options(request));
      return null;
    }
    const session = await currentSession(request);
    if (!session) {
      sendError(response, 401, LOGIN_MESSAGE, options(request));
      return null;
    }
    const account = await accounts.findById(session.userId);
    if (!account) {
      sendError(response, 401, "That account could not be found. Sign in again.", options(request));
      return null;
    }
    return {
      account,
      user: {
        id: account.id,
        username: account.username,
        avatarSeed: account.avatarSeed || "",
        xp: account.xp || 0,
        streak: account.streak || 0,
      },
    };
  }

  function limited(request, response, bucket, limit, windowMs = 60_000, message = "Too many requests. Take a short break and try again.") {
    if (rateLimit(request, bucket, limit, windowMs)) return true;
    sendError(response, 429, message, options(request));
    return false;
  }

  const json = (request, response, payload) => sendJson(response, 200, { ok: true, ...payload }, options(request));
  const body = async (request) => {
    try {
      return await readJson(request);
    } catch {
      throw new SocialError("That request could not be read. Refresh and try again.");
    }
  };

  const logged = new Set();

  return async function routeSocial({ request, response, apiPath, url }) {
    if (!apiPath.startsWith("/api/social/") && !apiPath.startsWith("/api/games/")) return false;
    try {
      return await handle({ request, response, apiPath, url });
    } catch (error) {
      const wrapped = failure(error, apiPath);
      if (wrapped.logged) {
        const key = `${wrapped.logged.code}:${wrapped.logged.message}`;
        if (!logged.has(key)) {
          logged.add(key);
          console.error(`[vignan-ai] social store error at ${apiPath}:`, wrapped.logged.message, wrapped.logged.code || "", wrapped.logged.table ? `(${wrapped.logged.table})` : "");
        }
      }
      if (!response.headersSent) sendError(response, wrapped.status || 503, wrapped.message, options(request));
      return true;
    }
  };

  async function handle({ request, response, apiPath, url }) {
    const method = request.method;
    const who = await student(request, response);
    if (!who) return true;
    const { user } = who;

    if (apiPath === "/api/social/state" && method === "GET") {
      if (!limited(request, response, `social-state:${user.id}`, 240, 60_000)) return true;
      json(request, response, await service.state(user));
      return true;
    }

    if (apiPath === "/api/social/people" && method === "GET") {
      if (!limited(request, response, `social-people:${user.id}`, 40, 60_000)) return true;
      const people = await service.search(user, url.searchParams.get("q") || "");
      json(request, response, { people });
      return true;
    }

    if (apiPath === "/api/social/friends/request" && method === "POST") {
      if (!limited(request, response, `friend-request:${user.id}`, 12, 10 * 60_000, "That is a lot of friend requests. Please wait a few minutes.")) return true;
      const data = await body(request);
      json(request, response, await service.requestFriend(user, data.username));
      return true;
    }

    if (apiPath === "/api/social/friends/respond" && method === "POST") {
      if (!limited(request, response, `friend-respond:${user.id}`, 40, 10 * 60_000)) return true;
      const data = await body(request);
      json(request, response, await service.respondToRequest(user, data.requestId, Boolean(data.accept)));
      return true;
    }

    if (apiPath === "/api/social/friends/remove" && method === "POST") {
      if (!limited(request, response, `friend-remove:${user.id}`, 20, 10 * 60_000)) return true;
      const data = await body(request);
      json(request, response, await service.removeFriend(user, String(data.userId || "")));
      return true;
    }

    if (apiPath === "/api/social/notifications/read" && method === "POST") {
      if (!limited(request, response, `notify-read:${user.id}`, 60, 60_000)) return true;
      const data = await body(request);
      json(request, response, await service.markNotifications(user, Array.isArray(data.ids) ? data.ids : null));
      return true;
    }

    if (apiPath === "/api/social/chat/open" && method === "POST") {
      if (!limited(request, response, `chat-open:${user.id}`, 60, 60_000)) return true;
      const data = await body(request);
      json(request, response, await service.openChat(user, {
        friendId: String(data.friendId || ""),
        threadId: String(data.threadId || ""),
      }));
      return true;
    }

    if (apiPath === "/api/social/chat/messages" && method === "GET") {
      if (!limited(request, response, `chat-read:${user.id}`, 240, 60_000)) return true;
      json(request, response, await service.messageList(
        user,
        url.searchParams.get("threadId") || "",
        url.searchParams.get("after") || "",
      ));
      return true;
    }

    if (apiPath === "/api/social/chat/send" && method === "POST") {
      if (!limited(request, response, `chat-send:${user.id}`, 20, 60_000, "Slow down a little — you can send 20 messages a minute.")) return true;
      const data = await body(request);
      json(request, response, await service.sendMessage(user, data.threadId, data.body));
      return true;
    }

    if (apiPath === "/api/games/catalogue" && method === "GET") {
      const { GAME_LIST } = await import("./games.mjs");
      json(request, response, { games: GAME_LIST });
      return true;
    }

    if (apiPath === "/api/games/create" && method === "POST") {
      if (!limited(request, response, `game-create:${user.id}`, 20, 10 * 60_000)) return true;
      const data = await body(request);
      json(request, response, await service.startGame(user, {
        kind: String(data.kind || ""),
        friendId: String(data.friendId || ""),
      }));
      return true;
    }

    if (apiPath === "/api/games/quick" && method === "POST") {
      if (!limited(request, response, `game-quick:${user.id}`, 30, 10 * 60_000)) return true;
      const data = await body(request);
      json(request, response, await service.quickMatch(user, String(data.kind || "")));
      return true;
    }

    if (apiPath === "/api/games/join" && method === "POST") {
      if (!limited(request, response, `game-join:${user.id}`, 40, 10 * 60_000)) return true;
      const data = await body(request);
      if (data.code) json(request, response, await service.joinByCode(user, data.code));
      else json(request, response, await service.joinGameById(user, String(data.gameId || "")));
      return true;
    }

    if (apiPath === "/api/games/move" && method === "POST") {
      if (!limited(request, response, `game-move:${user.id}`, 180, 60_000, "Too many moves at once. Wait for the board to catch up.")) return true;
      const data = await body(request);
      json(request, response, await service.move(user, data.gameId, data.move || {}));
      return true;
    }

    if (apiPath === "/api/games/resign" && method === "POST") {
      if (!limited(request, response, `game-resign:${user.id}`, 30, 10 * 60_000)) return true;
      const data = await body(request);
      json(request, response, await service.resign(user, data.gameId));
      return true;
    }

    if (apiPath.startsWith("/api/games/") && method === "GET") {
      if (!limited(request, response, `game-read:${user.id}`, 300, 60_000)) return true;
      const id = decodeURIComponent(apiPath.slice("/api/games/".length));
      if (!id || id.includes("/")) {
        sendError(response, 404, "Unknown game.", options(request));
        return true;
      }
      json(request, response, await service.game(user, id));
      return true;
    }

    sendError(response, 404, "Unknown social endpoint.", options(request));
    return true;
  }
}
