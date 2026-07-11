import { db } from "../index.js";

export interface Withdrawal {
    id: number;
    user_id: number;
    user_name: string | null;
    amount: string;
    usd: string | null;
    birr: string | null;
    wallet: string | null;
    payout_to: string | null;
    burn_tx: string | null;
    status: "pending" | "paid" | "rejected";
    reviewed_by: string | null;
    reviewed_at: string | null;
    created_at: string;
}

export const create = async (w: {
    userId: number;
    userName: string;
    amount: number;
    usd: number;
    birr: number;
    wallet?: string;
    payoutTo?: string;
    burnTx?: string;
}): Promise<Withdrawal | null> => {
    try {
        const res = await db.query(
            `INSERT INTO "withdrawal"(user_id, user_name, amount, usd, birr, wallet, payout_to, burn_tx, status)
             VALUES($1, $2, $3, $4, $5, $6, $7, $8, 'pending') RETURNING *`,
            [w.userId, w.userName, w.amount, w.usd, w.birr, w.wallet || null, w.payoutTo || null, w.burnTx || null]
        );
        return res.rows[0] as Withdrawal;
    } catch (err) {
        console.log("withdrawal.create", err);
        return null;
    }
};

// Look up a withdrawal by the burn tx that funded it — used to reject re-using the
// same on-chain burn for more than one cash-out.
export const findByBurnTx = async (burnTx: string): Promise<Withdrawal | null> => {
    const res = await db.query(`SELECT * FROM "withdrawal" WHERE burn_tx=$1`, [burnTx]);
    return res.rowCount ? (res.rows[0] as Withdrawal) : null;
};

export const findById = async (id: number): Promise<Withdrawal | null> => {
    const res = await db.query(`SELECT * FROM "withdrawal" WHERE id=$1`, [id]);
    return res.rowCount ? (res.rows[0] as Withdrawal) : null;
};

export const listByUser = async (userId: number): Promise<Withdrawal[]> => {
    const res = await db.query(`SELECT * FROM "withdrawal" WHERE user_id=$1 ORDER BY id DESC LIMIT 50`, [userId]);
    return res.rows as Withdrawal[];
};

export const listByStatus = async (status = "pending"): Promise<Withdrawal[]> => {
    const res = await db.query(`SELECT * FROM "withdrawal" WHERE status=$1 ORDER BY created_at DESC LIMIT 200`, [status]);
    return res.rows as Withdrawal[];
};

export const setStatus = async (
    id: number,
    status: "paid" | "rejected",
    reviewedBy: string
): Promise<void> => {
    await db.query(
        `UPDATE "withdrawal" SET status=$1, reviewed_by=$2, reviewed_at=CURRENT_TIMESTAMP WHERE id=$3`,
        [status, reviewedBy, id]
    );
};

const WithdrawalModel = { create, findById, findByBurnTx, listByUser, listByStatus, setStatus };
export default WithdrawalModel;
