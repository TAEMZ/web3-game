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
    // Admins don't use wallets — never bridge a connected wallet into an admin
    // session (that was the "admin shows a player's profile" bug). Just leave the
    // wallet as-is; don't disconnect it (that surprised admins mid-session).
    if (user?.is_admin) return;
    const address = account.address.toLowerCase();
    if (user?.walletAddress === address) return; // already your linked wallet
    if (busy.current) return;
    busy.current = true;
    (async () => {
      const u = await walletLogin(address, (message) => account.signMessage({ message }));
      if (u) session?.setUser(u);
      // Only drop a wallet that failed to bind to an ALREADY logged-in user (a stale
      // wallet that isn't theirs). NEVER disconnect for a logged-out / fresh session —
      // a signed-out user keeps their wallet connected.
      else if (user?.id && activeWallet) disconnect(activeWallet);
      busy.current = false;
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.address, session?.user]);

  return null;
}
