import { createThirdwebClient } from "thirdweb";
import { polygonAmoy } from "thirdweb/chains";

// thirdweb client ID — get a free one at https://thirdweb.com/dashboard and put it
// in client/.env as NEXT_PUBLIC_THIRDWEB_CLIENT_ID. The placeholder keeps builds
// working; wallet + RPC features need a real id at runtime.
export const thirdwebClient = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "PLACEHOLDER_CLIENT_ID",
});

// Testnet the arena runs on. Swap for `sepolia` from "thirdweb/chains" if preferred.
export const activeChain = polygonAmoy;
