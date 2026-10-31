import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createLocalSocialStore, STUDY_HALL_ID } from "../server/social-store.mjs";
import { createSocialService } from "../server/social.mjs";
import { GAME_KINDS } from "../server/games.mjs";

const A = { id: "00000000-0000-4000-8000-0000000000a1", username: "asha", avatarSeed: "seed-a1", xp: 120, streak: 4 };
const B = { id: "00000000-0000-4000-8000-0000000000b2", username: "bharat", avatarSeed: "seed-b2", xp: 90, streak: 2 };
const C = { id: "00000000-0000-4000-8000-0000000000c3", username: "chitra", avatarSeed: "seed-c3", xp: 200, streak: 9 };

async function harness() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "vignan-social-"));
  const store = createLocalSocialStore(path.join(directory, "social.json"));
  const service = createSocialService({ store });
  const cleanup = () => fs.rm(directory, { recursive: true, force: true });
  return { store, service, cleanup };
}

async function befriend(service, from, to) {
  await service.state(from);
  await service.state(to);
  await service.requestFriend(from, to.username);
  const inbox = await service.state(to);
  const request = inbox.requests.incoming.find((row) => row.from.username === from.username);
  assert.ok(request, "the request should reach the other student");
  return service.respondToRequest(to, request.id, true);
}

test("students can be found by username without leaking private profile data", async () => {
  const { service, cleanup } = await harness();
  try {
    await service.state(A);
    await service.state(B);
    const results = await service.search(A, "bha");
    assert.equal(results.length, 1);
    assert.equal(results[0].username, "bharat");
    assert.equal(results[0].relationship, "none");
    assert.deepEqual(Object.keys(results[0]).sort(), ["avatarSeed", "id", "online", "relationship", "streak", "username", "xp"]);
    assert.ok(!("ageBand" in results[0]) && !("gender" in results[0]));
    await assert.rejects(() => service.search(A, "b"), /two letters/i);
  } finally {
    await cleanup();
  }
});

test("friend requests create notifications and a two-way friendship", async () => {
  const { service, cleanup } = await harness();
  try {
    await service.state(A);
    await service.state(B);
    const sent = await service.requestFriend(A, "@BHARAT");
    assert.equal(sent.request.to.username, "bharat");

    const inbox = await service.state(B);
    assert.equal(inbox.requests.incoming.length, 1);
    assert.equal(inbox.unread, 1);
    assert.equal(inbox.notifications[0].kind, "friend_request");

    const accepted = await service.respondToRequest(B, inbox.requests.incoming[0].id, true);
    assert.equal(accepted.accepted, true);

    const friendState = await service.state(A);
    assert.equal(friendState.friends.length, 1);
    assert.equal(friendState.friends[0].username, "bharat");
    assert.equal(friendState.notifications[0].kind, "friend_accept");

    const bState = await service.state(B);
    assert.equal(bState.requests.incoming.length, 0);
    assert.equal(bState.friends[0].username, "asha");

    await assert.rejects(() => service.requestFriend(A, "asha"), /your own/i);
    await assert.rejects(() => service.requestFriend(A, "nobody"), /no student/i);
    await assert.rejects(() => service.requestFriend(A, "bharat"), /already friends/i);
  } finally {
    await cleanup();
  }
});

test("a student cannot answer somebody else's friend request", async () => {
  const { service, cleanup } = await harness();
  try {
    await service.state(A);
    await service.state(B);
    await service.state(C);
    await service.requestFriend(A, "bharat");
    const inbox = await service.state(B);
    const id = inbox.requests.incoming[0].id;
    await assert.rejects(() => service.respondToRequest(C, id, true), /not yours/i);
    // Declining removes it from the receiver's inbox and sends nothing back.
    await service.respondToRequest(B, id, false);
    const after = await service.state(B);
    assert.equal(after.requests.incoming.length, 0);
    assert.equal((await service.state(A)).friends.length, 0);
  } finally {
    await cleanup();
  }
});

