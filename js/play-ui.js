/**
 * Play: chess and three academic duels, with friends or a random classmate.
 *
 * The board and the questions are drawn from server data; the chess rules come
 * from the shared engine so legal moves can be highlighted without trusting
 * the client for anything the server also checks.
 */

import * as ui from "./ui.js?v=27";
import { legalMoves } from "./chess.js?v=27";
import { onSocialChange, setActiveGame, social, socialState, syncSocial } from "./social.js?v=27";
import { relativeTime } from "./friends-ui.js?v=27";

const $ = (selector, root = document) => root.querySelector(selector);

const GLYPHS = {
  wk: "♚", wq: "♛", wr: "♜", wb: "♝", wn: "♞", wp: "♟",
  bk: "♚", bq: "♛", br: "♜", bb: "♝", bn: "♞", bp: "♟",
};

const KIND_LABELS = {
  chess: "Chess",
  quiz: "Quiz Duel",
  math: "Equation Race",
  word: "Word Lab",
};

const play = {
  lobby: true,
  game: null,
  gameId: "",
  selected: -1,
  legal: [],
  promotion: null,
  answer: "",
  feedback: null,
  error: "",
  loading: false,
  timer: null,
  inviteFriend: null,
  joinCode: "",
  lastRender: "",
  initialised: false,
};

const openView = (view) => window.dispatchEvent(new CustomEvent("vignan:view", { detail: { view } }));
const refreshSocial = () => syncSocial().catch(() => {});

function arenaRoot() {
  return $("#play-arena");
}
function panelRoot() {
  return $("#play-panel");
}

/* --------------------------------------------------------------- lobby */

function gameCard(meta) {
  const card = ui.element("article", "game-card");
  card.dataset.kind = meta.id;
  const top = ui.element("div", "game-card-top");
  top.appendChild(ui.element("span", "game-glyph", meta.id === "chess" ? "♞" : meta.id === "quiz" ? "✓" : meta.id === "math" ? "÷" : "Aa"));
  const copy = ui.element("div", "game-card-copy");
  copy.appendChild(ui.element("h3", "", meta.title));
  copy.appendChild(ui.element("p", "", meta.blurb));
  copy.appendChild(ui.element("span", "game-subject", meta.subject));
  top.appendChild(copy);
  card.appendChild(top);

  const actions = ui.element("div", "game-card-actions");
  const quick = ui.element("button", "button primary small", "Quick match");
  quick.type = "button";
  quick.dataset.action = "quick";
  quick.addEventListener("click", () => startMatch(meta.id, ""));
  actions.appendChild(quick);
  if (play.inviteFriend) {
    const invite = ui.element("button", "button ghost small", `Invite ${play.inviteFriend.username}`);
    invite.type = "button";
    invite.dataset.action = "invite";
    invite.addEventListener("click", () => startMatch(meta.id, play.inviteFriend.id));
    actions.appendChild(invite);
  }
  card.appendChild(actions);
  return card;
}

function renderJoinCode(container) {
  const form = ui.element("form", "join-code");
  const label = ui.element("label", "join-code-label");
  label.appendChild(ui.element("span", "", "Join with a code"));
  const input = document.createElement("input");
  input.type = "text";
  input.inputMode = "numeric";
  input.maxLength = 6;
  input.placeholder = "6 digits";
  input.id = "join-code-input";
  input.autocomplete = "off";
  input.value = play.joinCode;
  input.addEventListener("input", () => {
    play.joinCode = input.value.replace(/\D/g, "").slice(0, 6);
  });
  label.appendChild(input);
  form.appendChild(label);
  const submit = ui.element("button", "button", "Join game");
  submit.type = "submit";
  form.appendChild(submit);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const code = (input.value || play.joinCode).replace(/\D/g, "");
    if (code.length !== 6) {
      ui.showToast("A game code has six digits.", "warning");
      return;
    }
    submit.disabled = true;
    try {
      const data = await social.joinGame({ code });
      play.joinCode = "";
      openGame(data.game.id, data.game);
      refreshSocial();
    } catch (error) {
      ui.showToast(error.message, "error");
      submit.disabled = false;
    }
  });
  container.appendChild(form);
}

