import type { Game } from "@arena/types";
import { db } from "../index.js";
import { settleWager, settleWagerDraw, isEscrowConfigured } from "../../web3/arena.js";
import * as SettlementQueue from "./settlement-queue.js";

const HOUSE_FEE_PERCENT = Number(process.env.HOUSE_FEE_PERCENT || "15");

export interface Wager {
    id: number;
    game_code: string;
    match_id: number | null;
    stake: number;
    p1_user_id: number | null;
    p1_wallet: string | null;
    p2_user_id: number | null;
    p2_wallet: string | null;
    state: "staking" | "open" | "funded" | "settled" | "cancelled";
    winner_wallet: string | null;
    fee_amount: number;
    settle_tx: string | null;
}

// Reserve a wager the instant player1 starts staking (before the on-chain tx),
// so the opponent immediately sees "someone is betting" and can't also create.
// Returns null if a wager already exists for this game (unique game_code).
export const createPending = async (
    gameCode: string,
    p1UserId: number,
    stake: number
): Promise<Wager | null> => {
    try {
        const res = await db.query(
            `INSERT INTO "wager"(game_code, stake, p1_user_id, state)
             VALUES($1, $2, $3, 'staking')
             ON CONFLICT (game_code) DO NOTHING RETURNING *`,
            [gameCode, stake, p1UserId]
        );
        return res.rowCount ? (res.rows[0] as Wager) : null;
    } catch (err) {
        console.log("wager.createPending", err);
        return null;
    }
};

// Player1's stake confirmed on-chain → the wager is now open to join.
export const activate = async (gameCode: string, matchId: number, p1Wallet: string): Promise<Wager | null> => {
    const res = await db.query(
        `UPDATE "wager" SET match_id=$1, p1_wallet=$2, state='open'
         WHERE game_code=$3 AND state='staking' RETURNING *`,
        [matchId, p1Wallet.toLowerCase(), gameCode]
    );
    return res.rowCount ? (res.rows[0] as Wager) : null;
};

// Roll back a reservation if the stake failed.
export const deletePending = async (gameCode: string): Promise<void> => {
    await db.query(`DELETE FROM "wager" WHERE game_code=$1 AND state='staking'`, [gameCode]);
};

// Record a new wager after player1 has staked on-chain (createMatch).
export const create = async (w: {
    gameCode: string;
    matchId: number;
    stake: number;
    p1UserId: number;
    p1Wallet: string;
}): Promise<Wager | null> => {
    try {
        const res = await db.query(
            `INSERT INTO "wager"(game_code, match_id, stake, p1_user_id, p1_wallet, state)
             VALUES($1, $2, $3, $4, $5, 'open') RETURNING *`,
            [w.gameCode, w.matchId, w.stake, w.p1UserId, w.p1Wallet.toLowerCase()]
        );
        return res.rows[0] as Wager;
    } catch (err) {
        console.log("wager.create", err);
        return null;
    }
};

// Player2 joined the match on-chain (joinMatch) → wager is now fully funded.
export const join = async (matchId: number, p2UserId: number, p2Wallet: string): Promise<Wager | null> => {
    try {
        const res = await db.query(
            `UPDATE "wager" SET p2_user_id=$1, p2_wallet=$2, state='funded'
             WHERE match_id=$3 AND state='open' RETURNING *`,
            [p2UserId, p2Wallet.toLowerCase(), matchId]
        );
        return res.rowCount ? (res.rows[0] as Wager) : null;
    } catch (err) {
        console.log("wager.join", err);
        return null;
    }
};

export const findByGameCode = async (gameCode: string): Promise<Wager | null> => {
    // Auto-cancel stale "staking" reservations older than 5 minutes (the on-chain
    // stake should have confirmed by then; if not, the user likely closed the tab).
    await db.query(
        `DELETE FROM "wager" WHERE game_code=$1 AND state='staking' AND created_at < NOW() - INTERVAL '5 minutes'`,
        [gameCode]
    );
    const res = await db.query(`SELECT * FROM "wager" WHERE game_code=$1`, [gameCode]);
    return res.rowCount ? (res.rows[0] as Wager) : null;
};

export const findByMatchId = async (matchId: number): Promise<Wager | null> => {
    const res = await db.query(`SELECT * FROM "wager" WHERE match_id=$1`, [matchId]);
    return res.rowCount ? (res.rows[0] as Wager) : null;
};

export const markSettled = async (
    id: number,
    winnerWallet: string | null,
    tx: string | null,
    feeAmount: number = 0
): Promise<void> => {
    await db.query(`UPDATE "wager" SET state='settled', winner_wallet=$1, settle_tx=$2, fee_amount=$3 WHERE id=$4`, [
        winnerWallet ? winnerWallet.toLowerCase() : null,
        tx,
        feeAmount,
        id
    ]);
};

export const markCancelled = async (id: number): Promise<void> => {
    await db.query(`UPDATE "wager" SET state='cancelled' WHERE id=$1`, [id]);
};

export const listAll = async (status?: string): Promise<Wager[]> => {
    const query = status
        ? `SELECT * FROM "wager" WHERE state=$1 ORDER BY created_at DESC LIMIT 200`
        : `SELECT * FROM "wager" ORDER BY created_at DESC LIMIT 200`;
    const params = status ? [status] : [];
    const res = await db.query(query, params);
    return res.rows as Wager[];
};

// Auto-settle a wager when its game ends: the server (SETTLER_ROLE) reports the
// result to the escrow, which releases the pot to the winner (minus the platform
// fee) or refunds a draw (no fee).
// If the on-chain call fails, the job is enqueued for automatic retry.
// No-op unless the escrow is deployed and the wager is fully funded (both staked).
export const settleForGame = async (game: Game): Promise<void> => {
    try {
        if (!isEscrowConfigured() || !game.code) return;
        const w = await findByGameCode(game.code);
        if (!w || w.state !== "funded" || w.match_id == null) return;

        if (game.winner === "draw") {
            const tx = await settleWagerDraw(w.match_id);
            if (tx) {
                await markSettled(w.id, null, tx, 0);
            } else {
                await SettlementQueue.enqueue(w.id, w.match_id, "draw", null);
            }
        } else if (game.winner === "white" || game.winner === "black") {
            const winnerUserId = game.winner === "white" ? game.white?.id : game.black?.id;
            let wallet: string | null = null;
            if (winnerUserId === w.p1_user_id) wallet = w.p1_wallet;
            else if (winnerUserId === w.p2_user_id) wallet = w.p2_wallet;
            if (!wallet) {
                console.warn(`[web3] wager #${w.id}: could not map winner to a staked wallet`);
                return;
            }
            const feeAmount = Math.floor(w.stake * 2 * HOUSE_FEE_PERCENT / 100);
            const tx = await settleWager(w.match_id, wallet);
            if (tx) {
                await markSettled(w.id, wallet, tx, feeAmount);
            } else {
                await SettlementQueue.enqueue(w.id, w.match_id, "win", wallet);
            }
        }
    } catch (err) {
        console.error("[web3] settleForGame error:", (err as Error).message);
    }
};

const WagerModel = {
    create,
    createPending,
    activate,
    deletePending,
    join,
    findByGameCode,
    findByMatchId,
    markSettled,
    markCancelled,
    settleForGame,
    listAll
};
export default WagerModel;
