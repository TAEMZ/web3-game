import cors from "cors";
import "dotenv/config";
import type { NextFunction, Request, Response } from "express";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

import { INIT_TABLES, db } from "./db/index.js";
import session from "./middleware/session.js";
import routes from "./routes/index.js";
import { init as initSocket } from "./socket/index.js";
import { startSettlementRetryLoop } from "./db/models/settlement-queue.js";

// Validate critical environment variables before starting.
if (!process.env.SESSION_SECRET) {
    console.error("FATAL: SESSION_SECRET environment variable is required but not set.");
    console.error("Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
    process.exit(1);
}

const corsConfig = {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true
};

const app = express();
const server = createServer(app);

// database
await db.connect();
db.query(INIT_TABLES, (err) => {
    if (err) {
        console.error(err);
    } else {
        console.log("Tables initialized");
    }
});

// middleware
app.use(cors(corsConfig));
app.use(express.json());
app.set("trust proxy", 1);
app.use(session);
app.use("/v1", routes);

// socket.io
export const io = new Server(server, { cors: corsConfig, pingInterval: 30000, pingTimeout: 50000 });
io.use((socket, next) => {
    session(socket.request as Request, {} as Response, next as NextFunction);
});
io.use((socket, next) => {
    const session = socket.request.session;
    if (session && session.user) {
        next();
    } else {
        console.log("io.use: no session");
        socket.disconnect();
    }
});
initSocket();

const port = process.env.PORT || 3001;
server.listen(port, () => {
    console.log(`arena api server listening on :${port}`);
    startSettlementRetryLoop();
});
