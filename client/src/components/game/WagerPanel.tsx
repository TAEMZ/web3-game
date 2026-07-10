"use client";

import { API_URL } from "@/config";
import { IconCoins } from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import {
  parseEventLogs,
  prepareContractCall,
  prepareEvent,
  readContract,
  sendTransaction,
  waitForReceipt,
} from "thirdweb";

import { activeChain, thirdwebClient } from "@/lib/thirdweb";
import { ARENA_ESCROW_ADDRESS, escrowContract, toArenaWei, tokenContract } from "@/lib/contracts";

interface Wager {
  id: number;
  game_code: string;
  match_id: number | null;
  stake: string;
  p1_user_id: number | null;
  p2_user_id: number | null;
  state: "staking" | "open" | "funded" | "settled" | "cancelled";
  winner_wallet: string | null;
  settle_tx: string | null;
}

const matchCreatedEvent = prepareEvent({
  signature: "event MatchCreated(uint256 indexed id, address indexed player1, uint256 stake)",
});

// Non-custodial betting: the PLAYER signs the stake from their own thirdweb wallet
// (approve + createMatch / joinMatch), then we record it server-side. Gas is
// auto-funded by the platform on connect, so no ETH needed.
export default function WagerPanel({
  gameCode,
  myUserId,
  amPlayer,
}: {
  gameCode: string;
  myUserId?: number;
  amPlayer: boolean;
}) {
  const account = useActiveAccount();
  const [wager, setWager] = useState<Wager | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [stake, setStake] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fetchWager = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/v1/wager/${gameCode}`, { credentials: "include" });
      setWager(res.ok ? (await res.json()).wager : null);
    } catch {
      /* ignore */
    } finally {
      setLoaded(true);
    }
  }, [gameCode]);

  useEffect(() => {
    fetchWager();
    const t = setInterval(fetchWager, 4000);
    return () => clearInterval(t);
  }, [fetchWager]);

  async function ensureBalance(stakeWei: bigint): Promise<boolean> {
    const bal = (await readContract({
      contract: tokenContract,
      method: "function balanceOf(address) view returns (uint256)",
      params: [account!.address],
    })) as bigint;
    if (bal < stakeWei) {
      setError("Not enough ARENA — top up on the Rewards page first.");
      return false;
    }
    return true;
  }

  async function approveStake(stakeWei: bigint) {
    setStep("Approving stake…");
    const tx = prepareContractCall({
      contract: tokenContract,
      method: "function approve(address spender, uint256 amount) returns (bool)",
      params: [ARENA_ESCROW_ADDRESS, stakeWei],
    });
    const { transactionHash } = await sendTransaction({ transaction: tx, account: account! });
    await waitForReceipt({ client: thirdwebClient, chain: activeChain, transactionHash });
  }

  async function create() {
    setError(null);
    if (!account) return setError("Connect your wallet (top-right) to bet.");
    const s = Number(stake);
    if (!(s > 0)) return setError("Enter a stake greater than 0.");
    setBusy(true);
    let reserved = false;
    let activated = false;
    try {
      // 1. Reserve the wager BEFORE the on-chain stake, so the opponent instantly
      //    sees "opponent is placing a bet" and can't create a colliding wager.
      const rz = await fetch(`${API_URL}/v1/wager/reserve`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gameCode, stake: s }),
      });
      if (!rz.ok) {
        setError((await rz.json().catch(() => ({}))).error || "A wager already exists for this game.");
        await fetchWager();
        return;
      }
      reserved = true;
      await fetchWager();

      const stakeWei = toArenaWei(s);
      if (!(await ensureBalance(stakeWei))) return; // error set; finally rolls back
      await approveStake(stakeWei);
      setStep("Placing your bet…");
      const createTx = prepareContractCall({
        contract: escrowContract,
        method: "function createMatch(uint256 stake) returns (uint256)",
        params: [stakeWei],
      });
      const { transactionHash } = await sendTransaction({ transaction: createTx, account });
      const receipt = await waitForReceipt({ client: thirdwebClient, chain: activeChain, transactionHash });
      const events = parseEventLogs({ logs: receipt.logs, events: [matchCreatedEvent] });
      const matchId = Number(events[0]?.args?.id);
      setStep("Recording…");
      const res = await fetch(`${API_URL}/v1/wager`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gameCode, matchId, stake: s, wallet: account.address }),
      });
      if (res.ok) activated = true;
      else setError((await res.json().catch(() => ({}))).error || "Could not record bet.");
      await fetchWager();
    } catch (e) {
      setError((e as Error)?.message?.slice(0, 140) || "Transaction failed.");
    } finally {
      // Reserved but never confirmed (balance fail, rejected tx, error) → release
      // the reservation so the opponent isn't stuck seeing "staking".
      if (reserved && !activated) {
        await fetch(`${API_URL}/v1/wager/reserve/cancel`, {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ gameCode }),
        }).catch(() => {});
        await fetchWager();
      }
      setBusy(false);
      setStep("");
    }
  }

  async function join() {
    setError(null);
    if (!account) return setError("Connect your wallet (top-right) to bet.");
    if (!wager?.match_id) return;
    const s = Number(wager.stake);
    setBusy(true);
    try {
      const stakeWei = toArenaWei(s);
      if (!(await ensureBalance(stakeWei))) return;
      await approveStake(stakeWei);
      setStep("Matching the bet…");
      const joinTx = prepareContractCall({
        contract: escrowContract,
        method: "function joinMatch(uint256 id)",
        params: [BigInt(wager.match_id)],
      });
      const { transactionHash } = await sendTransaction({ transaction: joinTx, account });
      await waitForReceipt({ client: thirdwebClient, chain: activeChain, transactionHash });
      setStep("Recording…");
      const res = await fetch(`${API_URL}/v1/wager/join`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gameCode, wallet: account.address }),
      });
      if (!res.ok) setError((await res.json().catch(() => ({}))).error || "Could not record.");
      await fetchWager();
    } catch (e) {
      setError((e as Error)?.message?.slice(0, 140) || "Transaction failed.");
    } finally {
      setBusy(false);
      setStep("");
    }
  }

  if (!loaded) return null;

  const stakeNum = wager ? Number(wager.stake) : 0;
  const iAmCreator = !!wager && wager.p1_user_id === myUserId;

  return (
    <div className="glass-dark rounded-2xl p-4" style={{ border: "1px solid rgba(201,162,39,0.2)" }}>
      <h3 className="font-display mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[#E8C040]">
        <IconCoins size={16} /> Wager
      </h3>

      {busy && (
        <div className="flex items-center gap-2 text-sm text-[rgba(216,204,176,0.75)]">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[#E8C040] border-t-transparent" />
          {step || "Working…"} <span className="text-xs text-[rgba(216,204,176,0.4)]">(confirm in your wallet)</span>
        </div>
      )}

      {!busy && !wager && amPlayer && (
        <>
          <p className="mb-2 text-xs text-[rgba(216,204,176,0.55)]">
            Bet ARENA from your wallet — winner takes the pot. You&apos;ll approve + stake (gas is on us).
          </p>
          {!account ? (
            <p className="rounded-lg bg-[rgba(201,162,39,0.08)] px-3 py-2 text-xs text-[#E8C040]">
              Connect your wallet (top-right) to place a bet.
            </p>
          ) : (
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                value={stake}
                onChange={(e) => setStake(e.target.value)}
                placeholder="stake"
                className="w-24 rounded-lg border border-[rgba(201,162,39,0.2)] bg-[rgba(0,0,0,0.3)] px-2.5 py-1.5 text-sm text-[#e8dcc0] outline-none focus:border-[rgba(201,162,39,0.6)]"
              />
              <button onClick={create} className="btn-gold flex-1 text-sm">
                Bet ARENA
              </button>
            </div>
          )}
        </>
      )}

      {!busy && !wager && !amPlayer && (
        <p className="text-xs text-[rgba(216,204,176,0.45)]">Only players can start a wager.</p>
      )}

      {!busy && wager?.state === "staking" && (
        <p className="flex items-center gap-2 text-sm text-[#E8C040]">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[#E8C040] border-t-transparent" />
          {wager.p1_user_id === myUserId ? "Finishing your bet…" : "Your opponent is placing a bet…"}
        </p>
      )}

      {!busy && wager?.state === "open" && (
        <div className="text-sm">
          <p className="mb-2 text-[#d8ccb0]">
            Stake: <span className="font-bold text-[#E8C040] tabular-nums">{stakeNum} ARENA</span>
            <span className="text-xs text-[rgba(216,204,176,0.4)]"> · winner takes {stakeNum * 2}</span>
          </p>
          {iAmCreator ? (
            <p className="text-xs text-[rgba(216,204,176,0.5)]">Waiting for your opponent to accept…</p>
          ) : amPlayer ? (
            <button onClick={join} className="btn-gold w-full text-sm">
              Accept &amp; match {stakeNum} ARENA
            </button>
          ) : (
            <p className="text-xs text-[rgba(216,204,176,0.45)]">A {stakeNum} ARENA wager is set.</p>
          )}
        </div>
      )}

      {!busy && wager?.state === "funded" && (
        <div className="text-sm">
          <p className="text-[#d8ccb0]">
            💰 <span className="font-bold text-[#E8C040] tabular-nums">{stakeNum * 2} ARENA</span> pot
          </p>
          <p className="mt-1 text-xs text-[rgba(216,204,176,0.5)]">
            Both staked {stakeNum}. The winner is paid automatically when the game ends.
          </p>
        </div>
      )}

      {!busy && wager?.state === "settled" && (
        <div className="text-sm">
          <p className="text-[#5fb884]">✓ Wager settled — winner paid the pot.</p>
          {wager.settle_tx && (
            <a
              href={`https://sepolia.etherscan.io/tx/${wager.settle_tx}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-[rgba(216,204,176,0.5)] underline hover:text-[#E8C040]"
            >
              view on-chain
            </a>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-[#e06666]">{error}</p>}
    </div>
  );
}
