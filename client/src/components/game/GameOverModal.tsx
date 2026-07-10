"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { Game } from "@arena/types";
import { API_URL, HOUSE_FEE_PERCENT } from "@/config";

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

// Gold crown haloed by a gold glow + slow green swirl.
function VictoryHero() {
  return (
    <div className="relative grid h-28 w-28 place-items-center">
      <div className="absolute inset-0 rounded-full" style={{ background: "radial-gradient(circle, rgba(201,162,39,0.4) 0%, transparent 65%)" }} />
      <div
        className="absolute inset-[-10%] rounded-full animate-spin"
        style={{ animationDuration: "9s", background: "conic-gradient(from 0deg, transparent, rgba(26,107,63,0.4), transparent 55%, rgba(201,162,39,0.25), transparent 90%)" }}
      />
      <span className="relative font-display text-7xl" style={{ color: "#f5d970", filter: "drop-shadow(0 0 16px rgba(201,162,39,0.85))" }}>
        ♔
      </span>
    </div>
  );
}

// Toppled king on the ground with a red glow — the classic sign of defeat.
function FallenKingHero({ resigned }: { resigned?: boolean }) {
  return (
    <div className="relative grid h-28 w-28 place-items-center">
      <div className="absolute inset-0 rounded-full" style={{ background: "radial-gradient(circle, rgba(184,24,24,0.32) 0%, transparent 65%)" }} />
      <span
        className="relative inline-block text-7xl"
        style={{
          transform: resigned ? "none" : "rotate(82deg)",
          color: resigned ? "#d8ccb0" : "#7a2b2b",
          filter: "drop-shadow(0 9px 6px rgba(0,0,0,0.6)) drop-shadow(0 0 12px rgba(184,24,24,0.55))",
        }}
      >
        {resigned ? "🏳️" : "♚"}
      </span>
    </div>
  );
}

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
  const [wagerFee, setWagerFee] = useState<number>(0);
  const [wagerResult, setWagerResult] = useState<"won" | "lost" | "draw" | null>(null);

  useEffect(() => {
    if (outcome === "win") {
      setShowConfetti(true);
      const t = setTimeout(() => setShowConfetti(false), 3500);
      return () => clearTimeout(t);
    }
  }, [outcome]);

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
              setWagerFee(Number(w.fee_amount || 0));
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
  const isCheckmate = reason === "checkmate";

  // ── Per-outcome theme ──
  let title = "Game Over";
  let titleColor = "#E8C040";
  let glow = "rgba(201,162,39,0.5)";
  let panelBg = "rgba(13,22,18,0.94)";
  let border = "rgba(201,162,39,0.3)";
  let hero: ReactNode = <span className="text-7xl opacity-70">♟️</span>;
  let subtitle = "";

  if (outcome === "win") {
    title = "Victory!";
    titleColor = "#f5d970";
    glow = "rgba(201,162,39,0.6)";
    panelBg = "linear-gradient(180deg, rgba(15,50,34,0.96) 0%, rgba(13,22,18,0.96) 60%)";
    border = "rgba(201,162,39,0.42)";
    hero = <VictoryHero />;
    subtitle = reason === "resignation" ? "Your opponent resigned." : `You won ${rt}.`;
  } else if (outcome === "draw") {
    title = "Draw";
    hero = <span className="text-7xl">🤝</span>;
    subtitle = rt ? `The game ended in a draw ${rt}.` : "The game ended in a draw.";
  } else if (outcome === "loss") {
    titleColor = "#e06666";
    glow = "rgba(184,24,24,0.45)";
    panelBg = "linear-gradient(180deg, rgba(42,16,16,0.96) 0%, rgba(13,22,18,0.96) 62%)";
    border = "rgba(184,24,24,0.42)";
    if (didResign) {
      title = "You Resigned";
      hero = <FallenKingHero resigned />;
      subtitle = "You left the game — it counts as a loss.";
    } else {
      title = isCheckmate ? "Checkmate" : "Defeat";
      hero = <FallenKingHero />;
      subtitle = winnerName ? `${winnerName} won ${rt}.` : `You lost ${rt}.`;
    }
  } else {
    subtitle = winnerName ? `${winnerName} won ${rt}.` : "The game ended in a draw.";
  }

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4 backdrop-blur-sm">
      {showConfetti && (
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          {[...Array(45)].map((_, i) => (
            <div
              key={i}
              className="animate-fall absolute"
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
        className="ge-pattern animate-fade-in-up relative max-h-[95vh] w-full max-w-md overflow-y-auto p-6 md:p-8"
        style={{ background: panelBg, border: `1px solid ${border}`, borderRadius: 24 }}
      >
        <div className="tricolor-bar absolute inset-x-0 top-0 rounded-none" />

        <div className="mb-6 text-center">
          <div className="mb-3 flex justify-center">{hero}</div>
          <h2 className="font-display mb-2 text-4xl font-black" style={{ color: titleColor, textShadow: `0 0 26px ${glow}` }}>
            {title}
          </h2>
          <p className="text-base text-[rgba(216,204,176,0.8)]">{subtitle}</p>
        </div>

        {outcome !== "spectator" && (
          <div className="mb-6 rounded-xl border p-4" style={{ background: "rgba(0,0,0,0.28)", borderColor: border }}>
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
              <span className="text-lg font-bold tabular-nums text-[#E8C040]">
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
            href="/casual"
            className="w-full rounded-lg py-3 text-center font-semibold text-[#1a0f0a] transition-transform hover:-translate-y-0.5"
            style={{ background: "linear-gradient(135deg,#e8c040,#c9a227 55%,#9a7a18)", boxShadow: "0 4px 18px rgba(201,162,39,0.35)" }}
          >
            Play Again
          </a>
          <a
            href="/"
            className="w-full rounded-lg border border-[rgba(201,162,39,0.35)] bg-[rgba(201,162,39,0.08)] py-3 text-center font-semibold text-[#E8C040] transition-colors hover:bg-[rgba(201,162,39,0.18)]"
          >
            Back to Lobby
          </a>
          {gameId ? (
            <a
              href={`/archive/${gameId}`}
              className="w-full rounded-lg py-2.5 text-center text-sm font-semibold text-[rgba(216,204,176,0.6)] transition-colors hover:text-[#E8C040]"
            >
              Review Game
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