function renderLobbyGames(data) {
  const waiting = data?.games?.waiting || [];
  const active = data?.games?.active || [];
  const finished = data?.games?.finished || [];
  if (!waiting.length && !active.length && !finished.length) return null;

  const wrap = ui.element("section", "card play-games");
  wrap.appendChild(ui.element("h2", "", "Your games"));
  if (active.length) {
    const list = ui.element("div", "social-list");
    for (const game of active) {
      const row = ui.element("button", "social-row social-row-button");
      row.type = "button";
      row.appendChild(ui.element("span", "social-avatar", "▷"));
      const copy = ui.element("div", "social-row-copy");
      copy.appendChild(ui.element("strong", "", game.title));
      copy.appendChild(ui.element("small", "", game.opponent ? `Against ${game.opponent}${game.yourTurn ? " · your turn" : ""}` : "Waiting"));
      row.appendChild(copy);
      row.appendChild(ui.element("span", "chip", game.yourTurn ? "Play" : "Live"));
      row.addEventListener("click", () => openGame(game.id));
      list.appendChild(row);
    }
    wrap.appendChild(list);
  }
  if (waiting.length) {
    const list = ui.element("div", "social-list");
    for (const game of waiting) {
      const row = ui.element("button", "social-row social-row-button");
      row.type = "button";
      row.appendChild(ui.element("span", "social-avatar", "…"));
      const copy = ui.element("div", "social-row-copy");
      copy.appendChild(ui.element("strong", "", game.title));
      copy.appendChild(ui.element("small", "", "Waiting for an opponent · code " + game.code));
      row.appendChild(copy);
      row.addEventListener("click", () => openGame(game.id));
      list.appendChild(row);
    }
    wrap.appendChild(list);
  }
  if (finished.length) {
    wrap.appendChild(ui.element("h3", "social-subhead", "Recently finished"));
    const list = ui.element("div", "social-list");
    for (const game of finished) {
      const row = ui.element("button", "social-row social-row-button");
      row.type = "button";
      row.appendChild(ui.element("span", "social-avatar", "✓"));
      const copy = ui.element("div", "social-row-copy");
      copy.appendChild(ui.element("strong", "", `${game.title} · ${game.score.you}–${game.score.them}`));
      copy.appendChild(ui.element("small", "", `${game.opponent || "Solo"} · ${relativeTime(game.updatedAt ? new Date(game.updatedAt).toISOString() : "")}`));
      row.appendChild(copy);
      row.addEventListener("click", () => openGame(game.id));
      list.appendChild(row);
    }
    wrap.appendChild(list);
  }
  return wrap;
}

export function renderPlay() {
  const panel = panelRoot();
  const arena = arenaRoot();
  if (!panel || !arena || !play.initialised) return;
  const app = socialState();

  if (!app.signedIn) {
    panel.hidden = false;
    arena.hidden = true;
    panel.textContent = "";
    const gate = ui.element("div", "social-gate");
    gate.appendChild(ui.element("span", "social-gate-mark", "♞"));
    gate.appendChild(ui.element("h3", "", "Games need a student account"));
    gate.appendChild(ui.element("p", "", "Log in to play chess and academic duels with classmates. Guest mode keeps the quizzes, flashcards and AI."));
    const actions = ui.element("div", "social-gate-actions");
    const go = ui.element("button", "button primary", "Log in or register");
    go.type = "button";
    go.addEventListener("click", () => openView("progress"));
    actions.appendChild(go);
    gate.appendChild(actions);
    panel.appendChild(gate);
    return;
  }

  if (!play.lobby && play.game) {
    panel.hidden = true;
    arena.hidden = false;
    renderArena();
    return;
  }

  panel.hidden = false;
  arena.hidden = true;
  const signature = JSON.stringify({
    invite: play.inviteFriend?.id || "",
    games: app.data?.games,
  });
  if (signature === play.lastRender) return;
  play.lastRender = signature;
  panel.textContent = "";

  if (play.inviteFriend) {
    const banner = ui.element("div", "play-invite-banner");
    banner.appendChild(ui.element("strong", "", `Choose a game for @${play.inviteFriend.username}`));
    const clear = ui.element("button", "button ghost small", "Cancel invite");
    clear.type = "button";
    clear.addEventListener("click", () => {
      play.inviteFriend = null;
      play.lastRender = "";
      renderPlay();
    });
    banner.appendChild(clear);
    panel.appendChild(banner);
  }

  const grid = ui.element("div", "game-grid");
  for (const meta of socialState().catalogue.length ? socialState().catalogue : Object.keys(KIND_LABELS).map((id) => ({ id, title: KIND_LABELS[id], blurb: "", subject: "" }))) {
    grid.appendChild(gameCard(meta));
  }
  panel.appendChild(grid);

  renderJoinCode(panel);

  const games = renderLobbyGames(app.data);
  if (games) panel.appendChild(games);

  panel.appendChild(ui.element("p", "social-hint", "Games are turned based, checked on the school server, and never use your real name beyond your username."));
}

