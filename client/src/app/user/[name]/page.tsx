import CopyLink from "@/components/user/CopyLink";
import { fetchProfileData } from "@/lib/user";
import { SITE_URL } from "@/lib/site";
import { notFound } from "next/navigation";

export async function generateMetadata({ params }: { params: { name: string } }) {
  const data = await fetchProfileData(params.name);
  if (!data) {
    return {
      description: "User not found",
      robots: { index: false, follow: false, nocache: true, noarchive: true }
    };
  }
  return {
    title: `${data.name} | Chess Arena`,
    description: `${data.name}'s profile`,
    openGraph: {
      title: `${data.name} | Chess Arena`,
      description: `${data.name}'s profile on Chess Arena`,
      url: `${SITE_URL}/user/${data.name}`,
      siteName: "Chess Arena",
      locale: "en_US",
      type: "website"
    },
    robots: { index: true, follow: false, nocache: true }
  };
}

const reasonLabel = (r?: string) =>
  r === "repetition" ? "threefold repetition" : r === "insufficient" ? "insufficient material" : r || "—";

export default async function Profile({ params }: { params: { name: string } }) {
  const data = await fetchProfileData(params.name);
  if (!data) notFound();

  const wins = data.wins ?? 0;
  const draws = data.draws ?? 0;
  const losses = data.losses ?? 0;
  const played = wins + draws + losses;
  const winRate = played ? Math.round((wins / played) * 100) : 0;
  const initial = (data.name || "?").replace(/^0x/, "").charAt(0).toUpperCase() || "♔";

  const tiles = [
    { label: "Wins", value: wins, color: "#5fb884" },
    { label: "Draws", value: draws, color: "#E8C040" },
    { label: "Losses", value: losses, color: "#e06666" },
    { label: "Win rate", value: `${winRate}%`, color: "#d8ccb0" }
  ];

  return (
    <div className="animate-fade-in-up mx-auto w-full max-w-4xl px-4 py-10">
      {/* ── Hero ── */}
      <section
        className="glass-dark relative overflow-hidden rounded-3xl p-6 md:p-8"
        style={{ border: "1px solid rgba(201,162,39,0.22)" }}
      >
        <div className="tricolor-bar absolute inset-x-0 top-0 rounded-none" />
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div
              className="font-display grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-2xl font-black text-[#0d1612]"
              style={{
                background: "linear-gradient(135deg,#e8c040,#c9a227 55%,#9a7a18)",
                boxShadow: "0 6px 22px rgba(201,162,39,0.35)"
              }}
            >
              {initial}
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.15em] text-[rgba(216,204,176,0.45)]">Player profile</p>
              <h1 className="font-display truncate text-2xl font-black text-[#d8ccb0] md:text-3xl">{data.name}</h1>
              <p className="mt-1 text-xs text-[rgba(216,204,176,0.5)]">
                {played} game{played === 1 ? "" : "s"} played
              </p>
            </div>
          </div>
          <CopyLink name={data.name as string} />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tiles.map((t) => (
            <div
              key={t.label}
              className="rounded-xl px-4 py-3 text-center"
              style={{ background: "rgba(13,22,18,0.55)", border: "1px solid rgba(201,162,39,0.12)" }}
            >
              <p className="font-display text-2xl font-bold tabular-nums" style={{ color: t.color }}>
                {t.value}
              </p>
              <p className="text-[0.7rem] uppercase tracking-wider text-[rgba(216,204,176,0.45)]">{t.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Recent games ── */}
      <div className="mt-8">
        <h2 className="font-display mb-3 text-lg font-bold text-[#E8C040]">Recent games</h2>

        {data.recentGames.length === 0 ? (
          <div
            className="glass-dark rounded-2xl px-6 py-12 text-center"
            style={{ border: "1px solid rgba(201,162,39,0.15)" }}
          >
            <p className="text-4xl opacity-40">♟️</p>
            <p className="mt-3 text-sm text-[rgba(216,204,176,0.5)]">No games played yet.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.recentGames.map((game) => {
              const link = (p?: { id?: number | string; name?: string | null }) =>
                typeof p?.id === "number" && p.id !== data.id ? `/user/${p.name}` : undefined;
              const seat = (color: "white" | "black") => {
                const p = color === "white" ? game.white : game.black;
                const won = game.winner === color;
                const href = link(p);
                return (
                  <div className={"flex flex-col " + (color === "black" ? "items-end text-right" : "")}>
                    <span className="flex items-center gap-1 text-[0.65rem] uppercase tracking-wider text-[rgba(216,204,176,0.4)]">
                      {color}
                      {won && (
                        <span className="rounded bg-[rgba(26,107,63,0.25)] px-1.5 text-[0.6rem] font-bold text-[#5fb884]">
                          won
                        </span>
                      )}
                    </span>
                    {href ? (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="truncate font-semibold text-[#d8ccb0] hover:text-[#E8C040]">
                        {p?.name}
                      </a>
                    ) : (
                      <span className="truncate font-semibold text-[#d8ccb0]">{p?.name || "—"}</span>
                    )}
                  </div>
                );
              };

              return (
                <li
                  key={game.id}
                  className="glass-dark flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl px-4 py-3"
                  style={{ border: "1px solid rgba(201,162,39,0.12)" }}
                >
                  <div className="flex min-w-[220px] flex-1 items-center gap-3">
                    {seat("white")}
                    <span className="font-display text-xs text-[rgba(216,204,176,0.35)]">vs</span>
                    {seat("black")}
                  </div>
                  <div className="text-xs capitalize text-[rgba(216,204,176,0.55)]">
                    {game.winner === "draw" ? "draw" : reasonLabel(game.endReason as string)}
                  </div>
                  <span className="text-[0.7rem] text-[rgba(216,204,176,0.35)]">
                    {game.endedAt ? new Date(game.endedAt as number).toLocaleDateString() : ""}
                  </span>
                  <a
                    href={`/archive/${game.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto rounded-full bg-[rgba(201,162,39,0.12)] px-3 py-1 text-xs font-semibold text-[#E8C040] transition hover:bg-[rgba(201,162,39,0.22)]"
                  >
                    Review
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