test("friends can chat and messages are sanitized and deduplicated as notifications", async () => {
  const { service, cleanup } = await harness();
  try {
    await befriend(service, A, B);
    const { thread } = await service.openChat(A, { friendId: B.id });
    assert.equal(thread.kind, "dm");
    assert.equal(thread.title, "bharat");

    const sent = await service.sendMessage(A, thread.id, "  Can we revise refraction\u0007 tonight?\r\n\r\n\r\n\r\nOK  ");
    assert.equal(sent.message.body, "Can we revise refraction tonight?\n\nOK");
    assert.equal(sent.message.mine, true);

    await service.sendMessage(A, thread.id, "Second thought: chapter 10 too.");
    const inbox = await service.state(B);
    const messageAlerts = inbox.notifications.filter((row) => row.kind === "message");
    assert.equal(messageAlerts.length, 1, "one unread alert per conversation, not one per message");

    const messages = await service.messageList(B, thread.id);
    assert.equal(messages.messages.length, 2);
    assert.equal(messages.messages[0].mine, false);
    assert.equal(messages.messages[0].name, "asha");

    const later = await service.messageList(B, thread.id, messages.messages[0].at);
    assert.equal(later.messages.length, 1);

    const bThreads = (await service.state(B)).threads;
    assert.equal(bThreads.find((row) => row.id === thread.id).title, "asha");
    assert.match(bThreads.find((row) => row.id === thread.id).preview, /chapter 10/);

    await assert.rejects(() => service.sendMessage(A, thread.id, "   "), /write a message/i);
    await assert.rejects(() => service.sendMessage(A, thread.id, "x".repeat(501)), /under 500/i);
  } finally {
    await cleanup();
  }
});

test("private chat is limited to friends, study hall is open to everyone", async () => {
  const { service, cleanup } = await harness();
  try {
    await service.state(A);
    await service.state(C);
    await assert.rejects(() => service.openChat(A, { friendId: C.id }), /only message friends/i);

    const hall = await service.openChat(C, { threadId: STUDY_HALL_ID });
    assert.equal(hall.thread.kind, "hall");
    await service.sendMessage(C, hall.thread.id, "Anyone revising quadratic equations?");
    const other = await service.openChat(A, { threadId: STUDY_HALL_ID });
    const messages = await service.messageList(A, other.thread.id);
    assert.equal(messages.messages.at(-1).name, "chitra");
    assert.ok((await service.state(A)).threads.some((row) => row.kind === "hall"));
  } finally {
    await cleanup();
  }
});

test("notifications can be marked read", async () => {
  const { service, cleanup } = await harness();
  try {
    await service.state(A);
    await service.state(B);
    await service.requestFriend(A, "bharat");
    assert.equal((await service.state(B)).unread, 1);
    const marked = await service.markNotifications(B, null);
    assert.equal(marked.changed, 1);
    assert.equal(marked.unread, 0);
    assert.equal((await service.state(B)).unread, 0);
  } finally {
    await cleanup();
  }
});

test("chess games enforce turns, validate moves and notify both players", async () => {
  const { service, store, cleanup } = await harness();
  try {
    await befriend(service, A, B);
    const created = await service.startGame(A, { kind: "chess", friendId: B.id });
    const gameId = created.game.id;
    assert.equal(created.game.status, "waiting");
    assert.equal(created.game.you, "host");
    const invite = (await service.state(B)).notifications.find((row) => row.kind === "game_invite");
    assert.equal(invite.data.gameId, gameId);

    const joined = await service.joinGameById(B, gameId);
    assert.equal(joined.game.status, "active");
    assert.equal(joined.game.you, "guest");
    assert.equal((await service.state(A)).notifications.find((row) => row.kind === "game_start") !== undefined, true);

    // Black cannot open the game.
    await assert.rejects(() => service.move(B, gameId, { from: 52, to: 36 }), /not your turn/i);
    // White cannot play an illegal move.
    await assert.rejects(() => service.move(A, gameId, { from: 52, to: 28 }), /not legal/i);
    // Fool's mate.
    const moves = [
      [A, 53, 45], [B, 12, 28], [A, 54, 38], [B, 3, 39],
    ];
    for (const [who, from, to] of moves) {
      const result = await service.move(who, gameId, { from, to });
      assert.equal(result.feedback.ok, true);
    }
    const finished = await service.game(A, gameId);
    assert.equal(finished.game.status, "finished");
    assert.equal(finished.game.result.winner, "guest");
    assert.equal(finished.game.result.reason, "checkmate");
    const result = await service.game(B, gameId);
    assert.equal(result.game.you, "guest");
    assert.ok(result.game.chess.moves.length === 4);
    assert.equal((await service.state(B)).notifications.some((row) => row.kind === "game_finish"), true);
    // A finished game refuses more moves.
    await assert.rejects(() => service.move(A, gameId, { from: 52, to: 36 }), /already over/i);
    // Outsiders cannot peek.
    await service.state(C);
    await assert.rejects(() => service.game(C, gameId), /not in this game/i);
    assert.ok(await store.getGame(gameId));
  } finally {
    await cleanup();
  }
});

