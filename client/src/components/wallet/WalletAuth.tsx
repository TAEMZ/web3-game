"use client";

import { useContext, useEffect, useRef } from "react";
import { useActiveAccount, useActiveWallet, useDisconnect } from "thirdweb/react";

import { SessionContext } from "@/context/session";
import { isSignedOut, walletLogin } from "@/lib/auth";

// Bridges a connected thirdweb wallet to a server session: when a wallet is
// connected and we're not already signed in as it, ask for a signature and log in.
export default function WalletAuth() {
  const account = useActiveAccount();
  const activeWallet = useActiveWallet();
  const { disconnect } = useDisconnect();
  const session = useContext(SessionContext);
  const busy = useRef(false);

  useEffect(() => {
    if (!account) return;
    const user = session?.user;
    // Wait until the session check has resolved (undefined = unchecked, {} = still
    // loading) so a reconnected wallet can't act before we know who's signed in.
    if (user === undefined) return;
    if (user && Object.keys(user).length === 0) return;
    // The user explicitly logged out — keep the wallet connected, but don't
    // re-authenticate from it until they deliberately sign in again.
    if (isSignedOut()) return;
    // Admins don't use wallets. A stale wallet auto-reconnecting from a previous
    // player must never bridge into (and hijack/merge) an admin session.
    // Admins never use wallets — a stale connected wallet must not show as theirs.
    if (user?.is_admin) {
      if (activeWallet) disconnect(activeWallet);
      return;
    }
    const address = account.address.toLowerCase();
    if (user?.walletAddress === address) return; // already your linked wallet
    if (busy.current) return;
    busy.current = true;
    (async () => {
      const u = await walletLogin(address, (message) => account.signMessage({ message }));
      if (u) session?.setUser(u);
      // The wallet couldn't sign in as / link to the current user (it's someone
      // else's, or you already have a different one) — disconnect it so it isn't
      // shown as yours. A guest connecting their OWN wallet succeeds above (drip).
      else if (activeWallet) disconnect(activeWallet);
      busy.current = false;
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.address, session?.user]);

  return null;
}
