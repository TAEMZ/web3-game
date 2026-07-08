"use client";

import { IconCoins, IconMedal, IconMedal2, IconStar, IconTrophy } from "@tabler/icons-react";
import { useContext, useEffect, useState } from "react";
import { SessionContext } from "@/context/session";
import { API_URL } from "@/config";
import { useRouter } from "next/navigation";

interface Achievement {
  id: number;
  name: string;
  earned: boolean;
}

interface RewardsData {
  totalTokens: number;
  penalty?: number;
  resignPenalty?: number;
  achievements: Achievement[];
  stats: {
    wins: number;
    losses: number;
    draws: number;
    resignations?: number;
  };
}

export default function RewardsPage() {
  const session = useContext(SessionContext);
  const router = useRouter();
  const [rewards, setRewards] = useState<RewardsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user) {
      router.push("/login");
      return;
    }

    fetchRewards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function fetchRewards() {
    try {
      const res = await fetch(`${API_URL}/v1/rewards/user`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setRewards(data);
      }
    } catch (error) {
      console.error("Error fetching rewards:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[#E8C040]">Loading...</div>
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  const hasWallet = !!session.user.walletAddress;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl md:text-5xl font-bold gold-text-shimmer mb-2">
            Your Rewards
          </h1>
          <p className="text-[rgba(216,204,176,0.6)]">
            Track your tokens, NFTs, and achievements
          </p>
        </div>

        {!hasWallet && (
          <div className="glass-dark p-6 rounded-2xl mb-6 border border-[rgba(201,162,39,0.3)]">
            <div className="flex items-center gap-4">
              <span className="text-4xl">🔒</span>
              <div className="flex-1">
                <p className="font-semibold text-[#E8C040] mb-1">
                  Connect Wallet to Claim Rewards
                </p>
                <p className="text-sm text-[rgba(216,204,176,0.6)]">
                  Your stats are tracked, but you need a wallet to receive tokens and NFTs
                </p>
              </div>
              <button
                onClick={() => router.push("/settings")}
                className="btn-gold"
              >
                Connect Now
              </button>
            </div>
          </div>
        )}

        {/* Tokens Section */}
        <div className="glass-dark p-6 rounded-2xl mb-6 border border-[rgba(201,162,39,0.3)]">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display flex items-center gap-2 text-2xl font-bold text-[#E8C040]">
              <IconCoins size={22} /> ARENA Tokens
            </h2>
            <span className="text-xs text-[rgba(216,204,176,0.5)]">Polygon Amoy</span>
          </div>

          <div className="text-center py-8">
            <div className="text-6xl font-bold gold-text-shimmer mb-2">
              {rewards?.totalTokens || 0}
            </div>
            <p className="text-[rgba(216,204,176,0.6)] text-sm">Total ARENA Earned</p>
            {(rewards?.penalty || 0) > 0 && (
              <p className="text-xs text-red-400 mt-2">
                −{rewards?.penalty} ARENA from {rewards?.stats.resignations} resignation
                {(rewards?.stats.resignations || 0) > 1 ? "s" : ""}
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4 pt-6 border-t border-[rgba(201,162,39,0.15)]">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-400">{rewards?.stats.wins || 0}</p>
              <p className="text-xs text-[rgba(216,204,176,0.5)]">Wins</p>
              <p className="text-xs text-[#E8C040] mt-1">+{(rewards?.stats.wins || 0) * 50} tokens</p>
            </div>
            <div className="text-center border-x border-[rgba(201,162,39,0.15)]">
              <p className="text-2xl font-bold text-yellow-400">{rewards?.stats.draws || 0}</p>
              <p className="text-xs text-[rgba(216,204,176,0.5)]">Draws</p>
              <p className="text-xs text-[#E8C040] mt-1">+{(rewards?.stats.draws || 0) * 10} tokens</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-400">{rewards?.stats.losses || 0}</p>
              <p className="text-xs text-[rgba(216,204,176,0.5)]">Losses</p>
            </div>
          </div>
        </div>

        {/* Achievement badges — compact list */}
        <div className="glass-dark rounded-2xl border border-[rgba(201,162,39,0.3)] p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display flex items-center gap-2 text-xl font-bold text-[#E8C040]">
              <IconTrophy size={20} /> Achievement Badges
            </h2>
            <span className="text-xs text-[rgba(216,204,176,0.4)]">NFT · Polygon Amoy</span>
          </div>

          <ul className="flex flex-col gap-2">
            {[
              { Icon: IconMedal, name: "First Victory", desc: "Win your first game", need: 1, color: "#cd8b52" },
              { Icon: IconMedal2, name: "Silver Champion", desc: "Win 10 games", need: 10, color: "#c8c8d0" },
              { Icon: IconTrophy, name: "Gold Champion", desc: "Win 100 games", need: 100, color: "#E8C040" },
              { Icon: IconStar, name: "Perfect Week", desc: "Win 7 games in a row", need: null as number | null, color: "#a78bfa", soon: true },
            ].map((a) => {
              const wins = rewards?.stats.wins || 0;
              const earned = a.need != null && wins >= a.need;
              const pct = a.need ? Math.min((wins / a.need) * 100, 100) : 0;
              return (
                <li
                  key={a.name}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                  style={{
                    background: earned ? "rgba(201,162,39,0.08)" : "rgba(13,22,18,0.5)",
                    border: `1px solid ${earned ? "rgba(201,162,39,0.3)" : "rgba(201,162,39,0.1)"}`,
                    opacity: a.soon ? 0.55 : 1,
                  }}
                >
                  <div
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
                    style={{
                      background: earned ? `${a.color}22` : "rgba(0,0,0,0.3)",
                      color: earned ? a.color : "rgba(216,204,176,0.35)",
                      border: `1px solid ${earned ? a.color + "66" : "rgba(201,162,39,0.15)"}`,
                    }}
                  >
                    <a.Icon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[#d8ccb0]">{a.name}</span>
                      {earned && (
                        <span className="rounded-full bg-[rgba(95,184,132,0.15)] px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-[#5fb884]">
                          Earned
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-[rgba(216,204,176,0.45)]">{a.desc}</p>
                  </div>
                  <div className="w-16 shrink-0 text-right">
                    {a.soon ? (
                      <span className="text-[0.65rem] uppercase tracking-wide text-[rgba(216,204,176,0.35)]">
                        Soon
                      </span>
                    ) : earned ? (
                      <span className="text-lg text-[#5fb884]">✓</span>
                    ) : (
                      <>
                        <span className="text-xs tabular-nums text-[rgba(216,204,176,0.5)]">
                          {wins}/{a.need}
                        </span>
                        <div className="mt-1 h-1 w-full rounded-full bg-[rgba(0,0,0,0.3)]">
                          <div className="h-1 rounded-full bg-[#E8C040]" style={{ width: `${pct}%` }} />
                        </div>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <p className="mt-4 border-t border-[rgba(201,162,39,0.12)] pt-4 text-center text-xs text-[rgba(216,204,176,0.4)]">
            Badges are soul-bound NFTs minted on the Polygon Amoy testnet.
          </p>
        </div>
    </main>
  );
}
