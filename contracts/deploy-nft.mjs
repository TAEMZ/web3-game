// Deploy ArenaNFT (soul-bound achievement badges) to Ethereum Sepolia.
// Reads DEPLOYER_PRIVATE_KEY / RPC_URL from ../server/.env, writes the address to
// deployed-nft.sepolia.json and appends ARENA_NFT_ADDRESS to ../server/.env.
import { createWalletClient, createPublicClient, http, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_ENV = join(__dirname, "..", "server", ".env");

function parseEnv(path) {
  const env = {};
  if (!existsSync(path)) return env;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

const env = parseEnv(SERVER_ENV);
const PK = env.DEPLOYER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
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
    console.error("\n✗ Deployer has 0 Sepolia ETH — fund it first.");
    process.exit(2);
  }

  const nft = load("ArenaNFT");
  console.log("\nDeploying ArenaNFT...");
  const hash = await wallet.deployContract({ abi: nft.abi, bytecode: nft.bytecode, args: [] });
  const rc = await pub.waitForTransactionReceipt({ hash });
  const addr = rc.contractAddress;
  console.log("✓ ArenaNFT:", addr, "(deployer already holds MINTER_ROLE)");

  const out = {
    chainId: 11155111,
    network: "ethereum-sepolia",
    deployer: account.address,
    ArenaNFT: addr,
    explorer: "https://sepolia.etherscan.io/address/" + addr,
  };
  writeFileSync(join(__dirname, "deployed-nft.sepolia.json"), JSON.stringify(out, null, 2));

  if (existsSync(SERVER_ENV)) {
    let t = readFileSync(SERVER_ENV, "utf8");
    if (/^ARENA_NFT_ADDRESS=/m.test(t)) t = t.replace(/^ARENA_NFT_ADDRESS=.*$/m, "ARENA_NFT_ADDRESS=" + addr);
    else t += (t.endsWith("\n") ? "" : "\n") + "ARENA_NFT_ADDRESS=" + addr + "\n";
    writeFileSync(SERVER_ENV, t);
  }

  console.log("\n=== DONE ===");
  console.log("ArenaNFT:", out.explorer);
  console.log("Wrote contracts/deployed-nft.sepolia.json + server/.env");
}

main().catch((e) => { console.error(e); process.exit(1); });
