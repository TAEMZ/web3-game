"use client";

import type { User } from "@arena/types";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { ThirdwebProvider } from "thirdweb/react";

import WalletAuth from "@/components/wallet/WalletAuth";
import { fetchSession } from "@/lib/auth";
import { SessionContext } from "./session";

// Players own their wallet via thirdweb (Google in-app wallet). <WalletAuth />
// bridges a connected wallet to a server session; the wallet address becomes the
// player's on-chain identity for rewards, betting, and withdrawals.
export default function ContextProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>({});

  async function getSession() {
    const user = await fetchSession();
    setUser(user || null);
  }

  useEffect(() => {
    getSession();
  }, []);

  return (
    <ThirdwebProvider>
      <SessionContext.Provider value={{ user, setUser }}>
        <WalletAuth />
        {children}
      </SessionContext.Provider>
    </ThirdwebProvider>
  );
}
