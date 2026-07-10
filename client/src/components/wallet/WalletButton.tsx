"use client";

import { ConnectButton } from "thirdweb/react";
import { inAppWallet } from "thirdweb/wallets";

import { ARENA_TOKEN_ADDRESS, TEST_USD_ADDRESS } from "@/lib/contracts";
import { activeChain, thirdwebClient } from "@/lib/thirdweb";

// Google/email in-app wallet — the player logs in with Google and gets a wallet
// they own (no seed phrase, no extension). WalletAuth bridges it to a session.
const wallets = [inAppWallet({ auth: { options: ["google", "email"] } })];

// Our tokens are freshly-deployed testnet contracts, so thirdweb's indexer doesn't
// know them — without this the "View Assets" list only shows native ETH (USDC/ARENA
// read as 0 for everyone). Declaring them here makes the wallet list real balances;
// decimals are read on-chain (USDC = 6, ARENA = 18). Giving thirdweb an explicit
// token list also stops it rendering the native Sepolia row twice.
const supportedTokens = {
  [activeChain.id]: [
    { address: TEST_USD_ADDRESS, name: "Test USD", symbol: "USDC" },
    { address: ARENA_TOKEN_ADDRESS, name: "Arena", symbol: "ARENA" }
  ]
};

export default function WalletButton() {
  return (
    <div className="relative">
      <ConnectButton
        client={thirdwebClient}
        chain={activeChain}
        wallets={wallets}
        supportedTokens={supportedTokens}
        connectButton={{ label: "Connect Wallet", className: "w-full" }}
        connectModal={{ size: "compact", title: "Connect to Chess Arena" }}
      />
    </div>
  );
}
