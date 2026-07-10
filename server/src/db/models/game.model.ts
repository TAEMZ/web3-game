import type { Game, User } from "@arena/types";
import { db } from "../index.js";
import { mintReward, isTokenConfigured } from "../../web3/arena.js";
import WagerModel from "./wager.model.js";

export const activeGames: Game[] = [];

// Reward amounts (whole ARENA tokens), minted on-chain to the player's wallet.
const REWARD_WIN = Number(process.env.REWARD_WIN ?? 50);
const REWARD_DRAW = Number(process.env.REWARD_DRAW ?? 10);

// Look up a player's linked wallet address (null for guests/bots/unlinked).
const walletOf = async (userId?: number | string): Promise<string | null> => {
    if (!userId || typeof userId !== "number") return null;
    const r = await db.query(`SELECT wallet_address FROM "user" WHERE id=$1`, [userId]);
    return r.rowCount && r.rows[0].wallet_address ? (r.rows[0].wallet_address as string) : null;
};

// Mint the on-chain reward for a finished game. Runs fire-and-forget after the
// game is persisted; failures are logged and never break the game-over flow.
// No-ops (falls back to the DB-simulated balance) until the token is deployed.
const distributeRewards = async (game: Game, white: User, black: User): Promise<void> => {
    try {
        if (!isTokenConfigured()) return;
        if (game.winner === "draw") {
            for (const p of [white, black]) {
                const w = await walletOf(p.id);
                if (w) await mintReward(w, REWARD_DRAW);
            }
        } else if (game.winner === "white" || game.winner === "black") {
            const winner = game.winner === "white" ? white : black;
            const w = await walletOf(winner.id);
            if (w) await mintReward(w, REWARD_WIN);
            // (Resignation penalty is tracked in the DB only — players own their
            //  wallets now, so the platform can't burn from them without a signature.)
        }
    } catch (err) {
        console.error("[web3] distributeRewards error:", (err as Error).message);
    }
};

