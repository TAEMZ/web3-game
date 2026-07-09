import type { Request, Response } from "express";

import { db } from "../db/index.js";

export async function getLeaderboard(_req: Request, res: Response) {
    try {
        const result = await db.query(
            `SELECT
                id,
                name,
                wins,
                losses,
                draws,
                resignations,
                wallet_address,
                (wins * 50 + draws * 10) AS score,
                ROW_NUMBER() OVER (ORDER BY (wins * 50 + draws * 10) DESC, wins DESC) AS rank
             FROM "user"
             WHERE is_admin IS NOT TRUE AND banned IS NOT TRUE
             ORDER BY rank
             LIMIT 100`
        );
        const leaderboard = result.rows.map((u) => ({
            rank: Number(u.rank),
            id: u.id,
            name: u.name,
            wins: u.wins || 0,
            losses: u.losses || 0,
            draws: u.draws || 0,
            score: Number(u.score),
            hasWallet: !!u.wallet_address
        }));
        res.json({ leaderboard });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to load leaderboard" });
    }
}
