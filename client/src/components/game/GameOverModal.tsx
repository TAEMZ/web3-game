"use client";

import { useEffect, useState } from "react";
import type { Game } from "@arena/types";
import { API_URL } from "@/config";

type Outcome = "win" | "loss" | "draw" | "spectator";

interface GameOverModalProps {
  outcome: Outcome;
  reason: Game["endReason"];
  winnerName?: string;
  /** True when THIS player is the one who resigned (quit). */
  didResign: boolean;
  gameId: number;
  gameCode?: string;
  /** ARENA docked for quitting, from the server. */
  resignPenalty: number;
}

function reasonText(reason: Game["endReason"]): string {
  switch (reason) {
    case "checkmate":
      return "by checkmate";
    case "resignation":
      return "by resignation";
    case "stalemate":
      return "by stalemate";
    case "repetition":
      return "by threefold repetition";
    case "insufficient":
      return "by insufficient material";
    case "abandoned":
      return "by abandonment";
    default:
      return "";
  }
}

const WIN_REWARD = 50;
const DRAW_REWARD = 10;

export default function GameOverModal({
  outcome,
  reason,
  winnerName,
  didResign,
  gameId,
  gameCode,
  resignPenalty,
}: GameOverModalProps) {
  const [showConfetti, setShowConfetti] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [settling, setSettling] = useState(true);
  const [wagerStake, setWagerStake] = useState<number | null>(null);
  const [wagerResult, setWagerResult] = useState<"won" | "lost" | "draw" | null>(null);

  useEffect(() => {
    if (outcome === "win") {
      setShowConfetti(true);
      const t = setTimeout(() => setShowConfetti(false), 3500);
      return () => clearTimeout(t);
    }
  }, [outcome]);

  // Poll the real balance (+ wager result) — the on-chain settle lands a few
  // seconds after the game ends, so we refresh a handful of times.
  useEffect(() => {
    if (outcome === "spectator") return;
    let active = true;
    let tries = 0;
    async function refresh() {
      try {
        const r = await fetch(`${API_URL}/v1/rewards/user`, { credentials: "include" });
        let myWallet: string | null = null;
        if (r.ok) {
          const d = await r.json();
          if (active) {
            setBalance(d.totalTokens);
            myWallet = d.wallet;
          }
        }
        if (gameCode) {
          const wr = await fetch(`${API_URL}/v1/wager/${gameCode}`, { credentials: "include" });
          if (wr.ok) {
            const w = (await wr.json()).wager;
            if (active && w && (w.state === "funded" || w.state === "settled")) {
              setWagerStake(Number(w.stake));
              if (w.state === "settled") {
                if (!w.winner_wallet) setWagerResult("draw");
                else if (myWallet && w.winner_wallet.toLowerCase() === myWallet.toLowerCase())
                  setWagerResult("won");
                else setWagerResult("lost");
              }
            }
          }
        }
      } catch {
        /* ignore */
      }
    }
    refresh();
    const iv = setInterval(() => {
      tries += 1;
      refresh();
      if (tries >= 5 || !active) {
        clearInterval(iv);
        if (active) setSettling(false);
      }
    }, 6000);
    return () => {
      active = false;
      clearInterval(iv);
    };
  }, [outcome, gameCode]);

  const rt = reasonText(reason);

  let icon = "♟️";
  let title = "Game Over";
  let titleColor = "#E8C040";
  let subtitle = "";
  if (outcome === "win") {
    icon = "🏆";
    title = "Victory!";
    subtitle = reason === "resignation" ? "Your opponent resigned." : `You won ${rt}.`;
  } else if (outcome === "draw") {
    icon = "🤝";
    title = "Draw";
    subtitle = rt ? `The game ended in a draw ${rt}.` : "The game ended in a draw.";
  } else if (outcome === "loss") {
    if (didResign) {
      icon = "🏳️";
      title = "You Resigned";
      titleColor = "#e06666";
      subtitle = "You left the game — it counts as a loss.";
    } else {
      icon = "💔";
      title = "Defeat";
      titleColor = "#e06666";
      subtitle = winnerName ? `${winnerName} won ${rt}.` : `You lost ${rt}.`;
    }
  } else {
    subtitle = winnerName ? `${winnerName} won ${rt}.` : "The game ended in a draw.";
  }

  // Build the line-by-line ARENA changes for this game.
  const lines: { label: string; value: number }[] = [];
  if (outcome === "win") {
    if (wagerResult === "won" && wagerStake) lines.push({ label: "Wager winnings", value: wagerStake });
    lines.push({ label: "Win reward", value: WIN_REWARD });
  } else if (outcome === "draw") {
    if (wagerStake) lines.push({ label: "Wager refunded", value: 0 });
    lines.push({ label: "Draw reward", value: DRAW_REWARD });
  } else if (outcome === "loss") {
    if (wagerResult === "lost" && wagerStake) lines.push({ label: "Wager lost", value: -wagerStake });
    if (didResign) lines.push({ label: "Resignation penalty", value: -resignPenalty });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {[...Array(45)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-fall"
              style={{
                left: `${(i * 2.2) % 100}%`,
                top: "-10px",
                animationDelay: `${(i % 10) * 0.2}s`,
                fontSize: `${12 + (i % 5) * 4}px`,
              }}
            >
              {["🎉", "✨", "🏆", "⭐", "💫"][i % 5]}
            </div>
          ))}
        </div>
      )}

      <div
        className="glass-dark animate-fade-in-up w-full max-w-md p-6 md:p-8 relative overflow-hidden max-h-[95vh] overflow-y-auto"
        style={{ border: "1px solid rgba(201,162,39,0.3)", borderRadius: 24 }}
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-600 via-yellow-500 to-red-600" />

        <div className="text-center mb-6">
          <div className="text-7xl mb-4">{icon}</div>
          <h2 className="font-display text-3xl font-bold mb-2" style={{ color: titleColor }}>
            {title}
          </h2>
          <p className="text-base text-[rgba(216,204,176,0.8)]">{subtitle}</p>
        </div>

        {/* ARENA breakdown + new balance */}
        {outcome !== "spectator" && (
          <div className="mb-6 rounded-xl bg-[rgba(201,162,39,0.06)] border border-[rgba(201,162,39,0.2)] p-4">
            <div className="space-y-1.5">
              {lines.map((l) => (
                <div key={l.label} className="flex items-center justify-between text-sm">
                  <span className="text-[rgba(216,204,176,0.7)]">{l.label}</span>
                  <span
                    className={`font-semibold tabular-nums ${
                      l.value > 0 ? "text-[#5fb884]" : l.value < 0 ? "text-[#e06666]" : "text-[rgba(216,204,176,0.6)]"
                    }`}
                  >
                    {l.value > 0 ? "+" : ""}
                    {l.value} ARENA
                  </span>
                </div>
              ))}
              {lines.length === 0 && (
                <p className="text-center text-sm text-[rgba(216,204,176,0.6)]">No token change this game.</p>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-[rgba(201,162,39,0.15)] pt-3">
              <span className="text-sm font-semibold text-[#E8C040]">New balance</span>
              <span className="text-lg font-bold text-[#E8C040] tabular-nums">
                {balance === null ? "…" : `${balance} ARENA`}
              </span>
            </div>
            {settling && (
              <p className="mt-1 text-right text-[0.65rem] text-[rgba(216,204,176,0.4)]">settling on-chain…</p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <a
            href="/"
            className="w-full py-3 rounded-lg bg-[#E8C040] text-[#1a0f0a] font-semibold text-center hover:bg-[#d4af3a] transition-colors"
          >
            Back to Lobby
          </a>
          {gameId ? (
            <a
              href={`/archive/${gameId}`}
              className="w-full py-3 rounded-lg bg-[rgba(201,162,39,0.15)] hover:bg-[rgba(201,162,39,0.25)] text-[#E8C040] font-semibold text-center transition-colors"
            >
              Review Game
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
