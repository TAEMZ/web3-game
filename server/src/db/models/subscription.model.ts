import { db } from "../index.js";

export interface SubRequest {
    id: number;
    user_id: number;
    user_name: string;
    usd: number;
    wallet: string | null;
    tx: string | null;
    status: string;
    created_at: string;
}

// Create a pending Arena Pass request. If the player already has one pending,
// return it instead of stacking duplicates.
export const createRequest = async (r: {
    userId: number;
    userName: string;
    usd: number;
    wallet?: string | null;
    tx?: string | null;
}): Promise<{ row: SubRequest; duplicate: boolean } | null> => {
    try {
        const dup = await db.query(
            `SELECT * FROM "subscription_request" WHERE user_id=$1 AND status='pending' ORDER BY created_at DESC LIMIT 1`,
            [r.userId]
        );
        if (dup.rowCount) return { row: dup.rows[0] as SubRequest, duplicate: true };
        const res = await db.query(
            `INSERT INTO "subscription_request"(user_id, user_name, usd, wallet, tx)
             VALUES($1, $2, $3, $4, $5) RETURNING *`,
            [r.userId, r.userName, r.usd, r.wallet ?? null, r.tx ?? null]
        );
        return { row: res.rows[0] as SubRequest, duplicate: false };
    } catch (err) {
        console.log("subscription.createRequest", err);
        return null;
    }
};

export const listByStatus = async (status: string): Promise<SubRequest[]> => {
    const res = await db.query(
        `SELECT * FROM "subscription_request" WHERE status=$1 ORDER BY created_at DESC`,
        [status]
    );
    return res.rows as SubRequest[];
};

export const findById = async (id: number): Promise<SubRequest | null> => {
    const res = await db.query(`SELECT * FROM "subscription_request" WHERE id=$1`, [id]);
    return res.rowCount ? (res.rows[0] as SubRequest) : null;
};

export const pendingForUser = async (userId: number): Promise<SubRequest | null> => {
    const res = await db.query(
        `SELECT * FROM "subscription_request" WHERE user_id=$1 AND status='pending' ORDER BY created_at DESC LIMIT 1`,
        [userId]
    );
    return res.rowCount ? (res.rows[0] as SubRequest) : null;
};

export const setStatus = async (id: number, status: string, reviewer: string): Promise<void> => {
    await db.query(
        `UPDATE "subscription_request" SET status=$1, reviewed_by=$2, reviewed_at=CURRENT_TIMESTAMP WHERE id=$3`,
        [status, reviewer, id]
    );
};

const SubscriptionModel = { createRequest, listByStatus, findById, pendingForUser, setStatus };
export default SubscriptionModel;
