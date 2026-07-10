import type { Request, Response } from "express";
import WithdrawalModel from "../db/models/withdrawal.model.js";
import { db } from "../db/index.js";
import { isAdminUser } from "../util/admin.js";
import { tokenBalanceOf, isTokenConfigured } from "../web3/arena.js";

const ARENA_TO_USD = Number(process.env.ARENA_TO_USD ?? 0.1);
const USD_TO_BIRR = Number(process.env.USD_TO_BIRR ?? 57);

const walletOfUser = async (userId: number): Promise<string | null> => {
    const r = await db.query(`SELECT wallet_address FROM "user" WHERE id=$1`, [userId]);
    return r.rowCount && r.rows[0].wallet_address ? (r.rows[0].wallet_address as string) : null;
};

// ── Player ────────────────────────────────────────────────────────────────
// Request a cash-out: convert ARENA back to birr. The player can't withdraw more
// than their real on-chain balance. Admin pays the birr off-chain and marks paid.
export const requestWithdrawal = async (req: Request, res: Response) => {
    const user = req.session?.user;
    if (!user?.id || typeof user.id !== "number") return res.status(401).end();

    const amount = Number(req.body.amount);
    if (!(amount > 0)) return res.status(400).json({ error: "amount must be greater than 0" });

    // Rate limit: only 1 active (pending) withdrawal per player.
    const { rows } = await db.query(
        `SELECT id FROM "withdrawal" WHERE user_id=$1 AND status='pending' LIMIT 1`,
        [user.id]
    );
    if (rows.length) {
        return res.status(409).json({ error: "You already have a pending withdrawal" });
    }

    const wallet = await walletOfUser(user.id);

    // Can't cash out more than you actually hold on-chain.
    if (isTokenConfigured() && wallet) {
        const bal = await tokenBalanceOf(wallet);
        if (bal !== null && amount > bal) {
            return res.status(400).json({ error: `You only have ${bal} ARENA` });
        }
    }

    const usd = Number((amount * ARENA_TO_USD).toFixed(2));
    const birr = Number((usd * USD_TO_BIRR).toFixed(2));
    const withdrawal = await WithdrawalModel.create({
        userId: user.id,
        userName: user.name || "player",
        amount,
        usd,
        birr,
        wallet: wallet || undefined,
        payoutTo: typeof req.body.payoutTo === "string" ? req.body.payoutTo.slice(0, 120) : undefined
    });
    if (!withdrawal) return res.status(500).json({ error: "Failed to create withdrawal" });
    return res.status(201).json({ withdrawal });
};

export const myWithdrawals = async (req: Request, res: Response) => {
    const user = req.session?.user;
    if (!user?.id || typeof user.id !== "number") return res.status(401).end();
    const withdrawals = await WithdrawalModel.listByUser(user.id);
    return res.json({ withdrawals });
};

// ── Admin ─────────────────────────────────────────────────────────────────
export const listWithdrawals = async (req: Request, res: Response) => {
    if (!isAdminUser(req.session?.user)) return res.status(403).end();
    const status = (req.query.status as string) || "pending";
    const withdrawals = await WithdrawalModel.listByStatus(status);
    return res.json({ withdrawals });
};

// Admin confirms the cash was sent and marks the request paid. The player already
// burned their own ARENA (signed client-side) when they requested the cash-out,
// so there's nothing to deduct here.
export const payWithdrawal = async (req: Request, res: Response) => {
    if (!isAdminUser(req.session?.user)) return res.status(403).end();
    const id = Number(req.params.id);
    const w = await WithdrawalModel.findById(id);
    if (!w) return res.status(404).json({ error: "Withdrawal not found" });
    if (w.status !== "pending") return res.status(409).json({ error: `Already ${w.status}` });

    await WithdrawalModel.setStatus(id, "paid", req.session!.user!.name || "admin");
    return res.json({ paid: true });
};

export const rejectWithdrawal = async (req: Request, res: Response) => {
    if (!isAdminUser(req.session?.user)) return res.status(403).end();
    const id = Number(req.params.id);
    const w = await WithdrawalModel.findById(id);
    if (!w) return res.status(404).json({ error: "Withdrawal not found" });
    if (w.status !== "pending") return res.status(409).json({ error: `Already ${w.status}` });
    await WithdrawalModel.setStatus(id, "rejected", req.session!.user!.name || "admin");
    return res.json({ rejected: true });
};
