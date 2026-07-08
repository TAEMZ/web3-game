import type { Request, Response } from "express";

import { db } from "../db/index.js";

export const REPORT_REASONS = ["cheating", "abusive_chat", "harassment", "other"];

// A player reports another player, optionally tied to a game + a chat snapshot.
export async function createReport(req: Request, res: Response) {
    try {
        const su = req.session.user;
        if (!su?.id) {
            res.status(401).json({ error: "Not authenticated" });
            return;
        }
        const reportedName = String(req.body.reportedName || "").slice(0, 64);
        const reason = String(req.body.reason || "");
        const note = String(req.body.note || "").slice(0, 2000);
        const gameCode = req.body.gameCode ? String(req.body.gameCode).slice(0, 16) : null;
        const chatSnapshot = req.body.chatSnapshot
            ? String(req.body.chatSnapshot).slice(0, 4000)
            : null;

        if (!reportedName || !REPORT_REASONS.includes(reason)) {
            res.status(400).json({ error: "A reported player and a valid reason are required." });
            return;
        }

        const r = await db.query(`SELECT id FROM "user" WHERE name = $1`, [reportedName]);
        const reportedId = r.rows[0]?.id ?? null;

        await db.query(
            `INSERT INTO "report"(reporter_id, reporter_name, reported_id, reported_name, reason, note, game_code, chat_snapshot)
             VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
            [
                typeof su.id === "number" ? su.id : null,
                su.name,
                reportedId,
                reportedName,
                reason,
                note,
                gameCode,
                chatSnapshot
            ]
        );
        res.json({ success: true });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to submit report" });
    }
}