async function startMatch(kind, friendId) {
  try {
    const data = friendId ? await social.createGame(kind, friendId) : await social.quickMatch(kind);
    if (friendId) play.inviteFriend = null;
    openGame(data.game.id, data.game);
    refreshSocial();
  } catch (error) {
    ui.showToast(error.message, "error");
  }
}

/* --------------------------------------------------------------- arena */

function exitArena() {
  play.lobby = true;
  play.game = null;
  play.gameId = "";
  play.selected = -1;
  play.legal = [];
  play.feedback = null;
  play.answer = "";
  setActiveGame("");
  if (play.timer) clearInterval(play.timer);
  play.timer = null;
  play.lastRender = "";
  play.lastArena = "";
  renderPlay();
}

export async function openGame(gameId, preloaded = null) {
  play.lobby = false;
  play.gameId = gameId;
  play.game = preloaded;
  play.selected = -1;
  play.legal = [];
  play.feedback = null;
  play.answer = "";
  play.error = "";
  play.lastArena = "";
  setActiveGame(gameId);
  openView("play");
  if (!preloaded) await fetchGame();
  schedulePoll();
  renderPlay();
}

async function fetchGame() {
  if (!play.gameId) return null;
  try {
    const data = await social.game(play.gameId);
    const previous = play.game;
    play.game = data.game;
    play.error = "";
    if (previous?.status !== data.game.status && data.game.status === "finished") {
      refreshSocial();
    }
    return data.game;
  } catch (error) {
    play.error = error.status === 403 ? "You are not part of this game." : error.message;
    return null;
  }
}

function schedulePoll() {
  if (play.timer) clearInterval(play.timer);
  play.timer = setInterval(async () => {
    if (document.visibilityState === "hidden" || !play.gameId || play.lobby) return;
    const game = await fetchGame();
    if (!game) {
      renderArena();
      return;
    }
    if (game.status === "finished" && play.game?.status === "finished" && play.feedback) {
      // Keep the final explanation visible until the student leaves.
      renderArena();
      return;
    }
    renderArena();
    if (game.status === "finished") refreshSocial();
  }, 2500);
}

function chessState(game) {
  return {
    board: game.chess.board,
    turn: game.chess.turn,
    castling: game.chess.castling,
    ep: game.chess.enPassant,
    halfmove: 0,
    fullmove: 1,
  };
}

