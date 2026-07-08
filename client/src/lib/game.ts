import { API_URL } from "@/config";
import type { Game } from "@arena/types";

export const createGame = async (
    side: string,
    unlisted: boolean,
    opts?: { vsBot?: boolean; difficulty?: string }
) => {
    console.log("🎮 [CREATE GAME] Starting...", { side, unlisted, ...opts });
    const start = Date.now();

    try {
        const res = await fetch(`${API_URL}/v1/games`, {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                side,
                unlisted,
                vsBot: opts?.vsBot ?? false,
                difficulty: opts?.difficulty ?? "medium"
            }),
            cache: "no-store"
        });

        console.log(`⏱️ [CREATE GAME] Response received in ${Date.now() - start}ms, status: ${res.status}`);

        if (res && res.status === 201) {
            const game: Game = await res.json();
            console.log("✅ [CREATE GAME] Success:", game.code);
            return game;
        }
        
        console.error("❌ [CREATE GAME] Failed: Bad status", res.status);
    } catch (err) {
        console.error("❌ [CREATE GAME] Error:", err);
    }
};

export const fetchActiveGame = async (code: string) => {
    try {
        const res = await fetch(`${API_URL}/v1/games/${code}`, { cache: "no-store" });

        if (res && res.status === 200) {
            const game: Game = await res.json();
            return game;
        }
    } catch (err) {
        console.error(err);
    }
};

export const fetchPublicGames = async () => {
    try {
        const res = await fetch(`${API_URL}/v1/games`, { cache: "no-store" });

        if (res && res.status === 200) {
            const games: Game[] = await res.json();
            return games;
        }
    } catch (err) {
        console.error(err);
    }
};

export const fetchArchivedGame = async ({ id, userid }: { id?: number; userid?: number }) => {
    let url = `${API_URL}/v1/games?`;
    if (id) {
        url += `id=${id}`;
    } else {
        url += `userid=${userid}`;
    }
    try {
        // TODO: handle caching more efficiently
        const res = await fetch(url, {
            next: { revalidate: 20 }
        });

        if (res && res.status === 200) {
            if (id) {
                const game: Game = await res.json();
                if (game.id) return game;
            } else {
                const games: Game[] = await res.json();
                if (games.length && games[0].id) return games;
            }
        }
    } catch (err) {
        console.error(err);
    }
};
