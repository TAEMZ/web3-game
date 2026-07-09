"use client";

import type { User } from "@arena/types";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { fetchSession } from "@/lib/auth";
import { SessionContext } from "./session";

// NOTE: Wallets are platform-CUSTODIAL (Option 1) — the platform holds each
// player's wallet and stakes/settles on their behalf. Players never connect an
// external wallet, so the old thirdweb ThirdwebProvider + <WalletAuth /> (which
// auto-linked any connected wallet and could overwrite the custodial wallet) are
// intentionally removed.
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
    <SessionContext.Provider value={{ user, setUser }}>
      {children}
    </SessionContext.Provider>
  );
}
