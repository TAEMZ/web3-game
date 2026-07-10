// Soul-bound achievement badge NFTs (ArenaNFT on Sepolia). The treasury (MINTER)
// mints a badge to a player's wallet when they hit a win milestone. Guarded by
// ARENA_NFT_ADDRESS + DEPLOYER_PRIVATE_KEY; no-ops until deployed.
import { createPublicClient, createWalletClient, http, getAddress, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { serializeTreasury } from "./treasuryQueue.js";

const CHAIN = sepolia;
const NFT = (process.env.ARENA_NFT_ADDRESS || "").trim();
const PK = (process.env.DEPLOYER_PRIVATE_KEY || "").trim();
const RPC = (process.env.RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com").trim();

export const isNftConfigured = () => Boolean(NFT && PK);
const isAddr = (a?: string): a is string => !!a && /^0x[0-9a-fA-F]{40}$/.test(a);

// Win-count milestones → achievement index (0..2). Index 3 (Perfect Week) has no
// streak tracking yet, so it isn't auto-minted.
const MILESTONES: { need: number; achievement: number }[] = [
    { need: 1, achievement: 0 }, // First Victory
    { need: 10, achievement: 1 }, // Silver Champion
    { need: 100, achievement: 2 } // Gold Champion
];

const nftAbi = [
    { type: "function", name: "mintAchievement", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "achievement", type: "uint8" }], outputs: [{ type: "uint256" }] },
    { type: "function", name: "hasAchievement", stateMutability: "view", inputs: [{ name: "", type: "address" }, { name: "", type: "uint8" }], outputs: [{ type: "bool" }] },
    { type: "function", name: "getPlayerAchievements", stateMutability: "view", inputs: [{ name: "player", type: "address" }], outputs: [{ type: "bool[4]" }] }
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

/** Which of the 4 badges a wallet holds (bool[4]), or null if unavailable. */
export async function getPlayerBadges(addr: string): Promise<boolean[] | null> {
    if (!isNftConfigured() || !isAddr(addr)) return null;
    try {
        const res = (await pub().readContract({
            address: getAddress(NFT) as Address,
            abi: nftAbi,
            functionName: "getPlayerAchievements",
            args: [getAddress(addr) as Address]
        })) as readonly boolean[];
        return [...res];
    } catch (err) {
        console.error("[nft] getPlayerBadges failed:", (err as Error).message);
        return null;
    }
}

/** Mint any milestone badges the player has earned but doesn't hold yet. Best-effort, never throws. */
export async function mintBadgesFor(addr: string, wins: number): Promise<void> {
    if (!isNftConfigured() || !isAddr(addr)) return;
    try {
        for (const m of MILESTONES) {
            if (wins < m.need) continue;
            const has = (await pub().readContract({
                address: getAddress(NFT) as Address,
                abi: nftAbi,
                functionName: "hasAchievement",
                args: [getAddress(addr) as Address, m.achievement]
            })) as boolean;
            if (has) continue;
            await serializeTreasury(async () => {
                const h = await wallet().writeContract({
                    address: getAddress(NFT) as Address,
                    abi: nftAbi,
                    functionName: "mintAchievement",
                    args: [getAddress(addr) as Address, m.achievement],
                    chain: CHAIN,
                    account: wallet().account!
                });
                await pub().waitForTransactionReceipt({ hash: h });
            });
            console.log(`[nft] minted badge #${m.achievement} -> ${addr}`);
        }
    } catch (err) {
        console.warn("[nft] mintBadgesFor failed:", (err as Error).message);
    }
}

export const nftConfig = { address: NFT || null };
