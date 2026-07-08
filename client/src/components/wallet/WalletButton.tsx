"use client";

import { ConnectButton } from "thirdweb/react";

import { activeChain, thirdwebClient } from "@/lib/thirdweb";

// Wallet-as-identity login. Connecting a wallet gives us the player's address,
// which the on-chain layer (rewards, escrow, badges) keys off of.
export default function WalletButton() {
  return (
    <div className="relative">
      <ConnectButton
        client={thirdwebClient}
        chain={activeChain}
        connectButton={{
          label: "Connect Wallet",
          className: "w-full"
        }}
        connectModal={{
          size: "compact"
        }}
        onConnect={() => {
          console.log("✅ [WALLET] Connected successfully");
        }}
      />
    </div>
  );
}