function renderChess(arena, game) {
  const you = game.you;
  const yourColor = you === "host" ? "w" : "b";
  const flipped = yourColor === "b";
  const state = chessState(game);
  const interactive = game.status === "active" && game.yourTurn;

  const boardWrap = ui.element("div", "board-wrap");
  const board = ui.element("div", "chess-board");
  board.setAttribute("role", "group");
  board.setAttribute("aria-label", "Chess board");
  const lastMove = game.chess.moves.at(-1);

  for (let display = 0; display < 64; display += 1) {
    const index = flipped ? 63 - display : display;
    const piece = state.board[index];
    const file = "abcdefgh"[index % 8];
    const rank = 8 - Math.floor(index / 8);
    const square = ui.element("button", "chess-square");
    square.type = "button";
    square.dataset.index = String(index);
    square.dataset.square = `${file}${rank}`;
    const dark = (Math.floor(index / 8) + index) % 2 === 1;
    if (dark) square.classList.add("dark");
    if (play.selected === index) square.classList.add("selected");
    if (play.legal.some((move) => move.to === index)) square.classList.add(piece ? "capture" : "target");
    if (lastMove && (lastMove.label.includes(`${file}${rank}`))) square.classList.add("last");
    const glyph = ui.element("span", "chess-piece", piece ? GLYPHS[piece] || "" : "");
    if (piece) glyph.classList.add(piece[0] === "w" ? "white" : "black");
    square.appendChild(glyph);
    const label = piece ? `${piece[0] === "w" ? "White" : "Black"} ${piece[1]} on ${file}${rank}` : `${file}${rank} empty`;
    square.setAttribute("aria-label", label);
    if (interactive) square.addEventListener("click", () => onSquare(index));
    else square.disabled = true;
    board.appendChild(square);
  }
  boardWrap.appendChild(board);

  const side = ui.element("div", "board-side");
  const turnLine = ui.element("div", "board-turn");
  if (game.status === "active") {
    turnLine.textContent = game.yourTurn ? "Your move" : `Waiting for ${game.opponent || "opponent"}`;
  } else if (game.status === "waiting") {
    turnLine.textContent = "Waiting for an opponent";
  } else {
    turnLine.textContent = game.result?.reason === "checkmate" ? "Checkmate" : "Game over";
  }
  side.appendChild(turnLine);
  const score = ui.element("div", "board-score");
  score.appendChild(ui.element("span", "", `You ${you === "host" ? "· white" : "· black"}`));
  side.appendChild(score);
  if (game.chess.lastLabel) {
    side.appendChild(ui.element("p", "social-hint", `Last move ${game.chess.lastLabel}`));
  }
  const moves = game.chess.moves.slice(-6).reverse();
  if (moves.length) {
    const list = ui.element("ol", "board-moves");
    for (const move of moves) list.appendChild(ui.element("li", "", move.label));
    side.appendChild(list);
  }
  boardWrap.appendChild(side);
  arena.appendChild(boardWrap);

  if (play.promotion) arena.appendChild(promotionPicker(game));
  arena.appendChild(arenaFooter(game));
}

function promotionPicker(game) {
  const wrap = ui.element("div", "promotion-picker");
  wrap.appendChild(ui.element("span", "", "Promote to"));
  for (const [piece, label] of [["q", "Queen"], ["r", "Rook"], ["b", "Bishop"], ["n", "Knight"]]) {
    const choice = ui.element("button", "button ghost small", label);
    choice.type = "button";
    choice.addEventListener("click", () => submitMove(game, play.promotion.from, play.promotion.to, piece));
    wrap.appendChild(choice);
  }
  const cancel = ui.element("button", "button small", "Cancel");
  cancel.type = "button";
  cancel.addEventListener("click", () => {
    play.promotion = null;
    renderArena();
  });
  wrap.appendChild(cancel);
  return wrap;
}

function onSquare(index) {
  const game = play.game;
  if (!game || game.status !== "active" || !game.yourTurn) return;
  const state = chessState(game);
  const yourColor = game.you === "host" ? "w" : "b";
  const piece = state.board[index];

  if (play.selected >= 0) {
    const target = play.legal.find((move) => move.to === index);
    if (target) {
      if (target.promotion) {
        play.promotion = { from: play.selected, to: index };
        renderArena();
        return;
      }
      submitMove(game, play.selected, index);
      return;
    }
  }
  if (piece && piece[0] === yourColor) {
    play.selected = index;
    play.legal = legalMoves(state, index);
  } else {
    play.selected = -1;
    play.legal = [];
  }
  renderArena();
}

async function submitMove(game, from, to, promotion = "") {
  play.selected = -1;
  play.legal = [];
  play.promotion = null;
  try {
    const data = await social.move(game.id, { from, to, promotion });
    play.game = data.game;
    play.feedback = data.feedback;
    renderArena();
    if (data.game.status === "finished") refreshSocial();
  } catch (error) {
    ui.showToast(error.message, "error");
    await fetchGame();
    renderArena();
  }
}

