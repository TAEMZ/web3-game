"use client";

import { useEffect, useState } from "react";
import type { Game } from "@arena/types";

type Outcome = "win" | "loss" | "draw" | "spectator";

interface GameOverModalProps {
  outcome: Outcome;
  reason: Game["endReason"];
  winnerName?: string;
  /** True when THIS player is the one who resigned (quit). */
  didResign: boolean;
  hasWallet: boolean;
  gameId: number;
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

export default function GameOverModal({
  outcome,
  reason,
  winnerName,
  didResign,
  hasWallet,
  gameId,
  resignPenalty,
}: GameOverModalProps) {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (outcome === "win") {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 3500);
      return () => clearTimeout(timer);
    }
  }, [outcome]);

  const rt = reasonText(reason);

  // Per-outcome presentation.
  let icon = "♟️";
  let title = "Game Over";
  let titleColor = "#E8C040";
  let subtitle = "";

  if (outcome === "win") {
    icon = "🏆";
    title = "Victory!";
    titleColor = "#E8C040";
    subtitle = reason === "resignation" ? "Your opponent resigned." : `You won ${rt}.`;
  } else if (outcome === "draw") {
    icon = "🤝";
    title = "Draw";
    titleColor = "#E8C040";
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
    // spectator
    icon = "♟️";
    title = "Game Over";
    subtitle = winnerName ? `${winnerName} won ${rt}.` : "The game ended in a draw.";
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
        {/* Ethiopian tricolor accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-600 via-yellow-500 to-red-600" />

        {/* Result header */}
        <div className="text-center mb-6">
          <div className="text-7xl mb-4">{icon}</div>
          <h2 className="font-display text-3xl font-bold mb-2" style={{ color: titleColor }}>
            {title}
          </h2>
          <p className="text-base text-[rgba(216,204,176,0.8)]">{subtitle}</p>
        </div>

        {/* Reward / penalty */}
        {outcome === "win" && (
          <div className="mb-6 rounded-xl bg-[rgba(201,162,39,0.08)] border border-[rgba(201,162,39,0.2)] p-4">
            {hasWallet ? (
              <div className="text-center py-1">
                <p className="text-3xl font-bold text-[#E8C040]">+50 ARENA</p>
                <p className="text-xs text-[rgba(216,204,176,0.5)] mt-1">Credited on Polygon Amoy testnet</p>
              </div>
            ) : (
              <div className="text-center space-y-3">
                <p className="text-sm text-[rgba(216,204,176,0.7)]">
                  Connect a wallet to earn ARENA tokens and NFT badges for your wins.
                </p>
                <a
                  href="/settings"
                  className="inline-block w-full py-2 px-4 rounded-lg bg-[#E8C040] text-[#1a0f0a] font-semibold hover:bg-[#d4af3a] transition-colors"
                >
                  Connect Wallet
                </a>
              </div>
            )}
          </div>
        )}

        {outcome === "loss" && didResign && (
          <div className="mb-6 rounded-xl bg-[rgba(184,24,24,0.1)] border border-[rgba(224,102,102,0.35)] p-4 text-center">
            <p className="text-2xl font-bold text-[#e06666]">−{resignPenalty} ARENA</p>
            <p className="text-xs text-[rgba(216,204,176,0.6)] mt-1">Resignation penalty for quitting</p>
          </div>
        )}

        {outcome === "loss" && !didResign && (
          <div className="mb-6 rounded-xl bg-[rgba(201,162,39,0.05)] border border-[rgba(201,162,39,0.15)] p-4 text-center">
            <p className="text-sm text-[rgba(216,204,176,0.7)]">
              No tokens this game — play again to climb back.
            </p>
          </div>
        )}

        {outcome === "draw" && (
          <div className="mb-6 rounded-xl bg-[rgba(201,162,39,0.08)] border border-[rgba(201,162,39,0.2)] p-4 text-center">
            <p className="text-2xl font-bold text-[#E8C040]">{hasWallet ? "+10 ARENA" : "Draw"}</p>
            <p className="text-xs text-[rgba(216,204,176,0.5)] mt-1">
              {hasWallet ? "Credited on Polygon Amoy testnet" : "Connect a wallet to earn on draws"}
            </p>
          </div>
        )}

        {/* Actions — leaving the game */}
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
