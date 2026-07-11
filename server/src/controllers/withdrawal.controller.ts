import type { Request, Response } from "express";
import WithdrawalModel from "../db/models/withdrawal.model.js";
import { db } from "../db/index.js";
import { isAdminUser } from "../util/admin.js";
import { tokenBalanceOf, isTokenConfigured } from "../web3/arena.js";
import { mintUsd, isUsdConfigured } from "../web3/usd.js";

// $1 = 100 ARENA — keep in sync with the client's EXCHANGE_RATE (client/src/lib/contracts.ts).
const ARENA_TO_USD = 1 / 100; // 0.01
const USD_TO_BIRR = Number(process.env.USD_TO_BIRR ?? 57);

const walletOfUser = async (userId: number): Promise<string | null> => {
    const r = await db.query(`SELECT wallet_address FROM "user" WHERE id=$1`, [userId]);
    return r.rowCount && r.rows[0].wallet_address ? (r.rows[0].wallet_address as string) : null;
};

// ── Player ────────────────────────────────────────────────────────────────
// Request a cash-out: convert ARENA back to test USDC. The player can't cash out
// more than their real on-chain balance; approving it releases the USDC on-chain.
export const requestWithdrawal = async (req: Request, res: Response) => {
    const user = req.session?.user;
    if (!user?.id || typeof user.id !== "number") return res.status(401).end();

    const amount = Number(req.body.amount);
    if (!(amount > 0)) return res.status(400).json({ error: "amount must be greater than 0" });

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

// Admin approves the cash-out. The player already burned their ARENA (signed
// client-side) when requesting; here we release the equivalent test USDC back to
// their wallet, so the conversion reflects in their balance (mirrors how a buy
// releases ARENA). If the on-chain payout fails, we leave it pending to retry.
export const payWithdrawal = async (req: Request, res: Response) => {
    if (!isAdminUser(req.session?.user)) return res.status(403).end();
    const id = Number(req.params.id);
    const w = await WithdrawalModel.findById(id);
    if (!w) return res.status(404).json({ error: "Withdrawal not found" });
    if (w.status !== "pending") return res.status(409).json({ error: `Already ${w.status}` });

    if (isUsdConfigured() && w.wallet && w.usd) {
        const tx = await mintUsd(w.wallet, Number(w.usd));
        if (!tx) return res.status(502).json({ error: "USDC payout failed on-chain — left pending, try again." });
        await WithdrawalModel.setStatus(id, "paid", req.session!.user!.name || "admin");
        return res.json({ paid: true, tx });
    }

    // No web3 configured → mark paid (admin settles off-chain, legacy behaviour).
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
