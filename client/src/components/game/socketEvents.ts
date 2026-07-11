import type { Action, CustomSquares, Lobby, Message } from "@/types";
import type { Game, User } from "@arena/types";
import type { Dispatch, SetStateAction } from "react";
import type { Socket } from "socket.io-client";

import { syncPgn, syncSide } from "./utils";

export function initSocket(
    user: User,
    socket: Socket,
    lobby: Lobby,
    actions: {
        updateLobby: Dispatch<Action>;
        addMessage: Function;
        updateCustomSquares: Dispatch<Partial<CustomSquares>>;
        makeMove: Function;
        setNavFen: Dispatch<SetStateAction<string | null>>;
        setNavIndex: Dispatch<SetStateAction<number | null>>;
        onGameOver?: (payload: {
            reason: Game["endReason"];
            winnerName?: string;
            winnerSide?: "white" | "black" | "draw";
            gameId: number;
        }) => void;
        onEmote?: (payload: { key: string; from: string }) => void;
        onClock?: (payload: { w: number; b: number; turn: "w" | "b"; running: boolean }) => void;
        onCancelled?: () => void;
    }
) {
    socket.on("connect", () => {
        socket.emit("joinLobby", lobby.code);
    });
    // TODO: handle disconnect

    socket.on("chat", (message: Message) => {
        actions.addMessage(message);
    });

    socket.on("emote", (payload: { key: string; from: string }) => {
        actions.onEmote?.(payload);
    });

    socket.on("clock", (payload: { w: number; b: number; turn: "w" | "b"; running: boolean }) => {
        actions.onClock?.(payload);
    });

    // The game was cancelled before it started (not a resignation) — leave the board.
    socket.on("gameCancelled", () => {
        actions.onCancelled?.();
    });

    socket.on("receivedLatestGame", (latestGame: Game) => {
        if (latestGame.pgn && latestGame.pgn !== lobby.actualGame.pgn()) {
            syncPgn(latestGame.pgn, lobby, actions);
        }
        actions.updateLobby({ type: "updateLobby", payload: latestGame });

        syncSide(user, latestGame, lobby, actions);
    });

    socket.on("receivedMove", (m: { from: string; to: string; promotion?: string }) => {
        const success = actions.makeMove(m);
        if (!success) {
            socket.emit("getLatestGame");
        }
    });

    socket.on("userJoinedAsPlayer", ({ name, side }: { name: string; side: "white" | "black" }) => {
        actions.addMessage({
            author: { name: "server" },
            message: `${name} is now playing as ${side}.`
        });
    });

    socket.on(
        "gameOver",
        ({
            reason,
            winnerName,
            winnerSide,
            id,
            clock
        }: {
            reason: Game["endReason"];
            winnerName?: string;
            winnerSide?: "white" | "black" | "draw";
            id: number;
            clock?: { w: number; b: number; turn: "w" | "b"; running: boolean };
        }) => {
            const m = {
                author: { name: "server" }
            } as Message;

            if (reason === "abandoned") {
                if (!winnerSide) {
                    m.message = `${winnerName} has claimed a draw due to abandonment.`;
                } else {
                    m.message = `${winnerName} (${winnerSide}) has claimed the win due to abandonment.`;
                }
            } else if (reason === "checkmate") {
                m.message = `${winnerName} (${winnerSide}) has won by checkmate.`;
            } else if (reason === "resignation") {
                m.message = `${winnerName} (${winnerSide}) has won by resignation.`;
            } else if (reason === "timeout") {
                m.message = `${winnerName} (${winnerSide}) has won on time.`;
            } else {
                let message = "The game has ended in a draw";
                if (reason === "repetition") {
                    message = message.concat(" due to threefold repetition");
                } else if (reason === "insufficient") {
                    message = message.concat(" due to insufficient material");
                } else if (reason === "stalemate") {
                    message = "The game has been drawn due to stalemate";
                }
                m.message = message.concat(".");
            }
            actions.updateLobby({
                type: "updateLobby",
                payload: { endReason: reason, winner: winnerSide || "draw", id }
            });
            actions.addMessage(m);

            // Freeze the clocks at their final values (running:false stops the ticker).
            if (clock && actions.onClock) actions.onClock(clock);

            // Surface a game-over screen to EVERYONE in the room (both players and
            // spectators). GamePage decides win/loss/draw from the viewer's side.
            if (actions.onGameOver) {
                actions.onGameOver({ reason, winnerName, winnerSide, gameId: id });
            }
        }
    );
}