function renderTrivia(arena, game) {
  const wrap = ui.element("div", "trivia-wrap");
  const head = ui.element("div", "trivia-head");
  head.appendChild(ui.element("span", "game-glyph small", GLYPH_FOR[game.kind] || "✓"));
  const copy = ui.element("div", "");
  copy.appendChild(ui.element("strong", "", game.title));
  copy.appendChild(ui.element("small", "", `You ${game.score.you} · ${game.opponent || "Opponent"} ${game.score.them}`));
  head.appendChild(copy);
  if (game.progress) head.appendChild(ui.element("span", "chip", `${Math.min(game.progress.index + 1, game.progress.total)} / ${game.progress.total}`));
  wrap.appendChild(head);

  if (play.feedback && play.feedback.answer !== undefined) {
    const note = ui.element("div", `trivia-feedback${play.feedback.correct ? " good" : " bad"}`);
    note.appendChild(ui.element("strong", "", play.feedback.correct ? "Correct" : "Not quite"));
    note.appendChild(ui.element("span", "", `Answer: ${play.feedback.answer}`));
    wrap.appendChild(note);
  }

  if (game.status === "finished") {
    arena.appendChild(wrap);
    arena.appendChild(arenaFooter(game));
    return;
  }

  if (!game.yourTurn || !game.round) {
    wrap.appendChild(ui.element("p", "trivia-wait", `Waiting for ${game.opponent || "your opponent"} to answer…`));
    arena.appendChild(wrap);
    arena.appendChild(arenaFooter(game));
    return;
  }

  const round = game.round;
  if (round.clue) wrap.appendChild(ui.element("p", "trivia-clue", round.clue));
  wrap.appendChild(ui.element("h3", "trivia-prompt", round.prompt));

  if (game.kind === "quiz") {
    const options = ui.element("div", "trivia-options");
    for (const option of round.options || []) {
      const choice = ui.element("button", "trivia-option", option);
      choice.type = "button";
      choice.disabled = play.loading;
      choice.addEventListener("click", () => answer(game, option, choice));
      options.appendChild(choice);
    }
    wrap.appendChild(options);
  } else {
    const form = ui.element("form", "trivia-form");
    const input = document.createElement("input");
    input.type = game.kind === "math" ? "text" : "text";
    input.inputMode = game.kind === "math" ? "numeric" : "text";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.placeholder = game.kind === "math" ? "Your answer" : "Type the word";
    input.id = "trivia-answer";
    input.value = play.answer;
    input.addEventListener("input", () => {
      play.answer = input.value;
    });
    form.appendChild(input);
    const submit = ui.element("button", "button primary", play.loading ? "Checking…" : "Answer");
    submit.type = "submit";
    submit.disabled = play.loading;
    form.appendChild(submit);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      answer(game, input.value);
    });
    wrap.appendChild(form);
    if (round.hint) wrap.appendChild(ui.element("p", "social-hint", round.hint));
    if (document.activeElement?.id !== "trivia-answer") {
      queueMicrotask(() => input.focus({ preventScroll: true }));
    }
  }
  arena.appendChild(wrap);
  arena.appendChild(arenaFooter(game));
}

const GLYPH_FOR = { chess: "♞", quiz: "✓", math: "÷", word: "Aa" };

async function answer(game, value, node = null) {
  if (play.loading) return;
  const clean = String(value ?? "").trim();
  if (!clean) return;
  play.loading = true;
  if (node) node.disabled = true;
  try {
    const data = await social.move(game.id, { answer: clean });
    play.feedback = data.feedback;
    play.answer = "";
    play.game = data.game;
    if (data.game.status === "finished") refreshSocial();
  } catch (error) {
    ui.showToast(error.message, "error");
    await fetchGame();
  } finally {
    play.loading = false;
    renderArena();
  }
}

function arenaFooter(game) {
  const footer = ui.element("div", "arena-footer");
  const back = ui.element("button", "button ghost", "← All games");
  back.type = "button";
  back.addEventListener("click", exitArena);
  footer.appendChild(back);

  if (game.status === "waiting") {
    const code = ui.element("div", "game-code");
    code.appendChild(ui.element("span", "", "Share code"));
    code.appendChild(ui.element("strong", "", game.code || ""));
    const copy = ui.element("button", "button small", "Copy code");
    copy.type = "button";
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(String(game.code));
        ui.showToast("Code copied. A friend can join from Play.", "success");
      } catch {
        ui.showToast(`Share this code: ${game.code}`, "info", 6000);
      }
    });
    code.appendChild(copy);
    footer.appendChild(code);

    const invite = ui.element("button", "button primary", "Invite a friend");
    invite.type = "button";
    invite.addEventListener("click", () => {
      exitArena();
      window.dispatchEvent(new CustomEvent("vignan:view", { detail: { view: "friends" } }));
      window.dispatchEvent(new CustomEvent("vignan:friends-tab", { detail: { tab: "friends" } }));
    });
    footer.appendChild(invite);
  }

  if (game.status === "active") {
    const resign = ui.element("button", "button ghost danger", "Resign");
    resign.type = "button";
    resign.addEventListener("click", async () => {
      const ok = await ui.confirmDialog({
        title: "Resign this game?",
        message: "The result is recorded for both players.",
        confirmLabel: "Resign",
        danger: true,
      });
      if (!ok) return;
      try {
        const data = await social.resign(game.id);
        play.game = data.game;
        renderArena();
        refreshSocial();
      } catch (error) {
        ui.showToast(error.message, "error");
      }
    });
    footer.appendChild(resign);
  }

  if (game.status === "finished") {
    const again = ui.element("button", "button primary", "Play again");
    again.type = "button";
    again.addEventListener("click", async () => {
      try {
        play.lobby = true;
        play.lastRender = "";
        play.game = null;
        play.gameId = "";
        setActiveGame("");
        const friendId = game.you === "host" ? game.guest?.id : game.host?.id;
        const data = await social.createGame(game.kind, friendId || "");
        openGame(data.game.id, data.game);
      } catch (error) {
        ui.showToast(error.message, "error");
      }
    });
    footer.appendChild(again);
  }
  return footer;
}

