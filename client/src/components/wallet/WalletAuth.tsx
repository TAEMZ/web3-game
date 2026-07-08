"use client";

import { useContext, useEffect, useRef } from "react";
import { useActiveAccount } from "thirdweb/react";

import { SessionContext } from "@/context/session";
import { walletLogin } from "@/lib/auth";

// Bridges a connected thirdweb wallet to a server session: when a wallet is
// connected and we're not already signed in as it, ask for a signature and log in.
export default function WalletAuth() {
  const account = useActiveAccount();
  const session = useContext(SessionContext);
  const busy = useRef(false);

  useEffect(() => {
    if (!account) return;
    const address = account.address.toLowerCase();
    if (session?.user?.walletAddress === address) return;
    if (busy.current) return;
    busy.current = true;
    (async () => {
      const user = await walletLogin(address, (message) => account.signMessage({ message }));
      if (user) session?.setUser(user);
      busy.current = false;
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.address]);

  return null;
}
