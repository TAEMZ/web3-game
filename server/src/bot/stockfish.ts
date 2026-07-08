import { spawn, type ChildProcess } from "child_process";
import { createRequire } from "module";
import * as path from "path";

/**
 * Real Stockfish 18 (WASM lite, single-threaded) driven as a child process over
 * the UCI protocol. One persistent engine process handles requests serially
 * (UCI searches one position at a time). If the engine can't start or a request
 * times out, callers fall back to the built-in engine — see bot/index.ts.
 */

type Difficulty = "easy" | "medium" | "hard";

// Stockfish's native Skill Level (0–20) is a far better difficulty knob than a
// fixed search depth. Pair it with a per-move time budget.
const SKILL: Record<Difficulty, number> = { easy: 1, medium: 8, hard: 20 };
const MOVETIME: Record<Difficulty, number> = { easy: 300, medium: 600, hard: 1000 };

const require = createRequire(import.meta.url);

let engine: ChildProcess | null = null;
let ready = false;
let stdoutBuf = "";
const lineHandlers: Array<(line: string) => void> = [];
let queue: Promise<unknown> = Promise.resolve();

function enginePath(): string {
    // .../stockfish/index.js -> .../stockfish/bin/stockfish-18-lite-single.js
    const pkg = require.resolve("stockfish");
    return path.join(path.dirname(pkg), "bin", "stockfish-18-lite-single.js");
}

function start(): void {
    if (engine) return;
    engine = spawn(process.execPath, [enginePath()], { stdio: ["pipe", "pipe", "ignore"] });
    engine.stdout?.on("data", (chunk: Buffer) => {
        stdoutBuf += chunk.toString();
        let nl: number;
        while ((nl = stdoutBuf.indexOf("\n")) >= 0) {
            const line = stdoutBuf.slice(0, nl).trim();
            stdoutBuf = stdoutBuf.slice(nl + 1);
            for (const h of [...lineHandlers]) h(line);
        }
    });
    const die = () => {
        engine = null;
        ready = false;
    };
    engine.on("exit", die);
    engine.on("error", die);
}

function send(cmd: string): void {
    engine?.stdin?.write(cmd + "\n");
}

function waitFor(pred: (line: string) => boolean, timeoutMs: number): Promise<string | null> {
    return new Promise((resolve) => {
        const handler = (line: string) => {
            if (pred(line)) {
                clearTimeout(timer);
                remove();
                resolve(line);
            }
        };
        const remove = () => {
            const i = lineHandlers.indexOf(handler);
            if (i >= 0) lineHandlers.splice(i, 1);
        };
        const timer = setTimeout(() => {
            remove();
            resolve(null);
        }, timeoutMs);
        lineHandlers.push(handler);
    });
}

async function ensureReady(): Promise<boolean> {
    if (ready && engine) return true;
    start();
    if (!engine) return false;
    send("uci");
    if (!(await waitFor((l) => l === "uciok", 5000))) return false;
    send("isready");
    await waitFor((l) => l === "readyok", 5000);
    ready = true;
    return true;
}

/**
 * Best move as a UCI string (e.g. "e2e4", "e7e8q") for the given FEN, or null
 * if the engine is unavailable / has no move. Requests are serialized.
 */
export function sfMove(fen: string, difficulty: Difficulty): Promise<string | null> {
    const task = queue
        .then(async () => {
            if (!(await ensureReady())) return null;
            send(`setoption name Skill Level value ${SKILL[difficulty]}`);
            send("position fen " + fen);
            send("go movetime " + MOVETIME[difficulty]);
            const line = await waitFor((l) => l.startsWith("bestmove"), MOVETIME[difficulty] + 4000);
            if (!line) return null;
            const mv = line.split(/\s+/)[1];
            return mv && mv !== "(none)" ? mv : null;
        })
        .catch(() => null);
    // Chain the next request after this one regardless of outcome.
    queue = task.catch(() => {});
    return task;
}
