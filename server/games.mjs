/**
 * Turn-based multiplayer games.
 *
 * All rules and answers are checked here, on the server, so a student cannot
 * win by editing requests. The browser only receives what it needs to render a
 * board or a question, never the answers of future rounds.
 */

import { START_FEN, gameStatus, moveLabel, normalizeState, playMove, squareName } from "../js/chess.js";
import { makeEquation, pickQuestions, pickTerm, seededRandom, shuffle } from "./game-content.mjs";

export const GAME_KINDS = {
  chess: {
    id: "chess",
    title: "Chess",
    blurb: "The classic. Board, castling, en passant and checkmate all enforced.",
    subject: "Logic",
    minPlayers: 2,
  },
  quiz: {
    id: "quiz",
    title: "Quiz Duel",
    blurb: "Eight syllabus questions, alternating turns, one point each.",
    subject: "All subjects",
    minPlayers: 2,
  },
  math: {
    id: "math",
    title: "Equation Race",
    blurb: "Mental maths under friendly pressure. Every answer is checked.",
    subject: "Mathematics",
    minPlayers: 2,
  },
  word: {
    id: "word",
    title: "Word Lab",
    blurb: "Unscramble a science or grammar term from its clue.",
    subject: "Science & English",
    minPlayers: 2,
  },
};

export const GAME_LIST = Object.values(GAME_KINDS);

const ROUNDS = 8;
const MAX_TEXT = 40;

export class GameError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "GameError";
    this.status = status;
  }
}

function opponentSlot(slot) {
  return slot === "host" ? "guest" : "host";
}

function slotOf(record, userId) {
  if (record.hostId === userId) return "host";
  if (record.guestId === userId) return "guest";
  return "";
}

export function gameName(record, slot) {
  return slot === "host" ? record.hostName : record.guestName;
}

/** Short public summary used in lists. */
export function gameSummary(record, userId) {
  const slot = slotOf(record, userId);
  return {
    id: record.id,
    kind: record.kind,
    title: GAME_KINDS[record.kind]?.title || "Game",
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    status: record.status,
    code: record.code,
    host: { name: record.hostName },
    guest: { name: record.guestName },
    opponent: slot === "host" ? record.guestName : record.hostName,
    yourTurn: record.status === "active" && record.turn === slot,
    score: { you: record.score[slot] || 0, them: record.score[opponentSlot(slot)] || 0 },
    result: record.result ? { winner: record.result.winner, reason: record.result.reason } : null,
  };
}

function freshScore() {
  return { host: 0, guest: 0 };
}

function triviaRound(record, index) {
  const difficulty = index >= ROUNDS - 3 ? 3 : 2;
  if (record.kind === "math") {
    const equation = makeEquation({ seed: record.seed, index, difficulty });
    return { prompt: equation.prompt, hint: equation.hint, answer: equation.answer, subject: "maths" };
  }
  if (record.kind === "word") {
    const term = pickTerm({ seed: record.seed, index });
    return { prompt: term.letters.join(" "), clue: term.clue, answer: term.answer, subject: term.subject, letters: term.letters };
  }
  const question = record.pool[index];
  return { prompt: question.prompt, options: question.options, answer: question.answer, subject: question.subject };
}

function publicRound(record, index) {
  const round = record.rounds[index];
  if (!round) return null;
  const { answer, ...safe } = round;
  return { ...safe, index: index + 1, total: record.rounds.length };
}

