import type { User } from "@arena/types";
import type { NextFunction, Request, Response } from "express";

// Bootstrap admins by username via env (comma-separated), e.g.
//   ADMIN_NAMES=AdminBoss,Alice
// Anyone in this list becomes admin on login. A persisted is_admin=true column
// also grants admin, so admins can later be managed in the DB.
export const ADMIN_NAMES = (process.env.ADMIN_NAMES || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export function isAdminUser(user?: Partial<User> | null): boolean {
    if (!user) return false;
    if (user.is_admin === true) return true;
    return !!user.name && ADMIN_NAMES.includes(user.name);
}

/**
 * Express middleware that requires the authenticated user to be an admin.
 * Use on routes that should only be accessible by administrators.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
    if (!req.session?.user) {
        return res.status(401).json({ error: "Authentication required" });
    }
    if (!isAdminUser(req.session.user)) {
        return res.status(403).json({ error: "Admin access required" });
    }
    next();
}
