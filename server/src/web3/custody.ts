// Platform-custodial wallets (Option 1): the platform holds a wallet for each
// player so it can stake + settle wagers ON-CHAIN on their behalf. Players never
// connect a wallet or pay gas — they just click "Bet". TESTNET/DEMO ONLY: keys
// are stored in the DB (Sepolia has no real value).
import {
    createPublicClient,
    createWalletClient,
    http,
    parseUnits,
    parseEther,
    formatEther,
    maxUint256,
    getAddress,
    type Address
} from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { sepolia } from "viem/chains";
import { db } from "../db/index.js";
import { serializeTreasury } from "./treasuryQueue.js";

const RPC = (process.env.RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com").trim();
const TOKEN = (process.env.ARENA_TOKEN_ADDRESS || "").trim();
const ESCROW = (process.env.ARENA_ESCROW_ADDRESS || "").trim();
const TREASURY_PK = (process.env.DEPLOYER_PRIVATE_KEY || "").trim();
const GAS_TOPUP = process.env.CUSTODIAL_GAS_ETH || "0.004"; // gas seeded per custodial wallet

const transport = http(RPC);
const pub = createPublicClient({ chain: sepolia, transport });
const treasury = privateKeyToAccount(TREASURY_PK as `0x${string}`);
const treasuryWallet = createWalletClient({ account: treasury, chain: sepolia, transport });

const tokenAbi = [
    { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] },
    { type: "function", name: "allowance", stateMutability: "view", inputs: [{ type: "address" }, { type: "address" }], outputs: [{ type: "uint256" }] },
    { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
    { type: "function", name: "burn", stateMutability: "nonpayable", inputs: [{ type: "uint256" }], outputs: [] }
] as const;
const escrowAbi = [
    { type: "function", name: "createMatch", stateMutability: "nonpayable", inputs: [{ type: "uint256" }], outputs: [{ type: "uint256" }] },
    { type: "function", name: "joinMatch", stateMutability: "nonpayable", inputs: [{ type: "uint256" }], outputs: [] },
    { type: "function", name: "nextMatchId", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] }
] as const;

export const isCustodyConfigured = () => Boolean(TOKEN && ESCROW && TREASURY_PK);

const wait = (hash: `0x${string}`) => pub.waitForTransactionReceipt({ hash });

/**
 * Get (or lazily create) a player's custodial wallet. On first creation it is
 * funded with a little gas and pre-approves the escrow to pull ARENA, so later
 * bets are a single transaction. Also mirrors the address into user.wallet_address.
 */
export async function getOrCreateCustodial(userId: number): Promise<ReturnType<typeof privateKeyToAccount>> {
    const r = await db.query(`SELECT custodial_pk FROM "user" WHERE id=$1`, [userId]);
    let pk = r.rows[0]?.custodial_pk as string | undefined;
    let account: ReturnType<typeof privateKeyToAccount>;
    if (pk) {
        account = privateKeyToAccount(pk as `0x${string}`);
    } else {
        pk = generatePrivateKey();
        account = privateKeyToAccount(pk as `0x${string}`);
        await db.query(`UPDATE "user" SET custodial_pk=$1, wallet_address=$2 WHERE id=$3`, [
            pk,
            account.address.toLowerCase(),
            userId
        ]);
        console.log(`[custody] created wallet ${account.address} for user ${userId}`);
    }

    // Idempotent setup so a half-finished wallet self-heals on the next call.
    // 1) ensure gas — treasury tx, serialized to avoid nonce clashes
    const gas = await pub.getBalance({ address: account.address });
    if (gas < parseEther("0.0015")) {
        await serializeTreasury(async () => {
            const h = await treasuryWallet.sendTransaction({ to: account.address, value: parseEther(GAS_TOPUP) });
            await wait(h);
        });
    }
    // 2) ensure escrow allowance (signed by the custodial wallet itself)
    const allowance = (await pub.readContract({
        address: getAddress(TOKEN) as Address,
        abi: tokenAbi,
        functionName: "allowance",
        args: [account.address, getAddress(ESCROW) as Address]
    })) as bigint;
    if (allowance < parseUnits("1000000", 18)) {
        const wc = createWalletClient({ account, chain: sepolia, transport });
        await wait(
            await wc.writeContract({
                address: getAddress(TOKEN) as Address,
                abi: tokenAbi,
                functionName: "approve",
                args: [getAddress(ESCROW) as Address, maxUint256],
                chain: sepolia,
                account
            })
        );
    }
    return account;
}

