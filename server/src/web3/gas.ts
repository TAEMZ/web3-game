// Auto-fund players' gas (option A): players own their thirdweb wallet and sign
// their own bets, but they shouldn't need to buy test-ETH. So when a wallet
// connects (or is about to bet) the platform tops it up with a little Sepolia ETH
// from the treasury. TESTNET/DEMO only.
import { createPublicClient, createWalletClient, http, parseEther, getAddress, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { serializeTreasury } from "./treasuryQueue.js";

const RPC = (process.env.RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com").trim();
const TREASURY_PK = (process.env.DEPLOYER_PRIVATE_KEY || "").trim();
const GAS_TOPUP = process.env.PLAYER_GAS_ETH || "0.004"; // sent per top-up
const GAS_FLOOR = parseEther(process.env.PLAYER_GAS_FLOOR || "0.0015"); // top up if below this

const isAddr = (a?: string): a is string => !!a && /^0x[0-9a-fA-F]{40}$/.test(a);
const configured = () => Boolean(TREASURY_PK);

const transport = http(RPC);
const pub = createPublicClient({ chain: sepolia, transport });
let _wallet: ReturnType<typeof createWalletClient> | null = null;
const treasury = () => {
    if (!_wallet) {
        const account = privateKeyToAccount(TREASURY_PK as `0x${string}`);
        _wallet = createWalletClient({ account, chain: sepolia, transport });
    }
    return _wallet;
};

/**
 * Send the player a little gas if their balance is low. Best-effort, never throws
 * (funding must not break login). Serialized on the treasury nonce.
 */
export async function fundGasIfLow(address: string): Promise<void> {
    if (!configured() || !isAddr(address)) return;
    try {
        const bal = await pub.getBalance({ address: getAddress(address) as Address });
        if (bal >= GAS_FLOOR) return;
        await serializeTreasury(async () => {
            const w = treasury();
            const hash = await w.sendTransaction({
                account: w.account!,
                chain: sepolia,
                to: getAddress(address) as Address,
                value: parseEther(GAS_TOPUP)
            });
            await pub.waitForTransactionReceipt({ hash });
        });
        console.log(`[gas] topped up ${address} with ${GAS_TOPUP} ETH`);
    } catch (err) {
        console.warn(`[gas] fund failed for ${address}:`, (err as Error).message);
    }
}
