import type { Socket } from "socket.io";

import { io } from "../server.js";
import {
    cancelGame,
    chat,
    claimAbandoned,
    emote,
    getLatestGame,
    joinAsPlayer,
    joinLobby,
    leaveLobby,
    resign,
    rtcSignal,
    sendMove
} from "./game.socket.js";

const socketConnect = (socket: Socket) => {
    const req = socket.request;

    socket.use((__, next) => {
        req.session.reload((err) => {
            if (err) {
                socket.disconnect();
            } else {
                next();
            }
        });
    });

    socket.on("disconnect", leaveLobby);

    socket.on("joinLobby", joinLobby);
    socket.on("leaveLobby", leaveLobby);

    socket.on("getLatestGame", getLatestGame);
    socket.on("sendMove", sendMove);
    socket.on("joinAsPlayer", joinAsPlayer);
    socket.on("chat", chat);
    socket.on("emote", emote);
    socket.on("rtcSignal", rtcSignal);
    socket.on("claimAbandoned", claimAbandoned);
    socket.on("resign", resign);
    socket.on("cancelGame", cancelGame);
};

export const init = () => {
    io.on("connection", socketConnect);
};
