import type { Request, Response } from "express";
import UserModel from "../db/models/user.model.js";
import SubscriptionModel from "../db/models/subscription.model.js";
import { isAdminUser } from "../util/admin.js";

// One-time "Arena Pass" that unlocks wager mode. The player pays in USD; the
// purchase lands in the admin queue, an admin verifies it, and the pass is granted
// (user.subscribed = true). No expiry — buy once, keep forever.
export const SUBSCRIPTION_USD = Number(process.env.SUBSCRIPTION_USD ?? 5);

// Player: do I hold the pass, or is a purchase pending admin verification?
export const getStatus = async (req: Request, res: Response) => {
    try {
        const uid = req.session.user?.id;
        let subscribed = !!req.session.user?.subscribed;
        let pending = false;
        if (typeof uid === "number") {
            const u = await UserModel.findById(uid);
            subscribed = !!u?.subscribed;
            if (req.session.user) req.session.user.subscribed = subscribed;
            if (!subscribed) pending = !!(await SubscriptionModel.pendingForUser(uid));
        }
        res.json({ subscribed, pending, priceUsd: SUBSCRIPTION_USD });
    } catch (err: unknown) {
        console.log(err);
        res.status(500).json({ error: "Server error." });
    }
};

// Player: buy the pass with USD → submit a request for an admin to verify.
export const requestSubscription = async (req: Request, res: Response) => {
    try {
        const user = req.session.user;
        if (!user?.id || typeof user.id !== "number") {
            return res.status(401).json({ error: "Sign in with your wallet first." });
        }
        if (user.subscribed) return res.status(200).json({ subscribed: true });

        const tx = typeof req.body?.tx === "string" ? req.body.tx.slice(0, 80) : null;
        const wallet = typeof req.body?.wallet === "string" ? req.body.wallet.slice(0, 64) : null;
        const created = await SubscriptionModel.createRequest({
            userId: user.id,
            userName: user.name || "player",
            usd: SUBSCRIPTION_USD,
            wallet,
            tx
        });
        if (!created) return res.status(500).json({ error: "Could not submit your request." });
        res.status(201).json({ pending: true, duplicate: created.duplicate, priceUsd: SUBSCRIPTION_USD });
    } catch (err: unknown) {
        console.log(err);
        res.status(500).json({ error: "Server error." });
    }
};

// Admin: list Arena Pass purchase requests.
export const listRequests = async (req: Request, res: Response) => {
    if (!isAdminUser(req.session?.user)) return res.status(403).end();
    const status = (req.query.status as string) || "pending";
    res.json({ requests: await SubscriptionModel.listByStatus(status) });
};

// Admin: verify a request → grant the pass.
export const approveRequest = async (req: Request, res: Response) => {
    if (!isAdminUser(req.session?.user)) return res.status(403).end();
    const id = Number(req.params.id);
    const reqRow = await SubscriptionModel.findById(id);
    if (!reqRow) return res.status(404).json({ error: "Request not found" });
    if (reqRow.status !== "pending") return res.status(409).json({ error: `Already ${reqRow.status}` });

    const ok = await UserModel.setSubscribed(reqRow.user_id);
    if (!ok) return res.status(500).json({ error: "Could not grant the pass." });
    await SubscriptionModel.setStatus(id, "approved", req.session!.user!.name || "admin");
    res.json({ approved: true });
};

export const rejectRequest = async (req: Request, res: Response) => {
    if (!isAdminUser(req.session?.user)) return res.status(403).end();
    const id = Number(req.params.id);
    const reqRow = await SubscriptionModel.findById(id);
    if (!reqRow) return res.status(404).json({ error: "Request not found" });
    if (reqRow.status !== "pending") return res.status(409).json({ error: `Already ${reqRow.status}` });
    await SubscriptionModel.setStatus(id, "rejected", req.session!.user!.name || "admin");
    res.json({ rejected: true });
};
