import type { Request, Response } from "express";
import { activeGames } from "../db/models/game.model.js";
import WagerModel from "../db/models/wager.model.js";
import { isAdminUser } from "../util/admin.js";
import { withKeyLock } from "../util/locks.js";
import { settleWager, settleWagerDraw, isEscrowConfigured } from "../web3/arena.js";
import { stakeCreateMatch, stakeJoinMatch, isCustodyConfigured } from "../web3/custody.js";

const isAddr = (a: unknown): a is string => typeof a === "string" && /^0x[0-9a-fA-F]{40}$/.test(a);

const gameParticipant = (gameCode: string, userId: number) => {
    const game = activeGames.find((g) => g.code === gameCode);
    if (!game) return null;
    const isPlayer =
        game.host?.id === userId || game.white?.id === userId || game.black?.id === userId;
    return isPlayer ? game : null;
};

// Player1 creates a wager. The platform stakes their ARENA into the escrow ON
// their behalf (custodial) — the player never signs or pays gas.
export const createWager = async (req: Request, res: Response) => {
    const userId = req.session?.user?.id;
    if (!userId || typeof userId !== "number") return res.status(401).end();
    if (!isCustodyConfigured()) return res.status(503).json({ error: "On-chain wagers not configured" });

    const { gameCode } = req.body;
    const stake = Number(req.body.stake);
    if (!gameCode || !(stake > 0)) return res.status(400).json({ error: "gameCode and stake required" });
    if (!gameParticipant(gameCode, userId)) return res.status(403).json({ error: "Not a player in that game" });

    // Serialize per game so two players can't both create + double-stake at once.
    try {
        const result = await withKeyLock(`wager:${gameCode}`, async () => {
            // Reserve immediately so the opponent's UI disables their bet button.
            const pending = await WagerModel.createPending(gameCode, userId, stake);
            if (!pending) return { code: 409, body: { error: "A wager already exists for this game" } };
            try {
                const staked = await stakeCreateMatch(userId, stake); // on-chain: create the match
                if (!staked) throw new Error("Failed to stake on-chain");
                const wager = await WagerModel.activate(gameCode, staked.matchId, staked.wallet);
                if (!wager) throw new Error("Failed to record wager");
                return { code: 201, body: { wager } };
            } catch (err) {
                await WagerModel.deletePending(gameCode); // roll back the reservation
                return { code: 502, body: { error: (err as Error).message } };
            }
        });
        return res.status(result.code).json(result.body);
    } catch (err) {
        return res.status(400).json({ error: (err as Error).message });
    }
};

// Player2 accepts the wager. The platform matches the stake on their behalf.
export const joinWager = async (req: Request, res: Response) => {
    const userId = req.session?.user?.id;
    if (!userId || typeof userId !== "number") return res.status(401).end();
    if (!isCustodyConfigured()) return res.status(503).json({ error: "On-chain wagers not configured" });

    const { gameCode } = req.body;
    if (!gameCode) return res.status(400).json({ error: "gameCode required" });

    // Same per-game lock: prevents a double-join racing the create/settle.
    try {
        const result = await withKeyLock(`wager:${gameCode}`, async () => {
            const wager = await WagerModel.findByGameCode(gameCode);
            if (!wager || wager.match_id == null) return { code: 404, body: { error: "No wager for this game" } };
            if (wager.state !== "open") return { code: 409, body: { error: `Wager is '${wager.state}'` } };
            if (!gameParticipant(wager.game_code, userId)) return { code: 403, body: { error: "Not a player in that game" } };
            if (userId === wager.p1_user_id) return { code: 400, body: { error: "Cannot join your own wager" } };
            const staked = await stakeJoinMatch(userId, wager.match_id, Number(wager.stake));
            if (!staked) return { code: 502, body: { error: "Failed to stake on-chain" } };
            const updated = await WagerModel.join(wager.match_id, userId, staked.wallet);
            if (!updated) return { code: 409, body: { error: "Wager not open to join" } };
            return { code: 200, body: { wager: updated } };
        });
        return res.status(result.code).json(result.body);
    } catch (err) {
        return res.status(400).json({ error: (err as Error).message });
    }
};

export const getWager = async (req: Request, res: Response) => {
    const wager = await WagerModel.findByGameCode(req.params.gameCode);
    if (!wager) return res.status(404).json({ error: "No wager for this game" });
    return res.json({ wager });
};

// Admin override: manually settle a wager (dispute / stuck game).
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
