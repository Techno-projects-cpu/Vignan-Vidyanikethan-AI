import test from "node:test";
import assert from "node:assert/strict";
import {
  START_FEN,
  applyUnchecked,
  allLegalMoves,
  fromFen,
  gameStatus,
  initialPosition,
  insufficientMaterial,
  legalMoves,
  playMove,
  squareIndex,
  squareName,
  toFen,
} from "../js/chess.js";

function perft(state, depth) {
  if (depth === 0) return 1;
  let total = 0;
  for (const move of allLegalMoves(state)) total += perft(applyUnchecked(state, move), depth - 1);
  return total;
}

test("board coordinates and FEN round-trip", () => {
  assert.equal(squareIndex("a8"), 0);
  assert.equal(squareIndex("h1"), 63);
  assert.equal(squareName(4), "e8");
  assert.equal(squareName(12), "e7");
  const start = initialPosition();
  assert.equal(toFen(start), START_FEN);
  assert.deepEqual(fromFen(toFen(start)), start);
});

test("move generation matches published perft counts", () => {
  const start = initialPosition();
  assert.equal(perft(start, 1), 20);
  assert.equal(perft(start, 2), 400);
  assert.equal(perft(start, 3), 8902);
});

test("castling, en passant and promotion positions match perft", () => {
  // Kiwipete: castling rights and many tactical options.
  const kiwipete = fromFen("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1");
  assert.equal(perft(kiwipete, 1), 48);
  assert.equal(perft(kiwipete, 2), 2039);
  // Position with an available en-passant capture.
  const ep = fromFen("8/8/8/KPp4r/1R3p1k/8/4P1P1/8 w - c6 0 1");
  // 16 replies: the en-passant capture bxc6 would expose the king to the h5 rook.
  assert.equal(perft(ep, 1), 16);
  // Promotion-rich position.
  const promo = fromFen("n1n5/PPPk4/8/8/8/8/4Kppp/5N1N b - - 0 1");
  assert.equal(perft(promo, 1), 24);
});

test("illegal moves are rejected instead of corrupting the board", () => {
  const start = initialPosition();
  assert.throws(() => playMove(start, { from: squareIndex("e2"), to: squareIndex("e5") }), /not legal/i);
  assert.throws(() => playMove(start, { from: squareIndex("e7"), to: squareIndex("e5") }), /not legal/i);
  assert.throws(() => playMove(start, { from: squareIndex("a1"), to: squareIndex("a3") }), /not legal/i);
});

test("castling moves the rook and cannot jump through check", () => {
  const open = fromFen("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
  const castled = playMove(open, { from: squareIndex("e1"), to: squareIndex("g1") });
  assert.equal(castled.state.board[squareIndex("g1")], "wk");
  assert.equal(castled.state.board[squareIndex("f1")], "wr");
  assert.equal(castled.state.board[squareIndex("h1")], "");
  assert.ok(!castled.state.castling.includes("K"));
  const blocked = fromFen("r3k2r/8/8/8/8/8/6r1/R3K2R w KQkq - 0 1");
  assert.ok(!legalMoves(blocked, squareIndex("e1")).some((move) => move.to === squareIndex("g1")));
});

test("en passant removes the captured pawn and expires", () => {
  const state = fromFen("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1");
  const result = playMove(state, { from: squareIndex("e5"), to: squareIndex("d6") });
  assert.equal(result.state.board[squareIndex("d5")], "");
  assert.equal(result.state.board[squareIndex("d6")], "wp");
  assert.equal(result.state.ep, null);
  const double = playMove(initialPosition(), { from: squareIndex("e2"), to: squareIndex("e4") });
  assert.equal(double.state.ep, squareIndex("e3"));
});

test("promotion offers four pieces and defaults to a queen", () => {
  const state = fromFen("8/P6k/8/8/8/8/8/K7 w - - 0 1");
  const moves = legalMoves(state, squareIndex("a7"));
  assert.deepEqual(moves.map((move) => move.promotion).sort(), ["b", "n", "q", "r"]);
  assert.equal(playMove(state, { from: squareIndex("a7"), to: squareIndex("a8") }).state.board[squareIndex("a8")], "wq");
  assert.equal(playMove(state, { from: squareIndex("a7"), to: squareIndex("a8"), promotion: "n" }).state.board[squareIndex("a8")], "wn");
});

test("checkmate and stalemate are detected with the right winner", () => {
  const mate = fromFen("7k/6Q1/6K1/8/8/8/8/8 b - - 0 1");
  assert.deepEqual(gameStatus(mate), { over: true, result: "checkmate", winner: "w", check: true });
  const stalemate = fromFen("7k/5Q2/5K2/8/8/8/8/8 b - - 0 1");
  assert.deepEqual(gameStatus(stalemate), { over: true, result: "stalemate", winner: "", check: false });
  // Fool's mate, played move by move.
  let state = initialPosition();
  for (const [from, to] of [["f2", "f3"], ["e7", "e5"], ["g2", "g4"], ["d8", "h4"]]) {
    state = playMove(state, { from: squareIndex(from), to: squareIndex(to) }).state;
  }
  assert.deepEqual(gameStatus(state), { over: true, result: "checkmate", winner: "b", check: true });
});

test("a pinned piece cannot capture en passant and expose its king", () => {
  const pinned = fromFen("8/8/8/KPp4r/1R3p1k/8/4P1P1/8 w - c6 0 1");
  assert.ok(!legalMoves(pinned).some((move) => move.to === squareIndex("c6")));
  const free = fromFen("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1");
  assert.ok(legalMoves(free).some((move) => move.to === squareIndex("d6") && move.enPassant));
});

test("draw rules cover fifty moves and dead positions", () => {
  assert.equal(gameStatus(fromFen("8/8/4k3/8/8/4K3/8/8 w - - 100 80")).result, "fifty-move");
  assert.equal(insufficientMaterial(fromFen("8/8/4k3/8/8/4K3/8/8 w - - 0 1")), true);
  assert.equal(insufficientMaterial(fromFen("8/8/4k3/8/8/4K3/8/5B2 w - - 0 1")), true);
  assert.equal(insufficientMaterial(fromFen("8/8/4k3/8/8/4K3/8/5R2 w - - 0 1")), false);
  for (const move of allLegalMoves(initialPosition())) {
    const castledState = applyUnchecked(initialPosition(), move);
    assert.equal(castledState.turn, "b");
  }
});
