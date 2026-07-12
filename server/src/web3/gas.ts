// Auto-fund players' gas (option A): players own their thirdweb wallet and sign
// their own bets, but they shouldn't need to buy test-ETH. So the platform tops
// their wallet up with a little Sepolia ETH from the treasury — both when the
// wallet connects and, crucially, right before it is about to transact.
// TESTNET/DEMO only.
import {
    createPublicClient,
    createWalletClient,
    http,
    parseEther,
    formatEther,
    getAddress,
    type Address
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { serializeTreasury } from "./treasuryQueue.js";

const RPC = (process.env.RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com").trim();
const TREASURY_PK = (process.env.DEPLOYER_PRIVATE_KEY || "").trim();

// The allowance is budgeted in TRANSACTIONS, not in ether.
//
// It used to be a flat "send 0.004 ETH, refill below 0.0015". Both numbers rot
// silently as the network's gas price moves: at ~10 gwei a single contract call
// here reserves ~0.0026 ETH, so 0.004 bought barely one and a half calls — while
// every real flow (approve -> createMatch, approve -> buyArena) needs two. Worse,
// the 0.0015 floor sat BELOW the cost of one call, so a wallet could be "above
// the floor", get skipped by the top-up, and still afford nothing. That gap is
// what reaches the player as "insufficient funds for gas * price + value".
//
// Pricing the allowance off the live gas price keeps it correct on its own as the
// network moves, and guarantees the floor is always worth whole calls.
const GAS_PER_CALL = 300_000n; // a call here runs ~130k; wallets reserve ~2x. Round up hard.
const KEEP_CALLS = BigInt(process.env.PLAYER_GAS_CALLS || "8"); // fund a wallet up to this many calls
const FLOOR_CALLS = BigInt(process.env.PLAYER_GAS_FLOOR_CALLS || "3"); // ...and refill once below this many
const MAX_TOPUP = parseEther(process.env.PLAYER_GAS_MAX_ETH || "0.05"); // a gas spike must never drain the treasury

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

/** What a wallet needs right now, in wei, at the network's current gas price. */
async function budget() {
    const price = await pub.getGasPrice();
    const perCall = price * GAS_PER_CALL;
    return { perCall, floor: perCall * FLOOR_CALLS, target: perCall * KEEP_CALLS };
}

export type GasResult = { balance: bigint; funded: bigint; calls: number };

/**
 * Make sure `address` can afford its next few transactions, topping it up from the
 * treasury if not. Awaits the receipt, so by the time this resolves the money is
 * really there and the caller can safely sign. Serialized on the treasury nonce.
 *
 * Throws if a top-up was needed but could not be made. Callers that must not fail
 * on a funding error (login) should use fundGasIfLow instead.
 */
export async function ensureGas(address: string): Promise<GasResult> {
    if (!configured() || !isAddr(address)) return { balance: 0n, funded: 0n, calls: 0 };

    const player = getAddress(address) as Address;
    const bal = await pub.getBalance({ address: player });
    const { perCall, floor, target } = await budget();

    const callsFor = (wei: bigint) => Number(wei / perCall);
    if (bal >= floor) return { balance: bal, funded: 0n, calls: callsFor(bal) };

    let value = target - bal;
    if (value > MAX_TOPUP) value = MAX_TOPUP;

    await serializeTreasury(async () => {
        const w = treasury();
        const from = w.account!.address;

        // Don't fire a doomed transaction: if the treasury itself can't cover the
        // top-up plus its own gas, fail loudly here rather than let the player walk
        // into the same "insufficient funds" wall this function exists to prevent.
        const treasuryBal = await pub.getBalance({ address: from });
        if (treasuryBal < value + perCall) {
            throw new Error(
                `treasury ${from} is out of gas: has ${formatEther(treasuryBal)} ETH, ` +
                    `needs ${formatEther(value + perCall)} ETH to fund ${player}`
            );
        }

        const hash = await w.sendTransaction({
            account: w.account!,
            chain: sepolia,
            to: player,
            value
        });
        await pub.waitForTransactionReceipt({ hash });
    });

    const now = bal + value;
    console.log(
        `[gas] topped up ${player} with ${formatEther(value)} ETH ` +
            `(was ${formatEther(bal)}, now ${formatEther(now)}, ~${callsFor(now)} calls)`
    );
    return { balance: now, funded: value, calls: callsFor(now) };
}

/**
 * Best-effort top-up that never throws — for paths where a funding failure must
 * not break the request (e.g. login). Prefer ensureGas() before a real transaction.
 */
export async function fundGasIfLow(address: string): Promise<void> {
    try {
        await ensureGas(address);
    } catch (err) {
        console.warn(`[gas] fund failed for ${address}:`, (err as Error).message);
    }
}
