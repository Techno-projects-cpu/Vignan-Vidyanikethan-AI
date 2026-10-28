/**
 * A small, complete chess rules engine.
 *
 * The same module runs in the browser (to highlight legal moves) and on the
 * server (to validate every move), so a student cannot submit an illegal or
 * out-of-turn move by editing requests. It has no dependencies and no UI.
 *
 * Squares are 0–63, reading like a text page: 0 is a8 and 63 is h1.
 * Pieces are two-letter codes such as "wp" (white pawn) or "bk" (black king).
 */

export const FILES = "abcdefgh";
export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const OFFSETS = {
  n: [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]],
  k: [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]],
  b: [[-1, -1], [-1, 1], [1, -1], [1, 1]],
  r: [[-1, 0], [1, 0], [0, -1], [0, 1]],
};
OFFSETS.q = [...OFFSETS.b, ...OFFSETS.r];

const VALID_CODE = /^[wb][pnbrqk]$/;
const colorOf = (piece) => (piece ? piece[0] : "");
const typeOf = (piece) => (piece ? piece[1] : "");
const other = (color) => (color === "w" ? "b" : "w");

export function squareName(index) {
  if (!Number.isInteger(index) || index < 0 || index > 63) return "?";
  return `${FILES[index % 8]}${8 - Math.floor(index / 8)}`;
}

export function squareIndex(name) {
  const match = /^([a-h])([1-8])$/.exec(String(name || "").toLowerCase());
  if (!match) return -1;
  return (8 - Number(match[2])) * 8 + FILES.indexOf(match[1]);
}

export function initialPosition() {
  return fromFen(START_FEN);
}

export function fromFen(fen) {
  const [placement, turn, castling, ep, halfmove, fullmove] = String(fen || START_FEN).trim().split(/\s+/);
  const board = Array(64).fill("");
  let index = 0;
  for (const char of placement || "") {
    if (char === "/") continue;
    if (/[1-8]/.test(char)) {
      index += Number(char);
      continue;
    }
    const color = char === char.toUpperCase() ? "w" : "b";
    const type = char.toLowerCase();
    if (!"pnbrqk".includes(type) || index > 63) throw new Error("Invalid FEN placement.");
    board[index] = `${color}${type}`;
    index += 1;
  }
  if (index !== 64) throw new Error("Invalid FEN board size.");
  return normalizeState({
    board,
    turn: turn === "b" ? "b" : "w",
    castling: /^[-KQkq]+$/.test(castling || "-") ? castling.replace("-", "") : "KQkq",
    ep: squareIndex(ep || ""),
    halfmove: Number(halfmove) || 0,
    fullmove: Number(fullmove) || 1,
  });
}

export function toFen(state) {
  const rows = [];
  for (let row = 0; row < 8; row += 1) {
    let text = "";
    let gap = 0;
    for (let col = 0; col < 8; col += 1) {
      const piece = state.board[row * 8 + col];
      if (!piece) { gap += 1; continue; }
      if (gap) { text += gap; gap = 0; }
      text += piece[0] === "w" ? piece[1].toUpperCase() : piece[1];
    }
    if (gap) text += gap;
    rows.push(text);
  }
  const castling = state.castling || "-";
  const ep = state.ep === null || state.ep === undefined ? "-" : squareName(state.ep);
  return `${rows.join("/")} ${state.turn} ${castling || "-"} ${ep} ${state.halfmove || 0} ${state.fullmove || 1}`;
}

/** Reject stored states that were edited or corrupted into an invalid shape. */
export function normalizeState(raw = {}) {
  const board = Array.isArray(raw.board) ? raw.board.map((cell) => (typeof cell === "string" && VALID_CODE.test(cell) ? cell : "")) : [];
  if (board.length !== 64) throw new Error("A chess board must have 64 squares.");
  const kings = board.reduce((counts, piece) => {
    if (typeOf(piece) === "k") counts[colorOf(piece)] += 1;
    return counts;
  }, { w: 0, b: 0 });
  if (kings.w !== 1 || kings.b !== 1) throw new Error("A chess position needs exactly one king per side.");
  const castling = String(raw.castling || "").replace(/[^KQkq]/g, "");
  return {
    board,
    turn: raw.turn === "b" ? "b" : "w",
    castling,
    ep: Number.isInteger(raw.ep) && raw.ep >= 0 && raw.ep < 64 ? raw.ep : null,
    halfmove: Math.max(0, Math.min(200, Number(raw.halfmove) || 0)),
    fullmove: Math.max(1, Math.min(10_000, Number(raw.fullmove) || 1)),
  };
}