function resultCard(game) {
  const card = ui.element("section", "result-card");
  const youWon = game.result?.winner && game.result.winner === game.you;
  const draw = !game.result?.winner;
  card.appendChild(ui.element("span", "result-mark", draw ? "=" : youWon ? "★" : "·"));
  card.appendChild(ui.element("h3", "", draw ? "Draw" : youWon ? "You win" : "You lost"));
  const scoreLine = game.kind === "chess" ? "" : ` · ${game.score.you}–${game.score.them}`;
  card.appendChild(ui.element("p", "", `${game.result?.reason || "finished"}${scoreLine}`.replace(/^./, (letter) => letter.toUpperCase())));
  return card;
}

function renderArena() {
  const arena = arenaRoot();
  if (!arena) return;
  const game = play.game;
  if (!game) {
    arena.textContent = "";
    arena.appendChild(ui.element("p", "social-hint", play.error || "Loading the game…"));
    return;
  }
  const signature = JSON.stringify({
    status: game.status,
    turn: game.turn,
    yourTurn: game.yourTurn,
    index: game.progress?.index,
    score: game.score,
    moves: game.chess?.moves?.length,
    last: game.chess?.lastLabel,
    selected: play.selected,
    legal: play.legal.map((move) => move.to),
    promotion: Boolean(play.promotion),
    feedback: play.feedback,
    loading: play.loading,
    answer: play.answer,
    opponent: game.opponent,
    code: game.code,
  });
  if (signature === play.lastArena) return;
  play.lastArena = signature;
  arena.textContent = "";

  const head = ui.element("div", "arena-head");
  head.appendChild(ui.element("span", "eyebrow", "PLAYING NOW"));
  head.appendChild(ui.element("h2", "", game.title));
  const opponent = ui.element("p", "arena-opponent");
  opponent.textContent = game.opponent ? `You vs ${game.opponent}` : "Waiting for an opponent";
  head.appendChild(opponent);
  arena.appendChild(head);

  if (game.status === "finished") arena.appendChild(resultCard(game));
  if (game.kind === "chess") renderChess(arena, game);
  else renderTrivia(arena, game);
}

export function initPlayUI() {
  if (play.initialised) return;
  play.initialised = true;
  onSocialChange(() => {
    if (play.lobby) renderPlay();
  });
  // Returning to the tab should show the opponent's latest move immediately.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || play.lobby || !play.gameId) return;
    fetchGame().then((game) => {
      if (game) renderArena();
    });
  });
  social.catalogue()
    .then(() => {
      play.lastRender = "";
      renderPlay();
    })
    .catch(() => {});
  window.addEventListener("vignan:open-game", (event) => {
    const id = event.detail?.gameId;
    if (id) openGame(id);
  });
  window.addEventListener("vignan:play-invite", (event) => {
    const friendId = event.detail?.friendId;
    const friend = socialState().data?.friends?.find((row) => row.id === friendId);
    play.inviteFriend = friend ? { id: friend.id, username: friend.username } : null;
    play.lobby = true;
    play.lastRender = "";
    renderPlay();
  });
  renderPlay();
}

export function playActiveGame() {
  return play.gameId;
}
