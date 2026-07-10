import type { Request, Response } from "express";
import GameModel from "../db/models/game.model.js";
import UserModel from "../db/models/user.model.js";
import { db } from "../db/index.js";
import { mintReward, tokenBalanceOf, isTokenConfigured, config as web3Config } from "../web3/arena.js";

const REWARD_WIN = Number(process.env.REWARD_WIN ?? 50);
const REWARD_DRAW = Number(process.env.REWARD_DRAW ?? 10);
const RESIGN_PENALTY = Number(process.env.RESIGN_PENALTY ?? 25);

// Conversion rate — derived from the exchange rate so the "$ worth" shown here
// matches what USDC actually buys/sells (1 USDC = EXCHANGE_RATE ARENA).
const EXCHANGE_RATE = Number(process.env.EXCHANGE_RATE ?? 100); // ARENA per 1 USDC
const ARENA_TO_USD = Number(process.env.ARENA_TO_USD ?? (EXCHANGE_RATE > 0 ? 1 / EXCHANGE_RATE : 0.01));
const USD_TO_BIRR = Number(process.env.USD_TO_BIRR ?? 57); // 1 USD ≈ 57 ETB

const walletOfUser = async (userId: number): Promise<string | null> => {
    const r = await db.query(`SELECT wallet_address FROM "user" WHERE id=$1`, [userId]);
    return r.rowCount && r.rows[0].wallet_address ? (r.rows[0].wallet_address as string) : null;
};

const conversionFor = (tokens: number) => {
    const usd = tokens * ARENA_TO_USD;
    return {
        arenaToUsd: ARENA_TO_USD,
        usdToBirr: USD_TO_BIRR,
        usd: Number(usd.toFixed(2)),
        birr: Number((usd * USD_TO_BIRR).toFixed(2))
    };
};

/**
 * Process rewards for a completed game — mints ARENA on-chain to the winner's
 * wallet (50 win / 10 each on draw). Falls back to a no-op "simulation" response
 * until the token contract is deployed (ARENA_TOKEN_ADDRESS set).
 */
export const processGameRewards = async (req: Request, res: Response) => {
    try {
        const { gameId } = req.body;
        if (!gameId) return res.status(400).json({ error: "Game ID required" });

        const game = await GameModel.findById(gameId);
        if (!game) return res.status(404).json({ error: "Game not found" });

        const configured = isTokenConfigured();
        const results: Array<{ side: "white" | "black"; tokens: number; wallet?: string; tx?: string | null }> = [];

        const rewardSide = async (side: "white" | "black", tokens: number) => {
            const player = side === "white" ? game.white : game.black;
            if (!player?.id || typeof player.id !== "number") return;
            const wallet = await walletOfUser(player.id);
            let tx: string | null = null;
            if (configured && wallet) tx = await mintReward(wallet, tokens);
            results.push({ side, tokens, wallet: wallet || undefined, tx });
        };

        if (game.winner === "white") await rewardSide("white", REWARD_WIN);
        else if (game.winner === "black") await rewardSide("black", REWARD_WIN);
        else if (game.winner === "draw") {
            await rewardSide("white", REWARD_DRAW);
            await rewardSide("black", REWARD_DRAW);
        }

        return res.json({
            success: true,
            gameId,
            onChain: configured,
            token: web3Config.token,
            results,
            message: configured
                ? "Rewards minted on-chain (Polygon Amoy)"
                : "Token not deployed yet — reward simulated"
        });
    } catch (error) {
        console.error("Error processing game rewards:", error);
        return res.status(500).json({ error: "Failed to process rewards" });
    }
};

/**
 * Get the player's reward summary. When the token is deployed and the player has
 * a linked wallet, `totalTokens` is the REAL on-chain ARENA balance; otherwise it
 * falls back to the DB-derived estimate (wins*50 + draws*10 - resigns*25).
 */
export const getUserRewards = async (req: Request, res: Response) => {
    try {
        const userId = req.session?.user?.id;
        if (!userId || typeof userId !== "number") {
            return res.status(401).json({ error: "Not authenticated" });
        }

        const user = await UserModel.findById(userId);
        if (!user) return res.status(404).json({ error: "User not found" });

        const wallet = await walletOfUser(userId);

        // DB-derived estimate (used as fallback + as the "earned" figure).
        const resignations = user.resignations || 0;
        const earned = (user.wins || 0) * REWARD_WIN + (user.draws || 0) * REWARD_DRAW;
        const penalty = resignations * RESIGN_PENALTY;
        const simulatedTokens = Math.max(0, earned - penalty);

        // Real on-chain balance when possible.
        let onChainBalance: number | null = null;
        if (isTokenConfigured() && wallet) {
            onChainBalance = await tokenBalanceOf(wallet);
        }
        const onChain = onChainBalance !== null;
        const totalTokens = onChain ? (onChainBalance as number) : simulatedTokens;

        const achievements = [];
        if ((user.wins || 0) >= 1) achievements.push({ id: 1, name: "First Victory", earned: true });
        if ((user.wins || 0) >= 10) achievements.push({ id: 2, name: "10 Wins", earned: true });
        if ((user.wins || 0) >= 100) achievements.push({ id: 3, name: "100 Wins", earned: true });

        return res.json({
            totalTokens,
            onChain,
            walletLinked: Boolean(wallet),
            wallet: wallet || null,
            token: web3Config.token,
            simulatedTokens,
            penalty,
            resignPenalty: RESIGN_PENALTY,
            conversion: conversionFor(totalTokens),
            achievements,
            stats: {
                wins: user.wins || 0,
                losses: user.losses || 0,
                draws: user.draws || 0,
                resignations
            }
        });
    } catch (error) {
        console.error("Error fetching user rewards:", error);
        return res.status(500).json({ error: "Failed to fetch rewards" });
    }
};
