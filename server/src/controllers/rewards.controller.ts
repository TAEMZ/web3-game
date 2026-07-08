import type { Request, Response } from "express";
import GameModel from "../db/models/game.model.js";
import UserModel from "../db/models/user.model.js";

/**
 * Process rewards for a completed game
 * Called after a game ends to award tokens and NFTs
 */
export const processGameRewards = async (req: Request, res: Response) => {
    try {
        const { gameId } = req.body;

        if (!gameId) {
            return res.status(400).json({ error: "Game ID required" });
        }

        // Get game details
        const game = await GameModel.findById(gameId);
        if (!game) {
            return res.status(404).json({ error: "Game not found" });
        }

        const rewards: {
            white?: { tokens: number; nfts: string[] };
            black?: { tokens: number; nfts: string[] };
        } = {};

        // Award tokens based on outcome
        if (game.winner === "white" && game.white?.id && typeof game.white.id === "number") {
            const whiteUser = await UserModel.findById(game.white.id);
            if (whiteUser) {
                rewards.white = {
                    tokens: 50, // 50 ARENA tokens
                    nfts: [],
                };

                // Check for first win achievement
                if (whiteUser.wins === 1) {
                    rewards.white.nfts.push("First Victory");
                }
            }
        } else if (game.winner === "black" && game.black?.id && typeof game.black.id === "number") {
            const blackUser = await UserModel.findById(game.black.id);
            if (blackUser) {
                rewards.black = {
                    tokens: 50, // 50 ARENA tokens
                    nfts: [],
                };

                // Check for first win achievement
                if (blackUser.wins === 1) {
                    rewards.black.nfts.push("First Victory");
                }
            }
        } else if (game.winner === "draw") {
            // Award smaller rewards for draws
            if (game.white?.id && typeof game.white.id === "number") {
                const whiteUser = await UserModel.findById(game.white.id);
                if (whiteUser) {
                    rewards.white = { tokens: 10, nfts: [] };
                }
            }
            if (game.black?.id && typeof game.black.id === "number") {
                const blackUser = await UserModel.findById(game.black.id);
                if (blackUser) {
                    rewards.black = { tokens: 10, nfts: [] };
                }
            }
        }

        // TODO: Actually call smart contract functions to distribute rewards
        // For now, just return what would be awarded
        console.log(`🎁 Game #${gameId} rewards:`, rewards);

        return res.json({
            success: true,
            gameId,
            rewards,
            message: "Rewards processed (testnet simulation)",
        });
    } catch (error) {
        console.error("Error processing game rewards:", error);
        return res.status(500).json({ error: "Failed to process rewards" });
    }
};

/**
 * Get user's reward history
 */
export const getUserRewards = async (req: Request, res: Response) => {
    try {
        const userId = req.session?.user?.id;
        if (!userId || typeof userId !== "number") {
            return res.status(401).json({ error: "Not authenticated" });
        }

        const user = await UserModel.findById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Calculate total rewards earned. Resigning (quitting) deducts RESIGN_PENALTY
        // per game; the balance never drops below zero.
        const RESIGN_PENALTY = 25;
        const resignations = user.resignations || 0;
        const earned = (user.wins || 0) * 50 + (user.draws || 0) * 10;
        const penalty = resignations * RESIGN_PENALTY;
        const totalTokens = Math.max(0, earned - penalty);

        const achievements = [];
        if ((user.wins || 0) >= 1) achievements.push({ id: 1, name: "First Victory", earned: true });
        if ((user.wins || 0) >= 10) achievements.push({ id: 2, name: "10 Wins", earned: true });
        if ((user.wins || 0) >= 100) achievements.push({ id: 3, name: "100 Wins", earned: true });

        return res.json({
            totalTokens,
            penalty,
            resignPenalty: RESIGN_PENALTY,
            achievements,
            stats: {
                wins: user.wins || 0,
                losses: user.losses || 0,
                draws: user.draws || 0,
                resignations,
            },
        });
    } catch (error) {
        console.error("Error fetching user rewards:", error);
        return res.status(500).json({ error: "Failed to fetch rewards" });
    }
};
