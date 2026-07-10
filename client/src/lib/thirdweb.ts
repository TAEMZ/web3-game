import { createThirdwebClient } from "thirdweb";
import { sepolia } from "thirdweb/chains";

// thirdweb client ID — get a free one at https://thirdweb.com/dashboard and put it
// in client/.env as NEXT_PUBLIC_THIRDWEB_CLIENT_ID. The placeholder keeps builds
// working; wallet + RPC features need a real id at runtime.
export const thirdwebClient = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "PLACEHOLDER_CLIENT_ID",
});

// The arena's contracts are deployed on Ethereum Sepolia (chainId 11155111).
export const activeChain = sepolia;
