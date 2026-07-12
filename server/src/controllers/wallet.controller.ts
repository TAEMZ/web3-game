import type { Request, Response } from "express";
import { db } from "../db/index.js";
import { ensureGas } from "../web3/gas.js";

const walletOfUser = async (userId: number): Promise<string | null> => {
    const r = await db.query(`SELECT wallet_address FROM "user" WHERE id=$1`, [userId]);
    return r.rowCount && r.rows[0].wallet_address ? (r.rows[0].wallet_address as string) : null;
};

/**
 * Top the caller's wallet up with gas if it is running low, and only return once
 * the money has actually landed. The client calls this immediately before every
 * transaction it signs (see client/src/lib/gas.ts).
 *
 * The address comes from the caller's own session, never from the request body:
 * funding an arbitrary address on request would make the treasury a free faucet
 * anyone could drain.
 */
export const ensureGasForMe = async (req: Request, res: Response) => {
    const userId = req.session?.user?.id;
    if (!userId || typeof userId !== "number") return res.status(401).end();

    const wallet = await walletOfUser(userId);
    if (!wallet) return res.status(400).json({ error: "No wallet linked to your account" });

    try {
        const { balance, funded, calls } = await ensureGas(wallet);
        return res.json({
            wallet,
            balance: balance.toString(),
            funded: funded.toString(),
            calls
        });
    } catch (err) {
        // The treasury is dry, or the RPC is down. The player's own wallet may still
        // hold enough to transact, so this is a warning, not a hard block — but it
        // must be visible, because the alternative is a player hitting
        // "insufficient funds" with no explanation.
        const message = (err as Error).message;
        console.error(`[gas] ensureGas failed for ${wallet}:`, message);
        return res.status(503).json({ error: "Could not top up gas", detail: message });
    }
};
