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
import ExchangeModal from "@/components/exchange/ExchangeModal";

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
  const [showExchange, setShowExchange] = useState(false);

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
    router.push("/");
  }

  async function createWager() {
    setError(null);
    setCreating(true);
    const game = await createGame("random", false, { mode: "wager" });
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
        <h1 className="font-display text-3xl font-black text-[#d8ccb0] md:text-4xl">Choose how to play</h1>
        <p className="mt-2 text-sm text-[rgba(216,204,176,0.5)]">
          Play casually for fun and rewards, or unlock wager matches and stake ARENA head-to-head.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* ── Casual ── */}
        <div className="glass-dark flex flex-col rounded-3xl p-6" style={{ border: "1px solid rgba(201,162,39,0.18)" }}>
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[rgba(75,115,153,0.18)] text-[#7fa8d0]">
              <IconChess size={26} />
            </span>
            <div>
              <h2 className="font-display text-xl font-black text-[#d8ccb0]">Casual</h2>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#5fb884]">Free to play</span>
            </div>
          </div>
          <ul className="mt-5 flex flex-1 flex-col gap-2.5 text-sm text-[rgba(216,204,176,0.75)]">
            {["Play the computer or a friend", "Earn ARENA rewards for wins", "No stakes, no wallet needed"].map((f) => (
              <li key={f} className="flex items-center gap-2">
                <IconCheck size={16} className="shrink-0 text-[#5fb884]" /> {f}
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
          style={{ border: "1px solid rgba(201,162,39,0.45)", boxShadow: "0 8px 30px rgba(201,162,39,0.12)" }}
        >
          <div className="tricolor-bar absolute inset-x-0 top-0 rounded-none" />
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[rgba(201,162,39,0.16)] text-[#E8C040]">
              <IconTrophy size={26} />
            </span>
            <div>
              <h2 className="font-display text-xl font-black text-[#E8C040]">Wager Arena</h2>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#E8C040]">
                Arena Pass · ${priceUsd}
              </span>
            </div>
          </div>
          <ul className="mt-5 flex flex-1 flex-col gap-2.5 text-sm text-[rgba(216,204,176,0.8)]">
            {["Stake ARENA — winner takes the pot", "Settled on-chain, automatically", "One-time unlock, no expiry"].map((f) => (
              <li key={f} className="flex items-center gap-2">
                <IconCheck size={16} className="shrink-0 text-[#E8C040]" /> {f}
              </li>
            ))}
          </ul>

          {busy && (
            <div className="mt-6 flex items-center justify-center gap-2 text-sm text-[rgba(216,204,176,0.75)]">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[#E8C040] border-t-transparent" />
              {step || "Working…"} <span className="text-xs text-[rgba(216,204,176,0.4)]">(confirm in wallet)</span>
            </div>
          )}

          {!busy && subscribed && (
            <>
              <div className="mt-6 flex items-center justify-center gap-1.5 rounded-lg bg-[rgba(26,107,63,0.14)] py-1.5 text-xs font-semibold text-[#5fb884]">
                <IconCheck size={14} /> Arena Pass active
              </div>
              <button onClick={createWager} disabled={creating} className="btn-gold mt-3 w-full">
                {creating ? "Creating…" : "Create Wager Match"}
              </button>
            </>
          )}

          {!busy && !subscribed && pending && (
            <div className="mt-6 rounded-xl bg-[rgba(201,162,39,0.1)] px-4 py-4 text-center">
              <IconClockHour4 size={22} className="mx-auto text-[#E8C040]" />
              <p className="mt-1.5 text-sm font-semibold text-[#E8C040]">Payment received — pending verification</p>
              <p className="mt-1 text-xs text-[rgba(216,204,176,0.55)]">
                An admin will verify your ${priceUsd} payment and unlock wager mode shortly.
              </p>
            </div>
          )}

          {!busy && !subscribed && !pending && (
            <button onClick={buyPass} className="btn-gold mt-6 w-full">
              <IconLock size={16} /> Buy Arena Pass — ${priceUsd} with USD
            </button>
          )}

          {error && <p className="mt-3 text-center text-xs text-[#e06666]">{error}</p>}
        </div>
      </div>

      <div className="mt-6 flex flex-col items-center gap-2">
        <button
          onClick={() => setShowExchange(true)}
          className="flex items-center gap-1.5 text-xs font-semibold text-[rgba(216,204,176,0.6)] transition hover:text-[#E8C040]"
        >
          <IconCoins size={14} /> Need ARENA to stake? Buy some with USD →
        </button>
        <p className="text-center text-[0.7rem] text-[rgba(216,204,176,0.35)]">
          All balances are testnet play-money — no real funds involved.
        </p>
      </div>

      {showExchange && (
        <ExchangeModal
          onClose={() => setShowExchange(false)}
          reason="Buy ARENA with your demo USD to stake in wager matches."
          onBought={() => setShowExchange(false)}
        />
      )}
    </div>
  );
}
