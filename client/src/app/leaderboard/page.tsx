"use client";

import { IconCrown, IconPlayerPlay, IconTrophy } from "@tabler/icons-react";
import Link from "next/link";
import { useContext, useEffect, useState } from "react";

import { API_URL } from "@/config";
import { SessionContext } from "@/context/session";

interface LeaderboardEntry {
    rank: number;
    id: number;
    name: string;
    wins: number;
    losses: number;
    draws: number;
    score: number;
    hasWallet: boolean;
}

export default function LeaderboardPage() {
    const session = useContext(SessionContext);
    const [data, setData] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${API_URL}/v1/leaderboard`, { credentials: "include" })
            .then((r) => r.json())
            .then((d) => setData(d.leaderboard || []))
            .catch(() => setData([]))
            .finally(() => setLoading(false));
    }, []);

    return (
        <main className="mx-auto w-full max-w-4xl px-4 py-8">
            <div className="mb-8 text-center">
                <h1 className="font-display text-4xl md:text-5xl font-bold gold-text-shimmer mb-2 flex items-center justify-center gap-3">
                    <IconTrophy size={36} /> Leaderboard
                </h1>
                <p className="text-[rgb(var(--rgb-text)_/_0.6)]">
                    Top players ranked by ARENA score
                </p>
            </div>

            {loading ? (
                <div className="flex min-h-[40vh] items-center justify-center">
                    <span className="loading loading-spinner loading-lg text-warning" />
                </div>
            ) : data.length === 0 ? (
                <div className="glass-dark rounded-2xl border border-[rgb(var(--rgb-gold)_/_0.18)] p-12 text-center">
                    <p className="text-lg text-[rgb(var(--rgb-text)_/_0.5)]">No players yet.</p>
                    <p className="mt-2 text-sm text-[rgb(var(--rgb-text)_/_0.35)]">
                        Play some games to claim your spot!
                    </p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[320px] text-sm">
                        <thead>
                            <tr className="border-y border-[rgb(var(--rgb-gold)_/_0.12)] text-left text-[0.7rem] uppercase tracking-wider text-[rgb(var(--rgb-text)_/_0.45)]">
                                <th className="px-4 py-2 font-semibold w-12 text-center">#</th>
                                <th className="px-3 py-2 font-semibold">Player</th>
                                <th className="px-3 py-2 text-center font-semibold">W / L / D</th>
                                <th className="px-3 py-2 text-right font-semibold">Score</th>
                                {/* Wallet is the least load-bearing column — drop it
                                    first rather than make phones scroll sideways. */}
                                <th className="hidden px-4 py-2 text-right font-semibold sm:table-cell">
                                    Wallet
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((entry) => {
                                const isMe = session?.user?.id === entry.id;
                                const isTop3 = entry.rank <= 3;
                                return (
                                    <tr
                                        key={entry.id}
                                        className={`border-b border-[rgb(var(--rgb-gold)_/_0.07)] transition-colors ${
                                            isMe
                                                ? "bg-[rgb(var(--rgb-gold)_/_0.08)]"
                                                : "hover:bg-[rgb(var(--rgb-gold)_/_0.04)]"
                                        }`}
                                    >
                                        <td className="px-4 py-3 text-center">
                                            {isTop3 ? (
                                                <span
                                                    className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                                                        entry.rank === 1
                                                            ? "bg-yellow-500/20 text-yellow-400"
                                                            : entry.rank === 2
                                                              ? "bg-gray-400/20 text-gray-300"
                                                              : "bg-amber-700/20 text-amber-500"
                                                    }`}
                                                >
                                                    {entry.rank === 1 ? (
                                                        <IconCrown size={14} />
                                                    ) : (
                                                        entry.rank
                                                    )}
                                                </span>
                                            ) : (
                                                <span className="text-[rgb(var(--rgb-text)_/_0.45)] tabular-nums">
                                                    {entry.rank}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-3 py-3">
                                            <div className="flex items-center gap-2">
                                                <Link
                                                    href={`/user/${entry.name}`}
                                                    className={`font-semibold transition-colors ${
                                                        isMe
                                                            ? "text-[var(--c-gold-strong)]"
                                                            : "text-[var(--c-text)] hover:text-[var(--c-gold-strong)]"
                                                    }`}
                                                >
                                                    {entry.name}
                                                </Link>
                                                {isMe && (
                                                    <span className="rounded-full bg-[rgb(var(--rgb-gold)_/_0.15)] px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-[var(--c-gold-strong)]">
                                                        You
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-3 py-3 text-center tabular-nums">
                                            <span className="text-[var(--c-green-text)]">{entry.wins}</span>
                                            <span className="text-[rgb(var(--rgb-text)_/_0.3)]"> / </span>
                                            <span className="text-[var(--c-red-text)]">{entry.losses}</span>
                                            <span className="text-[rgb(var(--rgb-text)_/_0.3)]"> / </span>
                                            <span className="text-[var(--c-gold-strong)]">{entry.draws}</span>
                                        </td>
                                        <td className="px-3 py-3 text-right font-bold tabular-nums text-[var(--c-gold-strong)]">
                                            {entry.score}
                                        </td>
                                        <td className="hidden px-4 py-3 text-right sm:table-cell">
                                            {entry.hasWallet ? (
                                                <span className="text-xs text-[rgb(var(--rgb-green)_/_0.7)]">
                                                    ✅ Linked
                                                </span>
                                            ) : (
                                                <span className="text-xs text-[rgb(var(--rgb-text)_/_0.35)]">
                                                    —
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="mt-8 text-center">
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 rounded-full border border-[rgb(var(--rgb-gold)_/_0.25)] px-5 py-2 text-sm font-semibold text-[var(--c-gold-strong)] transition hover:bg-[rgb(var(--rgb-gold)_/_0.1)]"
                >
                    <IconPlayerPlay size={16} />
                    Play Now
                </Link>
            </div>
        </main>
    );
}
