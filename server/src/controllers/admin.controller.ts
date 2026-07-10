import type { NextFunction, Request, Response } from "express";

import { db } from "../db/index.js";
import UserModel from "../db/models/user.model.js";
import WagerModel from "../db/models/wager.model.js";
import { isAdminUser } from "../util/admin.js";

const RESIGN_PENALTY = 25;
const tokensFor = (u: { wins?: number; draws?: number; resignations?: number }) =>
    Math.max(0, (u.wins || 0) * 50 + (u.draws || 0) * 10 - (u.resignations || 0) * RESIGN_PENALTY);

// Gate every /admin route: session must belong to an admin (env-listed name or
// persisted is_admin flag). Re-checks the DB so a revoked admin loses access.
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
    const su = req.session.user;
    if (!su?.id) {
        res.status(401).json({ error: "Not authenticated" });
        return;
    }
    let admin = isAdminUser(su);
    if (!admin && typeof su.id === "number") {
        const fresh = await UserModel.findById(su.id);
        admin = isAdminUser(fresh);
    }
    if (!admin) {
        res.status(403).json({ error: "Admin access required" });
        return;
    }
    next();
}

export async function listPlayers(_req: Request, res: Response) {
    try {
        const result = await db.query(
            `SELECT id, name, email, wallet_address, wins, losses, draws, resignations, is_admin, banned, last_ip, created_at
             FROM "user"
             WHERE is_admin IS NOT TRUE
             ORDER BY banned DESC, (wins * 50 + draws * 10) DESC, wins DESC
             LIMIT 250`
        );
        const players = result.rows.map((u) => ({
            id: u.id,
            name: u.name,
            wallet: u.wallet_address || null,
            wins: u.wins || 0,
            losses: u.losses || 0,
            draws: u.draws || 0,
            resignations: u.resignations || 0,
            tokens: tokensFor(u),
            isAdmin: u.is_admin === true,
            banned: u.banned === true,
            lastIp: u.last_ip || null,
            createdAt: u.created_at
        }));
        res.json({ players });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to load players" });
    }
}

export async function overview(_req: Request, res: Response) {
    try {
        const u = await db.query(
            `SELECT COUNT(*) FILTER (WHERE is_admin IS NOT TRUE)::int AS players,
                    COALESCE(SUM(wins), 0)::int AS wins,
                    COALESCE(SUM(draws), 0)::int AS draws,
                    COUNT(wallet_address)::int AS wallets
             FROM "user"`
        );
        const g = await db.query(`SELECT COUNT(*)::int AS games FROM "game"`);
        const row = u.rows[0];
        res.json({
            players: row.players,
            games: g.rows[0].games,
            wallets: row.wallets,
            totalTokens: row.wins * 50 + row.draws * 10
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to load overview" });
    }
}

// Release a player's earned ARENA. Contracts are not deployed yet, so this is a
// testnet SIMULATION: it computes the amount and returns a mock tx. When the
// Reward contract is live, this is where a server-held minter wallet submits the
// real mint/transfer (see project-arena-admin-plan). The admin only triggers it;
// the contract enforces the rules.
export async function distribute(req: Request, res: Response) {
    try {
        const userId = Number(req.body?.userId);
        if (!userId) {
            res.status(400).json({ error: "userId required" });
            return;
        }
        const user = await UserModel.findById(userId);
        if (!user) {
            res.status(404).json({ error: "Player not found" });
            return;
        }
        const walletRow = await db.query(`SELECT wallet_address FROM "user" WHERE id = $1`, [userId]);
        const wallet = walletRow.rows[0]?.wallet_address || null;
        const amount = tokensFor(user);

        if (!wallet) {
            res.status(400).json({ error: "Player has no wallet to receive rewards" });
            return;
        }

        const txHash = `0xSIM${userId}${amount}`;
        console.log(
            `[admin] distribute ${amount} ARENA -> user ${userId} (${user.name}) wallet ${wallet} [simulated ${txHash}]`
        );
        res.json({ success: true, userId, name: user.name, wallet, amount, txHash, simulated: true });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to distribute" });
    }
}

export async function listReports(_req: Request, res: Response) {
    try {
        const r = await db.query(
            `SELECT id, reporter_name, reported_id, reported_name, reason, note, game_code, chat_snapshot, status, created_at
             FROM "report"
             ORDER BY (status = 'open') DESC, created_at DESC
             LIMIT 200`
        );
        res.json({ reports: r.rows });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to load reports" });
    }
}

export async function banUser(req: Request, res: Response) {
    try {
        const userId = Number(req.body?.userId);
        if (!userId) {
            res.status(400).json({ error: "userId required" });
            return;
        }
        const banIp = req.body?.banIp === true;
        const reason = String(req.body?.reason || "").slice(0, 500);
        const u = await db.query(`SELECT last_ip, is_admin FROM "user" WHERE id = $1`, [userId]);
        if (!u.rowCount) {
            res.status(404).json({ error: "Player not found" });
            return;
        }
        if (u.rows[0].is_admin) {
            res.status(400).json({ error: "Cannot ban an admin" });
            return;
        }
        await db.query(`UPDATE "user" SET banned = true WHERE id = $1`, [userId]);

        let ipBanned: string | null = null;
        if (banIp && u.rows[0].last_ip) {
            await db.query(
                `INSERT INTO "banned_ip"(ip, reason) VALUES($1, $2) ON CONFLICT (ip) DO NOTHING`,
                [u.rows[0].last_ip, reason || "banned user"]
            );
            ipBanned = u.rows[0].last_ip;
        }
        res.json({ success: true, banned: true, ipBanned });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to ban" });
    }
}

export async function unbanUser(req: Request, res: Response) {
    try {
        const userId = Number(req.body?.userId);
        if (!userId) {
            res.status(400).json({ error: "userId required" });
            return;
        }
        const u = await db.query(`SELECT last_ip FROM "user" WHERE id = $1`, [userId]);
        await db.query(`UPDATE "user" SET banned = false WHERE id = $1`, [userId]);
        if (u.rows[0]?.last_ip) {
            await db.query(`DELETE FROM "banned_ip" WHERE ip = $1`, [u.rows[0].last_ip]);
        }
        res.json({ success: true, banned: false });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to unban" });
    }
}

export async function resolveReport(req: Request, res: Response) {
    try {
        const id = Number(req.body?.reportId);
        if (!id) {
            res.status(400).json({ error: "reportId required" });
            return;
        }
        await db.query(`UPDATE "report" SET status = 'resolved' WHERE id = $1`, [id]);
        res.json({ success: true });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to resolve" });
    }
}

export async function listWagers(req: Request, res: Response) {
    try {
        const status = typeof req.query.status === "string" ? req.query.status : undefined;
        const wagers = await WagerModel.listAll(status);
        res.json({ wagers });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to load wagers" });
    }
}
