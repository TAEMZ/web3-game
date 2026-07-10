"use client";

import { ConnectButton } from "thirdweb/react";
import { inAppWallet } from "thirdweb/wallets";

import { activeChain, thirdwebClient } from "@/lib/thirdweb";

// Google/email in-app wallet — the player logs in with Google and gets a wallet
// they own (no seed phrase, no extension). WalletAuth bridges it to a session.
const wallets = [inAppWallet({ auth: { options: ["google", "email"] } })];

export default function WalletButton() {
  return (
    <div className="relative">
      <ConnectButton
        client={thirdwebClient}
        chain={activeChain}
        wallets={wallets}
        connectButton={{ label: "Connect Wallet", className: "w-full" }}
        connectModal={{ size: "compact", title: "Connect to Chess Arena" }}
      />
    </div>
  );
}
