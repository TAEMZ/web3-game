// Deploy TestUSD + ArenaExchange to Ethereum Sepolia, WITHOUT redeploying ArenaToken/ArenaEscrow.
// Grants the exchange MINTER_ROLE on both TestUSD (new) and the EXISTING ArenaToken so it can
// mint ARENA on buy and mint USDC on sell. Reads DEPLOYER_PRIVATE_KEY / RPC_URL from ../server/.env
// and the existing ArenaToken address from ./deployed.sepolia.json.
import { createWalletClient, createPublicClient, http, formatEther, keccak256, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_ENV = join(__dirname, "..", "server", ".env");
const RATE = BigInt(process.env.RATE || "100"); // ARENA (whole) per 1 USDC (whole). 100 => ARENA = $0.01

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
const RPC = env.RPC_URL || process.env.RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
if (!PK || !PK.startsWith("0x")) {
  console.error("DEPLOYER_PRIVATE_KEY missing (server/.env or env var)");
  process.exit(1);
}

const existing = JSON.parse(readFileSync(join(__dirname, "deployed.sepolia.json"), "utf8"));
const ARENA_TOKEN = existing.ArenaToken;
if (!ARENA_TOKEN) { console.error("ArenaToken address missing in deployed.sepolia.json"); process.exit(1); }

const account = privateKeyToAccount(PK);
const transport = http(RPC);
const pub = createPublicClient({ chain: sepolia, transport });
const wallet = createWalletClient({ account, chain: sepolia, transport });
const load = (n) => JSON.parse(readFileSync(join(__dirname, "artifacts", n + ".json"), "utf8"));

const MINTER_ROLE = keccak256(toHex("MINTER_ROLE"));
const GRANT_ABI = [{
  type: "function", name: "grantRole", stateMutability: "nonpayable",
  inputs: [{ name: "role", type: "bytes32" }, { name: "account", type: "address" }], outputs: [],
}];

async function send(label, req) {
  const hash = await wallet.writeContract(req);
  console.log(`  ${label} tx:`, hash);
  await pub.waitForTransactionReceipt({ hash });
}

async function main() {
  console.log("Deployer:", account.address);
  const bal = await pub.getBalance({ address: account.address });
  console.log("Balance :", formatEther(bal), "ETH (Sepolia)");
  console.log("Existing ArenaToken:", ARENA_TOKEN);
  console.log("Rate:", RATE.toString(), "ARENA per USDC");
  if (bal === 0n) {
    console.error("\n✗ Deployer has 0 Sepolia ETH — fund it first.");
    process.exit(2);
  }

  // 1. TestUSD (no constructor args)
  const usd = load("TestUSD");
  console.log("\nDeploying TestUSD...");
  let hash = await wallet.deployContract({ abi: usd.abi, bytecode: usd.bytecode, args: [] });
  let rc = await pub.waitForTransactionReceipt({ hash });
  const usdAddr = rc.contractAddress;
  console.log("✓ TestUSD :", usdAddr);

  // 2. ArenaExchange(usd, arenaToken, rate)
  const ex = load("ArenaExchange");
  console.log("\nDeploying ArenaExchange...");
  hash = await wallet.deployContract({ abi: ex.abi, bytecode: ex.bytecode, args: [usdAddr, ARENA_TOKEN, RATE] });
  rc = await pub.waitForTransactionReceipt({ hash });
  const exAddr = rc.contractAddress;
  console.log("✓ ArenaExchange:", exAddr);

  // 3. Grant exchange MINTER_ROLE on TestUSD (so it can mint USDC on sell-back)
  console.log("\nGranting MINTER_ROLE to exchange on TestUSD...");
  await send("grant(USDC)", { address: usdAddr, abi: GRANT_ABI, functionName: "grantRole", args: [MINTER_ROLE, exAddr] });

  // 4. Grant exchange MINTER_ROLE on the EXISTING ArenaToken (so it can mint ARENA on buy)
  console.log("Granting MINTER_ROLE to exchange on existing ArenaToken...");
  await send("grant(ARENA)", { address: ARENA_TOKEN, abi: GRANT_ABI, functionName: "grantRole", args: [MINTER_ROLE, exAddr] });

  const out = {
    chainId: 11155111,
    network: "ethereum-sepolia",
    deployer: account.address,
    rate: RATE.toString(),
    TestUSD: usdAddr,
    ArenaExchange: exAddr,
    ArenaToken: ARENA_TOKEN,
    explorer: {
      usd: "https://sepolia.etherscan.io/address/" + usdAddr,
      exchange: "https://sepolia.etherscan.io/address/" + exAddr,
    },
  };
  writeFileSync(join(__dirname, "deployed-usd.sepolia.json"), JSON.stringify(out, null, 2));

  // Append/refresh the two new addresses in server/.env (best-effort)
  if (existsSync(SERVER_ENV)) {
    let t = readFileSync(SERVER_ENV, "utf8");
    const set = (k, v) => {
      if (new RegExp("^" + k + "=", "m").test(t)) t = t.replace(new RegExp("^" + k + "=.*$", "m"), k + "=" + v);
      else t += (t.endsWith("\n") ? "" : "\n") + k + "=" + v + "\n";
    };
    set("TEST_USD_ADDRESS", usdAddr);
    set("ARENA_EXCHANGE_ADDRESS", exAddr);
    writeFileSync(SERVER_ENV, t);
  }

  console.log("\n=== DONE ===");
  console.log("TestUSD      :", out.explorer.usd);
  console.log("ArenaExchange:", out.explorer.exchange);
  console.log("Wrote contracts/deployed-usd.sepolia.json");
}

main().catch((e) => { console.error(e); process.exit(1); });
