"use client";

import { useState, useEffect } from "react";

interface VictoryRewardsProps {
  isVisible: boolean;
  onClose: () => void;
  winnerName: string;
  hasWallet: boolean;
  gameId: number;
}

export default function VictoryRewards({
  isVisible,
  onClose,
  winnerName,
  hasWallet,
  gameId,
}: VictoryRewardsProps) {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
      {/* Confetti Effect */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-fall"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-10px`,
                animationDelay: `${Math.random() * 2}s`,
                fontSize: `${Math.random() * 20 + 10}px`,
              }}
            >
              {["🎉", "✨", "🏆", "⭐", "💫"][Math.floor(Math.random() * 5)]}
            </div>
          ))}
        </div>
      )}

      <div
        className="glass-dark animate-fade-in-up w-full max-w-md p-6 md:p-8 relative overflow-hidden max-h-[95vh] overflow-y-auto"
        style={{ border: "1px solid rgba(201,162,39,0.3)", borderRadius: 24 }}
      >
        {/* Ethiopian tricolor accent */}
        <div className="tricolor-bar absolute inset-x-0 top-0 rounded-none" />

        {/* Victory Header */}
        <div className="text-center mb-6">
          <div className="text-7xl mb-4 animate-bounce">🏆</div>
          <h2 className="font-display text-3xl font-bold text-[#E8C040] mb-2">
            Victory!
          </h2>
          <p className="text-lg text-[rgba(216,204,176,0.8)]">
            <span className="font-semibold text-[#E8C040]">{winnerName}</span> wins the game!
          </p>
        </div>

        {/* Rewards Section */}
        {hasWallet ? (
          <div className="space-y-4 mb-6">
            <div className="rounded-xl bg-[rgba(201,162,39,0.08)] border border-[rgba(201,162,39,0.2)] p-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">💰</span>
                <div>
                  <p className="font-semibold text-[#E8C040]">Token Reward</p>
                  <p className="text-xs text-[rgba(216,204,176,0.5)]">
                    Credited to your wallet
                  </p>
                </div>
              </div>
              <div className="text-center py-2">
                <p className="text-3xl font-bold text-[#E8C040]">+50 ARENA</p>
                <p className="text-xs text-[rgba(216,204,176,0.5)] mt-1">
                  Polygon Amoy testnet
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-[rgba(201,162,39,0.08)] border border-[rgba(201,162,39,0.2)] p-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🎯</span>
                <div>
                  <p className="font-semibold text-[#E8C040]">Match Recorded</p>
                  <p className="text-xs text-[rgba(216,204,176,0.5)]">
                    Game #{gameId} saved on-chain
                  </p>
                </div>
              </div>
            </div>

            {/* Achievement Progress */}
            <div className="rounded-xl bg-[rgba(201,162,39,0.08)] border border-[rgba(201,162,39,0.2)] p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🏅</span>
                  <span className="text-sm font-semibold text-[#E8C040]">
                    First Victory Badge
                  </span>
                </div>
                <span className="text-xs text-[rgba(216,204,176,0.5)]">NFT</span>
              </div>
              <div className="w-full bg-[rgba(0,0,0,0.3)] rounded-full h-2 mb-1">
                <div
                  className="bg-gradient-to-r from-yellow-500 to-[#E8C040] h-2 rounded-full transition-all duration-1000"
                  style={{ width: "100%" }}
                />
              </div>
              <p className="text-xs text-center text-[#E8C040] font-semibold">
                ✨ Badge Unlocked! Minting NFT...
              </p>
            </div>
          </div>
        ) : (
          <div className="mb-6 rounded-xl bg-[rgba(201,162,39,0.08)] border border-[rgba(201,162,39,0.2)] p-5">
            <div className="text-center space-y-3">
              <span className="text-4xl">🔒</span>
              <p className="text-sm text-[rgba(216,204,176,0.7)]">
                Connect a wallet to earn rewards and mint NFT badges!
              </p>
              <button
                onClick={() => {
                  window.location.href = "/settings";
                }}
                className="w-full py-2 px-4 rounded-lg bg-[#E8C040] text-[#1a0f0a] font-semibold hover:bg-[#d4af3a] transition-colors"
              >
                Connect Wallet
              </button>
            </div>
          </div>
        )}

        {/* Stats Summary */}
        <div className="rounded-xl bg-[rgba(201,162,39,0.05)] border border-[rgba(201,162,39,0.15)] p-4 mb-6">
          <p className="text-xs text-center text-[rgba(216,204,176,0.5)] mb-2">
            Game Statistics Updated
          </p>
          <div className="flex justify-around text-center">
            <div>
              <p className="text-xl font-bold text-green-400">+1</p>
              <p className="text-xs text-[rgba(216,204,176,0.5)]">Win</p>
            </div>
            <div className="border-l border-[rgba(201,162,39,0.2)]" />
            <div>
              <p className="text-xl font-bold text-[#E8C040]">+10</p>
              <p className="text-xs text-[rgba(216,204,176,0.5)]">ELO</p>
            </div>
            <div className="border-l border-[rgba(201,162,39,0.2)]" />
            <div>
              <p className="text-xl font-bold text-blue-400">+5</p>
              <p className="text-xs text-[rgba(216,204,176,0.5)]">XP</p>
            </div>
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full py-3 rounded-lg bg-[rgba(201,162,39,0.2)] hover:bg-[rgba(201,162,39,0.3)] text-[#E8C040] font-semibold transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
