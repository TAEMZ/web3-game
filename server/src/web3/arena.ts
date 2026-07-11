// On-chain integration for Arena's ERC-20 rewards + wager escrow (Ethereum Sepolia).
//
// Everything here is guarded by isTokenConfigured()/isEscrowConfigured(): until
// the contracts are deployed and ARENA_TOKEN_ADDRESS / ARENA_ESCROW_ADDRESS are
// filled into server/.env, these helpers no-op gracefully so the app keeps
// running on the DB-simulated fallback. Once the addresses are set, rewards and
// wagers settle for real on-chain.
import {
    createPublicClient,
    createWalletClient,
    http,
    parseUnits,
    formatUnits,
    getAddress,
    type Address,
    type Hash,
    type TransactionReceipt
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { serializeTreasury } from "./treasuryQueue.js";

const CHAIN = sepolia; // Ethereum Sepolia testnet (chainId 11155111)
const TOKEN = (process.env.ARENA_TOKEN_ADDRESS || "").trim();
const ESCROW = (process.env.ARENA_ESCROW_ADDRESS || "").trim();
const PK = (process.env.DEPLOYER_PRIVATE_KEY || "").trim();
const RPC = (process.env.RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com").trim();

// ARENA is a standard 18-decimal ERC-20.
const DECIMALS = 18;

export const isTokenConfigured = () => Boolean(TOKEN && PK);
export const isEscrowConfigured = () => Boolean(ESCROW && PK);

const isAddr = (a?: string): a is string => !!a && /^0x[0-9a-fA-F]{40}$/.test(a);

// --- minimal ABIs (only what the server calls) --------------------------------
const tokenAbi = [
    { type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
    { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
    { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
    { type: "function", name: "MINTER_ROLE", stateMutability: "view", inputs: [], outputs: [{ type: "bytes32" }] },
    { type: "function", name: "hasRole", stateMutability: "view", inputs: [{ name: "role", type: "bytes32" }, { name: "account", type: "address" }], outputs: [{ type: "bool" }] },
    { type: "function", name: "grantRole", stateMutability: "nonpayable", inputs: [{ name: "role", type: "bytes32" }, { name: "account", type: "address" }], outputs: [] }
] as const;

const escrowAbi = [
    { type: "function", name: "settleMatch", stateMutability: "nonpayable", inputs: [{ name: "id", type: "uint256" }, { name: "winner", type: "address" }], outputs: [] },
    { type: "function", name: "settleDraw", stateMutability: "nonpayable", inputs: [{ name: "id", type: "uint256" }], outputs: [] },
    { type: "function", name: "cancelMatch", stateMutability: "nonpayable", inputs: [{ name: "id", type: "uint256" }], outputs: [] },
    {
        type: "function", name: "matches", stateMutability: "view", inputs: [{ name: "", type: "uint256" }],
        outputs: [{ name: "player1", type: "address" }, { name: "player2", type: "address" }, { name: "stake", type: "uint256" }, { name: "state", type: "uint8" }]
    },
    { type: "function", name: "nextMatchId", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
    { type: "function", name: "treasury", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
    { type: "function", name: "feePercent", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
    { type: "function", name: "setTreasury", stateMutability: "nonpayable", inputs: [{ name: "newTreasury", type: "address" }], outputs: [] },
    { type: "function", name: "setFeePercent", stateMutability: "nonpayable", inputs: [{ name: "newFee", type: "uint256" }], outputs: [] }
] as const;

// --- clients (lazy) -----------------------------------------------------------
const transport = http(RPC);
let _pub: ReturnType<typeof createPublicClient> | null = null;
let _wallet: ReturnType<typeof createWalletClient> | null = null;

const pub = () => (_pub ??= createPublicClient({ chain: CHAIN, transport }));
const wallet = () => {
    if (!_wallet) {
        const account = privateKeyToAccount(PK as `0x${string}`);
        _wallet = createWalletClient({ account, chain: CHAIN, transport });
    }
    return _wallet;
};

export const minterAddress = (): string | null => {
    if (!PK) return null;
    try {
        return privateKeyToAccount(PK as `0x${string}`).address;
    } catch {
        return null;
    }
};

/**
 * Mint `amount` ARENA (whole tokens) to a player's wallet. Returns the tx hash,
 * or null if not configured / invalid address / on error (never throws — reward
 * minting must not break the game-over flow).
 */
export async function mintReward(to: string, amount: number): Promise<Hash | null> {
    if (!isTokenConfigured()) return null;
    if (!isAddr(to)) {
        console.warn(`[web3] mintReward skipped: '${to}' is not a wallet address`);
        return null;
    }
    try {
        const value = parseUnits(String(amount), DECIMALS);
        const hash = await serializeTreasury(async () => {
            const h = await wallet().writeContract({
                address: getAddress(TOKEN) as Address,
                abi: tokenAbi,
                functionName: "mint",
                args: [getAddress(to) as Address, value],
                chain: CHAIN,
                account: wallet().account!
            });
            await pub().waitForTransactionReceipt({ hash: h });
            return h;
        });
        console.log(`[web3] minted ${amount} ARENA -> ${to}  tx=${hash}`);
        return hash;
    } catch (err) {
        console.error(`[web3] mintReward failed for ${to}:`, (err as Error).message);
        return null;
    }
}

/** Read a wallet's on-chain ARENA balance as whole tokens (number). */
export async function tokenBalanceOf(addr: string): Promise<number | null> {
    if (!isTokenConfigured() || !isAddr(addr)) return null;
    try {
        const raw = (await pub().readContract({
            address: getAddress(TOKEN) as Address,
            abi: tokenAbi,
            functionName: "balanceOf",
            args: [getAddress(addr) as Address]
        })) as bigint;
        return Number(formatUnits(raw, DECIMALS));
    } catch (err) {
        console.error(`[web3] balanceOf failed for ${addr}:`, (err as Error).message);
        return null;
    }
}

// Transfer(address,address,uint256) signature + zero-address topic, for burn checks.
const TRANSFER_SIG = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const ZERO_TOPIC = "0x" + "0".repeat(64);
const padTopic = (addr: string) => ("0x" + "0".repeat(24) + addr.toLowerCase().replace(/^0x/, "")).toLowerCase();

/**
 * Verify an on-chain ARENA burn: the tx succeeded and carries a
 * Transfer(from=wallet, to=0x0, value=amount) on the ARENA token. A cash-out uses
 * this to confirm the tokens were really destroyed — instead of re-reading the
 * balance, which is already reduced by the burn and wrongly rejected any cash-out
 * over ~half the balance (burning the ARENA with no payout).
 */
export async function verifyArenaBurn(txHash: string, wallet: string, amount: number): Promise<boolean> {
    if (!isTokenConfigured() || !isAddr(wallet) || !(amount > 0)) return false;
    if (!/^0x[0-9a-fA-F]{64}$/.test(txHash || "")) return false;
    try {
        // Read the receipt directly, retrying a few times only for the rare case
        // where the server's RPC hasn't indexed the just-mined burn yet — so a brief
        // lag never falsely rejects a real burn and loses the player's ARENA.
        let receipt: TransactionReceipt | undefined;
        for (let i = 0; i < 5; i++) {
            try {
                receipt = await pub().getTransactionReceipt({ hash: txHash as Hash });
                break;
            } catch {
                if (i === 4) return false;
                await new Promise((r) => setTimeout(r, 2000));
            }
        }
        if (!receipt || receipt.status !== "success") return false;
        const want = parseUnits(String(amount), DECIMALS);
        const token = getAddress(TOKEN).toLowerCase();
        const from = padTopic(wallet);
        for (const log of receipt.logs) {
            if (log.address.toLowerCase() !== token) continue;
            const t = log.topics;
            if (t.length < 3 || (t[0] || "").toLowerCase() !== TRANSFER_SIG) continue;
            if ((t[1] || "").toLowerCase() === from && (t[2] || "").toLowerCase() === ZERO_TOPIC && BigInt(log.data) === want) {
                return true;
            }
        }
        return false;
    } catch (err) {
        console.error(`[web3] verifyArenaBurn failed for ${txHash}:`, (err as Error).message);
        return false;
    }
}

/** Settle a wager: pay the whole pot to `winner`. */
export async function settleWager(matchId: number, winner: string): Promise<Hash | null> {
    if (!isEscrowConfigured() || !isAddr(winner)) return null;
    try {
        const hash = await serializeTreasury(async () => {
            const h = await wallet().writeContract({
                address: getAddress(ESCROW) as Address,
                abi: escrowAbi,
                functionName: "settleMatch",
                args: [BigInt(matchId), getAddress(winner) as Address],
                chain: CHAIN,
                account: wallet().account!
            });
            await pub().waitForTransactionReceipt({ hash: h });
            return h;
        });
        console.log(`[web3] settled wager #${matchId} -> winner ${winner}  tx=${hash}`);
        return hash;
    } catch (err) {
        console.error(`[web3] settleWager #${matchId} failed:`, (err as Error).message);
        return null;
    }
}

/** Settle a wager draw: refund both players. */
export async function settleWagerDraw(matchId: number): Promise<Hash | null> {
    if (!isEscrowConfigured()) return null;
    try {
        const hash = await serializeTreasury(async () => {
            const h = await wallet().writeContract({
                address: getAddress(ESCROW) as Address,
                abi: escrowAbi,
                functionName: "settleDraw",
                args: [BigInt(matchId)],
                chain: CHAIN,
                account: wallet().account!
            });
            await pub().waitForTransactionReceipt({ hash: h });
            return h;
        });
        console.log(`[web3] settled wager #${matchId} as draw  tx=${hash}`);
        return hash;
    } catch (err) {
        console.error(`[web3] settleWagerDraw #${matchId} failed:`, (err as Error).message);
        return null;
    }
}

export const config = {
    token: TOKEN || null,
    escrow: ESCROW || null,
    rpc: RPC,
    chainId: 11155111,
    decimals: DECIMALS
};
