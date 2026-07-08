import { fetchPublicGames } from "@/lib/game";
import GameRow from "./GameRow";
import RefreshButton from "./RefreshButton";

export default async function PublicGames() {
  const games = await fetchPublicGames();

  const count = games?.length ?? 0;

  return (
    <div className="flex flex-col">
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="font-display flex items-center gap-2 text-lg font-bold text-[#E8C040]">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#5fb884] opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#5fb884]" />
          </span>
          Live games
          {count > 0 && (
            <span className="rounded-full bg-[rgba(201,162,39,0.15)] px-2 py-0.5 text-xs text-[#E8C040]">
              {count}
            </span>
          )}
        </h2>
        <RefreshButton />
      </div>

      <div
        className="glass-dark max-h-[30rem] min-h-[20rem] overflow-y-auto rounded-2xl p-2"
        style={{ border: "1px solid rgba(201,162,39,0.18)" }}
      >
        {games && games.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {games.map((game) => (
              <GameRow
                key={game.code}
                code={game.code as string}
                white={game.white?.name || undefined}
                black={game.black?.name || undefined}
              />
            ))}
          </ul>
        ) : (
          <div className="flex h-full min-h-[16rem] flex-col items-center justify-center gap-1 px-4 text-center text-sm text-[rgba(216,204,176,0.4)]">
            <span>No live games right now.</span>
            <span className="text-xs">Create a game and share the link — it&apos;ll show up here to watch.</span>
          </div>
        )}
      </div>
    </div>
  );
}
