import { getContract } from "thirdweb";

import { activeChain, thirdwebClient } from "./thirdweb";

// Deployed on Ethereum Sepolia (see contracts/deployed.sepolia.json). Public
// addresses — safe to hardcode; update here if the contracts are ever redeployed.
export const ARENA_TOKEN_ADDRESS = "0xa09a9f56167434af7b183a7d44ba0e06c1118d78";
export const ARENA_ESCROW_ADDRESS = "0x0b760c60e79abb5742997acb2e4dbd70439b492e";
export const ARENA_DECIMALS = 18;

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

// Whole ARENA tokens -> base units (wei) as a bigint.
export function toArenaWei(amount: number): bigint {
  return BigInt(Math.round(amount)) * BigInt("1" + "0".repeat(ARENA_DECIMALS));
}
