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
    type Hash
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
