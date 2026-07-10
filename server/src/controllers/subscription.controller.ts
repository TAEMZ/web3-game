import type { Request, Response } from "express";
import UserModel from "../db/models/user.model.js";

// One-time "Arena Pass" that unlocks wager (betting) mode. The player pays by
// burning ARENA from their own wallet client-side and posts the burn tx here;
// we record it and flip the flag. No expiry — buy once, keep forever.
export const SUBSCRIPTION_ARENA = Number(process.env.SUBSCRIPTION_ARENA ?? 500);

export const getStatus = async (req: Request, res: Response) => {
    try {
        const uid = req.session.user?.id;
        let subscribed = !!req.session.user?.subscribed;
        // Trust the DB, not just the session (covers older sessions / other login paths).
        if (typeof uid === "number") {
            const u = await UserModel.findById(uid);
            subscribed = !!u?.subscribed;
            if (req.session.user) req.session.user.subscribed = subscribed;
        }
        res.json({ subscribed, price: SUBSCRIPTION_ARENA });
    } catch (err: unknown) {
        console.log(err);
        res.status(500).json({ error: "Server error." });
    }
};

export const subscribe = async (req: Request, res: Response) => {
    try {
        const uid = req.session.user?.id;
        if (!uid || typeof uid !== "number") {
            res.status(401).json({ error: "Sign in with your wallet first." });
            return;
        }
        if (req.session.user?.subscribed) {
            res.status(200).json({ subscribed: true, price: SUBSCRIPTION_ARENA });
            return;
        }
        const tx = typeof req.body?.tx === "string" ? req.body.tx.slice(0, 80) : null;
        const ok = await UserModel.setSubscribed(uid);
        if (!ok) {
            res.status(500).json({ error: "Could not activate the Arena Pass." });
            return;
        }
        if (tx) console.log(`[subscription] user ${uid} paid Arena Pass, burn tx=${tx}`);
        if (req.session.user) req.session.user.subscribed = true;
        req.session.save(() => res.status(200).json({ subscribed: true, price: SUBSCRIPTION_ARENA }));
    } catch (err: unknown) {
        console.log(err);
        res.status(500).json({ error: "Server error." });
    }
};
