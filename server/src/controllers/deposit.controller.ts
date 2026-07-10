import type { Request, Response } from "express";
import DepositModel from "../db/models/deposit.model.js";
import { db } from "../db/index.js";
import { isAdminUser } from "../util/admin.js";
import { mintReward, isTokenConfigured } from "../web3/arena.js";

const MAX_TOPUP = Number(process.env.MAX_TOPUP ?? 100000); // sanity cap on a single request
const isAddr = (a: unknown): a is string => typeof a === "string" && /^0x[0-9a-fA-F]{40}$/.test(a);

const walletOfUser = async (userId: number): Promise<string | null> => {
    const r = await db.query(`SELECT wallet_address FROM "user" WHERE id=$1`, [userId]);
    return r.rowCount && r.rows[0].wallet_address ? (r.rows[0].wallet_address as string) : null;
};

// ── Player ────────────────────────────────────────────────────────────────
// Request a token top-up. The player states how much they paid (and a payment
// reference); an admin verifies and releases the tokens. Repeatable, no expiry.
export const requestDeposit = async (req: Request, res: Response) => {
    const user = req.session?.user;
    if (!user?.id || typeof user.id !== "number") return res.status(401).end();

    const amount = Number(req.body.amount);
    if (!(amount > 0) || amount > MAX_TOPUP) {
        return res.status(400).json({ error: `amount must be between 1 and ${MAX_TOPUP}` });
    }
    const wallet = isAddr(req.body.wallet) ? req.body.wallet : await walletOfUser(user.id);

    const deposit = await DepositModel.create({
        userId: user.id,
        userName: user.name || "player",
        amount,
        method: typeof req.body.method === "string" ? req.body.method.slice(0, 32) : undefined,
        reference: typeof req.body.reference === "string" ? req.body.reference.slice(0, 500) : undefined,
        wallet: wallet || undefined
    });
    if (!deposit) return res.status(500).json({ error: "Failed to create deposit" });
    return res.status(201).json({ deposit });
};

export const myDeposits = async (req: Request, res: Response) => {
    const user = req.session?.user;
    if (!user?.id || typeof user.id !== "number") return res.status(401).end();
    const deposits = await DepositModel.listByUser(user.id);
    return res.json({ deposits });
};

// ── Admin ─────────────────────────────────────────────────────────────────
export const listDeposits = async (req: Request, res: Response) => {
    if (!isAdminUser(req.session?.user)) return res.status(403).end();
    const status = (req.query.status as string) || "pending";
    const deposits = await DepositModel.listByStatus(status);
    return res.json({ deposits });
};

// Verify + release: mint the requested ARENA to the player's wallet on-chain.
export const approveDeposit = async (req: Request, res: Response) => {
    if (!isAdminUser(req.session?.user)) return res.status(403).end();
    const id = Number(req.params.id);
    const deposit = await DepositModel.findById(id);
    if (!deposit) return res.status(404).json({ error: "Deposit not found" });
    if (deposit.status !== "pending") return res.status(409).json({ error: `Already ${deposit.status}` });

    // Release straight to the player's own (thirdweb) wallet.
    const wallet = deposit.wallet || (await walletOfUser(deposit.user_id));

    let tx: string | null = null;
    if (isTokenConfigured()) {
        if (!wallet) {
            return res.status(400).json({ error: "Player hasn't connected a wallet yet — can't release tokens" });
        }
        tx = await mintReward(wallet, Number(deposit.amount));
        if (!tx) return res.status(502).json({ error: "On-chain mint failed — not marking approved" });
    }
    await DepositModel.setStatus(id, "approved", req.session!.user!.name || "admin", tx);
    return res.json({ approved: true, onChain: isTokenConfigured(), tx, wallet });
};

export const rejectDeposit = async (req: Request, res: Response) => {
    if (!isAdminUser(req.session?.user)) return res.status(403).end();
    const id = Number(req.params.id);
    const deposit = await DepositModel.findById(id);
    if (!deposit) return res.status(404).json({ error: "Deposit not found" });
    if (deposit.status !== "pending") return res.status(409).json({ error: `Already ${deposit.status}` });
    await DepositModel.setStatus(id, "rejected", req.session!.user!.name || "admin", null);
    return res.json({ rejected: true });
};
