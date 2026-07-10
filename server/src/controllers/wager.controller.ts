import type { Request, Response } from "express";
import { activeGames } from "../db/models/game.model.js";
import WagerModel from "../db/models/wager.model.js";
import { db } from "../db/index.js";
import { isAdminUser } from "../util/admin.js";
import { withKeyLock } from "../util/locks.js";
import { settleWager, settleWagerDraw, isEscrowConfigured } from "../web3/arena.js";

const isAddr = (a: unknown): a is string => typeof a === "string" && /^0x[0-9a-fA-F]{40}$/.test(a);

const gameParticipant = (gameCode: string, userId: number) => {
    const game = activeGames.find((g) => g.code === gameCode);
    if (!game) return null;
    const isPlayer =
        game.host?.id === userId || game.white?.id === userId || game.black?.id === userId;
    return isPlayer ? game : null;
};

const walletOfUser = async (userId: number): Promise<string | null> => {
    const r = await db.query(`SELECT wallet_address FROM "user" WHERE id=$1`, [userId]);
    return r.rowCount && r.rows[0].wallet_address ? (r.rows[0].wallet_address as string) : null;
};

// Player1 has ALREADY staked on-chain from their own wallet (approve + createMatch
// via thirdweb) and passes the resulting matchId. The server just records it.
export const createWager = async (req: Request, res: Response) => {
    const userId = req.session?.user?.id;
    if (!userId || typeof userId !== "number") return res.status(401).end();

    const { gameCode, wallet } = req.body;
    const matchId = Number(req.body.matchId);
    const stake = Number(req.body.stake);
    if (!gameCode || !Number.isInteger(matchId) || !(stake > 0) || !isAddr(wallet)) {
        return res.status(400).json({ error: "gameCode, matchId, stake, wallet required" });
    }
    if (!gameParticipant(gameCode, userId)) return res.status(403).json({ error: "Not a player in that game" });
    const myWallet = await walletOfUser(userId);
    if (!myWallet || myWallet.toLowerCase() !== wallet.toLowerCase()) {
        return res.status(403).json({ error: "Wallet does not match your linked wallet" });
    }

    try {
        const result = await withKeyLock(`wager:${gameCode}`, async () => {
            const existing = await WagerModel.findByGameCode(gameCode);
            if (existing) {
                // Normal path: this player reserved the wager (state 'staking') before
                // staking on-chain — now activate it with the real matchId.
                if (existing.state === "staking" && existing.p1_user_id === userId) {
                    const activated = await WagerModel.activate(gameCode, matchId, wallet);
                    if (!activated) return { code: 409, body: { error: "Could not activate wager" } };
                    return { code: 201, body: { wager: activated } };
                }
                return { code: 409, body: { error: "A wager already exists for this game" } };
            }
            // Fallback (no reservation): record directly.
            const wager = await WagerModel.create({ gameCode, matchId, stake, p1UserId: userId, p1Wallet: wallet });
            if (!wager) return { code: 500, body: { error: "Failed to record wager" } };
            return { code: 201, body: { wager } };
        });
        return res.status(result.code).json(result.body);
    } catch (err) {
        return res.status(400).json({ error: (err as Error).message });
    }
};

// Player2 has ALREADY matched the stake on-chain (approve + joinMatch). Record it.
export const joinWager = async (req: Request, res: Response) => {
    const userId = req.session?.user?.id;
    if (!userId || typeof userId !== "number") return res.status(401).end();

    const { gameCode, wallet } = req.body;
    if (!gameCode || !isAddr(wallet)) return res.status(400).json({ error: "gameCode, wallet required" });
    const myWallet = await walletOfUser(userId);
    if (!myWallet || myWallet.toLowerCase() !== wallet.toLowerCase()) {
        return res.status(403).json({ error: "Wallet does not match your linked wallet" });
    }

    try {
        const result = await withKeyLock(`wager:${gameCode}`, async () => {
            const wager = await WagerModel.findByGameCode(gameCode);
            if (!wager || wager.match_id == null) return { code: 404, body: { error: "No wager for this game" } };
            if (wager.state !== "open") return { code: 409, body: { error: `Wager is '${wager.state}'` } };
            if (!gameParticipant(wager.game_code, userId)) return { code: 403, body: { error: "Not a player in that game" } };
            if (userId === wager.p1_user_id) return { code: 400, body: { error: "Cannot join your own wager" } };
            const updated = await WagerModel.join(wager.match_id, userId, wallet);
            if (!updated) return { code: 409, body: { error: "Wager not open to join" } };
            return { code: 200, body: { wager: updated } };
        });
        return res.status(result.code).json(result.body);
    } catch (err) {
        return res.status(400).json({ error: (err as Error).message });
    }
};