function inside(row, col) {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

function movePawnAttacks(row, col, color) {
  const direction = color === "w" ? -1 : 1;
  return [[row + direction, col - 1], [row + direction, col + 1]];
}

function eachOffset(row, col, offsets, callback) {
  for (const [dr, dc] of offsets) {
    const r = row + dr;
    const c = col + dc;
    if (inside(r, c)) callback(r * 8 + c, r, c);
  }
}

function sliding(state, row, col, offsets, color, out) {
  for (const [dr, dc] of offsets) {
    let r = row + dr;
    let c = col + dc;
    while (inside(r, c)) {
      const target = r * 8 + c;
      const piece = state.board[target];
      if (!piece) out.push({ from: row * 8 + col, to: target });
      else {
        if (colorOf(piece) !== color) out.push({ from: row * 8 + col, to: target });
        break;
      }
      r += dr;
      c += dc;
    }
  }
}

export function isSquareAttacked(state, index, byColor) {
  const row = Math.floor(index / 8);
  const col = index % 8;
  // Pawns
  for (const [r, c] of movePawnAttacks(row, col, other(byColor))) {
    if (!inside(r, c)) continue;
    const piece = state.board[r * 8 + c];
    if (piece === `${byColor}p`) return true;
  }
  // Knights and king
  for (const [offsets, type] of [[OFFSETS.n, "n"], [OFFSETS.k, "k"]]) {
    for (const [dr, dc] of offsets) {
      const r = row + dr;
      const c = col + dc;
      if (!inside(r, c)) continue;
      if (state.board[r * 8 + c] === `${byColor}${type}`) return true;
    }
  }
  // Sliders
  for (const [offsets, types] of [[OFFSETS.r, "rq"], [OFFSETS.b, "bq"]]) {
    for (const [dr, dc] of offsets) {
      let r = row + dr;
      let c = col + dc;
      while (inside(r, c)) {
        const piece = state.board[r * 8 + c];
        if (piece) {
          if (colorOf(piece) === byColor && types.includes(typeOf(piece))) return true;
          break;
        }
        r += dr;
        c += dc;
      }
    }
  }
  return false;
}

export function kingSquare(state, color) {
  return state.board.indexOf(`${color}k`);
}

export function inCheck(state, color = state.turn) {
  const king = kingSquare(state, color);
  return king >= 0 && isSquareAttacked(state, king, other(color));
}

function castlingFlags(color) {
  return color === "w" ? ["K", "Q"] : ["k", "q"];
}

function castlingSquares(color, side) {
  const row = color === "w" ? 7 : 0;
  if (String(side).toUpperCase() === "K") return { kingFrom: row * 8 + 4, kingTo: row * 8 + 6, rookFrom: row * 8 + 7, rookTo: row * 8 + 5, empty: [row * 8 + 5, row * 8 + 6], pass: [row * 8 + 4, row * 8 + 5, row * 8 + 6] };
  return { kingFrom: row * 8 + 4, kingTo: row * 8 + 2, rookFrom: row * 8 + 0, rookTo: row * 8 + 3, empty: [row * 8 + 1, row * 8 + 2, row * 8 + 3], pass: [row * 8 + 4, row * 8 + 3, row * 8 + 2] };
}

function pseudoMoves(state, color) {
  const moves = [];
  for (let index = 0; index < 64; index += 1) {
    const piece = state.board[index];
    if (!piece || colorOf(piece) !== color) continue;
    const row = Math.floor(index / 8);
    const col = index % 8;
    const type = typeOf(piece);
    if (type === "p") {
      const direction = color === "w" ? -1 : 1;
      const startRow = color === "w" ? 6 : 1;
      const lastRow = color === "w" ? 0 : 7;
      const oneRow = row + direction;
      if (inside(oneRow, col) && !state.board[oneRow * 8 + col]) {
        const one = oneRow * 8 + col;
        if (oneRow === lastRow) for (const promotion of "qrbn") moves.push({ from: index, to: one, promotion });
        else {
          moves.push({ from: index, to: one });
          const twoRow = row + direction * 2;
          if (row === startRow && !state.board[twoRow * 8 + col]) moves.push({ from: index, to: twoRow * 8 + col });
        }
      }
      for (const [r, c] of movePawnAttacks(row, col, color)) {
        if (!inside(r, c)) continue;
        const target = r * 8 + c;
        const victim = state.board[target];
        if (victim && colorOf(victim) !== color) {
          if (r === lastRow) for (const promotion of "qrbn") moves.push({ from: index, to: target, promotion });
          else moves.push({ from: index, to: target });
        } else if (!victim && state.ep === target && victim === "") {
          // En passant: the captured pawn is beside the destination.
          moves.push({ from: index, to: target, enPassant: true });
        }
      }
    } else if (type === "n") {
      eachOffset(row, col, OFFSETS.n, (target) => {
        const victim = state.board[target];
        if (!victim || colorOf(victim) !== color) moves.push({ from: index, to: target });
      });
    } else if (type === "k") {
      eachOffset(row, col, OFFSETS.k, (target) => {
        const victim = state.board[target];
        if (!victim || colorOf(victim) !== color) moves.push({ from: index, to: target });
      });
      for (const side of castlingFlags(color)) {
        if (!state.castling.includes(side)) continue;
        const plan = castlingSquares(color, String(side).toUpperCase());
        if (state.board[plan.kingFrom] !== `${color}k`) continue;
        if (state.board[plan.rookFrom] !== `${color}r`) continue;
        if (plan.empty.some((square) => state.board[square])) continue;
        if (plan.pass.some((square) => isSquareAttacked(state, square, other(color)))) continue;
        moves.push({ from: plan.kingFrom, to: plan.kingTo, castle: side });
      }
    } else {
      sliding(state, row, col, OFFSETS[type], color, moves);
    }
  }
  return moves;
}

/** Apply a move without checking legality. Used inside move generation. */
export function applyUnchecked(state, move) {
  const board = [...state.board];
  const piece = board[move.from];
  if (!piece) throw new Error("No piece on the starting square.");
  const color = colorOf(piece);
  const type = typeOf(piece);
  const next = {
    board,
    turn: other(state.turn),
    castling: state.castling,
    ep: null,
    halfmove: state.halfmove + 1,
    fullmove: state.fullmove + (state.turn === "b" ? 1 : 0),
  };
  if (type === "p" || board[move.to]) next.halfmove = 0;

  // En passant removes the pawn behind the destination square.
  if (move.enPassant || (type === "p" && state.ep === move.to && !board[move.to] && Math.abs(move.to - move.from) % 8 !== 0)) {
    const captured = move.to + (color === "w" ? 8 : -8);
    if (typeOf(board[captured]) === "p") board[captured] = "";
    next.halfmove = 0;
  }

  board[move.to] = move.promotion ? `${color}${move.promotion}` : piece;
  board[move.from] = "";

  if (type === "k" && Math.abs(move.to - move.from) === 2) {
    const side = move.to > move.from ? "K" : "Q";
    const plan = castlingSquares(color, String(side).toUpperCase());
    board[plan.rookTo] = board[plan.rookFrom];
    board[plan.rookFrom] = "";
  }

  // Pawn double push exposes an en-passant target.
  if (type === "p" && Math.abs(move.to - move.from) === 16) next.ep = (move.from + move.to) / 2;

  // Castling rights disappear when a king or rook leaves home, or a rook is taken.
  let castling = next.castling;
  const drop = (flags) => { for (const flag of flags) castling = castling.replace(flag, ""); };
  if (type === "k") drop(castlingFlags(color));
  if (type === "r") {
    const row = color === "w" ? 7 : 0;
    if (move.from === row * 8 + 0) drop([color === "w" ? "Q" : "q"]);
    if (move.from === row * 8 + 7) drop([color === "w" ? "K" : "k"]);
  }
  const enemy = other(color);
  const enemyRow = enemy === "w" ? 7 : 0;
  if (move.to === enemyRow * 8 + 0) drop([enemy === "w" ? "Q" : "q"]);
  if (move.to === enemyRow * 8 + 7) drop([enemy === "w" ? "K" : "k"]);
  next.castling = castling;
  return next;
}

export function legalMoves(state, from = null) {
  const color = state.turn;
  const candidates = pseudoMoves(state, color).filter((move) => from === null || move.from === from);
  return candidates.filter((move) => {
    const next = applyUnchecked(state, move);
    return !inCheck({ ...next, turn: color }, color);
  });
}

export function allLegalMoves(state) {
  return legalMoves(state, null);
}

/** Validate and apply a move using square indexes. */
export function playMove(rawState, move = {}) {
  const state = normalizeState(rawState);
  const from = Number(move.from);
  const to = Number(move.to);
  if (!Number.isInteger(from) || !Number.isInteger(to)) throw new Error("A move needs a from and to square.");
  const candidates = legalMoves(state, from).filter((candidate) => candidate.to === to);
  if (!candidates.length) throw new Error("That move is not legal.");
  const chosen = candidates.find((candidate) => !candidate.promotion || candidate.promotion === (move.promotion || "q")) || candidates[0];
  const next = applyUnchecked(state, chosen);
  const label = moveLabel(state, chosen);
  return { state: next, move: { from, to, promotion: chosen.promotion || "", castle: chosen.castle || "", label } };
}

/** Human-readable coordinate notation, e.g. "e2–e4" or "e7–e8=Q". */
export function moveLabel(state, move) {
  const piece = state.board[move.from] || "";
  const capture = Boolean(state.board[move.to]) || Boolean(move.enPassant);
  const suffix = move.promotion ? `=${move.promotion.toUpperCase()}` : "";
  const castle = move.castle === "K" || move.castle === "k" ? "O-O" : move.castle ? "O-O-O" : "";
  if (castle) return castle;
  return `${squareName(move.from)}${capture ? "×" : "–"}${squareName(move.to)}${suffix}${typeOf(piece) === "k" ? "" : ""}`;
}

export function insufficientMaterial(state) {
  const pieces = state.board.filter(Boolean);
  if (pieces.some((piece) => "pqr".includes(typeOf(piece)))) return false;
  const minors = pieces.filter((piece) => "nb".includes(typeOf(piece)));
  if (minors.length <= 1) return true;
  // King and bishop against king and bishop on same-coloured squares is dead.
  if (minors.length === 2 && minors.every((piece) => typeOf(piece) === "b")) {
    const squares = state.board.map((piece, index) => (typeOf(piece) === "b" ? index : -1)).filter((index) => index >= 0);
    const colorOfSquare = (index) => (Math.floor(index / 8) + index) % 2;
    return colorOfSquare(squares[0]) === colorOfSquare(squares[1]);
  }
  return false;
}

/**
 * Resolve the position: checkmate, stalemate, draw rules, or still playing.
 * `winner` is the colour that delivered mate, never a user id.
 */
export function gameStatus(state) {
  const moves = allLegalMoves(state);
  const check = inCheck(state, state.turn);
  if (!moves.length) {
    return check
      ? { over: true, result: "checkmate", winner: other(state.turn), check: true }
      : { over: true, result: "stalemate", winner: "", check: false };
  }
  if (state.halfmove >= 100) return { over: true, result: "fifty-move", winner: "", check };
  if (insufficientMaterial(state)) return { over: true, result: "insufficient", winner: "", check };
  return { over: false, result: "active", winner: "", check };
}
