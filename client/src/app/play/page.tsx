"use client";

import {
  IconChess,
  IconBolt,
  IconTrophy,
  IconLock,
  IconCheck,
  IconCoins,
  IconClockHour4,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useCallback, useContext, useEffect, useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { prepareContractCall, readContract, sendTransaction, waitForReceipt } from "thirdweb";

import { SessionContext } from "@/context/session";
import { API_URL } from "@/config";
import { createGame } from "@/lib/game";
import { activeChain, thirdwebClient } from "@/lib/thirdweb";
import { fromUsdcUnits, toUsdcUnits, usdContract } from "@/lib/contracts";

const BAL = "function balanceOf(address) view returns (uint256)";

export default function PlayPlans() {
  const session = useContext(SessionContext);
  const router = useRouter();
  const account = useActiveAccount();
  const user = session?.user;

  const [priceUsd, setPriceUsd] = useState(5);
  const [treasury, setTreasury] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [pending, setPending] = useState(false);

  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showStake, setShowStake] = useState(false);
  const [stakeInput, setStakeInput] = useState("");

  useEffect(() => {
    fetch(`${API_URL}/v1/config`)
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => {
        if (!c) return;
        if (c.subscriptionUsd) setPriceUsd(Number(c.subscriptionUsd));
        if (c.treasuryAddress) setTreasury(c.treasuryAddress);
      })
      .catch(() => {});
  }, []);

  // This is the landing choice page — send admins to the console, and visitors
  // with no session to login. Guests (string id) stay and can pick Casual.
  useEffect(() => {
    const u = session?.user;
    if (u === undefined || (u && Object.keys(u).length === 0)) return; // still loading
    if (u?.is_admin) router.replace("/admin");
    else if (!u?.id) router.replace("/login");
  }, [session?.user, router]);

  const loadSub = useCallback(async () => {
    if (!user?.id || typeof user.id !== "number") return;
    try {
      const r = await fetch(`${API_URL}/v1/subscription`, { credentials: "include" });
      if (r.ok) {
        const d = await r.json();
        setSubscribed(!!d.subscribed);
        setPending(!!d.pending);
        if (d.priceUsd) setPriceUsd(Number(d.priceUsd));
      }
    } catch {
      /* ignore */
    }
  }, [user?.id]);

  useEffect(() => {
    loadSub();
  }, [loadSub]);

  function playCasual() {
    router.push("/casual");
  }

  async function createWager(stake: number) {
    setError(null);
    setShowStake(false);
    setCreating(true);
    const game = await createGame("random", false, { mode: "wager", stake });
    if (game) router.push(`/${game.code}`);
    else {
      setError("Couldn't create the match — try again.");
      setCreating(false);
    }
  }

  async function buyPass() {
    setError(null);
    if (!user?.id || typeof user.id !== "number") {
      router.push("/login");
      return;
    }
    if (!account) {
      setError("Connect your wallet (top-right) to buy the pass.");
      return;
    }
    if (!treasury) {
      setError("Payments aren't configured yet — try again shortly.");
      return;
    }
    setBusy(true);
    try {
      setStep("Checking your USD…");
      const raw = (await readContract({ contract: usdContract, method: BAL, params: [account.address] })) as bigint;
      const usd = fromUsdcUnits(raw);
      if (usd < priceUsd) {
        setError(`Not enough USD — you have $${usd.toFixed(2)}, need $${priceUsd}.`);
        return;
      }
      setStep(`Paying $${priceUsd} in USDC…`);
      const tx = prepareContractCall({
        contract: usdContract,
        method: "function transfer(address to, uint256 amount) returns (bool)",
        params: [treasury, toUsdcUnits(priceUsd)],
      });
      const sent = await sendTransaction({ transaction: tx, account });
      await waitForReceipt({ client: thirdwebClient, chain: activeChain, transactionHash: sent.transactionHash });

      setStep("Submitting for verification…");
      const res = await fetch(`${API_URL}/v1/subscription`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tx: sent.transactionHash, wallet: account.address }),
      });
      if (res.ok) setPending(true);
      else setError((await res.json().catch(() => ({}))).error || "Could not submit your request.");
    } catch (e) {
      setError((e as Error)?.message?.slice(0, 140) || "Transaction failed.");
    } finally {
      setBusy(false);
      setStep("");
    }
  }

  return (
    <div className="animate-fade-in-up mx-auto w-full max-w-4xl px-4 py-10">
      <div className="mb-8 text-center">
        <h1 className="font-display text-3xl font-black text-[var(--c-text)] md:text-4xl">Choose how to play</h1>
        <p className="mt-2 text-sm text-[rgb(var(--rgb-text)_/_0.5)]">
          Play casually for fun and rewards, or unlock wager matches and stake ARENA head-to-head.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* ── Casual ── */}
        <div className="glass-dark flex flex-col rounded-3xl p-6" style={{ border: "1px solid rgb(var(--rgb-gold) / 0.18)" }}>
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[rgba(75,115,153,0.18)] text-[#7fa8d0]">
              <IconChess size={26} />
            </span>
            <div>
              <h2 className="font-display text-xl font-black text-[var(--c-text)]">Casual</h2>
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--c-green-text)]">Free to play</span>
            </div>
          </div>
          <ul className="mt-5 flex flex-1 flex-col gap-2.5 text-sm text-[rgb(var(--rgb-text)_/_0.75)]">
            {["Play the computer or a friend", "Earn ARENA rewards for wins", "No stakes, no wallet needed"].map((f) => (
              <li key={f} className="flex items-center gap-2">
                <IconCheck size={16} className="shrink-0 text-[var(--c-green-text)]" /> {f}
              </li>
            ))}
          </ul>
          <button onClick={playCasual} className="btn-dark mt-6 w-full">
            <IconBolt size={18} /> Play Casual
          </button>
        </div>

        {/* ── Wager ── */}
        <div
          className="glass-dark relative flex flex-col overflow-hidden rounded-3xl p-6"
          style={{ border: "1px solid rgb(var(--rgb-gold) / 0.45)", boxShadow: "0 8px 30px rgb(var(--rgb-gold) / 0.12)" }}
        >
          <div className="tricolor-bar absolute inset-x-0 top-0 rounded-none" />
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[rgb(var(--rgb-gold)_/_0.16)] text-[var(--c-gold-strong)]">
              <IconTrophy size={26} />
            </span>
            <div>
              <h2 className="font-display text-xl font-black text-[var(--c-gold-strong)]">Wager Arena</h2>
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--c-gold-strong)]">
                Arena Pass · ${priceUsd}
              </span>
            </div>
          </div>
          <ul className="mt-5 flex flex-1 flex-col gap-2.5 text-sm text-[rgb(var(--rgb-text)_/_0.8)]">
            {["Stake ARENA — winner takes the pot", "Settled on-chain, automatically", "One-time unlock, no expiry"].map((f) => (
              <li key={f} className="flex items-center gap-2">
                <IconCheck size={16} className="shrink-0 text-[var(--c-gold-strong)]" /> {f}
              </li>
            ))}
          </ul>

          {busy && (
            <div className="mt-6 flex items-center justify-center gap-2 text-sm text-[rgb(var(--rgb-text)_/_0.75)]">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[var(--c-gold-strong)] border-t-transparent" />
              {step || "Working…"} <span className="text-xs text-[rgb(var(--rgb-text)_/_0.4)]">(confirm in wallet)</span>
            </div>
          )}

          {!busy && subscribed && (
            <>
              <div className="mt-6 flex items-center justify-center gap-1.5 rounded-lg bg-[rgb(var(--rgb-green-deep)_/_0.14)] py-1.5 text-xs font-semibold text-[var(--c-green-text)]">
                <IconCheck size={14} /> Arena Pass active
              </div>
              <button
                onClick={() => {
                  setStakeInput("");
                  setError(null);
                  setShowStake(true);
                }}
                disabled={creating}
                className="btn-gold mt-3 w-full"
              >
                {creating ? "Creating…" : "Create Wager Match"}
              </button>
            </>
          )}

          {!busy && !subscribed && pending && (
            <div className="mt-6 rounded-xl bg-[rgb(var(--rgb-gold)_/_0.1)] px-4 py-4 text-center">
              <IconClockHour4 size={22} className="mx-auto text-[var(--c-gold-strong)]" />
              <p className="mt-1.5 text-sm font-semibold text-[var(--c-gold-strong)]">Payment received — pending verification</p>
              <p className="mt-1 text-xs text-[rgb(var(--rgb-text)_/_0.55)]">
                An admin will verify your ${priceUsd} payment and unlock wager mode shortly.
              </p>
            </div>
          )}

          {!busy && !subscribed && !pending && (
            <button onClick={buyPass} className="btn-gold mt-6 w-full">
              <IconLock size={16} /> Buy Arena Pass — ${priceUsd} with USD
            </button>
          )}

          {error && <p className="mt-3 text-center text-xs text-[var(--c-red-text)]">{error}</p>}
        </div>
      </div>

      <div className="mt-6 flex flex-col items-center gap-2">
        <button
          onClick={() => router.push("/rewards")}
          className="flex items-center gap-1.5 text-xs font-semibold text-[rgb(var(--rgb-text)_/_0.6)] transition hover:text-[var(--c-gold-strong)]"
        >
          <IconCoins size={14} /> Need ARENA to stake? Request a top-up →
        </button>
        <p className="text-center text-[0.7rem] text-[rgb(var(--rgb-text)_/_0.35)]">
          All balances are testnet play-money — no real funds involved.
        </p>
      </div>

      {/* Set-the-stake modal — the stake is chosen up-front so the match lists with
          its pool and the opponent knows what they're matching before joining. */}
      {showStake && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={creating ? undefined : () => setShowStake(false)}
        >
          <div
            className="glass-dark animate-fade-in-up w-full max-w-sm rounded-3xl p-6"
            style={{ border: "1px solid rgb(var(--rgb-gold) / 0.35)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display flex items-center gap-2 text-lg font-black text-[var(--c-gold-strong)]">
              <IconCoins size={20} /> Set your stake
            </h2>
            <p className="mt-1 text-xs text-[rgb(var(--rgb-text)_/_0.55)]">
              How much ARENA to wager. Your opponent matches it — winner takes the pot minus the platform fee.
            </p>
            <label className="field-label mt-4 block">Stake (ARENA)</label>
            <input
              type="number"
              min={1}
              autoFocus
              value={stakeInput}
              onChange={(e) => setStakeInput(e.target.value)}
              placeholder="e.g. 500"
              className="w-full rounded-xl border border-[rgb(var(--rgb-gold)_/_0.2)] bg-[var(--c-well-30)] px-3 py-2.5 text-lg font-bold text-[var(--c-text-bright)] tabular-nums outline-none focus:border-[rgb(var(--rgb-gold)_/_0.6)]"
            />
            {Number(stakeInput) > 0 && (
              <p className="mt-2 text-xs text-[rgb(var(--rgb-text)_/_0.6)]">
                Pot if matched: <span className="font-bold text-[var(--c-gold-strong)] tabular-nums">{Math.floor(Number(stakeInput)) * 2} ARENA</span>
              </p>
            )}
            <div className="mt-5 flex gap-2">
              <button onClick={() => setShowStake(false)} disabled={creating} className="btn-dark flex-1 text-sm">
                Cancel
              </button>
              <button
                onClick={() => createWager(Math.floor(Number(stakeInput)))}
                disabled={!(Number(stakeInput) > 0) || creating}
                className="btn-gold flex-1 text-sm disabled:opacity-40"
              >
                {creating ? "Creating…" : "Create match"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
