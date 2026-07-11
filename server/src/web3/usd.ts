// Testnet demo USD (mock USDC, 6 decimals). The treasury mints it and drips a
// little to each player on sign-in so "dollars" are a real coin in their wallet.
// NOT real money. Guarded by TEST_USD_ADDRESS + DEPLOYER_PRIVATE_KEY; until the
// TestUSD contract is deployed and its address is in server/.env these no-op.
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

const CHAIN = sepolia;
const USD = (process.env.TEST_USD_ADDRESS || "").trim();
const PK = (process.env.DEPLOYER_PRIVATE_KEY || "").trim();
const RPC = (process.env.RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com").trim();
const DECIMALS = 6; // like real USDC

// How much demo USD to give a player, and the floor below which we top them up.
const USD_DRIP = process.env.USD_DRIP || "100"; // whole USDC per top-up
const USD_FLOOR = Number(process.env.USD_FLOOR || "10"); // top up if below this

export const isUsdConfigured = () => Boolean(USD && PK);
const isAddr = (a?: string): a is string => !!a && /^0x[0-9a-fA-F]{40}$/.test(a);

const usdAbi = [
    { type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
    { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] }
] as const;

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

/** Read a wallet's demo-USD balance as whole USDC (number), or null. */
export async function usdBalanceOf(addr: string): Promise<number | null> {
    if (!isUsdConfigured() || !isAddr(addr)) return null;
    try {
        const raw = (await pub().readContract({
            address: getAddress(USD) as Address,
            abi: usdAbi,
            functionName: "balanceOf",
            args: [getAddress(addr) as Address]
        })) as bigint;
        return Number(formatUnits(raw, DECIMALS));
    } catch (err) {
        console.error(`[usd] balanceOf failed for ${addr}:`, (err as Error).message);
        return null;
    }
}

/**
 * Give the player some demo USD if they're low. Best-effort, never throws
 * (must not break login). Serialized on the treasury nonce.
 */
export async function dripUsdIfLow(address: string): Promise<Hash | null> {
    if (!isUsdConfigured() || !isAddr(address)) return null;
    try {
        const bal = await usdBalanceOf(address);
        if (bal !== null && bal >= USD_FLOOR) return null;
        const value = parseUnits(USD_DRIP, DECIMALS);
        const hash = await serializeTreasury(async () => {
            const h = await wallet().writeContract({
                address: getAddress(USD) as Address,
                abi: usdAbi,
                functionName: "mint",
                args: [getAddress(address) as Address, value],
                chain: CHAIN,
                account: wallet().account!
            });
            await pub().waitForTransactionReceipt({ hash: h });
            return h;
        });
        console.log(`[usd] dripped ${USD_DRIP} USDC -> ${address}  tx=${hash}`);
        return hash;
    } catch (err) {
        console.warn(`[usd] drip failed for ${address}:`, (err as Error).message);
        return null;
    }
}

/**
 * Release an exact amount of demo USD to a wallet — used to pay out a cash-out
 * (player burned ARENA → we return the USDC), mirroring how a buy releases ARENA.
 * Best-effort; returns the tx hash or null. Serialized on the treasury nonce.
 */
export async function mintUsd(to: string, wholeUsd: number): Promise<Hash | null> {
    if (!isUsdConfigured() || !isAddr(to) || !(wholeUsd > 0)) return null;
    try {
        const value = parseUnits(wholeUsd.toFixed(DECIMALS), DECIMALS);
        const hash = await serializeTreasury(async () => {
            const h = await wallet().writeContract({
                address: getAddress(USD) as Address,
                abi: usdAbi,
                functionName: "mint",
                args: [getAddress(to) as Address, value],
                chain: CHAIN,
                account: wallet().account!
            });
            await pub().waitForTransactionReceipt({ hash: h });
            return h;
        });
        console.log(`[usd] released ${wholeUsd} USDC -> ${to}  tx=${hash}`);
        return hash;
    } catch (err) {
        console.warn(`[usd] mintUsd failed for ${to}:`, (err as Error).message);
        return null;
    }
}

export const usdConfig = {
    address: USD || null,
    decimals: DECIMALS,
    drip: Number(USD_DRIP)
};
