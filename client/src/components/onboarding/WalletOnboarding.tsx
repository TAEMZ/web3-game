"use client";

import { useContext, useEffect, useState } from "react";
import WalletButton from "@/components/wallet/WalletButton";
import { SessionContext } from "@/context/session";

interface WalletOnboardingProps {
  onComplete: () => void;
  onSkip: () => void;
}

export default function WalletOnboarding({ onComplete, onSkip }: WalletOnboardingProps) {
  const session = useContext(SessionContext);
  const [showDetails, setShowDetails] = useState(false);

  // Check if wallet is already connected
  const hasWallet = !!session?.user?.walletAddress;

  useEffect(() => {
    if (hasWallet) {
      onComplete();
    }
  }, [hasWallet, onComplete]);

  if (hasWallet) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div
        className="glass-dark animate-fade-in-up w-full max-w-lg p-8 max-h-[90vh] overflow-y-auto"
        style={{ border: "1px solid rgba(201,162,39,0.3)", borderRadius: 24 }}
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-5xl mb-4">🎮</div>
          <h2 className="font-display text-2xl font-bold text-[#E8C040] mb-2">
            Unlock Web3 Features
          </h2>
          <p className="text-sm text-[rgba(216,204,176,0.6)]">
            Connect a wallet to access blockchain rewards and features
          </p>
        </div>

        {/* Benefits */}
        <div className="space-y-3 mb-6">
          <div className="flex items-start gap-3">
            <div className="text-xl">💰</div>
            <div>
              <p className="text-sm font-semibold text-[#E8C040]">Earn Rewards</p>
              <p className="text-xs text-[rgba(216,204,176,0.5)]">
                Win tokens for your victories (testnet for now)
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="text-xl">🏆</div>
            <div>
              <p className="text-sm font-semibold text-[#E8C040]">NFT Badges</p>
              <p className="text-xs text-[rgba(216,204,176,0.5)]">
                Collect achievement NFTs stored on-chain
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="text-xl">⚔️</div>
            <div>
              <p className="text-sm font-semibold text-[#E8C040]">Staked Matches</p>
              <p className="text-xs text-[rgba(216,204,176,0.5)]">
                Play high-stakes games with crypto wagers
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="text-xl">🎯</div>
            <div>
              <p className="text-sm font-semibold text-[#E8C040]">On-Chain Records</p>
              <p className="text-xs text-[rgba(216,204,176,0.5)]">
                Match history stored permanently on blockchain
              </p>
            </div>
          </div>
        </div>

        {/* Wallet Options Explanation */}
        <div className="mb-6 rounded-xl bg-[rgba(201,162,39,0.08)] border border-[rgba(201,162,39,0.2)] p-4">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">ℹ️</span>
              <span className="text-sm font-semibold text-[#E8C040]">
                Wallet Connection Options
              </span>
            </div>
            <span className="text-[#E8C040]">{showDetails ? "▼" : "▶"}</span>
          </button>

          {showDetails && (
            <div className="mt-3 space-y-3 text-xs text-[rgba(216,204,176,0.7)]">
              <div>
                <p className="font-semibold text-[#E8C040] mb-1">🔌 Connect Wallet</p>
                <p>
                  Use your existing crypto wallet (MetaMask, Coinbase, etc.). You control your
                  private keys. Best for experienced crypto users.
                </p>
              </div>

              <div>
                <p className="font-semibold text-[#E8C040] mb-1">📱 Social Login (Easy)</p>
                <p>
                  Sign in with Google, Apple, or Phone. A wallet is created for you automatically
                  and managed securely. Perfect for beginners — no crypto experience needed.
                </p>
              </div>

              <div className="rounded-lg bg-[rgba(201,162,39,0.08)] p-2 mt-2">
                <p className="font-semibold text-[#E8C040]">📍 Currently on Testnet</p>
                <p className="mt-1">
                  We&apos;re running on <span className="font-mono">Polygon Amoy</span> testnet. This
                  means tokens and NFTs are for testing only (no real value). Mainnet launch
                  coming soon!
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Wallet Button */}
        <div className="space-y-3">
          <WalletButton />

          <button
            onClick={onSkip}
            className="w-full text-center text-sm text-[rgba(216,204,176,0.5)] hover:text-[rgba(216,204,176,0.8)] transition py-2"
          >
            Skip for now — I&apos;ll connect later
          </button>
        </div>

        <div className="mt-6 pt-6 border-t border-[rgba(201,162,39,0.15)]">
          <p className="text-xs text-center text-[rgba(216,204,176,0.4)]">
            💡 You can connect your wallet anytime from Settings
          </p>
        </div>
      </div>
    </div>
  );
}