// Reserve the wager the instant player1 taps "Bet" — BEFORE the on-chain stake —
// so the opponent immediately sees "opponent is placing a bet" and can't collide.
export const reserveWager = async (req: Request, res: Response) => {
    const userId = req.session?.user?.id;
    if (!userId || typeof userId !== "number") return res.status(401).end();

    const { gameCode } = req.body;
    const stake = Number(req.body.stake);
    if (!gameCode || !(stake > 0)) return res.status(400).json({ error: "gameCode, stake required" });
    if (!gameParticipant(gameCode, userId)) return res.status(403).json({ error: "Not a player in that game" });

    try {
        const result = await withKeyLock(`wager:${gameCode}`, async () => {
            if (await WagerModel.findByGameCode(gameCode)) return { code: 409, body: { error: "A wager already exists for this game" } };
            const w = await WagerModel.createPending(gameCode, userId, stake);
            if (!w) return { code: 409, body: { error: "A wager already exists for this game" } };
            return { code: 201, body: { wager: w } };
        });
        return res.status(result.code).json(result.body);
    } catch (err) {
        return res.status(400).json({ error: (err as Error).message });
    }
};

// Roll back a reservation if the on-chain stake failed, so the opponent isn't
// left stuck seeing "opponent is placing a bet".
export const cancelReserve = async (req: Request, res: Response) => {
    const userId = req.session?.user?.id;
    if (!userId || typeof userId !== "number") return res.status(401).end();
    const { gameCode } = req.body;
    if (!gameCode) return res.status(400).json({ error: "gameCode required" });
    try {
        await withKeyLock(`wager:${gameCode}`, async () => {
            const w = await WagerModel.findByGameCode(gameCode);
            if (w && w.state === "staking" && w.p1_user_id === userId) {
                await WagerModel.deletePending(gameCode);
            }
        });
        return res.json({ ok: true });
    } catch (err) {
        return res.status(400).json({ error: (err as Error).message });
    }
};

export const getWager = async (req: Request, res: Response) => {
    const wager = await WagerModel.findByGameCode(req.params.gameCode);
    if (!wager) return res.status(404).json({ error: "No wager for this game" });
    return res.json({ wager });
};

// The winner is paid by the server (it holds SETTLER_ROLE) — auto on game-over
// (WagerModel.settleForGame), and this admin override handles disputes/stuck games.
export const adminSettleWager = async (req: Request, res: Response) => {
    if (!isAdminUser(req.session?.user)) return res.status(403).end();
    if (!isEscrowConfigured()) return res.status(503).json({ error: "Escrow not deployed" });

    const { gameCode, winnerWallet, draw } = req.body;
    const wager = await WagerModel.findByGameCode(gameCode);
    if (!wager || wager.match_id == null) return res.status(404).json({ error: "Wager not found" });
    if (wager.state !== "funded") return res.status(409).json({ error: `Wager is '${wager.state}'` });

    if (draw) {
        const tx = await settleWagerDraw(wager.match_id);
        await WagerModel.markSettled(wager.id, null, tx);
        return res.json({ settled: true, draw: true, tx });
    }
    if (!isAddr(winnerWallet) || ![wager.p1_wallet, wager.p2_wallet].includes(winnerWallet.toLowerCase())) {
        return res.status(400).json({ error: "winnerWallet must be one of the two staked wallets" });
    }
    const tx = await settleWager(wager.match_id, winnerWallet);
    await WagerModel.markSettled(wager.id, winnerWallet, tx);
    return res.json({ settled: true, winner: winnerWallet, tx });
};
