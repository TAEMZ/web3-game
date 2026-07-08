import { Chess } from "chess.js";
import type { Move } from "chess.js";

/**
 * Self-contained chess engine for the Computer opponent.
 * Alpha-beta (negamax) search over chess.js with material + piece-square
 * evaluation. No external process, so it works offline and is fully testable.
 * A stronger engine (e.g. Stockfish WASM) could replace chooseMove() later
 * without touching the rest of the server.
 */

type Difficulty = "easy" | "medium" | "hard";
export type BotMove = { from: string; to: string; promotion?: string };

const PIECE: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

// Piece-square tables, white's perspective. board()[0] is rank 8, [7] is rank 1;
// column 0 is file a. Black pieces read the vertically-mirrored square.
// prettier-ignore
const PST: Record<string, number[][]> = {
  p: [
    [ 0,  0,  0,  0,  0,  0,  0,  0],
    [50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 20, 10, 10],
    [ 5,  5, 10, 25, 25, 10,  5,  5],
    [ 0,  0,  0, 20, 20,  0,  0,  0],
    [ 5, -5,-10,  0,  0,-10, -5,  5],
    [ 5, 10, 10,-20,-20, 10, 10,  5],
    [ 0,  0,  0,  0,  0,  0,  0,  0],
  ],
  n: [
    [-50,-40,-30,-30,-30,-30,-40,-50],
    [-40,-20,  0,  0,  0,  0,-20,-40],
    [-30,  0, 10, 15, 15, 10,  0,-30],
    [-30,  5, 15, 20, 20, 15,  5,-30],
    [-30,  0, 15, 20, 20, 15,  0,-30],
    [-30,  5, 10, 15, 15, 10,  5,-30],
    [-40,-20,  0,  5,  5,  0,-20,-40],
    [-50,-40,-30,-30,-30,-30,-40,-50],
  ],
  b: [
    [-20,-10,-10,-10,-10,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5, 10, 10,  5,  0,-10],
    [-10,  5,  5, 10, 10,  5,  5,-10],
    [-10,  0, 10, 10, 10, 10,  0,-10],
    [-10, 10, 10, 10, 10, 10, 10,-10],
    [-10,  5,  0,  0,  0,  0,  5,-10],
    [-20,-10,-10,-10,-10,-10,-10,-20],
  ],
  r: [
    [ 0,  0,  0,  0,  0,  0,  0,  0],
    [ 5, 10, 10, 10, 10, 10, 10,  5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [ 0,  0,  0,  5,  5,  0,  0,  0],
  ],
  q: [
    [-20,-10,-10, -5, -5,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5,  5,  5,  5,  0,-10],
    [ -5,  0,  5,  5,  5,  5,  0, -5],
    [  0,  0,  5,  5,  5,  5,  0, -5],
    [-10,  5,  5,  5,  5,  5,  0,-10],
    [-10,  0,  5,  0,  0,  0,  0,-10],
    [-20,-10,-10, -5, -5,-10,-10,-20],
  ],
  k: [
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-20,-30,-30,-40,-40,-30,-30,-20],
    [-10,-20,-20,-20,-20,-20,-20,-10],
    [ 20, 20,  0,  0,  0,  0, 20, 20],
    [ 20, 30, 10,  0,  0, 10, 30, 20],
  ],
};

const MATE = 100000;

// Static evaluation from white's perspective (positive = white is better).
function evaluate(chess: Chess): number {
  const board = chess.board();
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = board[r][c];
      if (!sq) continue;
      const val = PIECE[sq.type] + PST[sq.type][sq.color === "w" ? r : 7 - r][c];
      score += sq.color === "w" ? val : -val;
    }
  }
  return score;
}

// Captures (and promotions) first — this ordering makes alpha-beta prune hard.
function ordered(chess: Chess): Move[] {
  const moves = chess.moves({ verbose: true }) as Move[];
  return moves.sort((a, b) => moveScore(b) - moveScore(a));
}
function moveScore(m: Move): number {
  let s = 0;
  if (m.captured) s += 10 * PIECE[m.captured] - PIECE[m.piece];
  if (m.promotion) s += PIECE[m.promotion];
  return s;
}

// Negamax with alpha-beta. `color` is +1 when white is to move, -1 for black.
// `deadline` is an absolute ms timestamp; once passed, the branch bails out with
// a static eval so the bot stays responsive in heavy tactical positions.
function search(
  chess: Chess,
  depth: number,
  alpha: number,
  beta: number,
  color: number,
  deadline: number
): number {
  if (chess.isCheckmate()) return -MATE - depth; // prefer faster mates
  if (chess.isGameOver()) return 0; // stalemate / draw
  if (depth === 0 || Date.now() > deadline) return color * evaluate(chess);

  let best = -Infinity;
  for (const mv of ordered(chess)) {
    chess.move({ from: mv.from, to: mv.to, promotion: mv.promotion });
    const score = -search(chess, depth - 1, -beta, -alpha, -color, deadline);
    chess.undo();
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

const DEPTH: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3 };
const BUDGET_MS: Record<Difficulty, number> = { easy: 200, medium: 700, hard: 1500 };

/**
 * Pick the computer's move for the given position (PGN, "" for the opening).
 * Returns null only if there are no legal moves.
 */
export function chooseMove(pgn: string, difficulty: Difficulty = "medium"): BotMove | null {
  const chess = new Chess();
  if (pgn) chess.loadPgn(pgn);

  const legal = chess.moves({ verbose: true }) as Move[];
  if (!legal.length) return null;

  const norm = (m: Move): BotMove => ({ from: m.from, to: m.to, promotion: m.promotion });

  // Easy occasionally plays a random legal move so beginners can win.
  if (difficulty === "easy" && Math.random() < 0.45) {
    return norm(legal[Math.floor(Math.random() * legal.length)]);
  }

  const depth = DEPTH[difficulty] ?? 2;
  const deadline = Date.now() + (BUDGET_MS[difficulty] ?? 700);
  const color = chess.turn() === "w" ? 1 : -1;
  let best: Move | null = null;
  let bestScore = -Infinity;

  for (const mv of ordered(chess)) {
    chess.move({ from: mv.from, to: mv.to, promotion: mv.promotion });
    const score = -search(chess, depth - 1, -Infinity, Infinity, -color, deadline);
    chess.undo();
    // Randomly break ties so the bot isn't perfectly repetitive.
    if (score > bestScore || (score === bestScore && Math.random() < 0.3)) {
      bestScore = score;
      best = mv;
    }
  }
  return best ? norm(best) : norm(legal[0]);
}
