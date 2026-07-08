import type { Game } from "@arena/types";
import { Chess } from "chess.js";
import type { DisconnectReason, Socket } from "socket.io";

import GameModel, { activeGames } from "../db/models/game.model.js";
import { getBotMove } from "../bot/index.js";
import { io } from "../server.js";

// TODO: clean up

// Detect the game-ending condition from a finished position, persist it, tell
// the room, and drop the game from memory. Shared by human and bot moves.
async function concludeGame(game: Game, chess: Chess) {
    let reason: Game["endReason"];
    if (chess.isCheckmate()) reason = "checkmate";
    else if (chess.isStalemate()) reason = "stalemate";
    else if (chess.isThreefoldRepetition()) reason = "repetition";
    else if (chess.isInsufficientMaterial()) reason = "insufficient";
    else if (chess.isDraw()) reason = "draw";

    // After a checkmating move it is the mated side's turn to move.
    const winnerSide =
        reason === "checkmate" ? (chess.turn() === "w" ? "black" : "white") : undefined;
    const winnerName =
        winnerSide === "white"
            ? game.white?.name
            : winnerSide === "black"
              ? game.black?.name
              : undefined;

    game.winner = reason === "checkmate" ? winnerSide : "draw";
    game.endReason = reason;

    const saved = (await GameModel.save(game)) as Game;
    game.id = saved.id;
    io.to(game.code as string).emit("gameOver", { reason, winnerName, winnerSide, id: saved.id });

    if (game.timeout) clearTimeout(game.timeout);
    activeGames.splice(activeGames.indexOf(game), 1);
}

export async function joinLobby(this: Socket, gameCode: string) {
    const game = activeGames.find((g) => g.code === gameCode);
    if (!game) return;

    if (game.host && game.host?.id === this.request.session.user.id) {
        game.host.connected = true;
        if (game.host.name !== this.request.session.user.name) {
            game.host.name = this.request.session.user.name;
        }
    }
    if (game.white && game.white?.id === this.request.session.user.id) {
        game.white.connected = true;
        game.white.disconnectedOn = undefined;
        if (game.white.name !== this.request.session.user.name) {
            game.white.name = this.request.session.user.name;
        }
    } else if (game.black && game.black?.id === this.request.session.user.id) {
        game.black.connected = true;
        game.black.disconnectedOn = undefined;
        if (game.black.name !== this.request.session.user.name) {
            game.black.name = this.request.session.user.name;
        }
    } else {
        if (game.observers === undefined) game.observers = [];
        const user = {
            id: this.request.session.user.id,
            name: this.request.session.user.name
        };
        game.observers?.push(user);
    }

    if (this.rooms.size >= 2) {
        await leaveLobby.call(this);
    }

    if (game.timeout) {
        clearTimeout(game.timeout);
        game.timeout = undefined;
    }

    await this.join(gameCode);
    io.to(game.code as string).emit("receivedLatestGame", game);
}

export async function leaveLobby(this: Socket, reason?: DisconnectReason, code?: string) {
    if (this.rooms.size >= 3 && !code) {
        console.log(`leaveLobby: room size is ${this.rooms.size}, aborting...`);
        return;
    }
    const game = activeGames.find(
        (g) =>
            g.code === (code || this.rooms.size === 2 ? Array.from(this.rooms)[1] : 0) ||
            (g.black?.connected && g.black?.id === this.request.session.user.id) ||
            (g.white?.connected && g.white?.id === this.request.session.user.id) ||
            g.observers?.find((o) => this.request.session.user.id === o.id)
    );

    if (game) {
        const user = game.observers?.find((o) => o.id === this.request.session.user.id);
        if (user) {
            game.observers?.splice(game.observers?.indexOf(user), 1);
        }
        if (game.black && game.black?.id === this.request.session.user.id) {
            game.black.connected = false;
            game.black.disconnectedOn = Date.now();
        } else if (game.white && game.white?.id === this.request.session.user.id) {
            game.white.connected = false;
            game.white.disconnectedOn = Date.now();
        }

        // count sockets
        const sockets = await io.in(game.code as string).fetchSockets();

        if (sockets.length <= 0 || (reason === undefined && sockets.length <= 1)) {
            if (game.timeout) clearTimeout(game.timeout);

            let timeout = 1000 * 60; // 1 minute
            if (game.pgn) {
                timeout *= 20; // 20 minutes if game has started
            }
            game.timeout = Number(
                setTimeout(() => {
                    activeGames.splice(activeGames.indexOf(game), 1);
                }, timeout)
            );
        } else {
            this.to(game.code as string).emit("receivedLatestGame", game);
        }
    }
    await this.leave(code || Array.from(this.rooms)[1]);
}

export async function claimAbandoned(this: Socket, type: "win" | "draw") {
    const game = activeGames.find((g) => g.code === Array.from(this.rooms)[1]);
    if (
        !game ||
        !game.pgn ||
        !game.white ||
        !game.black ||
        (game.white.id !== this.request.session.user.id &&
            game.black.id !== this.request.session.user.id)
    ) {
        console.log(`claimAbandoned: Invalid game or user is not a player.`);
        return;
    }

    if (
        (game.white &&
            game.white.id === this.request.session.user.id &&
            (game.black?.connected ||
                Date.now() - (game.black?.disconnectedOn as number) < 50000)) ||
        (game.black &&
            game.black.id === this.request.session.user.id &&
            (game.white?.connected || Date.now() - (game.white?.disconnectedOn as number) < 50000))
    ) {
        console.log(
            `claimAbandoned: Invalid claim by ${this.request.session.user.name}. Opponent is still connected or disconnected less than 50 seconds ago.`
        );
        return;
    }

    game.endReason = "abandoned";

    if (type === "draw") {
        game.winner = "draw";
    } else if (game.white && game.white?.id === this.request.session.user.id) {
        game.winner = "white";
    } else if (game.black && game.black?.id === this.request.session.user.id) {
        game.winner = "black";
    }

    const { id } = (await GameModel.save(game)) as Game;
    game.id = id;

    const gameOver = {
        reason: game.endReason,
        winnerName: this.request.session.user.name,
        winnerSide: game.winner === "draw" ? undefined : game.winner,
        id
    };

    io.to(game.code as string).emit("gameOver", gameOver);

    if (game.timeout) clearTimeout(game.timeout);
    activeGames.splice(activeGames.indexOf(game), 1);
}

