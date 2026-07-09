"use client";

import { API_URL } from "@/config";
import { IconCoins } from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";

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

// Wallet-free betting (Option 1): the player clicks and the platform stakes /
// settles on the escrow contract on their behalf. On-chain calls take a few
// seconds, so the buttons show a "staking…" state.
export default function WagerPanel({
  gameCode,
  myUserId,
  amPlayer,
}: {
  gameCode: string;
  myUserId?: number;
  amPlayer: boolean;
}) {
  const [wager, setWager] = useState<Wager | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [stake, setStake] = useState("");
  const [busy, setBusy] = useState(false);
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
    const t = setInterval(fetchWager, 4000); // reflect opponent joining / settlement
    return () => clearInterval(t);
  }, [fetchWager]);

  async function create() {
    setError(null);
    const s = Number(stake);
    if (!(s > 0)) return setError("Enter a stake greater than 0.");
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/v1/wager`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gameCode, stake: s }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) await fetchWager();
      else setError(data.error || "Could not start the wager.");
    } finally {
      setBusy(false);
    }
  }

  async function join() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/v1/wager/join`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gameCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) await fetchWager();
      else setError(data.error || "Could not join the wager.");
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return null;

  const stakeNum = wager ? Number(wager.stake) : 0;
  const iAmCreator = !!wager && wager.p1_user_id === myUserId;

  return (
    <div
      className="glass-dark rounded-2xl p-4"
      style={{ border: "1px solid rgba(201,162,39,0.2)" }}
    >
      <h3 className="font-display mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[#E8C040]">
        <IconCoins size={16} /> Wager
      </h3>

      {/* No wager yet */}
      {!wager && amPlayer && (
        <>
          <p className="mb-2 text-xs text-[rgba(216,204,176,0.55)]">
            Bet ARENA on this match — winner takes the pot. No wallet needed, the platform handles it.
          </p>
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              placeholder="stake"
              className="w-24 rounded-lg border border-[rgba(201,162,39,0.2)] bg-[rgba(0,0,0,0.3)] px-2.5 py-1.5 text-sm text-[#e8dcc0] outline-none focus:border-[rgba(201,162,39,0.6)]"
            />
            <button onClick={create} disabled={busy} className="btn-gold flex-1 text-sm">
              {busy ? "Staking…" : "Bet ARENA"}
            </button>
          </div>
        </>
      )}
      {!wager && !amPlayer && (
        <p className="text-xs text-[rgba(216,204,176,0.45)]">Only players can start a wager.</p>
      )}

      {/* Someone is mid-stake — the other player's button is disabled meanwhile */}
      {wager?.state === "staking" && (
        <div className="flex items-center gap-2 text-sm text-[rgba(216,204,176,0.7)]">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-[#E8C040] border-t-transparent" />
          {iAmCreator ? "Placing your bet on-chain…" : "Your opponent is placing a bet — hang tight…"}
        </div>
      )}

      {/* Wager open (waiting for opponent to accept) */}
      {wager?.state === "open" && (
        <div className="text-sm">
          <p className="mb-2 text-[#d8ccb0]">
            Stake: <span className="font-bold text-[#E8C040] tabular-nums">{stakeNum} ARENA</span>
            <span className="text-xs text-[rgba(216,204,176,0.4)]"> · winner takes {stakeNum * 2}</span>
          </p>
          {iAmCreator ? (
            <p className="text-xs text-[rgba(216,204,176,0.5)]">Waiting for your opponent to accept…</p>
          ) : amPlayer ? (
            <button onClick={join} disabled={busy} className="btn-gold w-full text-sm">
              {busy ? "Matching stake…" : `Accept & match ${stakeNum} ARENA`}
            </button>
          ) : (
            <p className="text-xs text-[rgba(216,204,176,0.45)]">A {stakeNum} ARENA wager is set.</p>
          )}
        </div>
      )}

      {/* Both staked */}
      {wager?.state === "funded" && (
        <div className="text-sm">
          <p className="text-[#d8ccb0]">
            💰 <span className="font-bold text-[#E8C040] tabular-nums">{stakeNum * 2} ARENA</span> pot
          </p>
          <p className="mt-1 text-xs text-[rgba(216,204,176,0.5)]">
            Both players staked {stakeNum}. The winner is paid automatically when the game ends.
          </p>
        </div>
      )}

      {/* Settled */}
      {wager?.state === "settled" && (
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
