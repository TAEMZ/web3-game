// Serialize every transaction signed by the shared treasury/minter wallet so
// they never collide on the account nonce. Both the reward minter (arena.ts) and
// the custodial gas-funder (custody.ts) sign from the same account, so without
// this two in-flight txns can reuse a nonce ("replacement transaction underpriced").
// Each queued fn should await its receipt before resolving.
let tail: Promise<unknown> = Promise.resolve();

export function serializeTreasury<T>(fn: () => Promise<T>): Promise<T> {
    const result = tail.then(() => fn());
    tail = result.then(
        () => undefined,
        () => undefined
    );
    return result;
}
