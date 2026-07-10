import { getContract } from "thirdweb";

import { activeChain, thirdwebClient } from "./thirdweb";

// Deployed on Ethereum Sepolia (see contracts/deployed.sepolia.json). Public
// addresses — safe to hardcode; update here if the contracts are ever redeployed.
export const ARENA_TOKEN_ADDRESS = "0xa09a9f56167434af7b183a7d44ba0e06c1118d78";
export const ARENA_ESCROW_ADDRESS = "0x0b760c60e79abb5742997acb2e4dbd70439b492e";
export const ARENA_DECIMALS = 18;

// Demo-USD (mock USDC, 6 decimals) + the ARENA<->USDC exchange. Deployed on
// Sepolia alongside the token — FILLED IN AFTER `deploy-usd.mjs` runs (see
// contracts/deployed-usd.sepolia.json). Placeholders until then.
export const TEST_USD_ADDRESS = "0xc7126fa76a9f7bb903c1049b59604eec2eb74c2f"; // TestUSD (Sepolia)
export const ARENA_EXCHANGE_ADDRESS = "0xe12a87996f190e9e0242a84f6f6eb6e2a5914950"; // ArenaExchange (Sepolia)
export const USDC_DECIMALS = 6;
export const EXCHANGE_RATE = 100; // ARENA per 1 USDC (mirror contracts RATE)

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
export const isExchangeReady =
  (ARENA_EXCHANGE_ADDRESS as string) !== ZERO_ADDR && (TEST_USD_ADDRESS as string) !== ZERO_ADDR;

export const tokenContract = getContract({
  client: thirdwebClient,
  chain: activeChain,
  address: ARENA_TOKEN_ADDRESS,
});

export const escrowContract = getContract({
  client: thirdwebClient,
  chain: activeChain,
  address: ARENA_ESCROW_ADDRESS,
});

export const usdContract = getContract({
  client: thirdwebClient,
  chain: activeChain,
  address: TEST_USD_ADDRESS,
});

export const exchangeContract = getContract({
  client: thirdwebClient,
  chain: activeChain,
  address: ARENA_EXCHANGE_ADDRESS,
});

// Whole ARENA tokens -> base units (wei) as a bigint.
export function toArenaWei(amount: number): bigint {
  return BigInt(Math.round(amount)) * BigInt("1" + "0".repeat(ARENA_DECIMALS));
}

// ARENA base units (wei) -> whole tokens (number, floored).
export function fromArenaWei(units: bigint): number {
  return Number(units / BigInt("1" + "0".repeat(ARENA_DECIMALS)));
}

// Whole USDC -> 6-decimal base units. Accepts fractional (e.g. 5.5 USDC).
export function toUsdcUnits(amount: number): bigint {
  return BigInt(Math.round(amount * 10 ** USDC_DECIMALS));
}

// USDC base units -> whole USDC (number).
export function fromUsdcUnits(units: bigint): number {
  return Number(units) / 10 ** USDC_DECIMALS;
}

// USDC (6-dec units) needed to buy `arena` whole tokens at the fixed rate,
// rounded UP so the buyer always gets at least `arena`.
export function usdcUnitsForArena(arena: number): bigint {
  const usdc = arena / EXCHANGE_RATE; // whole USDC
  return BigInt(Math.ceil(usdc * 10 ** USDC_DECIMALS));
}
