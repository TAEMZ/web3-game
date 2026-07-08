import type { Request } from "express";

import { db } from "../db/index.js";

// Real client IP. Behind the proxy/Caddy this comes from X-Forwarded-For; in a
// local tunnel it may resolve to loopback (the IP-ban still works, it just sees
// the tunnel address in dev).
export function clientIp(req: Request): string {
    const fwd = req.headers["x-forwarded-for"];
    if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0].trim();
    return req.socket.remoteAddress || "unknown";
}

export async function isIpBanned(ip: string): Promise<boolean> {
    try {
        const r = await db.query(`SELECT 1 FROM "banned_ip" WHERE ip = $1`, [ip]);
        return (r.rowCount ?? 0) > 0;
    } catch (err) {
        console.log(err);
        return false;
    }
}

export async function recordUserIp(userId: number, ip: string): Promise<void> {
    try {
        await db.query(`UPDATE "user" SET last_ip = $1 WHERE id = $2`, [ip, userId]);
    } catch (err) {
        console.log(err);
    }
}
