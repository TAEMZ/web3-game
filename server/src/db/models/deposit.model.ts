import { db } from "../index.js";

export interface Deposit {
    id: number;
    user_id: number;
    user_name: string | null;
    amount: number;
    method: string | null;
    reference: string | null;
    wallet: string | null;
    status: "pending" | "approved" | "rejected";
    mint_tx: string | null;
    reviewed_by: string | null;
    reviewed_at: string | null;
    created_at: string;
}

export const create = async (d: {
    userId: number;
    userName: string;
    amount: number;
    method?: string;
    reference?: string;
    wallet?: string;
}): Promise<Deposit | null> => {
    try {
        const res = await db.query(
            `INSERT INTO "deposit"(user_id, user_name, amount, method, reference, wallet, status)
             VALUES($1, $2, $3, $4, $5, $6, 'pending') RETURNING *`,
            [d.userId, d.userName, d.amount, d.method || null, d.reference || null, d.wallet ? d.wallet.toLowerCase() : null]
        );
        return res.rows[0] as Deposit;
    } catch (err) {
        console.log("deposit.create", err);
        return null;
    }
};

export const findById = async (id: number): Promise<Deposit | null> => {
    const res = await db.query(`SELECT * FROM "deposit" WHERE id=$1`, [id]);
    return res.rowCount ? (res.rows[0] as Deposit) : null;
};

export const listByUser = async (userId: number): Promise<Deposit[]> => {
    const res = await db.query(`SELECT * FROM "deposit" WHERE user_id=$1 ORDER BY id DESC LIMIT 50`, [userId]);
    return res.rows as Deposit[];
};

export const listByStatus = async (status = "pending"): Promise<Deposit[]> => {
    const res = await db.query(`SELECT * FROM "deposit" WHERE status=$1 ORDER BY created_at DESC LIMIT 200`, [status]);
    return res.rows as Deposit[];
};

export const setStatus = async (
    id: number,
    status: "approved" | "rejected",
    reviewedBy: string,
    mintTx: string | null
): Promise<void> => {
    await db.query(
        `UPDATE "deposit" SET status=$1, reviewed_by=$2, mint_tx=$3, reviewed_at=CURRENT_TIMESTAMP WHERE id=$4`,
        [status, reviewedBy, mintTx, id]
    );
};

const DepositModel = { create, findById, listByUser, listByStatus, setStatus };
export default DepositModel;
