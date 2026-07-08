import { Chess } from "chess.js";

import { chooseMove as builtinMove, type BotMove } from "./engine.js";
import { sfMove } from "./stockfish.js";

type Difficulty = "easy" | "medium" | "hard";

/**
 * Pick the computer's move for a position given as PGN ("" for the opening).
 * Uses real Stockfish; if it's unavailable or returns something unusable, falls
 * back to the built-in engine so the bot always moves.
 */
export async function getBotMove(
    pgn: string,
    difficulty: Difficulty = "medium"
): Promise<BotMove | null> {
    const chess = new Chess();
    if (pgn) chess.loadPgn(pgn);
    if (chess.isGameOver()) return null;

    const legal = chess.moves({ verbose: true });
    if (!legal.length) return null;

    try {
        const uci = await sfMove(chess.fen(), difficulty);
        if (uci && uci.length >= 4) {
            const from = uci.slice(0, 2);
            const to = uci.slice(2, 4);
            const promotion = uci.length > 4 ? uci[4] : undefined;
            // Trust but verify — only play it if chess.js agrees it's legal.
            if (legal.some((m) => m.from === from && m.to === to)) {
                return { from, to, promotion };
            }
        }
    } catch {
        // fall through to the built-in engine
    }

    return builtinMove(pgn, difficulty);
}
