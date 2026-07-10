"use client";

import { IconCoins, IconMedal, IconMedal2, IconStar, IconTrophy, IconArrowUpRight, IconArrowDownLeft, IconWallet } from "@tabler/icons-react";
import { useContext, useEffect, useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { prepareContractCall, sendTransaction, waitForReceipt } from "thirdweb";
import { SessionContext } from "@/context/session";
import { API_URL } from "@/config";
import { activeChain, thirdwebClient } from "@/lib/thirdweb";
import { tokenContract, toArenaWei, EXCHANGE_RATE, ARENA_NFT_ADDRESS } from "@/lib/contracts";
import ExchangeModal from "@/components/exchange/ExchangeModal";
import { useRouter } from "next/navigation";

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
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);

  // convert USD -> ARENA
  const [showExchange, setShowExchange] = useState(false);

  // withdraw form
  const [wAmount, setWAmount] = useState("");
  const [payoutTo, setPayoutTo] = useState("");
  const [wSubmitting, setWSubmitting] = useState(false);
  const [wNotice, setWNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!session || session.user === undefined) return; // still checking auth
    if (!session.user) {
      router.push("/login");
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function load() {
    try {
      const [r, w] = await Promise.all([
        fetch(`${API_URL}/v1/rewards/user`, { credentials: "include" }),
        fetch(`${API_URL}/v1/withdrawals/mine`, { credentials: "include" }),
      ]);
      if (r.ok) {
        const data: RewardsData = await r.json();
        setRewards(data);
      }
      if (w.ok) setWithdrawals((await w.json()).withdrawals || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const rate = rewards?.conversion;
  const wAmt = Number(wAmount) || 0;
  const wUsd = rate ? (wAmt * rate.arenaToUsd).toFixed(2) : "0";
  const balance = rewards?.totalTokens ?? 0;

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
              rewards?.onChain
                ? "bg-[rgba(95,184,132,0.15)] text-[#5fb884]"
                : "bg-[rgba(216,204,176,0.1)] text-[rgba(216,204,176,0.5)]"
            }`}
          >
            {rewards?.onChain ? "● On-chain · Sepolia" : "Off-chain estimate"}
          </span>
        </div>

        <div className="py-4 text-center">
          <div className="mb-1 text-6xl font-bold gold-text-shimmer tabular-nums">{rewards?.totalTokens ?? 0}</div>
          <p className="text-sm text-[rgba(216,204,176,0.6)]">ARENA tokens</p>
          {rate && (
            <p className="mt-2 text-sm text-[#d8ccb0]">
              ≈ <span className="font-semibold text-[#E8C040] tabular-nums">${rate.usd.toLocaleString()}</span> USD
            </p>
          )}
          {(rewards?.penalty || 0) > 0 && (
            <p className="mt-2 text-xs text-red-400">
              −{rewards?.penalty} ARENA from {rewards?.stats.resignations} resignation
              {(rewards?.stats.resignations || 0) > 1 ? "s" : ""}
            </p>
          )}
        </div>

        {/* wallet line */}
        <div className="mt-2 flex items-center justify-center gap-2 border-t border-[rgba(201,162,39,0.15)] pt-4 text-xs">
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
      </div>

      {/* Buy / convert USD -> ARENA */}
      <div className="glass-dark mb-6 rounded-2xl border border-[rgba(201,162,39,0.3)] p-6">
        <h2 className="font-display mb-1 flex items-center gap-2 text-xl font-bold text-[#E8C040]">
          <IconArrowUpRight size={20} /> Buy ARENA
        </h2>
        <p className="mb-4 text-sm text-[rgba(216,204,176,0.55)]">
          Convert your demo USD into ARENA to stake in wager matches. Your USDC is
          <span className="text-[#E8C040]"> deducted</span> and ARENA lands in your wallet instantly —{" "}
          <span className="text-[#E8C040]">{EXCHANGE_RATE} ARENA per $1</span>. All testnet play-money.
        </p>
        <button onClick={() => setShowExchange(true)} className="btn-gold w-full sm:w-auto">
          <IconCoins size={18} /> Convert USD → ARENA
        </button>
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

      {showExchange && (
        <ExchangeModal
          onClose={() => setShowExchange(false)}
          reason="Convert your demo USD into ARENA — your USDC is deducted and ARENA is added to your wallet."
          onBought={() => {
            setShowExchange(false);
            load();
          }}
        />
      )}
    </main>
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
