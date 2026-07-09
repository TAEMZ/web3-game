"use client";

import { IconCoins, IconMedal, IconMedal2, IconStar, IconTrophy, IconArrowUpRight, IconArrowDownLeft, IconWallet } from "@tabler/icons-react";
import { useContext, useEffect, useState } from "react";
import { SessionContext } from "@/context/session";
import { API_URL } from "@/config";
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
  const [rewards, setRewards] = useState<RewardsData | null>(null);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);

  // top-up form
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [wallet, setWallet] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

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
  const previewUsd = rate ? (amt * rate.arenaToUsd).toFixed(2) : "0";

  const wAmt = Number(wAmount) || 0;
  const wUsd = rate ? (wAmt * rate.arenaToUsd).toFixed(2) : "0";
  const balance = rewards?.totalTokens ?? 0;

  async function submitTopUp(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    if (!(amt > 0)) return setNotice("Enter an amount greater than 0.");
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/v1/deposits`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount: amt, method: "demo", reference, wallet: wallet || undefined }),
      });
      if (res.ok) {
        setNotice("Request submitted! An admin will verify your payment and release your ARENA.");
        setAmount("");
        setReference("");
        await load();
      } else {
        const err = await res.json().catch(() => ({}));
        setNotice(err.error || "Could not submit request.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function submitWithdraw(e: React.FormEvent) {
    e.preventDefault();
    setWNotice(null);
    if (!(wAmt > 0)) return setWNotice("Enter an amount greater than 0.");
    if (wAmt > balance) return setWNotice(`You only have ${balance} ARENA.`);
    setWSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/v1/withdrawals`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount: wAmt, payoutTo }),
      });
      if (res.ok) {
        setWNotice("Cash-out requested! An admin will review it and mark it paid.");
        setWAmount("");
        setPayoutTo("");
        await load();
      } else {
        const err = await res.json().catch(() => ({}));
        setWNotice(err.error || "Could not submit request.");
      }
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
        <p className="text-[rgba(216,204,176,0.6)]">Your ARENA balance, top-ups, and achievements</p>
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
              No wallet linked — add one below to receive real tokens
            </span>
          )}
        </div>
      </div>

      {/* Top-up */}
      <div className="glass-dark mb-6 rounded-2xl border border-[rgba(201,162,39,0.3)] p-6">
        <h2 className="font-display mb-1 flex items-center gap-2 text-xl font-bold text-[#E8C040]">
          <IconArrowUpRight size={20} /> Top up ARENA
        </h2>
        <p className="mb-4 text-sm text-[rgba(216,204,176,0.55)]">
          Request ARENA to play wager matches. <span className="text-[#E8C040]">Demo only — no real payment.</span> An admin reviews your request and releases the tokens.
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
            {amt > 0 && rate && (
              <p className="mb-3 text-xs text-[rgba(216,204,176,0.6)]">
                {amt} ARENA ≈ <span className="font-semibold text-[#E8C040]">${previewUsd}</span> of play credit
              </p>
            )}
            {notice && <p className="mb-3 text-xs text-[#5fb884]">{notice}</p>}
            <button type="submit" disabled={submitting} className="btn-gold w-full sm:w-auto">
              {submitting ? "Submitting…" : "Request top-up"}
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
          Convert your ARENA back to cash. <span className="text-[#E8C040]">Demo only</span> — an admin reviews and marks it paid.
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
            {/* live conversion preview — the "how much you'll get" the player wants to see */}
            <div className="mb-3 rounded-lg border border-[rgba(201,162,39,0.15)] bg-[rgba(0,0,0,0.2)] px-4 py-3 text-center">
              <span className="text-sm text-[rgba(216,204,176,0.6)]">You&apos;ll receive </span>
              <span className="text-lg font-bold text-[#E8C040] tabular-nums">
                ${Number(wUsd).toLocaleString()}
              </span>
              {wAmt > 0 && (
                <span className="text-xs text-[rgba(216,204,176,0.4)]"> for {wAmt} ARENA</span>
              )}
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
            { Icon: IconMedal, name: "First Victory", desc: "Win your first game", need: 1, color: "#cd8b52" },
            { Icon: IconMedal2, name: "Silver Champion", desc: "Win 10 games", need: 10, color: "#c8c8d0" },
            { Icon: IconTrophy, name: "Gold Champion", desc: "Win 100 games", need: 100, color: "#E8C040" },
            { Icon: IconStar, name: "Perfect Week", desc: "Win 7 in a row", need: null as number | null, color: "#a78bfa", soon: true },
          ].map((a) => {
            const wins = rewards?.stats.wins || 0;
            const earned = a.need != null && wins >= a.need;
            const pct = a.need ? Math.min((wins / a.need) * 100, 100) : 0;
            return (
              <li
                key={a.name}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                style={{
                  background: earned ? "rgba(201,162,39,0.08)" : "rgba(13,22,18,0.5)",
                  border: `1px solid ${earned ? "rgba(201,162,39,0.3)" : "rgba(201,162,39,0.1)"}`,
                  opacity: a.soon ? 0.55 : 1,
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
                        Earned
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-[rgba(216,204,176,0.45)]">{a.desc}</p>
                </div>
                <div className="w-16 shrink-0 text-right">
                  {a.soon ? (
                    <span className="text-[0.65rem] uppercase tracking-wide text-[rgba(216,204,176,0.35)]">Soon</span>
                  ) : earned ? (
                    <span className="text-lg text-[#5fb884]">✓</span>
                  ) : (
                    <>
                      <span className="text-xs tabular-nums text-[rgba(216,204,176,0.5)]">
                        {wins}/{a.need}
                      </span>
                      <div className="mt-1 h-1 w-full rounded-full bg-[rgba(0,0,0,0.3)]">
                        <div className="h-1 rounded-full bg-[#E8C040]" style={{ width: `${pct}%` }} />
                      </div>
                    </>
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
