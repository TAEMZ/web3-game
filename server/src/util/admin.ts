import type { User } from "@arena/types";

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
