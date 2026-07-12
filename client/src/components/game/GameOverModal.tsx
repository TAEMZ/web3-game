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
    case "timeout":
      return "on time";
    default:
      return "";
  }
}

const WIN_REWARD = 5;
const DRAW_REWARD = 2;

// Gold crown haloed by a gold glow + slow green swirl.
function VictoryHero() {
  return (
    <div className="relative grid h-28 w-28 place-items-center">
      <div className="absolute inset-0 rounded-full" style={{ background: "radial-gradient(circle, rgb(var(--rgb-gold) / 0.4) 0%, transparent 65%)" }} />
      <div
        className="absolute inset-[-10%] rounded-full animate-spin"
        style={{ animationDuration: "9s", background: "conic-gradient(from 0deg, transparent, rgb(var(--rgb-green-deep) / 0.4), transparent 55%, rgb(var(--rgb-gold) / 0.25), transparent 90%)" }}
      />
      <span className="relative font-display text-7xl" style={{ color: "var(--c-gold-bright)", filter: "drop-shadow(0 0 16px rgb(var(--rgb-gold) / 0.85))" }}>
        ♔
      </span>
    </div>
  );
}

// Toppled king on the ground with a red glow — the classic sign of defeat.
function FallenKingHero({ resigned }: { resigned?: boolean }) {
  return (
    <div className="relative grid h-28 w-28 place-items-center">
      <div className="absolute inset-0 rounded-full" style={{ background: "radial-gradient(circle, rgb(var(--rgb-red) / 0.32) 0%, transparent 65%)" }} />
      <span
        className="relative inline-block text-7xl"
        style={{
          transform: resigned ? "none" : "rotate(82deg)",
          color: resigned ? "var(--c-text)" : "#7a2b2b",
          filter: "drop-shadow(0 9px 6px rgba(0,0,0,0.6)) drop-shadow(0 0 12px rgb(var(--rgb-red) / 0.55))",
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
  let titleColor = "var(--c-gold-strong)";
  let glow = "rgb(var(--rgb-gold) / 0.5)";
  let panelBg = "rgb(var(--rgb-surface) / 0.94)";
  let border = "rgb(var(--rgb-gold) / 0.3)";
  let hero: ReactNode = <span className="text-7xl opacity-70">♟️</span>;
  let subtitle = "";

  if (outcome === "win") {
    title = "Victory!";
    titleColor = "var(--c-gold-bright)";
    glow = "rgb(var(--rgb-gold) / 0.6)";
    panelBg = "linear-gradient(180deg, rgba(15,50,34,0.96) 0%, rgb(var(--rgb-surface) / 0.96) 60%)";
    border = "rgb(var(--rgb-gold) / 0.42)";
    hero = <VictoryHero />;
    subtitle = reason === "resignation" ? "Your opponent resigned." : `You won ${rt}.`;
  } else if (outcome === "draw") {
    title = "Draw";
    hero = <span className="text-7xl">🤝</span>;
    subtitle = rt ? `The game ended in a draw ${rt}.` : "The game ended in a draw.";
  } else if (outcome === "loss") {
    titleColor = "var(--c-red-text)";
    glow = "rgb(var(--rgb-red) / 0.45)";
    panelBg = "linear-gradient(180deg, rgba(42,16,16,0.96) 0%, rgb(var(--rgb-surface) / 0.96) 62%)";
    border = "rgb(var(--rgb-red) / 0.42)";
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

  // Wager-win breakdown, shown as its own block in the panel below.
  const wagerPot = wagerStake ? wagerStake * 2 : 0;
  const wagerCut = wagerFee > 0 ? wagerFee : Math.floor((wagerPot * HOUSE_FEE_PERCENT) / 100);
  const wagerReceived = wagerPot - wagerCut;

  const lines: { label: string; value: number }[] = [];
  if (outcome === "win") {
    lines.push({ label: "Win reward", value: WIN_REWARD });
  } else if (outcome === "draw") {
    if (wagerStake) lines.push({ label: "Wager refunded", value: 0 });
    lines.push({ label: "Draw reward", value: DRAW_REWARD });
  } else if (outcome === "loss") {
    if (wagerResult === "lost" && wagerStake) lines.push({ label: "Wager lost", value: -wagerStake });
    lines.push({ label: "Loss penalty", value: -resignPenalty });
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
          <p className="text-base text-[rgb(var(--rgb-text)_/_0.8)]">{subtitle}</p>
        </div>

        {outcome !== "spectator" && (
          <div className="mb-6 rounded-xl border p-4" style={{ background: "rgba(0,0,0,0.28)", borderColor: border }}>
            {outcome === "win" && wagerResult === "won" && !!wagerStake && (
              <div className="mb-3 rounded-lg border border-[rgb(var(--rgb-green)_/_0.25)] bg-[rgb(var(--rgb-green)_/_0.06)] p-3 text-sm">
                <p className="mb-1.5 font-semibold text-[var(--c-green-text)]">Wager payout</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-base font-bold">
                    <span className="text-[var(--c-green-text)]">You received</span>
                    <span className="tabular-nums text-[var(--c-green-text)]">{wagerReceived} ARENA</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[rgb(var(--rgb-text)_/_0.65)]">System cut ({HOUSE_FEE_PERCENT}%)</span>
                    <span className="tabular-nums text-[var(--c-red-text)]">−{wagerCut} ARENA</span>
                  </div>
                  <div className="flex justify-between border-t border-[rgb(var(--rgb-green)_/_0.2)] pt-1">
                    <span className="text-[rgb(var(--rgb-text)_/_0.65)]">Pool (both stakes)</span>
                    <span className="tabular-nums text-[var(--c-text)]">{wagerPot} ARENA</span>
                  </div>
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              {lines.map((l) => (
                <div key={l.label} className="flex items-center justify-between text-sm">
                  <span className="text-[rgb(var(--rgb-text)_/_0.7)]">{l.label}</span>
                  <span
                    className={`font-semibold tabular-nums ${
                      l.value > 0 ? "text-[var(--c-green-text)]" : l.value < 0 ? "text-[var(--c-red-text)]" : "text-[rgb(var(--rgb-text)_/_0.6)]"
                    }`}
                  >
                    {l.value > 0 ? "+" : ""}
                    {l.value} ARENA
                  </span>
                </div>
              ))}
              {lines.length === 0 && (
                <p className="text-center text-sm text-[rgb(var(--rgb-text)_/_0.6)]">No token change this game.</p>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-[rgb(var(--rgb-gold)_/_0.15)] pt-3">
              <span className="text-sm font-semibold text-[var(--c-gold-strong)]">New balance</span>
              <span className="text-lg font-bold tabular-nums text-[var(--c-gold-strong)]">
                {balance === null ? "…" : `${balance} ARENA`}
              </span>
            </div>
            {settling && (
              <p className="mt-1 text-right text-[0.65rem] text-[rgb(var(--rgb-text)_/_0.4)]">settling on-chain…</p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <a
            href="/casual"
            className="w-full rounded-lg py-3 text-center font-semibold text-[#1a0f0a] transition-transform hover:-translate-y-0.5"
            style={{ background: "linear-gradient(135deg,var(--c-gold-strong),var(--c-gold) 55%,var(--c-gold-deep))", boxShadow: "0 4px 18px rgb(var(--rgb-gold) / 0.35)" }}
          >
            Play Again
          </a>
          <a
            href="/"
            className="w-full rounded-lg border border-[rgb(var(--rgb-gold)_/_0.35)] bg-[rgb(var(--rgb-gold)_/_0.08)] py-3 text-center font-semibold text-[var(--c-gold-strong)] transition-colors hover:bg-[rgb(var(--rgb-gold)_/_0.18)]"
          >
            Back to Lobby
          </a>
          {gameId ? (
            <a
              href={`/archive/${gameId}`}
              className="w-full rounded-lg py-2.5 text-center text-sm font-semibold text-[rgb(var(--rgb-text)_/_0.6)] transition-colors hover:text-[var(--c-gold-strong)]"
            >
              Review Game
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