test("quiz answers stay on the server and scoring decides the winner", async () => {
  const { service, store, cleanup } = await harness();
  try {
    await befriend(service, A, B);
    const created = await service.startGame(A, { kind: "quiz" });
    const gameId = created.game.id;
    const joined = await service.joinGameById(B, gameId);
    assert.equal(joined.game.round, null, "the waiting player cannot read the open question");
    const hostView = await service.game(A, gameId);
    const view = hostView.game;
    assert.equal(view.round.total, 8);
    assert.equal(view.round.answer, undefined, "the answer must never be sent to the browser");
    assert.ok(view.round.options.length === 4);

    const record = await store.getGame(gameId);
    assert.ok(record.rounds[0].answer);

    // Host answers the first four correctly, guest misses one.
    let turn = A;
    for (let index = 0; index < 8; index += 1) {
      const authoritative = await store.getGame(gameId);
      const round = authoritative.rounds[authoritative.index];
      const answer = turn === A ? round.answer : index === 1 ? "definitely wrong" : round.answer;
      const result = await service.move(turn, gameId, { answer });
      assert.equal(result.feedback.correct, turn === A || index !== 1);
      turn = turn === A ? B : A;
      const nextView = await service.game(A, gameId);
      if (nextView.game.status === "active") {
        assert.equal(nextView.game.round?.answer, undefined);
      }
    }
    const finished = await service.game(A, gameId);
    assert.equal(finished.game.status, "finished");
    assert.equal(finished.game.score.you, 4);
    assert.equal(finished.game.score.them, 3);
    assert.equal(finished.game.result.winner, "host");
  } finally {
    await cleanup();
  }
});

test("quick match pairs two waiting students and join codes work", async () => {
  const { service, cleanup } = await harness();
  try {
    await befriend(service, A, B);
    await service.state(C);
    const first = await service.quickMatch(A, "math");
    assert.equal(first.game.status, "waiting");
    assert.match(first.game.code, /^\d{6}$/);

    const second = await service.quickMatch(B, "math");
    assert.equal(second.game.status, "active");
    assert.equal(second.game.id, first.game.id);

    const codeGame = await service.startGame(C, { kind: "word" });
    const joined = await service.joinByCode(B, codeGame.game.code);
    assert.equal(joined.game.status, "active", "a code also joins a game that was invited to somebody else");
    assert.equal(joined.game.id, codeGame.game.id);
    assert.equal(joined.game.status, "active");
    await assert.rejects(() => service.joinByCode(A, "000000"), /no open game|already/i);
    // An invite-only game is never auto-matched by quick match.
    const invited = await service.startGame(A, { kind: "quiz", friendId: B.id });
    const strayQuick = await service.quickMatch(C, "quiz");
    assert.notEqual(strayQuick.game.id, invited.game.id);
    assert.equal(strayQuick.game.status, "waiting");
    await assert.rejects(() => service.startGame(A, { kind: "nope" }), /choose a game/i);
  } finally {
    await cleanup();
  }
});

test("resigning ends the game and tells the other player", async () => {
  const { service, cleanup } = await harness();
  try {
    await befriend(service, A, B);
    const created = await service.startGame(A, { kind: "word" });
    await service.joinGameById(B, created.game.id);
    const resigned = await service.resign(A, created.game.id);
    assert.equal(resigned.game.status, "finished");
    assert.equal(resigned.game.result.winner, "guest");
    assert.equal(resigned.game.result.reason, "resign");
    const notices = (await service.state(B)).notifications.filter((row) => row.kind === "game_finish");
    assert.equal(notices.length, 1);
    assert.match(notices[0].body, /bharat wins by resignation/i);
    // Cancelling a waiting game is silent for the absent opponent.
    const waiting = await service.startGame(B, { kind: "chess" });
    const cancelled = await service.resign(B, waiting.game.id);
    assert.equal(cancelled.game.result.reason, "cancelled");
  } finally {
    await cleanup();
  }
});

test("game catalogue stays academic and full", () => {
  assert.deepEqual(Object.keys(GAME_KINDS).sort(), ["chess", "math", "quiz", "word"]);
  for (const game of Object.values(GAME_KINDS)) {
    assert.ok(game.title && game.blurb && game.subject);
  }
});

test("classmates are suggested before anything is typed, minus existing friends", async () => {
  const { service, cleanup } = await harness();
  try {
    await service.state(A);
    await service.state(B);
    await service.state(C);
    const first = await service.suggestions(A);
    assert.equal(first.length, 2, "both other students are offered");
    assert.ok(first.every((row) => row.id !== A.id), "never suggests yourself");
    assert.ok(first.every((row) => row.relationship === "none"), "nobody is already a friend");
    assert.ok(first.every((row) => row.username && row.xp !== undefined), "carries the public profile only");

    await befriend(service, A, B);
    const after = await service.suggestions(A);
    assert.deepEqual(after.map((row) => row.username), ["chitra"], "existing friends drop out");

    await service.requestFriend(A, "chitra");
    const pending = await service.suggestions(A);
    assert.equal(pending[0].relationship, "requested", "a pending request is still shown as pending");
  } finally {
    await cleanup();
  }
});
