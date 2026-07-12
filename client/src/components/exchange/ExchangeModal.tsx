"use client";

import { IconX, IconCheck, IconCoins, IconArrowNarrowRight } from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { prepareContractCall, readContract, waitForReceipt } from "thirdweb";
import { sendFunded } from "@/lib/gas";

import { activeChain, thirdwebClient } from "@/lib/thirdweb";
import {
  ARENA_EXCHANGE_ADDRESS,
  EXCHANGE_RATE,
  exchangeContract,
  fromArenaWei,
  fromUsdcUnits,
  isExchangeReady,
  tokenContract,
  usdContract,
  usdcUnitsForArena,
} from "@/lib/contracts";

const PRESETS = [500, 1000, 5000];
const BAL = "function balanceOf(address) view returns (uint256)";

/**
 * Buy ARENA with demo-USD. Players hold both coins in their own thirdweb wallet;
 * this signs approve + buyArena on the ArenaExchange. When opened because a player
 * is short on ARENA, pass `neededArena` to prefill the shortfall + a reason line.
 */
export default function ExchangeModal({
  onClose,
  neededArena,
  reason,
  onBought,
}: {
  onClose: () => void;
  neededArena?: number;
  reason?: string;
  onBought?: (newArenaBalance: number) => void;
}) {
  const account = useActiveAccount();
  const [usd, setUsd] = useState<number | null>(null);
  const [arena, setArena] = useState<number | null>(null);
  const [amount, setAmount] = useState<string>(
    neededArena && neededArena > 0 ? String(Math.max(Math.ceil(neededArena), 1)) : "1000"
  );
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const refresh = useCallback(async () => {
    if (!account) return;
    try {
      const [u, a] = await Promise.all([
        readContract({ contract: usdContract, method: BAL, params: [account.address] }) as Promise<bigint>,
        readContract({ contract: tokenContract, method: BAL, params: [account.address] }) as Promise<bigint>,
      ]);
      setUsd(fromUsdcUnits(u));
      setArena(fromArenaWei(a));
    } catch {
      /* ignore read errors */
    }
  }, [account]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const buyArena = Math.max(0, Math.floor(Number(amount) || 0));
  const usdCost = buyArena / EXCHANGE_RATE; // whole USDC
  const notEnoughUsd = usd !== null && usdCost > usd + 1e-9;

  async function buy() {
    setError(null);
    if (!account) return setError("Connect your wallet (top-right) first.");
    if (!isExchangeReady) return setError("The exchange isn't live yet — try again shortly.");
    if (!(buyArena > 0)) return setError("Enter how much ARENA to buy.");
    const usdcUnits = usdcUnitsForArena(buyArena);
    if (usd !== null && fromUsdcUnits(usdcUnits) > usd + 1e-9) {
      return setError(
        `Not enough USDC — you have ${usd.toFixed(2)}, need ${fromUsdcUnits(usdcUnits).toFixed(2)}.`
      );
    }
    setBusy(true);
    try {
      setStep("Approving USDC…");
      const approveTx = prepareContractCall({
        contract: usdContract,
        method: "function approve(address spender, uint256 amount) returns (bool)",
        params: [ARENA_EXCHANGE_ADDRESS, usdcUnits],
      });
      let sent = await sendFunded({ transaction: approveTx, account });
      await waitForReceipt({ client: thirdwebClient, chain: activeChain, transactionHash: sent.transactionHash });

      setStep("Buying ARENA…");
      const buyTx = prepareContractCall({
        contract: exchangeContract,
        method: "function buyArena(uint256 usdcAmount)",
        params: [usdcUnits],
      });
      sent = await sendFunded({ transaction: buyTx, account });
      await waitForReceipt({ client: thirdwebClient, chain: activeChain, transactionHash: sent.transactionHash });

      await refresh();
      setDone(true);
      const a = (await readContract({ contract: tokenContract, method: BAL, params: [account.address] })) as bigint;
      onBought?.(fromArenaWei(a));
    } catch (e) {
      setError((e as Error)?.message?.slice(0, 140) || "Transaction failed.");
    } finally {
      setBusy(false);
      setStep("");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={busy ? undefined : onClose}
    >
      <div
        className="glass-dark animate-fade-in-up relative w-full max-w-md overflow-hidden rounded-3xl p-6"
        style={{ border: "1px solid rgb(var(--rgb-gold) / 0.28)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tricolor-bar absolute inset-x-0 top-0 rounded-none" />

        <button
          onClick={onClose}
          disabled={busy}
          className="absolute right-4 top-4 text-[rgb(var(--rgb-text)_/_0.5)] transition hover:text-[var(--c-gold-strong)] disabled:opacity-30"
          aria-label="Close"
        >
          <IconX size={20} />
        </button>

        <h2 className="font-display flex items-center gap-2 text-xl font-black text-[var(--c-gold-strong)]">
          <IconCoins size={22} /> Get ARENA
        </h2>
        <p className="mt-1 text-xs text-[rgb(var(--rgb-text)_/_0.55)]">
          Swap your demo USDC for ARENA — {EXCHANGE_RATE} ARENA per 1 USDC. It&apos;s all testnet play-money.
        </p>

        {reason && (
          <p className="mt-3 rounded-lg bg-[rgb(var(--rgb-gold)_/_0.1)] px-3 py-2 text-xs text-[var(--c-gold-strong)]">
            {reason}
          </p>
        )}

        {/* balances */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl px-4 py-3 text-center" style={{ background: "rgb(var(--rgb-surface) / 0.55)", border: "1px solid rgb(var(--rgb-gold) / 0.14)" }}>
            <p className="font-display text-lg font-bold text-[var(--c-green-text)] tabular-nums">
              {usd === null ? "—" : usd.toFixed(2)}
            </p>
            <p className="text-[0.65rem] uppercase tracking-wider text-[rgb(var(--rgb-text)_/_0.45)]">USDC balance</p>
          </div>
          <div className="rounded-xl px-4 py-3 text-center" style={{ background: "rgb(var(--rgb-surface) / 0.55)", border: "1px solid rgb(var(--rgb-gold) / 0.14)" }}>
            <p className="font-display text-lg font-bold text-[var(--c-gold-strong)] tabular-nums">
              {arena === null ? "—" : arena.toLocaleString()}
            </p>
            <p className="text-[0.65rem] uppercase tracking-wider text-[rgb(var(--rgb-text)_/_0.45)]">ARENA balance</p>
          </div>
        </div>

        {done ? (
          <div className="mt-5 flex flex-col items-center gap-2 rounded-xl bg-[rgb(var(--rgb-green-deep)_/_0.14)] px-4 py-5 text-center">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-[rgb(var(--rgb-green)_/_0.2)] text-[var(--c-green-text)]">
              <IconCheck size={24} />
            </span>
            <p className="font-display text-lg font-bold text-[var(--c-green-text)]">Bought {buyArena.toLocaleString()} ARENA</p>
            <p className="text-xs text-[rgb(var(--rgb-text)_/_0.55)]">
              New balance: <span className="font-bold text-[var(--c-gold-strong)]">{arena?.toLocaleString() ?? "—"} ARENA</span>
            </p>
            <button onClick={onClose} className="btn-gold mt-2 w-full text-sm">
              Done
            </button>
          </div>
        ) : !account ? (
          <p className="mt-5 rounded-lg bg-[rgb(var(--rgb-gold)_/_0.08)] px-3 py-3 text-center text-sm text-[var(--c-gold-strong)]">
            Connect your wallet (top-right) to buy ARENA.
          </p>
        ) : (
          <>
            <label className="field-label mt-5 block">ARENA to buy</label>
            <input
              type="number"
              min={1}
              value={amount}
              disabled={busy}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-xl border border-[rgb(var(--rgb-gold)_/_0.2)] bg-[var(--c-well-30)] px-3 py-2.5 text-lg font-bold text-[var(--c-text-bright)] tabular-nums outline-none focus:border-[rgb(var(--rgb-gold)_/_0.6)]"
            />
            <div className="mt-2 flex gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  disabled={busy}
                  onClick={() => setAmount(String(p))}
                  className="flex-1 rounded-lg border border-[rgb(var(--rgb-gold)_/_0.18)] bg-[rgb(var(--rgb-overlay)_/_0.03)] py-1 text-xs font-semibold text-[var(--c-text)] transition hover:border-[rgb(var(--rgb-gold)_/_0.5)] hover:bg-[rgb(var(--rgb-gold)_/_0.1)]"
                >
                  {p.toLocaleString()}
                </button>
              ))}
            </div>

            {/* quote */}
            <div className="mt-4 flex items-center justify-center gap-3 rounded-xl bg-[rgb(var(--rgb-surface)_/_0.5)] px-4 py-3 text-sm">
              <span className="font-bold text-[var(--c-green-text)] tabular-nums">{usdCost.toFixed(usdCost < 1 ? 4 : 2)} USDC</span>
              <IconArrowNarrowRight size={18} className="text-[rgb(var(--rgb-text)_/_0.4)]" />
              <span className="font-bold text-[var(--c-gold-strong)] tabular-nums">{buyArena.toLocaleString()} ARENA</span>
            </div>

            {busy && (
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-[rgb(var(--rgb-text)_/_0.75)]">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[var(--c-gold-strong)] border-t-transparent" />
                {step || "Working…"}{" "}
                <span className="text-xs text-[rgb(var(--rgb-text)_/_0.4)]">(confirm in your wallet)</span>
              </div>
            )}

            {!busy && (
              <button
                onClick={buy}
                disabled={!(buyArena > 0) || notEnoughUsd}
                className="btn-gold mt-4 w-full disabled:opacity-40"
              >
                {notEnoughUsd ? "Not enough USDC" : `Buy ${buyArena.toLocaleString()} ARENA`}
              </button>
            )}

            {error && <p className="mt-3 text-center text-xs text-[var(--c-red-text)]">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
