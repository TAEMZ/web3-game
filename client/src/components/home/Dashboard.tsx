"use client";

import { IconBolt, IconChess, IconLink, IconTrophy, IconChevronRight } from "@tabler/icons-react";
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

  useEffect(() => {
    if (isLoading) return;
    if (user?.is_admin) {
      router.replace("/admin");
      return;
    }
    if (!user?.id) router.replace("/login");
  }, [isLoading, user?.id, user?.is_admin, router]);

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
    { label: "Wins", value: stats?.wins, color: "var(--c-green-text)" },
    { label: "Losses", value: stats?.losses, color: "var(--c-red-text)" },
    { label: "Draws", value: stats?.draws, color: "var(--c-gold-strong)" },
    { label: "Win rate", value: stats ? `${winRate}%` : undefined, color: "var(--c-text)" },
  ];

  return (
    <div className="chess-bg min-h-[calc(100vh-57px)]">
      <div className="animate-fade-in-up mx-auto w-full max-w-5xl px-4 py-8">
        {/* ── Identity + balance ── */}
        <section
          className="glass-dark relative overflow-hidden rounded-3xl p-6 md:p-7"
          style={{ border: "1px solid rgb(var(--rgb-gold) / 0.22)" }}
        >
          <div className="tricolor-bar absolute inset-x-0 top-0 rounded-none" />
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div
                className="font-display grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-2xl font-black text-[#0d1612]"
                style={{
                  background: "linear-gradient(135deg,var(--c-gold-strong),var(--c-gold) 55%,var(--c-gold-deep))",
                  boxShadow: "0 6px 22px rgb(var(--rgb-gold) / 0.35)",
                }}
              >
                {initial}
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.15em] text-[rgb(var(--rgb-text)_/_0.45)]">Welcome back</p>
                <h1 className="font-display truncate text-2xl font-black text-[var(--c-text)] md:text-3xl">{name}</h1>
                <span
                  className="mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  style={{
                    background: hasWallet ? "rgb(var(--rgb-green-deep) / 0.18)" : "rgb(var(--rgb-gold) / 0.12)",
                    color: hasWallet ? "var(--c-green-text)" : "var(--c-gold-strong)",
                  }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: hasWallet ? "var(--c-green-text)" : "var(--c-gold-strong)" }} />
                  {hasWallet ? "Wallet connected" : "Connect a wallet in the menu"}
                </span>
              </div>
            </div>

            <div
              className="flex items-center justify-between gap-4 rounded-2xl px-5 py-3 sm:flex-col sm:items-end sm:justify-center sm:text-right"
              style={{ background: "rgb(var(--rgb-gold) / 0.08)", border: "1px solid rgb(var(--rgb-gold) / 0.2)" }}
            >
              <p className="text-[0.7rem] uppercase tracking-wider text-[rgb(var(--rgb-text)_/_0.5)] sm:order-2">
                ARENA balance
              </p>
              <p className="font-display text-3xl font-black text-[var(--c-gold-strong)] sm:order-1">
                {stats ? stats.totalTokens.toLocaleString() : "—"}
              </p>
            </div>
          </div>
        </section>

        {/* ── Big play actions ── */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <button
            onClick={quickPlay}
            disabled={quickLoading}
            className="group glass-dark flex items-center gap-4 rounded-2xl p-5 text-left transition hover:border-[rgb(var(--rgb-gold)_/_0.5)] disabled:opacity-60"
            style={{ border: "1px solid rgb(var(--rgb-gold) / 0.2)" }}
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[rgb(var(--rgb-gold)_/_0.14)] text-[var(--c-gold-strong)]">
              <IconBolt size={24} />
            </span>
            <div className="flex-1">
              <p className="font-display text-lg font-bold text-[var(--c-text)]">
                {quickLoading ? "Starting…" : "Quick Play"}
              </p>
              <p className="text-xs text-[rgb(var(--rgb-text)_/_0.5)]">Instant game vs the computer</p>
            </div>
            <IconChevronRight size={18} className="text-[rgb(var(--rgb-text)_/_0.3)] transition group-hover:text-[var(--c-gold-strong)]" />
          </button>

          <button
            onClick={() => router.push("/play")}
            className="group relative flex items-center gap-4 overflow-hidden rounded-2xl p-5 text-left transition"
            style={{ border: "1px solid rgb(var(--rgb-gold) / 0.5)", background: "rgb(var(--rgb-gold) / 0.06)", boxShadow: "0 6px 24px rgb(var(--rgb-gold) / 0.1)" }}
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[rgb(var(--rgb-gold)_/_0.2)] text-[var(--c-gold-strong)]">
              <IconTrophy size={24} />
            </span>
            <div className="flex-1">
              <p className="font-display text-lg font-bold text-[var(--c-gold-strong)]">Wager Arena</p>
              <p className="text-xs text-[rgb(var(--rgb-text)_/_0.6)]">Stake ARENA — winner takes the pot</p>
            </div>
            <IconChevronRight size={18} className="text-[var(--c-gold-strong)] transition group-hover:translate-x-0.5" />
          </button>
        </div>

        {/* ── Stats ── */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {statTiles.map((t) => (
            <div
              key={t.label}
              className="glass-dark rounded-xl px-4 py-3 text-center"
              style={{ border: "1px solid rgb(var(--rgb-gold) / 0.12)" }}
            >
              <p className="font-display text-2xl font-bold tabular-nums" style={{ color: t.color }}>
                {t.value ?? "—"}
              </p>
              <p className="text-[0.7rem] uppercase tracking-wider text-[rgb(var(--rgb-text)_/_0.45)]">{t.label}</p>
            </div>
          ))}
        </div>

        {/* ── Custom game / join / live ── */}
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
          <div className="glass-dark flex flex-col gap-5 rounded-2xl p-6" style={{ border: "1px solid rgb(var(--rgb-gold) / 0.18)" }}>
            <div>
              <h2 className="font-display flex items-center gap-2 text-lg font-bold text-[var(--c-gold-strong)]">
                <IconChess size={20} /> Custom game
              </h2>
              <p className="text-xs text-[rgb(var(--rgb-text)_/_0.45)]">Play the computer or open a room for a friend.</p>
            </div>
            <CreateGame />

            <div className="h-px bg-[rgb(var(--rgb-text)_/_0.1)]" />

            <div>
              <h2 className="font-display flex items-center gap-2 text-lg font-bold text-[var(--c-gold-strong)]">
                <IconLink size={18} /> Join a game
              </h2>
              <p className="text-xs text-[rgb(var(--rgb-text)_/_0.45)]">Paste an invite link or code.</p>
            </div>
            <JoinGame />
          </div>

          {publicGames}
        </div>
      </div>
    </div>
  );
}
