import { sendTransaction } from "thirdweb";
import { API_URL } from "@/config";

// Players sign their own transactions but never buy test-ETH — the treasury keeps
// their wallet topped up with gas.
//
// That top-up used to happen only at wallet sign-in, which is the wrong moment:
// gas is spent DURING a session, so a wallet that started the day funded could run
// dry between the two halves of a wager (approve, then createMatch) and fail with
// "insufficient funds for gas * price + value" — with nothing watching to refill it
// until the player happened to log in again.
//
// So we check here instead, immediately before every send. The server only tops up
// when the balance is actually low, and returns once the money has landed, so by
// the time sendTransaction runs the wallet can afford it.
async function ensureGas(): Promise<void> {
    try {
        await fetch(`${API_URL}/v1/wallet/ensure-gas`, {
            method: "POST",
            credentials: "include"
        });
    } catch {
        // Best-effort. If the top-up call itself fails the wallet may still hold
        // enough to cover this transaction, so let the send proceed and let the
        // wallet be the judge rather than blocking a player who was fine anyway.
    }
}

/** sendTransaction, but the player's wallet is topped up with gas first. */
export async function sendFunded(...args: Parameters<typeof sendTransaction>) {
    await ensureGas();
    return sendTransaction(...args);
}