export const save = async (game: Game) => {
    try {
        const white: User = {};
        const black: User = {};
        if (typeof game.white?.id === "string") {
            white.name = game.white?.name;
        } else {
            white.id = game.white?.id;
        }
        if (typeof game.black?.id === "string") {
            black.name = game.black?.name;
        } else {
            black.id = game.black?.id;
        }
        const res = await db.query(
            `INSERT INTO "game"(winner, end_reason, pgn, white_id, white_name, black_id, black_name, started_at) VALUES($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [
                game.winner || null,
                game.endReason || null,
                game.pgn,
                white.id || null,
                white.name || null,
                black.id || null,
                black.name || null,
                new Date(game.startedAt as number)
            ]
        );
        if (black.id || white.id) {
            // draws
            if (game.winner === "draw") {
                if (white.id) {
                    await db.query(`UPDATE "user" SET draws = draws + 1 WHERE id = $1`, [white.id]);
                }
                if (black.id) {
                    await db.query(`UPDATE "user" SET draws = draws + 1 WHERE id = $1`, [black.id]);
                }
            } else {
                const winner = game.winner === "white" ? white : black;
                const loser = game.winner === "white" ? black : white;
                if (winner.id) {
                    await db.query(`UPDATE "user" SET wins = wins + 1 WHERE id = $1`, [winner.id]);
                }
                if (loser.id) {
                    await db.query(`UPDATE "user" SET losses = losses + 1 WHERE id = $1`, [
                        loser.id
                    ]);
                    // Quitting (resignation) carries an extra penalty on top of the loss,
                    // tracked here and subtracted from the player's token balance.
                    if (game.endReason === "resignation") {
                        await db.query(
                            `UPDATE "user" SET resignations = resignations + 1 WHERE id = $1`,
                            [loser.id]
                        );
                    }
                }
            }
        }
        // Fire-and-forget on-chain settlement (won't block the game-over flow):
        //  - mint the base ARENA reward to the winner
        //  - if this was a wager match, release the escrow pot to the winner
        void distributeRewards(game, white, black);
        void WagerModel.settleForGame(game);
        return {
            id: res.rows[0].id,
            winner: res.rows[0].winner,
            endReason: res.rows[0].reason,
            pgn: res.rows[0].pgn,
            white: {
                id: res.rows[0].white_id || undefined,
                name: res.rows[0].white_name || undefined
            },
            black: {
                id: res.rows[0].black_id || undefined,
                name: res.rows[0].black_name || undefined
            },
            startedAt: res.rows[0].started_at.getTime(),
            endedAt: res.rows[0].ended_at?.getTime() || undefined
        } as Game;
    } catch (err: unknown) {
        console.log(err);
        return null;
    }
};

export const findById = async (id: number) => {
    try {
        const res = await db.query(
            `SELECT game.id, game.winner, game.end_reason, game.pgn, white_user.id AS white_id, COALESCE(white_user.name, game.white_name) AS white_name, black_user.id AS black_id, started_at, ended_at, COALESCE(black_user.name, game.black_name) AS black_name FROM game LEFT JOIN "user" white_user ON white_user.id = game.white_id LEFT JOIN "user" black_user ON black_user.id = game.black_id WHERE game.id=$1`,
            [id]
        );
        if (res.rowCount) {
            return {
                id: res.rows[0].id,
                winner: res.rows[0].winner,
                endReason: res.rows[0].end_reason,
                pgn: res.rows[0].pgn,
                white: { id: res.rows[0].white_id || undefined, name: res.rows[0].white_name },
                black: { id: res.rows[0].black_id || undefined, name: res.rows[0].black_name },
                startedAt: res.rows[0].started_at.getTime(),
                endedAt: res.rows[0].ended_at?.getTime() || undefined
            } as Game;
        } else return null;
    } catch (err: unknown) {
        console.log(err);
        return null;
    }
};

export const findByUserId = async (id: number, limit = 10) => {
    if (id == 0) {
        return null;
    }
    try {
        // TODO: pagination
        const res = await db.query(
            `SELECT game.id, game.winner, game.end_reason, game.pgn, white_user.id AS white_id, COALESCE(white_user.name, game.white_name) AS white_name, black_user.id AS black_id, started_at, ended_at, COALESCE(black_user.name, game.black_name) AS black_name FROM game LEFT JOIN "user" white_user ON white_user.id = game.white_id LEFT JOIN "user" black_user ON black_user.id = game.black_id WHERE white_user.id=$1 OR black_user.id=$1 ORDER BY id DESC LIMIT $2`,
            [id, limit]
        );
        return res.rows.map((r) => {
            return {
                id: r.id,
                winner: r.winner,
                endReason: r.end_reason,
                pgn: r.pgn,
                white: { id: r.white_id || undefined, name: r.white_name },
                black: { id: r.black_id || undefined, name: r.black_name },
                startedAt: r.started_at.getTime(),
                endedAt: r.ended_at?.getTime() || undefined
            } as Game;
        });
    } catch (err: unknown) {
        console.log(err);
        return null;
    }
};

export const remove = async (id: number) => {
    try {
        const res = await db.query(`DELETE FROM "game" WHERE id = $1 RETURNING *`, [id]);
        return {
            id: res.rows[0].id,
            winner: res.rows[0].winner,
            endReason: res.rows[0].end_reason,
            pgn: res.rows[0].pgn,
            white: { id: res.rows[0].white_id, name: res.rows[0].white_name },
            black: { id: res.rows[0].black_id, name: res.rows[0].black_name },
            startedAt: res.rows[0].started_at.getTime(),
            endedAt: res.rows[0].ended_at?.getTime() || undefined
        } as Game;
    } catch (err: unknown) {
        console.log(err);
        return null;
    }
};

const GameModel = {
    save,
    findById,
    findByUserId,
    remove
};

export default GameModel;
