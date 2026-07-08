"use client";

import {
  IconAlertTriangle,
  IconDeviceGamepad2,
  IconUsers,
  IconWallet,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useContext, useEffect, useState } from "react";

import { API_URL } from "@/config";
import { SessionContext } from "@/context/session";

interface Player {
  id: number;
  name: string;
  wallet: string | null;
  wins: number;
  losses: number;
  draws: number;
  tokens: number;
  isAdmin: boolean;
  banned: boolean;
  lastIp: string | null;
}
interface Overview {
  players: number;
  games: number;
  wallets: number;
  totalTokens: number;
}
interface Report {
  id: number;
  reporter_name: string;
  reported_id: number | null;
  reported_name: string;
  reason: string;
  note: string | null;
  game_code: string | null;
  chat_snapshot: string | null;
  status: string;
  created_at: string;
}

const REASON_LABEL: Record<string, string> = {
  cheating: "Cheating",
  abusive_chat: "Abusive chat",
  harassment: "Harassment",
  other: "Other",
};

export default function AdminPage() {
  const session = useContext(SessionContext);
  const router = useRouter();
  const user = session?.user;
  const checking = user === undefined || (!!user && Object.keys(user).length === 0);

  const [overview, setOverview] = useState<Overview | null>(null);
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [reports, setReports] = useState<Report[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (checking) return;
    if (!user?.id || !user.is_admin) router.replace("/");
  }, [checking, user?.id, user?.is_admin, router]);

  async function load() {
    const [o, p, r] = await Promise.all([
      fetch(`${API_URL}/v1/admin/overview`, { credentials: "include" }).then((x) => (x.ok ? x.json() : null)),
      fetch(`${API_URL}/v1/admin/players`, { credentials: "include" }).then((x) => (x.ok ? x.json() : null)),
      fetch(`${API_URL}/v1/admin/reports`, { credentials: "include" }).then((x) => (x.ok ? x.json() : null)),
    ]);
    if (o) setOverview(o);
    if (p) setPlayers(p.players);
    if (r) setReports(r.reports);
  }

  useEffect(() => {
    if (checking || !user?.is_admin) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checking, user?.is_admin]);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 6000);
  }

  async function post(path: string, body: object, key: string, ok: string) {
    setBusy(key);
    try {
      const res = await fetch(`${API_URL}/v1/admin/${path}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      flash(res.ok ? ok : data.error || "Action failed");
      await load();
    } catch {
      flash("Action failed");
    } finally {
      setBusy(null);
    }
  }

  const distribute = (p: Player) =>
    post("distribute", { userId: p.id }, `dist-${p.id}`, `Released rewards to ${p.name} (testnet simulation)`);
  const ban = (id: number, name: string, withIp: boolean) =>
    post("ban", { userId: id, banIp: withIp }, `ban-${id}`, `Banned ${name}${withIp ? " + IP" : ""}`);
  const unban = (id: number, name: string) =>
    post("unban", { userId: id }, `ban-${id}`, `Unbanned ${name}`);
  const resolve = (id: number) => post("resolve", { reportId: id }, `res-${id}`, "Report resolved");

  if (checking || !user?.is_admin) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span className="loading loading-spinner loading-lg text-warning" />
      </div>
    );
  }

  const openReports = reports?.filter((r) => r.status === "open") ?? [];
  const tiles = [
    { label: "Players", value: overview?.players, Icon: IconUsers, color: "#5fb884" },
    { label: "Games played", value: overview?.games, Icon: IconDeviceGamepad2, color: "#E8C040" },
    { label: "Wallets linked", value: overview?.wallets, Icon: IconWallet, color: "#a78bfa" },
    { label: "Open reports", value: openReports.length, Icon: IconAlertTriangle, color: "#e06666" },
  ];

  return (
    <div className="animate-fade-in-up mx-auto w-full max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-black text-[#d8ccb0] md:text-4xl">
          Admin <span className="gold-text-shimmer">Console</span>
        </h1>
        <p className="mt-1 text-sm text-[rgba(216,204,176,0.5)]">
          Review reports, moderate players, and release rewards.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="glass-dark rounded-2xl p-4" style={{ border: "1px solid rgba(201,162,39,0.15)" }}>
            <t.Icon size={20} style={{ color: t.color }} />
            <p className="font-display mt-2 text-2xl font-bold text-[#d8ccb0]">{t.value ?? "—"}</p>
            <p className="text-[0.7rem] uppercase tracking-wider text-[rgba(216,204,176,0.45)]">{t.label}</p>
          </div>
        ))}
      </div>

      {/* Reports */}
      <div className="glass-dark mb-6 overflow-hidden rounded-2xl" style={{ border: "1px solid rgba(201,162,39,0.18)" }}>
        <div className="tricolor-bar" />
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="font-display flex items-center gap-2 text-lg font-bold text-[#E8C040]">
            <IconAlertTriangle size={18} /> Reports
          </h2>
          <span className="text-xs text-[rgba(216,204,176,0.4)]">{openReports.length} open</span>
        </div>

        <div className="flex flex-col gap-2 px-4 pb-4">
          {reports && reports.length === 0 && (
            <p className="px-1 py-6 text-center text-sm text-[rgba(216,204,176,0.4)]">No reports. All quiet.</p>
          )}
          {reports?.map((r) => (
            <div
              key={r.id}
              className="rounded-xl p-4"
              style={{
                background: r.status === "open" ? "rgba(184,24,24,0.06)" : "rgba(13,22,18,0.5)",
                border: `1px solid ${r.status === "open" ? "rgba(224,102,102,0.25)" : "rgba(201,162,39,0.1)"}`,
                opacity: r.status === "open" ? 1 : 0.6,
              }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[rgba(224,102,102,0.15)] px-2 py-0.5 text-[0.65rem] font-bold uppercase text-[#e06666]">
                  {REASON_LABEL[r.reason] || r.reason}
                </span>
                <span className="text-sm font-semibold text-[#d8ccb0]">{r.reported_name}</span>
                <span className="text-xs text-[rgba(216,204,176,0.4)]">reported by {r.reporter_name}</span>
                {r.game_code && (
                  <a
                    href={`/${r.game_code}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#E8C040] hover:underline"
                  >
                    game {r.game_code}
                  </a>
                )}
                {r.status === "resolved" && (
                  <span className="text-[0.65rem] uppercase text-[rgba(216,204,176,0.4)]">resolved</span>
                )}
              </div>

              {r.note && <p className="mt-2 text-sm text-[rgba(216,204,176,0.75)]">{r.note}</p>}
              {r.chat_snapshot && (
                <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap rounded-lg bg-[rgba(0,0,0,0.35)] p-2 text-xs text-[rgba(216,204,176,0.6)]">
                  {r.chat_snapshot}
                </pre>
              )}

              {r.status === "open" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => r.reported_id && ban(r.reported_id, r.reported_name, false)}
                    disabled={!r.reported_id || busy === `ban-${r.reported_id}`}
                    className="rounded-full bg-[rgba(184,24,24,0.2)] px-3 py-1.5 text-xs font-semibold text-[#e06666] transition hover:bg-[rgba(184,24,24,0.35)] disabled:opacity-30"
                  >
                    Ban player
                  </button>
                  <button
                    onClick={() => r.reported_id && ban(r.reported_id, r.reported_name, true)}
                    disabled={!r.reported_id || busy === `ban-${r.reported_id}`}
                    className="rounded-full bg-[rgba(184,24,24,0.2)] px-3 py-1.5 text-xs font-semibold text-[#e06666] transition hover:bg-[rgba(184,24,24,0.35)] disabled:opacity-30"
                  >
                    Ban + block IP
                  </button>
                  <button
                    onClick={() => resolve(r.id)}
                    disabled={busy === `res-${r.id}`}
                    className="rounded-full border border-[rgba(201,162,39,0.3)] px-3 py-1.5 text-xs font-semibold text-[#d8ccb0] transition hover:bg-[rgba(201,162,39,0.12)]"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Players */}
      <div className="glass-dark overflow-hidden rounded-2xl" style={{ border: "1px solid rgba(201,162,39,0.18)" }}>
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="font-display text-lg font-bold text-[#E8C040]">Players</h2>
          <span className="text-xs text-[rgba(216,204,176,0.4)]">{players ? `${players.length} shown` : "loading…"}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-y border-[rgba(201,162,39,0.12)] text-left text-[0.7rem] uppercase tracking-wider text-[rgba(216,204,176,0.45)]">
                <th className="px-5 py-2 font-semibold">Player</th>
                <th className="px-3 py-2 font-semibold">Wallet</th>
                <th className="px-3 py-2 text-center font-semibold">W / L / D</th>
                <th className="px-3 py-2 text-right font-semibold">ARENA</th>
                <th className="px-5 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {players?.map((p) => (
                <tr key={p.id} className="border-b border-[rgba(201,162,39,0.07)] hover:bg-[rgba(201,162,39,0.04)]">
                  <td className="px-5 py-3">
                    <a href={`/user/${p.name}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#d8ccb0] hover:text-[#E8C040]">
                      {p.name}
                    </a>
                    {p.banned && (
                      <span className="ml-2 rounded-full bg-[rgba(184,24,24,0.2)] px-1.5 py-0.5 text-[0.6rem] font-bold uppercase text-[#e06666]">
                        banned
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-[rgba(216,204,176,0.55)]">
                    {p.wallet ? `${p.wallet.slice(0, 6)}…${p.wallet.slice(-4)}` : "—"}
                  </td>
                  <td className="px-3 py-3 text-center tabular-nums">
                    <span className="text-[#5fb884]">{p.wins}</span>
                    <span className="text-[rgba(216,204,176,0.3)]"> / </span>
                    <span className="text-[#e06666]">{p.losses}</span>
                    <span className="text-[rgba(216,204,176,0.3)]"> / </span>
                    <span className="text-[#E8C040]">{p.draws}</span>
                  </td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums text-[#E8C040]">{p.tokens}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => distribute(p)}
                        disabled={busy === `dist-${p.id}` || !p.wallet || p.tokens === 0}
                        className="rounded-full bg-[rgba(201,162,39,0.15)] px-3 py-1.5 text-xs font-semibold text-[#E8C040] transition hover:bg-[rgba(201,162,39,0.28)] disabled:cursor-not-allowed disabled:opacity-30"
                        title={!p.wallet ? "No wallet linked" : p.tokens === 0 ? "Nothing to release" : "Release rewards"}
                      >
                        Release
                      </button>
                      {p.banned ? (
                        <button
                          onClick={() => unban(p.id, p.name)}
                          disabled={busy === `ban-${p.id}`}
                          className="rounded-full border border-[rgba(95,184,132,0.4)] px-3 py-1.5 text-xs font-semibold text-[#5fb884] transition hover:bg-[rgba(95,184,132,0.12)] disabled:opacity-30"
                        >
                          Unban
                        </button>
                      ) : (
                        <button
                          onClick={() => ban(p.id, p.name, false)}
                          disabled={busy === `ban-${p.id}`}
                          className="rounded-full border border-[rgba(224,102,102,0.4)] px-3 py-1.5 text-xs font-semibold text-[#e06666] transition hover:bg-[rgba(184,24,24,0.15)] disabled:opacity-30"
                        >
                          Ban
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {players && players.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-[rgba(216,204,176,0.4)]">
                    No players yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-[rgba(201,162,39,0.3)] bg-[rgba(13,22,18,0.95)] px-5 py-3 text-sm text-[#d8ccb0] shadow-xl backdrop-blur">
          {toast}
        </div>
      )}
    </div>
  );
}
