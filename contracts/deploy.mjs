// Deploy ArenaToken + ArenaEscrow to Ethereum Sepolia using viem.
// Reads DEPLOYER_PRIVATE_KEY / RPC_URL from ../server/.env.
// Writes addresses to contracts/deployed.sepolia.json and back into ../server/.env.
import { createWalletClient, createPublicClient, http, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_ENV = join(__dirname, "..", "server", ".env");

function parseEnv(path) {
  const env = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

const env = parseEnv(SERVER_ENV);
const PK = env.DEPLOYER_PRIVATE_KEY;
const RPC = env.RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
if (!PK || !PK.startsWith("0x")) {
  console.error("DEPLOYER_PRIVATE_KEY missing in server/.env");
  process.exit(1);
}

const account = privateKeyToAccount(PK);
const transport = http(RPC);
const pub = createPublicClient({ chain: sepolia, transport });
const wallet = createWalletClient({ account, chain: sepolia, transport });

const load = (n) => JSON.parse(readFileSync(join(__dirname, "artifacts", n + ".json"), "utf8"));

async function main() {
  console.log("Deployer:", account.address);
  const bal = await pub.getBalance({ address: account.address });
  console.log("Balance :", formatEther(bal), "ETH (Sepolia)");
  if (bal === 0n) {
    console.error("\n✗ Deployer has 0 Sepolia ETH. Fund it first:");
    console.error("  Faucet : https://cloud.google.com/application/web3/faucet/ethereum/sepolia");
    console.error("  Address:", account.address);
    process.exit(2);
  }

  // 1. ArenaToken (no constructor args)
  const token = load("ArenaToken");
  console.log("\nDeploying ArenaToken...");
  let hash = await wallet.deployContract({ abi: token.abi, bytecode: token.bytecode, args: [] });
  let rc = await pub.waitForTransactionReceipt({ hash });
  const tokenAddr = rc.contractAddress;
  console.log("✓ ArenaToken :", tokenAddr, "(tx", hash + ")");

  // 2. ArenaEscrow(token, treasury, feePercent)
  const escrow = load("ArenaEscrow");
  const treasury = env.ARENA_TREASURY_ADDRESS || account.address; // defaults to deployer
  const feePercent = Number(env.HOUSE_FEE_PERCENT || "15");
  console.log("\nDeploying ArenaEscrow...");
  console.log("  Treasury :", treasury);
  console.log("  Fee      :", feePercent + "%");
  hash = await wallet.deployContract({ abi: escrow.abi, bytecode: escrow.bytecode, args: [tokenAddr, treasury, BigInt(feePercent)] });
  rc = await pub.waitForTransactionReceipt({ hash });
  const escrowAddr = rc.contractAddress;
  console.log("✓ ArenaEscrow:", escrowAddr, "(tx", hash + ")");

  // deployer already holds MINTER (token) + SETTLER (escrow) from the constructors.
  const deployed = {
    chainId: 11155111,
    network: "ethereum-sepolia",
    deployer: account.address,
    ArenaToken: tokenAddr,
    ArenaEscrow: escrowAddr,
    explorer: {
      token: "https://sepolia.etherscan.io/address/" + tokenAddr,
      escrow: "https://sepolia.etherscan.io/address/" + escrowAddr,
    },
  };
  writeFileSync(join(__dirname, "deployed.sepolia.json"), JSON.stringify(deployed, null, 2));

  // Update server/.env in place
  let envText = readFileSync(SERVER_ENV, "utf8");
  envText = envText.replace(/^ARENA_TOKEN_ADDRESS=.*$/m, "ARENA_TOKEN_ADDRESS=" + tokenAddr);
  envText = envText.replace(/^ARENA_ESCROW_ADDRESS=.*$/m, "ARENA_ESCROW_ADDRESS=" + escrowAddr);
  writeFileSync(SERVER_ENV, envText);

  console.log("\n=== DONE ===");
  console.log("ArenaToken :", deployed.explorer.token);
  console.log("ArenaEscrow:", deployed.explorer.escrow);
  console.log("Wrote contracts/deployed.sepolia.json and updated server/.env");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