export function createGame({ kind, host, guest = null, code = "", seed, now = Date.now() }) {
  const meta = GAME_KINDS[kind];
  if (!meta) throw new GameError("Unknown game.");
  const gameSeed = Number(seed) || Math.floor(Math.random() * 2 ** 31);
  const record = {
    id: `g${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    kind,
    seed: gameSeed,
    code: code || String(100000 + Math.floor(Math.random() * 900000)),
    hostId: host.id,
    hostName: host.username,
    guestId: guest ? guest.id : null,
    guestName: guest ? guest.username : null,
    status: guest ? "active" : "waiting",
    turn: "host",
    score: freshScore(),
    rounds: [],
    index: 0,
    answered: [],
    pool: [],
    chess: null,
    result: null,
    createdAt: now,
    updatedAt: now,
    startedAt: guest ? now : null,
    finishedAt: null,
    rematchOf: "",
  };
  if (kind === "chess") {
    record.chess = { state: chessStart(), moves: [] };
  } else {
    record.pool = pickQuestions({ seed: gameSeed, count: ROUNDS });
    for (let index = 0; index < ROUNDS; index += 1) record.rounds.push(triviaRound(record, index));
  }
  return record;
}

function startingBoard() {
  const board = Array(64).fill("");
  const back = ["r", "n", "b", "q", "k", "b", "n", "r"];
  for (let col = 0; col < 8; col += 1) {
    board[col] = `b${back[col]}`;
    board[8 + col] = "bp";
    board[48 + col] = "wp";
    board[56 + col] = `w${back[col]}`;
  }
  return board;
}

// Replace the placeholder used above with a real starting board.
export function chessStart() {
  return normalizeState({ board: startingBoard(), turn: "w", castling: "KQkq", ep: null, halfmove: 0, fullmove: 1 });
}

export function joinGame(record, guest, now = Date.now()) {
  if (record.status !== "waiting") throw new GameError("This game has already started.", 409);
  if (record.hostId === guest.id) throw new GameError("You are already waiting in this game.", 409);
  record.guestId = guest.id;
  record.guestName = guest.username;
  record.status = "active";
  record.startedAt = now;
  record.updatedAt = now;
  return record;
}

function finish(record, { winner = "", reason }, now) {
  record.status = "finished";
  record.result = { winner, reason };
  record.finishedAt = now;
  record.updatedAt = now;
  return record;
}

export function resignGame(record, userId, now = Date.now()) {
  const slot = slotOf(record, userId);
  if (!slot) throw new GameError("You are not in this game.", 403);
  if (record.status === "finished") return record;
  finish(record, { winner: opponentSlot(slot), reason: "resign" }, now);
  return record;
}

function normalizeAnswer(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ").slice(0, MAX_TEXT);
}

function checkAnswer(round, kind, value) {
  if (kind === "math") {
    const expected = Number(String(round.answer).replace(/[^0-9.-]/g, ""));
    const given = Number(String(value).replace(/[^0-9.-]/g, ""));
    return Number.isFinite(expected) && Number.isFinite(given) && expected === given;
  }
  return normalizeAnswer(value) === normalizeAnswer(round.answer);
}

/**
 * Apply one player action. Returns feedback for the mover plus the updated
 * record; throws GameError for anything not allowed.
 */
export function playGameTurn(record, userId, payload = {}, now = Date.now()) {
  const slot = slotOf(record, userId);
  if (!slot) throw new GameError("You are not in this game.", 403);
  if (record.status === "waiting") throw new GameError("Wait for an opponent to join.", 409);
  if (record.status === "finished") throw new GameError("This game is already over.", 409);
  if (record.turn !== slot) throw new GameError("It is not your turn yet.", 409);

  if (record.kind === "chess") {
    let result;
    try {
      result = playMove(record.chess.state, { from: payload.from, to: payload.to, promotion: payload.promotion });
    } catch (error) {
      throw new GameError(error.message || "That move is not legal.", 400);
    }
    const status = gameStatus(result.state);
    record.chess.state = result.state;
    record.chess.moves.push({ by: slot, label: result.move.label, at: now });
    record.turn = opponentSlot(slot);
    record.updatedAt = now;
    if (status.over) {
      // The host always plays white, so a colour maps straight onto a slot.
      if (status.result === "checkmate") finish(record, { winner: status.winner === "w" ? "host" : "guest", reason: "checkmate" }, now);
      else finish(record, { winner: "", reason: status.result }, now);
    }
    return {
      record,
      feedback: { ok: true, label: result.move.label, check: status.check, over: status.over, result: status.result },
    };
  }

  const round = record.rounds[record.index];
  if (!round) throw new GameError("No round is open.", 409);
  const correct = checkAnswer(round, record.kind, payload.answer);
  if (correct) record.score[slot] += 1;
  record.answered.push({ index: record.index, by: slot, correct });
  record.index += 1;
  record.updatedAt = now;
  record.turn = opponentSlot(slot);
  const feedback = { ok: true, correct, answer: round.answer, index: record.index };
  if (record.kind === "word" && round.clue) feedback.answer = round.answer;
  if (record.index >= record.rounds.length) {
    const host = record.score.host;
    const guest = record.score.guest;
    const winner = host === guest ? "" : host > guest ? "host" : "guest";
    finish(record, { winner, reason: "completed" }, now);
  }
  return { record, feedback };
}

/** Everything one viewer may see. Answers for future rounds never leave here. */
export function publicGame(record, userId) {
  const slot = slotOf(record, userId);
  const base = {
    ...gameSummary(record, userId),
    you: slot,
    host: { name: record.hostName, id: record.hostId },
    guest: { name: record.guestName, id: record.guestId },
  };
  if (record.kind === "chess") {
    const moves = record.chess?.moves || [];
    return {
      ...base,
      chess: {
        board: record.chess.state.board,
        turn: record.chess.state.turn,
        castling: record.chess.state.castling,
        enPassant: record.chess.state.ep,
        moves: moves.map((move) => ({ by: move.by, label: move.label })),
        lastLabel: moves.length ? moves[moves.length - 1].label : "",
      },
      round: null,
    };
  }
  // The open question is only sent to the student whose turn it is, so the
  // waiting player cannot read ahead.
  const round = record.status === "active" && record.turn === slot ? publicRound(record, record.index) : null;
  return {
    ...base,
    chess: null,
    round: round ? { ...round, turn: record.turn } : null,
    progress: { index: record.index, total: record.rounds.length },
    history: record.answered.map((entry) => ({ ...entry })),
  };
}

/** A calm, readable summary of a finished game for the result card. */
export function gameResultText(record) {
  if (!record.result) return "In progress";
  const { winner, reason } = record.result;
  if (reason === "resign") return `${gameName(record, winner)} wins by resignation.`;
  if (reason === "checkmate") return `${gameName(record, winner)} wins by checkmate.`;
  if (winner === "") return reason === "stalemate" ? "Draw by stalemate." : "A draw.";
  return `${gameName(record, winner)} wins.`;
}

export { START_FEN, squareName, moveLabel, seededRandom, shuffle };
