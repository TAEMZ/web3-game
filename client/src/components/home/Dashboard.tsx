"use client";

import { IconBolt, IconChess, IconLink, IconTrophy } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useContext, useEffect, useState } from "react";

import { SessionContext } from "@/context/session";
import { API_URL } from "@/config";
import { createGame } from "@/lib/game";
import CreateGame from "./CreateGame";
import JoinGame from "./JoinGame";

interface Stats {
  wins: number;
  losses: number;
  draws: number;
  totalTokens: number;
}

export default function Dashboard({ publicGames }: { publicGames: ReactNode }) {
  const session = useContext(SessionContext);
  const router = useRouter();
  const user = session?.user;
  const isLoading = !!user && Object.keys(user).length === 0;

  const [stats, setStats] = useState<Stats | null>(null);
  const [quickLoading, setQuickLoading] = useState(false);

  // Admins don't use the player dashboard — send them to the admin console.
  // Signed-out visitors go to login.
  useEffect(() => {
    if (isLoading) return;
    if (user?.is_admin) {
      router.replace("/admin");
      return;
    }
    if (!user?.id) router.replace("/login");
  }, [isLoading, user?.id, user?.is_admin, router]);

  // Pull the player's record + token balance for the hero.
  useEffect(() => {
    if (isLoading || !user?.id) return;
    let active = true;
    fetch(`${API_URL}/v1/rewards/user`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active && d) {
          setStats({
            wins: d.stats?.wins ?? 0,
            losses: d.stats?.losses ?? 0,
            draws: d.stats?.draws ?? 0,
            totalTokens: d.totalTokens ?? 0,
          });
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isLoading, user?.id]);


  async function quickPlay() {
    setQuickLoading(true);
    const game = await createGame("random", false, { vsBot: true, difficulty: "medium" });
    if (game) router.push(`/${game.code}`);
    else setQuickLoading(false);
  }

  if (isLoading || !user?.id) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span className="loading loading-spinner loading-lg text-warning"></span>
      </div>
    );
  }

  const name = user.name || "Player";
  const initial = name.replace(/^0x/, "").charAt(0).toUpperCase() || "♔";
  const hasWallet = !!user.walletAddress;
  const played = stats ? stats.wins + stats.losses + stats.draws : 0;
  const winRate = played ? Math.round((stats!.wins / played) * 100) : 0;

  const statTiles = [
    { label: "Wins", value: stats?.wins, color: "#5fb884" },
    { label: "Losses", value: stats?.losses, color: "#e06666" },
    { label: "Draws", value: stats?.draws, color: "#E8C040" },
    { label: "Win rate", value: stats ? `${winRate}%` : undefined, color: "#d8ccb0" },
  ];

  return (
    <>
      <div className="animate-fade-in-up mx-auto w-full max-w-5xl px-4 py-8">
        {/* ── Hero: who you are + your record ── */}
        <section
          className="glass-dark relative overflow-hidden rounded-3xl p-6 md:p-8"
          style={{ border: "1px solid rgba(201,162,39,0.22)" }}
        >
          <div className="tricolor-bar absolute inset-x-0 top-0 rounded-none" />
          {/* faint chessboard motif */}
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-10 h-64 w-64 opacity-[0.06]"
            style={{
              background:
                "repeating-conic-gradient(#E8C040 0% 25%, transparent 0% 50%) 0 / 44px 44px",
              maskImage: "radial-gradient(circle at center, #000 30%, transparent 72%)",
              WebkitMaskImage: "radial-gradient(circle at center, #000 30%, transparent 72%)",
            }}
          />

          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div
                className="font-display grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-2xl font-black text-[#0d1612]"
                style={{
                  background: "linear-gradient(135deg,#e8c040,#c9a227 55%,#9a7a18)",
                  boxShadow: "0 6px 22px rgba(201,162,39,0.35)",
                }}
              >
                {initial}
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.15em] text-[rgba(216,204,176,0.45)]">
                  Welcome back
                </p>
                <h1 className="font-display truncate text-2xl font-black text-[#d8ccb0] md:text-3xl">
                  {name}
                </h1>
                <span
                  className="mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  style={{
                    background: hasWallet ? "rgba(26,107,63,0.18)" : "rgba(201,162,39,0.12)",
                    color: hasWallet ? "#5fb884" : "#E8C040",
                  }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: hasWallet ? "#5fb884" : "#E8C040" }}
                  />
                  {hasWallet ? "Wallet connected" : "Guest — connect a wallet"}
                </span>
              </div>
            </div>

            {/* ARENA token balance */}
            <div className="flex items-center gap-4">
              <div
                className="rounded-2xl px-5 py-3 text-center"
                style={{
                  background: "rgba(201,162,39,0.08)",
                  border: "1px solid rgba(201,162,39,0.2)",
                }}
              >
                <p className="font-display text-3xl font-black text-[#E8C040]">
                  {stats ? stats.totalTokens : "—"}
                </p>
                <p className="text-[0.7rem] uppercase tracking-wider text-[rgba(216,204,176,0.5)]">
                  ARENA
                </p>
              </div>
            </div>
          </div>

          {/* stat strip */}
          <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {statTiles.map((t) => (
              <div
                key={t.label}
                className="rounded-xl px-4 py-3 text-center"
                style={{ background: "rgba(13,22,18,0.55)", border: "1px solid rgba(201,162,39,0.12)" }}
              >
                <p className="font-display text-2xl font-bold" style={{ color: t.color }}>
                  {t.value ?? "—"}
                </p>
                <p className="text-[0.7rem] uppercase tracking-wider text-[rgba(216,204,176,0.45)]">
                  {t.label}
                </p>
              </div>
            ))}
          </div>

          {/* one-click primary action */}
          <div className="relative mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button className="btn-gold w-full sm:w-auto" onClick={quickPlay} disabled={quickLoading}>
              {quickLoading ? (
                "Starting…"
              ) : (
                <>
                  <IconBolt size={18} /> Quick Play vs Computer
                </>
              )}
            </button>
            <button className="btn-dark w-full sm:w-auto" onClick={() => router.push("/play")}>
              <IconTrophy size={18} /> Wager Arena
            </button>
            <p className="text-xs text-[rgba(216,204,176,0.45)]">
              Quick game vs Stockfish, or unlock staked wager matches.
            </p>
          </div>
        </section>

        {/* ── Play options + live games ── */}
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
          <div
            className="glass-dark flex flex-col gap-5 rounded-2xl p-6"
            style={{ border: "1px solid rgba(201,162,39,0.18)" }}
          >
            <div>
              <h2 className="font-display flex items-center gap-2 text-lg font-bold text-[#E8C040]">
                <IconChess size={20} /> New game
              </h2>
              <p className="text-xs text-[rgba(216,204,176,0.45)]">
                Play the computer or open a room for a friend.
              </p>
            </div>
            <CreateGame />

            <div className="h-px bg-[rgba(216,204,176,0.1)]" />

            <div>
              <h2 className="font-display flex items-center gap-2 text-lg font-bold text-[#E8C040]">
                <IconLink size={18} /> Join a game
              </h2>
              <p className="text-xs text-[rgba(216,204,176,0.45)]">Paste an invite link or code.</p>
            </div>
            <JoinGame />
          </div>

          {publicGames}
        </div>
      </div>
    </>
  );
}
