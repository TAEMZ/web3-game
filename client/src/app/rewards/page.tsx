"use client";

import { IconCoins, IconMedal, IconMedal2, IconStar, IconTrophy, IconArrowUpRight, IconArrowDownLeft, IconWallet } from "@tabler/icons-react";
import { useCallback, useContext, useEffect, useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { prepareContractCall, readContract, sendTransaction, waitForReceipt } from "thirdweb";
import { SessionContext } from "@/context/session";
import { API_URL } from "@/config";
import { activeChain, thirdwebClient } from "@/lib/thirdweb";
import { tokenContract, toArenaWei, ARENA_NFT_ADDRESS, usdContract, usdcUnitsForArena, fromUsdcUnits, fromArenaWei } from "@/lib/contracts";
import { useRouter } from "next/navigation";

const BAL = "function balanceOf(address) view returns (uint256)";

interface Achievement {
  id: number;
  name: string;
  earned: boolean;
}

interface Conversion {
  arenaToUsd: number;
  usdToBirr: number;
  usd: number;
  birr: number;
}

interface RewardsData {
  totalTokens: number;
  onChain: boolean;
  walletLinked: boolean;
  wallet: string | null;
  token: string | null;
  simulatedTokens: number;
  penalty?: number;
  resignPenalty?: number;
  conversion: Conversion;
  achievements: Achievement[];
  badges?: boolean[] | null;
  nftAddress?: string | null;
  stats: { wins: number; losses: number; draws: number; resignations?: number };
}

interface Deposit {
  id: number;
  amount: string;
  method: string | null;
  reference: string | null;
  status: "pending" | "approved" | "rejected";
  mint_tx: string | null;
  created_at: string;
}

interface Withdrawal {
  id: number;
  amount: string;
  usd: string | null;
  status: "pending" | "paid" | "rejected";
  created_at: string;
}

export default function RewardsPage() {
  const session = useContext(SessionContext);
  const router = useRouter();
  const account = useActiveAccount();
  const [rewards, setRewards] = useState<RewardsData | null>(null);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);

  // buy ARENA with TestUSD, then an admin verifies the payment & releases (mints) — no instant swap
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [wallet, setWallet] = useState("");
  const [treasury, setTreasury] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // withdraw form
  const [wAmount, setWAmount] = useState("");
  const [payoutTo, setPayoutTo] = useState("");
  const [wSubmitting, setWSubmitting] = useState(false);
  const [wNotice, setWNotice] = useState<string | null>(null);

  // Live on-chain balances of the CONNECTED wallet — the same source the wallet's
  // "View Assets" reads, so the numbers here match it and reflect every buy/sell.
  const [walletUsd, setWalletUsd] = useState<number | null>(null);
  const [walletArena, setWalletArena] = useState<number | null>(null);
  const refreshWallet = useCallback(async () => {
    if (!account) {
      setWalletUsd(null);
      setWalletArena(null);
      return;
    }
    try {
      const [u, a] = await Promise.all([
        readContract({ contract: usdContract, method: BAL, params: [account.address] }) as Promise<bigint>,
        readContract({ contract: tokenContract, method: BAL, params: [account.address] }) as Promise<bigint>,
      ]);
      setWalletUsd(fromUsdcUnits(u));
      setWalletArena(fromArenaWei(a));
    } catch {
      /* ignore transient RPC read errors */
    }
  }, [account]);
  useEffect(() => {
    refreshWallet();
  }, [refreshWallet]);

  // Keep the balance and the deposit/withdrawal logs in sync with reality: refetch
  // both when the tab regains focus (e.g. after an admin releases a buy or pays out
  // a cash-out), so the balance always matches the transaction history shown.
  useEffect(() => {
    const sync = () => {
      if (document.visibilityState === "visible") {
        load();
        refreshWallet();
      }
    };
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshWallet]);

  useEffect(() => {
    if (!session || session.user === undefined) return; // still checking auth
    if (!session.user) {
      router.push("/login");
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // treasury address that receives the TestUSD payment (same wallet the Arena Pass pays)
  useEffect(() => {
    fetch(`${API_URL}/v1/config`)
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => c?.treasuryAddress && setTreasury(c.treasuryAddress))
      .catch(() => {});
  }, []);

  async function load() {
    try {
      const [r, d, w] = await Promise.all([
        fetch(`${API_URL}/v1/rewards/user`, { credentials: "include" }),
        fetch(`${API_URL}/v1/deposits/mine`, { credentials: "include" }),
        fetch(`${API_URL}/v1/withdrawals/mine`, { credentials: "include" }),
      ]);
      if (r.ok) {
        const data: RewardsData = await r.json();
        setRewards(data);
        if (data.wallet) setWallet(data.wallet);
      }
      if (d.ok) setDeposits((await d.json()).deposits || []);
      if (w.ok) setWithdrawals((await w.json()).withdrawals || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const rate = rewards?.conversion;
  const amt = Number(amount) || 0;
  const usdcCost = amt > 0 ? fromUsdcUnits(usdcUnitsForArena(amt)) : 0;
  const wAmt = Number(wAmount) || 0;
  const wUsd = rate ? (wAmt * rate.arenaToUsd).toFixed(2) : "0";
  // The connected wallet's real on-chain balance is authoritative — it's what the
  // wallet's "View Assets" shows and what a cash-out can actually burn. The server
  // figure can be a DB estimate when the on-chain read / wallet link is unavailable.
  const serverBalance = rewards?.totalTokens ?? 0;
  const showOnChain = !!account && walletArena !== null;
  const balance = showOnChain ? (walletArena as number) : serverBalance;
  const displayUsd = rate ? balance * rate.arenaToUsd : 0;

  async function submitTopUp(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    if (!(amt > 0)) return setNotice("Enter an amount greater than 0.");
    if (!account) return setNotice("Connect your wallet (top-right) to buy ARENA.");
    if (!treasury) return setNotice("Payments aren't configured yet — try again shortly.");
    const payTo = wallet || account.address;
    setSubmitting(true);
    try {
      // 1) Pay in TestUSD — transfer the USDC cost to the treasury (real conversion, same as the Arena Pass).
      const cost = usdcUnitsForArena(amt);
      setNotice("Checking your USD…");
      const bal = (await readContract({ contract: usdContract, method: BAL, params: [account.address] })) as bigint;
      if (bal < cost) {
        setNotice(`Not enough USD — you have $${fromUsdcUnits(bal).toFixed(2)}, need $${fromUsdcUnits(cost).toFixed(2)}.`);
        return;
      }
      setNotice(`Paying $${fromUsdcUnits(cost).toFixed(2)} in USDC…`);
      const tx = prepareContractCall({
        contract: usdContract,
        method: "function transfer(address to, uint256 amount) returns (bool)",
        params: [treasury, cost],
      });
      const sent = await sendTransaction({ transaction: tx, account });
      await waitForReceipt({ client: thirdwebClient, chain: activeChain, transactionHash: sent.transactionHash });

      // 2) File the request for admin verify & release — the admin still mints; we never release here.
      setNotice("Submitting for verification…");
      const res = await fetch(`${API_URL}/v1/deposits`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amount: amt,
          method: "usdc",
          reference: `paid ${sent.transactionHash}${reference ? ` — ${reference}` : ""}`,
          wallet: payTo,
        }),
      });
      if (res.ok) {
        setNotice("Payment sent! An admin will verify it and release your ARENA.");
        setAmount("");
        setReference("");
        await load();
        await refreshWallet();
      } else {
        const err = await res.json().catch(() => ({}));
        setNotice(err.error || "Paid, but the request didn't save — give an admin your tx hash.");
      }
    } catch (err) {
      setNotice((err as Error)?.message?.slice(0, 140) || "Transaction failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitWithdraw(e: React.FormEvent) {
    e.preventDefault();
    setWNotice(null);
    if (!(wAmt > 0)) return setWNotice("Enter an amount greater than 0.");
    if (wAmt > balance) return setWNotice(`You only have ${balance} ARENA.`);
    if (!account) return setWNotice("Connect your wallet (top-right) to cash out.");
    setWSubmitting(true);
    try {
      // Player owns their tokens, so cashing out burns them from their own wallet
      // (they sign it). The admin then sends the cash and marks it paid.
      setWNotice("Confirm the cash-out in your wallet…");
      const burnTx = prepareContractCall({
        contract: tokenContract,
        method: "function burn(uint256 amount)",
        params: [toArenaWei(wAmt)],
      });
      const { transactionHash } = await sendTransaction({ transaction: burnTx, account });
      await waitForReceipt({ client: thirdwebClient, chain: activeChain, transactionHash });

      const res = await fetch(`${API_URL}/v1/withdrawals`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount: wAmt, payoutTo }),
      });
      if (res.ok) {
        setWNotice("Cash-out requested! Your ARENA was burned; an admin will send the cash and mark it paid.");
        setWAmount("");
        setPayoutTo("");
        await load();
        await refreshWallet();
      } else {
        const err = await res.json().catch(() => ({}));
        setWNotice(err.error || "Could not submit request.");
      }
    } catch (err) {
      setWNotice((err as Error)?.message?.slice(0, 140) || "Cash-out failed.");
    } finally {
      setWSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-[#E8C040]">Loading…</div>
      </div>
    );
  }
  if (!session?.user) return null;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="font-display mb-2 text-4xl font-bold gold-text-shimmer md:text-5xl">Your Wallet</h1>
        <p className="text-[rgba(216,204,176,0.6)]">Your ARENA balance, conversions, and achievements</p>
      </div>

      {/* Balance hero */}
      <div className="glass-dark relative mb-6 overflow-hidden rounded-2xl border border-[rgba(201,162,39,0.3)] p-6">
        <div className="tricolor-bar absolute inset-x-0 top-0" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display flex items-center gap-2 text-xl font-bold text-[#E8C040]">
            <IconCoins size={20} /> ARENA Balance
          </h2>
          <span
            className={`rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide ${
              showOnChain || rewards?.onChain
                ? "bg-[rgba(95,184,132,0.15)] text-[#5fb884]"
                : "bg-[rgba(216,204,176,0.1)] text-[rgba(216,204,176,0.5)]"
            }`}
          >
            {showOnChain || rewards?.onChain ? "● On-chain · Sepolia" : "Off-chain estimate"}
          </span>
        </div>

        <div className="py-4 text-center">
          <div className="mb-1 text-6xl font-bold gold-text-shimmer tabular-nums">{balance.toLocaleString()}</div>
          <p className="text-sm text-[rgba(216,204,176,0.6)]">ARENA tokens</p>
          {rate && (
            <p className="mt-2 text-sm text-[#d8ccb0]">
              ≈ <span className="font-semibold text-[#E8C040] tabular-nums">${displayUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span> USD
            </p>
          )}
          {(rewards?.penalty || 0) > 0 && (
            <p className="mt-2 text-xs text-red-400">
              −{rewards?.penalty} ARENA from {rewards?.stats.losses} loss
              {(rewards?.stats.losses || 0) > 1 ? "es" : ""}
            </p>
          )}
        </div>

        {/* wallet line + live spendable USDC (read from the connected wallet) */}
        <div className="mt-2 flex flex-col items-center gap-1.5 border-t border-[rgba(201,162,39,0.15)] pt-4 text-xs">
          <div className="flex items-center gap-2">
            <IconWallet size={15} className="text-[rgba(216,204,176,0.5)]" />
            {rewards?.walletLinked ? (
              <span className="font-mono text-[rgba(216,204,176,0.6)]">
                {rewards.wallet?.slice(0, 6)}…{rewards.wallet?.slice(-4)}
              </span>
            ) : (
              <span className="text-[rgba(216,204,176,0.5)]">
                No wallet linked — connect one in the account menu to hold tokens
              </span>
            )}
          </div>
          {showOnChain && walletUsd !== null && (
            <span className="text-[rgba(216,204,176,0.55)]">
              Spendable balance:{" "}
              <span className="font-semibold text-[#5fb884] tabular-nums">${walletUsd.toFixed(2)}</span> test USDC
            </span>
          )}
        </div>
      </div>

      {/* Admin-verified top-up request — the only way to buy ARENA */}
      <div className="glass-dark mb-6 rounded-2xl border border-[rgba(201,162,39,0.3)] p-6">
        <h2 className="font-display mb-1 flex items-center gap-2 text-xl font-bold text-[#E8C040]">
          <IconArrowUpRight size={20} /> Buy ARENA
        </h2>
        <p className="mb-4 text-sm text-[rgba(216,204,176,0.55)]">
          Pay in test USDC and{" "}
          <span className="text-[#E8C040]">an admin verifies your payment and releases the ARENA</span> to your wallet.{" "}
          <span className="text-[rgba(216,204,176,0.4)]">Testnet play-money — not real cash.</span>
        </p>

        <form onSubmit={submitTopUp} className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-[rgba(216,204,176,0.6)]">
            Amount (ARENA)
            <input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 500"
              className="rounded-lg border border-[rgba(201,162,39,0.2)] bg-[rgba(0,0,0,0.3)] px-3 py-2 text-sm text-[#e8dcc0] outline-none focus:border-[rgba(201,162,39,0.6)]"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[rgba(216,204,176,0.6)]">
            Note (optional)
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="demo — any note for the admin"
              className="rounded-lg border border-[rgba(201,162,39,0.2)] bg-[rgba(0,0,0,0.3)] px-3 py-2 text-sm text-[#e8dcc0] outline-none focus:border-[rgba(201,162,39,0.6)]"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[rgba(216,204,176,0.6)]">
            Wallet to receive (0x…)
            <input
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              placeholder="0x…"
              className="rounded-lg border border-[rgba(201,162,39,0.2)] bg-[rgba(0,0,0,0.3)] px-3 py-2 font-mono text-xs text-[#e8dcc0] outline-none focus:border-[rgba(201,162,39,0.6)]"
            />
          </label>

          <div className="sm:col-span-2">
            {amt > 0 && (
              <p className="mb-3 text-xs text-[rgba(216,204,176,0.6)]">
                {amt} ARENA — you pay <span className="font-semibold text-[#E8C040]">${usdcCost.toFixed(2)}</span> in test USDC
              </p>
            )}
            {notice && <p className="mb-3 text-xs text-[#5fb884]">{notice}</p>}
            <button type="submit" disabled={submitting} className="btn-gold w-full sm:w-auto">
              {submitting ? "Working…" : amt > 0 ? `Pay $${usdcCost.toFixed(2)} in USDC` : "Buy ARENA"}
            </button>
          </div>
        </form>

        {deposits.length > 0 && (
          <div className="mt-5 border-t border-[rgba(201,162,39,0.15)] pt-4">
            <p className="mb-2 text-xs uppercase tracking-wide text-[rgba(216,204,176,0.4)]">Your requests</p>
            <ul className="flex flex-col gap-1.5">
              {deposits.slice(0, 6).map((d) => (
                <li key={d.id} className="flex items-center justify-between rounded-lg bg-[rgba(0,0,0,0.25)] px-3 py-2 text-sm">
                  <span className="text-[#d8ccb0] tabular-nums">
                    {Number(d.amount)} ARENA
                    <span className="ml-2 text-xs text-[rgba(216,204,176,0.4)]">{d.method}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {d.mint_tx && (
                      <a
                        href={`https://sepolia.etherscan.io/tx/${d.mint_tx}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-[rgba(216,204,176,0.5)] underline hover:text-[#E8C040]"
                      >
                        tx
                      </a>
                    )}
                    <StatusPill status={d.status} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Withdraw / cash-out */}
      <div className="glass-dark mb-6 rounded-2xl border border-[rgba(201,162,39,0.3)] p-6">
        <h2 className="font-display mb-1 flex items-center gap-2 text-xl font-bold text-[#E8C040]">
          <IconArrowDownLeft size={20} /> Cash out
        </h2>
        <p className="mb-4 text-sm text-[rgba(216,204,176,0.55)]">
          Convert your ARENA back to cash. <span className="text-[#E8C040]">Demo only</span> — your ARENA is burned and an admin marks it paid.
        </p>

        <form onSubmit={submitWithdraw} className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-[rgba(216,204,176,0.6)]">
            Amount to cash out (ARENA)
            <input
              type="number"
              min={1}
              max={balance}
              value={wAmount}
              onChange={(e) => setWAmount(e.target.value)}
              placeholder={`up to ${balance}`}
              className="rounded-lg border border-[rgba(201,162,39,0.2)] bg-[rgba(0,0,0,0.3)] px-3 py-2 text-sm text-[#e8dcc0] outline-none focus:border-[rgba(201,162,39,0.6)]"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[rgba(216,204,176,0.6)]">
            Payout note (demo)
            <input
              value={payoutTo}
              onChange={(e) => setPayoutTo(e.target.value)}
              placeholder="demo — where you'd want the cash"
              className="rounded-lg border border-[rgba(201,162,39,0.2)] bg-[rgba(0,0,0,0.3)] px-3 py-2 text-sm text-[#e8dcc0] outline-none focus:border-[rgba(201,162,39,0.6)]"
            />
          </label>
          <div className="sm:col-span-2">
            {/* live conversion preview — burn X ARENA → receive $Y */}
            <div className="mb-3 rounded-lg border border-[rgba(201,162,39,0.15)] bg-[rgba(0,0,0,0.2)] px-4 py-3 text-center">
              <span className="text-sm text-[rgba(216,204,176,0.6)]">Burn </span>
              <span className="font-bold text-[#E8C040] tabular-nums">{wAmt || 0} ARENA</span>
              <span className="mx-2 text-[rgba(216,204,176,0.35)]">→ receive</span>
              <span className="text-lg font-bold text-[#5fb884] tabular-nums">${Number(wUsd).toLocaleString()}</span>
            </div>
            {wNotice && <p className="mb-3 text-xs text-[#5fb884]">{wNotice}</p>}
            <button
              type="submit"
              disabled={wSubmitting || balance <= 0}
              className="btn-gold w-full sm:w-auto disabled:cursor-not-allowed disabled:opacity-50"
            >
              {wSubmitting ? "Requesting…" : "Request cash-out"}
            </button>
          </div>
        </form>

        {withdrawals.length > 0 && (
          <div className="mt-5 border-t border-[rgba(201,162,39,0.15)] pt-4">
            <p className="mb-2 text-xs uppercase tracking-wide text-[rgba(216,204,176,0.4)]">Your cash-outs</p>
            <ul className="flex flex-col gap-1.5">
              {withdrawals.slice(0, 6).map((w) => (
                <li key={w.id} className="flex items-center justify-between rounded-lg bg-[rgba(0,0,0,0.25)] px-3 py-2 text-sm">
                  <span className="text-[#d8ccb0] tabular-nums">
                    {Number(w.amount)} ARENA
                    <span className="ml-2 text-xs text-[rgba(216,204,176,0.45)]">
                      → ${Number(w.usd).toLocaleString()}
                    </span>
                  </span>
                  <WStatusPill status={w.status} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Achievements */}
      <div className="glass-dark rounded-2xl border border-[rgba(201,162,39,0.3)] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display flex items-center gap-2 text-xl font-bold text-[#E8C040]">
            <IconTrophy size={20} /> Achievement Badges
          </h2>
          <span className="text-xs text-[rgba(216,204,176,0.4)]">NFT · Sepolia</span>
        </div>
        <ul className="flex flex-col gap-2">
          {[
            { Icon: IconMedal, name: "First Victory", desc: "Win your first game", idx: 0, color: "#cd8b52" },
            { Icon: IconMedal2, name: "Silver Champion", desc: "Win 10 games", idx: 1, color: "#c8c8d0" },
            { Icon: IconTrophy, name: "Gold Champion", desc: "Win 100 games", idx: 2, color: "#E8C040" },
            { Icon: IconStar, name: "Perfect Week", desc: "Win 7 in a row", idx: 3, color: "#a78bfa", soon: true },
          ].map((a) => {
            const earned = !!rewards?.badges?.[a.idx];
            return (
              <li
                key={a.name}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                style={{
                  background: earned ? "rgba(201,162,39,0.08)" : "rgba(13,22,18,0.5)",
                  border: `1px solid ${earned ? "rgba(201,162,39,0.3)" : "rgba(201,162,39,0.1)"}`,
                  opacity: a.soon && !earned ? 0.55 : 1,
                }}
              >
                <div
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
                  style={{
                    background: earned ? `${a.color}22` : "rgba(0,0,0,0.3)",
                    color: earned ? a.color : "rgba(216,204,176,0.35)",
                    border: `1px solid ${earned ? a.color + "66" : "rgba(201,162,39,0.15)"}`,
                  }}
                >
                  <a.Icon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[#d8ccb0]">{a.name}</span>
                    {earned && (
                      <span className="rounded-full bg-[rgba(95,184,132,0.15)] px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-[#5fb884]">
                        Owned
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-[rgba(216,204,176,0.45)]">{a.desc}</p>
                </div>
                <div className="shrink-0 text-right">
                  {earned ? (
                    <a
                      href={`https://sepolia.etherscan.io/token/${ARENA_NFT_ADDRESS}?a=${rewards?.wallet ?? ""}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-[#E8C040] underline-offset-2 hover:underline"
                    >
                      View NFT ↗
                    </a>
                  ) : a.soon ? (
                    <span className="text-[0.65rem] uppercase tracking-wide text-[rgba(216,204,176,0.35)]">Soon</span>
                  ) : (
                    <span className="text-[0.65rem] uppercase tracking-wide text-[rgba(216,204,176,0.35)]">Locked</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

    </main>
  );
}

function StatusPill({ status }: { status: "pending" | "approved" | "rejected" }) {
  const map = {
    pending: { t: "Pending", c: "#e0b34d", b: "rgba(224,179,77,0.15)" },
    approved: { t: "Released", c: "#5fb884", b: "rgba(95,184,132,0.15)" },
    rejected: { t: "Rejected", c: "#e06666", b: "rgba(224,102,102,0.15)" },
  }[status];
  return (
    <span className="rounded-full px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide" style={{ color: map.c, background: map.b }}>
      {map.t}
    </span>
  );
}

function WStatusPill({ status }: { status: "pending" | "paid" | "rejected" }) {
  const map = {
    pending: { t: "Pending", c: "#e0b34d", b: "rgba(224,179,77,0.15)" },
    paid: { t: "Paid", c: "#5fb884", b: "rgba(95,184,132,0.15)" },
    rejected: { t: "Rejected", c: "#e06666", b: "rgba(224,102,102,0.15)" },
  }[status];
  return (
    <span className="rounded-full px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide" style={{ color: map.c, background: map.b }}>
      {map.t}
    </span>
  );
}
