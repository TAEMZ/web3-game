import type { User } from "@arena/types";
import { db } from "../index.js";

export const create = async (user: User, password: string) => {
    if (user.name === "Guest" || user.email === undefined) {
        return null;
    }

    try {
        const res = await db.query(
            `INSERT INTO "user"(name, email, password) VALUES($1, $2, $3) RETURNING id, name, email, wins, losses, draws`,
            [user.name, user.email || null, password]
        );
        return res.rows[0] as User;
    } catch (err: unknown) {
        console.log(err);
        return null;
    }
};

export const findById = async (id: number) => {
    if (id === 0) {
        return null;
    }
    try {
        const res = await db.query(
            `SELECT id, name, email, wins, losses, draws, resignations, is_admin, banned, subscribed FROM "user" WHERE id=$1`,
            [id]
        );
        if (res.rowCount) {
            return res.rows[0] as User;
        } else return null;
    } catch (err: unknown) {
        console.log(err);
        return null;
    }
};

export const findByNameEmail = async (user: User, includePassword = false, limit?: number) => {
    // if user is not specified, get all users
    if (!user) {
        try {
            const res = await db.query(
                `SELECT id, name, email, wins, losses, draws FROM "user" LIMIT $1`,
                [limit ?? 10]
            );
            return res.rows as (User & { password?: string })[];
        } catch (err: unknown) {
            console.log(err);
            return null;
        }
    }

    try {
        const res = await db.query(
            `SELECT id, name, email, wins, losses, draws, is_admin, banned${
                includePassword ? `, password` : ""
            } FROM "user" WHERE name=$1 OR email=$2 LIMIT $3`,
            [user.name, user.email, limit ?? 1]
        );
        return res.rows as (User & { password?: string })[];
    } catch (err: unknown) {
        console.log(err);
        return null;
    }
};

export const update = async (id: number, updatedUser: User & { password?: string }) => {
    if (id === 0) {
        return null;
    }

    try {
        let query = `UPDATE "user" SET name=$1, email=$2 WHERE id=$3 RETURNING id, name, email, wins, losses, draws`;
        let values = [updatedUser.name, updatedUser.email, id];

        if (updatedUser.password) {
            query = `UPDATE "user" SET name=$1, email=$2, password=$3 WHERE id=$4 RETURNING id, name, email, wins, losses, draws`;
            values = [updatedUser.name, updatedUser.email, updatedUser.password, id];
        }
        const res = await db.query(query, values);
        return res.rows[0] as User;
    } catch (err: unknown) {
        console.log(err);
        return null;
    }
};

export const remove = async (id: number) => {
    if (id === 0) {
        return null;
    }

    try {
        const res = await db.query(`DELETE FROM "user" WHERE id = $1 RETURNING id, name, email`, [
            id
        ]);
        return res.rows[0] as User;
    } catch (err: unknown) {
        console.log(err);
        return null;
    }
};

export const promoteAdmin = async (id: number) => {
    try {
        await db.query(`UPDATE "user" SET is_admin = true WHERE id = $1`, [id]);
    } catch (err: unknown) {
        console.log(err);
    }
};

// Attach a wallet address to an existing account.
export const linkWallet = async (userId: number, address: string) => {
    try {
        await db.query(`UPDATE "user" SET wallet_address = $1 WHERE id = $2`, [address, userId]);
        return true;
    } catch (err: unknown) {
        console.log(err);
        return false;
    }
};

// Absorb a duplicate account (fromId) into a keeper account (intoId): add its
// win/loss records, reassign its games and reports, then delete it. Used when a
// player links a wallet that had accidentally become its own separate account.
export const mergeInto = async (intoId: number, fromId: number) => {
    try {
        await db.query(
            `UPDATE "user" i SET
                wins = i.wins + f.wins,
                losses = i.losses + f.losses,
                draws = i.draws + f.draws,
                resignations = i.resignations + f.resignations
             FROM "user" f WHERE i.id = $1 AND f.id = $2`,
            [intoId, fromId]
        );
        await db.query(`UPDATE "game" SET white_id = $1 WHERE white_id = $2`, [intoId, fromId]);
        await db.query(`UPDATE "game" SET black_id = $1 WHERE black_id = $2`, [intoId, fromId]);
        await db.query(`UPDATE "report" SET reported_id = $1 WHERE reported_id = $2`, [intoId, fromId]);
        await db.query(`UPDATE "report" SET reporter_id = $1 WHERE reporter_id = $2`, [intoId, fromId]);
        await db.query(`DELETE FROM "user" WHERE id = $1`, [fromId]);
        return true;
    } catch (err: unknown) {
        console.log(err);
        return false;
    }
};

// Flip the one-time Arena Pass flag on (idempotent, keeps the first timestamp).
export const setSubscribed = async (id: number) => {
    if (!id) return false;
    try {
        await db.query(
            `UPDATE "user" SET subscribed = true, subscribed_at = COALESCE(subscribed_at, CURRENT_TIMESTAMP) WHERE id = $1`,
            [id]
        );
        return true;
    } catch (err: unknown) {
        console.log(err);
        return false;
    }
};

export const findByWallet = async (walletAddress: string) => {
    try {
        const res = await db.query(
            `SELECT id, name, email, wins, losses, draws, wallet_address, banned, is_admin, subscribed FROM "user" WHERE wallet_address=$1`,
            [walletAddress]
        );
        return res.rowCount ? (res.rows[0] as User & { wallet_address: string }) : null;
    } catch (err: unknown) {
        console.log(err);
        return null;
    }
};

export const createWithWallet = async (walletAddress: string, name: string) => {
    try {
        const res = await db.query(
            `INSERT INTO "user"(name, wallet_address) VALUES($1, $2) RETURNING id, name, email, wins, losses, draws, wallet_address`,
            [name, walletAddress]
        );
        return res.rows[0] as User & { wallet_address: string };
    } catch (err: unknown) {
        console.log(err);
        return null;
    }
};

const UserModel = {
    create,
    findById,
    findByNameEmail,
    findByWallet,
    createWithWallet,
    promoteAdmin,
    linkWallet,
    mergeInto,
    setSubscribed,
    update,
    remove
};

export default UserModel;