export async function resign(this: Socket) {
    const game = activeGames.find((g) => g.code === Array.from(this.rooms)[1]);
    if (
        !game ||
        !game.pgn ||
        !game.white ||
        !game.black ||
        (game.white.id !== this.request.session.user.id &&
            game.black.id !== this.request.session.user.id)
    ) {
        console.log(`resign: Invalid game or user is not a player.`);
        return;
    }

    game.endReason = "resignation";

    // Set the opponent as the winner
    if (game.white && game.white?.id === this.request.session.user.id) {
        game.winner = "black";
    } else if (game.black && game.black?.id === this.request.session.user.id) {
        game.winner = "white";
    }

    const winnerName = game.winner === "white" ? game.white?.name : game.black?.name;

    const { id } = (await GameModel.save(game)) as Game;
    game.id = id;

    const gameOver = {
        reason: game.endReason,
        winnerName,
        winnerSide: game.winner,
        id
    };

    io.to(game.code as string).emit("gameOver", gameOver);

    if (game.timeout) clearTimeout(game.timeout);
    activeGames.splice(activeGames.indexOf(game), 1);
}

// eslint-disable-next-line no-unused-vars
export async function getLatestGame(this: Socket) {
    const game = activeGames.find((g) => g.code === Array.from(this.rooms)[1]);
    if (game) this.emit("receivedLatestGame", game);
}

export async function sendMove(this: Socket, m: { from: string; to: string; promotion?: string }) {
    const game = activeGames.find((g) => g.code === Array.from(this.rooms)[1]);
    if (!game || game.endReason || game.winner) return;
    const chess = new Chess();
    if (game.pgn) {
        chess.loadPgn(game.pgn);
    }

    try {
        const prevTurn = chess.turn();

        if (
            (prevTurn === "b" && this.request.session.user.id !== game.black?.id) ||
            (prevTurn === "w" && this.request.session.user.id !== game.white?.id)
        ) {
            throw new Error("not turn to move");
        }

        const newMove = chess.move(m);
        if (!newMove) {
            throw new Error("invalid move");
        }

        game.pgn = chess.pgn();
        this.to(game.code as string).emit("receivedMove", m);

        if (chess.isGameOver()) {
            await concludeGame(game, chess);
            return;
        }

        // Computer opponent: if it is now the bot's turn, play its reply and
        // broadcast it to the human (and any spectators).
        const toMove = chess.turn() === "w" ? game.white : game.black;
        if (game.vsBot && toMove?.isBot) {
            const botMove = await getBotMove(game.pgn as string, game.botDifficulty || "medium");
            if (botMove) {
                chess.move({ from: botMove.from, to: botMove.to, promotion: botMove.promotion });
                game.pgn = chess.pgn();
                io.to(game.code as string).emit("receivedMove", botMove);
                if (chess.isGameOver()) {
                    await concludeGame(game, chess);
                }
            }
        }
    } catch (e) {
        console.log("sendMove error: " + e);
        this.emit("receivedLatestGame", game);
    }
}

// eslint-disable-next-line no-unused-vars
export async function joinAsPlayer(this: Socket) {
    const game = activeGames.find((g) => g.code === Array.from(this.rooms)[1]);
    if (!game) return;
    const user = game.observers?.find((o) => o.id === this.request.session.user.id);
    if (!game.white) {
        const sessionUser = {
            id: this.request.session.user.id,
            name: this.request.session.user.name,
            connected: true
        };
        game.white = sessionUser;
        if (user) game.observers?.splice(game.observers?.indexOf(user), 1);
        io.to(game.code as string).emit("userJoinedAsPlayer", {
            name: this.request.session.user.name,
            side: "white"
        });
        game.startedAt = Date.now();
    } else if (!game.black) {
        const sessionUser = {
            id: this.request.session.user.id,
            name: this.request.session.user.name,
            connected: true
        };
        game.black = sessionUser;
        if (user) game.observers?.splice(game.observers?.indexOf(user), 1);
        io.to(game.code as string).emit("userJoinedAsPlayer", {
            name: this.request.session.user.name,
            side: "black"
        });
        game.startedAt = Date.now();
    } else {
        console.log("joinAsPlayer: attempted to join a game with already 2 players");
    }
    io.to(game.code as string).emit("receivedLatestGame", game);
}

export async function chat(this: Socket, message: string) {
    this.to(Array.from(this.rooms)[1]).emit("chat", {
        author: this.request.session.user,
        message
    });
}

// WebRTC signaling relay for in-game video chat (players + spectators mesh).
// A message with `to` is delivered to that one socket; otherwise it is
// broadcast to the whole game room (used for peer discovery). The server stamps
// the real sender id as `from` so clients can't spoof it. Media flows P2P.
export async function rtcSignal(this: Socket, data: { to?: string; [key: string]: unknown }) {
    const room = Array.from(this.rooms)[1];
    if (!room) return;
    const payload = { ...data, from: this.id };
    if (typeof data.to === "string") {
        this.to(data.to).emit("rtcSignal", payload);
    } else {
        this.to(room).emit("rtcSignal", payload);
    }
}