export async function custodialAddress(userId: number): Promise<string | null> {
    const acct = await getOrCreateCustodial(userId).catch(() => null);
    return acct ? acct.address : null;
}

/** Player creates a wager: stake ARENA into the escrow from their custodial wallet. */
export async function stakeCreateMatch(userId: number, stakeTokens: number): Promise<{ matchId: number; wallet: string } | null> {
    if (!isCustodyConfigured()) return null;
    const account = await getOrCreateCustodial(userId);
    const stake = parseUnits(String(stakeTokens), 18);
    const bal = (await pub.readContract({ address: getAddress(TOKEN) as Address, abi: tokenAbi, functionName: "balanceOf", args: [account.address] })) as bigint;
    if (bal < stake) throw new Error("insufficient ARENA balance");

    const matchId = Number(await pub.readContract({ address: getAddress(ESCROW) as Address, abi: escrowAbi, functionName: "nextMatchId" }));
    const wc = createWalletClient({ account, chain: sepolia, transport });
    await wait(
        await wc.writeContract({ address: getAddress(ESCROW) as Address, abi: escrowAbi, functionName: "createMatch", args: [stake], chain: sepolia, account })
    );
    console.log(`[custody] user ${userId} staked ${stakeTokens} -> match #${matchId}`);
    return { matchId, wallet: account.address };
}

/** Player joins a wager: match the stake from their custodial wallet. */
export async function stakeJoinMatch(userId: number, matchId: number, stakeTokens: number): Promise<{ wallet: string } | null> {
    if (!isCustodyConfigured()) return null;
    const account = await getOrCreateCustodial(userId);
    const stake = parseUnits(String(stakeTokens), 18);
    const bal = (await pub.readContract({ address: getAddress(TOKEN) as Address, abi: tokenAbi, functionName: "balanceOf", args: [account.address] })) as bigint;
    if (bal < stake) throw new Error("insufficient ARENA balance");

    const wc = createWalletClient({ account, chain: sepolia, transport });
    await wait(
        await wc.writeContract({ address: getAddress(ESCROW) as Address, abi: escrowAbi, functionName: "joinMatch", args: [BigInt(matchId)], chain: sepolia, account })
    );
    console.log(`[custody] user ${userId} joined match #${matchId}`);
    return { wallet: account.address };
}

/**
 * Remove ARENA from a player's custodial wallet — used on cash-out, when the
 * admin has sent the fiat and the tokens should leave the player's balance.
 * Burns from the custodial wallet (the platform controls its key).
 */
export async function burnFromCustodial(userId: number, amountTokens: number): Promise<`0x${string}` | null> {
    if (!isCustodyConfigured()) return null;
    const account = await getOrCreateCustodial(userId);
    const amount = parseUnits(String(amountTokens), 18);
    const bal = (await pub.readContract({ address: getAddress(TOKEN) as Address, abi: tokenAbi, functionName: "balanceOf", args: [account.address] })) as bigint;
    if (bal < amount) throw new Error("insufficient ARENA balance");
    const wc = createWalletClient({ account, chain: sepolia, transport });
    const h = await wc.writeContract({ address: getAddress(TOKEN) as Address, abi: tokenAbi, functionName: "burn", args: [amount], chain: sepolia, account });
    await wait(h);
    console.log(`[custody] burned ${amountTokens} ARENA from user ${userId} (cash-out)`);
    return h;
}

export async function treasuryGas(): Promise<string> {
    return formatEther(await pub.getBalance({ address: treasury.address }));
}
