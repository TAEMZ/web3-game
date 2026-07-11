// One-shot recovery: mint back ARENA that was burned in cash-outs that never paid
// out (the pre-fix bug). Run this WHERE your minter key is (locally with server/.env
// loaded, or on Render). It uses the same DEPLOYER_PRIVATE_KEY the app mints with.
//
//   Run from the server/ folder (so viem resolves):
//     DEPLOYER_PRIVATE_KEY=0x... node recover-mint.mjs
//   or, if server/.env already has it:
//     node -r dotenv/config recover-mint.mjs dotenv_config_path=.env
//
// Delete this file after — it is NOT part of the app.

import { createWalletClient, createPublicClient, http, parseUnits, getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

const PK = (process.env.DEPLOYER_PRIVATE_KEY || "").trim();
const ARENA = (process.env.ARENA_TOKEN_ADDRESS || "0xa09a9f56167434af7b183a7d44ba0e06c1118d78").trim();
const RPC = (process.env.RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com").trim();

// Who is owed how much (from the on-chain audit: burned − paid).
const OWED = [
  { name: "aetx", to: "0xF38AEfb8eEA6eFaB6511F6Ec8047Eb753776C9B4", amount: 3300 }
];

if (!PK) { console.error("Set DEPLOYER_PRIVATE_KEY (your minter key) and re-run."); process.exit(1); }

const abi = [{ type: "function", name: "mint", stateMutability: "nonpayable",
  inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] }];
const account = privateKeyToAccount(PK.startsWith("0x") ? PK : "0x" + PK);
const wallet = createWalletClient({ account, chain: sepolia, transport: http(RPC) });
const pub = createPublicClient({ chain: sepolia, transport: http(RPC) });

console.log(`Minter: ${account.address}`);
for (const { name, to, amount } of OWED) {
  const hash = await wallet.writeContract({
    address: getAddress(ARENA), abi, functionName: "mint",
    args: [getAddress(to), parseUnits(String(amount), 18)], chain: sepolia, account
  });
  console.log(`  ${name}: minting ${amount} ARENA -> ${to}  tx=${hash}`);
  const r = await pub.waitForTransactionReceipt({ hash });
  console.log(`  ${name}: ${r.status === "success" ? "DONE ✓" : "FAILED ✗"}`);
}
console.log("Recovery complete.");
