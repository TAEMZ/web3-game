import { db } from "./index.js";
import { settleWager, settleWagerDraw } from "../web3/arena.js";

export interface SettlementJob {
    id: number;
    wager_id: number;
    match_id: number;
    kind: "win" | "draw";
    winner_wallet: string | null;
    retries: number;
    max_retries: number;
    next_retry_at: Date;
    last_error: string | null;
    settled_tx: string | null;
}

/** Enqueue a failed settlement for later retry. */
export const enqueue = async (
    wagerId: number,
    matchId: number,
    kind: "win" | "draw",
    winnerWallet: string | null
): Promise<void> => {
    await db.query(
        `INSERT INTO "settlement_queue" (wager_id, match_id, kind, winner_wallet)
         VALUES ($1, $2, $3, $4)`,
        [wagerId, matchId, kind, winnerWallet]
    );
    console.log(`[settle-q] enqueued wager #${wagerId} (match ${matchId}, kind=${kind})`);
};

/** Process pending jobs that are due. Returns number of newly settled items. */
export const processQueue = async (): Promise<number> => {
    const { rows: pending } = await db.query<SettlementJob>(
        `SELECT * FROM "settlement_queue"
         WHERE settled_tx IS NULL
           AND retries < max_retries
           AND next_retry_at <= NOW()
         ORDER BY id
         LIMIT 10`
    );
    if (!pending.length) return 0;

    let settled = 0;
    for (const job of pending) {
        try {
            let tx: string | null = null;
            if (job.kind === "draw") {
                tx = await settleWagerDraw(job.match_id);
            } else if (job.winner_wallet) {
                tx = await settleWager(job.match_id, job.winner_wallet);
            }
            if (tx) {
                // Mark the wager row as settled
                await db.query(
                    `UPDATE "wager" SET state = 'settled', settle_tx = $1,
                        winner_wallet = COALESCE(winner_wallet, $2)
                     WHERE id = $3 AND state != 'settled'`,
                    [tx, job.winner_wallet, job.wager_id]
                );
                // Mark the queue job as done
                await db.query(
                    `UPDATE "settlement_queue" SET settled_tx = $1 WHERE id = $2`,
                    [tx, job.id]
                );
                console.log(`[settle-q] settled wager #${job.wager_id} tx=${tx}`);
                settled++;
            } else {
                // Still failing — increment retry count and back off
                const backoff = Math.min(60, 5 * Math.pow(2, job.retries)); // 5s, 10s, 20s, 40s, 60s
                await db.query(
                    `UPDATE "settlement_queue"
                     SET retries = retries + 1,
                         next_retry_at = NOW() + INTERVAL '1 second' * ${backoff},
                         last_error = 'on-chain call returned null'
                     WHERE id = $1`,
                    [job.id]
                );
            }
        } catch (err) {
            const msg = (err as Error).message.slice(0, 500);
            const backoff = Math.min(300, 10 * Math.pow(2, job.retries)); // 10s, 20s, 40s, … up to 5min
            await db.query(
                `UPDATE "settlement_queue"
                 SET retries = retries + 1,
                     next_retry_at = NOW() + INTERVAL '1 second' * ${backoff},
                     last_error = $1
                 WHERE id = $2`,
                [msg, job.id]
            );
            console.error(`[settle-q] retry ${job.retries + 1}/${job.max_retries} failed for wager #${job.wager_id}: ${msg}`);
        }
    }
    return settled;
};

/** Start the background retry loop (call once at server boot). */
let retryTimer: ReturnType<typeof setInterval> | null = null;
export const startSettlementRetryLoop = (intervalMs = 30_000): void => {
    if (retryTimer) return; // already running
    console.log(`[settle-q] retry loop started (every ${intervalMs / 1000}s)`);
    retryTimer = setInterval(async () => {
        try {
            const n = await processQueue();
            if (n) console.log(`[settle-q] settled ${n} job(s) this tick`);
        } catch (e) {
            console.error("[settle-q] loop error:", (e as Error).message);
        }
    }, intervalMs);
};

/** Stop the retry loop (for graceful shutdown). */
export const stopSettlementRetryLoop = (): void => {
    if (retryTimer) {
        clearInterval(retryTimer);
        retryTimer = null;
    }
};
