// Serialize async operations that share a key (e.g. a game code). Racing
// requests for the same key run one-at-a-time, so two players can't both create
// a wager for the same game and double-stake on-chain — the second one runs
// after the first and sees the wager already exists.
const chains = new Map<string, Promise<unknown>>();

export function withKeyLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = chains.get(key) ?? Promise.resolve();
    const run = prev.then(fn, fn);
    const settled = run.then(
        () => undefined,
        () => undefined
    );
    chains.set(key, settled);
    // best-effort cleanup so the map doesn't grow forever
    settled.then(() => {
        if (chains.get(key) === settled) chains.delete(key);
    });
    return run;
}
